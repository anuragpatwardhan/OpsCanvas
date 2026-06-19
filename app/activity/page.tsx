import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { SourceIcon, sourceLabel } from "@/components/ui/SourceIcon";
import { ensureBootstrapped } from "@/lib/ingestion";
import { repo } from "@/lib/store";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  ticket_created:    "ticket created",
  status_change:     "status changed",
  pr_opened:         "PR opened",
  pr_reopened:       "PR reopened",
  pr_review:         "review submitted",
  pr_stale:          "PR went stale",
  incident_thread:   "incident thread",
  thread_started:    "thread started",
  review_requested:  "review requested",
  decision_logged:   "decision recorded",
};

export default async function ActivityPage() {
  await ensureBootstrapped();
  const projects = repo.projects.all();
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? id;
  const events = repo.events.recent(200);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="pl-[240px]">
        <TopBar />
        <div className="px-8 py-7 max-w-[1000px] mx-auto">
          <header className="mb-7">
            <p className="text-[12px] uppercase tracking-wider text-ink-dim font-semibold mb-1.5">Activity</p>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">
              {events.length} recent events
            </h1>
            <p className="mt-2 text-[13px] text-ink-muted">
              Raw stream of normalized events across all sources. This is what the signal engine reads from.
            </p>
          </header>

          <div className="rounded-xl bg-surface/60 ring-1 ring-inset ring-border divide-y divide-border/40 overflow-hidden">
            {events.map((e) => (
              <div key={e.id} className="px-5 py-3 hover:bg-surface/40 transition-colors flex items-start gap-3 group">
                <div className="h-7 w-7 rounded-md bg-bg/60 ring-1 ring-border inline-flex items-center justify-center shrink-0 mt-0.5">
                  <SourceIcon source={e.source} size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12.5px] text-ink">
                      <span className="text-ink-muted">{sourceLabel(e.source)}</span>
                      <span className="text-ink-dim mx-1.5">·</span>
                      <span>{typeLabel[e.type] ?? e.type}</span>
                      {e.refs.ticketKey && (
                        <span className="ml-2 font-mono text-[10.5px] text-accent-cyan">{e.refs.ticketKey}</span>
                      )}
                      {e.refs.prNumber !== undefined && (
                        <span className="ml-2 font-mono text-[10.5px] text-ink-muted">#{e.refs.prNumber}</span>
                      )}
                    </div>
                    <span className="text-[10.5px] font-mono text-ink-dim shrink-0">{relativeTime(e.timestamp)}</span>
                  </div>
                  <div className="text-[11px] text-ink-dim mt-0.5">
                    @{e.actor} · {projectName(e.projectId)}
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="p-8 text-center text-[12px] text-ink-dim">
                No events yet. Trigger a sync from the top bar.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
