import { a as apiError } from './error_Da04EfM-.mjs';

const MAX_BODY_SIZE = 10 * 1024 * 1024;
async function parseBody(request, schema) {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return apiError("PAYLOAD_TOO_LARGE", "Request body too large", 413);
  }
  let raw;
  try {
    raw = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON", 400);
  }
  return validate(schema, raw);
}
async function parseOptionalBody(request, schema, defaultValue) {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return apiError("PAYLOAD_TOO_LARGE", "Request body too large", 413);
  }
  let text;
  try {
    text = await request.text();
  } catch {
    return defaultValue;
  }
  if (!text.trim()) {
    return defaultValue;
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON", 400);
  }
  return validate(schema, raw);
}
function parseQuery(url, schema) {
  const raw = {};
  for (const [key, value] of url.searchParams) {
    raw[key] = value;
  }
  return validate(schema, raw);
}
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));
  return Response.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: { issues }
      }
    },
    {
      status: 400,
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
function isParseError(result) {
  return result instanceof Response;
}

export { parseQuery as a, parseOptionalBody as b, isParseError as i, parseBody as p };
