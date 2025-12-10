// /home/ubuntu/untap/server/services.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getActiveServices: vi.fn().mockResolvedValue([
    {
      id: 1,
      slug: "openai",
      displayName: "OpenAI",
      category: "AI",
      homepageUrl: "https://openai.com",
      checkType: "http",
      checkTarget: "https://api.openai.com/v1/models",
      expectedStatus: 401,
      isActive: true,
      isCritical: true,
    },
    {
      id: 2,
      slug: "github",
      displayName: "GitHub",
      category: "Developer",
      homepageUrl: "https://github.com",
      checkType: "http",
      checkTarget: "https://api.github.com",
      expectedStatus: 200,
      isActive: true,
      isCritical: true,
    },
  ]),
  getServiceBySlug: vi.fn().mockImplementation((slug: string) => {
    if (slug === "openai") {
      return Promise.resolve({
        id: 1,
        slug: "openai",
        displayName: "OpenAI",
        category: "AI",
        homepageUrl: "https://openai.com",
        checkType: "http",
        checkTarget: "https://api.openai.com/v1/models",
        expectedStatus: 401,
        isActive: true,
        isCritical: true,
      });
    }
    return Promise.resolve(undefined);
  }),
  getLatestCheckResult: vi.fn().mockResolvedValue({
    id: 1,
    serviceId: 1,
    checkedAt: new Date(),
    checkType: "http",
    success: true,
    httpStatus: 401,
    latencyMs: 250,
    errorCode: null,
    errorMessage: null,
  }),
  getRecentCheckResults: vi.fn().mockResolvedValue([
    { success: true, checkedAt: new Date() },
    { success: true, checkedAt: new Date() },
    { success: true, checkedAt: new Date() },
  ]),
  getCheckResultsInWindow: vi.fn().mockResolvedValue([
    { t: new Date(), success: true, latencyMs: 250, httpStatus: 401, errorCode: null },
    { t: new Date(), success: true, latencyMs: 230, httpStatus: 401, errorCode: null },
  ]),
  getOpenIncident: vi.fn().mockResolvedValue(null),
  getRecentIncidents: vi.fn().mockResolvedValue([]),
  getIncidentsForService: vi.fn().mockResolvedValue([]),
  getAllOpenIncidents: vi.fn().mockResolvedValue([]),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("services.list", () => {
  it("returns a list of services with status information", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.services.list();

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty("slug");
    expect(result[0]).toHaveProperty("displayName");
    expect(result[0]).toHaveProperty("currentStatus");
    expect(result[0]).toHaveProperty("lastCheck");
  });

  it("includes correct status derivation", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.services.list();

    // With all successful checks, status should be "ok"
    expect(result[0].currentStatus).toBe("ok");
  });
});

describe("services.getBySlug", () => {
  it("returns service details for valid slug", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.services.getBySlug({ slug: "openai", window: "24h" });

    expect(result).not.toBeNull();
    expect(result?.service.slug).toBe("openai");
    expect(result?.service.displayName).toBe("OpenAI");
    expect(result).toHaveProperty("currentStatus");
    expect(result).toHaveProperty("checks");
    expect(result).toHaveProperty("incidents");
  });

  it("returns null for invalid slug", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.services.getBySlug({ slug: "nonexistent", window: "24h" });

    expect(result).toBeNull();
  });
});

describe("incidents.recent", () => {
  it("returns recent incidents list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.incidents.recent({ limit: 10 });

    expect(result).toBeInstanceOf(Array);
  });
});

describe("incidents.open", () => {
  it("returns open incidents list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.incidents.open();

    expect(result).toBeInstanceOf(Array);
  });
});
