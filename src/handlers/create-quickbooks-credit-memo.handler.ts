import { QuickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface CreateCreditMemoInput {
  customer_ref: string;
  line_items: Array<{
    item_ref: string;
    qty: number;
    unit_price: number;
    description?: string;
    tax_code_ref?: string; // TaxCode id (non-US) or TAX/NON (US)
  }>;
  txn_date?: string;
  doc_number?: string;
  private_note?: string;
  global_tax_calculation?: "TaxExcluded" | "TaxInclusive" | "NotApplicable";
  custom_fields?: Array<{
    definition_id: string; // SalesFormsPrefs.CustomField DefinitionId
    name: string;
    value: string;
  }>;
  customer_memo?: string; // CustomerMemo (customer-facing message)
  bill_email?: string; // BillEmail address; falls back to customer default
}

export async function createQuickbooksCreditMemo(data: CreateCreditMemoInput): Promise<ToolResponse<any>> {
  try {
    const quickbooks = await QuickbooksClient.getInstance();

    const creditMemoPayload: any = {
      CustomerRef: { value: data.customer_ref },
      Line: data.line_items.map((l, idx) => ({
        Id: `${idx + 1}`,
        LineNum: idx + 1,
        Description: l.description || undefined,
        Amount: l.qty * l.unit_price,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: l.item_ref },
          Qty: l.qty,
          UnitPrice: l.unit_price,
          TaxCodeRef: l.tax_code_ref ? { value: l.tax_code_ref } : undefined,
        },
      })),
    };

    if (data.txn_date) {
      creditMemoPayload.TxnDate = data.txn_date;
    }
    if (data.doc_number) {
      creditMemoPayload.DocNumber = data.doc_number;
    }
    if (data.private_note) {
      creditMemoPayload.PrivateNote = data.private_note;
    }
    if (data.global_tax_calculation) {
      creditMemoPayload.GlobalTaxCalculation = data.global_tax_calculation;
    }
    if (data.custom_fields && data.custom_fields.length > 0) {
      creditMemoPayload.CustomField = data.custom_fields.map((cf) => ({
        DefinitionId: cf.definition_id,
        Name: cf.name,
        Type: "StringType",
        StringValue: cf.value,
      }));
    }
    if (data.customer_memo) {
      creditMemoPayload.CustomerMemo = { value: data.customer_memo };
    }
    if (data.bill_email) {
      creditMemoPayload.BillEmail = { Address: data.bill_email };
    }

    return new Promise((resolve) => {
      (quickbooks as any).createCreditMemo(creditMemoPayload, (err: any, created: any) => {
        if (err) {
          resolve({ result: null, isError: true, error: formatError(err) });
        } else {
          resolve({ result: created, isError: false, error: null });
        }
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

