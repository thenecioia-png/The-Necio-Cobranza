import { pgTable, varchar, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  planType: varchar("plan_type", { length: 50 }).notNull().default("basic"),
  activo: boolean("activo").notNull().default(false),
  // Cuenta bancaria del dueño del sistema (para cobros por transferencia)
  bancoBanco: varchar("banco_banco", { length: 255 }),
  bancoCuenta: varchar("banco_cuenta", { length: 255 }),
  bancoTitular: varchar("banco_titular", { length: 255 }),
  // Email y SMTP para envío de comprobantes
  emailSmtpUser: varchar("email_smtp_user", { length: 255 }),
  emailSmtpPass: varchar("email_smtp_pass", { length: 255 }),
  // Stripe
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  subscriptionStatus: varchar("subscription_status", { length: 50 }).default("inactive"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({ id: true, createdAt: true });
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
