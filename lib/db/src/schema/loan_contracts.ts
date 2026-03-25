import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { loansTable } from "./loans";
import { clientsTable } from "./clients";

export const loanContractsTable = pgTable("loan_contracts", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").notNull().references(() => loansTable.id),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  businessId: integer("business_id"),
  contractHtml: text("contract_html"),
  signatureBase64: text("signature_base64"),
  signedAt: timestamp("signed_at"),
  signerName: text("signer_name"),
  signerIp: text("signer_ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLoanContractSchema = createInsertSchema(loanContractsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoanContract = z.infer<typeof insertLoanContractSchema>;
export type LoanContract = typeof loanContractsTable.$inferSelect;
