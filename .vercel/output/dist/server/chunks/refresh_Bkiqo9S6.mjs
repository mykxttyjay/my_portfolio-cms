import { z } from 'zod';
import { a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { c as handleTokenRefresh } from './device-flow_BOO2HWPf.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';

const prerender = false;
const refreshSchema = z.object({
  refresh_token: z.string().min(1),
  grant_type: z.string().min(1)
});
const POST = async ({ request, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const body = await parseBody(request, refreshSchema);
    if (isParseError(body)) return body;
    const result = await handleTokenRefresh(emdash.db, body);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to refresh token", "TOKEN_REFRESH_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
