import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ensureBootstrapped } from "@/lib/ingestion";
import { activeSignals } from "@/lib/acknowledgements";

export async function GET() {
  await ensureBootstrapped();
  const all = repo.signals.all();
  // Acknowledged signals are suppressed here: the dashboard is the "what needs
  // attention now" view, and a snoozed concern is by definition not that.
  const signals = activeSignals(all, repo.acknowledgements.all());

  return NextResponse.json({
    projects: repo.projects.all(),
    snapshots: repo.snapshots.all(),
    signals,
    acknowledgedCount: all.length - signals.length,
    teamLoad: repo.teamLoad.get(),
    lastSyncAt: repo.meta.lastSyncAt(),
  });
}
