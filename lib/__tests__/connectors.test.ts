import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../types";

const project: Project = {
  id: "p_checkout",
  name: "Checkout Platform",
  jiraKey: "CHK",
  githubRepo: "acme/checkout",
  slackChannel: "#checkout-eng",
  owner: "alice",
};

/**
 * Each connector reads its credentials into a module-level constant at import
 * time, so setting process.env after the fact has no effect. Tests therefore
 * reset the module registry and re-import with the environment already in place.
 */
async function loadConnectors(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("../connectors");
}

const CREDENTIALS = [
  "GITHUB_TOKEN",
  "JIRA_HOST",
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "SLACK_BOT_TOKEN",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(CREDENTIALS.map((key) => [key, process.env[key]]));
  for (const key of CREDENTIALS) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("activeConnectors", () => {
  it("falls back to the mock connector when nothing is configured", async () => {
    const { activeConnectors } = await loadConnectors({});
    expect(activeConnectors().map((c) => c.name)).toEqual(["mock"]);
  });

  it("uses a real connector once its credentials are present", async () => {
    const { activeConnectors } = await loadConnectors({ GITHUB_TOKEN: "ghp_test" });
    expect(activeConnectors().map((c) => c.name)).toEqual(["github"]);
  });

  it("drops the mock as soon as any real connector is active", async () => {
    // The point of the fallback is that mock data never mixes with real data.
    const { activeConnectors } = await loadConnectors({ SLACK_BOT_TOKEN: "xoxb-test" });
    expect(activeConnectors().map((c) => c.name)).not.toContain("mock");
  });

  it("runs every configured connector together", async () => {
    const { activeConnectors } = await loadConnectors({
      GITHUB_TOKEN: "ghp_test",
      SLACK_BOT_TOKEN: "xoxb-test",
    });
    expect(activeConnectors().map((c) => c.name).sort()).toEqual(["github", "slack"]);
  });

  it("requires all three Jira values, not just one", async () => {
    const partial = await loadConnectors({ JIRA_HOST: "acme.atlassian.net" });
    expect(partial.activeConnectors().map((c) => c.name)).toEqual(["mock"]);

    const complete = await loadConnectors({
      JIRA_HOST: "acme.atlassian.net",
      JIRA_EMAIL: "you@example.com",
      JIRA_API_TOKEN: "token",
    });
    expect(complete.activeConnectors().map((c) => c.name)).toEqual(["jira"]);
  });
});

describe("connectorStatuses", () => {
  it("reports every connector, with the mock always available", async () => {
    const { connectorStatuses } = await loadConnectors({});
    const statuses = connectorStatuses();
    expect(statuses.map((s) => s.name)).toEqual(["mock", "github", "jira", "slack"]);
    expect(statuses.find((s) => s.name === "mock")?.enabled).toBe(true);
  });

  it("explains which variable is missing for a disabled connector", async () => {
    const { connectorStatuses } = await loadConnectors({});
    const github = connectorStatuses().find((s) => s.name === "github");
    expect(github?.enabled).toBe(false);
    expect(github?.reason).toContain("GITHUB_TOKEN");
  });

  it("gives no reason once a connector is enabled", async () => {
    const { connectorStatuses } = await loadConnectors({ GITHUB_TOKEN: "ghp_test" });
    const github = connectorStatuses().find((s) => s.name === "github");
    expect(github?.enabled).toBe(true);
    expect(github?.reason).toBeUndefined();
  });
});

describe("mockConnector", () => {
  it("is always enabled so the dashboard is never empty", async () => {
    const { connectors } = await loadConnectors({});
    expect(connectors.find((c) => c.name === "mock")?.enabled()).toBe(true);
  });

  it("produces events for every project it is given", async () => {
    const { connectors } = await loadConnectors({});
    const mock = connectors.find((c) => c.name === "mock")!;
    const second: Project = { ...project, id: "p_other", jiraKey: "OTH" };

    const events = await mock.fetchEvents([project, second]);

    expect(events.length).toBeGreaterThan(0);
    expect(new Set(events.map((e) => e.projectId))).toEqual(new Set(["p_checkout", "p_other"]));
  });

  it("issues unique event ids", async () => {
    const { connectors } = await loadConnectors({});
    const mock = connectors.find((c) => c.name === "mock")!;
    const events = await mock.fetchEvents([project]);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });

  it("returns nothing for an empty project list", async () => {
    const { connectors } = await loadConnectors({});
    const mock = connectors.find((c) => c.name === "mock")!;
    expect(await mock.fetchEvents([])).toEqual([]);
  });
});

describe("githubConnector.fetchEvents", () => {
  const pull = (overrides: Record<string, unknown> = {}) => ({
    id: 1001,
    number: 42,
    title: "Add discount codes",
    state: "open",
    user: { login: "alice" },
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-02T10:00:00Z",
    closed_at: null,
    merged_at: null,
    draft: false,
    head: { ref: "feature/discounts" },
    ...overrides,
  });

  const review = (overrides: Record<string, unknown> = {}) => ({
    id: 2001,
    user: { login: "bob" },
    submitted_at: "2026-08-02T09:00:00Z",
    state: "APPROVED",
    ...overrides,
  });

  /** Route each request path to a canned JSON response. */
  function stubFetch(routes: Record<string, unknown>) {
    return vi.fn(async (url: string, _init?: RequestInit) => {
      const path = url.replace("https://api.github.com", "");
      if (!(path in routes)) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => routes[path] };
    });
  }

  async function loadGithub(routes: Record<string, unknown>) {
    const fetchMock = stubFetch(routes);
    vi.stubGlobal("fetch", fetchMock);
    const { connectors } = await loadConnectors({ GITHUB_TOKEN: "ghp_test" });
    return { connector: connectors.find((c) => c.name === "github")!, fetchMock };
  }

  it("returns nothing when no token is configured", async () => {
    const { connectors } = await loadConnectors({});
    const github = connectors.find((c) => c.name === "github")!;
    expect(await github.fetchEvents([project])).toEqual([]);
  });

  it("normalises a pull request into a pr_opened event", async () => {
    const { connector } = await loadGithub({
      "/repos/acme/checkout/pulls?state=all&per_page=30": [pull()],
      "/repos/acme/checkout/pulls/42/reviews": [],
    });

    const events = await connector.fetchEvents([project]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: "github",
      type: "pr_opened",
      projectId: "p_checkout",
      actor: "alice",
      timestamp: "2026-08-01T10:00:00Z",
      refs: { prNumber: 42 },
    });
  });

  it("extracts a ticket key from the pull request title", async () => {
    const { connector } = await loadGithub({
      "/repos/acme/checkout/pulls?state=all&per_page=30": [pull({ title: "CHK-1207 add discounts" })],
      "/repos/acme/checkout/pulls/42/reviews": [],
    });
    const events = await connector.fetchEvents([project]);
    expect(events[0].refs.ticketKey).toBe("CHK-1207");
  });

  it("falls back to the branch name when the title has no ticket key", async () => {
    const { connector } = await loadGithub({
      "/repos/acme/checkout/pulls?state=all&per_page=30": [
        pull({ title: "add discounts", head: { ref: "feature/CHK-88-discounts" } }),
      ],
      "/repos/acme/checkout/pulls/42/reviews": [],
    });
    const events = await connector.fetchEvents([project]);
    expect(events[0].refs.ticketKey).toBe("CHK-88");
  });

  it("leaves the ticket key undefined when neither carries one", async () => {
    const { connector } = await loadGithub({
      "/repos/acme/checkout/pulls?state=all&per_page=30": [pull()],
      "/repos/acme/checkout/pulls/42/reviews": [],
    });
    const events = await connector.fetchEvents([project]);
    expect(events[0].refs.ticketKey).toBeUndefined();
  });

  it("adds a pr_review event for each review on an open pull request", async () => {
    const { connector } = await loadGithub({
      "/repos/acme/checkout/pulls?state=all&per_page=30": [pull()],
      "/repos/acme/checkout/pulls/42/reviews": [review(), review({ id: 2002, user: { login: "carol" } })],
    });

    const events = await connector.fetchEvents([project]);
    const reviews = events.filter((e) => e.type === "pr_review");
    expect(reviews).toHaveLength(2);
    expect(reviews.map((e) => e.actor).sort()).toEqual(["bob", "carol"]);
  });

  it("does not fetch reviews for a closed pull request", async () => {
    // Reviews only matter while a PR is still waiting, so closed ones skip the call.
    const { connector, fetchMock } = await loadGithub({
      "/repos/acme/checkout/pulls?state=all&per_page=30": [pull({ state: "closed" })],
    });

    await connector.fetchEvents([project]);

    const paths = fetchMock.mock.calls.map(([url]) => String(url));
    expect(paths.some((p) => p.includes("/reviews"))).toBe(false);
  });

  it("skips a project with no configured repository", async () => {
    const { connector, fetchMock } = await loadGithub({});
    const events = await connector.fetchEvents([{ ...project, githubRepo: "" }]);
    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps going when one repository fails", async () => {
    // A 404 on the first project must not lose the second project's events.
    const second: Project = { ...project, id: "p_other", githubRepo: "acme/other" };
    const { connector } = await loadGithub({
      "/repos/acme/other/pulls?state=all&per_page=30": [pull({ id: 3001, number: 7 })],
      "/repos/acme/other/pulls/7/reviews": [],
    });

    const events = await connector.fetchEvents([project, second]);

    expect(events).toHaveLength(1);
    expect(events[0].projectId).toBe("p_other");
  });

  it("keeps the pull request when its review fetch fails", async () => {
    const { connector } = await loadGithub({
      "/repos/acme/checkout/pulls?state=all&per_page=30": [pull()],
      // no reviews route, so that request 404s
    });

    const events = await connector.fetchEvents([project]);
    expect(events.map((e) => e.type)).toEqual(["pr_opened"]);
  });

  it("sends the token and API version on every request", async () => {
    const { connector, fetchMock } = await loadGithub({
      "/repos/acme/checkout/pulls?state=all&per_page=30": [],
    });

    await connector.fetchEvents([project]);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_test");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });
});
