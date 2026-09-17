import { createQuickbooksAccount } from "../handlers/create-quickbooks-account.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "create_account";
const toolDescription =
  "Create a chart‑of‑accounts entry in QuickBooks Online. " +
  "To create a sub‑account (nested under a parent), pass parent_id with the " +
  "parent account's Id; the new account's AccountType must match the parent's. " +
  "ALWAYS pass sub_type: when it is omitted QuickBooks picks an arbitrary default " +
  "(a Bank account becomes CashOnHand, an Expense account becomes Travel).";

const toolSchema = z.object({
  name: z.string().min(1),
  type: z
    .string()
    .min(1)
    .describe(
      "QBO AccountType, e.g. Bank, Credit Card, Accounts Receivable, Accounts Payable, Other Current Asset, " +
        "Fixed Asset, Other Current Liability, Long Term Liability, Equity, Income, Other Income, " +
        "Cost of Goods Sold, Expense, Other Expense"
    ),
  sub_type: z
    .string()
    .optional()
    .describe(
      "QBO AccountSubType (strongly recommended). Common values - Bank: Checking, Savings, MoneyMarket, CashOnHand; " +
        "Credit Card: CreditCard; Income: SalesOfProductIncome, ServiceFeeIncome, OtherPrimaryIncome; " +
        "Cost of Goods Sold: SuppliesMaterialsCogs, CostOfLaborCos; Expense: OfficeGeneralAdministrativeExpenses, " +
        "SuppliesMaterials, UtilitiesExpense, RentOrLeaseOfBuildings, Travel, OtherMiscellaneousServiceCost; " +
        "Other Current Liability: AccruedLiabilities, PayrollTaxPayable; Equity: OpeningBalanceEquity, RetainedEarnings"
    ),
  description: z.string().optional(),
  // When set, create the account as a sub-account of this parent (the parent's
  // Id). SubAccount:true and ParentRef:{value:parent_id} are sent to QBO. The
  // new account's AccountType must match the parent's, or QBO rejects it.
  parent_id: z.string().min(1).optional(),
});

const toolHandler = async ({ params }: any) => {
  const response = await createQuickbooksAccount(params);
  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error creating account: ${response.error}` }] };
  }
  return {
    content: [
      { type: "text" as const, text: `Account created successfully:` },
      { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
    ],
  };
};

export const CreateAccountTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 