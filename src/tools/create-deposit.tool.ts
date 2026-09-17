import { createQuickbooksDeposit } from "../handlers/create-quickbooks-deposit.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "create_deposit";
const toolDescription =
  "Create a bank deposit in QuickBooks Online. Each line posts to an account (income, a clearing " +
  "account, etc.) and may name the customer or vendor it came from via entity_ref. A NEGATIVE " +
  "line amount is allowed for deductions taken out of the deposit, such as a bank or merchant fee " +
  "posted to an expense account.";

const entityRefSchema = z.object({
  type: z
    .enum(["Customer", "Vendor", "Employee"])
    .describe("Kind of name on this line"),
  value: z.string().min(1).describe("Id of the customer, vendor or employee"),
});

const lineItemSchema = z.object({
  amount: z
    .number()
    .refine((v) => v !== 0, { message: "Line amount must not be zero" })
    .describe("Amount; negative for a fee or other deduction from the deposit"),
  account_ref: z.string().optional().describe("Account Id the line posts to (e.g. an income or expense account)"),
  entity_ref: entityRefSchema.optional().describe("Customer/vendor/employee the money came from (received from)"),
  description: z.string().optional(),
});

const toolSchema = z.object({
  deposit_to_account_ref: z.string().min(1).describe("Bank account ID to deposit to"),
  line_items: z.array(lineItemSchema).min(1).describe("Deposit line items"),
  txn_date: z.string().optional().describe("Transaction date (YYYY-MM-DD)"),
  private_note: z.string().optional().describe("Private note"),
});

const toolHandler = async ({ params }: any) => {
  const response = await createQuickbooksDeposit(params);
  if (response.isError) return { content: [{ type: "text" as const, text: `Error: ${response.error}` }] };
  return { content: [{ type: "text" as const, text: `Deposit created:` }, { type: "text" as const, text: JSON.stringify(response.result, null, 2) }] };
};

export const CreateDepositTool: ToolDefinition<typeof toolSchema> = { name: toolName, description: toolDescription, schema: toolSchema, handler: toolHandler };
