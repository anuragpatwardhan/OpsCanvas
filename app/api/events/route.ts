import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ensureBootstrapped } from "@/lib/ingestion";

export async function GET(req: NextRequest) {
  await ensureBootstrapped();
  const projectId = req.nextUrl.searchParams.get("project");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "100");

  let events = projectId ? repo.events.forProject(projectId) : repo.events.all();
  events = [...events].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, limit);

  return NextResponse.json({ events });
}
