import { describe, it, expect } from "vitest";
import { computeSnapshots, computeTeamLoad, computeThreads } from "../snapshotEngine";
import type { NormalizedEvent, Project, Signal } from "../types";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const baseEvent = (overrides: Partial<NormalizedEvent>): NormalizedEvent => ({
  id: "e_" + Math.random(),
  source: "github",
  type: "pr_opened",
  projectId: "p_test",
  timestamp: new Date().toISOString(),
  actor: "alice",
  refs: {},
  payload: {},
  ...overrides,
});

const baseSignal = (overrides: Partial<Signal>): Signal => ({
  id: "s_" + Math.random(),
  projectId: "p_test",
  severity: "info",
  title: "Something happened",
  reason: "because",
  evidence: [],
  links: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

const project: Project = {
  id: "p_test",
  name: "Test Project",
  jiraKey: "TEST",
  githubRepo: "acme/test",
  slackChannel: "#test",
  owner: "alice",
};

const only = <T>(list: T[]): T => {
  expect(list).toHaveLength(1);
  return list[0];
};

describe("computeSnapshots", () => {
  it("returns one snapshot per project", () => {
    const second: Project = { ...project, id: "p_other" };
    const snapshots = computeSnapshots([project, second], [], []);
    expect(snapshots.map((s) => s.projectId)).toEqual(["p_test", "p_other"]);
  });

  it("scopes events and signals to their own project", () => {
    const events = [
      baseEvent({ projectId: "p_test", refs: { prNumber: 1 } }),
      baseEvent({ projectId: "p_other", refs: { prNumber: 2 } }),
    ];
    const snapshot = only(computeSnapshots([project], events, []));
    expect(snapshot.openPRs).toBe(1);
  });

  describe("healthState", () => {
    it("is risk when any signal is risk", () => {
      const signals = [baseSignal({ severity: "watch" }), baseSignal({ severity: "risk" })];
      expect(only(computeSnapshots([project], [], signals)).healthState).toBe("risk");
    });

    it("is watch when the worst signal is watch", () => {
      const signals = [baseSignal({ severity: "info" }), baseSignal({ severity: "watch" })];
      expect(only(computeSnapshots([project], [], signals)).healthState).toBe("watch");
    });

    it("is stable with no signals", () => {
      expect(only(computeSnapshots([project], [], [])).healthState).toBe("stable");
    });
  });

  describe("topReason", () => {
    it("reports the most severe signal regardless of input order", () => {
      const signals = [
        baseSignal({ severity: "info", title: "Just so you know" }),
        baseSignal({ severity: "risk", title: "Release is blocked" }),
        baseSignal({ severity: "watch", title: "Keep an eye on this" }),
      ];
      expect(only(computeSnapshots([project], [], signals)).topReason).toBe("Release is blocked");
    });

    it("falls back to a neutral message with no signals", () => {
      expect(only(computeSnapshots([project], [], [])).topReason).toBe(
        "No signals — operating normally"
      );
    });
  });

  describe("openPRs", () => {
    it("counts each PR once no matter how many times it was opened", () => {
      const events = [
        baseEvent({ refs: { prNumber: 7 }, timestamp: daysAgo(3) }),
        baseEvent({ refs: { prNumber: 7 }, timestamp: daysAgo(1) }),
      ];
      expect(only(computeSnapshots([project], events, [])).openPRs).toBe(1);
    });

    it("excludes PRs whose payload marks them closed", () => {
      const events = [
        baseEvent({ refs: { prNumber: 1 } }),
        baseEvent({ refs: { prNumber: 2 }, payload: { state: "closed" } }),
      ];
      expect(only(computeSnapshots([project], events, [])).openPRs).toBe(1);
    });
  });

  describe("trend", () => {
    it("is worsening when recent activity outpaces the prior window", () => {
      const events = [
        baseEvent({ timestamp: daysAgo(3) }),
        baseEvent({ timestamp: daysAgo(0.5) }),
        baseEvent({ timestamp: daysAgo(0.5) }),
        baseEvent({ timestamp: daysAgo(1) }),
      ];
      expect(only(computeSnapshots([project], events, [])).trend).toBe("worsening");
    });

    it("is improving when recent activity drops off", () => {
      const events = [
        baseEvent({ timestamp: daysAgo(3) }),
        baseEvent({ timestamp: daysAgo(3) }),
        baseEvent({ timestamp: daysAgo(2.5) }),
        baseEvent({ timestamp: daysAgo(0.5) }),
      ];
      expect(only(computeSnapshots([project], events, [])).trend).toBe("improving");
    });

    it("is flat when both windows are empty", () => {
      expect(only(computeSnapshots([project], [], [])).trend).toBe("flat");
    });
  });

  describe("reviewBacklog", () => {
    it("counts signals that mention review", () => {
      const signals = [
        baseSignal({ title: "PR #4 waiting on review" }),
        baseSignal({ title: "PR #5 waiting on REVIEW" }),
        baseSignal({ title: "Ticket has gone stale" }),
      ];
      expect(only(computeSnapshots([project], [], signals)).reviewBacklog).toBe(2);
    });

    it("estimates from open PRs when no review signal fired", () => {
      // With no review signals the count is 0, so the engine falls back to
      // however many open PRs exceed a tolerated depth of two.
      const events = [1, 2, 3, 4, 5].map((n) => baseEvent({ refs: { prNumber: n } }));
      expect(only(computeSnapshots([project], events, [])).reviewBacklog).toBe(3);
    });

    it("does not go negative when open PRs are within tolerance", () => {
      const events = [baseEvent({ refs: { prNumber: 1 } })];
      expect(only(computeSnapshots([project], events, [])).reviewBacklog).toBe(0);
    });
  });

  it("counts stale ticket signals and slack incident events", () => {
    const signals = [baseSignal({ title: "TEST-1 has gone stale" })];
    const events = [baseEvent({ source: "slack", type: "incident_thread" })];
    const snapshot = only(computeSnapshots([project], events, signals));
    expect(snapshot.staleTickets).toBe(1);
    expect(snapshot.activeIncidents).toBe(1);
  });

  it("ignores incident threads that did not come from slack", () => {
    const events = [baseEvent({ source: "jira", type: "incident_thread" })];
    expect(only(computeSnapshots([project], events, [])).activeIncidents).toBe(0);
  });
});

describe("computeTeamLoad", () => {
  it("returns a balanced, empty snapshot for no events", () => {
    expect(computeTeamLoad([])).toEqual({
      state: "balanced",
      members: [],
      averageThreads: 0,
      reviewBacklog: 0,
    });
  });

  it("drops the synthetic system and unknown actors", () => {
    const events = [
      baseEvent({ actor: "system" }),
      baseEvent({ actor: "unknown" }),
      baseEvent({ actor: "alice" }),
    ];
    expect(computeTeamLoad(events).members.map((m) => m.id)).toEqual(["alice"]);
  });

  it("groups a ticket's events into one thread per actor", () => {
    const events = [
      baseEvent({ actor: "alice", refs: { ticketKey: "TEST-1" } }),
      baseEvent({ actor: "alice", refs: { ticketKey: "TEST-1" } }),
      baseEvent({ actor: "alice", refs: { ticketKey: "TEST-2" } }),
    ];
    expect(computeTeamLoad(events).members[0].activeThreads).toBe(2);
  });

  it("prefers the ticket key over the PR number when both are present", () => {
    const events = [
      baseEvent({ actor: "alice", refs: { ticketKey: "TEST-1", prNumber: 1 } }),
      baseEvent({ actor: "alice", refs: { ticketKey: "TEST-1", prNumber: 2 } }),
    ];
    expect(computeTeamLoad(events).members[0].activeThreads).toBe(1);
  });

  it("counts reviews and incidents per member", () => {
    const events = [
      baseEvent({ actor: "alice", type: "pr_review", refs: { prNumber: 1 } }),
      baseEvent({ actor: "alice", type: "pr_review", refs: { prNumber: 2 } }),
      baseEvent({ actor: "alice", type: "incident_thread", refs: { threadTs: "t1" } }),
    ];
    const alice = computeTeamLoad(events).members[0];
    expect(alice.reviewsPending).toBe(2);
    expect(alice.incidentsTouched).toBe(1);
  });

  it("derives display name and initials from a snake_case handle", () => {
    const member = computeTeamLoad([baseEvent({ actor: "ada_lovelace" })]).members[0];
    expect(member.name).toBe("Ada Lovelace");
    expect(member.initials).toBe("AL");
  });

  it("falls back to the first two characters for a single-word handle", () => {
    expect(computeTeamLoad([baseEvent({ actor: "alice" })]).members[0].initials).toBe("AL");
  });

  it("caps the roster at eight members", () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      baseEvent({ actor: `dev${i}`, refs: { ticketKey: `TEST-${i}` } })
    );
    expect(computeTeamLoad(events).members).toHaveLength(8);
  });

  it("ranks the busiest member first", () => {
    const events = [
      baseEvent({ actor: "quiet", refs: { ticketKey: "TEST-1" } }),
      ...Array.from({ length: 4 }, (_, i) =>
        baseEvent({ actor: "busy", refs: { ticketKey: `TEST-${i + 2}` } })
      ),
    ];
    expect(computeTeamLoad(events).members[0].id).toBe("busy");
  });

  it("reports overloaded when two members each carry seven or more items", () => {
    const events = ["alice", "bob"].flatMap((actor) =>
      Array.from({ length: 7 }, (_, i) => baseEvent({ actor, refs: { ticketKey: `${actor}-${i}` } }))
    );
    expect(computeTeamLoad(events).state).toBe("overloaded");
  });

  it("reports stretched when a single member is heavily loaded", () => {
    const events = Array.from({ length: 7 }, (_, i) =>
      baseEvent({ actor: "alice", refs: { ticketKey: `TEST-${i}` } })
    );
    expect(computeTeamLoad(events).state).toBe("stretched");
  });
});

describe("computeThreads", () => {
  it("ignores events that carry no ticket key", () => {
    expect(computeThreads([baseEvent({ refs: { prNumber: 1 } })])).toEqual([]);
  });

  it("builds a slug id from the ticket key", () => {
    const events = [baseEvent({ refs: { ticketKey: "TEST-42" } })];
    expect(only(computeThreads(events)).id).toBe("t_test_42");
  });

  it("titles the thread from the first event that carries one", () => {
    const events = [
      baseEvent({ refs: { ticketKey: "TEST-1" }, payload: {} }),
      baseEvent({ refs: { ticketKey: "TEST-1" }, payload: { title: "Fix the login redirect" } }),
      baseEvent({ refs: { ticketKey: "TEST-1" }, payload: { title: "A later, ignored title" } }),
    ];
    expect(only(computeThreads(events)).title).toBe("Fix the login redirect — TEST-1");
  });

  it("falls back to Untitled when no event carries a title", () => {
    const events = [baseEvent({ refs: { ticketKey: "TEST-1" } })];
    expect(only(computeThreads(events)).title).toBe("Untitled — TEST-1");
  });

  it("orders thread events oldest first regardless of input order", () => {
    const events = [
      baseEvent({ id: "newest", refs: { ticketKey: "TEST-1" }, timestamp: daysAgo(1) }),
      baseEvent({ id: "oldest", refs: { ticketKey: "TEST-1" }, timestamp: daysAgo(5) }),
      baseEvent({ id: "middle", refs: { ticketKey: "TEST-1" }, timestamp: daysAgo(3) }),
    ];
    expect(only(computeThreads(events)).events.map((e) => e.id)).toEqual([
      "oldest",
      "middle",
      "newest",
    ]);
  });

  it("separates threads by ticket key", () => {
    const events = [
      baseEvent({ refs: { ticketKey: "TEST-1" } }),
      baseEvent({ refs: { ticketKey: "TEST-2" } }),
    ];
    expect(computeThreads(events).map((t) => t.id).sort()).toEqual(["t_test_1", "t_test_2"]);
  });

  it("describes each event type in a human-readable way", () => {
    const events = [
      baseEvent({ refs: { ticketKey: "TEST-1" }, type: "ticket_created", timestamp: daysAgo(5) }),
      baseEvent({
        refs: { ticketKey: "TEST-1" },
        type: "status_change",
        payload: { status: "In Review" },
        timestamp: daysAgo(4),
      }),
      baseEvent({
        refs: { ticketKey: "TEST-1", prNumber: 9 },
        type: "pr_opened",
        payload: { title: "Add redirect" },
        timestamp: daysAgo(3),
      }),
      baseEvent({
        refs: { ticketKey: "TEST-1" },
        type: "pr_review",
        payload: { state: "approved" },
        timestamp: daysAgo(2),
      }),
    ];
    expect(only(computeThreads(events)).events.map((e) => e.title)).toEqual([
      "TEST-1 created",
      "Status → In Review",
      "PR #9 opened — Add redirect",
      "Review submitted (approved)",
    ]);
  });

  it("falls back to the raw type for an unrecognised event", () => {
    const events = [baseEvent({ refs: { ticketKey: "TEST-1" }, type: "deploy_started" })];
    expect(only(computeThreads(events)).events[0].title).toBe("deploy_started");
  });
});
