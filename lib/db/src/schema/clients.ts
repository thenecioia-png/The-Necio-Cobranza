import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  apodo: text("apodo"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  address: text("address"),
  sector: text("sector"),
  ciudad: text("ciudad"),
  cedula: text("cedula"),
  status: text("status").notNull().default("active"),
  riskScore: integer("risk_score").notNull().default(50),
  notes: text("notes"),
  fiadorName: text("fiador_name"),
  fiadorPhone: text("fiador_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
