import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createTelegramPairingCode: vi.fn().mockResolvedValue({ id: 1, code: "TEST123" }),
  getTelegramPairingCodes: vi.fn().mockResolvedValue([
    { id: 1, code: "TEST123", status: "pending", createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000) }
  ]),
  revokeTelegramPairingCode: vi.fn().mockResolvedValue(true),
  expireOldTelegramPairingCodes: vi.fn().mockResolvedValue(undefined),
  getTelegramPairedUsers: vi.fn().mockResolvedValue([
    { id: 1, telegramUserId: "123456789", telegramUsername: "testuser", status: "active", pairedAt: new Date() }
  ]),
  getActiveTelegramPairedUsers: vi.fn().mockResolvedValue([
    { id: 1, telegramUserId: "123456789", telegramUsername: "testuser", status: "active", pairedAt: new Date() }
  ]),
  addTelegramPairedUser: vi.fn().mockResolvedValue({ id: 1 }),
  revokeTelegramPairedUser: vi.fn().mockResolvedValue(true),
  deleteTelegramPairedUser: vi.fn().mockResolvedValue(true),
  getTelegramAllowlist: vi.fn().mockResolvedValue([
    { id: 1, telegramUserId: "987654321", telegramUsername: "alloweduser", addedAt: new Date() }
  ]),
  addToTelegramAllowlist: vi.fn().mockResolvedValue({ id: 1 }),
  removeFromTelegramAllowlist: vi.fn().mockResolvedValue(true),
  batchAddToTelegramAllowlist: vi.fn().mockResolvedValue(3),
}));

// Mock fs for config file operations
vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(JSON.stringify({
    channels: {
      telegram: {
        enabled: true,
        dmPolicy: "open",
        allowFrom: ["*"]
      }
    }
  })),
  writeFile: vi.fn().mockResolvedValue(undefined),
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
    walletAddress: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
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

describe("telegram access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getConfig", () => {
    it("returns telegram configuration", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.getConfig();

      expect(result).toBeDefined();
      expect(result.dmPolicy).toBe("open");
    });
  });

  describe("setDmPolicy", () => {
    it("updates dm policy to pairing", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.setDmPolicy({ policy: "pairing" });

      expect(result.success).toBe(true);
    });

    it("updates dm policy to allowlist", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.setDmPolicy({ policy: "allowlist" });

      expect(result.success).toBe(true);
    });
  });

  describe("pairing codes", () => {
    it("generates a pairing code", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.generatePairingCode({ expiresInHours: 24 });

      expect(result).toBeDefined();
      expect(result.code).toBe("TEST123");
    });

    it("lists pairing codes", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.listPairingCodes();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].code).toBe("TEST123");
    });

    it("revokes a pairing code", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.revokePairingCode({ codeId: 1 });

      expect(result.success).toBe(true);
    });
  });

  describe("paired users", () => {
    it("lists paired users", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.listPairedUsers();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].telegramUserId).toBe("123456789");
    });

    it("adds a paired user manually", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.addPairedUser({
        telegramUserId: "111222333",
        telegramUsername: "newuser",
        telegramName: "New User",
        notes: "Test user",
      });

      expect(result).toBeDefined();
    });

    it("revokes a paired user", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.revokePairedUser({ telegramUserId: "123456789" });

      expect(result.success).toBe(true);
    });

    it("deletes a paired user", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.deletePairedUser({ telegramUserId: "123456789" });

      expect(result.success).toBe(true);
    });
  });

  describe("allowlist", () => {
    it("lists allowlist users", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.listAllowlist();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].telegramUserId).toBe("987654321");
    });

    it("adds a user to allowlist", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.addToAllowlist({
        telegramUserId: "555666777",
        telegramUsername: "alloweduser2",
        notes: "VIP user",
      });

      expect(result).toBeDefined();
    });

    it("removes a user from allowlist", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.removeFromAllowlist({ telegramUserId: "987654321" });

      expect(result.success).toBe(true);
    });

    it("batch imports users to allowlist", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.batchImportAllowlist({
        users: [
          { telegramUserId: "111111111" },
          { telegramUserId: "222222222", telegramUsername: "user2" },
          { telegramUserId: "333333333", telegramUsername: "user3", notes: "Note" },
        ],
      });

      expect(result.addedCount).toBe(3);
      expect(result.success).toBe(true);
    });
  });

  describe("syncToGateway", () => {
    it("syncs configuration to gateway", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.telegram.syncToGateway();

      expect(result.success).toBe(true);
    });
  });
});
