import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, customModels, InsertCustomModel, CustomModel, chatSessions, InsertChatSession, ChatSession, chatMessages, InsertChatMessage, ChatMessage } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "walletAddress"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get user by wallet address
 */
export async function getUserByWalletAddress(walletAddress: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.walletAddress, walletAddress.toLowerCase())).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create or update user by wallet address
 */
export async function upsertUserByWallet(walletAddress: string): Promise<typeof users.$inferSelect | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return undefined;
  }

  const normalizedAddress = walletAddress.toLowerCase();
  // Use wallet address as openId for wallet-based users
  const openId = `wallet:${normalizedAddress}`;

  try {
    // Check if user exists
    const existingUser = await getUserByWalletAddress(normalizedAddress);
    
    if (existingUser) {
      // Update last signed in
      await db.update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, existingUser.id));
      
      return { ...existingUser, lastSignedIn: new Date() };
    }

    // Create new user
    const newUser: InsertUser = {
      openId,
      walletAddress: normalizedAddress,
      loginMethod: 'wallet',
      lastSignedIn: new Date(),
    };

    await db.insert(users).values(newUser);
    
    // Fetch and return the created user
    return await getUserByWalletAddress(normalizedAddress);
  } catch (error) {
    console.error("[Database] Failed to upsert wallet user:", error);
    throw error;
  }
}

/**
 * Check if user is admin
 */
export async function isUserAdmin(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result.length > 0 && result[0].role === 'admin';
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(users).orderBy(users.createdAt);
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(userId: number, role: 'user' | 'admin') {
  const db = await getDb();
  if (!db) return false;

  await db.update(users)
    .set({ role })
    .where(eq(users.id, userId));

  return true;
}


// ============ Custom Models ============

/**
 * Get all custom models for a user
 */
export async function getCustomModels(userId: number): Promise<CustomModel[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(customModels)
    .where(eq(customModels.userId, userId))
    .orderBy(customModels.createdAt);
}

/**
 * Add a custom model for a user
 */
export async function addCustomModel(
  userId: number, 
  model: { name: string; provider: string; modelId: string }
): Promise<CustomModel | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const newModel: InsertCustomModel = {
    userId,
    name: model.name,
    provider: model.provider,
    modelId: model.modelId,
  };

  await db.insert(customModels).values(newModel);

  // Return the last inserted model
  const result = await db.select()
    .from(customModels)
    .where(eq(customModels.userId, userId))
    .orderBy(customModels.id)
    .limit(1);

  return result.length > 0 ? result[result.length - 1] : undefined;
}

/**
 * Delete a custom model
 */
export async function deleteCustomModel(userId: number, modelId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(customModels)
    .where(eq(customModels.id, modelId));
}


// ============ Channel Configs ============

import { channelConfigs, modelConfigs, systemSettings, ChannelConfig, InsertChannelConfig, ModelConfig, InsertModelConfig } from "../drizzle/schema";

/**
 * Get all channel configs for a user
 */
export async function getChannelConfigs(userId: number): Promise<ChannelConfig[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(channelConfigs)
    .where(eq(channelConfigs.userId, userId))
    .orderBy(channelConfigs.createdAt);
}

/**
 * Get a single channel config by ID
 */
export async function getChannelConfigById(id: number): Promise<ChannelConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create a new channel config
 */
export async function createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.insert(channelConfigs).values(config);

  // Return the last inserted config
  const result = await db.select()
    .from(channelConfigs)
    .where(eq(channelConfigs.userId, config.userId))
    .orderBy(channelConfigs.id);

  return result.length > 0 ? result[result.length - 1] : undefined;
}

/**
 * Update a channel config
 */
export async function updateChannelConfig(
  id: number, 
  updates: Partial<InsertChannelConfig>
): Promise<ChannelConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(channelConfigs)
    .set(updates)
    .where(eq(channelConfigs.id, id));

  return await getChannelConfigById(id);
}

/**
 * Delete a channel config
 */
export async function deleteChannelConfig(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(channelConfigs)
    .where(eq(channelConfigs.id, id));
}

/**
 * Update channel test status
 */
export async function updateChannelTestStatus(
  id: number,
  status: 'pending' | 'success' | 'failed',
  message: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(channelConfigs)
    .set({
      testStatus: status,
      testMessage: message,
      lastTestedAt: new Date(),
    })
    .where(eq(channelConfigs.id, id));
}

// ============ Model Configs ============

/**
 * Get all model configs for a user
 */
export async function getModelConfigs(userId: number): Promise<ModelConfig[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(modelConfigs)
    .where(eq(modelConfigs.userId, userId))
    .orderBy(modelConfigs.createdAt);
}

/**
 * Get a single model config by ID
 */
export async function getModelConfigById(id: number): Promise<ModelConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(modelConfigs)
    .where(eq(modelConfigs.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get the default model config for a user
 */
export async function getDefaultModelConfig(userId: number): Promise<ModelConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(modelConfigs)
    .where(eq(modelConfigs.userId, userId))
    .limit(1);

  // Find the default one, or return the first enabled one
  const defaultConfig = result.find(c => c.isDefault && c.enabled);
  if (defaultConfig) return defaultConfig;

  const enabledConfig = result.find(c => c.enabled);
  return enabledConfig;
}

/**
 * Create a new model config
 */
export async function createModelConfig(config: InsertModelConfig): Promise<ModelConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.insert(modelConfigs).values(config);

  // Return the last inserted config
  const result = await db.select()
    .from(modelConfigs)
    .where(eq(modelConfigs.userId, config.userId))
    .orderBy(modelConfigs.id);

  return result.length > 0 ? result[result.length - 1] : undefined;
}

/**
 * Update a model config
 */
export async function updateModelConfig(
  id: number, 
  updates: Partial<InsertModelConfig>
): Promise<ModelConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(modelConfigs)
    .set(updates)
    .where(eq(modelConfigs.id, id));

  return await getModelConfigById(id);
}

/**
 * Delete a model config
 */
export async function deleteModelConfig(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(modelConfigs)
    .where(eq(modelConfigs.id, id));
}

/**
 * Set a model config as default (unset others)
 */
export async function setDefaultModelConfig(userId: number, id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Unset all defaults for this user
  await db.update(modelConfigs)
    .set({ isDefault: false })
    .where(eq(modelConfigs.userId, userId));

  // Set the new default
  await db.update(modelConfigs)
    .set({ isDefault: true })
    .where(eq(modelConfigs.id, id));
}

/**
 * Update model test status
 */
export async function updateModelTestStatus(
  id: number,
  status: 'pending' | 'success' | 'failed',
  message: string,
  latency?: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(modelConfigs)
    .set({
      testStatus: status,
      testMessage: message,
      testLatency: latency,
      lastTestedAt: new Date(),
    })
    .where(eq(modelConfigs.id, id));
}

// ============ System Settings ============

/**
 * Get a system setting
 */
export async function getSystemSetting(userId: number, key: string): Promise<unknown | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.userId, userId))
    .limit(1);

  const setting = result.find(s => s.key === key);
  return setting?.value;
}

/**
 * Set a system setting
 */
export async function setSystemSetting(userId: number, key: string, value: unknown): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Try to update first
  const existing = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.userId, userId))
    .limit(100);

  const existingSetting = existing.find(s => s.key === key);

  if (existingSetting) {
    await db.update(systemSettings)
      .set({ value })
      .where(eq(systemSettings.id, existingSetting.id));
  } else {
    await db.insert(systemSettings).values({
      userId,
      key,
      value,
    });
  }
}


// ============ Telegram Access Control ============

import { 
  telegramPairedUsers, 
  telegramPairingCodes, 
  telegramAllowlist,
  TelegramPairedUser,
  InsertTelegramPairedUser,
  TelegramPairingCode,
  InsertTelegramPairingCode,
  TelegramAllowlistUser,
  InsertTelegramAllowlistUser
} from "../drizzle/schema";
import { and, lt } from "drizzle-orm";

/**
 * Get all paired Telegram users
 */
export async function getTelegramPairedUsers(): Promise<TelegramPairedUser[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(telegramPairedUsers)
    .orderBy(desc(telegramPairedUsers.pairedAt));
}

/**
 * Get active paired Telegram users
 */
export async function getActiveTelegramPairedUsers(): Promise<TelegramPairedUser[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(telegramPairedUsers)
    .where(eq(telegramPairedUsers.status, 'active'))
    .orderBy(desc(telegramPairedUsers.pairedAt));
}

/**
 * Add a paired Telegram user
 */
export async function addTelegramPairedUser(user: InsertTelegramPairedUser): Promise<TelegramPairedUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.insert(telegramPairedUsers).values(user);

  const result = await db.select()
    .from(telegramPairedUsers)
    .where(eq(telegramPairedUsers.telegramUserId, user.telegramUserId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Revoke a paired Telegram user
 */
export async function revokeTelegramPairedUser(telegramUserId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(telegramPairedUsers)
    .set({ status: 'revoked' })
    .where(eq(telegramPairedUsers.telegramUserId, telegramUserId));
}

/**
 * Delete a paired Telegram user
 */
export async function deleteTelegramPairedUser(telegramUserId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(telegramPairedUsers)
    .where(eq(telegramPairedUsers.telegramUserId, telegramUserId));
}

// ============ Telegram Pairing Codes ============

/**
 * Get all pairing codes
 */
export async function getTelegramPairingCodes(): Promise<TelegramPairingCode[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(telegramPairingCodes)
    .orderBy(desc(telegramPairingCodes.createdAt));
}

/**
 * Get pending pairing codes (not used, not expired, not revoked)
 */
export async function getPendingTelegramPairingCodes(): Promise<TelegramPairingCode[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(telegramPairingCodes)
    .where(eq(telegramPairingCodes.status, 'pending'))
    .orderBy(desc(telegramPairingCodes.createdAt));
}

/**
 * Create a new pairing code
 */
export async function createTelegramPairingCode(
  code: string,
  expiresAt: Date,
  createdBy: number
): Promise<TelegramPairingCode | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const newCode: InsertTelegramPairingCode = {
    code,
    expiresAt,
    createdBy,
    status: 'pending',
  };

  await db.insert(telegramPairingCodes).values(newCode);

  const result = await db.select()
    .from(telegramPairingCodes)
    .where(eq(telegramPairingCodes.code, code))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Mark a pairing code as used
 */
export async function useTelegramPairingCode(
  code: string,
  telegramUserId: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(telegramPairingCodes)
    .set({
      status: 'used',
      usedAt: new Date(),
      usedByTelegramId: telegramUserId,
    })
    .where(eq(telegramPairingCodes.code, code));
}

/**
 * Revoke a pairing code
 */
export async function revokeTelegramPairingCode(codeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(telegramPairingCodes)
    .set({ status: 'revoked' })
    .where(eq(telegramPairingCodes.id, codeId));
}

/**
 * Expire old pairing codes
 */
export async function expireOldTelegramPairingCodes(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(telegramPairingCodes)
    .set({ status: 'expired' })
    .where(
      and(
        eq(telegramPairingCodes.status, 'pending'),
        lt(telegramPairingCodes.expiresAt, new Date())
      )
    );
}

/**
 * Get a pairing code by code string
 */
export async function getTelegramPairingCodeByCode(code: string): Promise<TelegramPairingCode | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(telegramPairingCodes)
    .where(eq(telegramPairingCodes.code, code))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Telegram Allowlist ============

/**
 * Get all allowlist users
 */
export async function getTelegramAllowlist(): Promise<TelegramAllowlistUser[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(telegramAllowlist)
    .orderBy(desc(telegramAllowlist.addedAt));
}

/**
 * Add a user to the allowlist
 */
export async function addToTelegramAllowlist(user: InsertTelegramAllowlistUser): Promise<TelegramAllowlistUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.insert(telegramAllowlist).values(user);

  const result = await db.select()
    .from(telegramAllowlist)
    .where(eq(telegramAllowlist.telegramUserId, user.telegramUserId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Remove a user from the allowlist
 */
export async function removeFromTelegramAllowlist(telegramUserId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(telegramAllowlist)
    .where(eq(telegramAllowlist.telegramUserId, telegramUserId));
}

/**
 * Check if a user is in the allowlist
 */
export async function isInTelegramAllowlist(telegramUserId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select()
    .from(telegramAllowlist)
    .where(eq(telegramAllowlist.telegramUserId, telegramUserId))
    .limit(1);

  return result.length > 0;
}

/**
 * Batch add users to allowlist
 */
export async function batchAddToTelegramAllowlist(
  users: Array<{ telegramUserId: string; telegramUsername?: string; notes?: string }>,
  addedBy: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let addedCount = 0;
  for (const user of users) {
    try {
      await db.insert(telegramAllowlist).values({
        telegramUserId: user.telegramUserId,
        telegramUsername: user.telegramUsername,
        notes: user.notes,
        addedBy,
      });
      addedCount++;
    } catch (error) {
      // Ignore duplicate errors
      console.warn(`[Telegram] Failed to add user ${user.telegramUserId} to allowlist:`, error);
    }
  }

  return addedCount;
}

// ==================== Chat Sessions ====================



/**
 * Get all chat sessions for a user
 */
export async function getChatSessions(userId: number): Promise<ChatSession[]> {
  const db = await getDb();
  if (!db) return [];
  
  const sessions = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt));
  
  return sessions;
}

/**
 * Create a new chat session
 */
export async function createChatSession(session: InsertChatSession): Promise<ChatSession> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatSessions).values(session);
  const insertedId = Number(result[0].insertId);
  
  const created = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, insertedId))
    .limit(1);
  
  if (!created[0]) throw new Error("Failed to create chat session");
  return created[0];
}

/**
 * Delete a chat session and all its messages
 */
export async function deleteChatSession(sessionId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // First verify the session belongs to the user
  const session = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);
  
  if (!session[0] || session[0].userId !== userId) {
    throw new Error("Session not found or unauthorized");
  }
  
  // Delete all messages first
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  
  // Then delete the session
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
}

/**
 * Update chat session title
 */
export async function updateChatSessionTitle(sessionId: number, userId: number, title: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verify ownership
  const session = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);
  
  if (!session[0] || session[0].userId !== userId) {
    throw new Error("Session not found or unauthorized");
  }
  
  await db
    .update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

// ==================== Chat Messages ====================

/**
 * Get all messages for a chat session
 */
export async function getChatMessages(sessionId: number, userId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Verify session belongs to user
  const session = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);
  
  if (!session[0] || session[0].userId !== userId) {
    throw new Error("Session not found or unauthorized");
  }
  
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
  
  return messages;
}

/**
 * Add a message to a chat session
 */
export async function addChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatMessages).values(message);
  const insertedId = Number(result[0].insertId);
  
  const created = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, insertedId))
    .limit(1);
  
  if (!created[0]) throw new Error("Failed to add message");
  
  // Update session's updatedAt timestamp
  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, message.sessionId));
  
  return created[0];
}

// ============================================================================
// Gateway Management Database Operations
// ============================================================================

import {
  gatewayMonitors,
  InsertGatewayMonitor,
  GatewayMonitor,
  gatewayRestartLogs,
  InsertGatewayRestartLog,
  GatewayRestartLog,
  webhookStatusLogs,
  InsertWebhookStatusLog,
  WebhookStatusLog,
  gatewaySettings,
  InsertGatewaySetting,
  GatewaySetting,
} from "../drizzle/schema";

/**
 * Insert a Gateway monitor snapshot
 */
export async function insertGatewayMonitor(monitor: InsertGatewayMonitor): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert gateway monitor: database not available");
    return;
  }

  try {
    await db.insert(gatewayMonitors).values(monitor);
  } catch (error) {
    console.error("[Database] Error inserting gateway monitor:", error);
    throw error;
  }
}

/**
 * Get Gateway monitor history within a time range
 */
export async function getGatewayMonitorHistory(
  startTime: number,
  endTime: number,
  limit: number = 1000
): Promise<GatewayMonitor[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const results = await db
      .select()
      .from(gatewayMonitors)
      .where(sql`${gatewayMonitors.timestamp} >= ${startTime} AND ${gatewayMonitors.timestamp} <= ${endTime}`)
      .orderBy(desc(gatewayMonitors.timestamp))
      .limit(limit);
    
    return results;
  } catch (error) {
    console.error("[Database] Error getting gateway monitor history:", error);
    return [];
  }
}

/**
 * Insert a Gateway restart log
 */
export async function insertGatewayRestartLog(log: InsertGatewayRestartLog): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert restart log: database not available");
    return;
  }

  try {
    await db.insert(gatewayRestartLogs).values(log);
  } catch (error) {
    console.error("[Database] Error inserting restart log:", error);
    throw error;
  }
}

/**
 * Get recent Gateway restart logs
 */
export async function getRecentRestartLogs(limit: number = 50): Promise<GatewayRestartLog[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const results = await db
      .select()
      .from(gatewayRestartLogs)
      .orderBy(desc(gatewayRestartLogs.createdAt))
      .limit(limit);
    
    return results;
  } catch (error) {
    console.error("[Database] Error getting restart logs:", error);
    return [];
  }
}

/**
 * Get recent restart attempts within a time window (for rate limiting)
 */
export async function getRecentRestartAttempts(windowMinutes: number = 5): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const cutoffTime = Date.now() - (windowMinutes * 60 * 1000);
    const results = await db
      .select()
      .from(gatewayRestartLogs)
      .where(sql`UNIX_TIMESTAMP(${gatewayRestartLogs.createdAt}) * 1000 >= ${cutoffTime}`);
    
    return results.length;
  } catch (error) {
    console.error("[Database] Error getting recent restart attempts:", error);
    return 0;
  }
}

/**
 * Insert a webhook status log
 */
export async function insertWebhookStatusLog(log: InsertWebhookStatusLog): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert webhook status log: database not available");
    return;
  }

  try {
    await db.insert(webhookStatusLogs).values(log);
  } catch (error) {
    console.error("[Database] Error inserting webhook status log:", error);
    throw error;
  }
}

/**
 * Get recent webhook status logs
 */
export async function getRecentWebhookLogs(limit: number = 50): Promise<WebhookStatusLog[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const results = await db
      .select()
      .from(webhookStatusLogs)
      .orderBy(desc(webhookStatusLogs.checkTimestamp))
      .limit(limit);
    
    return results;
  } catch (error) {
    console.error("[Database] Error getting webhook logs:", error);
    return [];
  }
}

/**
 * Get or create a Gateway setting
 */
export async function getGatewaySetting(key: string, defaultValue?: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return defaultValue || null;

  try {
    const results = await db
      .select()
      .from(gatewaySettings)
      .where(eq(gatewaySettings.key, key))
      .limit(1);
    
    if (results.length > 0) {
      return results[0].value;
    }

    // If default value provided, create the setting
    if (defaultValue !== undefined) {
      await db.insert(gatewaySettings).values({
        key,
        value: defaultValue,
        description: null,
      });
      return defaultValue;
    }

    return null;
  } catch (error) {
    console.error("[Database] Error getting gateway setting:", error);
    return defaultValue || null;
  }
}

/**
 * Set a Gateway setting
 */
export async function setGatewaySetting(key: string, value: string, description?: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot set gateway setting: database not available");
    return;
  }

  try {
    // Try to update first
    const existing = await db
      .select()
      .from(gatewaySettings)
      .where(eq(gatewaySettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(gatewaySettings)
        .set({ value, description: description || existing[0].description })
        .where(eq(gatewaySettings.key, key));
    } else {
      await db.insert(gatewaySettings).values({
        key,
        value,
        description: description || null,
      });
    }
  } catch (error) {
    console.error("[Database] Error setting gateway setting:", error);
    throw error;
  }
}

/**
 * Get all Gateway settings
 */
export async function getAllGatewaySettings(): Promise<GatewaySetting[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const results = await db.select().from(gatewaySettings);
    return results;
  } catch (error) {
    console.error("[Database] Error getting all gateway settings:", error);
    return [];
  }
}

/**
 * Initialize default Gateway settings if they don't exist
 */
export async function initializeGatewaySettings(): Promise<void> {
  const defaults = [
    { key: 'webhook_check_interval', value: '300', description: 'Webhook check interval (seconds)' },
    { key: 'production_webhook_url', value: '', description: 'Production webhook URL' },
    { key: 'auto_restart_enabled', value: 'true', description: 'Enable automatic restart on webhook failure' },
    { key: 'max_restart_attempts', value: '3', description: 'Maximum restart attempts within time window' },
    { key: 'health_check_timeout', value: '10', description: 'Health check timeout (seconds)' },
    { key: 'telegram_connection_mode', value: 'webhook', description: 'Telegram connection mode: gateway (local polling) or webhook (server push)' },
  ];

  for (const setting of defaults) {
    await getGatewaySetting(setting.key, setting.value);
    // Update description if it exists
    await setGatewaySetting(setting.key, setting.value, setting.description);
  }
}


// ============ Telegram Bot Token Helper ============

import { decryptConfig } from './crypto';

/**
 * Get Telegram bot token from channel configs
 * Looks for the first enabled Telegram channel config and returns its bot token
 * Automatically decrypts the bot token if it's encrypted
 */
export async function getTelegramBotToken(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Find enabled Telegram channel config
    const result = await db.select()
      .from(channelConfigs)
      .where(eq(channelConfigs.channelType, 'telegram'))
      .orderBy(channelConfigs.createdAt);

    // Find the first enabled one, or just the first one
    const enabledConfig = result.find(c => c.enabled);
    const config = enabledConfig || result[0];

    if (!config || !config.config) {
      console.warn('[Database] No Telegram channel config found');
      return null;
    }

    // Decrypt the config to get the bot token
    const configData = config.config as Record<string, unknown>;
    const decryptedConfig = decryptConfig(configData);
    
    const botToken = decryptedConfig.botToken as string;
    if (!botToken) {
      console.warn('[Database] Bot token not found in Telegram config');
      return null;
    }
    
    return botToken;
  } catch (error) {
    console.error('[Database] Error getting Telegram bot token:', error);
    return null;
  }
}
