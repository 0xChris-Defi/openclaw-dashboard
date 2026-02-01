import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { encryptConfig, decryptConfig, maskConfig } from "./crypto";
import { testChannelConnection } from "./channel-testers";
import { testModelConnection } from "./model-testers";

// Channel type enum values
const channelTypes = ["telegram", "discord", "slack", "whatsapp", "feishu", "lark", "imessage", "wechat", "custom"] as const;

// Model provider enum values
const modelProviders = ["openai", "anthropic", "openrouter", "google", "minimax", "deepseek", "moonshot", "zhipu", "baichuan", "qwen", "custom"] as const;

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // Admin password login (for testing)
    adminLogin: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { username, password } = input;
        
        // Hardcoded admin credentials for testing
        if (username !== 'admin' || password !== 'admin') {
          throw new Error("Invalid username or password");
        }

        // Create or get admin user
        const adminOpenId = 'admin-local-user';
        await db.upsertUser({
          openId: adminOpenId,
          name: 'Admin',
          loginMethod: 'password',
          role: 'admin',
          lastSignedIn: new Date(),
        });

        const user = await db.getUserByOpenId(adminOpenId);
        if (!user) {
          throw new Error("Failed to create admin user");
        }

        const sessionToken = await sdk.createSessionToken(adminOpenId, {
          name: 'Admin',
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
          },
        };
      }),

    // Wallet-based authentication
    walletLogin: publicProcedure
      .input(z.object({
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
        signature: z.string().optional(),
        message: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { walletAddress } = input;
        
        const user = await db.upsertUserByWallet(walletAddress);
        
        if (!user) {
          throw new Error("Failed to create or update user");
        }

        if (user.role !== 'admin') {
          throw new Error("Access denied. Only administrators can access this dashboard.");
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            walletAddress: user.walletAddress,
            role: user.role,
          },
        };
      }),
  }),

  // ============ Channel Configuration API ============
  channels: router({
    // List all channel configs for current user
    list: adminProcedure.query(async ({ ctx }) => {
      const configs = await db.getChannelConfigs(ctx.user!.id);
      // Mask sensitive data for frontend display
      return configs.map(c => ({
        ...c,
        config: c.config ? maskConfig(c.config as Record<string, unknown>) : null,
      }));
    }),

    // Get a single channel config
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const config = await db.getChannelConfigById(input.id);
        if (!config) return null;
        return {
          ...config,
          config: config.config ? maskConfig(config.config as Record<string, unknown>) : null,
        };
      }),

    // Create a new channel config
    create: adminProcedure
      .input(z.object({
        channelType: z.enum(channelTypes),
        name: z.string().min(1).max(100),
        config: z.record(z.string(), z.unknown()),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const encryptedConfig = encryptConfig(input.config);
        const newConfig = await db.createChannelConfig({
          userId: ctx.user!.id,
          channelType: input.channelType,
          name: input.name,
          config: encryptedConfig,
          enabled: input.enabled ?? false,
        });
        return newConfig;
      }),

    // Update a channel config
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.enabled !== undefined) updates.enabled = input.enabled;
        if (input.config !== undefined) {
          updates.config = encryptConfig(input.config);
        }
        const updated = await db.updateChannelConfig(input.id, updates);
        return updated;
      }),

    // Delete a channel config
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteChannelConfig(input.id);
        return { success: true };
      }),

    // Test channel connection
    test: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const config = await db.getChannelConfigById(input.id);
        if (!config) {
          throw new Error("Channel config not found");
        }

        // Decrypt config for testing
        const decryptedConfig = config.config 
          ? decryptConfig(config.config as Record<string, unknown>) 
          : {};

        // Run the test
        const result = await testChannelConnection(config.channelType, decryptedConfig);

        // Update test status in database
        await db.updateChannelTestStatus(
          input.id,
          result.success ? 'success' : 'failed',
          result.message
        );

        return result;
      }),

    // Test channel connection with provided config (before saving)
    testWithConfig: adminProcedure
      .input(z.object({
        channelType: z.enum(channelTypes),
        config: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ input }) => {
        const result = await testChannelConnection(input.channelType, input.config);
        return result;
      }),

    // Sync channel to OpenClaw Gateway
    syncToGateway: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const config = await db.getChannelConfigById(input.id);
        if (!config) {
          throw new Error("Channel config not found");
        }

        // Decrypt config
        const decryptedConfig = config.config 
          ? decryptConfig(config.config as Record<string, unknown>) 
          : {};

        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const os = await import('os');
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);

          const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
          const configContent = await fs.readFile(configPath, 'utf-8');
          const openclawConfig = JSON.parse(configContent);

          // Ensure channels structure exists
          if (!openclawConfig.channels) openclawConfig.channels = {};
          if (!openclawConfig.channels[config.channelType]) {
            openclawConfig.channels[config.channelType] = {};
          }

          // Update channel config based on type
          const channelConfig = openclawConfig.channels[config.channelType];
          channelConfig.enabled = config.enabled;

          // Map config fields based on channel type
          switch (config.channelType) {
            case 'telegram':
              channelConfig.bot_token = decryptedConfig.botToken;
              channelConfig.dm_policy = decryptedConfig.dmPolicy || 'open';
              break;
            case 'discord':
              channelConfig.bot_token = decryptedConfig.botToken;
              channelConfig.application_id = decryptedConfig.applicationId;
              break;
            case 'slack':
              channelConfig.bot_token = decryptedConfig.botToken;
              channelConfig.app_token = decryptedConfig.appToken;
              channelConfig.signing_secret = decryptedConfig.signingSecret;
              break;
            // Add more channel types as needed
          }

          // Write back config
          await fs.writeFile(configPath, JSON.stringify(openclawConfig, null, 2), 'utf-8');

          // Restart gateway
          try {
            await execAsync(
              'pkill -f "openclaw-gateway" 2>/dev/null; sleep 1; cd /home/ubuntu/openclaw && nohup pnpm openclaw gateway --yes > /home/ubuntu/openclaw_gateway.log 2>&1 &',
              { timeout: 5000 }
            );
          } catch (e) {
            console.warn('Gateway restart warning:', e);
          }

          return { success: true };
        } catch (error) {
          console.error('Failed to sync channel to gateway:', error);
          throw new Error('Failed to sync channel configuration');
        }
      }),
  }),

  // ============ AI Model Configuration API ============
  aiModels: router({
    // List all model configs for current user
    list: adminProcedure.query(async ({ ctx }) => {
      const configs = await db.getModelConfigs(ctx.user!.id);
      return configs.map(c => ({
        ...c,
        config: c.config ? maskConfig(c.config as Record<string, unknown>) : null,
      }));
    }),

    // Get a single model config
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const config = await db.getModelConfigById(input.id);
        if (!config) return null;
        return {
          ...config,
          config: config.config ? maskConfig(config.config as Record<string, unknown>) : null,
        };
      }),

    // Create a new model config
    create: adminProcedure
      .input(z.object({
        provider: z.enum(modelProviders),
        name: z.string().min(1).max(100),
        config: z.record(z.string(), z.unknown()),
        enabled: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        selectedModel: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const encryptedConfig = encryptConfig(input.config);
        
        // If setting as default, unset others first
        if (input.isDefault) {
          const existingConfigs = await db.getModelConfigs(ctx.user!.id);
          for (const c of existingConfigs) {
            if (c.isDefault) {
              await db.updateModelConfig(c.id, { isDefault: false });
            }
          }
        }

        const newConfig = await db.createModelConfig({
          userId: ctx.user!.id,
          provider: input.provider,
          name: input.name,
          config: encryptedConfig,
          enabled: input.enabled ?? false,
          isDefault: input.isDefault ?? false,
          selectedModel: input.selectedModel,
        });
        return newConfig;
      }),

    // Update a model config
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        enabled: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        selectedModel: z.string().optional(),
        models: z.array(z.object({
          id: z.string(),
          name: z.string(),
          contextLength: z.number().optional(),
          inputPrice: z.number().optional(),
          outputPrice: z.number().optional(),
          capabilities: z.array(z.string()).optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.enabled !== undefined) updates.enabled = input.enabled;
        if (input.selectedModel !== undefined) updates.selectedModel = input.selectedModel;
        if (input.models !== undefined) updates.models = input.models;
        if (input.config !== undefined) {
          updates.config = encryptConfig(input.config);
        }
        
        // Handle isDefault
        if (input.isDefault) {
          await db.setDefaultModelConfig(ctx.user!.id, input.id);
        } else if (input.isDefault === false) {
          updates.isDefault = false;
        }

        const updated = await db.updateModelConfig(input.id, updates);
        return updated;
      }),

    // Delete a model config
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteModelConfig(input.id);
        return { success: true };
      }),

    // Set as default model
    setDefault: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.setDefaultModelConfig(ctx.user!.id, input.id);
        return { success: true };
      }),

    // Test model connection
    test: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const config = await db.getModelConfigById(input.id);
        if (!config) {
          throw new Error("Model config not found");
        }

        const decryptedConfig = config.config 
          ? decryptConfig(config.config as Record<string, unknown>) 
          : {};

        const result = await testModelConnection(config.provider, decryptedConfig);

        // Update test status and available models
        await db.updateModelTestStatus(
          input.id,
          result.success ? 'success' : 'failed',
          result.message,
          result.latency
        );

        // Update available models if test succeeded
        if (result.success && result.models) {
          await db.updateModelConfig(input.id, { models: result.models });
        }

        return result;
      }),

    // Test model connection with provided config (before saving)
    testWithConfig: adminProcedure
      .input(z.object({
        provider: z.enum(modelProviders),
        config: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ input }) => {
        const result = await testModelConnection(input.provider, input.config);
        return result;
      }),

    // Sync model to OpenClaw Gateway
    syncToGateway: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const config = await db.getModelConfigById(input.id);
        if (!config) {
          throw new Error("Model config not found");
        }

        const decryptedConfig = config.config 
          ? decryptConfig(config.config as Record<string, unknown>) 
          : {};

        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const os = await import('os');
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);

          const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
          const configContent = await fs.readFile(configPath, 'utf-8');
          const openclawConfig = JSON.parse(configContent);

          // Ensure providers structure exists
          if (!openclawConfig.providers) openclawConfig.providers = {};
          if (!openclawConfig.providers[config.provider]) {
            openclawConfig.providers[config.provider] = {};
          }

          // Update provider config
          const providerConfig = openclawConfig.providers[config.provider];
          providerConfig.api_key = decryptedConfig.apiKey;
          if (decryptedConfig.baseUrl) {
            providerConfig.base_url = decryptedConfig.baseUrl;
          }

          // If this is the default, update the default model
          if (config.isDefault && config.selectedModel) {
            if (!openclawConfig.agents) openclawConfig.agents = {};
            if (!openclawConfig.agents.defaults) openclawConfig.agents.defaults = {};
            if (!openclawConfig.agents.defaults.model) openclawConfig.agents.defaults.model = {};
            
            // Format model ID based on provider
            let modelId = config.selectedModel;
            if (config.provider === 'openrouter' && !modelId.startsWith('openrouter/')) {
              modelId = `openrouter/${modelId}`;
            }
            openclawConfig.agents.defaults.model.primary = modelId;
          }

          // Write back config
          await fs.writeFile(configPath, JSON.stringify(openclawConfig, null, 2), 'utf-8');

          // Restart gateway
          try {
            await execAsync(
              'pkill -f "openclaw-gateway" 2>/dev/null; sleep 1; cd /home/ubuntu/openclaw && nohup pnpm openclaw gateway --yes > /home/ubuntu/openclaw_gateway.log 2>&1 &',
              { timeout: 5000 }
            );
          } catch (e) {
            console.warn('Gateway restart warning:', e);
          }

          return { success: true };
        } catch (error) {
          console.error('Failed to sync model to gateway:', error);
          throw new Error('Failed to sync model configuration');
        }
      }),
  }),

  // Legacy model routes (for backward compatibility)
  models: router({
    getActive: protectedProcedure.query(async () => {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        
        const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        const modelId = config?.agents?.defaults?.model?.primary || 'openrouter/auto';
        return { modelId };
      } catch (error) {
        console.error('Failed to get active model:', error);
        return { modelId: 'openrouter/auto' };
      }
    }),

    setActive: protectedProcedure
      .input(z.object({
        modelId: z.string().min(1, "Model ID is required"),
      }))
      .mutation(async ({ input }) => {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const os = await import('os');
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
          const configContent = await fs.readFile(configPath, 'utf-8');
          const config = JSON.parse(configContent);
          
          if (!config.agents) config.agents = {};
          if (!config.agents.defaults) config.agents.defaults = {};
          if (!config.agents.defaults.model) config.agents.defaults.model = {};
          
          config.agents.defaults.model.primary = input.modelId;
          
          await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
          
          try {
            await execAsync(
              'pkill -f "openclaw-gateway" 2>/dev/null; sleep 1; cd /home/ubuntu/openclaw && nohup pnpm openclaw gateway --yes > /home/ubuntu/openclaw_gateway.log 2>&1 &',
              { timeout: 5000 }
            );
          } catch (restartError) {
            console.warn('Gateway restart warning:', restartError);
          }
          
          return { success: true, modelId: input.modelId };
        } catch (error) {
          console.error('Failed to set active model:', error);
          throw new Error('Failed to update model configuration');
        }
      }),

    listCustom: protectedProcedure.query(async ({ ctx }) => {
      const customModels = await db.getCustomModels(ctx.user!.id);
      return customModels;
    }),

    addCustom: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        provider: z.string().min(1),
        modelId: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const model = await db.addCustomModel(ctx.user!.id, input);
        return model;
      }),

    deleteCustom: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteCustomModel(ctx.user!.id, input.id);
        return { success: true };
      }),
  }),

  // ============ Telegram Access Control API ============
  telegram: router({
    // Get current Telegram config from OpenClaw
    getConfig: adminProcedure.query(async () => {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        
        const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        const telegramConfig = config.channels?.telegram || {};
        
        return {
          enabled: telegramConfig.enabled ?? false,
          dmPolicy: telegramConfig.dmPolicy || 'open',
          groupPolicy: telegramConfig.groupPolicy || 'allowlist',
          allowFrom: telegramConfig.allowFrom || [],
          botUsername: telegramConfig.botUsername || null,
        };
      } catch (error) {
        console.error('Failed to get Telegram config:', error);
        return {
          enabled: false,
          dmPolicy: 'open',
          groupPolicy: 'allowlist',
          allowFrom: [],
          botUsername: null,
        };
      }
    }),

    // Set DM policy
    setDmPolicy: adminProcedure
      .input(z.object({
        policy: z.enum(['open', 'pairing', 'allowlist', 'disabled']),
      }))
      .mutation(async ({ input }) => {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const os = await import('os');
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
          const configContent = await fs.readFile(configPath, 'utf-8');
          const config = JSON.parse(configContent);
          
          if (!config.channels) config.channels = {};
          if (!config.channels.telegram) config.channels.telegram = {};
          
          config.channels.telegram.dmPolicy = input.policy;
          
          // If switching to allowlist mode, ensure allowFrom is set
          if (input.policy === 'allowlist') {
            // Get users from database allowlist
            const allowlistUsers = await db.getTelegramAllowlist();
            config.channels.telegram.allowFrom = allowlistUsers.map(u => u.telegramUserId);
          } else if (input.policy === 'pairing') {
            // Get paired users
            const pairedUsers = await db.getActiveTelegramPairedUsers();
            config.channels.telegram.allowFrom = pairedUsers.map(u => u.telegramUserId);
          } else if (input.policy === 'open') {
            config.channels.telegram.allowFrom = ['*'];
          } else {
            config.channels.telegram.allowFrom = [];
          }
          
          await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
          
          // Restart gateway
          try {
            await execAsync(
              'pkill -f "openclaw-gateway" 2>/dev/null; sleep 1; cd /home/ubuntu/openclaw && nohup pnpm openclaw gateway > /home/ubuntu/openclaw_gateway.log 2>&1 &',
              { timeout: 5000 }
            );
          } catch (e) {
            console.warn('Gateway restart warning:', e);
          }
          
          return { success: true, policy: input.policy };
        } catch (error) {
          console.error('Failed to set DM policy:', error);
          throw new Error('Failed to update DM policy');
        }
      }),

    // Set group policy
    setGroupPolicy: adminProcedure
      .input(z.object({
        policy: z.enum(['open', 'allowlist', 'disabled']),
      }))
      .mutation(async ({ input }) => {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const os = await import('os');
          
          const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
          const configContent = await fs.readFile(configPath, 'utf-8');
          const config = JSON.parse(configContent);
          
          if (!config.channels) config.channels = {};
          if (!config.channels.telegram) config.channels.telegram = {};
          
          config.channels.telegram.groupPolicy = input.policy;
          
          await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
          
          return { success: true, policy: input.policy };
        } catch (error) {
          console.error('Failed to set group policy:', error);
          throw new Error('Failed to update group policy');
        }
      }),

    // ============ Pairing Codes ============
    
    // Generate a new pairing code
    generatePairingCode: adminProcedure
      .input(z.object({
        expiresInHours: z.number().min(1).max(168).default(24), // 1 hour to 7 days
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const crypto = await import('crypto');
        
        // Generate a random 8-character code
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        
        const expiresInHours = input?.expiresInHours ?? 24;
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        
        const pairingCode = await db.createTelegramPairingCode(
          code,
          expiresAt,
          ctx.user!.id
        );
        
        return pairingCode;
      }),

    // List all pairing codes
    listPairingCodes: adminProcedure.query(async () => {
      // First expire old codes
      await db.expireOldTelegramPairingCodes();
      
      const codes = await db.getTelegramPairingCodes();
      return codes;
    }),

    // Revoke a pairing code
    revokePairingCode: adminProcedure
      .input(z.object({ codeId: z.number() }))
      .mutation(async ({ input }) => {
        await db.revokeTelegramPairingCode(input.codeId);
        return { success: true };
      }),

    // ============ Paired Users ============
    
    // List all paired users
    listPairedUsers: adminProcedure.query(async () => {
      const users = await db.getTelegramPairedUsers();
      return users;
    }),

    // Manually add a paired user
    addPairedUser: adminProcedure
      .input(z.object({
        telegramUserId: z.string().min(1),
        telegramUsername: z.string().optional(),
        telegramName: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.addTelegramPairedUser({
          telegramUserId: input.telegramUserId,
          telegramUsername: input.telegramUsername,
          telegramName: input.telegramName,
          notes: input.notes,
          pairedBy: ctx.user!.id,
          status: 'active',
        });
        
        // Update OpenClaw config
        await syncPairedUsersToGateway();
        
        return user;
      }),

    // Revoke a paired user
    revokePairedUser: adminProcedure
      .input(z.object({ telegramUserId: z.string() }))
      .mutation(async ({ input }) => {
        await db.revokeTelegramPairedUser(input.telegramUserId);
        
        // Update OpenClaw config
        await syncPairedUsersToGateway();
        
        return { success: true };
      }),

    // Delete a paired user permanently
    deletePairedUser: adminProcedure
      .input(z.object({ telegramUserId: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteTelegramPairedUser(input.telegramUserId);
        
        // Update OpenClaw config
        await syncPairedUsersToGateway();
        
        return { success: true };
      }),

    // ============ Allowlist ============
    
    // List all allowlist users
    listAllowlist: adminProcedure.query(async () => {
      const users = await db.getTelegramAllowlist();
      return users;
    }),

    // Add user to allowlist
    addToAllowlist: adminProcedure
      .input(z.object({
        telegramUserId: z.string().min(1),
        telegramUsername: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.addToTelegramAllowlist({
          telegramUserId: input.telegramUserId,
          telegramUsername: input.telegramUsername,
          notes: input.notes,
          addedBy: ctx.user!.id,
        });
        
        // Update OpenClaw config if in allowlist mode
        await syncAllowlistToGateway();
        
        return user;
      }),

    // Remove user from allowlist
    removeFromAllowlist: adminProcedure
      .input(z.object({ telegramUserId: z.string() }))
      .mutation(async ({ input }) => {
        await db.removeFromTelegramAllowlist(input.telegramUserId);
        
        // Update OpenClaw config if in allowlist mode
        await syncAllowlistToGateway();
        
        return { success: true };
      }),

    // Batch import to allowlist
    batchImportAllowlist: adminProcedure
      .input(z.object({
        users: z.array(z.object({
          telegramUserId: z.string(),
          telegramUsername: z.string().optional(),
          notes: z.string().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const addedCount = await db.batchAddToTelegramAllowlist(input.users, ctx.user!.id);
        
        // Update OpenClaw config if in allowlist mode
        await syncAllowlistToGateway();
        
        return { success: true, addedCount };
      }),

    // Sync all access control to gateway
    syncToGateway: adminProcedure.mutation(async () => {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        const dmPolicy = config.channels?.telegram?.dmPolicy || 'open';
        
        // Update allowFrom based on current policy
        if (dmPolicy === 'allowlist') {
          const allowlistUsers = await db.getTelegramAllowlist();
          config.channels.telegram.allowFrom = allowlistUsers.map(u => u.telegramUserId);
        } else if (dmPolicy === 'pairing') {
          const pairedUsers = await db.getActiveTelegramPairedUsers();
          config.channels.telegram.allowFrom = pairedUsers.map(u => u.telegramUserId);
        }
        
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
        
        // Restart gateway
        try {
          await execAsync(
            'pkill -f "openclaw-gateway" 2>/dev/null; sleep 1; cd /home/ubuntu/openclaw && nohup pnpm openclaw gateway > /home/ubuntu/openclaw_gateway.log 2>&1 &',
            { timeout: 5000 }
          );
        } catch (e) {
          console.warn('Gateway restart warning:', e);
        }
        
        return { success: true };
      } catch (error) {
        console.error('Failed to sync to gateway:', error);
        throw new Error('Failed to sync access control to gateway');
      }
    }),
  }),

  // Admin routes for user management
  admin: router({
    listUsers: adminProcedure.query(async () => {
      const users = await db.getAllUsers();
      return users.map(u => ({
        id: u.id,
        openId: u.openId,
        name: u.name,
        email: u.email,
        walletAddress: u.walletAddress,
        loginMethod: u.loginMethod,
        role: u.role,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
      }));
    }),

    updateUserRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['user', 'admin']),
      }))
      .mutation(async ({ input }) => {
        const success = await db.updateUserRole(input.userId, input.role);
        return { success };
      }),
  }),

  // ============ Chatbox API ============
  chat: router({
    // List all chat sessions for current user
    listSessions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getChatSessions(ctx.user!.id);
    }),

    // Create a new chat session
    createSession: protectedProcedure
      .input(z.object({
        title: z.string().optional(),
        modelId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createChatSession({
          userId: ctx.user!.id,
          title: input.title,
          modelId: input.modelId,
        });
      }),

    // Delete a chat session
    deleteSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteChatSession(input.sessionId, ctx.user!.id);
        return { success: true };
      }),

    // Update session title
    updateSessionTitle: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        title: z.string().min(1).max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateChatSessionTitle(input.sessionId, ctx.user!.id, input.title);
        return { success: true };
      }),

    // Get messages for a session
    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getChatMessages(input.sessionId, ctx.user!.id);
      }),

    // Send a message and get AI response
    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        content: z.string().min(1),
        modelId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { sessionId, content, modelId } = input;
        
        // Add user message to database
        const userMessage = await db.addChatMessage({
          sessionId,
          role: 'user',
          content,
        });

        // Get conversation history
        const messages = await db.getChatMessages(sessionId, ctx.user!.id);
        
        // Get model config to use
        const modelConfig = modelId 
          ? await db.getModelConfigById(parseInt(modelId))
          : await db.getDefaultModelConfig(ctx.user!.id);

        // Prepare messages for AI
        const aiMessages = messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        }));

        let assistantContent: string;
        let usedModel: string;
        let tokenCount: number | undefined;

        // If no model config, use OpenClaw Gateway as fallback
        if (!modelConfig || !modelConfig.enabled) {
          try {
            // Use OpenClaw Gateway
            const fs = await import('fs/promises');
            const path = await import('path');
            const os = await import('os');
            
            const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
            const configContent = await fs.readFile(configPath, 'utf-8');
            const gatewayConfig = JSON.parse(configContent);
            
            const gatewayUrl = `http://127.0.0.1:${gatewayConfig.gateway?.port || 18789}`;
            const gatewayToken = gatewayConfig.gateway?.auth?.token;
            
            // Call OpenClaw Gateway API (OpenAI-compatible endpoint)
            const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${gatewayToken}`,
              },
              body: JSON.stringify({
                model: 'openclaw:main',
                messages: aiMessages,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Gateway API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            assistantContent = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
            usedModel = data.model || 'openclaw-gateway';
            tokenCount = data.usage?.total_tokens;
          } catch (error) {
            console.error('[Chat] OpenClaw Gateway error:', error);
            throw new Error('No model configuration found. Please configure a model in Model Settings or ensure OpenClaw Gateway is running.');
          }
        } else {
          // Use configured model
          const decryptedConfig = decryptConfig(modelConfig.config as Record<string, unknown>);
          const apiKey = decryptedConfig.apiKey as string;
          const baseUrl = decryptedConfig.baseUrl as string || 'https://api.openai.com/v1';
          const selectedModel = decryptedConfig.model as string || 'gpt-3.5-turbo';
          const temperature = (decryptedConfig.temperature as number) || 0.7;
          const maxTokens = (decryptedConfig.maxTokens as number) || 2000;

          if (!apiKey) {
            throw new Error("Model API key not configured");
          }

          try {
            // Direct API call
            const response = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: selectedModel,
                messages: aiMessages,
                temperature,
                max_tokens: maxTokens,
              }),
            });

            if (!response.ok) {
              throw new Error(`AI API error: ${response.statusText}`);
            }

            const data = await response.json();
            assistantContent = data.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
            usedModel = selectedModel;
            tokenCount = data.usage?.total_tokens;
          } catch (error) {
            console.error('[Chat] AI API error:', error);
            throw new Error(`Failed to get AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Save assistant message to database
        const assistantMessage = await db.addChatMessage({
          sessionId,
          role: 'assistant',
          content: assistantContent,
          modelId: usedModel,
          tokenCount,
        });

        return {
          userMessage,
          assistantMessage,
        };
      }),

    // Send message with streaming response (SSE)
    sendMessageStream: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        content: z.string().min(1),
        modelId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { sessionId, content, modelId } = input;
        
        // Add user message to database
        const userMessage = await db.addChatMessage({
          sessionId,
          role: 'user',
          content,
        });

        // Get conversation history
        const messages = await db.getChatMessages(sessionId, ctx.user!.id);
        
        // Prepare messages for AI
        const aiMessages = messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        }));

        let assistantContent = '';
        let thinkingContent = '';
        let usedModel = 'openclaw-gateway';
        let tokenCount: number | undefined;

        try {
          // Use OpenClaw Gateway with streaming
          const fs = await import('fs/promises');
          const path = await import('path');
          const os = await import('os');
          
          const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
          const configContent = await fs.readFile(configPath, 'utf-8');
          const gatewayConfig = JSON.parse(configContent);
          
          const gatewayUrl = `http://127.0.0.1:${gatewayConfig.gateway?.port || 18789}`;
          const gatewayToken = gatewayConfig.gateway?.auth?.token;
          
          // Call OpenClaw Gateway API with streaming
          const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${gatewayToken}`,
            },
            body: JSON.stringify({
              model: modelId || 'openclaw:main',
              messages: aiMessages,
              stream: true,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gateway API error (${response.status}): ${errorText}`);
          }

          // Parse SSE stream
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          
          if (reader) {
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') continue;
                  
                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta?.content) {
                      assistantContent += delta.content;
                    }
                    // Check for thinking/reasoning content (Claude-style)
                    if (delta?.reasoning || delta?.thinking) {
                      thinkingContent += delta.reasoning || delta.thinking;
                    }
                    if (parsed.model) {
                      usedModel = parsed.model;
                    }
                    if (parsed.usage?.total_tokens) {
                      tokenCount = parsed.usage.total_tokens;
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('[Chat Stream] OpenClaw Gateway error:', error);
          throw new Error('Failed to stream response. Please ensure OpenClaw Gateway is running.');
        }

        // Save assistant message to database
        const assistantMessage = await db.addChatMessage({
          sessionId,
          role: 'assistant',
          content: assistantContent || "Sorry, I couldn't generate a response.",
          modelId: usedModel,
          tokenCount,
        });

        return {
          userMessage,
          assistantMessage,
          thinkingContent,
        };
      }),
  }),

  // Gateway Management API
  gatewayManager: router({
    // Get current Gateway status
    getStatus: protectedProcedure.query(async () => {
      const { gatewayProcessManager } = await import('./services/gatewayProcessManager');
      const status = await gatewayProcessManager.getStatus();
      
      // Get last restart from database
      const recentRestarts = await db.getRecentRestartLogs(1);
      const lastRestart = recentRestarts.length > 0 
        ? new Date(recentRestarts[0].createdAt).getTime()
        : null;

      return {
        ...status,
        lastRestart,
      };
    }),

    // Manual restart
    restart: adminProcedure
      .input(z.object({
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { gatewayProcessManager } = await import('./services/gatewayProcessManager');
        
        const result = await gatewayProcessManager.restart(input.reason || 'manual');

        // Log the restart
        await db.insertGatewayRestartLog({
          triggerType: 'manual',
          triggerUserId: ctx.user.openId,
          reason: input.reason || 'Manual restart from dashboard',
          oldPid: result.oldPid || null,
          newPid: result.newPid || null,
          success: result.success,
          errorMessage: result.error || null,
          durationMs: result.duration,
        });

        return result;
      }),

    // Stop Gateway
    stop: adminProcedure.mutation(async () => {
      const { gatewayProcessManager } = await import('./services/gatewayProcessManager');
      return await gatewayProcessManager.stop();
    }),

    // Start Gateway
    start: adminProcedure.mutation(async () => {
      const { gatewayProcessManager } = await import('./services/gatewayProcessManager');
      return await gatewayProcessManager.start();
    }),

    // Get logs
    getLogs: protectedProcedure
      .input(z.object({
        lines: z.number().optional().default(100),
        level: z.enum(['all', 'error', 'warn', 'info']).optional().default('all'),
      }))
      .query(async ({ input }) => {
        const { gatewayProcessManager } = await import('./services/gatewayProcessManager');
        const logs = await gatewayProcessManager.getLogs(input.lines, input.level);
        
        return {
          logs: logs.map(line => ({
            timestamp: Date.now(), // TODO: Parse timestamp from log line
            level: 'info', // TODO: Parse level from log line
            message: line,
          })),
        };
      }),

    // Get monitor history
    getMonitorHistory: protectedProcedure
      .input(z.object({
        startTime: z.number(),
        endTime: z.number(),
      }))
      .query(async ({ input }) => {
        const data = await db.getGatewayMonitorHistory(input.startTime, input.endTime);
        return { data };
      }),

    // Get restart logs
    getRestartLogs: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        const logs = await db.getRecentRestartLogs(input.limit);
        return { logs };
      }),

    // Get connection mode
    getConnectionMode: protectedProcedure.query(async () => {
      const mode = await db.getGatewaySetting('telegram_connection_mode', 'webhook');
      return { mode: mode as 'gateway' | 'webhook' };
    }),

    // Set connection mode
    setConnectionMode: adminProcedure
      .input(z.object({
        mode: z.enum(['gateway', 'webhook']),
      }))
      .mutation(async ({ input }) => {
        const currentMode = await db.getGatewaySetting('telegram_connection_mode', 'webhook');
        
        if (currentMode === input.mode) {
          return { success: true, message: 'Mode unchanged' };
        }

        // Handle mode switch
        if (input.mode === 'webhook') {
          // Switching to webhook mode: stop Gateway if running
          try {
            const { gatewayProcessManager } = await import('./services/gatewayProcessManager');
            await gatewayProcessManager.stop();
          } catch (e) {
            console.warn('Failed to stop Gateway:', e);
          }
          
          // Apply webhook URL
          try {
            const { webhookPoller } = await import('./services/webhookPoller');
            await webhookPoller.applyWebhook();
          } catch (e) {
            console.warn('Failed to apply webhook:', e);
          }
        } else {
          // Switching to gateway mode: delete webhook first
          try {
            const { webhookPoller } = await import('./services/webhookPoller');
            await webhookPoller.deleteWebhook();
          } catch (e) {
            console.warn('Failed to delete webhook:', e);
          }
          
          // Start Gateway
          try {
            const { gatewayProcessManager } = await import('./services/gatewayProcessManager');
            await gatewayProcessManager.start();
          } catch (e) {
            console.warn('Failed to start Gateway:', e);
          }
        }

        // Save the new mode
        await db.setGatewaySetting('telegram_connection_mode', input.mode);
        
        return { 
          success: true, 
          message: `Switched to ${input.mode} mode`,
          previousMode: currentMode,
          newMode: input.mode,
        };
      }),
  }),

  // Webhook Management API
  webhookManager: router({
    // Check webhook status
    checkStatus: adminProcedure.mutation(async () => {
      const { webhookPoller } = await import('./services/webhookPoller');
      await webhookPoller.checkAndRestart();
      
      // Get latest status from database
      const logs = await db.getRecentWebhookLogs(1);
      if (logs.length > 0) {
        const latest = logs[0];
        return {
          isActive: latest.isActive,
          url: latest.webhookUrl || '',
          pendingUpdates: latest.pendingUpdateCount || 0,
          lastError: latest.lastErrorMessage ? {
            date: latest.lastErrorDate || 0,
            message: latest.lastErrorMessage,
          } : null,
        };
      }
      
      return {
        isActive: false,
        url: '',
        pendingUpdates: 0,
        lastError: null,
      };
    }),

    // Get webhook history
    getHistory: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        const logs = await db.getRecentWebhookLogs(input.limit);
        return { logs };
      }),

    // Configure auto-check
    configureAutoCheck: adminProcedure
      .input(z.object({
        enabled: z.boolean(),
        intervalSeconds: z.number().optional(),
        autoRestart: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        if (input.enabled !== undefined) {
          await db.setGatewaySetting('auto_restart_enabled', input.enabled.toString());
        }
        if (input.intervalSeconds !== undefined) {
          await db.setGatewaySetting('webhook_check_interval', input.intervalSeconds.toString());
        }
        
        return { success: true };
      }),

    // Set production webhook URL
    setProductionUrl: adminProcedure
      .input(z.object({
        url: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        await db.setGatewaySetting('production_webhook_url', input.url);
        return { success: true };
      }),

    // Apply webhook - set Telegram webhook to production URL
    applyWebhook: adminProcedure
      .mutation(async () => {
        // Import webhookPoller dynamically to avoid circular dependency
        const { webhookPoller } = await import('./services/webhookPoller');
        const result = await webhookPoller.applyWebhook();
        return result;
      }),

    // Get all settings
    getSettings: protectedProcedure.query(async () => {
      const settings = await db.getAllGatewaySettings();
      return { settings };
    }),
  }),
});

export type AppRouter = typeof appRouter;


// Helper functions for syncing to gateway
async function syncPairedUsersToGateway() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    if (config.channels?.telegram?.dmPolicy === 'pairing') {
      const pairedUsers = await db.getActiveTelegramPairedUsers();
      config.channels.telegram.allowFrom = pairedUsers.map(u => u.telegramUserId);
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('Failed to sync paired users to gateway:', error);
  }
}

async function syncAllowlistToGateway() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    if (config.channels?.telegram?.dmPolicy === 'allowlist') {
      const allowlistUsers = await db.getTelegramAllowlist();
      config.channels.telegram.allowFrom = allowlistUsers.map(u => u.telegramUserId);
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('Failed to sync allowlist to gateway:', error);
  }
}


