import type { NormalizedEvent, Signal, Severity } from "./types";

interface Rule {
  id: string;
  evaluate: (events: NormalizedEvent[]) => Signal[];
}

const HOURS = (n: number) => n * 3_600_000;
const DAYS = (n: number) => n * 86_400_000;

function severity(daysOld: number): Severity {
  if (daysOld >= 4) return "risk";
  if (daysOld >= 2) return "watch";
  return "info";
}

const reviewBacklogRule: Rule = {
  id: "review_backlog",
  evaluate(events) {
    const now = Date.now();
    const prsOpened = new Map<string, NormalizedEvent>();
    const reviewsByPr = new Map<string, NormalizedEvent[]>();

    for (const e of events) {
      if (e.source !== "github") continue;
      const key = `${e.projectId}:${e.refs.prNumber}`;
      if (e.type === "pr_opened") prsOpened.set(key, e);
      if (e.type === "pr_review") {
        const arr = reviewsByPr.get(key) ?? [];
        arr.push(e);
        reviewsByPr.set(key, arr);
      }
    }

    const out: Signal[] = [];
    for (const [key, pr] of prsOpened) {
      const ageMs = now - new Date(pr.timestamp).getTime();
      const reviews = reviewsByPr.get(key) ?? [];
      if (ageMs > DAYS(2) && reviews.length === 0) {
        const days = Math.floor(ageMs / DAYS(1));
        out.push({
          id: `sig_review_${key}`,
          projectId: pr.projectId,
          severity: severity(days),
          title: `PR waiting on review for ${days} days`,
          reason: "No reviewer activity since opened.",
          evidence: [
            `PR #${pr.refs.prNumber} opened ${days}d ago by @${pr.actor}`,
            "0 review events recorded",
          ],
          links: [],
          createdAt: new Date().toISOString(),
          suggestedAction: "Assign a reviewer or move to draft.",
        });
      }
    }
    return out;
  },
};

const churnRiskRule: Rule = {
  id: "churn_risk",
  evaluate(events) {
    const reopens = new Map<string, number>();
    for (const e of events) {
      if (e.source === "github" && e.type === "pr_reopened") {
        const key = `${e.projectId}:${e.refs.prNumber}`;
        reopens.set(key, (reopens.get(key) ?? 0) + 1);
      }
    }
    const out: Signal[] = [];
    for (const [key, count] of reopens) {
      if (count >= 2) {
        const [projectId, prNumber] = key.split(":");
        out.push({
          id: `sig_churn_${key}`,
          projectId,
          severity: count >= 3 ? "risk" : "watch",
          title: `PR reopened ${count} times — churn risk`,
          reason: "Repeated reopens often indicate unclear requirements.",
          evidence: [`PR #${prNumber} reopened ${count} times`],
          links: [],
          createdAt: new Date().toISOString(),
          suggestedAction: "Pair on scope review before next push.",
        });
      }
    }
    return out;
  },
};

const staleTicketRule: Rule = {
  id: "stale_ticket",
  evaluate(events) {
    const now = Date.now();
    const lastSeen = new Map<string, NormalizedEvent>();
    for (const e of events) {
      if (e.source !== "jira" || !e.refs.ticketKey) continue;
      const prev = lastSeen.get(e.refs.ticketKey);
      if (!prev || new Date(e.timestamp) > new Date(prev.timestamp)) {
        lastSeen.set(e.refs.ticketKey, e);
      }
    }
    const out: Signal[] = [];
    for (const [key, e] of lastSeen) {
      const ageMs = now - new Date(e.timestamp).getTime();
      const status = (e.payload.status as string) ?? "";
      if (status === "In Progress" && ageMs > DAYS(5)) {
        const days = Math.floor(ageMs / DAYS(1));
        out.push({
          id: `sig_stale_${key}`,
          projectId: e.projectId,
          severity: severity(days - 3),
          title: `Ticket stale > ${days} days`,
          reason: "Ticket in 'In Progress' with no recent updates.",
          evidence: [`${key} last updated ${days}d ago`],
          links: [],
          createdAt: new Date().toISOString(),
          suggestedAction: "Reassign or move back to backlog.",
        });
      }
    }
    return out;
  },
};

const blockedRule: Rule = {
  id: "blocked",
  evaluate(events) {
    const now = Date.now();
    const blockedSince = new Map<string, NormalizedEvent>();
    for (const e of events) {
      if (e.source !== "jira" || e.type !== "status_change") continue;
      const status = (e.payload.status as string) ?? "";
      if (status === "Blocked" && e.refs.ticketKey) {
        const prev = blockedSince.get(e.refs.ticketKey);
        if (!prev || new Date(e.timestamp) < new Date(prev.timestamp)) {
          blockedSince.set(e.refs.ticketKey, e);
        }
      }
    }
    const out: Signal[] = [];
    for (const [key, e] of blockedSince) {
      const days = Math.floor((now - new Date(e.timestamp).getTime()) / DAYS(1));
      if (days >= 3) {
        out.push({
          id: `sig_blocked_${key}`,
          projectId: e.projectId,
          severity: days >= 5 ? "risk" : "watch",
          title: `Ticket blocked for ${days} days`,
          reason: "Status unchanged from 'Blocked'.",
          evidence: [`${key} blocked since ${days}d ago`],
          links: [],
          createdAt: new Date().toISOString(),
          suggestedAction: "Escalate or reroute.",
        });
      }
    }
    return out;
  },
};

const incidentFollowupGapRule: Rule = {
  id: "incident_followup_gap",
  evaluate(events) {
    const incidentThreads = events.filter(
      (e) => e.source === "slack" && e.type === "incident_thread"
    );
    const linkedTickets = new Set(
      events
        .filter((e) => e.source === "jira" && e.type === "ticket_created")
        .map((e) => (e.payload.linkedSlackThread as string) ?? "")
        .filter(Boolean)
    );

    const out: Signal[] = [];
    for (const inc of incidentThreads) {
      const ageMs = Date.now() - new Date(inc.timestamp).getTime();
      const threadId = (inc.refs.threadTs as string) ?? inc.id;
      if (ageMs > HOURS(3) && !linkedTickets.has(threadId)) {
        out.push({
          id: `sig_inc_${inc.id}`,
          projectId: inc.projectId,
          severity: "risk",
          title: "Active incident without follow-up ticket",
          reason: "Incident thread active in Slack with no linked Jira ticket.",
          evidence: [`Thread started ${Math.floor(ageMs / HOURS(1))}h ago`, "No ticket linked"],
          links: [],
          createdAt: new Date().toISOString(),
          suggestedAction: "Create a follow-up ticket and link it.",
        });
      }
    }
    return out;
  },
};

export const rules: Rule[] = [
  reviewBacklogRule,
  churnRiskRule,
  staleTicketRule,
  blockedRule,
  incidentFollowupGapRule,
];

export function evaluateSignals(events: NormalizedEvent[]): Signal[] {
  return rules.flatMap((r) => r.evaluate(events));
}
