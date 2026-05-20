import { g as getAuthMode } from './mode_CNhffo5w.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';

const prerender = false;
const GET = async ({ locals }) => {
  const { emdash } = locals;
  const config = emdash?.config;
  const authMode = config ? getAuthMode(config) : null;
  const isExternal = authMode?.type === "external";
  let siteName = "EmDash";
  if (emdash?.db) {
    try {
      const options = new OptionsRepository(emdash.db);
      siteName = await options.get("emdash:site_title") || "EmDash";
    } catch {
    }
  }
  const response = {
    instance: {
      name: siteName,
      version: "0.1.0"
    },
    auth: {
      mode: isExternal ? "external" : "passkey",
      ...isExternal && authMode.type === "external" ? { external_provider: authMode.entrypoint } : {},
      methods: {
        device_flow: !isExternal ? {
          client_id: "emdash-cli",
          device_authorization_endpoint: "/_emdash/api/oauth/device/code",
          token_endpoint: "/_emdash/api/oauth/device/token"
        } : void 0,
        authorization_code: !isExternal ? {
          authorization_endpoint: "/_emdash/oauth/authorize",
          token_endpoint: "/_emdash/api/oauth/token"
        } : void 0,
        api_tokens: true
      }
    }
  };
  return Response.json(response, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
