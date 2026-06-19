"use client";

import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import type { Project, ProjectSnapshot } from "@/lib/types";
import { StateChip } from "./ui/StateChip";
import { cn, relativeTime } from "@/lib/utils";

interface Props {
  project: Project;
  snapshot: ProjectSnapshot;
  index: number;
}

const accentClass = {
  stable: "accent-stable",
  watch: "accent-watch",
  risk: "accent-risk",
};

const trendIcon = {
  improving: TrendingUp,
  worsening: TrendingDown,
  flat: Minus,
};

const trendColor = {
  improving: "text-state-stable",
  worsening: "text-state-risk",
  flat: "text-ink-muted",
};

export function ProjectHealthCard({ project, snapshot, index }: Props) {
  const Trend = trendIcon[snapshot.trend];

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative rounded-xl bg-surface/60 ring-1 ring-inset ring-border p-5 card-lift",
        "hover:ring-border-accent hover:bg-surface",
        accentClass[snapshot.healthState]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-ink truncate">{project.name}</h3>
            <span className="text-[10.5px] font-mono text-ink-dim px-1.5 py-0.5 rounded bg-bg/60 ring-1 ring-border">
              {project.jiraKey}
            </span>
          </div>
          <div className="mt-1 text-[11.5px] text-ink-dim">owned by {project.owner}</div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <StateChip state={snapshot.healthState} pulse={snapshot.healthState === "risk"} />
          <Trend size={13} className={trendColor[snapshot.trend]} />
        </div>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
        <span className="text-ink">↳ </span>
        {snapshot.topReason}
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Stat label="Open PRs" value={snapshot.openPRs} />
        <Stat label="Review BL" value={snapshot.reviewBacklog} />
        <Stat label="Stale" value={snapshot.staleTickets} />
        <Stat label="Incidents" value={snapshot.activeIncidents} tone={snapshot.activeIncidents > 0 ? "risk" : "neutral"} />
      </div>

      <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <DeepLink label="Jira" href={`https://jira.acme.com/${project.jiraKey}`} />
          <DeepLink label="PRs"  href={`https://github.com/${project.githubRepo}/pulls`} />
          <DeepLink label="Slack" href={`https://acme.slack.com/channels/${project.slackChannel.slice(1)}`} />
        </div>
        <span className="text-[10.5px] font-mono text-ink-dim">{relativeTime(snapshot.generatedAt)}</span>
      </div>
    </motion.article>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "risk" }) {
  return (
    <div className="rounded-md bg-bg/40 ring-1 ring-inset ring-border/60 px-2 py-1.5">
      <div className={cn("text-[15px] font-semibold tabular-nums", tone === "risk" && value > 0 ? "text-state-risk" : "text-ink")}>
        {value}
      </div>
      <div className="text-[9.5px] uppercase tracking-wider text-ink-dim mt-0.5 font-medium">{label}</div>
    </div>
  );
}

function DeepLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group/link inline-flex items-center gap-1 px-2 py-1 -mx-1 rounded text-[11px] text-ink-dim hover:text-brand-glow hover:bg-brand/5 transition-colors"
    >
      {label}
      <ExternalLink size={9} className="opacity-0 group-hover/link:opacity-100 transition-opacity" />
    </a>
  );
}
