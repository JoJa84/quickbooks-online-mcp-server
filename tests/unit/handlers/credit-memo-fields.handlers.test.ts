import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { mockQuickbooksClient, mockQuickbooksClientClass, mockQuickBooksInstance, resetAllMocks } from '../../mocks/quickbooks.mock';

// ESM-compatible module mocking
jest.unstable_mockModule('../../../src/clients/quickbooks-client', () => ({
  quickbooksClient: mockQuickbooksClient,
  QuickbooksClient: mockQuickbooksClientClass,
}));

const { createQuickbooksCreditMemo } = await import('../../../src/handlers/create-quickbooks-credit-memo.handler');
const { updateQuickbooksCreditMemo } = await import('../../../src/handlers/update-quickbooks-credit-memo.handler');
const { CreateCreditMemoTool } = await import('../../../src/tools/create-credit-memo.tool');
const { UpdateCreditMemoTool } = await import('../../../src/tools/update-credit-memo.tool');
const { knownParamKeys, unsupportedParamsWarning } = await import('../../../src/helpers/register-tool');

const customFields = [
  { definition_id: '1', name: 'Utility Account No.', value: '5200324265' },
  { definition_id: '2', name: 'Utility', value: 'TECO' },
];
const expectedCustomField = [
  { DefinitionId: '1', Name: 'Utility Account No.', Type: 'StringType', StringValue: '5200324265' },
  { DefinitionId: '2', Name: 'Utility', Type: 'StringType', StringValue: 'TECO' },
];

describe('Create Credit Memo Handler - custom_fields, customer_memo, bill_email', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('maps all three fields to QBO CustomField, CustomerMemo and BillEmail', async () => {
    mockQuickBooksInstance.createCreditMemo.mockImplementation((_p: any, cb: any) => cb(null, { Id: '7001' }));

    const result = await createQuickbooksCreditMemo({
      customer_ref: '42',
      line_items: [{ item_ref: '1', qty: 1, unit_price: 25 }],
      custom_fields: customFields,
      customer_memo: 'Credit for overbilled therms',
      bill_email: 'ap@example.com',
    });

    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.createCreditMemo.mock.calls[0][0] as any;
    expect(payload.CustomField).toEqual(expectedCustomField);
    expect(payload.CustomerMemo).toEqual({ value: 'Credit for overbilled therms' });
    expect(payload.BillEmail).toEqual({ Address: 'ap@example.com' });
  });

  it('omits the three fields when not given (and CustomField when empty)', async () => {
    mockQuickBooksInstance.createCreditMemo.mockImplementation((_p: any, cb: any) => cb(null, { Id: '7002' }));

    await createQuickbooksCreditMemo({ customer_ref: '42', line_items: [{ item_ref: '1', qty: 1, unit_price: 10 }] });
    await createQuickbooksCreditMemo({
      customer_ref: '42',
      line_items: [{ item_ref: '1', qty: 1, unit_price: 10 }],
      custom_fields: [],
    });

    for (const call of mockQuickBooksInstance.createCreditMemo.mock.calls) {
      const payload = call[0] as any;
      expect(payload.CustomField).toBeUndefined();
      expect(payload.CustomerMemo).toBeUndefined();
      expect(payload.BillEmail).toBeUndefined();
    }
  });
});

describe('Update Credit Memo Handler - custom_fields, customer_memo, bill_email', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('maps all three fields in a sparse update', async () => {
    mockQuickBooksInstance.updateCreditMemo.mockImplementation((_p: any, cb: any) => cb(null, { Id: '7001' }));

    const result = await updateQuickbooksCreditMemo({
      id: '7001',
      sync_token: '0',
      custom_fields: customFields,
      customer_memo: 'Updated memo',
      bill_email: 'billing@example.com',
    });

    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.updateCreditMemo.mock.calls[0][0] as any;
    expect(payload.sparse).toBe(true);
    expect(payload.CustomField).toEqual(expectedCustomField);
    expect(payload.CustomerMemo).toEqual({ value: 'Updated memo' });
    expect(payload.BillEmail).toEqual({ Address: 'billing@example.com' });
  });

  it('omits the three fields when not given (and CustomField when empty)', async () => {
    mockQuickBooksInstance.updateCreditMemo.mockImplementation((_p: any, cb: any) => cb(null, { Id: '7001' }));

    await updateQuickbooksCreditMemo({ id: '7001', sync_token: '0', private_note: 'x' });
    await updateQuickbooksCreditMemo({ id: '7001', sync_token: '0', custom_fields: [] });

    for (const call of mockQuickBooksInstance.updateCreditMemo.mock.calls) {
      const payload = call[0] as any;
      expect(payload.CustomField).toBeUndefined();
      expect(payload.CustomerMemo).toBeUndefined();
      expect(payload.BillEmail).toBeUndefined();
    }
  });
});

describe('Credit memo tool schemas - new fields', () => {
  const cf = { definition_id: '1', name: 'Utility', value: 'FPU' };
  const createBase = { customer_ref: '42', line_items: [{ item_ref: '1', qty: 1, unit_price: 1 }] };
  const updateBase = { id: '7001', sync_token: '0' };

  for (const [label, tool, base] of [
    ['create_credit_memo', CreateCreditMemoTool, createBase],
    ['update_credit_memo', UpdateCreditMemoTool, updateBase],
  ] as const) {
    it(`${label} accepts all three fields`, () => {
      expect(
        (tool.schema as any).safeParse({ ...base, custom_fields: [cf], customer_memo: 'm', bill_email: 'a@b.com' }).success
      ).toBe(true);
    });

    it(`${label} accepts up to three custom fields`, () => {
      expect((tool.schema as any).safeParse({ ...base, custom_fields: [cf, cf, cf] }).success).toBe(true);
      expect((tool.schema as any).safeParse({ ...base, custom_fields: [cf, cf, cf, cf] }).success).toBe(false);
    });

    it(`${label} rejects empty customer_memo, bill_email and custom field definition_id/name`, () => {
      const s = tool.schema as any;
      expect(s.safeParse({ ...base, customer_memo: '' }).success).toBe(false);
      expect(s.safeParse({ ...base, bill_email: '' }).success).toBe(false);
      expect(s.safeParse({ ...base, custom_fields: [{ ...cf, definition_id: '' }] }).success).toBe(false);
      expect(s.safeParse({ ...base, custom_fields: [{ ...cf, name: '' }] }).success).toBe(false);
    });

    it(`${label} no longer reports the three fields as IGNORED`, () => {
      const warning = unsupportedParamsWarning(label, knownParamKeys(tool.schema), {
        ...base,
        custom_fields: [cf],
        customer_memo: 'm',
        bill_email: 'a@b.com',
      });
      expect(warning).toBeNull();
    });
  }
});
