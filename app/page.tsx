"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { KpiStrip } from "@/components/KpiStrip";
import { ProjectHealthCard } from "@/components/ProjectHealthCard";
import { TeamLoadPanel } from "@/components/TeamLoadPanel";
import { AttentionSignals } from "@/components/AttentionSignals";
import { CardSkeleton, KpiSkeleton } from "@/components/Skeleton";
import type { Project, ProjectSnapshot, Signal, TeamLoadSnapshot } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

interface DashboardData {
  projects: Project[];
  snapshots: ProjectSnapshot[];
  signals: Signal[];
  teamLoad: TeamLoadSnapshot;
  lastSyncAt: string | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    const json = (await res.json()) as DashboardData;
    setData(json);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      await load();
    } finally {
      setSyncing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const snapshotByProject = new Map((data?.snapshots ?? []).map((s) => [s.projectId, s]));
  const orderedSignals = [...(data?.signals ?? [])].sort((a, b) => {
    const order = { risk: 0, watch: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen">
      <Sidebar />

      <main className="pl-[240px]">
        <TopBar lastSyncAt={data?.lastSyncAt} onSync={sync} syncing={syncing} />

        <div className="px-8 py-7 max-w-[1640px] mx-auto">
          <section className="mb-7">
            <div className="flex items-end justify-between mb-1">
              <div>
                <p className="text-[12px] uppercase tracking-wider text-ink-dim font-semibold mb-1.5">{dateLabel}</p>
                <h1 className="text-[26px] font-semibold tracking-tight text-ink">
                  Good morning, Anurag.{" "}
                  <span className="text-ink-muted font-normal">Here's where attention is needed.</span>
                </h1>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-ink-dim">
                  {data ? `Across ${data.projects.length} projects · ${data.teamLoad.members.length} engineers` : "loading…"}
                </div>
                <div className="text-[11px] font-mono text-ink-muted mt-0.5">
                  {data?.lastSyncAt ? `last sync ${relativeTime(data.lastSyncAt)}` : "never synced"}
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            {data ? (
              <KpiStrip snapshots={data.snapshots} signals={data.signals} />
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <KpiSkeleton key={i} />
                ))}
              </div>
            )}
          </section>

          <section className="mb-8">
            <SectionHeader
              title="Project Health"
              subtitle={data ? `${data.projects.length} projects · click any card to drill in` : ""}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {data
                ? data.projects.map((p, i) => {
                    const snap = snapshotByProject.get(p.id);
                    if (!snap) return null;
                    return <ProjectHealthCard key={p.id} project={p} snapshot={snap} index={i} />;
                  })
                : Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-[1fr_1.1fr] gap-3.5">
            <div>
              <SectionHeader title="Team Load" subtitle="threads + reviews carried per engineer" />
              {data ? (
                <TeamLoadPanel load={data.teamLoad} />
              ) : (
                <div className="rounded-xl bg-surface/40 ring-1 ring-inset ring-border p-5 h-[380px] shimmer" />
              )}
            </div>
            <div>
              <SectionHeader title="Attention" subtitle="ranked by severity with evidence" />
              {data ? (
                <AttentionSignals signals={orderedSignals} />
              ) : (
                <div className="rounded-xl bg-surface/40 ring-1 ring-inset ring-border h-[380px] shimmer" />
              )}
            </div>
          </section>

          <footer className="mt-10 pt-6 border-t border-border/60 flex items-center justify-between text-[11px] text-ink-dim">
            <span>OpsCanvas v0.1 · Read-only situational awareness</span>
            <span className="font-mono">events: {data?.signals.length ?? "—"} signals · last cycle {data?.lastSyncAt ? relativeTime(data.lastSyncAt) : "—"}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3.5">
      <h2 className="text-[12px] uppercase tracking-[0.12em] text-ink font-semibold">{title}</h2>
      <span className="text-[11px] text-ink-dim">{subtitle}</span>
    </div>
  );
}
