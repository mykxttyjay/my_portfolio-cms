import { s as sendMagicLink } from './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { a as apiError, b as apiSuccess } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { m as magicLinkSendBody } from './redirects_jp1t_nEU.mjs';
import { g as getSiteBaseUrl } from './site-url_BNiFN_Aq.mjs';
import { g as getClientIp, c as checkRateLimit } from './rate-limit_CtBubquO.mjs';
import { g as getTrustedProxyHeaders } from './trusted-proxy_ctqGrp-D.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const body = await parseBody(request, magicLinkSendBody);
    if (isParseError(body)) return body;
    const ip = getClientIp(request, getTrustedProxyHeaders(emdash.config));
    const rateLimit = await checkRateLimit(emdash.db, ip, "magic-link/send", 3, 300);
    if (!rateLimit.allowed) {
      return apiSuccess({
        success: true,
        message: "If an account exists for this email, a magic link has been sent."
      });
    }
    if (!emdash.email?.isAvailable()) {
      return apiError(
        "EMAIL_NOT_CONFIGURED",
        "Email is not configured. Magic link authentication requires an email provider.",
        503
      );
    }
    const options = new OptionsRepository(emdash.db);
    const baseUrl = await getSiteBaseUrl(emdash.db, request);
    const siteName = await options.get("emdash:site_title") ?? "EmDash";
    const config = {
      baseUrl,
      siteName,
      email: (message) => emdash.email.send(message, "system")
    };
    const adapter = createKyselyAdapter(emdash.db);
    await sendMagicLink(config, adapter, body.email.toLowerCase());
    return apiSuccess({
      success: true,
      message: "If an account exists for this email, a magic link has been sent."
    });
  } catch (error) {
    console.error("Magic link send error:", error);
    return apiSuccess({
      success: true,
      message: "If an account exists for this email, a magic link has been sent."
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
