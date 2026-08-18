import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedEvent, Project } from "../types";

/**
 * Slack is the noisiest source: a channel is mostly ordinary conversation and
 * only occasionally an incident. These tests are mainly about what the
 * connector refuses to emit, since a false incident inflates the project's
 * active-incident count and drags its health to risk.
 *
 * Credentials are read into a module-level constant at import time, so each
 * case re-imports with the environment already set.
 */

const project: Project = {
  id: "p_checkout",
  name: "Checkout Platform",
  jiraKey: "CHK",
  githubRepo: "acme/checkout",
  slackChannel: "#checkout-eng",
  owner: "alice",
};

const CREDENTIALS = ["SLACK_BOT_TOKEN", "GITHUB_TOKEN", "JIRA_HOST", "JIRA_EMAIL", "JIRA_API_TOKEN"];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(CREDENTIALS.map((k) => [k, process.env[k]]));
  for (const key of CREDENTIALS) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const message = (overrides: Record<string, unknown> = {}) => ({
  ts: "1700000000.000100",
  user: "alice",
  text: "Checkout is down for EU customers",
  thread_ts: "1700000000.000100",
  reply_count: 4,
  ...overrides,
});

/** Load the connector with a stubbed Slack API and a token in place. */
async function loadSlack(response: unknown, ok = true) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => response,
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  process.env.SLACK_BOT_TOKEN = "xoxb-test";
  const { connectors } = await import("../connectors");
  return { connector: connectors.find((c) => c.name === "slack")!, fetchMock };
}

const fetchEvents = async (response: unknown, projects = [project]) => {
  const { connector } = await loadSlack(response);
  return (await connector.fetchEvents(projects)) as NormalizedEvent[];
};

describe("slackConnector", () => {
  it("returns nothing without a token", async () => {
    vi.resetModules();
    const { connectors } = await import("../connectors");
    const slack = connectors.find((c) => c.name === "slack")!;
    expect(await slack.fetchEvents([project])).toEqual([]);
  });

  it("normalises an incident thread", async () => {
    const events = await fetchEvents({ ok: true, messages: [message()] });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: "slack",
      type: "incident_thread",
      projectId: "p_checkout",
      actor: "alice",
      refs: { threadTs: "1700000000.000100" },
    });
  });

  it("converts the Slack epoch timestamp to ISO", async () => {
    const events = await fetchEvents({ ok: true, messages: [message({ ts: "1700000000.000100" })] });
    expect(events[0].timestamp).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("carries the channel and reply count through", async () => {
    const events = await fetchEvents({ ok: true, messages: [message({ reply_count: 12 })] });
    expect(events[0].payload).toMatchObject({ channel: "#checkout-eng", replies: 12 });
  });

  it("defaults the reply count when Slack omits it", async () => {
    const events = await fetchEvents({ ok: true, messages: [message({ reply_count: undefined })] });
    expect(events[0].payload.replies).toBe(0);
  });

  it("falls back to unknown rather than inventing an author", async () => {
    // Bot and webhook messages arrive with no user field.
    const events = await fetchEvents({ ok: true, messages: [message({ user: undefined })] });
    expect(events[0].actor).toBe("unknown");
  });

  it("truncates a long message into the title", async () => {
    const events = await fetchEvents({ ok: true, messages: [message({ text: "outage " + "x".repeat(500) })] });
    expect((events[0].payload.title as string).length).toBe(120);
  });

  describe("what it refuses to treat as an incident", () => {
    it("ignores a message that is not threaded", async () => {
      // A one-off remark about an outage is chatter, not an incident being worked.
      const events = await fetchEvents({ ok: true, messages: [message({ thread_ts: undefined })] });
      expect(events).toEqual([]);
    });

    it("ignores a thread whose text has no incident language", async () => {
      const events = await fetchEvents({ ok: true, messages: [message({ text: "lunch plans?" })] });
      expect(events).toEqual([]);
    });

    it.each(["incident", "outage", "down", "P0", "p1", "SEV2"])(
      "recognises %s as incident language",
      async (word) => {
        const events = await fetchEvents({ ok: true, messages: [message({ text: `we have a ${word} here` })] });
        expect(events).toHaveLength(1);
      }
    );

    it("matches incident words case-insensitively", async () => {
      const events = await fetchEvents({ ok: true, messages: [message({ text: "OUTAGE in checkout" })] });
      expect(events).toHaveLength(1);
    });

    it("skips a project with no channel configured", async () => {
      const { connector, fetchMock } = await loadSlack({ ok: true, messages: [message()] });
      const events = await connector.fetchEvents([{ ...project, slackChannel: "" }]);
      expect(events).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("failure handling", () => {
    it("skips a channel Slack reports an error for", async () => {
      // ok:false is Slack's application-level error; HTTP is still 200.
      const events = await fetchEvents({ ok: false, error: "channel_not_found", messages: [] });
      expect(events).toEqual([]);
    });

    it("keeps going when one channel throws", async () => {
      const { connector } = await loadSlack({ ok: true, messages: [message()] }, false);
      // HTTP failure raises inside the connector; it must be caught per project.
      expect(await connector.fetchEvents([project])).toEqual([]);
    });

    it("one failing project does not cost another its events", async () => {
      const second: Project = { ...project, id: "p_other", slackChannel: "#other" };
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, _init?: RequestInit) => {
          call += 1;
          if (call === 1) return { ok: false, status: 500, json: async () => ({}) };
          return { ok: true, status: 200, json: async () => ({ ok: true, messages: [message()] }) };
        })
      );
      vi.resetModules();
      process.env.SLACK_BOT_TOKEN = "xoxb-test";
      const { connectors } = await import("../connectors");
      const slack = connectors.find((c) => c.name === "slack")!;

      const events = await slack.fetchEvents([project, second]);

      expect(events).toHaveLength(1);
      expect(events[0].projectId).toBe("p_other");
    });
  });

  describe("the request itself", () => {
    it("strips the leading hash from the channel name", async () => {
      const { connector, fetchMock } = await loadSlack({ ok: true, messages: [] });
      await connector.fetchEvents([project]);
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain("channel=checkout-eng");
      expect(url).not.toContain("%23");
    });

    it("sends the bot token", async () => {
      const { connector, fetchMock } = await loadSlack({ ok: true, messages: [] });
      await connector.fetchEvents([project]);
      const [, init] = fetchMock.mock.calls[0];
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer xoxb-test");
    });

    it("asks only for the last seven days", async () => {
      const { connector, fetchMock } = await loadSlack({ ok: true, messages: [] });
      await connector.fetchEvents([project]);
      const url = new URL(String(fetchMock.mock.calls[0][0]));
      const oldest = Number(url.searchParams.get("oldest"));
      const expected = Math.floor((Date.now() - 7 * 86_400_000) / 1000);
      expect(Math.abs(oldest - expected)).toBeLessThan(5);
    });
  });

  it("gives every event a distinct id", async () => {
    // Ids collide in appendMany, which silently drops one of the events.
    const events = await fetchEvents({
      ok: true,
      messages: [message(), message({ ts: "1700000111.000200" })],
    });
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });
});
