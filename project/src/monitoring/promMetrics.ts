// Prometheus metrics instrumentation
// Note: Ensure dependency 'prom-client' is installed.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import client from 'prom-client';

// Registry (each process has its own). Export register to /metrics.
export const register = new client.Registry();

// Default labels (can include instance id later)
register.setDefaultLabels({ app: 'matf' });
client.collectDefaultMetrics({ register, prefix: 'matf_process_' });

// Counters
export const httpRequestsTotal = new client.Counter({
  name: 'matf_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method','route','status'] as const
});
export const httpRequestErrorsTotal = new client.Counter({
  name: 'matf_http_request_errors_total',
  help: 'Total HTTP error responses (5xx)',
  labelNames: ['route'] as const
});
export const testsGeneratedTotal = new client.Counter({
  name: 'matf_tests_generated_total',
  help: 'Total tests generated'
});
export const testsExecutedTotal = new client.Counter({
  name: 'matf_tests_executed_total',
  help: 'Total tests executed partitioned by final status',
  labelNames: ['status'] as const
});
export const mqMessagesTotal = new client.Counter({
  name: 'matf_mq_messages_total',
  help: 'Message queue events by action',
  labelNames: ['action'] as const
});
export const executionStartsTotal = new client.Counter({
  name: 'matf_execution_starts_total',
  help: 'Executions started'
});
export const executionCompletionsTotal = new client.Counter({
  name: 'matf_execution_completions_total',
  help: 'Executions completed by status',
  labelNames: ['status'] as const
});
export const executionCancellationsTotal = new client.Counter({
  name: 'matf_execution_cancellations_total',
  help: 'Executions cancelled'
});

// Gauges
export const queueDepthGauge = new client.Gauge({
  name: 'matf_queue_depth',
  help: 'Current queue depth by queue',
  labelNames: ['queue'] as const
});
export const executionsRunningGauge = new client.Gauge({
  name: 'matf_executions_running',
  help: 'Currently running executions'
});
export const executionsQueuedGauge = new client.Gauge({
  name: 'matf_executions_queued',
  help: 'Currently queued executions'
});
export const agentUpGauge = new client.Gauge({
  name: 'matf_agent_up',
  help: 'Agent liveness by type',
  labelNames: ['agent'] as const
});

// Histograms
export const httpRequestDuration = new client.Histogram({
  name: 'matf_http_request_duration_seconds',
  help: 'HTTP request duration seconds',
  labelNames: ['method','route','status'] as const,
  buckets: [0.05,0.1,0.25,0.5,1,2,5]
});
export const executionDuration = new client.Histogram({
  name: 'matf_execution_duration_seconds',
  help: 'Execution duration seconds by status',
  labelNames: ['status'] as const,
  buckets: [1,5,10,30,60,120,300]
});
export const queueWaitDuration = new client.Histogram({
  name: 'matf_queue_wait_seconds',
  help: 'Time from enqueue to start',
  buckets: [0.5,1,2,5,10,30,60,120]
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestErrorsTotal);
register.registerMetric(testsGeneratedTotal);
register.registerMetric(testsExecutedTotal);
register.registerMetric(mqMessagesTotal);
register.registerMetric(executionStartsTotal);
register.registerMetric(executionCompletionsTotal);
register.registerMetric(executionCancellationsTotal);
register.registerMetric(queueDepthGauge);
register.registerMetric(executionsRunningGauge);
register.registerMetric(executionsQueuedGauge);
register.registerMetric(agentUpGauge);
register.registerMetric(httpRequestDuration);
register.registerMetric(executionDuration);
register.registerMetric(queueWaitDuration);

export function normalizeRoute(original: string): string {
  // Replace UUID-like path segments with {uuid} to reduce label cardinality
  try {
    return original.replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=\/|$)/g, '/{uuid}');
  } catch {
    return original;
  }
}
