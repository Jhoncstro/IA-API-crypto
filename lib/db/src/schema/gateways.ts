import { pgTable, serial, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gateways = pgTable("gateways", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  totalVolume: numeric("total_volume", { precision: 30, scale: 2 }).default("0"),
  transactionCount: integer("transaction_count").default(0),
  successRate: numeric("success_rate", { precision: 5, scale: 2 }).default("0"),
  avgLatencyMs: integer("avg_latency_ms").default(0),
  status: text("status").notNull().default("active"),
  aiAnalysis: text("ai_analysis"),
  lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGatewaySchema = createInsertSchema(gateways).omit({
  id: true,
  createdAt: true,
});

export type Gateway = typeof gateways.$inferSelect;
export type InsertGateway = z.infer<typeof insertGatewaySchema>;
