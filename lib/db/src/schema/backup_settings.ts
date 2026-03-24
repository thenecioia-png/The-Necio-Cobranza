import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

export const backupSettingsTable = pgTable("backup_settings", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessesTable.id),
  email: text("email").notNull(),
  frequency: text("frequency").notNull().default("weekly"),
  enabled: boolean("enabled").notNull().default(true),
  lastSentAt: timestamp("last_sent_at"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
