import { d as decodeBase64, e as encodeBase64 } from './base64_CEvRaSBc.mjs';

const MAX_CURSOR_LENGTH = 4096;
function encodeCursor(orderValue, id) {
  return encodeBase64(JSON.stringify({ orderValue, id }));
}
class InvalidCursorError extends Error {
  constructor(cursor) {
    const display = cursor.length > 50 ? `${cursor.slice(0, 47)}...` : cursor;
    super(`Invalid pagination cursor: ${display}`);
    this.name = "InvalidCursorError";
  }
}
function decodeCursor(cursor) {
  if (!cursor) throw new InvalidCursorError(cursor);
  if (cursor.length > MAX_CURSOR_LENGTH) throw new InvalidCursorError(cursor);
  let parsed;
  try {
    parsed = JSON.parse(decodeBase64(cursor));
  } catch {
    throw new InvalidCursorError(cursor);
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new InvalidCursorError(cursor);
  }
  const candidate = parsed;
  if (typeof candidate.orderValue !== "string" || typeof candidate.id !== "string") {
    throw new InvalidCursorError(cursor);
  }
  return { orderValue: candidate.orderValue, id: candidate.id };
}
class EmDashValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
    this.name = "EmDashValidationError";
  }
}

export { EmDashValidationError, InvalidCursorError, decodeCursor, encodeCursor };
