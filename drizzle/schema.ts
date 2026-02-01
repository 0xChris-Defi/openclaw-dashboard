import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, bigint, decimal, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Supports both Manus OAuth and wallet-based authentication.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  /** Ethereum wallet address for wallet-based login */
  walletAddress: varchar("walletAddress", { length: 42 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  /** Login method: 'manus', 'wallet', etc. */
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** User role for access control */
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Custom AI models table for storing user-defined models (legacy, kept for compatibility)
 */
export const customModels = mysqlTable("custom_models", {
  id: int("id").autoincrement().primaryKey(),
  /** User who created this custom model */
  userId: int("userId").notNull(),
  /** Display name for the model */
  name: varchar("name", { length: 255 }).notNull(),
  /** Provider name (openrouter, anthropic, openai, etc.) */
  provider: varchar("provider", { length: 64 }).notNull(),
  /** Full model ID used in API calls */
  modelId: varchar("modelId", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomModel = typeof customModels.$inferSelect;
export type InsertCustomModel = typeof customModels.$inferInsert;

/**
 * Channel configurations table for storing messaging channel settings
 * Supports: Telegram, Discord, Slack, WhatsApp, Feishu, Lark, iMessage, WeChat, Custom
 */
export const channelConfigs = mysqlTable("channel_configs", {
  id: int("id").autoincrement().primaryKey(),
  /** User who owns this configuration */
  userId: int("userId").notNull(),
  /** Channel type */
  channelType: mysqlEnum("channelType", [
    "telegram",
    "discord", 
    "slack",
    "whatsapp",
    "feishu",
    "lark",
    "imessage",
    "wechat",
    "custom"
  ]).notNull(),
  /** Display name for this configuration */
  name: varchar("name", { length: 100 }).notNull(),
  /** Whether this channel is enabled */
  enabled: boolean("enabled").default(false).notNull(),
  /** Channel-specific configuration (encrypted JSON) */
  config: json("config").$type<Record<string, unknown>>(),
  /** Last test timestamp */
  lastTestedAt: timestamp("lastTestedAt"),
  /** Test status */
  testStatus: mysqlEnum("testStatus", ["pending", "success", "failed"]),
  /** Test result message */
  testMessage: text("testMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChannelConfig = typeof channelConfigs.$inferSelect;
export type InsertChannelConfig = typeof channelConfigs.$inferInsert;

/**
 * AI Model provider configurations table
 * Supports: OpenAI, Anthropic, OpenRouter, Google, MiniMax, DeepSeek, Moonshot, etc.
 */
export const modelConfigs = mysqlTable("model_configs", {
  id: int("id").autoincrement().primaryKey(),
  /** User who owns this configuration */
  userId: int("userId").notNull(),
  /** Provider type */
  provider: mysqlEnum("provider", [
    "openai",
    "anthropic",
    "openrouter",
    "google",
    "minimax",
    "deepseek",
    "moonshot",
    "zhipu",
    "baichuan",
    "qwen",
    "custom"
  ]).notNull(),
  /** Display name for this configuration */
  name: varchar("name", { length: 100 }).notNull(),
  /** Whether this provider is enabled */
  enabled: boolean("enabled").default(false).notNull(),
  /** Whether this is the default provider */
  isDefault: boolean("isDefault").default(false).notNull(),
  /** Provider-specific configuration (encrypted JSON) */
  config: json("config").$type<Record<string, unknown>>(),
  /** Available models from this provider */
  models: json("models").$type<Array<{
    id: string;
    name: string;
    contextLength?: number;
    inputPrice?: number;
    outputPrice?: number;
    capabilities?: string[];
  }>>(),
  /** Currently selected model ID */
  selectedModel: varchar("selectedModel", { length: 255 }),
  /** Last test timestamp */
  lastTestedAt: timestamp("lastTestedAt"),
  /** Test status */
  testStatus: mysqlEnum("testStatus", ["pending", "success", "failed"]),
  /** Test result message */
  testMessage: text("testMessage"),
  /** Test latency in ms */
  testLatency: int("testLatency"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModelConfig = typeof modelConfigs.$inferSelect;
export type InsertModelConfig = typeof modelConfigs.$inferInsert;

/**
 * System settings table for storing global configurations
 */
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** User who owns this setting */
  userId: int("userId").notNull(),
  /** Setting key */
  key: varchar("key", { length: 100 }).notNull(),
  /** Setting value (JSON) */
  value: json("value").$type<unknown>(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;


/**
 * Telegram paired users table for storing users who have completed pairing
 */
export const telegramPairedUsers = mysqlTable("telegram_paired_users", {
  id: int("id").autoincrement().primaryKey(),
  /** Telegram user ID */
  telegramUserId: varchar("telegramUserId", { length: 64 }).notNull().unique(),
  /** Telegram username (without @) */
  telegramUsername: varchar("telegramUsername", { length: 64 }),
  /** Telegram display name */
  telegramName: varchar("telegramName", { length: 128 }),
  /** When the user was paired */
  pairedAt: timestamp("pairedAt").defaultNow().notNull(),
  /** Admin who approved the pairing (if manual) */
  pairedBy: int("pairedBy"),
  /** Status of the pairing */
  status: mysqlEnum("status", ["active", "revoked"]).default("active").notNull(),
  /** Optional notes about this user */
  notes: text("notes"),
});

export type TelegramPairedUser = typeof telegramPairedUsers.$inferSelect;
export type InsertTelegramPairedUser = typeof telegramPairedUsers.$inferInsert;

/**
 * Telegram pairing codes table for one-time pairing codes
 */
export const telegramPairingCodes = mysqlTable("telegram_pairing_codes", {
  id: int("id").autoincrement().primaryKey(),
  /** The pairing code */
  code: varchar("code", { length: 32 }).notNull().unique(),
  /** When the code was created */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** When the code expires */
  expiresAt: timestamp("expiresAt").notNull(),
  /** When the code was used */
  usedAt: timestamp("usedAt"),
  /** Telegram user ID who used this code */
  usedByTelegramId: varchar("usedByTelegramId", { length: 64 }),
  /** Admin who created this code */
  createdBy: int("createdBy").notNull(),
  /** Status of the code */
  status: mysqlEnum("status", ["pending", "used", "expired", "revoked"]).default("pending").notNull(),
});

export type TelegramPairingCode = typeof telegramPairingCodes.$inferSelect;
export type InsertTelegramPairingCode = typeof telegramPairingCodes.$inferInsert;

/**
 * Telegram allowlist table for whitelist-based access control
 */
export const telegramAllowlist = mysqlTable("telegram_allowlist", {
  id: int("id").autoincrement().primaryKey(),
  /** Telegram user ID */
  telegramUserId: varchar("telegramUserId", { length: 64 }).notNull().unique(),
  /** Telegram username (without @) */
  telegramUsername: varchar("telegramUsername", { length: 64 }),
  /** When the user was added */
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  /** Admin who added this user */
  addedBy: int("addedBy").notNull(),
  /** Optional notes about this user */
  notes: text("notes"),
});

export type TelegramAllowlistUser = typeof telegramAllowlist.$inferSelect;
export type InsertTelegramAllowlistUser = typeof telegramAllowlist.$inferInsert;

/**
 * Chat sessions table for storing user chat conversations
 */
export const chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** User who owns this chat session */
  userId: int("userId").notNull(),
  /** Session title (auto-generated or user-defined) */
  title: varchar("title", { length: 255 }),
  /** Model ID used in this session */
  modelId: varchar("modelId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

/**
 * Chat messages table for storing individual messages in conversations
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  /** Session this message belongs to */
  sessionId: int("sessionId").notNull(),
  /** Message role: user, assistant, or system */
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  /** Message content */
  content: text("content").notNull(),
  /** Model ID used to generate this message (for assistant messages) */
  modelId: varchar("modelId", { length: 128 }),
  /** Token count for this message */
  tokenCount: int("tokenCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Gateway monitoring history table
 * Stores periodic snapshots of Gateway process metrics
 */
export const gatewayMonitors = mysqlTable("gateway_monitors", {
  id: int("id").autoincrement().primaryKey(),
  /** Timestamp when this snapshot was taken (Unix milliseconds) */
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  /** Gateway process status */
  status: mysqlEnum("status", ["running", "stopped", "error"]).notNull(),
  /** Process ID of the Gateway */
  pid: int("pid"),
  /** CPU usage percentage */
  cpuUsage: decimal("cpu_usage", { precision: 5, scale: 2 }),
  /** Memory usage in MB */
  memoryUsage: decimal("memory_usage", { precision: 10, scale: 2 }),
  /** Uptime in seconds */
  uptime: bigint("uptime", { mode: "number" }),
  /** Number of requests processed */
  requestCount: int("request_count").default(0),
  /** Number of errors encountered */
  errorCount: int("error_count").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  timestampIdx: index("idx_timestamp").on(table.timestamp),
}));

export type GatewayMonitor = typeof gatewayMonitors.$inferSelect;
export type InsertGatewayMonitor = typeof gatewayMonitors.$inferInsert;

/**
 * Gateway restart logs table
 * Records all Gateway restart operations for audit purposes
 */
export const gatewayRestartLogs = mysqlTable("gateway_restart_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** What triggered this restart */
  triggerType: mysqlEnum("trigger_type", ["manual", "webhook_check", "health_check", "scheduled"]).notNull(),
  /** User ID who triggered manual restart (null for automatic) */
  triggerUserId: varchar("trigger_user_id", { length: 255 }),
  /** Reason for restart */
  reason: text("reason"),
  /** PID of the old process before restart */
  oldPid: int("old_pid"),
  /** PID of the new process after restart */
  newPid: int("new_pid"),
  /** Whether the restart was successful */
  success: boolean("success").notNull(),
  /** Error message if restart failed */
  errorMessage: text("error_message"),
  /** Time taken to complete restart in milliseconds */
  durationMs: int("duration_ms"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("idx_created_at").on(table.createdAt),
}));

export type GatewayRestartLog = typeof gatewayRestartLogs.$inferSelect;
export type InsertGatewayRestartLog = typeof gatewayRestartLogs.$inferInsert;

/**
 * Webhook status logs table
 * Records Telegram webhook health check results
 */
export const webhookStatusLogs = mysqlTable("webhook_status_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** Timestamp when check was performed (Unix milliseconds) */
  checkTimestamp: bigint("check_timestamp", { mode: "number" }).notNull(),
  /** Current webhook URL */
  webhookUrl: varchar("webhook_url", { length: 500 }),
  /** Whether webhook is currently active */
  isActive: boolean("is_active").notNull(),
  /** Number of pending updates waiting to be processed */
  pendingUpdateCount: int("pending_update_count").default(0),
  /** Timestamp of last error (Unix milliseconds) */
  lastErrorDate: bigint("last_error_date", { mode: "number" }),
  /** Last error message from Telegram */
  lastErrorMessage: text("last_error_message"),
  /** Response time in milliseconds */
  responseTimeMs: int("response_time_ms"),
  /** Action taken after this check */
  actionTaken: mysqlEnum("action_taken", ["none", "restart", "alert"]).default("none"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  checkTimestampIdx: index("idx_check_timestamp").on(table.checkTimestamp),
}));

export type WebhookStatusLog = typeof webhookStatusLogs.$inferSelect;
export type InsertWebhookStatusLog = typeof webhookStatusLogs.$inferInsert;

/**
 * Gateway settings table
 * Stores configuration for Gateway management features
 */
export const gatewaySettings = mysqlTable("gateway_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** Setting key (unique identifier) */
  key: varchar("key", { length: 100 }).notNull().unique(),
  /** Setting value (stored as string, parse as needed) */
  value: text("value").notNull(),
  /** Human-readable description of this setting */
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GatewaySetting = typeof gatewaySettings.$inferSelect;
export type InsertGatewaySetting = typeof gatewaySettings.$inferInsert;
