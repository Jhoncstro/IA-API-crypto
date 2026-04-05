import { pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketAssets = pgTable("market_assets", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  assetType: text("asset_type").notNull(),
  currentPrice: numeric("current_price", { precision: 20, scale: 4 }),
  openPrice: numeric("open_price", { precision: 20, scale: 4 }),
  closePrice: numeric("close_price", { precision: 20, scale: 4 }),
  highPrice: numeric("high_price", { precision: 20, scale: 4 }),
  lowPrice: numeric("low_price", { precision: 20, scale: 4 }),
  volume: numeric("volume", { precision: 30, scale: 2 }),
  marketCap: numeric("market_cap", { precision: 30, scale: 2 }),
  changePct: numeric("change_pct", { precision: 8, scale: 4 }),
  aiAnalysis: text("ai_analysis"),
  aiSignal: text("ai_signal"),
  dataDate: text("data_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMarketAssetSchema = createInsertSchema(marketAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MarketAsset = typeof marketAssets.$inferSelect;
export type InsertMarketAsset = z.infer<typeof insertMarketAssetSchema>;
