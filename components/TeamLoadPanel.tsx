"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import type { TeamLoadSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

const stateConfig = {
  balanced:   { label: "Balanced",   color: "text-state-stable", bar: "from-state-stable to-state-stable/70", ring: "ring-state-stable/25", bg: "bg-state-stable/10" },
  stretched:  { label: "Stretched",  color: "text-state-watch",  bar: "from-state-watch to-state-watch/70",   ring: "ring-state-watch/25",  bg: "bg-state-watch/10" },
  overloaded: { label: "Overloaded", color: "text-state-risk",   bar: "from-state-risk to-state-risk/70",     ring: "ring-state-risk/25",   bg: "bg-state-risk/10" },
};

export function TeamLoadPanel({ load }: { load: TeamLoadSnapshot }) {
  const cfg = stateConfig[load.state];
  const max = Math.max(...load.members.map((m) => m.activeThreads + m.reviewsPending));

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl bg-surface/60 ring-1 ring-inset ring-border p-5"
    >
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-brand/10 ring-1 ring-brand/20 inline-flex items-center justify-center">
            <Users size={13} className="text-brand-glow" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-ink">Team Load</h2>
            <p className="text-[11px] text-ink-dim">{load.members.length} engineers · avg {load.averageThreads} threads/person</p>
          </div>
        </div>
        <span className={cn("text-[11px] font-medium px-2 py-1 rounded-full ring-1 ring-inset", cfg.color, cfg.ring, cfg.bg)}>
          {cfg.label}
        </span>
      </header>

      <div className="space-y-2.5">
        {load.members.map((m, i) => {
          const total = m.activeThreads + m.reviewsPending;
          const pct = Math.round((total / max) * 100);
          const isHeavy = total >= 7;

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.35 }}
              className="group grid grid-cols-[28px_1fr_auto] items-center gap-3"
            >
              <div className={cn(
                "h-7 w-7 rounded-md inline-flex items-center justify-center text-[10.5px] font-semibold",
                "bg-gradient-to-br from-brand/30 to-accent-cyan/20 text-ink ring-1 ring-brand/20"
              )}>
                {m.initials}
              </div>

              <div className="min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-ink truncate">{m.name}</span>
                  <span className="text-[10.5px] font-mono text-ink-dim ml-2">
                    {m.activeThreads} · <span className="text-ink-muted">{m.reviewsPending}r</span>
                    {m.incidentsTouched > 0 && <span className="text-state-risk"> · {m.incidentsTouched}!</span>}
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-bg/60 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.2 + i * 0.04, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r",
                      isHeavy ? "from-state-risk to-state-risk/60" : total >= 5 ? "from-state-watch to-state-watch/60" : cfg.bar
                    )}
                  />
                </div>
              </div>

              <div className="text-[10.5px] font-mono text-ink-dim tabular-nums w-8 text-right">{total}</div>
            </motion.div>
          );
        })}
      </div>

      <footer className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[10.5px] text-ink-dim">
        <span className="font-mono">threads · reviews · incidents</span>
        <span>Review backlog: <span className="text-ink-muted font-mono">{load.reviewBacklog}</span></span>
      </footer>
    </motion.section>
  );
}
