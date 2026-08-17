import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../types";

/**
 * The Jira connector had never been exercised — only GitHub was. Its
 * normalisation has its own rules (two events from one issue, a fallback actor,
 * an assignee that may not exist), and none of them were covered.
 *
 * As with the GitHub tests, credentials are read into module-level constants at
 * import time, so the module is re-imported with the environment already set.
 */

const project: Project = {
  id: "p_checkout",
  name: "Checkout Platform",
  jiraKey: "CHK",
  githubRepo: "acme/checkout",
  slackChannel: "#checkout-eng",
  owner: "alice",
};

const CREDENTIALS = ["JIRA_HOST", "JIRA_EMAIL", "JIRA_API_TOKEN"];
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

/** Overrides apply to `fields` only, merged over the defaults. */
const issue = (fields: Record<string, unknown> = {}) => ({
  id: "10001",
  key: "CHK-42",
  fields: {
    summary: "Discount codes fail at checkout",
    status: { name: "In Progress" },
    created: "2026-08-01T10:00:00.000+0000",
    updated: "2026-08-05T14:00:00.000+0000",
    assignee: { displayName: "Ada Lovelace" },
    reporter: { displayName: "Bob Stone" },
    ...fields,
  },
});

/** Load the connector with credentials present and fetch stubbed. */
async function loadJira(response: unknown, ok = true) {
  // Parameters are declared so the recorded call tuple is typed; without them
  // TypeScript treats every call as having no arguments.
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => response,
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  process.env.JIRA_HOST = "acme.atlassian.net";
  process.env.JIRA_EMAIL = "you@example.com";
  process.env.JIRA_API_TOKEN = "token";
  const { connectors } = await import("../connectors");
  return { connector: connectors.find((c) => c.name === "jira")!, fetchMock };
}

describe("jiraConnector.fetchEvents", () => {
  it("returns nothing when credentials are absent", async () => {
    vi.resetModules();
    const { connectors } = await import("../connectors");
    const jira = connectors.find((c) => c.name === "jira")!;
    expect(await jira.fetchEvents([project])).toEqual([]);
  });

  it("normalises an issue into a ticket_created event", async () => {
    const { connector } = await loadJira({ issues: [issue()] });
    const events = await connector.fetchEvents([project]);

    const created = events.find((e) => e.type === "ticket_created")!;
    expect(created).toMatchObject({
      source: "jira",
      projectId: "p_checkout",
      timestamp: "2026-08-01T10:00:00.000+0000",
      refs: { ticketKey: "CHK-42" },
    });
    expect(created.payload).toMatchObject({ status: "In Progress" });
  });

  it("credits the reporter for creation and the assignee for the update", async () => {
    // Two different people, and conflating them would misattribute team load.
    const { connector } = await loadJira({ issues: [issue()] });
    const events = await connector.fetchEvents([project]);

    expect(events.find((e) => e.type === "ticket_created")!.actor).toBe("Bob Stone");
    expect(events.find((e) => e.type === "status_change")!.actor).toBe("Ada Lovelace");
  });

  it("emits a status_change only when the issue has actually moved", async () => {
    const untouched = issue({
      created: "2026-08-01T10:00:00.000+0000",
      updated: "2026-08-01T10:00:00.000+0000",
    });
    const { connector } = await loadJira({ issues: [untouched] });
    const events = await connector.fetchEvents([project]);
    expect(events.map((e) => e.type)).toEqual(["ticket_created"]);
  });

  it("falls back to unknown when nobody is assigned", async () => {
    // An unassigned ticket is normal; the snapshot engine drops "unknown" from
    // team load rather than inventing a person.
    const unassigned = issue({ assignee: undefined, reporter: undefined });
    const { connector } = await loadJira({ issues: [unassigned] });
    const events = await connector.fetchEvents([project]);
    expect(events.every((e) => e.actor === "unknown")).toBe(true);
  });

  it("gives created and updated events distinct ids", async () => {
    // Colliding ids would make appendMany silently drop the second event.
    const { connector } = await loadJira({ issues: [issue()] });
    const events = await connector.fetchEvents([project]);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });

  it("skips a project with no Jira key", async () => {
    const { connector, fetchMock } = await loadJira({ issues: [] });
    const events = await connector.fetchEvents([{ ...project, jiraKey: "" }]);
    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scopes the query to the project and a recent window", async () => {
    const { connector, fetchMock } = await loadJira({ issues: [] });
    await connector.fetchEvents([project]);

    const url = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(url).toContain("project = CHK");
    expect(url).toContain("updated >= -14d");
  });

  it("keeps going when the API fails", async () => {
    const { connector } = await loadJira({}, false);
    await expect(connector.fetchEvents([project])).resolves.toEqual([]);
  });

  it("handles an empty issue list", async () => {
    const { connector } = await loadJira({ issues: [] });
    expect(await connector.fetchEvents([project])).toEqual([]);
  });
});
