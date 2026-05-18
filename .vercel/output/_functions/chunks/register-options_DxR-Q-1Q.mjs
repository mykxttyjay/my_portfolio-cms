import { v as validateInvite, I as InviteError } from './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { d as generateRegistrationOptions } from './authenticate-BiDGbUVY_CNGQ9xrZ.mjs';
import { ulid } from 'ulidx';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { k as inviteRegisterOptionsBody } from './redirects_jp1t_nEU.mjs';
import { g as getPasskeyConfig, c as createChallengeStore } from './passkey-config_DY3_zRjI.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const body = await parseBody(request, inviteRegisterOptionsBody);
    if (isParseError(body)) return body;
    const adapter = createKyselyAdapter(emdash.db);
    const invite = await validateInvite(adapter, body.token);
    const url = new URL(request.url);
    const options = new OptionsRepository(emdash.db);
    const siteName = await options.get("emdash:site_title") ?? void 0;
    const passkeyConfig = getPasskeyConfig(url, siteName);
    const challengeStore = createChallengeStore(emdash.db);
    const tempUser = {
      id: ulid(),
      email: invite.email,
      name: body.name || null
    };
    const registrationOptions = await generateRegistrationOptions(
      passkeyConfig,
      tempUser,
      [],
      challengeStore
    );
    return apiSuccess({ options: registrationOptions });
  } catch (error) {
    if (error instanceof InviteError) {
      const statusMap = {
        invalid_token: 404,
        token_expired: 410,
        user_exists: 409
      };
      return apiError(error.code.toUpperCase(), error.message, statusMap[error.code] ?? 400);
    }
    return handleError(
      error,
      "Failed to generate registration options",
      "INVITE_REGISTER_OPTIONS_ERROR"
    );
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
