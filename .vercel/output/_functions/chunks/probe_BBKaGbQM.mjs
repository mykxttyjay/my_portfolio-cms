import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { b as apiSuccess, a as apiError, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { F as importProbeBody } from './redirects_jp1t_nEU.mjs';
import { p as probeUrl } from './index_CfxEjB-M.mjs';
import { S as SsrfError } from './ssrf_CAVg0-kk.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { user } = locals;
  const denied = requirePerm(user, "import:execute");
  if (denied) return denied;
  try {
    const body = await parseBody(request, importProbeBody);
    if (isParseError(body)) return body;
    const result = await probeUrl(body.url);
    return apiSuccess({
      success: true,
      result
    });
  } catch (error) {
    if (error instanceof SsrfError) {
      return apiError("SSRF_BLOCKED", error.message, 400);
    }
    return handleError(error, "Failed to probe URL", "PROBE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
