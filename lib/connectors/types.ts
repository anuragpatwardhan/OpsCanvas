import type { NormalizedEvent, Project } from "../types";

export interface Connector {
  name: string;
  enabled: () => boolean;
  fetchEvents: (projects: Project[]) => Promise<NormalizedEvent[]>;
}

export interface ConnectorStatus {
  name: string;
  enabled: boolean;
  reason?: string;
}
