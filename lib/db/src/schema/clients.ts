import { pgTable, varchar, serial, integer, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id"),
  name: varchar("name", { length: 255 }).notNull(),
  apodo: varchar("apodo", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  address: varchar("address", { length: 500 }),
  sector: varchar("sector", { length: 255 }),
  ciudad: varchar("ciudad", { length: 255 }),
  cedula: varchar("cedula", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  riskScore: integer("risk_score").notNull().default(50),
  notes: varchar("notes", { length: 2000 }),
  fiadorName: varchar("fiador_name", { length: 255 }),
  fiadorPhone: varchar("fiador_phone", { length: 50 }),
  cobradorId: integer("cobrador_id"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  gpsLat: doublePrecision("gps_lat"),
  gpsLng: doublePrecision("gps_lng"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
