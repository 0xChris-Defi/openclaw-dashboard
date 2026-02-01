import { gatewayProcessManager } from './gatewayProcessManager';
import { insertGatewayMonitor } from '../db';

class MetricsCollectorService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly COLLECTION_INTERVAL = 30000; // 30 seconds

  /**
   * Start collecting metrics
   */
  start(): void {
    if (this.isRunning) {
      console.log('[MetricsCollector] Already running');
      return;
    }

    console.log('[MetricsCollector] Starting...');
    this.isRunning = true;

    // Collect immediately
    this.collect();

    // Schedule periodic collection
    this.intervalId = setInterval(() => {
      this.collect();
    }, this.COLLECTION_INTERVAL);

    console.log(`[MetricsCollector] Started with interval ${this.COLLECTION_INTERVAL}ms`);
  }

  /**
   * Stop collecting metrics
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[MetricsCollector] Stopped');
  }

  /**
   * Collect current metrics and save to database
   */
  private async collect(): Promise<void> {
    try {
      const status = await gatewayProcessManager.getStatus();

      await insertGatewayMonitor({
        timestamp: Date.now(),
        status: status.status,
        pid: status.pid || null,
        cpuUsage: status.cpuUsage.toString(),
        memoryUsage: status.memoryUsage.toString(),
        uptime: status.uptime || null,
        requestCount: 0, // TODO: Implement request counting from logs
        errorCount: 0,   // TODO: Implement error counting from logs
      });

      console.log(`[MetricsCollector] Collected metrics: status=${status.status}, cpu=${status.cpuUsage}%, mem=${status.memoryUsage}MB`);
    } catch (error) {
      console.error('[MetricsCollector] Error collecting metrics:', error);
    }
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollectorService();
