export type Source = "github" | "jira" | "slack";
export type HealthState = "stable" | "watch" | "risk";
export type LoadState = "balanced" | "stretched" | "overloaded";
export type Severity = "info" | "watch" | "risk";
export type Trend = "improving" | "flat" | "worsening";

export interface Project {
  id: string;
  name: string;
  jiraKey: string;
  githubRepo: string;
  slackChannel: string;
  owner: string;
}

export interface NormalizedEvent {
  id: string;
  source: Source;
  type: string;
  projectId: string;
  timestamp: string;
  actor: string;
  refs: { ticketKey?: string; prNumber?: number; threadTs?: string };
  payload: Record<string, unknown>;
}

export interface Signal {
  id: string;
  projectId: string;
  severity: Severity;
  title: string;
  reason: string;
  evidence: string[];
  links: { label: string; href: string; source: Source }[];
  createdAt: string;
  suggestedAction?: string;
}

export interface ProjectSnapshot {
  projectId: string;
  generatedAt: string;
  healthState: HealthState;
  trend: Trend;
  topReason: string;
  openPRs: number;
  staleTickets: number;
  activeIncidents: number;
  reviewBacklog: number;
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  activeThreads: number;
  reviewsPending: number;
  incidentsTouched: number;
}

export interface TeamLoadSnapshot {
  state: LoadState;
  members: TeamMember[];
  averageThreads: number;
  reviewBacklog: number;
}

export interface ThreadEvent {
  id: string;
  source: Source;
  type: string;
  title: string;
  actor: string;
  timestamp: string;
  link?: string;
}

export interface WorkThread {
  id: string;
  projectId: string;
  title: string;
  status: "open" | "in_progress" | "resolved";
  events: ThreadEvent[];
}
