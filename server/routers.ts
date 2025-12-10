// /home/ubuntu/untap/server/routers.ts
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getAllServices,
  getActiveServices,
  getServiceBySlug,
  getLatestCheckResult,
  getRecentCheckResults,
  getCheckResultsInWindow,
  getCheckResultsForExport,
  getOpenIncident,
  getRecentIncidents,
  getIncidentsForService,
  getIncidentsForExport,
  getAllOpenIncidents,
  createService,
  updateService,
  getCriticalServices,
} from "./db";
import { runHealthChecks, startWorker, stopWorker } from "./worker";
import { seedDatabase } from "./seed";
import { notifyOwner } from "./_core/notification";

// Status derivation logic
type ServiceStatus = "ok" | "degraded" | "down";

async function deriveServiceStatus(serviceId: number): Promise<{ status: ServiceStatus; failureRate: number }> {
  const recentChecks = await getRecentCheckResults(serviceId, 5);
  
  if (recentChecks.length === 0) {
    return { status: "ok", failureRate: 0 };
  }

  const failures = recentChecks.filter(c => !c.success).length;
  const failureRate = failures / recentChecks.length;

  if (failureRate >= 0.6) {
    return { status: "down", failureRate };
  } else if (failureRate >= 0.2) {
    return { status: "degraded", failureRate };
  }
  
  return { status: "ok", failureRate };
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Public service status endpoints
  services: router({
    // GET /api/services - status summary for all services
    list: publicProcedure.query(async () => {
      const allServices = await getActiveServices();
      
      const servicesWithStatus = await Promise.all(
        allServices.map(async (service) => {
          const latestCheck = await getLatestCheckResult(service.id);
          const openIncident = await getOpenIncident(service.id);
          const { status, failureRate } = await deriveServiceStatus(service.id);

          return {
            slug: service.slug,
            displayName: service.displayName,
            category: service.category,
            homepageUrl: service.homepageUrl,
            currentStatus: status,
            lastCheck: latestCheck?.checkedAt || null,
            latencyMs: latestCheck?.latencyMs || null,
            failureRate: Math.round(failureRate * 100),
            openIncident: openIncident ? {
              id: Number(openIncident.id),
              startedAt: openIncident.startedAt,
              failureRate: openIncident.failureRate,
            } : null,
          };
        })
      );

      return servicesWithStatus;
    }),

    // GET /api/services/[slug]/status - detailed service view
    getBySlug: publicProcedure
      .input(z.object({ 
        slug: z.string(),
        window: z.enum(["1h", "6h", "12h", "24h", "7d"]).default("24h"),
      }))
      .query(async ({ input }) => {
        const service = await getServiceBySlug(input.slug);
        
        if (!service) {
          return null;
        }

        // Calculate time window
        const windowHours: Record<string, number> = {
          "1h": 1,
          "6h": 6,
          "12h": 12,
          "24h": 24,
          "7d": 168,
        };
        const hours = windowHours[input.window] || 24;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        const endTime = new Date();

        const checks = await getCheckResultsInWindow(service.id, startTime, endTime);
        const incidents = await getIncidentsForService(service.id, 20);
        const { status, failureRate } = await deriveServiceStatus(service.id);

        return {
          service: {
            slug: service.slug,
            displayName: service.displayName,
            category: service.category,
            homepageUrl: service.homepageUrl,
            checkType: service.checkType,
            checkTarget: service.checkTarget,
            expectedStatus: service.expectedStatus,
            isCritical: service.isCritical,
          },
          currentStatus: status,
          failureRate: Math.round(failureRate * 100),
          checks: checks.map(c => ({
            t: c.checkedAt,
            success: c.success,
            latencyMs: c.latencyMs,
            httpStatus: c.httpStatus,
            errorCode: c.errorCode,
          })).reverse(), // Oldest first for chart
          incidents: incidents.map(i => ({
            id: Number(i.id),
            startedAt: i.startedAt,
            endedAt: i.endedAt,
            status: i.status,
            failureRate: i.failureRate,
            summary: i.summary,
          })),
        };
      }),

    // Get all categories
    categories: publicProcedure.query(async () => {
      const allServices = await getActiveServices();
      const categories = Array.from(new Set(allServices.map(s => s.category).filter(Boolean)));
      return categories as string[];
    }),
  }),

  // Incidents endpoints
  incidents: router({
    // Get recent incidents across all services
    recent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
      .query(async ({ input }) => {
        const incidents = await getRecentIncidents(input.limit);
        return incidents.map(i => ({
          id: Number(i.id),
          serviceSlug: i.service?.slug || null,
          serviceName: i.service?.displayName || null,
          startedAt: i.startedAt,
          endedAt: i.endedAt,
          status: i.status,
          failureRate: i.failureRate,
          summary: i.summary,
        }));
      }),

    // Get all currently open incidents
    open: publicProcedure.query(async () => {
      const incidents = await getAllOpenIncidents();
      return incidents.map(i => ({
        id: Number(i.id),
        serviceSlug: i.service?.slug || null,
        serviceName: i.service?.displayName || null,
        startedAt: i.startedAt,
        failureRate: i.failureRate,
        summary: i.summary,
      }));
    }),
  }),

  // Admin/operator endpoints
  admin: router({
    // Trigger manual health check run
    runChecks: protectedProcedure.mutation(async () => {
      const result = await runHealthChecks();
      return result;
    }),

    // Start the worker
    startWorker: protectedProcedure.mutation(async () => {
      startWorker(60000);
      return { success: true, message: "Worker started with 60s interval" };
    }),

    // Stop the worker
    stopWorker: protectedProcedure.mutation(async () => {
      stopWorker();
      return { success: true, message: "Worker stopped" };
    }),

    // Seed database
    seedDatabase: protectedProcedure.mutation(async () => {
      await seedDatabase();
      return { success: true, message: "Database seeded" };
    }),

    // Get all services (including inactive)
    allServices: protectedProcedure.query(async () => {
      return getAllServices();
    }),

    // Create new service
    createService: protectedProcedure
      .input(z.object({
        slug: z.string().min(1).max(128),
        displayName: z.string().min(1).max(256),
        category: z.string().max(64).optional(),
        homepageUrl: z.string().url().optional(),
        checkType: z.enum(["http", "tcp", "icmp"]),
        checkTarget: z.string().min(1),
        expectedStatus: z.number().int().optional().default(200),
        expectedBody: z.string().optional(),
        timeoutMs: z.number().int().optional().default(5000),
        checkIntervalS: z.number().int().optional().default(60),
        isActive: z.boolean().optional().default(true),
        isCritical: z.boolean().optional().default(false),
      }))
      .mutation(async ({ input }) => {
        await createService(input);
        return { success: true };
      }),

    // Update service
    updateService: protectedProcedure
      .input(z.object({
        id: z.number(),
        updates: z.object({
          displayName: z.string().min(1).max(256).optional(),
          category: z.string().max(64).optional(),
          homepageUrl: z.string().url().optional(),
          checkTarget: z.string().min(1).optional(),
          expectedStatus: z.number().int().optional(),
          expectedBody: z.string().optional(),
          timeoutMs: z.number().int().optional(),
          checkIntervalS: z.number().int().optional(),
          isActive: z.boolean().optional(),
          isCritical: z.boolean().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        await updateService(input.id, input.updates);
        return { success: true };
      }),

    // Send test notification
    testNotification: protectedProcedure.mutation(async () => {
      const result = await notifyOwner({
        title: "🧪 Test Notification from untap",
        content: "This is a test notification to verify the notification system is working correctly.",
      });
      return { success: result };
    }),
  }),

  // Export endpoints for analytics
  export: router({
    // Export check results
    checkResults: protectedProcedure
      .input(z.object({
        startTime: z.date(),
        endTime: z.date(),
        limit: z.number().int().min(1).max(50000).default(10000),
      }))
      .query(async ({ input }) => {
        const results = await getCheckResultsForExport(input.startTime, input.endTime, input.limit);
        return results.map(r => ({
          id: Number(r.id),
          serviceId: r.serviceId,
          checkedAt: r.checkedAt,
          checkType: r.checkType,
          success: r.success,
          httpStatus: r.httpStatus,
          latencyMs: r.latencyMs,
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
        }));
      }),

    // Export incidents
    incidents: protectedProcedure
      .input(z.object({
        startTime: z.date(),
        endTime: z.date(),
      }))
      .query(async ({ input }) => {
        const incidents = await getIncidentsForExport(input.startTime, input.endTime);
        return incidents.map(i => ({
          id: Number(i.id),
          serviceId: i.serviceId,
          serviceSlug: i.service?.slug || null,
          serviceName: i.service?.displayName || null,
          startedAt: i.startedAt,
          endedAt: i.endedAt,
          status: i.status,
          failureRate: i.failureRate,
          summary: i.summary,
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;
