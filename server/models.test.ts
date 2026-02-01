import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  getCustomModels: vi.fn().mockResolvedValue([]),
  addCustomModel: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    name: "Test Model",
    provider: "openrouter",
    modelId: "openrouter/test/model",
    createdAt: new Date(),
  }),
  deleteCustomModel: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getUserByWalletAddress: vi.fn(),
  upsertUserByWallet: vi.fn(),
  isUserAdmin: vi.fn(),
  getAllUsers: vi.fn(),
  updateUserRole: vi.fn(),
}));

// Mock child_process for shell commands
vi.mock("child_process", () => ({
  exec: vi.fn((cmd, opts, callback) => {
    if (typeof opts === "function") {
      callback = opts;
    }
    // Mock successful execution
    if (callback) {
      callback(null, { stdout: "openrouter/auto\n", stderr: "" });
    }
    return { stdout: "openrouter/auto\n", stderr: "" };
  }),
}));

vi.mock("util", () => ({
  promisify: vi.fn((fn) => {
    return async () => ({ stdout: "openrouter/auto\n", stderr: "" });
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
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
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("models router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("models.getActive", () => {
    it("returns the active model ID for authenticated users", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.models.getActive();

      expect(result).toHaveProperty("modelId");
      expect(typeof result.modelId).toBe("string");
    });
  });

  describe("models.listCustom", () => {
    it("returns empty array when no custom models exist", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.models.listCustom();

      expect(Array.isArray(result)).toBe(true);
    });

    it("throws error for unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.models.listCustom()).rejects.toThrow();
    });
  });

  describe("models.addCustom", () => {
    it("adds a custom model for authenticated users", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.models.addCustom({
        name: "Test Model",
        provider: "openrouter",
        modelId: "openrouter/test/model",
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("name", "Test Model");
    });

    it("validates required fields", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.models.addCustom({
          name: "",
          provider: "openrouter",
          modelId: "test",
        })
      ).rejects.toThrow();
    });
  });

  describe("models.deleteCustom", () => {
    it("deletes a custom model for authenticated users", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.models.deleteCustom({ id: 1 });

      expect(result).toEqual({ success: true });
    });
  });
});
