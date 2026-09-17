import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { mockQuickbooksClient, mockQuickbooksClientClass, mockQuickBooksInstance, resetAllMocks } from '../../mocks/quickbooks.mock';

jest.unstable_mockModule('../../../src/clients/quickbooks-client', () => ({
  quickbooksClient: mockQuickbooksClient,
  QuickbooksClient: mockQuickbooksClientClass,
}));

const { updateQuickbooksInvoice } = await import('../../../src/handlers/update-quickbooks-invoice.handler');

const existingInvoice = {
  Id: '148',
  SyncToken: '2',
  CustomerRef: { value: '60' },
  Line: [
    { Id: '1', LineNum: 1, Amount: 100, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { ItemRef: { value: '19' }, Qty: 1, UnitPrice: 100 } },
    { Amount: 100, DetailType: 'SubTotalLineDetail', SubTotalLineDetail: {} },
  ],
};

describe('Update Invoice Handler - line_items_to_add', () => {
  beforeEach(() => {
    resetAllMocks();
    mockQuickBooksInstance.getInvoice.mockImplementation((_id: any, cb: any) => cb(null, existingInvoice));
    mockQuickBooksInstance.updateInvoice.mockImplementation((payload: any, cb: any) => cb(null, { ...payload, SyncToken: '3' }));
  });

  it('merges a header patch without touching lines', async () => {
    const result = await updateQuickbooksInvoice({ invoice_id: '148', patch: { PrivateNote: 'note' } });
    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.updateInvoice.mock.calls[0][0] as any;
    expect(payload.PrivateNote).toBe('note');
    expect(payload.Line).toEqual(existingInvoice.Line);
    expect(payload.sparse).toBe(true);
    expect(payload.Id).toBe('148');
  });

  it('appends new lines after the existing real lines and drops the subtotal line', async () => {
    const result = await updateQuickbooksInvoice({
      invoice_id: '148',
      line_items_to_add: [
        { item_ref: '22', qty: 1, unit_price: 35, description: 'Late fee', tax_code_ref: 'NON', service_date: '2026-09-01', class_ref: '7' },
        { item_ref: '21', qty: 2, unit_price: 10 },
      ],
    });
    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.updateInvoice.mock.calls[0][0] as any;
    expect(payload.Line).toHaveLength(3);
    expect(payload.Line[0]).toEqual(existingInvoice.Line[0]);
    expect(payload.Line[1]).toEqual({
      LineNum: 2,
      Description: 'Late fee',
      Amount: 35,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: '22' },
        Qty: 1,
        UnitPrice: 35,
        TaxCodeRef: { value: 'NON' },
        ServiceDate: '2026-09-01',
        ClassRef: { value: '7' },
      },
    });
    expect(payload.Line[2].LineNum).toBe(3);
    expect(payload.Line[2].Amount).toBe(20);
    expect(payload.Line[2].Description).toBeUndefined();
    expect(payload.Line[2].SalesItemLineDetail.TaxCodeRef).toBeUndefined();
    expect(payload.Line[2].SalesItemLineDetail.ServiceDate).toBeUndefined();
    expect(payload.Line[2].SalesItemLineDetail.ClassRef).toBeUndefined();
  });

  it('appends on top of a patch that replaces Line', async () => {
    const replacement = [{ Id: '9', Amount: 5, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { ItemRef: { value: '1' } } }];
    await updateQuickbooksInvoice({
      invoice_id: '148',
      patch: { Line: replacement },
      line_items_to_add: [{ item_ref: '22', qty: 1, unit_price: 35 }],
    });
    const payload = mockQuickBooksInstance.updateInvoice.mock.calls[0][0] as any;
    expect(payload.Line).toHaveLength(2);
    expect(payload.Line[0]).toEqual(replacement[0]);
    expect(payload.Line[1].LineNum).toBe(2);
  });

  it('starts from an empty line list when the invoice has no Line array', async () => {
    mockQuickBooksInstance.getInvoice.mockImplementation((_id: any, cb: any) => cb(null, { Id: '148', SyncToken: '0' }));
    await updateQuickbooksInvoice({ invoice_id: '148', line_items_to_add: [{ item_ref: '22', qty: 1, unit_price: 35 }] });
    const payload = mockQuickBooksInstance.updateInvoice.mock.calls[0][0] as any;
    expect(payload.Line).toHaveLength(1);
    expect(payload.Line[0].LineNum).toBe(1);
  });

  it('leaves lines alone when line_items_to_add is empty', async () => {
    await updateQuickbooksInvoice({ invoice_id: '148', patch: {}, line_items_to_add: [] });
    const payload = mockQuickBooksInstance.updateInvoice.mock.calls[0][0] as any;
    expect(payload.Line).toEqual(existingInvoice.Line);
  });

  it('returns an error when the invoice cannot be read', async () => {
    mockQuickBooksInstance.getInvoice.mockImplementation((_id: any, cb: any) => cb(new Error('not found'), null));
    const result = await updateQuickbooksInvoice({ invoice_id: '999', patch: { PrivateNote: 'x' } });
    expect(result.isError).toBe(true);
    expect(result.error).toBe('Error: not found');
  });

  it('returns an error when the update is rejected', async () => {
    mockQuickBooksInstance.updateInvoice.mockImplementation((_payload: any, cb: any) => cb(new Error('stale SyncToken'), null));
    const result = await updateQuickbooksInvoice({ invoice_id: '148', patch: { PrivateNote: 'x' } });
    expect(result.isError).toBe(true);
    expect(result.error).toBe('Error: stale SyncToken');
  });
});
