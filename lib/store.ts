import fs from "node:fs";
import path from "node:path";
import type {
  Acknowledgement,
  Project,
  ProjectSnapshot,
  Signal,
  TeamLoadSnapshot,
  WorkThread,
  NormalizedEvent,
} from "./types";

interface StoreState {
  projects: Project[];
  events: NormalizedEvent[];
  signals: Signal[];
  snapshots: ProjectSnapshot[];
  threads: WorkThread[];
  teamLoad: TeamLoadSnapshot;
  acknowledgements: Acknowledgement[];
  lastSyncAt: string | null;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "store.json");

let state: StoreState | null = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function emptyState(): StoreState {
  return {
    projects: [],
    events: [],
    signals: [],
    snapshots: [],
    threads: [],
    teamLoad: { state: "balanced", members: [], averageThreads: 0, reviewBacklog: 0 },
    acknowledgements: [],
    lastSyncAt: null,
  };
}

export function getStore(): StoreState {
  if (state) return state;
  ensureDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const loaded = JSON.parse(raw) as Partial<StoreState>;
      // Fill in fields added after this file was written, so a datastore from an
      // earlier version loads instead of throwing on first access.
      state = { ...emptyState(), ...loaded };
      return state;
    } catch {
      state = emptyState();
    }
  } else {
    state = emptyState();
  }
  return state;
}

export function persist() {
  if (!state) return;
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

export function resetStore() {
  state = emptyState();
  persist();
}

export const repo = {
  projects: {
    all: () => getStore().projects,
    byId: (id: string) => getStore().projects.find((p) => p.id === id),
    upsertMany: (items: Project[]) => {
      const s = getStore();
      const map = new Map(s.projects.map((p) => [p.id, p]));
      for (const it of items) map.set(it.id, it);
      s.projects = [...map.values()];
    },
  },
  events: {
    all: () => getStore().events,
    forProject: (projectId: string) => getStore().events.filter((e) => e.projectId === projectId),
    recent: (limit = 50) =>
      [...getStore().events].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, limit),
    appendMany: (items: NormalizedEvent[]) => {
      const s = getStore();
      const seen = new Set(s.events.map((e) => e.id));
      for (const it of items) if (!seen.has(it.id)) s.events.push(it);
    },
  },
  signals: {
    all: () => getStore().signals,
    forProject: (projectId: string) => getStore().signals.filter((s) => s.projectId === projectId),
    replaceAll: (items: Signal[]) => {
      getStore().signals = items;
    },
  },
  snapshots: {
    all: () => getStore().snapshots,
    forProject: (projectId: string) => getStore().snapshots.find((s) => s.projectId === projectId),
    replaceAll: (items: ProjectSnapshot[]) => {
      getStore().snapshots = items;
    },
  },
  threads: {
    all: () => getStore().threads,
    byId: (id: string) => getStore().threads.find((t) => t.id === id),
    replaceAll: (items: WorkThread[]) => {
      getStore().threads = items;
    },
  },
  teamLoad: {
    get: () => getStore().teamLoad,
    set: (t: TeamLoadSnapshot) => {
      getStore().teamLoad = t;
    },
  },
  acknowledgements: {
    all: () => getStore().acknowledgements,
    forSignal: (signalId: string) =>
      getStore().acknowledgements.find((a) => a.signalId === signalId),
    /** One acknowledgement per signal, so re-snoozing replaces rather than stacks. */
    upsert: (ack: Acknowledgement) => {
      const s = getStore();
      s.acknowledgements = [...s.acknowledgements.filter((a) => a.signalId !== ack.signalId), ack];
    },
    remove: (signalId: string) => {
      const s = getStore();
      const before = s.acknowledgements.length;
      s.acknowledgements = s.acknowledgements.filter((a) => a.signalId !== signalId);
      return s.acknowledgements.length < before;
    },
    replaceAll: (items: Acknowledgement[]) => {
      getStore().acknowledgements = items;
    },
  },
  meta: {
    lastSyncAt: () => getStore().lastSyncAt,
    setLastSyncAt: (iso: string) => {
      getStore().lastSyncAt = iso;
    },
  },
};
