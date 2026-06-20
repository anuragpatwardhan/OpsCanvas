import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ThreadTimeline } from "@/components/ThreadTimeline";
import { StateChip } from "@/components/ui/StateChip";
import { ensureBootstrapped } from "@/lib/ingestion";
import { repo } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: { id: string } }) {
  await ensureBootstrapped();
  const thread = repo.threads.byId(params.id);
  if (!thread) notFound();
  const project = repo.projects.byId(thread.projectId);

  const participants = [...new Set(thread.events.map((e) => e.actor).filter((a) => a && a !== "system"))];

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="pl-[240px]">
        <TopBar />
        <div className="px-8 py-7 max-w-[1100px] mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[12px] text-ink-dim hover:text-ink-muted mb-5 transition-colors"
          >
            <ChevronLeft size={14} /> Canvas
          </Link>

          <header className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <StateChip state="watch" label="In Progress" />
              <span className="text-[11px] font-mono text-ink-dim">
                {project?.name} · {thread.events.length} events
              </span>
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">{thread.title}</h1>
            <p className="mt-2 text-[13px] text-ink-muted max-w-2xl leading-relaxed">
              Single narrative across Jira, GitHub, and Slack. Tells you{" "}
              <em className="text-ink">how we got here</em>.
            </p>
          </header>

          <div className="grid grid-cols-[1fr_280px] gap-8">
            <ThreadTimeline thread={thread} />

            <aside className="space-y-3">
              <SidebarCard title="Source links">
                {project && (
                  <>
                    <SourceLink label="Jira project" sub={project.jiraKey} href={`https://jira.acme.com/${project.jiraKey}`} />
                    <SourceLink label="GitHub repo" sub={project.githubRepo} href={`https://github.com/${project.githubRepo}`} />
                    <SourceLink label="Slack channel" sub={project.slackChannel} href={`https://acme.slack.com/channels/${project.slackChannel.slice(1)}`} />
                  </>
                )}
              </SidebarCard>

              <SidebarCard title="Participants">
                {participants.map((name) => (
                  <Participant key={name} name={name} />
                ))}
              </SidebarCard>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface/60 ring-1 ring-inset ring-border p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-dim font-semibold mb-2.5">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SourceLink({ label, sub, href }: { label: string; sub: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group flex items-center justify-between px-2 py-1.5 -mx-2 rounded hover:bg-bg/60 transition-colors">
      <div>
        <div className="text-[12px] text-ink">{label}</div>
        <div className="text-[10.5px] font-mono text-ink-dim">{sub}</div>
      </div>
      <ExternalLink size={11} className="text-ink-dim group-hover:text-ink-muted transition-colors" />
    </a>
  );
}

function Participant({ name }: { name: string }) {
  const initials = name
    .split(/[\s_.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || name.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded">
      <span className="h-6 w-6 rounded-md bg-gradient-to-br from-brand/30 to-accent-cyan/20 ring-1 ring-brand/20 inline-flex items-center justify-center text-[9px] font-semibold text-ink">
        {initials}
      </span>
      <div className="min-w-0">
        <div className="text-[12px] text-ink truncate">@{name}</div>
      </div>
    </div>
  );
}
