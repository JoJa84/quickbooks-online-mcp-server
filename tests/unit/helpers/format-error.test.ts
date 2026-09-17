import { formatError } from '../../../src/helpers/format-error';

describe('formatError', () => {
  it('should format Error instances', () => {
    const error = new Error('Something went wrong');
    expect(formatError(error)).toBe('Error: Something went wrong');
  });

  it('should format string errors', () => {
    expect(formatError('A string error')).toBe('Error: A string error');
  });

  it('should format unknown error types', () => {
    const unknownError = { code: 500, message: 'Server error' };
    expect(formatError(unknownError)).toBe(
      'Unknown error: {"code":500,"message":"Server error"}'
    );
  });

  it('should handle null errors', () => {
    expect(formatError(null)).toBe('Unknown error: null');
  });

  it('should handle undefined errors', () => {
    expect(formatError(undefined)).toBe('Unknown error: undefined');
  });

  it('should handle number errors', () => {
    expect(formatError(404)).toBe('Unknown error: 404');
  });
});

describe('formatError - QuickBooks Fault surfacing', () => {
  const fault = {
    Fault: {
      Error: [
        {
          Message: 'Transaction is not balanced',
          Detail: 'Debits must equal credits',
          code: '6000',
          element: 'Line',
        },
      ],
      type: 'ValidationFault',
    },
    time: '2026-09-17T00:00:00Z',
  };

  it('surfaces the fault carried on an axios-style error', () => {
    const err: any = new Error('Request failed with status code 400');
    err.response = { status: 400, data: fault };
    expect(formatError(err)).toBe(
      'Error: QuickBooks rejected the request (HTTP 400, ValidationFault): ' +
        'Transaction is not balanced - Debits must equal credits (element: Line) [code 6000]'
    );
  });

  it('surfaces a fault body passed directly as the error', () => {
    expect(formatError(fault)).toBe(
      'Error: QuickBooks rejected the request (ValidationFault): ' +
        'Transaction is not balanced - Debits must equal credits (element: Line) [code 6000]'
    );
  });

  it('reads status from a top-level status field and a body/statusCode pair', () => {
    const topLevel = { status: 400, Fault: { Error: [{ Message: 'Duplicate Name Exists Error' }] } };
    expect(formatError(topLevel)).toBe(
      'Error: QuickBooks rejected the request (HTTP 400): Duplicate Name Exists Error'
    );
    const bodyShape = { statusCode: 400, body: { Fault: { Error: [{ Message: 'Duplicate Name Exists Error' }] } } };
    expect(formatError(bodyShape)).toBe(
      'Error: QuickBooks rejected the request (HTTP 400): Duplicate Name Exists Error'
    );
  });

  it('does not repeat Detail when it equals Message and joins several errors', () => {
    const err = {
      Fault: {
        Error: [
          { Message: 'Bad thing', Detail: 'Bad thing', code: '1' },
          { Message: 'Other thing' },
          { Detail: 'Detail only' },
          {},
        ],
      },
    };
    expect(formatError(err)).toBe(
      'Error: QuickBooks rejected the request: Bad thing [code 1]; Other thing; Detail only; unspecified fault'
    );
  });

  it('accepts a lower-case fault key', () => {
    const err: any = new Error('x');
    err.response = { status: 500, data: { fault: { Error: [{ Message: 'boom' }], type: 'SystemFault' } } };
    expect(formatError(err)).toBe('Error: QuickBooks rejected the request (HTTP 500, SystemFault): boom');
  });

  it('ignores a Fault whose Error is not an array', () => {
    expect(formatError({ Fault: { Error: 'nope' } })).toBe('Unknown error: {"Fault":{"Error":"nope"}}');
  });

  it('falls back to the plain message when the fault has no errors', () => {
    const err: any = new Error('Request failed with status code 400');
    err.response = { status: 400, data: { Fault: { Error: [] } } };
    expect(formatError(err)).toBe('Error: Request failed with status code 400');
  });
});
