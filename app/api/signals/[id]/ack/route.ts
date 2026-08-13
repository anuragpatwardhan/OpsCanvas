import { NextRequest, NextResponse } from "next/server";
import { repo, persist } from "@/lib/store";
import { ensureBootstrapped } from "@/lib/ingestion";
import { createAcknowledgement } from "@/lib/acknowledgements";

const MAX_SNOOZE_HOURS = 24 * 30;

interface AckBody {
  hours?: number | null;
  note?: string;
}

/** Acknowledge a signal, optionally for a fixed number of hours. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureBootstrapped();

  const signal = repo.signals.all().find((s) => s.id === params.id);
  if (!signal) {
    return NextResponse.json({ error: "Unknown signal" }, { status: 404 });
  }

  let body: AckBody = {};
  try {
    // An empty body is valid and means "acknowledge indefinitely".
    const text = await req.text();
    if (text) body = JSON.parse(text) as AckBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { hours = null, note } = body;
  if (hours !== null && hours !== undefined) {
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) {
      return NextResponse.json({ error: "hours must be a positive number" }, { status: 400 });
    }
    if (hours > MAX_SNOOZE_HOURS) {
      return NextResponse.json(
        { error: `hours must be at most ${MAX_SNOOZE_HOURS}` },
        { status: 400 }
      );
    }
  }

  const ack = createAcknowledgement(params.id, { hours: hours ?? null, note });
  repo.acknowledgements.upsert(ack);
  persist();

  return NextResponse.json({ acknowledgement: ack });
}

/** Un-acknowledge, bringing the signal back into the attention list. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureBootstrapped();

  const removed = repo.acknowledgements.remove(params.id);
  if (!removed) {
    return NextResponse.json({ error: "No acknowledgement for that signal" }, { status: 404 });
  }
  persist();

  return NextResponse.json({ ok: true });
}
