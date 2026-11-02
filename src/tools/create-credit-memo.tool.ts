import { createQuickbooksCreditMemo } from "../handlers/create-quickbooks-credit-memo.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "create_credit_memo";
const toolDescription =
  "Create a credit memo (customer credit) in QuickBooks Online. custom_fields sets sales-form custom fields " +
  "(e.g. 'Utility Account No.'); the field must already be defined in the company's sales form settings.";

const lineItemSchema = z.object({
  item_ref: z.string().min(1).describe("Item ID"),
  qty: z.number().positive().describe("Quantity"),
  unit_price: z.number().nonnegative().describe("Unit price"),
  description: z.string().optional().describe("Line description"),
  tax_code_ref: z.string().min(1).optional().describe("Tax code for this line: a TaxCode Id for non-US companies (use search_tax_codes), or 'TAX'/'NON' for US companies"),
});

const customFieldSchema = z.object({
  definition_id: z
    .string()
    .min(1)
    .describe("CustomField DefinitionId; see get_preferences SalesFormsPrefs.CustomField or any existing credit memo"),
  name: z.string().min(1).describe("Field name exactly as QuickBooks shows it, e.g. 'Utility Account No.'"),
  value: z.string().describe("Text value (QuickBooks only supports StringType on sales forms)"),
});

const toolSchema = z.object({
  customer_ref: z.string().min(1).describe("Customer ID"),
  line_items: z.array(lineItemSchema).min(1).describe("Line items"),
  txn_date: z.string().optional().describe("Transaction date (YYYY-MM-DD)"),
  doc_number: z.string().optional().describe("Document number"),
  private_note: z.string().optional().describe("Private note"),
  global_tax_calculation: z.enum(["TaxExcluded", "TaxInclusive", "NotApplicable"]).optional().describe("Non-US companies only: whether unit prices exclude or include tax"),
  custom_fields: z
    .array(customFieldSchema)
    .max(3)
    .optional()
    .describe("Sales-form custom fields (QBO CustomField). The field must already be defined in the company settings"),
  customer_memo: z
    .string()
    .min(1)
    .optional()
    .describe("Customer-facing message printed on the credit memo (QBO CustomerMemo)"),
  bill_email: z
    .string()
    .min(1)
    .optional()
    .describe("Billing email address (QBO BillEmail). Falls back to the customer default if omitted"),
});

const toolHandler = async ({ params }: any) => {
  const response = await createQuickbooksCreditMemo(params);
  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error creating credit memo: ${response.error}` }] };
  }
  return {
    content: [
      { type: "text" as const, text: `Credit memo created successfully:` },
      { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
    ],
  };
};

export const CreateCreditMemoTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
