import { cn } from "@/lib/utils";
import type { HealthState, Severity } from "@/lib/types";

const stateMap: Record<HealthState | Severity, { label: string; dot: string; text: string; ring: string; bg: string }> = {
  stable: { label: "Stable",  dot: "bg-state-stable", text: "text-state-stable", ring: "ring-state-stable/30", bg: "bg-state-stable/10" },
  watch:  { label: "Watch",   dot: "bg-state-watch",  text: "text-state-watch",  ring: "ring-state-watch/30",  bg: "bg-state-watch/10" },
  risk:   { label: "At Risk", dot: "bg-state-risk",   text: "text-state-risk",   ring: "ring-state-risk/30",   bg: "bg-state-risk/10" },
  info:   { label: "Info",    dot: "bg-ink-muted",    text: "text-ink-muted",    ring: "ring-ink-muted/20",    bg: "bg-surface-elevated" },
};

interface StateChipProps {
  state: HealthState | Severity;
  pulse?: boolean;
  label?: string;
  className?: string;
}

export function StateChip({ state, pulse = false, label, className }: StateChipProps) {
  const cfg = stateMap[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset",
        cfg.bg,
        cfg.text,
        cfg.ring,
        className
      )}
    >
      <span className={cn("relative h-1.5 w-1.5 rounded-full", cfg.dot)}>
        {pulse && state === "risk" && (
          <span className={cn("absolute inset-0 rounded-full pulse-risk")} />
        )}
      </span>
      {label ?? cfg.label}
    </span>
  );
}
