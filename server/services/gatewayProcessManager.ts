import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface GatewayStatus {
  status: 'running' | 'stopped' | 'error';
  pid: number | null;
  port: number;
  uptime: number; // seconds
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
  lastRestart: number | null; // timestamp
}

export interface RestartResult {
  success: boolean;
  oldPid: number | null;
  newPid: number | null;
  duration: number; // milliseconds
  message: string;
  error?: string;
}

class GatewayProcessManager {
  private readonly GATEWAY_PATH = '/home/ubuntu/openclaw';
  private readonly PID_FILE = '/tmp/openclaw/gateway.pid';
  private readonly LOG_FILE = '/tmp/openclaw/openclaw.log';
  private readonly DEFAULT_PORT = 18789;
  private readonly STARTUP_TIMEOUT = 30000; // 30 seconds
  private readonly SHUTDOWN_TIMEOUT = 10000; // 10 seconds

  /**
   * Get current Gateway process status
   */
  async getStatus(): Promise<GatewayStatus> {
    try {
      const pid = await this.getCurrentPid();
      
      if (!pid) {
        return {
          status: 'stopped',
          pid: null,
          port: this.DEFAULT_PORT,
          uptime: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          lastRestart: null,
        };
      }

      // Check if process is actually running
      const isRunning = await this.isProcessRunning(pid);
      if (!isRunning) {
        await this.clearPidFile();
        return {
          status: 'stopped',
          pid: null,
          port: this.DEFAULT_PORT,
          uptime: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          lastRestart: null,
        };
      }

      // Get process metrics
      const metrics = await this.getProcessMetrics(pid);
      
      return {
        status: 'running',
        pid,
        port: this.DEFAULT_PORT,
        uptime: metrics.uptime,
        cpuUsage: metrics.cpuUsage,
        memoryUsage: metrics.memoryUsage,
        lastRestart: null, // Will be populated from database
      };
    } catch (error) {
      console.error('[GatewayProcessManager] Error getting status:', error);
      return {
        status: 'error',
        pid: null,
        port: this.DEFAULT_PORT,
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        lastRestart: null,
      };
    }
  }

  /**
   * Start Gateway process
   */
  async start(): Promise<{ success: boolean; pid: number | null; message: string }> {
    try {
      // Check if already running
      const currentPid = await this.getCurrentPid();
      if (currentPid && await this.isProcessRunning(currentPid)) {
        return {
          success: false,
          pid: currentPid,
          message: `Gateway is already running with PID ${currentPid}`,
        };
      }

      console.log('[GatewayProcessManager] Starting Gateway...');

      // Ensure log directory exists
      await fs.mkdir(path.dirname(this.LOG_FILE), { recursive: true });

      // Start the process
      const childProcess = spawn('pnpm', ['openclaw', 'gateway'], {
        cwd: this.GATEWAY_PATH,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Handle spawn errors
      childProcess.on('error', (err) => {
        console.error('[GatewayProcessManager] Spawn error:', err);
      });

      if (!childProcess.pid) {
        return {
          success: false,
          pid: null,
          message: 'Failed to spawn Gateway process',
        };
      }

      // Save PID
      await this.savePid(childProcess.pid);

      // Redirect stdout/stderr to log file
      const logStream = await fs.open(this.LOG_FILE, 'a');
      childProcess.stdout?.pipe(logStream.createWriteStream());
      childProcess.stderr?.pipe(logStream.createWriteStream());

      // Detach the process so it continues running
      childProcess.unref();

      // Wait for startup (check if port is listening)
      const started = await this.waitForStartup(childProcess.pid);
      
      if (!started) {
        await this.stop();
        return {
          success: false,
          pid: null,
          message: 'Gateway failed to start within timeout period',
        };
      }

      console.log(`[GatewayProcessManager] Gateway started with PID ${childProcess.pid}`);

      return {
        success: true,
        pid: childProcess.pid,
        message: `Gateway started successfully with PID ${childProcess.pid}`,
      };
    } catch (error) {
      console.error('[GatewayProcessManager] Error starting Gateway:', error);
      return {
        success: false,
        pid: null,
        message: `Failed to start Gateway: ${error}`,
      };
    }
  }

  /**
   * Stop Gateway process gracefully
   */
  async stop(): Promise<{ success: boolean; message: string }> {
    try {
      const pid = await this.getCurrentPid();
      
      if (!pid) {
        return {
          success: true,
          message: 'Gateway is not running',
        };
      }

      console.log(`[GatewayProcessManager] Stopping Gateway (PID ${pid})...`);

      // Send SIGTERM for graceful shutdown
      try {
        process.kill(pid, 'SIGTERM');
      } catch (error: any) {
        if (error.code === 'ESRCH') {
          // Process doesn't exist
          await this.clearPidFile();
          return {
            success: true,
            message: 'Gateway process was not running',
          };
        }
        throw error;
      }

      // Wait for graceful shutdown
      const stopped = await this.waitForShutdown(pid, this.SHUTDOWN_TIMEOUT);
      
      if (!stopped) {
        // Force kill if graceful shutdown failed
        console.log('[GatewayProcessManager] Graceful shutdown timeout, forcing kill...');
        try {
          process.kill(pid, 'SIGKILL');
        } catch (error: any) {
          if (error.code !== 'ESRCH') {
            throw error;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await this.clearPidFile();

      console.log('[GatewayProcessManager] Gateway stopped');

      return {
        success: true,
        message: 'Gateway stopped successfully',
      };
    } catch (error) {
      console.error('[GatewayProcessManager] Error stopping Gateway:', error);
      return {
        success: false,
        message: `Failed to stop Gateway: ${error}`,
      };
    }
  }

  /**
   * Restart Gateway process
   */
  async restart(reason?: string): Promise<RestartResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[GatewayProcessManager] Restarting Gateway (reason: ${reason || 'manual'})...`);

      const oldPid = await this.getCurrentPid();

      // Stop old process
      const stopResult = await this.stop();
      if (!stopResult.success) {
        return {
          success: false,
          oldPid,
          newPid: null,
          duration: Date.now() - startTime,
          message: 'Failed to stop old process',
          error: stopResult.message,
        };
      }

      // Wait a bit before starting new process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start new process
      const startResult = await this.start();
      
      const duration = Date.now() - startTime;

      if (!startResult.success) {
        return {
          success: false,
          oldPid,
          newPid: null,
          duration,
          message: 'Failed to start new process',
          error: startResult.message,
        };
      }

      // Verify new process is healthy
      await new Promise(resolve => setTimeout(resolve, 3000));
      const healthy = await this.healthCheck();
      
      if (!healthy) {
        return {
          success: false,
          oldPid,
          newPid: startResult.pid,
          duration,
          message: 'New process started but health check failed',
        };
      }

      console.log(`[GatewayProcessManager] Gateway restarted successfully (${duration}ms)`);

      return {
        success: true,
        oldPid,
        newPid: startResult.pid,
        duration,
        message: `Gateway restarted successfully in ${duration}ms`,
      };
    } catch (error) {
      console.error('[GatewayProcessManager] Error restarting Gateway:', error);
      return {
        success: false,
        oldPid: null,
        newPid: null,
        duration: Date.now() - startTime,
        message: 'Failed to restart Gateway',
        error: String(error),
      };
    }
  }

  /**
   * Perform health check on Gateway
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pid = await this.getCurrentPid();
      if (!pid || !(await this.isProcessRunning(pid))) {
        return false;
      }

      // Check if port is listening
      const portListening = await this.isPortListening(this.DEFAULT_PORT);
      if (!portListening) {
        return false;
      }

      // Try to connect to Gateway (optional: make HTTP request)
      // For now, just check process and port
      return true;
    } catch (error) {
      console.error('[GatewayProcessManager] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get Gateway logs
   */
  async getLogs(lines: number = 100, level?: 'all' | 'error' | 'warn' | 'info'): Promise<string[]> {
    try {
      const logContent = await fs.readFile(this.LOG_FILE, 'utf-8');
      const allLines = logContent.split('\n').filter(line => line.trim());
      
      let filteredLines = allLines;
      
      if (level && level !== 'all') {
        const levelPattern = new RegExp(`\\[${level}\\]`, 'i');
        filteredLines = allLines.filter(line => levelPattern.test(line));
      }

      return filteredLines.slice(-lines);
    } catch (error) {
      console.error('[GatewayProcessManager] Error reading logs:', error);
      return [];
    }
  }

  // Private helper methods

  private async getCurrentPid(): Promise<number | null> {
    try {
      // Try to read from PID file
      const pidContent = await fs.readFile(this.PID_FILE, 'utf-8');
      const pid = parseInt(pidContent.trim(), 10);
      return isNaN(pid) ? null : pid;
    } catch (error) {
      // PID file doesn't exist, try to find process
      try {
        const { stdout } = await execAsync('pgrep -f "openclaw.*gateway"');
        const pids = stdout.trim().split('\n').filter(Boolean);
        if (pids.length > 0) {
          const pid = parseInt(pids[pids.length - 1], 10); // Get the last one (actual gateway process)
          if (!isNaN(pid)) {
            await this.savePid(pid); // Save for future reference
            return pid;
          }
        }
      } catch (error) {
        // No process found
      }
      return null;
    }
  }

  private async savePid(pid: number): Promise<void> {
    await fs.mkdir(path.dirname(this.PID_FILE), { recursive: true });
    await fs.writeFile(this.PID_FILE, pid.toString(), 'utf-8');
  }

  private async clearPidFile(): Promise<void> {
    try {
      await fs.unlink(this.PID_FILE);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      // Send signal 0 to check if process exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getProcessMetrics(pid: number): Promise<{
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
  }> {
    try {
      const { stdout } = await execAsync(`ps -p ${pid} -o etimes,pcpu,rss --no-headers`);
      const [uptime, cpu, rss] = stdout.trim().split(/\s+/);
      
      return {
        uptime: parseInt(uptime, 10) || 0,
        cpuUsage: parseFloat(cpu) || 0,
        memoryUsage: parseInt(rss, 10) / 1024 || 0, // Convert KB to MB
      };
    } catch (error) {
      return { uptime: 0, cpuUsage: 0, memoryUsage: 0 };
    }
  }

  private async waitForStartup(pid: number): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.STARTUP_TIMEOUT) {
      // Check if process is still running
      if (!(await this.isProcessRunning(pid))) {
        return false;
      }

      // Check if port is listening
      if (await this.isPortListening(this.DEFAULT_PORT)) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }

  private async waitForShutdown(pid: number, timeout: number): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (!(await this.isProcessRunning(pid))) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return false;
  }

  private async isPortListening(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`lsof -i :${port} -t`);
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const gatewayProcessManager = new GatewayProcessManager();
