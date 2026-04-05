import { pgTable, serial, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  externalId: text("external_id"),
  fromEntity: text("from_entity").notNull(),
  toEntity: text("to_entity").notNull(),
  amount: numeric("amount", { precision: 30, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("BRL"),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  gateway: text("gateway"),
  metadata: text("metadata"),
  aiAnalysis: text("ai_analysis"),
  riskScore: integer("risk_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
