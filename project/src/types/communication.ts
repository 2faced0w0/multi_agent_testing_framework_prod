export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'offline';

export interface AgentIdentifier {
  type: string;
  instanceId: string;
  nodeId: string;
}

export interface AgentMessage {
  id: string;
  source: AgentIdentifier;
  target: { type: string };
  timestamp: Date;
  messageType: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  payload: unknown;
}

export interface SystemEvent {
  eventId: string;
  eventType: string;
  version: string;
  source: {
    service: string;
    component: string;
    instance?: string;
    version?: string;
  };
  timestamp: Date;
  data: unknown;
  tags?: string[];
  severity?: 'info' | 'warn' | 'error';
  category?: 'system' | 'business' | 'security' | 'performance';
}
