/**
 * Monitoring & Safety Utilities
 * Provides metrics tracking, error logging, and remediation rules
 */

export type MetricType = "rpc_latency" | "rpc_error" | "queue_length" | "blocks_scanned" | "indexer_restarts";

interface Metric {
  type: MetricType;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Metric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics in memory

  record(type: MetricType, value: number, labels?: Record<string, string>) {
    this.metrics.push({ type, value, timestamp: Date.now(), labels });
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  getMetrics(type: MetricType, since?: number): Metric[] {
    const cutoff = since ?? Date.now() - 60 * 60 * 1000; // Last hour by default
    return this.metrics.filter((m) => m.type === type && m.timestamp >= cutoff);
  }

  getAverage(type: MetricType, since?: number): number {
    const metrics = this.getMetrics(type, since);
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }

  getRate(type: MetricType, since?: number): number {
    const metrics = this.getMetrics(type, since);
    if (metrics.length === 0) return 0;
    const duration = Date.now() - (since ?? Date.now() - 60 * 60 * 1000);
    return (metrics.length / duration) * 1000 * 60; // per minute
  }
}

export const metrics = new MetricsCollector();

/**
 * Remediation Rules
 * Automated responses to common issues
 */

export interface RemediationRule {
  condition: () => boolean;
  action: string;
  severity: "P0" | "P1" | "P2";
}

export const remediationRules: RemediationRule[] = [
  {
    condition: () => {
      const errorRate = metrics.getRate("rpc_error", Date.now() - 5 * 60 * 1000);
      return errorRate > 10; // More than 10 errors per minute
    },
    action: "Lower INDEXER_CONCURRENCY to 1 and increase BATCH_BLOCKS delay",
    severity: "P0",
  },
  {
    condition: () => {
      const avgLatency = metrics.getAverage("rpc_latency", Date.now() - 5 * 60 * 1000);
      return avgLatency > 5000; // Average RPC latency > 5s
    },
    action: "Switch to backup RPC provider or increase request timeout",
    severity: "P1",
  },
  {
    condition: () => {
      const queueLength = metrics.getMetrics("queue_length").slice(-1)[0]?.value ?? 0;
      return queueLength > 100; // Queue backed up
    },
    action: "Increase INDEXER_CONCURRENCY or reduce POLL_INTERVAL_MS",
    severity: "P1",
  },
  {
    condition: () => {
      const restarts = metrics.getMetrics("indexer_restarts", Date.now() - 60 * 60 * 1000);
      return restarts.length > 5; // More than 5 restarts in an hour
    },
    action: "Check for memory leaks or persistent RPC failures",
    severity: "P0",
  },
];

/**
 * Check and log remediation actions
 */
export function checkRemediations(): string[] {
  const triggered: string[] = [];
  for (const rule of remediationRules) {
    if (rule.condition()) {
      const msg = `[${rule.severity}] ${rule.action}`;
      triggered.push(msg);
      console.warn("Remediation rule triggered:", msg);
    }
  }
  return triggered;
}

/**
 * Health check utility
 */
export function getHealthStatus(): {
  healthy: boolean;
  metrics: {
    avgRpcLatency: number;
    rpcErrorRate: number;
    queueLength: number;
    blocksScanned: number;
  };
  remediations: string[];
} {
  const remediations = checkRemediations();
  const avgRpcLatency = metrics.getAverage("rpc_latency", Date.now() - 5 * 60 * 1000);
  const rpcErrorRate = metrics.getRate("rpc_error", Date.now() - 5 * 60 * 1000);
  const queueLength = metrics.getMetrics("queue_length").slice(-1)[0]?.value ?? 0;
  const blocksScanned = metrics.getMetrics("blocks_scanned").slice(-1)[0]?.value ?? 0;

  return {
    healthy: remediations.length === 0,
    metrics: {
      avgRpcLatency,
      rpcErrorRate,
      queueLength,
      blocksScanned,
    },
    remediations,
  };
}
