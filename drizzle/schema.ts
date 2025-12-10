// /home/ubuntu/untap/drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, bigint, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Service Catalog - holds config for "what to check" and "how to check it"
 */
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  displayName: varchar("displayName", { length: 256 }).notNull(),
  category: varchar("category", { length: 64 }),
  homepageUrl: text("homepageUrl"),
  checkType: mysqlEnum("checkType", ["http", "tcp", "icmp"]).notNull(),
  checkTarget: text("checkTarget").notNull(),
  expectedStatus: int("expectedStatus").default(200),
  expectedBody: text("expectedBody"),
  timeoutMs: int("timeoutMs").default(5000),
  checkIntervalS: int("checkIntervalS").default(60),
  isActive: boolean("isActive").default(true),
  isCritical: boolean("isCritical").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

/**
 * Check Results - append-only log of all health check results
 * This is the "data exhaust" for analytics
 */
export const checkResults = mysqlTable("check_results", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
  checkType: mysqlEnum("checkType", ["http", "tcp", "icmp"]).notNull(),
  success: boolean("success").notNull(),
  httpStatus: int("httpStatus"),
  latencyMs: int("latencyMs"),
  errorCode: varchar("errorCode", { length: 64 }),
  errorMessage: text("errorMessage"),
  meta: json("meta"),
});

export type CheckResult = typeof checkResults.$inferSelect;
export type InsertCheckResult = typeof checkResults.$inferInsert;

/**
 * Incidents - represents "real" outages derived from multiple failing checks
 */
export const incidents = mysqlTable("incidents", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt"),
  status: mysqlEnum("status", ["open", "resolved"]).default("open").notNull(),
  failureRate: int("failureRate"),
  summary: text("summary"),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  notifiedAt: timestamp("notifiedAt"),
});

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;
