import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  upsertUserByWallet: vi.fn(),
  getAllUsers: vi.fn(),
  updateUserRole: vi.fn(),
}));

// Mock the sdk module
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
  },
}));

import * as db from "./db";
import { sdk } from "./_core/sdk";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createMockContext(user: TrpcContext["user"] = null): {
  ctx: TrpcContext;
  setCookies: CookieCall[];
  clearedCookies: CookieCall[];
} {
  const setCookies: CookieCall[] = [];
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, setCookies, clearedCookies };
}

describe("wallet authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("walletLogin", () => {
    it("should reject invalid wallet address format", async () => {
      const { ctx } = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.walletLogin({
          walletAddress: "invalid-address",
        })
      ).rejects.toThrow("Invalid wallet address");
    });

    it("should reject non-admin users", async () => {
      const mockUser = {
        id: 1,
        openId: "wallet_0x1234567890abcdef1234567890abcdef12345678",
        name: "Test User",
        email: null,
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        loginMethod: "wallet",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      vi.mocked(db.upsertUserByWallet).mockResolvedValue(mockUser);

      const { ctx } = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.walletLogin({
          walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        })
      ).rejects.toThrow("Access denied");
    });

    it("should allow admin users to login", async () => {
      const mockUser = {
        id: 1,
        openId: "wallet_0x1234567890abcdef1234567890abcdef12345678",
        name: "Admin User",
        email: null,
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        loginMethod: "wallet",
        role: "admin" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      vi.mocked(db.upsertUserByWallet).mockResolvedValue(mockUser);

      const { ctx, setCookies } = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.walletLogin({
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      });

      expect(result.success).toBe(true);
      expect(result.user.role).toBe("admin");
      expect(setCookies).toHaveLength(1);
      expect(db.upsertUserByWallet).toHaveBeenCalledWith(
        "0x1234567890abcdef1234567890abcdef12345678"
      );
    });

    it("should handle case-insensitive wallet addresses", async () => {
      const mockUser = {
        id: 1,
        openId: "wallet_0xabcdef1234567890abcdef1234567890abcdef12",
        name: "Admin User",
        email: null,
        walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        loginMethod: "wallet",
        role: "admin" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      vi.mocked(db.upsertUserByWallet).mockResolvedValue(mockUser);

      const { ctx } = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.walletLogin({
        walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("auth.me", () => {
    it("should return null for unauthenticated users", async () => {
      const { ctx } = createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it("should return user for authenticated users", async () => {
      const mockUser = {
        id: 1,
        openId: "test-user",
        name: "Test User",
        email: "test@example.com",
        walletAddress: null,
        loginMethod: "manus",
        role: "admin" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      const { ctx } = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();
      expect(result).toEqual(mockUser);
    });
  });
});
