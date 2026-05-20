import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { d as generateRegistrationOptions } from './authenticate-BiDGbUVY_CNGQ9xrZ.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { b as parseOptionalBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { g as getPublicOrigin } from './public-url_B8zVhtAZ.mjs';
import { o as passkeyRegisterOptionsBody } from './redirects_jp1t_nEU.mjs';
import { g as getPasskeyConfig, c as createChallengeStore } from './passkey-config_DY3_zRjI.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';

const prerender = false;
const MAX_PASSKEYS = 10;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  if (!user) {
    return apiError("NOT_AUTHENTICATED", "Not authenticated", 401);
  }
  try {
    const adapter = createKyselyAdapter(emdash.db);
    const count = await adapter.countCredentialsByUserId(user.id);
    if (count >= MAX_PASSKEYS) {
      return apiError("PASSKEY_LIMIT", `Maximum of ${MAX_PASSKEYS} passkeys allowed`, 400);
    }
    const body = await parseOptionalBody(request, passkeyRegisterOptionsBody, {});
    if (isParseError(body)) return body;
    const existingCredentials = await adapter.getCredentialsByUserId(user.id);
    const url = new URL(request.url);
    const optionsRepo = new OptionsRepository(emdash.db);
    const siteName = await optionsRepo.get("emdash:site_title") ?? void 0;
    const siteUrl = getPublicOrigin(url, emdash?.config);
    const passkeyConfig = getPasskeyConfig(url, siteName, siteUrl);
    const challengeStore = createChallengeStore(emdash.db);
    const registrationOptions = await generateRegistrationOptions(
      passkeyConfig,
      { id: user.id, email: user.email, name: user.name },
      existingCredentials,
      challengeStore
    );
    if (body.name) {
      await optionsRepo.set(`emdash:passkey_pending:${user.id}`, {
        name: body.name
      });
    }
    return apiSuccess({
      options: registrationOptions
    });
  } catch (error) {
    return handleError(
      error,
      "Failed to generate registration options",
      "PASSKEY_REGISTER_OPTIONS_ERROR"
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
