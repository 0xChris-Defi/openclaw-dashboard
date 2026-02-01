import * as fs from 'fs/promises';
import { gatewayProcessManager } from './gatewayProcessManager';
import {
  insertWebhookStatusLog,
  getGatewaySetting,
  getRecentRestartAttempts,
  insertGatewayRestartLog,
  getTelegramBotToken,
} from '../db';
import { notifyOwner } from '../_core/notification';

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  ip_address?: string;
}

interface TelegramWebhookResponse {
  ok: boolean;
  result: WebhookInfo;
}

class WebhookPollerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly CONFIG_PATH = '/home/ubuntu/.openclaw/openclaw.json';

  /**
   * Start the webhook polling service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[WebhookPoller] Already running');
      return;
    }

    console.log('[WebhookPoller] Starting...');
    this.isRunning = true;

    // Get check interval from settings (default 5 minutes)
    const intervalSeconds = parseInt(await getGatewaySetting('webhook_check_interval', '300') || '300', 10);
    
    // Run first check immediately
    await this.checkAndRestart();

    // Schedule periodic checks
    this.intervalId = setInterval(async () => {
      await this.checkAndRestart();
    }, intervalSeconds * 1000);

    console.log(`[WebhookPoller] Started with interval ${intervalSeconds}s`);
  }

  /**
   * Stop the webhook polling service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[WebhookPoller] Stopped');
  }

  /**
   * Check webhook status and restart if necessary
   */
  async checkAndRestart(): Promise<void> {
    try {
      console.log('[WebhookPoller] Checking webhook status...');

      const startTime = Date.now();
      const webhookStatus = await this.checkWebhookStatus();
      const responseTime = Date.now() - startTime;

      // Log the check result
      await insertWebhookStatusLog({
        checkTimestamp: Date.now(),
        webhookUrl: webhookStatus.url || null,
        isActive: webhookStatus.isActive,
        pendingUpdateCount: webhookStatus.pendingUpdateCount,
        lastErrorDate: webhookStatus.lastErrorDate || null,
        lastErrorMessage: webhookStatus.lastErrorMessage || null,
        responseTimeMs: responseTime,
        actionTaken: 'none',
      });

      // Check if webhook is inactive
      if (!webhookStatus.isActive) {
        console.log('[WebhookPoller] Webhook is inactive, checking if auto-restart is enabled...');

        const autoRestartEnabled = (await getGatewaySetting('auto_restart_enabled', 'true')) === 'true';
        
        if (!autoRestartEnabled) {
          console.log('[WebhookPoller] Auto-restart is disabled');
          return;
        }

        // Check recent restart attempts (rate limiting)
        const recentAttempts = await getRecentRestartAttempts(5);
        const maxAttempts = parseInt(await getGatewaySetting('max_restart_attempts', '3') || '3', 10);

        if (recentAttempts >= maxAttempts) {
          console.log(`[WebhookPoller] Too many restart attempts (${recentAttempts}/${maxAttempts}), sending alert`);
          
          // Send alert to owner
          await notifyOwner({
            title: 'Gateway Webhook 持续失败',
            content: `Webhook 检查失败，已尝试重启 ${recentAttempts} 次，仍然失败。请手动检查 Gateway 状态。`,
          });

          // Update log with alert action
          await insertWebhookStatusLog({
            checkTimestamp: Date.now(),
            webhookUrl: webhookStatus.url || null,
            isActive: false,
            pendingUpdateCount: webhookStatus.pendingUpdateCount,
            lastErrorDate: webhookStatus.lastErrorDate || null,
            lastErrorMessage: 'Max restart attempts reached',
            responseTimeMs: 0,
            actionTaken: 'alert',
          });

          return;
        }

        // Attempt restart
        console.log('[WebhookPoller] Attempting to restart Gateway...');
        
        let restartResult;
        try {
          restartResult = await gatewayProcessManager.restart('webhook_check');
        } catch (restartError) {
          console.error('[WebhookPoller] Gateway restart threw error:', restartError);
          restartResult = {
            success: false,
            oldPid: null,
            newPid: null,
            duration: 0,
            message: 'Gateway restart failed',
            error: String(restartError),
          };
        }

        // Log the restart attempt
        await insertGatewayRestartLog({
          triggerType: 'webhook_check',
          triggerUserId: null,
          reason: `Webhook inactive: ${webhookStatus.lastErrorMessage || 'No error message'}`,
          oldPid: restartResult.oldPid || null,
          newPid: restartResult.newPid || null,
          success: restartResult.success,
          errorMessage: restartResult.error || null,
          durationMs: restartResult.duration,
        });

        if (restartResult.success) {
          console.log('[WebhookPoller] Gateway restarted successfully, resetting webhook...');
          
          // Wait for Gateway to fully start
          await new Promise(resolve => setTimeout(resolve, 5000));

          // Reset webhook to production URL
          await this.resetWebhook();

          // Update log with restart action
          await insertWebhookStatusLog({
            checkTimestamp: Date.now(),
            webhookUrl: webhookStatus.url || null,
            isActive: false,
            pendingUpdateCount: webhookStatus.pendingUpdateCount,
            lastErrorDate: webhookStatus.lastErrorDate || null,
            lastErrorMessage: 'Restarted Gateway',
            responseTimeMs: restartResult.duration,
            actionTaken: 'restart',
          });
        } else {
          console.error('[WebhookPoller] Failed to restart Gateway:', restartResult.message);
        }
      } else {
        console.log('[WebhookPoller] Webhook is active and healthy');
      }
    } catch (error) {
      console.error('[WebhookPoller] Error in check and restart:', error);
    }
  }

  /**
   * Check Telegram webhook status
   */
  private async checkWebhookStatus(): Promise<{
    isActive: boolean;
    url: string | null;
    pendingUpdateCount: number;
    lastErrorDate?: number;
    lastErrorMessage?: string;
  }> {
    try {
      const botToken = await this.getBotToken();
      
      if (!botToken) {
        console.error('[WebhookPoller] Bot token not found in config');
        return {
          isActive: false,
          url: null,
          pendingUpdateCount: 0,
          lastErrorMessage: 'Bot token not configured',
        };
      }

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getWebhookInfo`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }

      const data: TelegramWebhookResponse = await response.json();

      if (!data.ok) {
        throw new Error('Telegram API returned ok: false');
      }

      const info = data.result;

      // Webhook is considered active if:
      // 1. URL is set
      // 2. No recent errors OR pending updates are being processed
      const isActive = !!(info.url && (!info.last_error_date || info.pending_update_count === 0));

      return {
        isActive,
        url: info.url || null,
        pendingUpdateCount: info.pending_update_count || 0,
        lastErrorDate: info.last_error_date,
        lastErrorMessage: info.last_error_message,
      };
    } catch (error) {
      console.error('[WebhookPoller] Error checking webhook status:', error);
      return {
        isActive: false,
        url: null,
        pendingUpdateCount: 0,
        lastErrorMessage: String(error),
      };
    }
  }

  /**
   * Apply webhook - set Telegram webhook to production URL
   * This is a public method that can be called from the API
   */
  async applyWebhook(): Promise<{ success: boolean; message: string; url?: string }> {
    try {
      const productionUrl = await getGatewaySetting('production_webhook_url');
      
      if (!productionUrl) {
        return {
          success: false,
          message: 'Production webhook URL not configured. Please set it first.',
        };
      }

      const botToken = await this.getBotToken();
      
      if (!botToken) {
        return {
          success: false,
          message: 'Bot token not found in config. Please configure Telegram channel first.',
        };
      }

      console.log(`[WebhookPoller] Applying webhook to: ${productionUrl}`);

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: productionUrl }),
        }
      );

      if (!response.ok) {
        return {
          success: false,
          message: `Telegram API error: ${response.statusText}`,
        };
      }

      const data = await response.json();
      
      if (data.ok) {
        console.log('[WebhookPoller] Webhook applied successfully');
        return {
          success: true,
          message: 'Webhook applied successfully',
          url: productionUrl,
        };
      } else {
        return {
          success: false,
          message: `Telegram API error: ${data.description || 'Unknown error'}`,
        };
      }
    } catch (error) {
      console.error('[WebhookPoller] Error applying webhook:', error);
      return {
        success: false,
        message: String(error),
      };
    }
  }

  /**
   * Reset webhook to production URL (internal use)
   */
  private async resetWebhook(): Promise<void> {
    try {
      const productionUrl = await getGatewaySetting('production_webhook_url');
      
      if (!productionUrl) {
        console.warn('[WebhookPoller] Production webhook URL not configured');
        return;
      }

      const botToken = await this.getBotToken();
      
      if (!botToken) {
        console.error('[WebhookPoller] Bot token not found in config');
        return;
      }

      console.log(`[WebhookPoller] Setting webhook to: ${productionUrl}`);

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: productionUrl }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to set webhook: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.ok) {
        console.log('[WebhookPoller] Webhook set successfully');
      } else {
        console.error('[WebhookPoller] Failed to set webhook:', data);
      }
    } catch (error) {
      console.error('[WebhookPoller] Error resetting webhook:', error);
    }
  }

  /**
   * Delete webhook - remove Telegram webhook to allow getUpdates polling
   * This is a public method that can be called from the API
   */
  async deleteWebhook(): Promise<{ success: boolean; message: string }> {
    try {
      const botToken = await this.getBotToken();
      
      if (!botToken) {
        return {
          success: false,
          message: 'Bot token not found in config. Please configure Telegram channel first.',
        };
      }

      console.log('[WebhookPoller] Deleting webhook...');

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/deleteWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drop_pending_updates: false }),
        }
      );

      if (!response.ok) {
        return {
          success: false,
          message: `Telegram API error: ${response.statusText}`,
        };
      }

      const data = await response.json();
      
      if (data.ok) {
        console.log('[WebhookPoller] Webhook deleted successfully');
        return {
          success: true,
          message: 'Webhook deleted successfully. Gateway can now use getUpdates polling.',
        };
      } else {
        return {
          success: false,
          message: `Telegram API error: ${data.description || 'Unknown error'}`,
        };
      }
    } catch (error) {
      console.error('[WebhookPoller] Error deleting webhook:', error);
      return {
        success: false,
        message: String(error),
      };
    }
  }

  /**
   * Get bot token from database channel configs
   */
  private async getBotToken(): Promise<string | null> {
    try {
      const botToken = await getTelegramBotToken();
      if (!botToken) {
        console.warn('[WebhookPoller] Bot token not found in channel configs');
        return null;
      }
      return botToken;
    } catch (error) {
      console.error('[WebhookPoller] Error reading bot token from database:', error);
      return null;
    }
  }
}

// Export singleton instance
export const webhookPoller = new WebhookPollerService();
