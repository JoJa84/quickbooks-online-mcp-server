import { QuickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface CreateItemInput {
  name: string;
  type: string; // Service, Inventory, etc.
  income_account_ref: string; // account id
  expense_account_ref?: string;
  unit_price?: number;
  description?: string;
  parent_ref?: string; // parent category item id; makes this a sub-item
}

export async function createQuickbooksItem(data: CreateItemInput): Promise<ToolResponse<any>> {
  try {
    const quickbooks = await QuickbooksClient.getInstance();

    const payload: any = {
      Name: data.name,
      Type: data.type,
      IncomeAccountRef: { value: data.income_account_ref },
      ExpenseAccountRef: data.expense_account_ref ? { value: data.expense_account_ref } : undefined,
      UnitPrice: data.unit_price,
      Description: data.description,
      ...(data.parent_ref && { SubItem: true, ParentRef: { value: data.parent_ref } }),
    };

    return new Promise((resolve) => {
      (quickbooks as any).createItem(payload, (err: any, item: any) => {
        if (err) resolve({ result: null, isError: true, error: formatError(err) });
        else resolve({ result: item, isError: false, error: null });
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
} 
