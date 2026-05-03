import { pgTable, varchar, serial, integer, decimal, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { loansTable } from "./loans";
import { clientsTable } from "./clients";

export const installmentsTable = pgTable("installments", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").notNull().references(() => loansTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  dueDate: varchar("due_date", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paymentMethod: varchar("payment_method", { length: 50 }).default("efectivo"),
  gpsLat: doublePrecision("gps_lat"),
  gpsLng: doublePrecision("gps_lng"),
  photoUrl: varchar("photo_url", { length: 500 }),
  cobradorId: integer("cobrador_id"),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
});

export const insertInstallmentSchema = createInsertSchema(installmentsTable).omit({ id: true });
export type InsertInstallment = z.infer<typeof insertInstallmentSchema>;
export type Installment = typeof installmentsTable.$inferSelect;
