import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessesTable = sqliteTable("businesses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  planType: text("plan_type").notNull().default("basic"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(false),
  // Cuenta bancaria del dueño del sistema (para cobros por transferencia)
  bancoBanco: text("banco_banco"),
  bancoCuenta: text("banco_cuenta"),
  bancoTitular: text("banco_titular"),
  // Email y SMTP para envío de comprobantes
  emailSmtpUser: text("email_smtp_user"),
  emailSmtpPass: text("email_smtp_pass"),
  // Stripe
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("inactive"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({ id: true, createdAt: true });
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
