import { f as createAuthorizationUrl } from './index_Bxms_uoh.mjs';
import { g as getPublicOrigin } from './public-url_B8zVhtAZ.mjs';
import { c as createOAuthStateStore } from './oauth-state-store_DFPzIXpQ.mjs';

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
const GET = async ({ params, request, locals, redirect }) => {
  const { emdash } = locals;
  const provider = params.provider;
  const referer = request.headers.get("referer") ?? "";
  const errorRedirectBase = referer.includes("/setup") ? "/_emdash/admin/setup" : "/_emdash/admin/login";
  if (!provider || !isValidProvider(provider)) {
    return redirect(
      `${errorRedirectBase}?error=invalid_provider&message=${encodeURIComponent("Invalid OAuth provider")}`
    );
  }
  if (!emdash?.db) {
    return redirect(
      `${errorRedirectBase}?error=server_error&message=${encodeURIComponent("Database not configured")}`
    );
  }
  try {
    const url = new URL(request.url);
    const runtimeLocals = locals;
    const env = runtimeLocals.runtime?.env ?? Object.assign(__vite_import_meta_env__, {});
    const providers = getOAuthConfig(env);
    if (!providers[provider]) {
      return redirect(
        `${errorRedirectBase}?error=provider_not_configured&message=${encodeURIComponent(`OAuth provider ${provider} is not configured. Set either EMDASH_OAUTH_${provider.toUpperCase()}_CLIENT_ID and EMDASH_OAUTH_${provider.toUpperCase()}_CLIENT_SECRET, or ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET.`)}`
      );
    }
    const config = {
      baseUrl: `${getPublicOrigin(url, emdash?.config)}/_emdash`,
      providers
    };
    const stateStore = createOAuthStateStore(emdash.db);
    const { url: authUrl } = await createAuthorizationUrl(config, provider, stateStore);
    return redirect(authUrl);
  } catch (error) {
    console.error("OAuth initiation error:", error);
    return redirect(
      `${errorRedirectBase}?error=oauth_error&message=${encodeURIComponent("Failed to start OAuth flow. Please try again.")}`
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
