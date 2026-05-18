import { z } from 'zod';
import { a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { b as handleDeviceTokenExchange } from './device-flow_BOO2HWPf.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { g as getClientIp, c as checkRateLimit, r as rateLimitResponse } from './rate-limit_CtBubquO.mjs';
import { g as getTrustedProxyHeaders } from './trusted-proxy_ctqGrp-D.mjs';

const prerender = false;
const deviceTokenSchema = z.object({
  device_code: z.string().min(1),
  grant_type: z.string().min(1)
});
const POST = async ({ request, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const body = await parseBody(request, deviceTokenSchema);
    if (isParseError(body)) return body;
    const ip = getClientIp(request, getTrustedProxyHeaders(emdash.config));
    const rateLimit = await checkRateLimit(emdash.db, ip, "device/token", 12, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(60);
    }
    const result = await handleDeviceTokenExchange(emdash.db, body);
    if (!result.success && result.deviceFlowError) {
      const errorBody = { error: result.deviceFlowError };
      if (result.deviceFlowInterval !== void 0) {
        errorBody.interval = result.deviceFlowInterval;
      }
      return Response.json(errorBody, {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache"
        }
      });
    }
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to exchange device code", "TOKEN_EXCHANGE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
