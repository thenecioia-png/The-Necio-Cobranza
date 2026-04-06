import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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

export const expensesTable = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull(),
  category: text("category").notNull().default("otro"),
  description: text("description").notNull(),
  amount: text("amount").notNull(),
  date: text("date").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
