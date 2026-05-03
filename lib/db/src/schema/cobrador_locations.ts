import { pgTable, serial, integer, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Ubicación GPS en tiempo real de cada cobrador.
 * Una fila por cobrador (upsert al actualizar).
 */
export const cobradorLocationsTable = pgTable("cobrador_locations", {
  id: serial("id").primaryKey(),
  cobradorId: integer("cobrador_id").notNull().unique().references(() => usersTable.id),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CobradorLocation = typeof cobradorLocationsTable.$inferSelect;
