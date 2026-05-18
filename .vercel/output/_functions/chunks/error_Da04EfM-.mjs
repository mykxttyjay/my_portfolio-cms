import { InvalidCursorError } from './types_D-lIeGNL.mjs';

const ErrorCode = {
  // Shared (used across domains)
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_JSON: "INVALID_JSON",
  INVALID_CURSOR: "INVALID_CURSOR",
  CONFLICT: "CONFLICT",
  SLUG_CONFLICT: "SLUG_CONFLICT",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  NOT_SUPPORTED: "NOT_SUPPORTED",
  MISSING_PARAM: "MISSING_PARAM",
  CSRF_REJECTED: "CSRF_REJECTED",
  INVALID_REVISION: "INVALID_REVISION",
  COLLECTION_EXISTS: "COLLECTION_EXISTS",
  COLLECTION_NOT_FOUND: "COLLECTION_NOT_FOUND",
  TABLE_NOT_FOUND: "TABLE_NOT_FOUND",
  FIELD_EXISTS: "FIELD_EXISTS",
  RESERVED_SLUG: "RESERVED_SLUG",
  INVALID_SLUG: "INVALID_SLUG",
  NO_STORAGE: "NO_STORAGE",
  NO_FILE: "NO_FILE",
  INVALID_TYPE: "INVALID_TYPE",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  INVALID_STATE: "INVALID_STATE",
  STORAGE_NOT_CONFIGURED: "STORAGE_NOT_CONFIGURED",
  COMMENTS_DISABLED: "COMMENTS_DISABLED",
  COMMENTS_CLOSED: "COMMENTS_CLOSED",
  COMMENT_REJECTED: "COMMENT_REJECTED",
  // Auth
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  ADMIN_EXISTS: "ADMIN_EXISTS",
  SETUP_COMPLETE: "SETUP_COMPLETE",
  CREDENTIAL_EXISTS: "CREDENTIAL_EXISTS",
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",
  PASSKEY_LIMIT: "PASSKEY_LIMIT",
  LAST_PASSKEY: "LAST_PASSKEY",
  SELF_ROLE_CHANGE: "SELF_ROLE_CHANGE",
  EMAIL_IN_USE: "EMAIL_IN_USE",
  EMAIL_NOT_CONFIGURED: "EMAIL_NOT_CONFIGURED",
  USER_EXISTS: "USER_EXISTS",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  DOMAIN_NOT_ALLOWED: "DOMAIN_NOT_ALLOWED",
  INVALID_CODE: "INVALID_CODE",
  EXPIRED_CODE: "EXPIRED_CODE",
  INSUFFICIENT_ROLE: "INSUFFICIENT_ROLE",
  INSUFFICIENT_SCOPE: "INSUFFICIENT_SCOPE",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  PLUGIN_ID_CONFLICT: "PLUGIN_ID_CONFLICT",
  MARKETPLACE_NOT_CONFIGURED: "MARKETPLACE_NOT_CONFIGURED",
  MARKETPLACE_UNAVAILABLE: "MARKETPLACE_UNAVAILABLE",
  SANDBOX_NOT_AVAILABLE: "SANDBOX_NOT_AVAILABLE",
  ALREADY_INSTALLED: "ALREADY_INSTALLED",
  ALREADY_UP_TO_DATE: "ALREADY_UP_TO_DATE",
  NO_VERSION: "NO_VERSION",
  AUDIT_FAILED: "AUDIT_FAILED",
  CHECKSUM_MISMATCH: "CHECKSUM_MISMATCH",
  INVALID_BUNDLE: "INVALID_BUNDLE",
  BUNDLE_EXTRACT_FAILED: "BUNDLE_EXTRACT_FAILED",
  BUNDLE_DOWNLOAD_FAILED: "BUNDLE_DOWNLOAD_FAILED",
  CAPABILITY_ESCALATION: "CAPABILITY_ESCALATION",
  ROUTE_VISIBILITY_ESCALATION: "ROUTE_VISIBILITY_ESCALATION",
  // Returned when a menu name resolves to multiple locale variants and
  // the caller did not pass `locale` to disambiguate. (name, locale) is
  // unique, so this only fires for omitted-locale lookups.
  AMBIGUOUS_LOCALE: "AMBIGUOUS_LOCALE",
  // Setup
  ALREADY_CONFIGURED: "ALREADY_CONFIGURED",
  INVALID_SEED: "INVALID_SEED",
  INVALID_REDIRECT: "INVALID_REDIRECT",
  SSRF_BLOCKED: "SSRF_BLOCKED",
  NO_DB: "NO_DB",
  INVALID_REQUEST: "INVALID_REQUEST",
  UNKNOWN_ACTION: "UNKNOWN_ACTION"
};
function mapErrorStatus(code) {
  switch (code) {
    // 400 Bad Request
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.INVALID_JSON:
    case ErrorCode.INVALID_CURSOR:
    case ErrorCode.MISSING_PARAM:
    case ErrorCode.INVALID_REQUEST:
    case ErrorCode.NOT_SUPPORTED:
    case ErrorCode.INVALID_SLUG:
    case ErrorCode.RESERVED_SLUG:
    case ErrorCode.INVALID_TYPE:
    case ErrorCode.NO_FILE:
    case ErrorCode.INVALID_STATE:
    case ErrorCode.INVALID_SEED:
    case ErrorCode.INVALID_REDIRECT:
    case ErrorCode.INVALID_TOKEN:
    case ErrorCode.INVALID_REVISION:
    case ErrorCode.INVALID_CODE:
    case ErrorCode.CHALLENGE_EXPIRED:
    case ErrorCode.EXPIRED_CODE:
    case ErrorCode.LAST_PASSKEY:
    case ErrorCode.PASSKEY_LIMIT:
    case ErrorCode.ADMIN_EXISTS:
    case ErrorCode.SETUP_COMPLETE:
    case ErrorCode.SELF_ROLE_CHANGE:
    case ErrorCode.SSRF_BLOCKED:
    case ErrorCode.UNKNOWN_ACTION:
    case ErrorCode.AMBIGUOUS_LOCALE:
      return 400;
    // 401 Unauthorized
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.NOT_AUTHENTICATED:
      return 401;
    // 403 Forbidden
    case ErrorCode.FORBIDDEN:
    case ErrorCode.CSRF_REJECTED:
    case ErrorCode.ACCOUNT_DISABLED:
    case ErrorCode.COMMENTS_DISABLED:
    case ErrorCode.COMMENTS_CLOSED:
    case ErrorCode.COMMENT_REJECTED:
    case ErrorCode.DOMAIN_NOT_ALLOWED:
    case ErrorCode.INSUFFICIENT_ROLE:
    case ErrorCode.INSUFFICIENT_SCOPE:
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
    case ErrorCode.CAPABILITY_ESCALATION:
    case ErrorCode.ROUTE_VISIBILITY_ESCALATION:
    case ErrorCode.AUDIT_FAILED:
      return 403;
    // 404 Not Found
    case ErrorCode.NOT_FOUND:
    case ErrorCode.TABLE_NOT_FOUND:
    case ErrorCode.COLLECTION_NOT_FOUND:
    case ErrorCode.FILE_NOT_FOUND:
    case ErrorCode.NO_VERSION:
      return 404;
    // 409 Conflict
    case ErrorCode.CONFLICT:
    case ErrorCode.SLUG_CONFLICT:
    case ErrorCode.COLLECTION_EXISTS:
    case ErrorCode.FIELD_EXISTS:
    case ErrorCode.CREDENTIAL_EXISTS:
    case ErrorCode.EMAIL_IN_USE:
    case ErrorCode.USER_EXISTS:
    case ErrorCode.PLUGIN_ID_CONFLICT:
    case ErrorCode.ALREADY_INSTALLED:
    case ErrorCode.ALREADY_CONFIGURED:
    case ErrorCode.ALREADY_UP_TO_DATE:
      return 409;
    // 410 Gone
    case ErrorCode.TOKEN_EXPIRED:
      return 410;
    // 422 Unprocessable Entity
    case ErrorCode.CHECKSUM_MISMATCH:
    case ErrorCode.INVALID_BUNDLE:
    case ErrorCode.BUNDLE_EXTRACT_FAILED:
      return 422;
    // 429 Too Many Requests
    case ErrorCode.RATE_LIMITED:
      return 429;
    // 500 Internal Server Error
    case ErrorCode.NOT_CONFIGURED:
    case ErrorCode.NO_STORAGE:
    case ErrorCode.NO_DB:
    case ErrorCode.STORAGE_NOT_CONFIGURED:
    case ErrorCode.EMAIL_NOT_CONFIGURED:
      return 500;
    // 501 Not Implemented
    case ErrorCode.NOT_IMPLEMENTED:
      return 501;
    // 502 Bad Gateway
    case ErrorCode.BUNDLE_DOWNLOAD_FAILED:
      return 502;
    // 503 Service Unavailable
    case ErrorCode.MARKETPLACE_UNAVAILABLE:
    case ErrorCode.MARKETPLACE_NOT_CONFIGURED:
    case ErrorCode.SANDBOX_NOT_AVAILABLE:
      return 503;
    // Domain-specific *_ERROR codes are catch-block codes -- always 500.
    // WARNING: If adding a new code that ends in _ERROR but represents a
    // client error (4xx), add it to an explicit case above or it will
    // be incorrectly mapped to 500.
    default:
      return code?.endsWith("_ERROR") ? 500 : 400;
  }
}

const API_CACHE_HEADERS = {
  "Cache-Control": "private, no-store"
};
function apiError(code, message, status) {
  return Response.json({ error: { code, message } }, { status, headers: API_CACHE_HEADERS });
}
function apiSuccess(data, status = 200) {
  return Response.json({ data }, { status, headers: API_CACHE_HEADERS });
}
function handleError(error, fallbackMessage, fallbackCode) {
  if (error instanceof InvalidCursorError) {
    return apiError("INVALID_CURSOR", error.message, 400);
  }
  console.error(`[${fallbackCode}]`, error);
  return apiError(fallbackCode, fallbackMessage, 500);
}
function requireDb(db) {
  if (!db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  return null;
}
function unwrapResult(result, successStatus = 200) {
  if (!result.success) {
    return apiError(result.error.code, result.error.message, mapErrorStatus(result.error.code));
  }
  return apiSuccess(result.data, successStatus);
}

export { apiError as a, apiSuccess as b, handleError as h, mapErrorStatus as m, requireDb as r, unwrapResult as u };
