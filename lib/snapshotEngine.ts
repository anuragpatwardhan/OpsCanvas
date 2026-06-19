import type {
  NormalizedEvent,
  Project,
  ProjectSnapshot,
  Signal,
  HealthState,
  Trend,
  TeamLoadSnapshot,
  WorkThread,
  ThreadEvent,
  Source,
} from "./types";

const DAYS = (n: number) => n * 86_400_000;

function pickHealth(signals: Signal[]): HealthState {
  if (signals.some((s) => s.severity === "risk")) return "risk";
  if (signals.some((s) => s.severity === "watch")) return "watch";
  return "stable";
}

function pickTrend(events: NormalizedEvent[]): Trend {
  const now = Date.now();
  const recent = events.filter((e) => now - new Date(e.timestamp).getTime() < DAYS(2)).length;
  const prior = events.filter(
    (e) => now - new Date(e.timestamp).getTime() >= DAYS(2) && now - new Date(e.timestamp).getTime() < DAYS(4)
  ).length;
  if (recent < prior * 0.7) return "improving";
  if (recent > prior * 1.3) return "worsening";
  return "flat";
}

function topReason(signals: Signal[]): string {
  const ordered = [...signals].sort((a, b) => {
    const order = { risk: 0, watch: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });
  return ordered[0]?.title ?? "No signals — operating normally";
}

export function computeSnapshots(
  projects: Project[],
  events: NormalizedEvent[],
  signals: Signal[]
): ProjectSnapshot[] {
  const now = new Date().toISOString();
  return projects.map((p) => {
    const projEvents = events.filter((e) => e.projectId === p.id);
    const projSignals = signals.filter((s) => s.projectId === p.id);

    const openPRs = new Set(
      projEvents.filter((e) => e.type === "pr_opened" && e.payload.state !== "closed").map((e) => e.refs.prNumber)
    ).size;

    const reviewBacklog = projSignals.filter((s) => s.title.toLowerCase().includes("review")).length || Math.max(0, openPRs - 2);

    const staleTickets = projSignals.filter((s) => s.title.toLowerCase().includes("stale")).length;
    const activeIncidents = projEvents.filter(
      (e) => e.source === "slack" && e.type === "incident_thread"
    ).length;

    return {
      projectId: p.id,
      generatedAt: now,
      healthState: pickHealth(projSignals),
      trend: pickTrend(projEvents),
      topReason: topReason(projSignals),
      openPRs,
      staleTickets,
      activeIncidents,
      reviewBacklog,
    };
  });
}

export function computeTeamLoad(events: NormalizedEvent[]): TeamLoadSnapshot {
  const byActor = new Map<string, { threads: Set<string>; reviews: number; incidents: number }>();

  for (const e of events) {
    const key = e.actor;
    if (!byActor.has(key)) byActor.set(key, { threads: new Set(), reviews: 0, incidents: 0 });
    const slot = byActor.get(key)!;

    const threadKey =
      e.refs.ticketKey ?? (e.refs.prNumber !== undefined ? `pr_${e.refs.prNumber}` : e.refs.threadTs ?? e.id);
    slot.threads.add(threadKey);

    if (e.type === "pr_review") slot.reviews++;
    if (e.type === "incident_thread") slot.incidents++;
  }

  const members = [...byActor.entries()]
    .filter(([name]) => name && name !== "unknown" && name !== "system")
    .map(([name, slot]) => ({
      id: name,
      name: prettifyName(name),
      initials: initials(name),
      activeThreads: slot.threads.size,
      reviewsPending: slot.reviews,
      incidentsTouched: slot.incidents,
    }))
    .sort((a, b) => b.activeThreads + b.reviewsPending - (a.activeThreads + a.reviewsPending))
    .slice(0, 8);

  const total = members.reduce((s, m) => s + m.activeThreads, 0);
  const avg = members.length ? +(total / members.length).toFixed(1) : 0;
  const reviewBacklog = members.reduce((s, m) => s + m.reviewsPending, 0);

  let state: TeamLoadSnapshot["state"] = "balanced";
  const heavy = members.filter((m) => m.activeThreads + m.reviewsPending >= 7).length;
  if (heavy >= 2) state = "overloaded";
  else if (heavy >= 1 || avg > 3) state = "stretched";

  return { state, members, averageThreads: avg, reviewBacklog };
}

export function computeThreads(events: NormalizedEvent[]): WorkThread[] {
  const byTicket = new Map<string, ThreadEvent[]>();
  const ticketProject = new Map<string, string>();
  const ticketTitle = new Map<string, string>();

  for (const e of events) {
    const key = e.refs.ticketKey;
    if (!key) continue;
    if (!byTicket.has(key)) byTicket.set(key, []);
    ticketProject.set(key, e.projectId);
    if (e.payload.title && !ticketTitle.has(key)) {
      ticketTitle.set(key, String(e.payload.title));
    }
    byTicket.get(key)!.push({
      id: e.id,
      source: e.source,
      type: e.type,
      title: deriveTitle(e),
      actor: e.actor,
      timestamp: e.timestamp,
    });
  }

  return [...byTicket.entries()].map(([key, evs]) => ({
    id: `t_${key.toLowerCase().replace(/-/g, "_")}`,
    projectId: ticketProject.get(key)!,
    title: `${ticketTitle.get(key) ?? "Untitled"} — ${key}`,
    status: "in_progress" as const,
    events: evs.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)),
  }));
}

function deriveTitle(e: NormalizedEvent): string {
  if (e.type === "ticket_created") return `${e.refs.ticketKey} created`;
  if (e.type === "status_change") return `Status → ${e.payload.status ?? "?"}`;
  if (e.type === "pr_opened") return `PR #${e.refs.prNumber} opened — ${e.payload.title ?? ""}`;
  if (e.type === "pr_review") return `Review submitted (${e.payload.state ?? "?"})`;
  if (e.type === "pr_reopened") return `PR #${e.refs.prNumber} reopened`;
  if (e.type === "incident_thread") return `Incident discussion: ${e.payload.title ?? ""}`;
  return e.type;
}

function initials(name: string): string {
  const parts = name.split(/[\s_.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function prettifyName(name: string): string {
  return name
    .split(/[\s_.]+/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}
