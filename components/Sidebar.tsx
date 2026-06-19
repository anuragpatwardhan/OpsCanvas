"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, GitBranch, AlertOctagon, Settings, Activity, BookOpen } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/",         label: "Canvas",   Icon: LayoutGrid },
  { href: "/signals",  label: "Signals",  Icon: AlertOctagon },
  { href: "/activity", label: "Activity", Icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] border-r border-border bg-bg-elevated/40 backdrop-blur-xl flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" className="block ring-brand rounded-md">
          <Logo size={26} />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                active
                  ? "bg-surface text-ink shadow-[inset_0_0_0_1px_rgba(124,92,255,0.18)]"
                  : "text-ink-muted hover:text-ink hover:bg-surface/60"
              )}
            >
              <Icon
                size={15}
                className={cn(
                  "transition-colors",
                  active ? "text-brand-glow" : "text-ink-dim group-hover:text-ink-muted"
                )}
              />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}

        <div className="px-2.5 pt-4 pb-1.5 text-[10px] uppercase tracking-wider text-ink-dim font-semibold">
          Browse
        </div>
        <Link
          href="/threads/t_chk_1207"
          className={cn(
            "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
            pathname.startsWith("/threads")
              ? "bg-surface text-ink shadow-[inset_0_0_0_1px_rgba(124,92,255,0.18)]"
              : "text-ink-muted hover:text-ink hover:bg-surface/60"
          )}
        >
          <GitBranch size={15} className="text-ink-dim group-hover:text-ink-muted" />
          <span className="flex-1">Threads</span>
        </Link>
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <Link
          href="/settings"
          className={cn(
            "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
            pathname === "/settings"
              ? "bg-surface text-ink"
              : "text-ink-muted hover:text-ink hover:bg-surface/60"
          )}
        >
          <Settings size={15} className="text-ink-dim group-hover:text-ink-muted" />
          Integrations
        </Link>

        <div className="mt-3 mx-2.5 p-2.5 rounded-lg bg-gradient-to-br from-brand/10 to-accent-cyan/5 ring-1 ring-brand/15">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Read-only</div>
          <div className="text-[11px] text-ink-dim mt-0.5 leading-snug">
            Execution stays in your tools. We only listen.
          </div>
        </div>
      </div>
    </aside>
  );
}
