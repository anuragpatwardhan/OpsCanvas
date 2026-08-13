import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Acknowledgement, Signal } from "@/lib/types";

/**
 * The route handlers talk to the file-backed store and kick off ingestion.
 * Both are stubbed so these tests exercise request handling — validation,
 * status codes, persistence calls — without touching the datastore on disk.
 */
let signals: Signal[] = [];
let acknowledgements: Acknowledgement[] = [];
const persist = vi.fn();

vi.mock("@/lib/ingestion", () => ({ ensureBootstrapped: async () => {} }));

vi.mock("@/lib/store", () => ({
  persist: () => persist(),
  repo: {
    signals: { all: () => signals },
    acknowledgements: {
      all: () => acknowledgements,
      upsert: (ack: Acknowledgement) => {
        acknowledgements = [...acknowledgements.filter((a) => a.signalId !== ack.signalId), ack];
      },
      remove: (signalId: string) => {
        const before = acknowledgements.length;
        acknowledgements = acknowledgements.filter((a) => a.signalId !== signalId);
        return acknowledgements.length < before;
      },
    },
  },
}));

const { POST, DELETE } = await import("../[id]/ack/route");

const signal = (id: string): Signal => ({
  id,
  projectId: "p_test",
  severity: "risk",
  title: `Signal ${id}`,
  reason: "because",
  evidence: [],
  links: [],
  createdAt: new Date().toISOString(),
});

const post = (id: string, body?: unknown) =>
  POST(
    new NextRequest(`http://localhost/api/signals/${id}/ack`, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: { id } }
  );

const del = (id: string) =>
  DELETE(new NextRequest(`http://localhost/api/signals/${id}/ack`, { method: "DELETE" }), {
    params: { id },
  });

beforeEach(() => {
  signals = [signal("sig_review_1"), signal("sig_stale_2")];
  acknowledgements = [];
  persist.mockClear();
});

describe("POST /api/signals/[id]/ack", () => {
  it("acknowledges a known signal indefinitely when given no body", async () => {
    const response = await post("sig_review_1");
    expect(response.status).toBe(200);

    const { acknowledgement } = await response.json();
    expect(acknowledgement.signalId).toBe("sig_review_1");
    expect(acknowledgement.until).toBeNull();
  });

  it("turns a duration into an expiry in the future", async () => {
    const response = await post("sig_review_1", { hours: 4 });
    const { acknowledgement } = await response.json();
    expect(new Date(acknowledgement.until).getTime()).toBeGreaterThan(Date.now());
  });

  it("stores a note", async () => {
    const response = await post("sig_review_1", { hours: 2, note: "waiting on the vendor" });
    const { acknowledgement } = await response.json();
    expect(acknowledgement.note).toBe("waiting on the vendor");
  });

  it("writes the change to disk", async () => {
    await post("sig_review_1");
    expect(persist).toHaveBeenCalledOnce();
  });

  it("replaces an existing acknowledgement rather than stacking", async () => {
    await post("sig_review_1", { hours: 1 });
    await post("sig_review_1", { hours: 8 });
    expect(acknowledgements.filter((a) => a.signalId === "sig_review_1")).toHaveLength(1);
  });

  it("404s for a signal that is not firing", async () => {
    const response = await post("sig_unknown");
    expect(response.status).toBe(404);
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/signals/sig_review_1/ack", {
        method: "POST",
        body: "{not json",
      }),
      { params: { id: "sig_review_1" } }
    );
    expect(response.status).toBe(400);
  });

  it.each([
    ["zero", 0],
    ["negative", -5],
    ["a string", "soon"],
    ["a boolean", true],
  ])("rejects %s as a duration", async (_label, value) => {
    const response = await post("sig_review_1", { hours: value });
    expect(response.status).toBe(400);
    expect(persist).not.toHaveBeenCalled();
  });

  it("treats an explicit null duration as indefinite", async () => {
    // JSON cannot carry Infinity or NaN — both serialise to null — so null is
    // the only non-numeric value the handler can actually receive here, and it
    // means "no expiry" rather than being an error.
    const response = await post("sig_review_1", { hours: null });
    expect(response.status).toBe(200);
    expect((await response.json()).acknowledgement.until).toBeNull();
  });

  it("rejects a snooze longer than the cap", async () => {
    // An unbounded snooze would let a real problem disappear for years.
    const response = await post("sig_review_1", { hours: 24 * 365 });
    expect(response.status).toBe(400);
  });

  it("accepts a snooze exactly at the cap", async () => {
    expect((await post("sig_review_1", { hours: 24 * 30 })).status).toBe(200);
  });
});

describe("DELETE /api/signals/[id]/ack", () => {
  it("removes an existing acknowledgement", async () => {
    await post("sig_review_1", { hours: 4 });
    persist.mockClear();

    const response = await del("sig_review_1");

    expect(response.status).toBe(200);
    expect(acknowledgements).toHaveLength(0);
    expect(persist).toHaveBeenCalledOnce();
  });

  it("404s when the signal was never acknowledged", async () => {
    const response = await del("sig_review_1");
    expect(response.status).toBe(404);
    expect(persist).not.toHaveBeenCalled();
  });

  it("leaves other acknowledgements alone", async () => {
    await post("sig_review_1");
    await post("sig_stale_2");

    await del("sig_review_1");

    expect(acknowledgements.map((a) => a.signalId)).toEqual(["sig_stale_2"]);
  });
});
