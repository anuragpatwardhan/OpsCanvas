import { repo, persist } from "./store";
import { activeConnectors } from "./connectors";
import { evaluateSignals } from "./signalEngine";
import { computeSnapshots, computeTeamLoad, computeThreads } from "./snapshotEngine";
import { projects as seedProjects } from "./seed";
import type { NormalizedEvent, Project, Signal } from "./types";

function enrichSignals(rawSignals: Signal[], events: NormalizedEvent[], projects: Project[]): Signal[] {
  return rawSignals.map((sig) => {
    const project = projects.find((p) => p.id === sig.projectId);
    const links: Signal["links"] = [];

    const titleLower = sig.title.toLowerCase();
    const prMatch = titleLower.match(/pr/);
    const ticketMatch = events.find(
      (e) => e.projectId === sig.projectId && e.refs.ticketKey && sig.evidence.some((ev) => ev.includes(e.refs.ticketKey!))
    );

    if (project) {
      if (prMatch) {
        const prEvent = events.find(
          (e) =>
            e.projectId === sig.projectId &&
            e.source === "github" &&
            sig.evidence.some((ev) => e.refs.prNumber && ev.includes(`#${e.refs.prNumber}`))
        );
        if (prEvent?.refs.prNumber) {
          links.push({
            label: `PR #${prEvent.refs.prNumber}`,
            href: `https://github.com/${project.githubRepo}/pull/${prEvent.refs.prNumber}`,
            source: "github",
          });
        }
      }
      if (ticketMatch?.refs.ticketKey) {
        links.push({
          label: ticketMatch.refs.ticketKey,
          href: `https://${process.env.JIRA_HOST ?? "jira.acme.com"}/browse/${ticketMatch.refs.ticketKey}`,
          source: "jira",
        });
      }
      const slackEvent = events.find(
        (e) => e.projectId === sig.projectId && e.source === "slack" && e.type === "incident_thread"
      );
      if (titleLower.includes("incident") && slackEvent) {
        links.push({
          label: "Slack thread",
          href: `https://acme.slack.com/archives/${project.slackChannel.slice(1)}/p${(slackEvent.refs.threadTs ?? "").replace(".", "")}`,
          source: "slack",
        });
      }
    }

    return { ...sig, links };
  });
}

export async function runIngestionCycle(): Promise<{
  eventsAdded: number;
  signalsGenerated: number;
  durationMs: number;
}> {
  const t0 = Date.now();

  if (repo.projects.all().length === 0) {
    repo.projects.upsertMany(seedProjects);
  }
  const projects = repo.projects.all();

  const before = repo.events.all().length;
  const all: NormalizedEvent[] = [];
  for (const c of activeConnectors()) {
    try {
      const events = await c.fetchEvents(projects);
      all.push(...events);
    } catch (err) {
      console.warn(`[ingest] ${c.name} failed:`, (err as Error).message);
    }
  }
  repo.events.appendMany(all);
  const events = repo.events.all();

  const rawSignals = evaluateSignals(events);
  const signals = enrichSignals(rawSignals, events, projects);
  repo.signals.replaceAll(signals);

  const snapshots = computeSnapshots(projects, events, signals);
  repo.snapshots.replaceAll(snapshots);

  const teamLoad = computeTeamLoad(events);
  repo.teamLoad.set(teamLoad);

  const threads = computeThreads(events);
  repo.threads.replaceAll(threads);

  repo.meta.setLastSyncAt(new Date().toISOString());
  persist();

  return {
    eventsAdded: repo.events.all().length - before,
    signalsGenerated: signals.length,
    durationMs: Date.now() - t0,
  };
}

let bootstrapped = false;

export async function ensureBootstrapped(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  if (repo.projects.all().length === 0) {
    await runIngestionCycle();
  }
}
