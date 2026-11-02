import { QuickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface UpdateCreditMemoInput {
  id: string;
  sync_token: string;
  customer_ref?: string;
  private_note?: string;
  doc_number?: string;
  custom_fields?: Array<{
    definition_id: string; // SalesFormsPrefs.CustomField DefinitionId
    name: string;
    value: string;
  }>;
  customer_memo?: string; // CustomerMemo (customer-facing message)
  bill_email?: string; // BillEmail address
}

export async function updateQuickbooksCreditMemo(data: UpdateCreditMemoInput): Promise<ToolResponse<any>> {
  try {
    const quickbooks = await QuickbooksClient.getInstance();

    const payload: any = {
      Id: data.id,
      SyncToken: data.sync_token,
      sparse: true,
    };

    if (data.customer_ref) {
      payload.CustomerRef = { value: data.customer_ref };
    }
    if (data.private_note) {
      payload.PrivateNote = data.private_note;
    }
    if (data.doc_number) {
      payload.DocNumber = data.doc_number;
    }
    if (data.custom_fields && data.custom_fields.length > 0) {
      payload.CustomField = data.custom_fields.map((cf) => ({
        DefinitionId: cf.definition_id,
        Name: cf.name,
        Type: "StringType",
        StringValue: cf.value,
      }));
    }
    if (data.customer_memo) {
      payload.CustomerMemo = { value: data.customer_memo };
    }
    if (data.bill_email) {
      payload.BillEmail = { Address: data.bill_email };
    }

    return new Promise((resolve) => {
      (quickbooks as any).updateCreditMemo(payload, (err: any, updated: any) => {
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

