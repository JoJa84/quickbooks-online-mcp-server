import { QuickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface UpdateInvoiceInput {
  invoice_id: string;
  patch?: Record<string, any>; // Sparse update fields per Quickbooks spec
  line_items_to_add?: Array<{
    item_ref: string;
    qty: number;
    unit_price: number;
    description?: string;
    tax_code_ref?: string;
    service_date?: string;
    class_ref?: string;
  }>;
}

export async function updateQuickbooksInvoice({ invoice_id, patch, line_items_to_add }: UpdateInvoiceInput): Promise<ToolResponse<any>> {
  try {
    const quickbooks = await QuickbooksClient.getInstance();

    // Need SyncToken; fetch existing invoice first
    const existing: any = await new Promise((res, rej) => {
      (quickbooks as any).getInvoice(invoice_id, (e: any, inv: any) => (e ? rej(e) : res(inv)));
    });

    const updatePayload: any = { ...existing, ...(patch ?? {}), Id: invoice_id, sparse: true };

    // Append new lines to whatever lines the invoice will have after the patch.
    // A patch that includes Line REPLACES the whole array (QBO semantics), so the
    // append is applied on top of the patched lines, else on the existing ones.
    if (line_items_to_add && line_items_to_add.length > 0) {
      const baseLines: any[] = Array.isArray(updatePayload.Line) ? [...updatePayload.Line] : [];
      // Keep only real lines; QBO adds a SubTotalLineDetail line on read that must not be echoed back.
      const realLines = baseLines.filter((l) => l?.DetailType !== "SubTotalLineDetail");
      const startNum = realLines.length;
      const appended = line_items_to_add.map((l, idx) => ({
        LineNum: startNum + idx + 1,
        Description: l.description || undefined,
        Amount: l.qty * l.unit_price,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: l.item_ref },
          Qty: l.qty,
          UnitPrice: l.unit_price,
          TaxCodeRef: l.tax_code_ref ? { value: l.tax_code_ref } : undefined,
          ServiceDate: l.service_date || undefined,
          ClassRef: l.class_ref ? { value: l.class_ref } : undefined,
        },
      }));
      updatePayload.Line = [...realLines, ...appended];
    }

    return new Promise((resolve) => {
      (quickbooks as any).updateInvoice(updatePayload, (err: any, updated: any) => {
        if (err) {
          resolve({ result: null, isError: true, error: formatError(err) });
        } else {
          resolve({ result: updated, isError: false, error: null });
        }
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
} 
