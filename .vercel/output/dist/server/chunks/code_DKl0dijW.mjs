import { z } from 'zod';
import { a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { a as handleDeviceCodeRequest } from './device-flow_BOO2HWPf.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { g as getPublicOrigin } from './public-url_B8zVhtAZ.mjs';
import { g as getClientIp, c as checkRateLimit, r as rateLimitResponse } from './rate-limit_CtBubquO.mjs';
import { g as getTrustedProxyHeaders } from './trusted-proxy_ctqGrp-D.mjs';

const prerender = false;
const deviceCodeSchema = z.object({
  client_id: z.string().optional(),
  scope: z.string().optional()
});
const POST = async ({ request, locals, url }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const body = await parseBody(request, deviceCodeSchema);
    if (isParseError(body)) return body;
    const ip = getClientIp(request, getTrustedProxyHeaders(emdash.config));
    const rateLimit = await checkRateLimit(emdash.db, ip, "device/code", 10, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(60);
    }
    const verificationUri = new URL(
      "/_emdash/admin/device",
      getPublicOrigin(url, emdash?.config)
    ).toString();
    const result = await handleDeviceCodeRequest(emdash.db, body, verificationUri);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to create device code", "DEVICE_CODE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
