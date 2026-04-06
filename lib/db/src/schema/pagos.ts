import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Pagos pendientes por transferencia bancaria — esperando confirmación del admin
 */
export const pagosPendientesTable = sqliteTable("pagos_pendientes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id"),
  clienteNombre: text("cliente_nombre").notNull(),
  clienteEmail: text("cliente_email"),
  monto: real("monto").notNull(),
  concepto: text("concepto").notNull(),
  // pendiente | confirmado | rechazado
  estado: text("estado").notNull().default("pendiente"),
  // Referencia bancaria que envía el cliente
  referencia: text("referencia"),
  notas: text("notas"),
  // Si ya se enviaron los datos bancarios al cliente (por WhatsApp u otro medio)
  datosBancariosEnviados: integer("datos_bancarios_enviados", { mode: "boolean" }).default(false),
  creadoEn: integer("creado_en", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  confirmadoEn: integer("confirmado_en", { mode: "timestamp" }),
});

export const insertPagoPendienteSchema = createInsertSchema(pagosPendientesTable).omit({ id: true, creadoEn: true });
export type InsertPagoPendiente = z.infer<typeof insertPagoPendienteSchema>;
export type PagoPendiente = typeof pagosPendientesTable.$inferSelect;
