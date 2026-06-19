import { NextResponse } from "next/server";
import { connectorStatuses } from "@/lib/connectors";
import { repo } from "@/lib/store";
import { ensureBootstrapped } from "@/lib/ingestion";

export async function GET() {
  await ensureBootstrapped();
  return NextResponse.json({
    connectors: connectorStatuses(),
    lastSyncAt: repo.meta.lastSyncAt(),
    counts: {
      projects: repo.projects.all().length,
      events: repo.events.all().length,
      signals: repo.signals.all().length,
      threads: repo.threads.all().length,
    },
  });
}
