import type { Connector } from "./types";
import type { NormalizedEvent, Project } from "../types";

const TOKEN = process.env.SLACK_BOT_TOKEN;

interface SlackMessage {
  ts: string;
  user?: string;
  text: string;
  thread_ts?: string;
  reply_count?: number;
}

interface SlackHistoryResponse {
  ok: boolean;
  messages: SlackMessage[];
  error?: string;
}

async function slack<T>(method: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://slack.com/api/${method}?${qs}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Slack ${res.status}: ${method}`);
  return res.json() as Promise<T>;
}

const INCIDENT_RE = /incident|outage|down|p[012]|sev[0-2]/i;

export const slackConnector: Connector = {
  name: "slack",
  enabled: () => Boolean(TOKEN),
  async fetchEvents(projects: Project[]): Promise<NormalizedEvent[]> {
    if (!TOKEN) return [];
    const out: NormalizedEvent[] = [];

    for (const p of projects) {
      if (!p.slackChannel) continue;
      try {
        const channelId = p.slackChannel.replace(/^#/, "");
        const oldest = String(Math.floor((Date.now() - 7 * 86_400_000) / 1000));
        const data = await slack<SlackHistoryResponse>("conversations.history", {
          channel: channelId,
          oldest,
          limit: "30",
        });
        if (!data.ok) continue;
        for (const msg of data.messages) {
          if (msg.thread_ts && INCIDENT_RE.test(msg.text)) {
            out.push({
              id: `slack_inc_${msg.ts}`,
              source: "slack",
              type: "incident_thread",
              projectId: p.id,
              timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
              actor: msg.user ?? "unknown",
              refs: { threadTs: msg.ts },
              payload: { channel: p.slackChannel, title: msg.text.slice(0, 120), replies: msg.reply_count ?? 0 },
            });
          }
        }
      } catch (err) {
        console.warn(`[slack] skip ${p.slackChannel}:`, (err as Error).message);
      }
    }

    return out;
  },
};
