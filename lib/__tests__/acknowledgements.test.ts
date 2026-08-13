import { describe, it, expect } from "vitest";
import {
  activeAcknowledgements,
  activeSignals,
  annotateSignals,
  createAcknowledgement,
  isActive,
  pruneAcknowledgements,
} from "../acknowledgements";
import type { Acknowledgement, Severity, Signal } from "../types";

const NOW = Date.parse("2026-08-12T12:00:00Z");
const hours = (n: number) => new Date(NOW + n * 3_600_000).toISOString();

const signal = (id: string, severity: Severity = "risk"): Signal => ({
  id,
  projectId: "p_test",
  severity,
  title: `Signal ${id}`,
  reason: "because",
  evidence: [],
  links: [],
  createdAt: new Date(NOW).toISOString(),
});

const ack = (signalId: string, until: string | null): Acknowledgement => ({
  signalId,
  until,
  actor: "you",
  createdAt: new Date(NOW).toISOString(),
});

describe("isActive", () => {
  it("treats a null expiry as indefinite", () => {
    expect(isActive(ack("s1", null), NOW)).toBe(true);
  });

  it("is active while the expiry is in the future", () => {
    expect(isActive(ack("s1", hours(1)), NOW)).toBe(true);
  });

  it("has lapsed once the expiry passes", () => {
    expect(isActive(ack("s1", hours(-1)), NOW)).toBe(false);
  });

  it("has lapsed exactly at the expiry", () => {
    expect(isActive(ack("s1", hours(0)), NOW)).toBe(false);
  });
});

describe("activeAcknowledgements", () => {
  it("keys the live ones by signal id", () => {
    const live = activeAcknowledgements([ack("s1", null), ack("s2", hours(-1))], NOW);
    expect([...live.keys()]).toEqual(["s1"]);
  });

  it("is empty when nothing is acknowledged", () => {
    expect(activeAcknowledgements([], NOW).size).toBe(0);
  });
});

describe("activeSignals", () => {
  it("returns everything when nothing is acknowledged", () => {
    const signals = [signal("s1"), signal("s2")];
    expect(activeSignals(signals, [], NOW)).toHaveLength(2);
  });

  it("hides an acknowledged signal", () => {
    const signals = [signal("s1"), signal("s2")];
    expect(activeSignals(signals, [ack("s1", null)], NOW).map((s) => s.id)).toEqual(["s2"]);
  });

  it("brings a signal back once its snooze lapses", () => {
    // The point of an absolute expiry: no cleanup job is needed for the signal
    // to reappear, it simply stops matching.
    const signals = [signal("s1")];
    const snooze = [ack("s1", hours(2))];
    expect(activeSignals(signals, snooze, NOW)).toHaveLength(0);
    expect(activeSignals(signals, snooze, NOW + 3 * 3_600_000)).toHaveLength(1);
  });

  it("ignores an acknowledgement for a signal that is not firing", () => {
    expect(activeSignals([signal("s1")], [ack("gone", null)], NOW)).toHaveLength(1);
  });

  it("orders the survivors most severe first", () => {
    const signals = [signal("s1", "info"), signal("s2", "risk"), signal("s3", "watch")];
    expect(activeSignals(signals, [], NOW).map((s) => s.severity)).toEqual([
      "risk",
      "watch",
      "info",
    ]);
  });

  it("does not modify the array it is given", () => {
    const signals = [signal("s1", "info"), signal("s2", "risk")];
    const order = signals.map((s) => s.id);
    activeSignals(signals, [], NOW);
    expect(signals.map((s) => s.id)).toEqual(order);
  });
});

describe("annotateSignals", () => {
  it("keeps acknowledged signals and flags them", () => {
    const result = annotateSignals([signal("s1"), signal("s2")], [ack("s1", hours(4))], NOW);
    expect(result).toHaveLength(2);
    const flagged = result.find((s) => s.id === "s1");
    expect(flagged?.acknowledged).toBe(true);
    expect(flagged?.acknowledgedUntil).toBe(hours(4));
  });

  it("leaves unacknowledged signals untouched", () => {
    const result = annotateSignals([signal("s1")], [], NOW);
    expect(result[0].acknowledged).toBeUndefined();
  });

  it("does not flag a lapsed acknowledgement", () => {
    const result = annotateSignals([signal("s1")], [ack("s1", hours(-1))], NOW);
    expect(result[0].acknowledged).toBeUndefined();
  });

  it("reports an indefinite acknowledgement with a null expiry", () => {
    const result = annotateSignals([signal("s1")], [ack("s1", null)], NOW);
    expect(result[0].acknowledgedUntil).toBeNull();
  });

  it("orders by severity like the active list does", () => {
    const signals = [signal("s1", "info"), signal("s2", "risk")];
    expect(annotateSignals(signals, [], NOW).map((s) => s.severity)).toEqual(["risk", "info"]);
  });
});

describe("pruneAcknowledgements", () => {
  const live = new Set(["s1", "s2"]);

  it("keeps a live acknowledgement for a firing signal", () => {
    expect(pruneAcknowledgements([ack("s1", null)], live, NOW)).toHaveLength(1);
  });

  it("drops one whose signal stopped firing", () => {
    // The PR merged or the ticket closed, so the snooze is meaningless now.
    expect(pruneAcknowledgements([ack("resolved", null)], live, NOW)).toEqual([]);
  });

  it("drops one that has expired", () => {
    expect(pruneAcknowledgements([ack("s1", hours(-1))], live, NOW)).toEqual([]);
  });

  it("keeps and drops independently across a mixed list", () => {
    const result = pruneAcknowledgements(
      [ack("s1", null), ack("s2", hours(-1)), ack("gone", null), ack("s2", hours(5))],
      live,
      NOW
    );
    expect(result.map((a) => a.signalId)).toEqual(["s1", "s2"]);
  });
});

describe("createAcknowledgement", () => {
  it("records an absolute expiry from a duration", () => {
    // Absolute, so reloading the file cannot silently extend the snooze.
    const created = createAcknowledgement("s1", { hours: 4 }, NOW);
    expect(created.until).toBe(hours(4));
  });

  it("acknowledges indefinitely when given no duration", () => {
    expect(createAcknowledgement("s1", {}, NOW).until).toBeNull();
  });

  it("keeps a note when one is supplied", () => {
    expect(createAcknowledgement("s1", { note: "known issue" }, NOW).note).toBe("known issue");
  });

  it("drops a blank note rather than storing whitespace", () => {
    expect(createAcknowledgement("s1", { note: "   " }, NOW).note).toBeUndefined();
  });

  it("defaults the actor", () => {
    expect(createAcknowledgement("s1", {}, NOW).actor).toBe("you");
  });

  it("stamps when it was created", () => {
    expect(createAcknowledgement("s1", {}, NOW).createdAt).toBe(new Date(NOW).toISOString());
  });

  it("produces something the suppression path accepts", () => {
    const created = createAcknowledgement("s1", { hours: 2 }, NOW);
    expect(activeSignals([signal("s1")], [created], NOW)).toHaveLength(0);
    expect(activeSignals([signal("s1")], [created], NOW + 3 * 3_600_000)).toHaveLength(1);
  });
});
