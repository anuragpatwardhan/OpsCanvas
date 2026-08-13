import type { Acknowledgement, Signal } from "./types";

/**
 * Signals are recomputed from scratch on every ingestion cycle, so an
 * acknowledgement cannot live on the signal itself. It is stored separately and
 * keyed by signal id, which the rules derive from the underlying entity
 * (`sig_review_<pr>`, `sig_stale_<ticket>`) rather than generating fresh each
 * run. That stability is what lets a snooze survive a resync.
 */

export function isActive(ack: Acknowledgement, now: number = Date.now()): boolean {
  // A null expiry means acknowledged indefinitely — the concern is understood
  // and should stay quiet until the underlying condition clears.
  if (ack.until === null) return true;
  return new Date(ack.until).getTime() > now;
}

export function activeAcknowledgements(
  acks: Acknowledgement[],
  now: number = Date.now()
): Map<string, Acknowledgement> {
  const active = new Map<string, Acknowledgement>();
  for (const ack of acks) {
    if (isActive(ack, now)) active.set(ack.signalId, ack);
  }
  return active;
}

const SEVERITY_ORDER = { risk: 0, watch: 1, info: 2 } as const;

const bySeverity = (a: Signal, b: Signal) =>
  SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];

/**
 * Annotate signals with their acknowledgement rather than dropping them, so a
 * caller can still show a muted list. Signals whose snooze has expired come
 * back automatically with no cleanup pass.
 */
export function annotateSignals(
  signals: Signal[],
  acks: Acknowledgement[],
  now: number = Date.now()
): Signal[] {
  const active = activeAcknowledgements(acks, now);
  return signals
    .map((signal) => {
      const ack = active.get(signal.id);
      return ack ? { ...signal, acknowledged: true, acknowledgedUntil: ack.until } : signal;
    })
    .sort(bySeverity);
}

/** The signals still demanding attention, most severe first. */
export function activeSignals(
  signals: Signal[],
  acks: Acknowledgement[],
  now: number = Date.now()
): Signal[] {
  const suppressed = activeAcknowledgements(acks, now);
  return signals.filter((signal) => !suppressed.has(signal.id)).sort(bySeverity);
}

/**
 * Drop acknowledgements that can no longer matter: expired ones, and any whose
 * signal has stopped firing. Without this the store would grow without bound as
 * PRs and tickets come and go.
 */
export function pruneAcknowledgements(
  acks: Acknowledgement[],
  liveSignalIds: Set<string>,
  now: number = Date.now()
): Acknowledgement[] {
  return acks.filter((ack) => isActive(ack, now) && liveSignalIds.has(ack.signalId));
}

/** Build an acknowledgement, translating a duration into an absolute expiry. */
export function createAcknowledgement(
  signalId: string,
  options: { hours?: number | null; note?: string; actor?: string } = {},
  now: number = Date.now()
): Acknowledgement {
  const { hours = null, note, actor } = options;
  return {
    signalId,
    // Absolute rather than relative, so the expiry survives a restart and does
    // not silently extend every time the file is reloaded.
    until: hours === null ? null : new Date(now + hours * 3_600_000).toISOString(),
    note: note?.trim() || undefined,
    actor: actor || "you",
    createdAt: new Date(now).toISOString(),
  };
}
