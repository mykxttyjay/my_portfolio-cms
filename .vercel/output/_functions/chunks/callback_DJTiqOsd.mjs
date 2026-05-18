import { e as handleOAuthCallback, O as OAuthError } from './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { g as getPublicOrigin } from './public-url_B8zVhtAZ.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';
import { c as createOAuthStateStore } from './oauth-state-store_DFPzIXpQ.mjs';
import { R as Role } from './types-ndj-bYfi_CoL8kXti.mjs';

async function finalizeSetup(db) {
  const options = new OptionsRepository(db);
  const setupComplete = await options.get("emdash:setup_complete");
  if (setupComplete === true || setupComplete === "true") return;
  const setupState = await options.get("emdash:setup_state");
  if (setupState?.title && typeof setupState.title === "string") {
    await options.set("emdash:site_title", setupState.title);
  }
  if (setupState?.tagline && typeof setupState.tagline === "string") {
    await options.set("emdash:site_tagline", setupState.tagline);
  }
  await options.set("emdash:setup_complete", true);
  await options.delete("emdash:setup_state");
}

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": undefined, "SSR": true};
const prerender = false;
const VALID_PROVIDERS = /* @__PURE__ */ new Set(["github", "google"]);
function isValidProvider(provider) {
  return VALID_PROVIDERS.has(provider);
}
function envString(env, ...keys) {
  for (const key of keys) {
    const val = env[key];
    if (typeof val === "string" && val) return val;
  }
  return void 0;
}
function getOAuthConfig(env) {
  const providers = {};
  const githubClientId = envString(env, "EMDASH_OAUTH_GITHUB_CLIENT_ID", "GITHUB_CLIENT_ID");
  const githubClientSecret = envString(
    env,
    "EMDASH_OAUTH_GITHUB_CLIENT_SECRET",
    "GITHUB_CLIENT_SECRET"
  );
  if (githubClientId && githubClientSecret) {
    providers.github = {
      clientId: githubClientId,
      clientSecret: githubClientSecret
    };
  }
  const googleClientId = envString(env, "EMDASH_OAUTH_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID");
  const googleClientSecret = envString(
    env,
    "EMDASH_OAUTH_GOOGLE_CLIENT_SECRET",
    "GOOGLE_CLIENT_SECRET"
  );
  if (googleClientId && googleClientSecret) {
    providers.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret
    };
  }
  return providers;
}
const GET = async ({ params, request, locals, session, redirect }) => {
  const { emdash } = locals;
  const provider = params.provider;
  if (!provider || !isValidProvider(provider)) {
    return redirect(
      `/_emdash/admin/login?error=invalid_provider&message=${encodeURIComponent("Invalid OAuth provider")}`
    );
  }
  if (!emdash?.db) {
    return redirect(
      `/_emdash/admin/login?error=server_error&message=${encodeURIComponent("Database not configured")}`
    );
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (error) {
    const message = errorDescription || error;
    return redirect(
      `/_emdash/admin/login?error=oauth_denied&message=${encodeURIComponent(message)}`
    );
  }
  if (!code || !state) {
    return redirect(
      `/_emdash/admin/login?error=invalid_callback&message=${encodeURIComponent("Missing code or state parameter")}`
    );
  }
  try {
    const runtimeLocals = locals;
    const env = runtimeLocals.runtime?.env ?? Object.assign(__vite_import_meta_env__, { EDITOR: "C:\\WINDOWS\\notepad.exe" });
    const providers = getOAuthConfig(env);
    if (!providers[provider]) {
      return redirect(
        `/_emdash/admin/login?error=provider_not_configured&message=${encodeURIComponent(`OAuth provider ${provider} is not configured`)}`
      );
    }
    const adapter = createKyselyAdapter(emdash.db);
    const stateStore = createOAuthStateStore(emdash.db);
    const config = {
      baseUrl: `${getPublicOrigin(url, emdash?.config)}/_emdash`,
      providers,
      canSelfSignup: async (email) => {
        const options2 = new OptionsRepository(emdash.db);
        const setupComplete = await options2.get("emdash:setup_complete");
        if (setupComplete !== true && setupComplete !== "true") {
          return { allowed: true, role: Role.ADMIN };
        }
        const domain = email.split("@")[1]?.toLowerCase();
        if (!domain) {
          return null;
        }
        const entry = await emdash.db.selectFrom("allowed_domains").selectAll().where("domain", "=", domain).where("enabled", "=", 1).executeTakeFirst();
        if (!entry) {
          return null;
        }
        const roleLevel = entry.default_role;
        const roleMap = {
          50: Role.ADMIN,
          40: Role.EDITOR,
          30: Role.AUTHOR,
          20: Role.CONTRIBUTOR,
          10: Role.SUBSCRIBER
        };
        const role = roleMap[roleLevel] ?? Role.CONTRIBUTOR;
        if (!roleMap[roleLevel]) {
          console.warn(
            `[oauth] Unknown role level ${roleLevel} for domain ${domain}, defaulting to CONTRIBUTOR`
          );
        }
        return { allowed: true, role };
      }
    };
    const options = new OptionsRepository(emdash.db);
    const setupCompleteBefore = await options.get("emdash:setup_complete");
    const user = await handleOAuthCallback(config, adapter, provider, code, state, stateStore);
    const isFirstUser = setupCompleteBefore !== true && setupCompleteBefore !== "true";
    if (isFirstUser) {
      await finalizeSetup(emdash.db);
      console.log(`[oauth] Setup complete: created admin user via ${provider} (${user.email})`);
    }
    if (session) {
      session.set("user", { id: user.id });
    }
    return redirect("/_emdash/admin");
  } catch (callbackError) {
    console.error("OAuth callback error:", callbackError);
    let message = "Authentication failed";
    let errorCode = "oauth_error";
    if (callbackError instanceof OAuthError) {
      errorCode = callbackError.code;
      switch (callbackError.code) {
        case "invalid_state":
          message = "OAuth session expired or invalid. Please try again.";
          break;
        case "signup_not_allowed":
          message = "Self-signup is not allowed for your email. Please contact an administrator.";
          break;
        case "user_not_found":
          message = "Your account was not found. It may have been deleted.";
          break;
        case "token_exchange_failed":
          message = "Failed to complete authentication. Please try again.";
          break;
        case "profile_fetch_failed":
          message = "Failed to retrieve your profile. Please try again.";
          break;
        default:
          message = "Authentication failed. Please try again.";
          break;
      }
    }
    return redirect(
      `/_emdash/admin/login?error=${errorCode}&message=${encodeURIComponent(message)}`
    );
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
