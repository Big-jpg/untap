// /home/ubuntu/untap/server/worker.ts
import { 
  getActiveServices, 
  insertCheckResult, 
  getRecentCheckResults,
  getOpenIncident,
  createIncident,
  resolveIncident,
  markIncidentNotified,
  getServiceById
} from "./db";
import { Service, InsertCheckResult } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import * as net from "net";

// Incident detection thresholds
const THRESHOLD_OPEN = 0.6;  // 60% failures to open incident
const THRESHOLD_CLOSE = 0.2; // 20% failures to close incident
const MIN_SAMPLES = 5;       // Minimum samples needed for evaluation
const WINDOW_MINUTES = 5;    // Rolling window for evaluation

interface CheckResult {
  success: boolean;
  latencyMs: number | null;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Execute HTTP health check
 */
async function executeHttpCheck(service: Service): Promise<CheckResult> {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), service.timeoutMs || 5000);

  try {
    const response = await fetch(service.checkTarget, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "untap-monitor/1.0",
      },
    });

    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - startTime);
    const body = await response.text();

    let success = response.status === (service.expectedStatus || 200);
    
    // Check expected body if specified
    if (success && service.expectedBody) {
      success = body.includes(service.expectedBody);
    }

    return {
      success,
      latencyMs,
      httpStatus: response.status,
      errorCode: success ? null : "STATUS_MISMATCH",
      errorMessage: success ? null : `Expected ${service.expectedStatus || 200}, got ${response.status}`,
    };
  } catch (error: any) {
    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - startTime);

    let errorCode = "UNKNOWN";
    let errorMessage = error.message || "Unknown error";

    if (error.name === "AbortError") {
      errorCode = "TIMEOUT";
      errorMessage = `Request timed out after ${service.timeoutMs || 5000}ms`;
    } else if (error.cause?.code === "ECONNRESET") {
      errorCode = "ECONNRESET";
      errorMessage = "Connection reset by peer";
    } else if (error.cause?.code === "ECONNREFUSED") {
      errorCode = "ECONNREFUSED";
      errorMessage = "Connection refused";
    } else if (error.cause?.code === "ENOTFOUND") {
      errorCode = "DNS_FAIL";
      errorMessage = "DNS lookup failed";
    }

    return {
      success: false,
      latencyMs,
      httpStatus: null,
      errorCode,
      errorMessage,
    };
  }
}

/**
 * Execute TCP health check
 */
async function executeTcpCheck(service: Service): Promise<CheckResult> {
  const startTime = performance.now();
  const timeout = service.timeoutMs || 5000;

  // Parse host:port from checkTarget
  const [host, portStr] = service.checkTarget.split(":");
  const port = parseInt(portStr, 10);

  if (!host || isNaN(port)) {
    return {
      success: false,
      latencyMs: null,
      httpStatus: null,
      errorCode: "INVALID_TARGET",
      errorMessage: `Invalid TCP target: ${service.checkTarget}. Expected format: host:port`,
    };
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      const latencyMs = Math.round(performance.now() - startTime);
      cleanup();
      resolve({
        success: true,
        latencyMs,
        httpStatus: null,
        errorCode: null,
        errorMessage: null,
      });
    });

    socket.on("timeout", () => {
      const latencyMs = Math.round(performance.now() - startTime);
      cleanup();
      resolve({
        success: false,
        latencyMs,
        httpStatus: null,
        errorCode: "TIMEOUT",
        errorMessage: `TCP connection timed out after ${timeout}ms`,
      });
    });

    socket.on("error", (error: any) => {
      const latencyMs = Math.round(performance.now() - startTime);
      cleanup();
      resolve({
        success: false,
        latencyMs,
        httpStatus: null,
        errorCode: error.code || "TCP_ERROR",
        errorMessage: error.message || "TCP connection failed",
      });
    });

    socket.connect(port, host);
  });
}

/**
 * Execute ICMP ping check (simplified - uses TCP as fallback since ICMP requires root)
 * In production, you'd use a native ping library or sidecar process
 */
async function executeIcmpCheck(service: Service): Promise<CheckResult> {
  // For ICMP, we'll use TCP port 80 as a proxy since true ICMP requires root
  // In production, use a native ping library or run with elevated privileges
  const target = service.checkTarget.includes(":") 
    ? service.checkTarget 
    : `${service.checkTarget}:80`;
  
  const modifiedService = { ...service, checkTarget: target };
  return executeTcpCheck(modifiedService);
}

/**
 * Execute health check based on check type
 */
async function executeCheck(service: Service): Promise<CheckResult> {
  switch (service.checkType) {
    case "http":
      return executeHttpCheck(service);
    case "tcp":
      return executeTcpCheck(service);
    case "icmp":
      return executeIcmpCheck(service);
    default:
      return {
        success: false,
        latencyMs: null,
        httpStatus: null,
        errorCode: "UNSUPPORTED_CHECK_TYPE",
        errorMessage: `Unsupported check type: ${service.checkType}`,
      };
  }
}

/**
 * Evaluate incident status based on rolling failure rate with hysteresis
 */
async function evaluateIncident(serviceId: number): Promise<void> {
  const recentChecks = await getRecentCheckResults(serviceId, WINDOW_MINUTES);
  const n = recentChecks.length;
  
  if (n < MIN_SAMPLES) {
    return; // Not enough samples to evaluate
  }

  const failures = recentChecks.filter(c => !c.success).length;
  const failureRate = failures / n;
  const failureRatePercent = Math.round(failureRate * 100);

  const currentIncident = await getOpenIncident(serviceId);
  const service = await getServiceById(serviceId);

  if (!currentIncident) {
    // No open incident - check if we should open one
    if (failureRate >= THRESHOLD_OPEN) {
      const earliestFailure = recentChecks
        .filter(c => !c.success)
        .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())[0];
      
      const startedAt = earliestFailure?.checkedAt || new Date();
      
      const incidentId = await createIncident({
        serviceId,
        startedAt: new Date(startedAt),
        status: "open",
        failureRate: failureRatePercent,
        summary: `Service experiencing ${failureRatePercent}% failure rate`,
        details: { recentFailures: failures, totalChecks: n },
      });

      console.log(`[Incident] Opened incident ${incidentId} for service ${serviceId} (${failureRatePercent}% failure rate)`);

      // Send notification for critical services
      if (service?.isCritical) {
        try {
          await notifyOwner({
            title: `🚨 Critical Service Down: ${service.displayName}`,
            content: `The service "${service.displayName}" is experiencing issues.\n\nFailure Rate: ${failureRatePercent}%\nCheck Target: ${service.checkTarget}\n\nIncident opened at ${new Date().toISOString()}`,
          });
          await markIncidentNotified(Number(incidentId));
          console.log(`[Notification] Sent alert for critical service ${service.displayName}`);
        } catch (error) {
          console.error(`[Notification] Failed to send alert:`, error);
        }
      }
    }
  } else {
    // Incident is open - check if we should close it
    if (failureRate <= THRESHOLD_CLOSE) {
      const latestSuccess = recentChecks
        .filter(c => c.success)
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())[0];
      
      const endedAt = latestSuccess?.checkedAt || new Date();
      
      await resolveIncident(Number(currentIncident.id), new Date(endedAt));
      console.log(`[Incident] Resolved incident ${currentIncident.id} for service ${serviceId}`);

      // Send recovery notification for critical services
      if (service?.isCritical) {
        try {
          await notifyOwner({
            title: `✅ Service Recovered: ${service.displayName}`,
            content: `The service "${service.displayName}" has recovered.\n\nCurrent Failure Rate: ${failureRatePercent}%\n\nIncident resolved at ${new Date().toISOString()}`,
          });
        } catch (error) {
          console.error(`[Notification] Failed to send recovery alert:`, error);
        }
      }
    }
  }
}

/**
 * Run health checks for all active services
 */
export async function runHealthChecks(): Promise<{ checked: number; failed: number }> {
  console.log(`[Worker] Starting health check run at ${new Date().toISOString()}`);
  
  const services = await getActiveServices();
  let checked = 0;
  let failed = 0;

  for (const service of services) {
    try {
      const result = await executeCheck(service);
      
      const checkResult: InsertCheckResult = {
        serviceId: service.id,
        checkType: service.checkType,
        success: result.success,
        httpStatus: result.httpStatus,
        latencyMs: result.latencyMs,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        meta: {},
      };

      await insertCheckResult(checkResult);
      checked++;

      if (!result.success) {
        failed++;
        console.log(`[Check] ${service.slug}: FAILED - ${result.errorCode}: ${result.errorMessage}`);
      } else {
        console.log(`[Check] ${service.slug}: OK (${result.latencyMs}ms)`);
      }

      // Evaluate incident status after each check
      await evaluateIncident(service.id);
    } catch (error) {
      console.error(`[Worker] Error checking ${service.slug}:`, error);
      failed++;
    }
  }

  console.log(`[Worker] Health check run complete: ${checked} checked, ${failed} failed`);
  return { checked, failed };
}

/**
 * Start the worker loop (runs every 60 seconds)
 */
let workerInterval: NodeJS.Timeout | null = null;

export function startWorker(intervalMs: number = 60000): void {
  if (workerInterval) {
    console.log("[Worker] Worker already running");
    return;
  }

  console.log(`[Worker] Starting worker with ${intervalMs}ms interval`);
  
  // Run immediately on start
  runHealthChecks().catch(console.error);
  
  // Then run on interval
  workerInterval = setInterval(() => {
    runHealthChecks().catch(console.error);
  }, intervalMs);
}

export function stopWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[Worker] Worker stopped");
  }
}
