import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ensureBootstrapped } from "@/lib/ingestion";

export async function GET() {
  await ensureBootstrapped();
  return NextResponse.json({
    projects: repo.projects.all(),
    snapshots: repo.snapshots.all(),
  });
}
