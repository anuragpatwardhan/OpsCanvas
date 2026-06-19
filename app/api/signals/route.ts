import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ensureBootstrapped } from "@/lib/ingestion";

export async function GET(req: NextRequest) {
  await ensureBootstrapped();
  const sev = req.nextUrl.searchParams.get("severity");
  let signals = repo.signals.all();
  if (sev && sev !== "all") signals = signals.filter((s) => s.severity === sev);
  signals = [...signals].sort((a, b) => {
    const order = { risk: 0, watch: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });
  return NextResponse.json({ signals });
}
