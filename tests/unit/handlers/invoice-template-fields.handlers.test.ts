import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { mockQuickbooksClient, mockQuickbooksClientClass, mockQuickBooksInstance, resetAllMocks } from '../../mocks/quickbooks.mock';

// ESM-compatible module mocking
jest.unstable_mockModule('../../../src/clients/quickbooks-client', () => ({
  quickbooksClient: mockQuickbooksClient,
  QuickbooksClient: mockQuickbooksClientClass,
}));

const { createQuickbooksInvoice } = await import('../../../src/handlers/create-quickbooks-invoice.handler');

describe('Create Invoice Handler - template fields', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should map customer_memo, sales_term_ref and bill_email to QBO properties', async () => {
    const mockInvoice = { Id: '801', TotalAmt: 100 };
    mockQuickBooksInstance.createInvoice.mockImplementation((_payload: any, cb: any) => cb(null, mockInvoice));

    const result = await createQuickbooksInvoice({
      customer_ref: '42',
      line_items: [{ item_ref: '1', qty: 1, unit_price: 100 }],
      customer_memo: 'Interest of 2% per month applies to overdue invoices.',
      sales_term_ref: '3',
      bill_email: 'billing@example.com',
    });

    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.createInvoice.mock.calls[0][0] as any;
    expect(payload.CustomerMemo).toEqual({ value: 'Interest of 2% per month applies to overdue invoices.' });
    expect(payload.SalesTermRef).toEqual({ value: '3' });
    expect(payload.BillEmail).toEqual({ Address: 'billing@example.com' });
  });

  it('should map per-line service_date to SalesItemLineDetail.ServiceDate', async () => {
    const mockInvoice = { Id: '802', TotalAmt: 200 };
    mockQuickBooksInstance.createInvoice.mockImplementation((_payload: any, cb: any) => cb(null, mockInvoice));

    const result = await createQuickbooksInvoice({
      customer_ref: '42',
      line_items: [
        { item_ref: '1', qty: 1, unit_price: 100, service_date: '2026-06-16' },
        { item_ref: '1', qty: 1, unit_price: 100, service_date: '2026-06-18' },
      ],
    });

    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.createInvoice.mock.calls[0][0] as any;
    expect(payload.Line[0].SalesItemLineDetail.ServiceDate).toBe('2026-06-16');
    expect(payload.Line[1].SalesItemLineDetail.ServiceDate).toBe('2026-06-18');
  });

  it('should omit the template fields when not provided', async () => {
    const mockInvoice = { Id: '803', TotalAmt: 100 };
    mockQuickBooksInstance.createInvoice.mockImplementation((_payload: any, cb: any) => cb(null, mockInvoice));

    const result = await createQuickbooksInvoice({
      customer_ref: '42',
      line_items: [{ item_ref: '1', qty: 1, unit_price: 100 }],
    });

    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.createInvoice.mock.calls[0][0] as any;
    expect(payload.CustomerMemo).toBeUndefined();
    expect(payload.SalesTermRef).toBeUndefined();
    expect(payload.BillEmail).toBeUndefined();
    expect(payload.Line[0].SalesItemLineDetail.ServiceDate).toBeUndefined();
  });
});

describe('Create Invoice Handler - header and line tracking fields', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('maps due_date, class_ref, department_ref, private_note, ship_date and per-line class_ref', async () => {
    mockQuickBooksInstance.createInvoice.mockImplementation((_payload: any, cb: any) => cb(null, { Id: '901' }));

    const result = await createQuickbooksInvoice({
      customer_ref: '42',
      line_items: [{ item_ref: '1', qty: 2, unit_price: 50, class_ref: '77' }],
      due_date: '2026-10-15',
      class_ref: '723734',
      department_ref: '1',
      private_note: 'internal only',
      ship_date: '2026-09-20',
    });

    expect(result.isError).toBe(false);
    const payload = mockQuickBooksInstance.createInvoice.mock.calls[0][0] as any;
    expect(payload.DueDate).toBe('2026-10-15');
    expect(payload.ClassRef).toEqual({ value: '723734' });
    expect(payload.DepartmentRef).toEqual({ value: '1' });
    expect(payload.PrivateNote).toBe('internal only');
    expect(payload.ShipDate).toBe('2026-09-20');
    expect(payload.Line[0].SalesItemLineDetail.ClassRef).toEqual({ value: '77' });
  });

  it('omits the tracking fields when not provided', async () => {
    mockQuickBooksInstance.createInvoice.mockImplementation((_payload: any, cb: any) => cb(null, { Id: '902' }));

    await createQuickbooksInvoice({
      customer_ref: '42',
      line_items: [{ item_ref: '1', qty: 1, unit_price: 100 }],
    });

    const payload = mockQuickBooksInstance.createInvoice.mock.calls[0][0] as any;
    expect(payload.DueDate).toBeUndefined();
    expect(payload.ClassRef).toBeUndefined();
    expect(payload.DepartmentRef).toBeUndefined();
    expect(payload.PrivateNote).toBeUndefined();
    expect(payload.ShipDate).toBeUndefined();
    expect(payload.Line[0].SalesItemLineDetail.ClassRef).toBeUndefined();
  });
});
