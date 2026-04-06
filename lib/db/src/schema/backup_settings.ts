import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businessesTable } from "./businesses";

export const backupSettingsTable = sqliteTable("backup_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").references(() => businessesTable.id),
  email: text("email").notNull(),
  frequency: text("frequency").notNull().default("weekly"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastSentAt: integer("last_sent_at", { mode: "timestamp" }),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
