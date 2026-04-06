import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { loansTable } from "./loans";
import { clientsTable } from "./clients";

export const installmentsTable = sqliteTable("installments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  loanId: integer("loan_id").notNull().references(() => loansTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  dueDate: text("due_date").notNull(),
  amount: text("amount").notNull(),
  status: text("status").notNull().default("pending"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  paymentMethod: text("payment_method").default("efectivo"),
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  photoUrl: text("photo_url"),
  cobradorId: integer("cobrador_id"),
  paidAmount: text("paid_amount").default("0"),
});

export const insertInstallmentSchema = createInsertSchema(installmentsTable).omit({ id: true });
export type InsertInstallment = z.infer<typeof insertInstallmentSchema>;
export type Installment = typeof installmentsTable.$inferSelect;
