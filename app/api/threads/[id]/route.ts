import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ensureBootstrapped } from "@/lib/ingestion";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await ensureBootstrapped();
  const thread = repo.threads.byId(params.id);
  if (!thread) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const project = repo.projects.byId(thread.projectId);
  return NextResponse.json({ thread, project });
}
