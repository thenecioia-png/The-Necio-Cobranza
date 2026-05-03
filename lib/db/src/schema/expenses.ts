import { pgTable, varchar, serial, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const EXPENSE_CATEGORIES = [
  "gasolina",
  "comida",
  "agua",
  "reparacion_moto",
  "reparacion_vehiculo",
  "comunicacion",
  "herramientas",
  "otro",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  gasolina: "Gasolina",
  comida: "Comida",
  agua: "Agua",
  reparacion_moto: "Reparación de Moto",
  reparacion_vehiculo: "Reparación de Vehículo",
  comunicacion: "Comunicación",
  herramientas: "Herramientas",
  otro: "Otro",
};

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  category: varchar("category", { length: 50 }).notNull().default("otro"),
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: varchar("date", { length: 50 }).notNull(),
  notes: varchar("notes", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
