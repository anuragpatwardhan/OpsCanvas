"use client";

import { motion } from "framer-motion";
import type { WorkThread } from "@/lib/types";
import { SourceIcon, sourceLabel } from "./ui/SourceIcon";
import { relativeTime } from "@/lib/utils";

const typeLabel: Record<string, string> = {
  ticket_created:   "Ticket created",
  status_change:    "Status change",
  pr_opened:        "PR opened",
  pr_stale:         "PR stalled",
  thread_started:   "Slack thread",
  review_requested: "Review requested",
  decision_logged:  "Decision recorded",
};

export function ThreadTimeline({ thread }: { thread: WorkThread }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-[10px] top-2 bottom-2 w-px bg-gradient-to-b from-brand/40 via-border to-transparent" />
      <div className="space-y-5">
        {thread.events.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <span className="absolute -left-[22px] top-0.5 h-4 w-4 rounded-full bg-bg ring-2 ring-border inline-flex items-center justify-center">
              <SourceIcon source={e.source} size={9} />
            </span>

            <div className="rounded-lg bg-surface/50 ring-1 ring-inset ring-border px-4 py-3 hover:ring-border-strong transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-dim">
                  {sourceLabel(e.source)} · {typeLabel[e.type] ?? e.type}
                </div>
                <span className="text-[10.5px] font-mono text-ink-dim">{relativeTime(e.timestamp)}</span>
              </div>
              <div className="mt-1 text-[13px] text-ink">{e.title}</div>
              <div className="mt-1.5 text-[11px] text-ink-dim">by @{e.actor}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
