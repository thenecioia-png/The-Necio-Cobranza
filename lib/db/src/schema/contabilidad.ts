import { pgTable, varchar, serial, integer, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Registro de cada pago recibido (contabilidad del dueño del sistema)
 */
export const pagosRecibidosTable = pgTable("pagos_recibidos", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id"),
  clienteNombre: varchar("cliente_nombre", { length: 255 }).notNull(),
  clienteEmail: varchar("cliente_email", { length: 255 }),
  monto: decimal("monto", { precision: 12, scale: 2 }).notNull(),
  concepto: varchar("concepto", { length: 255 }).notNull(),
  // transferencia | efectivo | otro
  metodo: varchar("metodo", { length: 50 }).notNull().default("transferencia"),
  // YYYY-MM-DD
  fecha: varchar("fecha", { length: 50 }).notNull(),
  referencia: varchar("referencia", { length: 255 }),
  notas: varchar("notas", { length: 1000 }),
  comprobanteEnviado: boolean("comprobante_enviado").default(false),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPagoRecibidoSchema = createInsertSchema(pagosRecibidosTable).omit({ id: true, creadoEn: true });
export type InsertPagoRecibido = z.infer<typeof insertPagoRecibidoSchema>;
export type PagoRecibido = typeof pagosRecibidosTable.$inferSelect;
