"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import type { Signal } from "@/lib/types";
import { StateChip } from "./ui/StateChip";
import { SourceIcon } from "./ui/SourceIcon";
import { cn, relativeTime } from "@/lib/utils";

const filters = [
  { id: "all",   label: "All" },
  { id: "risk",  label: "At Risk" },
  { id: "watch", label: "Watch" },
  { id: "info",  label: "Info" },
] as const;

type FilterId = (typeof filters)[number]["id"];

export function AttentionSignals({ signals }: { signals: Signal[] }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const filtered = filter === "all" ? signals : signals.filter((s) => s.severity === filter);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl bg-surface/60 ring-1 ring-inset ring-border overflow-hidden"
    >
      <header className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-state-risk/10 ring-1 ring-state-risk/20 inline-flex items-center justify-center">
            <Sparkles size={13} className="text-state-risk" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-ink">Attention Signals</h2>
            <p className="text-[11px] text-ink-dim">{filtered.length} need a look</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-bg/60 ring-1 ring-border">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-2 py-1 text-[10.5px] font-medium rounded transition-colors",
                filter === f.id
                  ? "bg-surface text-ink shadow-[inset_0_0_0_1px_rgba(124,92,255,0.18)]"
                  : "text-ink-dim hover:text-ink-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="divide-y divide-border/40 max-h-[640px] overflow-y-auto">
        {filtered.map((s, i) => (
          <SignalRow key={s.id} signal={s} index={i} />
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-[12px] text-ink-dim">
            Nothing in this lane. Good news.
          </div>
        )}
      </div>
    </motion.section>
  );
}

function SignalRow({ signal, index }: { signal: Signal; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.3 }}
      className="group relative"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-3.5 hover:bg-surface/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <StateChip state={signal.severity} pulse={signal.severity === "risk"} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[13px] font-medium text-ink truncate">{signal.title}</h4>
              <span className="text-[10.5px] font-mono text-ink-dim shrink-0">{relativeTime(signal.createdAt)}</span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-ink-muted line-clamp-1">{signal.reason}</p>
          </div>

          <ChevronDown
            size={14}
            className={cn("mt-1 text-ink-dim transition-transform shrink-0", open && "rotate-180")}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pl-[60px] space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-dim font-semibold mb-1.5">Evidence</div>
                <ul className="space-y-1">
                  {signal.evidence.map((e, i) => (
                    <li key={i} className="text-[11.5px] text-ink-muted flex gap-2 leading-relaxed">
                      <span className="text-ink-dim mt-1.5 h-1 w-1 rounded-full bg-ink-dim shrink-0" />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {signal.suggestedAction && (
                <div className="rounded-md bg-brand/5 ring-1 ring-brand/15 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-brand-glow font-semibold mb-0.5">Suggested action</div>
                  <div className="text-[12px] text-ink">{signal.suggestedAction}</div>
                </div>
              )}

              {signal.links.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {signal.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg/60 ring-1 ring-border hover:ring-brand/30 hover:bg-brand/5 text-[11px] text-ink-muted hover:text-ink transition-colors"
                    >
                      <SourceIcon source={l.source} size={11} />
                      {l.label}
                      <ExternalLink size={9} className="opacity-50" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
