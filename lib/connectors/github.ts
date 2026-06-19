import type { Connector } from "./types";
import type { NormalizedEvent, Project } from "../types";

const TOKEN = process.env.GITHUB_TOKEN;
const BASE = "https://api.github.com";

interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  user: { login: string };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  draft: boolean;
  head: { ref: string };
}

interface Review {
  id: number;
  user: { login: string };
  submitted_at: string;
  state: string;
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

const TICKET_KEY_RE = /\b([A-Z]{2,6})-(\d+)\b/;

export const githubConnector: Connector = {
  name: "github",
  enabled: () => Boolean(TOKEN),
  async fetchEvents(projects: Project[]): Promise<NormalizedEvent[]> {
    if (!TOKEN) return [];
    const out: NormalizedEvent[] = [];

    for (const p of projects) {
      if (!p.githubRepo) continue;
      try {
        const prs = await gh<PullRequest[]>(`/repos/${p.githubRepo}/pulls?state=all&per_page=30`);
        for (const pr of prs) {
          const ticketMatch = (pr.title.match(TICKET_KEY_RE) || pr.head.ref.match(TICKET_KEY_RE))?.[0];
          out.push({
            id: `gh_pr_open_${pr.id}`,
            source: "github",
            type: "pr_opened",
            projectId: p.id,
            timestamp: pr.created_at,
            actor: pr.user.login,
            refs: { prNumber: pr.number, ticketKey: ticketMatch },
            payload: { title: pr.title, draft: pr.draft, state: pr.state, branch: pr.head.ref },
          });

          if (pr.state === "open") {
            try {
              const reviews = await gh<Review[]>(`/repos/${p.githubRepo}/pulls/${pr.number}/reviews`);
              for (const r of reviews) {
                out.push({
                  id: `gh_pr_review_${r.id}`,
                  source: "github",
                  type: "pr_review",
                  projectId: p.id,
                  timestamp: r.submitted_at,
                  actor: r.user.login,
                  refs: { prNumber: pr.number },
                  payload: { state: r.state },
                });
              }
            } catch {
              // skip review fetch failure
            }
          }
        }
      } catch (err) {
        console.warn(`[github] skip ${p.githubRepo}:`, (err as Error).message);
      }
    }

    return out;
  },
};
