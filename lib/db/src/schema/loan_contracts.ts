import { pgTable, varchar, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { loansTable } from "./loans";
import { clientsTable } from "./clients";

export const loanContractsTable = pgTable("loan_contracts", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").notNull().references(() => loansTable.id),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  businessId: integer("business_id"),
  contractHtml: varchar("contract_html", { length: 10000 }),
  signatureBase64: varchar("signature_base64", { length: 50000 }),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  signerName: varchar("signer_name", { length: 255 }),
  signerIp: varchar("signer_ip", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLoanContractSchema = createInsertSchema(loanContractsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoanContract = z.infer<typeof insertLoanContractSchema>;
export type LoanContract = typeof loanContractsTable.$inferSelect;
