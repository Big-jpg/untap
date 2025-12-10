// /home/ubuntu/untap/server/db.ts
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  services, 
  checkResults, 
  incidents,
  Service,
  InsertService,
  CheckResult,
  InsertCheckResult,
  Incident,
  InsertIncident
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

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

// ==================== USER QUERIES ====================

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

    const textFields = ["name", "email", "loginMethod"] as const;
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

// ==================== SERVICE QUERIES ====================

export async function getAllServices(): Promise<Service[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(services).orderBy(services.displayName);
}

export async function getActiveServices(): Promise<Service[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(services).where(eq(services.isActive, true)).orderBy(services.displayName);
}

export async function getServiceBySlug(slug: string): Promise<Service | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(services).where(eq(services.slug, slug)).limit(1);
  return result[0];
}

export async function getServiceById(id: number): Promise<Service | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return result[0];
}

export async function createService(service: InsertService): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(services).values(service);
}

export async function updateService(id: number, updates: Partial<InsertService>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(services).set(updates).where(eq(services.id, id));
}

export async function getCriticalServices(): Promise<Service[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(services).where(and(eq(services.isActive, true), eq(services.isCritical, true)));
}

// ==================== CHECK RESULTS QUERIES ====================

export async function insertCheckResult(result: InsertCheckResult): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(checkResults).values(result);
}

export async function getRecentCheckResults(serviceId: number, minutes: number = 5): Promise<CheckResult[]> {
  const db = await getDb();
  if (!db) return [];
  
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  return db.select()
    .from(checkResults)
    .where(and(
      eq(checkResults.serviceId, serviceId),
      gte(checkResults.checkedAt, since)
    ))
    .orderBy(desc(checkResults.checkedAt));
}

export async function getCheckResultsInWindow(serviceId: number, startTime: Date, endTime: Date): Promise<CheckResult[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(checkResults)
    .where(and(
      eq(checkResults.serviceId, serviceId),
      gte(checkResults.checkedAt, startTime),
      lte(checkResults.checkedAt, endTime)
    ))
    .orderBy(desc(checkResults.checkedAt));
}

export async function getLatestCheckResult(serviceId: number): Promise<CheckResult | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select()
    .from(checkResults)
    .where(eq(checkResults.serviceId, serviceId))
    .orderBy(desc(checkResults.checkedAt))
    .limit(1);
  
  return result[0];
}

export async function getCheckResultsForExport(startTime: Date, endTime: Date, limit: number = 10000): Promise<CheckResult[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(checkResults)
    .where(and(
      gte(checkResults.checkedAt, startTime),
      lte(checkResults.checkedAt, endTime)
    ))
    .orderBy(desc(checkResults.checkedAt))
    .limit(limit);
}

// ==================== INCIDENT QUERIES ====================

export async function getOpenIncident(serviceId: number): Promise<Incident | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select()
    .from(incidents)
    .where(and(
      eq(incidents.serviceId, serviceId),
      eq(incidents.status, "open")
    ))
    .orderBy(desc(incidents.startedAt))
    .limit(1);
  
  return result[0];
}

export async function createIncident(incident: InsertIncident): Promise<bigint> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(incidents).values(incident);
  return BigInt(result[0].insertId);
}

export async function resolveIncident(incidentId: number, endedAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(incidents)
    .set({ status: "resolved", endedAt })
    .where(eq(incidents.id, incidentId));
}

export async function markIncidentNotified(incidentId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(incidents)
    .set({ notifiedAt: new Date() })
    .where(eq(incidents.id, incidentId));
}

export async function getRecentIncidents(limit: number = 10): Promise<(Incident & { service?: Service })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(incidents)
    .leftJoin(services, eq(incidents.serviceId, services.id))
    .orderBy(desc(incidents.startedAt))
    .limit(limit);
  
  return result.map(r => ({
    ...r.incidents,
    service: r.services || undefined
  }));
}

export async function getIncidentsForService(serviceId: number, limit: number = 20): Promise<Incident[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(incidents)
    .where(eq(incidents.serviceId, serviceId))
    .orderBy(desc(incidents.startedAt))
    .limit(limit);
}

export async function getIncidentsForExport(startTime: Date, endTime: Date): Promise<(Incident & { service?: Service })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(incidents)
    .leftJoin(services, eq(incidents.serviceId, services.id))
    .where(and(
      gte(incidents.startedAt, startTime),
      lte(incidents.startedAt, endTime)
    ))
    .orderBy(desc(incidents.startedAt));
  
  return result.map(r => ({
    ...r.incidents,
    service: r.services || undefined
  }));
}

export async function getAllOpenIncidents(): Promise<(Incident & { service?: Service })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(incidents)
    .leftJoin(services, eq(incidents.serviceId, services.id))
    .where(eq(incidents.status, "open"))
    .orderBy(desc(incidents.startedAt));
  
  return result.map(r => ({
    ...r.incidents,
    service: r.services || undefined
  }));
}
