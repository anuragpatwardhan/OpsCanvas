import { mockConnector } from "./mock";
import { githubConnector } from "./github";
import { jiraConnector } from "./jira";
import { slackConnector } from "./slack";
import type { Connector, ConnectorStatus } from "./types";

export const connectors: Connector[] = [mockConnector, githubConnector, jiraConnector, slackConnector];

export function connectorStatuses(): ConnectorStatus[] {
  return [
    { name: "mock",   enabled: mockConnector.enabled() },
    { name: "github", enabled: githubConnector.enabled(), reason: githubConnector.enabled() ? undefined : "GITHUB_TOKEN not set" },
    { name: "jira",   enabled: jiraConnector.enabled(),   reason: jiraConnector.enabled() ? undefined : "JIRA_HOST/JIRA_EMAIL/JIRA_API_TOKEN not set" },
    { name: "slack",  enabled: slackConnector.enabled(),  reason: slackConnector.enabled() ? undefined : "SLACK_BOT_TOKEN not set" },
  ];
}

export function activeConnectors(): Connector[] {
  const real = connectors.filter((c) => c.name !== "mock" && c.enabled());
  return real.length > 0 ? real : [mockConnector];
}
