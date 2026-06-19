"use client";

import { Search, Command, RefreshCw, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { relativeTime, cn } from "@/lib/utils";

interface Props {
  lastSyncAt?: string | null;
  onSync?: () => void | Promise<void>;
  syncing?: boolean;
}

export function TopBar({ lastSyncAt, onSync, syncing = false }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((v) => v + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-bg/70 backdrop-blur-xl">
      <div className="h-full flex items-center gap-3 px-6">
        <div className="flex-1 max-w-md">
          <div className="group relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim group-focus-within:text-ink-muted transition-colors" />
            <input
              type="text"
              placeholder="Search projects, tickets, PRs…"
              className="w-full h-9 pl-9 pr-16 rounded-lg bg-surface/60 ring-1 ring-inset ring-border placeholder:text-ink-dim text-[13px] text-ink focus:outline-none focus:ring-brand/40 transition"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-bg ring-1 ring-border text-[10px] font-mono text-ink-dim">
              <Command size={9} /> K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-ink-dim px-2.5 py-1.5 rounded-md bg-surface/40 ring-1 ring-inset ring-border">
            <span className={cn("h-1.5 w-1.5 rounded-full bg-state-stable", syncing && "animate-pulse-dot")} />
            <span className="font-mono">{lastSyncAt ? `synced ${relativeTime(lastSyncAt)}` : "never synced"}</span>
          </div>

          <button
            onClick={() => onSync?.()}
            disabled={syncing}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface transition-colors disabled:opacity-50"
            aria-label="Sync now"
            title="Run ingestion cycle"
          >
            <RefreshCw size={14} className={cn(syncing && "animate-spin")} />
          </button>

          <button
            className="relative h-9 w-9 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface transition-colors"
            aria-label="Notifications"
          >
            <Bell size={14} />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-state-risk" />
          </button>

          <div className="h-6 w-px bg-border mx-1" />

          <button className="h-9 inline-flex items-center gap-2 pl-1 pr-3 rounded-md hover:bg-surface transition-colors">
            <span className="h-7 w-7 rounded-md bg-gradient-to-br from-brand to-accent-cyan inline-flex items-center justify-center text-[11px] font-semibold text-white">
              AP
            </span>
            <span className="text-[12px] font-medium text-ink hidden md:inline">Anurag</span>
          </button>
        </div>
      </div>
    </header>
  );
}
