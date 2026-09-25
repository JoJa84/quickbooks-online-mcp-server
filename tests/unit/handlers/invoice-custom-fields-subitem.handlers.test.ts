import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { mockQuickbooksClient, mockQuickbooksClientClass, mockQuickBooksInstance, resetAllMocks } from '../../mocks/quickbooks.mock';

// ESM-compatible module mocking
jest.unstable_mockModule('../../../src/clients/quickbooks-client', () => ({
  quickbooksClient: mockQuickbooksClient,
  QuickbooksClient: mockQuickbooksClientClass,
}));

const { createQuickbooksInvoice } = await import('../../../src/handlers/create-quickbooks-invoice.handler');
const { createQuickbooksItem } = await import('../../../src/handlers/create-quickbooks-item.handler');
const { CreateInvoiceTool } = await import('../../../src/tools/create-invoice.tool');
const { UpdateInvoiceTool } = await import('../../../src/tools/update-invoice.tool');
const { CreateItemTool } = await import('../../../src/tools/create-item.tool');

describe('Create Invoice Handler - custom fields', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('maps custom_fields to QBO CustomField as StringType', async () => {
    mockQuickBooksInstance.createInvoice.mockImplementation((_payload: any, cb: any) => cb(null, { Id: '1001' }));

    const result = await createQuickbooksInvoice({
      customer_ref: '42',
      line_items: [{ item_ref: '1', qty: 120, unit_price: 0.55 }],
      custom_fields: [
        { definition_id: '1', name: 'Utility Account No.', value: '5200324265' },
        { definition_id: '2', name: 'Utility', value: 'TECO' },
      ],
    });

    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.createInvoice.mock.calls[0][0] as any;
    expect(payload.CustomField).toEqual([
      { DefinitionId: '1', Name: 'Utility Account No.', Type: 'StringType', StringValue: '5200324265' },
      { DefinitionId: '2', Name: 'Utility', Type: 'StringType', StringValue: 'TECO' },
    ]);
  });

  it('omits CustomField when custom_fields is missing or empty', async () => {
    mockQuickBooksInstance.createInvoice.mockImplementation((_payload: any, cb: any) => cb(null, { Id: '1002' }));

    await createQuickbooksInvoice({ customer_ref: '42', line_items: [{ item_ref: '1', qty: 1, unit_price: 10 }] });
    await createQuickbooksInvoice({
      customer_ref: '42',
      line_items: [{ item_ref: '1', qty: 1, unit_price: 10 }],
      custom_fields: [],
    });

    expect((mockQuickBooksInstance.createInvoice.mock.calls[0][0] as any).CustomField).toBeUndefined();
    expect((mockQuickBooksInstance.createInvoice.mock.calls[1][0] as any).CustomField).toBeUndefined();
  });

  it('sends a zero-quantity line as a $0 line', async () => {
    mockQuickBooksInstance.createInvoice.mockImplementation((_payload: any, cb: any) => cb(null, { Id: '1003' }));

    await createQuickbooksInvoice({ customer_ref: '42', line_items: [{ item_ref: '1', qty: 0, unit_price: 0.55 }] });

    const line = (mockQuickBooksInstance.createInvoice.mock.calls[0][0] as any).Line[0];
    expect(line.Amount).toBe(0);
    expect(line.SalesItemLineDetail.Qty).toBe(0);
  });
});

describe('Invoice tool schemas - zero quantity and custom fields', () => {
  it('create_invoice accepts qty 0 and rejects negative qty', () => {
    const base = { customer_ref: '42' };
    expect(
      CreateInvoiceTool.schema.safeParse({ ...base, line_items: [{ item_ref: '1', qty: 0, unit_price: 0 }] }).success
    ).toBe(true);
    expect(
      CreateInvoiceTool.schema.safeParse({ ...base, line_items: [{ item_ref: '1', qty: -1, unit_price: 0 }] }).success
    ).toBe(false);
  });

  it('create_invoice accepts up to three custom fields', () => {
    const cf = { definition_id: '1', name: 'Utility', value: 'FPU' };
    const base = { customer_ref: '42', line_items: [{ item_ref: '1', qty: 1, unit_price: 1 }] };
    expect(CreateInvoiceTool.schema.safeParse({ ...base, custom_fields: [cf, cf, cf] }).success).toBe(true);
    expect(CreateInvoiceTool.schema.safeParse({ ...base, custom_fields: [cf, cf, cf, cf] }).success).toBe(false);
  });

  it('update_invoice line_items_to_add accepts qty 0', () => {
    const parse = (qty: number) =>
      UpdateInvoiceTool.schema.safeParse({ invoice_id: '9', line_items_to_add: [{ item_ref: '1', qty, unit_price: 0 }] })
        .success;
    expect(parse(0)).toBe(true);
    expect(parse(-1)).toBe(false);
  });
});

describe('Create Item Handler - sub-items', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('sets SubItem and ParentRef when parent_ref is given', async () => {
    mockQuickBooksInstance.createItem.mockImplementation((_payload: any, cb: any) => cb(null, { Id: '55' }));

    const result = await createQuickbooksItem({
      name: 'TECO OCTOBER 2026 GAS SERVICE PER THERM',
      type: 'Service',
      income_account_ref: '79',
      parent_ref: '30',
    });

    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.createItem.mock.calls[0][0] as any;
    expect(payload.SubItem).toBe(true);
    expect(payload.ParentRef).toEqual({ value: '30' });
  });

  it('creates a top-level item when parent_ref is omitted', async () => {
    mockQuickBooksInstance.createItem.mockImplementation((_payload: any, cb: any) => cb(null, { Id: '56' }));

    await createQuickbooksItem({ name: 'Customer Charge', type: 'Service', income_account_ref: '79' });

    const payload = mockQuickBooksInstance.createItem.mock.calls[0][0] as any;
    expect(payload.SubItem).toBeUndefined();
    expect(payload.ParentRef).toBeUndefined();
  });

  it('create_item schema accepts parent_ref', () => {
    expect(
      CreateItemTool.schema.safeParse({ name: 'x', type: 'Service', income_account_ref: '79', parent_ref: '30' }).success
    ).toBe(true);
  });
});
