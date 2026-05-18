import { r as requestSignup } from './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { a as apiError, b as apiSuccess } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { v as signupRequestBody } from './redirects_jp1t_nEU.mjs';
import { g as getSiteBaseUrl } from './site-url_BNiFN_Aq.mjs';
import { g as getClientIp, c as checkRateLimit } from './rate-limit_CtBubquO.mjs';
import { g as getTrustedProxyHeaders } from './trusted-proxy_ctqGrp-D.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';

const prerender = false;
const GENERIC_SUCCESS = {
  success: true,
  message: "If your email domain is allowed, you'll receive a verification email."
};
const POST = async ({ request, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  if (!emdash.email?.isAvailable()) {
    return apiError(
      "EMAIL_NOT_CONFIGURED",
      "Email not configured. Self-signup is unavailable.",
      503
    );
  }
  try {
    const body = await parseBody(request, signupRequestBody);
    if (isParseError(body)) return body;
    const ip = getClientIp(request, getTrustedProxyHeaders(emdash.config));
    const rateLimit = await checkRateLimit(emdash.db, ip, "signup/request", 3, 300);
    if (!rateLimit.allowed) {
      return apiSuccess(GENERIC_SUCCESS);
    }
    const adapter = createKyselyAdapter(emdash.db);
    const options = new OptionsRepository(emdash.db);
    const siteName = await options.get("emdash:site_title") || "EmDash";
    const baseUrl = await getSiteBaseUrl(emdash.db, request);
    await requestSignup(
      {
        baseUrl,
        siteName,
        email: (message) => emdash.email.send(message, "system")
      },
      adapter,
      body.email.toLowerCase().trim()
    );
    return apiSuccess(GENERIC_SUCCESS);
  } catch (error) {
    console.error("Signup request error:", error);
    return apiSuccess(GENERIC_SUCCESS);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
