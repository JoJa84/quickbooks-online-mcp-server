import { updateQuickbooksCreditMemo } from "../handlers/update-quickbooks-credit-memo.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "update_credit_memo";
const toolDescription =
  "Update an existing credit memo in QuickBooks Online (sparse update: only the fields given change). " +
  "custom_fields sets sales-form custom fields; the field must already be defined in the company's sales form settings.";

const customFieldSchema = z.object({
  definition_id: z
    .string()
    .min(1)
    .describe("CustomField DefinitionId; see get_preferences SalesFormsPrefs.CustomField or any existing credit memo"),
  name: z.string().min(1).describe("Field name exactly as QuickBooks shows it, e.g. 'Utility Account No.'"),
  value: z.string().describe("Text value (QuickBooks only supports StringType on sales forms)"),
});

const toolSchema = z.object({
  id: z.string().min(1).describe("Credit Memo ID"),
  sync_token: z.string().min(1).describe("Sync token for optimistic locking"),
  customer_ref: z.string().optional().describe("Customer ID"),
  private_note: z.string().optional().describe("Private note"),
  doc_number: z.string().optional().describe("Document number"),
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
    .describe("Billing email address (QBO BillEmail)"),
});

const toolHandler = async ({ params }: any) => {
  const response = await updateQuickbooksCreditMemo(params);
  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error updating credit memo: ${response.error}` }] };
  }
  return {
    content: [
      { type: "text" as const, text: `Credit memo updated successfully:` },
      { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
    ],
  };
};

export const UpdateCreditMemoTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
