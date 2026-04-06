import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { loansTable } from "./loans";
import { clientsTable } from "./clients";

export const loanContractsTable = sqliteTable("loan_contracts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  loanId: integer("loan_id").notNull().references(() => loansTable.id),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  businessId: integer("business_id"),
  contractHtml: text("contract_html"),
  signatureBase64: text("signature_base64"),
  signedAt: integer("signed_at", { mode: "timestamp" }),
  signerName: text("signer_name"),
  signerIp: text("signer_ip"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const insertLoanContractSchema = createInsertSchema(loanContractsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoanContract = z.infer<typeof insertLoanContractSchema>;
export type LoanContract = typeof loanContractsTable.$inferSelect;
