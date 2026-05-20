import { b as createInvite, I as InviteError } from './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { l as inviteCreateBody } from './redirects_jp1t_nEU.mjs';
import { g as getSiteBaseUrl } from './site-url_BNiFN_Aq.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';
import { R as Role } from './types-ndj-bYfi_CoL8kXti.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  if (!user || user.role < Role.ADMIN) {
    return apiError("FORBIDDEN", "Admin privileges required", 403);
  }
  const adapter = createKyselyAdapter(emdash.db);
  try {
    const body = await parseBody(request, inviteCreateBody);
    if (isParseError(body)) return body;
    const role = body.role ?? Role.AUTHOR;
    const options = new OptionsRepository(emdash.db);
    const siteName = await options.get("emdash:site_title") || "EmDash";
    const baseUrl = await getSiteBaseUrl(emdash.db, request);
    const emailSend = emdash.email?.isAvailable() ? (message) => emdash.email.send(message, "system") : void 0;
    const result = await createInvite(
      {
        baseUrl,
        siteName,
        email: emailSend
      },
      adapter,
      body.email,
      role,
      user.id
    );
    if (emailSend) {
      return apiSuccess({
        success: true,
        message: `Invite sent to ${body.email}`
      });
    }
    return apiSuccess(
      {
        success: true,
        message: "Invite created. No email provider configured — share the link manually.",
        inviteUrl: result.url
      },
      200
    );
  } catch (error) {
    if (error instanceof InviteError) {
      const statusMap = {
        user_exists: 409,
        invalid_token: 400,
        token_expired: 400
      };
      return apiError(error.code.toUpperCase(), error.message, statusMap[error.code] ?? 400);
    }
    return handleError(error, "Failed to create invite", "INVITE_CREATE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
