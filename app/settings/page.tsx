import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Github, Layers, MessageSquare, Check, Plus, AlertCircle } from "lucide-react";
import { connectorStatuses } from "@/lib/connectors";
import { rules } from "@/lib/signalEngine";

export const dynamic = "force-dynamic";

const meta: Record<string, { name: string; Icon: typeof Github; color: string; envHint: string }> = {
  github: { name: "GitHub",     Icon: Github,         color: "text-ink",           envHint: "Set GITHUB_TOKEN to enable" },
  jira:   { name: "Jira Cloud", Icon: Layers,         color: "text-accent-cyan",   envHint: "Set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN" },
  slack:  { name: "Slack",      Icon: MessageSquare,  color: "text-brand-glow",    envHint: "Set SLACK_BOT_TOKEN to enable" },
  mock:   { name: "Mock source",Icon: AlertCircle,    color: "text-ink-muted",     envHint: "Always-on synthetic event generator" },
};

const ruleDetail: Record<string, { name: string; threshold: string }> = {
  review_backlog:        { name: "Review backlog",         threshold: "PR open > 2d with no review" },
  churn_risk:            { name: "Churn risk",             threshold: "PR reopened ≥ 2 times" },
  stale_ticket:          { name: "Stale ticket",           threshold: "In-Progress unchanged > 5d" },
  blocked:               { name: "Blocked",                threshold: "Status 'Blocked' > 3d" },
  incident_followup_gap: { name: "Incident follow-up gap", threshold: "Slack incident with no linked ticket" },
};

export default async function SettingsPage() {
  const statuses = connectorStatuses();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="pl-[240px]">
        <TopBar />
        <div className="px-8 py-7 max-w-[900px]">
          <header className="mb-7">
            <p className="text-[12px] uppercase tracking-wider text-ink-dim font-semibold mb-1.5">Settings</p>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Integrations</h1>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              Connect the tools OpsCanvas listens to. All sources are read-only and configured via environment variables.
            </p>
          </header>

          <div className="space-y-3">
            {statuses.map((s) => {
              const m = meta[s.name] ?? meta.mock;
              return (
                <div
                  key={s.name}
                  className="group rounded-xl bg-surface/60 ring-1 ring-inset ring-border hover:ring-border-strong p-5 transition-all card-lift"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-11 w-11 rounded-lg bg-bg/60 ring-1 ring-border inline-flex items-center justify-center">
                        <m.Icon size={18} className={m.color} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[14px] font-semibold text-ink">{m.name}</h3>
                          {s.enabled ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full bg-state-stable/10 text-state-stable ring-1 ring-state-stable/25">
                              <Check size={9} /> Connected
                            </span>
                          ) : (
                            <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-full bg-state-watch/10 text-state-watch ring-1 ring-state-watch/25">
                              Not configured
                            </span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-ink-dim mt-0.5">
                          {s.enabled ? "Active in ingestion pipeline" : (s.reason ?? m.envHint)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-ink-dim">{s.name}</span>
                  </div>
                </div>
              );
            })}

            <div className="w-full rounded-xl border border-dashed border-border bg-transparent p-5 text-center">
              <div className="flex items-center justify-center gap-2 text-[13px] text-ink-dim">
                <Plus size={14} />
                Linear, GitLab, PagerDuty connectors — coming soon
              </div>
            </div>
          </div>

          <section className="mt-10">
            <h2 className="text-[12px] uppercase tracking-[0.12em] text-ink font-semibold mb-3">Signal rules</h2>
            <div className="rounded-xl bg-surface/60 ring-1 ring-inset ring-border divide-y divide-border/60">
              {rules.map((r) => {
                const d = ruleDetail[r.id] ?? { name: r.id, threshold: "" };
                return (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <div className="text-[13px] text-ink">{d.name}</div>
                      <div className="text-[11px] font-mono text-ink-dim">{d.threshold}</div>
                    </div>
                    <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-state-stable/10 text-state-stable ring-1 ring-state-stable/25">
                      On
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-[12px] uppercase tracking-[0.12em] text-ink font-semibold mb-3">Environment</h2>
            <div className="rounded-xl bg-surface/60 ring-1 ring-inset ring-border p-5 font-mono text-[11.5px] text-ink-muted space-y-1">
              <div># Add these to .env.local to enable real data</div>
              <div className="text-ink-dim">GITHUB_TOKEN=ghp_xxx</div>
              <div className="text-ink-dim">JIRA_HOST=your-domain.atlassian.net</div>
              <div className="text-ink-dim">JIRA_EMAIL=you@example.com</div>
              <div className="text-ink-dim">JIRA_API_TOKEN=xxx</div>
              <div className="text-ink-dim">SLACK_BOT_TOKEN=xoxb-xxx</div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
