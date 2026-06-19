"use client";

import { AlertTriangle, GitPullRequest, Timer, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";
import type { ProjectSnapshot, Signal } from "@/lib/types";

interface Kpi {
  label: string;
  value: number;
  delta: number;
  Icon: typeof AlertTriangle;
  tone: "risk" | "watch" | "stable" | "neutral";
  hint: string;
}

function deriveKpis(snapshots: ProjectSnapshot[], signals: Signal[]): Kpi[] {
  const atRisk = snapshots.filter((s) => s.healthState === "risk").length;
  const openPRs = snapshots.reduce((s, x) => s + x.openPRs, 0);
  const stale = snapshots.reduce((s, x) => s + x.staleTickets, 0);
  const incidents = snapshots.reduce((s, x) => s + x.activeIncidents, 0);
  const noReviewPRs = signals.filter((s) => s.title.toLowerCase().includes("review")).length;
  const incidentsMissingTicket = signals.filter((s) => s.title.toLowerCase().includes("incident")).length;

  return [
    { label: "At Risk projects", value: atRisk,    delta: 0, Icon: AlertTriangle,  tone: atRisk > 0 ? "risk" : "stable",     hint: atRisk > 0 ? "needs review today"  : "all clear" },
    { label: "Open PRs",         value: openPRs,   delta: 0, Icon: GitPullRequest, tone: noReviewPRs > 0 ? "watch" : "neutral", hint: `${noReviewPRs} without review` },
    { label: "Stale tickets",    value: stale,     delta: 0, Icon: Timer,          tone: stale > 0 ? "watch" : "stable",     hint: "> 5d in progress" },
    { label: "Active incidents", value: incidents, delta: 0, Icon: Zap,            tone: incidents > 0 ? "risk" : "stable",  hint: incidentsMissingTicket > 0 ? `${incidentsMissingTicket} missing follow-up` : "all linked" },
  ];
}

const toneRing: Record<Kpi["tone"], string> = {
  risk:    "ring-state-risk/25 hover:ring-state-risk/45 hover:shadow-[0_0_40px_-12px_rgba(255,92,92,0.35)]",
  watch:   "ring-state-watch/20 hover:ring-state-watch/40 hover:shadow-[0_0_40px_-12px_rgba(255,181,71,0.30)]",
  stable:  "ring-state-stable/20 hover:ring-state-stable/40 hover:shadow-[0_0_40px_-12px_rgba(34,214,130,0.30)]",
  neutral: "ring-border hover:ring-border-strong",
};

const toneIcon: Record<Kpi["tone"], string> = {
  risk:    "text-state-risk bg-state-risk/10",
  watch:   "text-state-watch bg-state-watch/10",
  stable:  "text-state-stable bg-state-stable/10",
  neutral: "text-ink-muted bg-surface",
};

export function KpiStrip({ snapshots, signals }: { snapshots: ProjectSnapshot[]; signals: Signal[] }) {
  const kpis = deriveKpis(snapshots, signals);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`group relative rounded-xl bg-surface/60 ring-1 ring-inset ${toneRing[k.tone]} p-4 card-lift overflow-hidden`}
        >
          <div className="absolute inset-0 bg-subtle-gradient opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-start justify-between">
            <div className={`h-8 w-8 rounded-lg ${toneIcon[k.tone]} inline-flex items-center justify-center`}>
              <k.Icon size={15} />
            </div>
            <Delta value={k.delta} />
          </div>
          <div className="relative mt-3">
            <div className="text-[28px] font-semibold tracking-tight tabular-nums text-ink">{k.value}</div>
            <div className="text-[12px] text-ink-muted mt-0.5">{k.label}</div>
            <div className="text-[10.5px] text-ink-dim mt-1.5">{k.hint}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-[10.5px] font-mono text-ink-dim">—</span>;
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const color = up ? "text-state-risk" : "text-state-stable";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-mono ${color}`}>
      <Icon size={11} />
      {Math.abs(value)}
    </span>
  );
}
