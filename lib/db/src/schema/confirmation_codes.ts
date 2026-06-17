import { pgTable, varchar, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const confirmationCodesTable = pgTable("confirmation_codes", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 100 }).notNull(),
  targetId: varchar("target_id", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ConfirmationCode = typeof confirmationCodesTable.$inferSelect;
export type InsertConfirmationCode = typeof confirmationCodesTable.$inferInsert;
