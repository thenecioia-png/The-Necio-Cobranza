import { pgTable, varchar, serial, integer, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Pagos pendientes por transferencia bancaria — esperando confirmación del admin
 */
export const pagosPendientesTable = pgTable("pagos_pendientes", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id"),
  clienteNombre: varchar("cliente_nombre", { length: 255 }).notNull(),
  clienteEmail: varchar("cliente_email", { length: 255 }),
  monto: decimal("monto", { precision: 12, scale: 2 }).notNull(),
  concepto: varchar("concepto", { length: 255 }).notNull(),
  // pendiente | confirmado | rechazado
  estado: varchar("estado", { length: 50 }).notNull().default("pendiente"),
  // Referencia bancaria que envía el cliente
  referencia: varchar("referencia", { length: 255 }),
  notas: varchar("notas", { length: 1000 }),
  // Si ya se enviaron los datos bancarios al cliente (por WhatsApp u otro medio)
  datosBancariosEnviados: boolean("datos_bancarios_enviados").default(false),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  confirmadoEn: timestamp("confirmado_en", { withTimezone: true }),
});

export const insertPagoPendienteSchema = createInsertSchema(pagosPendientesTable).omit({ id: true, creadoEn: true });
export type InsertPagoPendiente = z.infer<typeof insertPagoPendienteSchema>;
export type PagoPendiente = typeof pagosPendientesTable.$inferSelect;
