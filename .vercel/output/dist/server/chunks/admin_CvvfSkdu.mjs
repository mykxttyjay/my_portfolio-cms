import './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { j as generateToken, d as generateRegistrationOptions } from './authenticate-BiDGbUVY_CNGQ9xrZ.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { g as getPublicOrigin } from './public-url_B8zVhtAZ.mjs';
import { al as setupAdminBody } from './redirects_jp1t_nEU.mjs';
import { g as getPasskeyConfig, c as createChallengeStore } from './passkey-config_DY3_zRjI.mjs';
import { S as SETUP_NONCE_COOKIE, a as SETUP_NONCE_MAX_AGE_SECONDS } from './setup-nonce_BxCcI2Az.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';

const prerender = false;
const POST = async ({ cookies, request, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const options = new OptionsRepository(emdash.db);
    const setupComplete = await options.get("emdash:setup_complete");
    if (setupComplete === true || setupComplete === "true") {
      return apiError("SETUP_COMPLETE", "Setup already complete", 400);
    }
    const adapter = createKyselyAdapter(emdash.db);
    const userCount = await adapter.countUsers();
    if (userCount > 0) {
      return apiError("ADMIN_EXISTS", "Admin user already exists", 400);
    }
    const body = await parseBody(request, setupAdminBody);
    if (isParseError(body)) return body;
    const existingState = await options.get("emdash:setup_state");
    const nonce = generateToken();
    const url = new URL(request.url);
    const siteName = await options.get("emdash:site_title") ?? void 0;
    const siteUrl = getPublicOrigin(url, emdash?.config);
    const passkeyConfig = getPasskeyConfig(url, siteName, siteUrl);
    const challengeStore = createChallengeStore(emdash.db);
    const tempUser = {
      id: `setup-${Date.now()}`,
      // Temporary ID
      email: body.email.toLowerCase(),
      name: body.name || null
    };
    const registrationOptions = await generateRegistrationOptions(
      passkeyConfig,
      tempUser,
      [],
      // No existing credentials
      challengeStore
    );
    await options.set("emdash:setup_state", {
      ...existingState,
      step: "admin",
      email: body.email.toLowerCase(),
      name: body.name || null,
      tempUserId: tempUser.id,
      nonce
    });
    const publicOrigin = new URL(siteUrl);
    cookies.set(SETUP_NONCE_COOKIE, nonce, {
      path: "/_emdash/",
      httpOnly: true,
      sameSite: "strict",
      secure: publicOrigin.protocol === "https:",
      maxAge: SETUP_NONCE_MAX_AGE_SECONDS
    });
    return apiSuccess({
      success: true,
      options: registrationOptions
    });
  } catch (error) {
    return handleError(error, "Failed to create admin", "SETUP_ADMIN_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
