import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Acknowledgement, NormalizedEvent, Project } from "../types";

/**
 * The datastore is a JSON file, so these tests give it an in-memory filesystem
 * rather than writing to disk. That keeps them hermetic and lets a corrupt or
 * partial file be simulated exactly — which is the interesting behaviour, since
 * both are things that happen to a hand-edited file in a real project.
 *
 * store.ts caches state in a module-level variable, so every case re-imports.
 */

const files = new Map<string, string>();
const dirs = new Set<string>();

vi.mock("node:fs", () => ({
  default: {
    existsSync: (p: string) => files.has(p) || dirs.has(p),
    mkdirSync: (p: string) => void dirs.add(p),
    readFileSync: (p: string) => {
      const content = files.get(p);
      if (content === undefined) throw new Error(`ENOENT: ${p}`);
      return content;
    },
    writeFileSync: (p: string, content: string) => void files.set(p, content),
  },
}));

const DB = `${process.cwd()}/data/store.json`;

async function loadStore() {
  vi.resetModules();
  return import("../store");
}

const project = (id: string): Project => ({
  id,
  name: id,
  jiraKey: "K",
  githubRepo: "acme/x",
  slackChannel: "#x",
  owner: "alice",
});

const event = (id: string): NormalizedEvent => ({
  id,
  source: "github",
  type: "pr_opened",
  projectId: "p1",
  timestamp: new Date().toISOString(),
  actor: "alice",
  refs: {},
  payload: {},
});

const ack = (signalId: string): Acknowledgement => ({
  signalId,
  until: null,
  actor: "you",
  createdAt: new Date().toISOString(),
});

beforeEach(() => {
  files.clear();
  dirs.clear();
});

describe("loading", () => {
  it("starts empty when no file exists", async () => {
    const { repo } = await loadStore();
    expect(repo.projects.all()).toEqual([]);
    expect(repo.events.all()).toEqual([]);
    expect(repo.meta.lastSyncAt()).toBeNull();
  });

  it("reads an existing file", async () => {
    files.set(DB, JSON.stringify({ projects: [project("p1")], lastSyncAt: "2026-01-01T00:00:00Z" }));
    const { repo } = await loadStore();
    expect(repo.projects.all()).toHaveLength(1);
    expect(repo.meta.lastSyncAt()).toBe("2026-01-01T00:00:00Z");
  });

  it("fills in fields a older file predates", async () => {
    // The migration path: a datastore written before acknowledgements existed
    // must load rather than leaving the key undefined and throwing on first use.
    files.set(DB, JSON.stringify({ projects: [project("p1")] }));
    const { repo } = await loadStore();
    expect(repo.acknowledgements.all()).toEqual([]);
    expect(repo.teamLoad.get().state).toBe("balanced");
  });

  it("falls back to an empty store when the file is corrupt", async () => {
    // A half-written or hand-edited file should not take the app down.
    files.set(DB, "{ not json");
    const { repo } = await loadStore();
    expect(repo.projects.all()).toEqual([]);
  });

  it("caches after the first read", async () => {
    files.set(DB, JSON.stringify({ projects: [project("p1")] }));
    const { repo } = await loadStore();
    repo.projects.upsertMany([project("p2")]);
    // A second read must not silently discard the in-memory change.
    expect(repo.projects.all()).toHaveLength(2);
  });
});

describe("persist", () => {
  it("writes the current state to disk", async () => {
    const { repo, persist } = await loadStore();
    repo.projects.upsertMany([project("p1")]);
    persist();
    expect(JSON.parse(files.get(DB)!).projects).toHaveLength(1);
  });

  it("creates the data directory when missing", async () => {
    const { repo, persist } = await loadStore();
    repo.projects.upsertMany([project("p1")]);
    persist();
    expect(dirs.has(`${process.cwd()}/data`)).toBe(true);
  });

  it("round-trips through a reload", async () => {
    const first = await loadStore();
    first.repo.projects.upsertMany([project("p1")]);
    first.repo.meta.setLastSyncAt("2026-02-02T00:00:00Z");
    first.persist();

    const second = await loadStore();
    expect(second.repo.projects.all().map((p) => p.id)).toEqual(["p1"]);
    expect(second.repo.meta.lastSyncAt()).toBe("2026-02-02T00:00:00Z");
  });
});

describe("resetStore", () => {
  it("empties the store and writes that through", async () => {
    const { repo, persist, resetStore } = await loadStore();
    repo.projects.upsertMany([project("p1")]);
    persist();
    resetStore();
    expect(repo.projects.all()).toEqual([]);
    expect(JSON.parse(files.get(DB)!).projects).toEqual([]);
  });
});

describe("projects", () => {
  it("upserts by id rather than appending duplicates", async () => {
    const { repo } = await loadStore();
    repo.projects.upsertMany([project("p1")]);
    repo.projects.upsertMany([{ ...project("p1"), name: "renamed" }]);
    expect(repo.projects.all()).toHaveLength(1);
    expect(repo.projects.all()[0].name).toBe("renamed");
  });

  it("finds one by id", async () => {
    const { repo } = await loadStore();
    repo.projects.upsertMany([project("p1"), project("p2")]);
    expect(repo.projects.byId("p2")?.id).toBe("p2");
    expect(repo.projects.byId("nope")).toBeUndefined();
  });
});

describe("events", () => {
  it("appends new events", async () => {
    const { repo } = await loadStore();
    repo.events.appendMany([event("e1"), event("e2")]);
    expect(repo.events.all()).toHaveLength(2);
  });

  it("ignores an event whose id is already stored", async () => {
    // Connectors re-fetch overlapping windows every cycle, so without this the
    // store would grow without bound and counts would double.
    const { repo } = await loadStore();
    repo.events.appendMany([event("e1")]);
    repo.events.appendMany([event("e1"), event("e2")]);
    expect(repo.events.all().map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("filters by project", async () => {
    const { repo } = await loadStore();
    repo.events.appendMany([event("e1"), { ...event("e2"), projectId: "p2" }]);
    expect(repo.events.forProject("p2").map((e) => e.id)).toEqual(["e2"]);
  });

  it("returns the most recent first, capped", async () => {
    const { repo } = await loadStore();
    const base = Date.now();
    repo.events.appendMany([
      { ...event("old"), timestamp: new Date(base - 100_000).toISOString() },
      { ...event("new"), timestamp: new Date(base).toISOString() },
    ]);
    expect(repo.events.recent(1).map((e) => e.id)).toEqual(["new"]);
  });
});

describe("acknowledgements", () => {
  it("upserts rather than stacking for the same signal", async () => {
    const { repo } = await loadStore();
    repo.acknowledgements.upsert(ack("s1"));
    repo.acknowledgements.upsert({ ...ack("s1"), actor: "someone else" });
    expect(repo.acknowledgements.all()).toHaveLength(1);
    expect(repo.acknowledgements.all()[0].actor).toBe("someone else");
  });

  it("removes and reports whether anything was removed", async () => {
    const { repo } = await loadStore();
    repo.acknowledgements.upsert(ack("s1"));
    expect(repo.acknowledgements.remove("s1")).toBe(true);
    expect(repo.acknowledgements.remove("s1")).toBe(false);
  });

  it("finds one by signal id", async () => {
    const { repo } = await loadStore();
    repo.acknowledgements.upsert(ack("s1"));
    expect(repo.acknowledgements.forSignal("s1")?.signalId).toBe("s1");
    expect(repo.acknowledgements.forSignal("missing")).toBeUndefined();
  });

  it("replaces the whole list, which is how pruning lands", async () => {
    const { repo } = await loadStore();
    repo.acknowledgements.upsert(ack("s1"));
    repo.acknowledgements.replaceAll([ack("s2")]);
    expect(repo.acknowledgements.all().map((a) => a.signalId)).toEqual(["s2"]);
  });
});

describe("replaceAll collections", () => {
  it("signals, snapshots and threads are wholesale replacements", async () => {
    // Every cycle recomputes these from scratch, so merging would resurrect
    // signals for work that has since been closed.
    const { repo } = await loadStore();
    repo.signals.replaceAll([{ id: "sig1" } as never]);
    repo.signals.replaceAll([{ id: "sig2" } as never]);
    expect(repo.signals.all()).toHaveLength(1);

    repo.threads.replaceAll([{ id: "t1" } as never]);
    expect(repo.threads.byId("t1")).toBeDefined();
  });

  it("stores and returns the team load snapshot", async () => {
    const { repo } = await loadStore();
    repo.teamLoad.set({ state: "overloaded", members: [], averageThreads: 3, reviewBacklog: 2 });
    expect(repo.teamLoad.get().state).toBe("overloaded");
  });
});
