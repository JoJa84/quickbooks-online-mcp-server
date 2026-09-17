import { updateQuickbooksInvoice } from "../handlers/update-quickbooks-invoice.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "update_invoice";
const toolDescription =
  "Update an existing invoice in QuickBooks Online by Id (sparse update). Header fields in patch " +
  "(DueDate, CustomerMemo, PrivateNote, DocNumber, TxnDate, ...) are merged onto the invoice. " +
  "WARNING: a patch that contains Line REPLACES ALL existing lines, so include every line you want " +
  "to keep. To add lines without retyping the existing ones, use line_items_to_add instead.";

const addLineSchema = z.object({
  item_ref: z.string().min(1),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
  description: z.string().optional(),
  tax_code_ref: z.string().min(1).optional(),
  service_date: z.string().min(1).optional(),
  class_ref: z.string().min(1).optional(),
});

const toolSchema = z
  .object({
    invoice_id: z.string().min(1),
    patch: z
      .record(z.any())
      .optional()
      .describe("Raw QBO Invoice fields to merge. Including Line replaces all lines."),
    line_items_to_add: z
      .array(addLineSchema)
      .min(1)
      .optional()
      .describe("New sales lines to append after the existing lines (same shape as create_invoice line_items)"),
  })
  .refine((v) => v.patch !== undefined || v.line_items_to_add !== undefined, {
    message: "Provide patch and/or line_items_to_add",
  });

const toolHandler = async ({ params }: any) => {
  const response = await updateQuickbooksInvoice(params);
  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error updating invoice: ${response.error}` }] };
  }
  return {
    content: [
      { type: "text" as const, text: `Invoice updated successfully:` },
      { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
    ],
  };
};

export const UpdateInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 