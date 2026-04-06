import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Registro de cada pago recibido (contabilidad del dueño del sistema)
 */
export const pagosRecibidosTable = sqliteTable("pagos_recibidos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id"),
  clienteNombre: text("cliente_nombre").notNull(),
  clienteEmail: text("cliente_email"),
  monto: real("monto").notNull(),
  concepto: text("concepto").notNull(),
  // transferencia | efectivo | otro
  metodo: text("metodo").notNull().default("transferencia"),
  // YYYY-MM-DD
  fecha: text("fecha").notNull(),
  referencia: text("referencia"),
  notas: text("notas"),
  comprobanteEnviado: integer("comprobante_enviado", { mode: "boolean" }).default(false),
  creadoEn: integer("creado_en", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const insertPagoRecibidoSchema = createInsertSchema(pagosRecibidosTable).omit({ id: true, creadoEn: true });
export type InsertPagoRecibido = z.infer<typeof insertPagoRecibidoSchema>;
export type PagoRecibido = typeof pagosRecibidosTable.$inferSelect;
