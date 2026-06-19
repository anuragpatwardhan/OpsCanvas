import { Github, MessageSquare, Layers } from "lucide-react";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

const cfg: Record<Source, { Icon: typeof Github; label: string; color: string }> = {
  github: { Icon: Github, label: "GitHub", color: "text-ink-muted" },
  jira:   { Icon: Layers, label: "Jira",   color: "text-accent-cyan" },
  slack:  { Icon: MessageSquare, label: "Slack", color: "text-brand-glow" },
};

export function SourceIcon({ source, size = 14, className }: { source: Source; size?: number; className?: string }) {
  const { Icon, color } = cfg[source];
  return <Icon size={size} className={cn(color, className)} aria-label={cfg[source].label} />;
}

export function sourceLabel(source: Source) {
  return cfg[source].label;
}
