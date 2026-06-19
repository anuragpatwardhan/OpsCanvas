import { NextResponse } from "next/server";
import { runIngestionCycle } from "@/lib/ingestion";

export async function POST() {
  try {
    const result = await runIngestionCycle();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
