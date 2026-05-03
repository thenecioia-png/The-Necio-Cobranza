import { pgTable, varchar, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

export const backupSettingsTable = pgTable("backup_settings", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessesTable.id),
  email: varchar("email", { length: 255 }).notNull(),
  frequency: varchar("frequency", { length: 50 }).notNull().default("weekly"),
  enabled: boolean("enabled").notNull().default(true),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpPass: varchar("smtp_pass", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
