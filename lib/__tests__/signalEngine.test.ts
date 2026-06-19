import { describe, it, expect } from "vitest";
import { evaluateSignals } from "../signalEngine";
import type { NormalizedEvent } from "../types";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

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

describe("signalEngine", () => {
  it("fires review_backlog when PR is open > 2d with zero reviews", () => {
    const events = [baseEvent({ type: "pr_opened", refs: { prNumber: 1 }, timestamp: daysAgo(4) })];
    const sigs = evaluateSignals(events);
    expect(sigs.find((s) => s.title.includes("waiting on review"))).toBeDefined();
  });

  it("does NOT fire review_backlog when reviews exist", () => {
    const events = [
      baseEvent({ type: "pr_opened", refs: { prNumber: 2 }, timestamp: daysAgo(4) }),
      baseEvent({ type: "pr_review", refs: { prNumber: 2 }, timestamp: daysAgo(3) }),
    ];
    const sigs = evaluateSignals(events);
    expect(sigs.find((s) => s.title.includes("waiting on review"))).toBeUndefined();
  });

  it("fires churn_risk when PR reopened >= 2 times", () => {
    const events = [
      baseEvent({ type: "pr_reopened", refs: { prNumber: 3 }, timestamp: daysAgo(3) }),
      baseEvent({ type: "pr_reopened", refs: { prNumber: 3 }, timestamp: daysAgo(2) }),
      baseEvent({ type: "pr_reopened", refs: { prNumber: 3 }, timestamp: daysAgo(1) }),
    ];
    const sigs = evaluateSignals(events);
    const churn = sigs.find((s) => s.title.includes("reopened"));
    expect(churn).toBeDefined();
    expect(churn?.severity).toBe("risk");
  });

  it("escalates churn_risk severity: 2 reopens=watch, 3+=risk", () => {
    const two = evaluateSignals([
      baseEvent({ type: "pr_reopened", refs: { prNumber: 10 }, timestamp: daysAgo(2) }),
      baseEvent({ type: "pr_reopened", refs: { prNumber: 10 }, timestamp: daysAgo(1) }),
    ]);
    expect(two.find((s) => s.title.includes("reopened"))?.severity).toBe("watch");

    const three = evaluateSignals([
      baseEvent({ type: "pr_reopened", refs: { prNumber: 11 }, timestamp: daysAgo(3) }),
      baseEvent({ type: "pr_reopened", refs: { prNumber: 11 }, timestamp: daysAgo(2) }),
      baseEvent({ type: "pr_reopened", refs: { prNumber: 11 }, timestamp: daysAgo(1) }),
    ]);
    expect(three.find((s) => s.title.includes("reopened"))?.severity).toBe("risk");
  });

  it("fires stale_ticket when In Progress unchanged > 5d", () => {
    const events = [
      baseEvent({
        source: "jira",
        type: "status_change",
        refs: { ticketKey: "TEST-1" },
        timestamp: daysAgo(7),
        payload: { status: "In Progress" },
      }),
    ];
    const sigs = evaluateSignals(events);
    expect(sigs.find((s) => s.title.includes("stale"))).toBeDefined();
  });

  it("fires blocked rule when status=Blocked > 3d", () => {
    const events = [
      baseEvent({
        source: "jira",
        type: "status_change",
        refs: { ticketKey: "TEST-2" },
        timestamp: daysAgo(5),
        payload: { status: "Blocked" },
      }),
    ];
    const sigs = evaluateSignals(events);
    expect(sigs.find((s) => s.title.includes("blocked"))).toBeDefined();
  });

  it("fires incident_followup_gap when Slack incident has no linked ticket", () => {
    const events = [
      baseEvent({
        source: "slack",
        type: "incident_thread",
        refs: { threadTs: "abc.123" },
        timestamp: hoursAgo(5),
      }),
    ];
    const sigs = evaluateSignals(events);
    expect(sigs.find((s) => s.title.includes("incident"))).toBeDefined();
  });

  it("does NOT fire incident_followup_gap when a ticket is linked", () => {
    const events = [
      baseEvent({
        source: "slack",
        type: "incident_thread",
        refs: { threadTs: "abc.456" },
        timestamp: hoursAgo(5),
      }),
      baseEvent({
        source: "jira",
        type: "ticket_created",
        refs: { ticketKey: "TEST-3" },
        timestamp: hoursAgo(4),
        payload: { linkedSlackThread: "abc.456" },
      }),
    ];
    const sigs = evaluateSignals(events);
    expect(sigs.find((s) => s.title.includes("incident"))).toBeUndefined();
  });

  it("returns empty when there are no events", () => {
    expect(evaluateSignals([])).toEqual([]);
  });
});
