import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { enrichSignals } from "../ingestion";
import type { NormalizedEvent, Project, Severity, Signal } from "../types";

/**
 * enrichSignals turns a signal's evidence strings back into deep links. It is
 * the only place the app guesses which event produced a signal, so most of what
 * matters here is when it should decline to link rather than guess wrong — a
 * link to the wrong PR is worse than no link at all.
 */

const project: Project = {
  id: "p_checkout",
  name: "Checkout Platform",
  jiraKey: "CHK",
  githubRepo: "acme/checkout",
  slackChannel: "#checkout-eng",
  owner: "alice",
};

const signal = (overrides: Partial<Signal> = {}): Signal => ({
  id: "sig_1",
  projectId: "p_checkout",
  severity: "watch" as Severity,
  title: "PR waiting on review for 4 days",
  reason: "no reviews",
  evidence: ["PR #42 opened 4 days ago"],
  links: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

const event = (overrides: Partial<NormalizedEvent> = {}): NormalizedEvent => ({
  id: "e_1",
  source: "github",
  type: "pr_opened",
  projectId: "p_checkout",
  timestamp: new Date().toISOString(),
  actor: "alice",
  refs: { prNumber: 42 },
  payload: {},
  ...overrides,
});

const linkFor = (source: string, signals: Signal[]) =>
  signals[0].links.find((l) => l.source === source);

let savedJiraHost: string | undefined;

beforeEach(() => {
  savedJiraHost = process.env.JIRA_HOST;
  delete process.env.JIRA_HOST;
});

afterEach(() => {
  if (savedJiraHost === undefined) delete process.env.JIRA_HOST;
  else process.env.JIRA_HOST = savedJiraHost;
});

describe("shape", () => {
  it("returns one signal per input, preserving the rest of the fields", () => {
    const result = enrichSignals([signal(), signal({ id: "sig_2" })], [], [project]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "sig_1", severity: "watch", reason: "no reviews" });
  });

  it("does not mutate the signals it is given", () => {
    const input = signal();
    enrichSignals([input], [event()], [project]);
    expect(input.links).toEqual([]);
  });

  it("adds no links when the project is unknown", () => {
    // Without the project there is no repo or channel to build a URL from.
    const result = enrichSignals([signal()], [event()], []);
    expect(result[0].links).toEqual([]);
  });

  it("handles an empty signal list", () => {
    expect(enrichSignals([], [event()], [project])).toEqual([]);
  });
});

describe("GitHub PR links", () => {
  it("links a PR mentioned in the evidence", () => {
    const result = enrichSignals([signal()], [event()], [project]);
    expect(linkFor("github", result)).toEqual({
      label: "PR #42",
      href: "https://github.com/acme/checkout/pull/42",
      source: "github",
    });
  });

  it("adds no PR link when the title never mentions a PR", () => {
    const result = enrichSignals(
      [signal({ title: "Ticket stale > 9 days", evidence: ["PR #42"] })],
      [event()],
      [project]
    );
    expect(linkFor("github", result)).toBeUndefined();
  });

  it("adds no PR link when no event matches the evidence", () => {
    // Evidence cites #99 but only #42 was ingested, so there is nothing to link.
    const result = enrichSignals([signal({ evidence: ["PR #99 opened"] })], [event()], [project]);
    expect(linkFor("github", result)).toBeUndefined();
  });

  it("ignores a PR event from a different project", () => {
    const result = enrichSignals(
      [signal()],
      [event({ projectId: "p_other" })],
      [project, { ...project, id: "p_other" }]
    );
    expect(linkFor("github", result)).toBeUndefined();
  });

  it("ignores a matching number from a non-GitHub source", () => {
    const result = enrichSignals([signal()], [event({ source: "jira" })], [project]);
    expect(linkFor("github", result)).toBeUndefined();
  });
});

describe("Jira ticket links", () => {
  const stale = signal({
    title: "Ticket stale > 9 days",
    evidence: ["CHK-1207 untouched for 9 days"],
  });
  const ticketEvent = event({
    source: "jira",
    type: "ticket_created",
    refs: { ticketKey: "CHK-1207" },
  });

  it("links a ticket named in the evidence", () => {
    const result = enrichSignals([stale], [ticketEvent], [project]);
    expect(linkFor("jira", result)).toEqual({
      label: "CHK-1207",
      href: "https://jira.acme.com/browse/CHK-1207",
      source: "jira",
    });
  });

  it("uses the configured Jira host when one is set", () => {
    process.env.JIRA_HOST = "acme.atlassian.net";
    const result = enrichSignals([stale], [ticketEvent], [project]);
    expect(linkFor("jira", result)?.href).toBe("https://acme.atlassian.net/browse/CHK-1207");
  });

  it("adds no ticket link when the evidence names no ticket", () => {
    const result = enrichSignals(
      [signal({ title: "Ticket stale", evidence: ["something vague"] })],
      [ticketEvent],
      [project]
    );
    expect(linkFor("jira", result)).toBeUndefined();
  });

  it("links a ticket regardless of the signal wording", () => {
    // Unlike the PR link, this one is not gated on the title.
    const result = enrichSignals(
      [signal({ title: "Anything at all", evidence: ["CHK-1207"] })],
      [ticketEvent],
      [project]
    );
    expect(linkFor("jira", result)?.label).toBe("CHK-1207");
  });
});

describe("Slack incident links", () => {
  const incident = signal({
    title: "Active incident without follow-up ticket",
    evidence: ["thread with 4 replies"],
  });
  const slackEvent = event({
    source: "slack",
    type: "incident_thread",
    refs: { threadTs: "1700000000.000100" },
  });

  it("links the incident thread", () => {
    const result = enrichSignals([incident], [slackEvent], [project]);
    expect(linkFor("slack", result)).toEqual({
      label: "Slack thread",
      // The channel loses its hash and the timestamp loses its dot, which is
      // the archive URL format Slack expects.
      href: "https://acme.slack.com/archives/checkout-eng/p1700000000000100",
      source: "slack",
    });
  });

  it("adds no Slack link when the title is not about an incident", () => {
    const result = enrichSignals(
      [signal({ title: "PR waiting on review" })],
      [slackEvent],
      [project]
    );
    expect(linkFor("slack", result)).toBeUndefined();
  });

  it("adds no Slack link when no incident thread was ingested", () => {
    const result = enrichSignals([incident], [event()], [project]);
    expect(linkFor("slack", result)).toBeUndefined();
  });

  it("tolerates an incident event with no thread timestamp", () => {
    const result = enrichSignals([incident], [event({ source: "slack", type: "incident_thread", refs: {} })], [project]);
    expect(linkFor("slack", result)?.href).toBe("https://acme.slack.com/archives/checkout-eng/p");
  });
});

describe("multiple links on one signal", () => {
  it("attaches a PR and a ticket link together", () => {
    // A PR carrying a ticket key is the common case, and the point of the
    // product is seeing both sides of the same piece of work.
    const result = enrichSignals(
      [signal({ evidence: ["PR #42 for CHK-1207"] })],
      [event({ refs: { prNumber: 42, ticketKey: "CHK-1207" } })],
      [project]
    );
    expect(result[0].links.map((l) => l.source).sort()).toEqual(["github", "jira"]);
  });

  it("attaches all three when the evidence supports it", () => {
    const result = enrichSignals(
      [
        signal({
          title: "Active incident on PR work",
          evidence: ["PR #42", "CHK-1207", "incident thread"],
        }),
      ],
      [
        event({ refs: { prNumber: 42 } }),
        event({ id: "e_2", source: "jira", refs: { ticketKey: "CHK-1207" } }),
        event({ id: "e_3", source: "slack", type: "incident_thread", refs: { threadTs: "1.2" } }),
      ],
      [project]
    );
    expect(result[0].links).toHaveLength(3);
  });
});
