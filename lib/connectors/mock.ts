import type { Connector } from "./types";
import type { NormalizedEvent, Project } from "../types";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let counter = 0;
const id = (prefix: string) => `${prefix}_${Date.now()}_${++counter}`;

export const mockConnector: Connector = {
  name: "mock",
  enabled: () => true,
  async fetchEvents(projects: Project[]): Promise<NormalizedEvent[]> {
    const out: NormalizedEvent[] = [];

    for (const p of projects) {
      out.push({
        id: id("ev"),
        source: "jira",
        type: "ticket_created",
        projectId: p.id,
        timestamp: daysAgo(7),
        actor: "priya",
        refs: { ticketKey: `${p.jiraKey}-1207` },
        payload: { status: "To Do", title: "Apply discount codes at checkout" },
      });
      out.push({
        id: id("ev"),
        source: "jira",
        type: "status_change",
        projectId: p.id,
        timestamp: daysAgo(6),
        actor: "priya",
        refs: { ticketKey: `${p.jiraKey}-1207` },
        payload: { status: "In Progress" },
      });
    }

    if (projects[0]) {
      out.push({
        id: id("ev"),
        source: "github",
        type: "pr_opened",
        projectId: projects[0].id,
        timestamp: daysAgo(4),
        actor: "priya",
        refs: { prNumber: 482, ticketKey: `${projects[0].jiraKey}-1207` },
        payload: { title: "feat: discount engine", baseRef: "main", filesChanged: 14 },
      });
    }

    if (projects[5]) {
      out.push({
        id: id("ev"),
        source: "github",
        type: "pr_opened",
        projectId: projects[5].id,
        timestamp: daysAgo(8),
        actor: "aarav",
        refs: { prNumber: 319 },
        payload: { title: "refactor: ingest pipeline", filesChanged: 4 },
      });
      out.push(
        { id: id("ev"), source: "github", type: "pr_reopened", projectId: projects[5].id, timestamp: daysAgo(5), actor: "aarav", refs: { prNumber: 319 }, payload: {} },
        { id: id("ev"), source: "github", type: "pr_reopened", projectId: projects[5].id, timestamp: daysAgo(3), actor: "aarav", refs: { prNumber: 319 }, payload: {} },
        { id: id("ev"), source: "github", type: "pr_reopened", projectId: projects[5].id, timestamp: daysAgo(1), actor: "aarav", refs: { prNumber: 319 }, payload: { filesChanged: 22 } },
      );
    }

    if (projects[1]) {
      out.push({
        id: id("ev"),
        source: "jira",
        type: "status_change",
        projectId: projects[1].id,
        timestamp: daysAgo(5),
        actor: "marcus",
        refs: { ticketKey: `${projects[1].jiraKey}-417` },
        payload: { status: "Blocked", reason: "waiting on external API team" },
      });
    }

    if (projects[3]) {
      out.push({
        id: id("ev"),
        source: "slack",
        type: "incident_thread",
        projectId: projects[3].id,
        timestamp: hoursAgo(6),
        actor: "diego",
        refs: { threadTs: "1700000000.0001" },
        payload: { channel: "#search-eng", title: "Search latency spike", replies: 18 },
      });
    }

    return out;
  },
};
