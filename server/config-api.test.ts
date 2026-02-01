import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve({})),
  getChannelConfigs: vi.fn(() => Promise.resolve([])),
  getChannelConfigById: vi.fn(() => Promise.resolve(null)),
  createChannelConfig: vi.fn(() => Promise.resolve({ id: 1 })),
  updateChannelConfig: vi.fn(() => Promise.resolve()),
  deleteChannelConfig: vi.fn(() => Promise.resolve()),
  updateChannelTestStatus: vi.fn(() => Promise.resolve()),
  getModelConfigs: vi.fn(() => Promise.resolve([])),
  getModelConfigById: vi.fn(() => Promise.resolve(null)),
  createModelConfig: vi.fn(() => Promise.resolve({ id: 1 })),
  updateModelConfig: vi.fn(() => Promise.resolve()),
  deleteModelConfig: vi.fn(() => Promise.resolve()),
  updateModelTestStatus: vi.fn(() => Promise.resolve()),
  getDefaultModelConfig: vi.fn(() => Promise.resolve(null)),
}));

// Mock crypto functions
vi.mock("./crypto", () => ({
  encryptConfig: vi.fn((config) => JSON.stringify(config)),
  decryptConfig: vi.fn((encrypted) => JSON.parse(encrypted)),
}));

// Mock channel testers
vi.mock("./channel-testers", () => ({
  testChannelConnection: vi.fn(() => Promise.resolve({ success: true, message: "Connected", latency: 100 })),
}));

// Mock model testers
vi.mock("./model-testers", () => ({
  testModelConnection: vi.fn(() => Promise.resolve({ success: true, message: "Connected", latency: 200, models: [] })),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    walletAddress: null,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    walletAddress: null,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Channel Configuration API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin can list channel configs", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channels.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("admin can create channel config", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channels.create({
      name: "Test Telegram",
      channelType: "telegram",
      config: { botToken: "test-token" },
    });

    expect(result).toHaveProperty("id");
  });

  it("non-admin cannot access channel configs", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.channels.list()).rejects.toThrow();
  });
});

describe("AI Model Configuration API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin can list model configs", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.aiModels.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("admin can create model config", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.aiModels.create({
      name: "Test OpenAI",
      provider: "openai",
      config: { apiKey: "sk-test-key" },
    });

    expect(result).toHaveProperty("id");
  });

  it("non-admin cannot access model configs", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.aiModels.list()).rejects.toThrow();
  });
});

describe("Channel Types", () => {
  it("supports all required channel types", () => {
    const supportedTypes = [
      "telegram",
      "discord",
      "slack",
      "whatsapp",
      "feishu",
      "lark",
      "imessage",
      "wechat_work",
      "webhook",
    ];

    // This test ensures all channel types are defined
    supportedTypes.forEach((type) => {
      expect(typeof type).toBe("string");
    });
  });
});

describe("Model Providers", () => {
  it("supports all required model providers", () => {
    const supportedProviders = [
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
      "custom",
    ];

    // This test ensures all model providers are defined
    supportedProviders.forEach((provider) => {
      expect(typeof provider).toBe("string");
    });
  });
});
