/**
 * Formats an error into a standardized error message.
 *
 * QuickBooks Online rejects a request with an HTTP 400 whose body carries a
 * Fault object describing exactly what was wrong (unbalanced journal entry,
 * duplicate name, missing required field, ...). node-quickbooks hands that to
 * us either as the axios Error (details under error.response.data.Fault) or,
 * for a 200 with an application-level fault, as the body itself. A bare
 * "Request failed with status code 400" hides all of it, so we surface the
 * Fault messages whenever they are present.
 *
 * @param error Any error object to format
 * @returns A formatted error message as a string
 */

interface QboFaultError {
  Message?: string;
  Detail?: string;
  code?: string;
  element?: string;
}

interface QboFault {
  Error: QboFaultError[]; // findFault only returns a fault whose Error is a non-empty array
  type?: string;
}

function findFault(error: unknown): { fault: QboFault; status?: number } | null {
  if (!error || typeof error !== "object") return null;
  const obj = error as Record<string, any>;

  const candidates: Array<{ body: any; status?: number }> = [
    { body: obj, status: typeof obj.status === "number" ? obj.status : undefined },
    { body: obj.response?.data, status: obj.response?.status },
    { body: obj.body, status: obj.statusCode },
  ];

  for (const c of candidates) {
    const fault = c.body?.Fault ?? c.body?.fault;
    if (fault && Array.isArray(fault.Error) && fault.Error.length > 0) {
      return { fault, status: c.status };
    }
  }
  return null;
}

function describeFault(fault: QboFault, status?: number): string {
  const parts = fault.Error.map((e) => {
    const bits: string[] = [];
    if (e.Message) bits.push(e.Message.trim());
    if (e.Detail && e.Detail.trim() !== e.Message?.trim()) bits.push(e.Detail.trim());
    let text = bits.join(" - ") || "unspecified fault";
    if (e.element) text += ` (element: ${e.element})`;
    if (e.code) text += ` [code ${e.code}]`;
    return text;
  });
  const meta: string[] = [];
  if (status) meta.push(`HTTP ${status}`);
  if (fault.type) meta.push(fault.type);
  const prefix = meta.length ? `QuickBooks rejected the request (${meta.join(", ")})` : "QuickBooks rejected the request";
  return `${prefix}: ${parts.join("; ")}`;
}

export function formatError(error: unknown): string {
  const found = findFault(error);
  if (found) {
    return `Error: ${describeFault(found.fault, found.status)}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  } else if (typeof error === 'string') {
    return `Error: ${error}`;
  } else {
    return `Unknown error: ${JSON.stringify(error)}`;
  }
}
