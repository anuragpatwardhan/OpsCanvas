import type { Connector } from "./types";
import type { NormalizedEvent, Project } from "../types";

const HOST = process.env.JIRA_HOST;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    updated: string;
    created: string;
    assignee?: { displayName: string };
    reporter?: { displayName: string };
  };
}

interface JiraSearchResponse {
  issues: JiraIssue[];
}

async function jira<T>(path: string): Promise<T> {
  const auth = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
  const res = await fetch(`https://${HOST}${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Jira ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const jiraConnector: Connector = {
  name: "jira",
  enabled: () => Boolean(HOST && EMAIL && TOKEN),
  async fetchEvents(projects: Project[]): Promise<NormalizedEvent[]> {
    if (!HOST || !EMAIL || !TOKEN) return [];
    const out: NormalizedEvent[] = [];

    for (const p of projects) {
      if (!p.jiraKey) continue;
      try {
        const jql = encodeURIComponent(`project = ${p.jiraKey} AND updated >= -14d ORDER BY updated DESC`);
        const data = await jira<JiraSearchResponse>(
          `/rest/api/3/search?jql=${jql}&fields=summary,status,updated,created,assignee,reporter&maxResults=50`
        );
        for (const issue of data.issues) {
          out.push({
            id: `jira_created_${issue.id}`,
            source: "jira",
            type: "ticket_created",
            projectId: p.id,
            timestamp: issue.fields.created,
            actor: issue.fields.reporter?.displayName ?? "unknown",
            refs: { ticketKey: issue.key },
            payload: { status: issue.fields.status.name, title: issue.fields.summary },
          });
          if (issue.fields.updated !== issue.fields.created) {
            out.push({
              id: `jira_updated_${issue.id}`,
              source: "jira",
              type: "status_change",
              projectId: p.id,
              timestamp: issue.fields.updated,
              actor: issue.fields.assignee?.displayName ?? "unknown",
              refs: { ticketKey: issue.key },
              payload: { status: issue.fields.status.name },
            });
          }
        }
      } catch (err) {
        console.warn(`[jira] skip ${p.jiraKey}:`, (err as Error).message);
      }
    }

    return out;
  },
};
