import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { usersTable } from "./users";

/**
 * Ubicación GPS en tiempo real de cada cobrador.
 * Una fila por cobrador (upsert al actualizar).
 */
export const cobradorLocationsTable = sqliteTable("cobrador_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cobradorId: integer("cobrador_id").notNull().unique().references(() => usersTable.id),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type CobradorLocation = typeof cobradorLocationsTable.$inferSelect;
