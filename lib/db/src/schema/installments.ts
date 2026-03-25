import { pgTable, text, serial, timestamp, integer, numeric, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { loansTable } from "./loans";

export const installmentsTable = pgTable("installments", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").notNull().references(() => loansTable.id),
  dueDate: text("due_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method").default("efectivo"),
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  photoUrl: text("photo_url"),
  cobradorId: integer("cobrador_id"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0"),
});

export const insertInstallmentSchema = createInsertSchema(installmentsTable).omit({ id: true });
export type InsertInstallment = z.infer<typeof insertInstallmentSchema>;
export type Installment = typeof installmentsTable.$inferSelect;
