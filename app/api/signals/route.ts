import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ensureBootstrapped } from "@/lib/ingestion";
import { activeSignals, annotateSignals } from "@/lib/acknowledgements";

export async function GET(req: NextRequest) {
  await ensureBootstrapped();

  const severity = req.nextUrl.searchParams.get("severity");
  // Acknowledged signals are hidden by default; ?acknowledged=include keeps them
  // in the list, flagged, so the UI can offer a "show muted" view.
  const includeAcknowledged = req.nextUrl.searchParams.get("acknowledged") === "include";

  const acks = repo.acknowledgements.all();
  const all = repo.signals.all();

  let signals = includeAcknowledged ? annotateSignals(all, acks) : activeSignals(all, acks);
  if (severity && severity !== "all") {
    signals = signals.filter((s) => s.severity === severity);
  }

  return NextResponse.json({ signals });
}
