import { z } from 'zod';
import { a as apiError, h as handleError } from './error_Da04EfM-.mjs';
import { c as handleTokenRefresh, b as handleDeviceTokenExchange } from './device-flow_BOO2HWPf.mjs';
import { h as handleAuthorizationCodeExchange } from './oauth-authorization_DAvutkDF.mjs';

const prerender = false;
async function parseTokenBody(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }
  try {
    const json = Object(await request.json());
    const result = {};
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === "string") {
        result[key] = value;
      } else if (typeof value === "number") {
        result[key] = String(value);
      }
    }
    return result;
  } catch {
    return {};
  }
}
const authCodeSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  redirect_uri: z.string().min(1),
  client_id: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
  resource: z.string().optional()
});
const deviceCodeSchema = z.object({
  grant_type: z.literal("urn:ietf:params:oauth:grant-type:device_code"),
  device_code: z.string().min(1)
});
const refreshSchema = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string().min(1)
});
const OPTIONS = () => {
  return new Response(null, { status: 204, headers: OAUTH_PREFLIGHT_HEADERS });
};
const POST = async ({ request, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const body = await parseTokenBody(request);
    const grantType = body.grant_type;
    if (!grantType) {
      return oauthError("invalid_request", "grant_type is required", 400);
    }
    switch (grantType) {
      case "authorization_code": {
        const parsed = authCodeSchema.safeParse(body);
        if (!parsed.success) {
          return oauthError("invalid_request", formatZodError(parsed.error), 400);
        }
        const result = await handleAuthorizationCodeExchange(emdash.db, parsed.data);
        if (!result.success) {
          const err = result.error ?? { code: "unknown", message: "Unknown error" };
          return oauthError(err.code, err.message, 400);
        }
        return oauthSuccess(result.data);
      }
      case "urn:ietf:params:oauth:grant-type:device_code": {
        const parsed = deviceCodeSchema.safeParse(body);
        if (!parsed.success) {
          return oauthError("invalid_request", formatZodError(parsed.error), 400);
        }
        const result = await handleDeviceTokenExchange(emdash.db, parsed.data);
        if (!result.success) {
          const err = result.error ?? { code: "unknown", message: "Unknown error" };
          if (result.deviceFlowError) {
            return oauthError(result.deviceFlowError, err.message, 400);
          }
          return oauthError(err.code, err.message, 400);
        }
        return oauthSuccess(result.data);
      }
      case "refresh_token": {
        const parsed = refreshSchema.safeParse(body);
        if (!parsed.success) {
          return oauthError("invalid_request", formatZodError(parsed.error), 400);
        }
        const result = await handleTokenRefresh(emdash.db, parsed.data);
        if (!result.success) {
          const err = result.error ?? { code: "unknown", message: "Unknown error" };
          return oauthError(err.code, err.message, 400);
        }
        return oauthSuccess(result.data);
      }
      default:
        return oauthError("unsupported_grant_type", `Unsupported grant_type: ${grantType}`, 400);
    }
  } catch (error) {
    return handleError(error, "Failed to process token request", "TOKEN_ERROR");
  }
};
const OAUTH_TOKEN_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  // OAuth 2.1 token endpoint is called cross-origin by external clients. Caller
  // must present PKCE code_verifier / device_code / refresh_token on each request,
  // so there is no ambient credential for CSRF to exploit.
  "Access-Control-Allow-Origin": "*"
};
const OAUTH_PREFLIGHT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
function oauthSuccess(data) {
  return Response.json(data, { headers: OAUTH_TOKEN_HEADERS });
}
function oauthError(error, description, status) {
  return Response.json(
    { error, error_description: description },
    { status, headers: OAUTH_TOKEN_HEADERS }
  );
}
function formatZodError(error) {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	OPTIONS,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
