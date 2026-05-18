import { S as SchemaRegistry } from './adapt-sandbox-entry_H5gl0boC.mjs';
import 'better-sqlite3';
import 'kysely';
import 'image-size';
import '@emdash-cms/plugin-types';
import 'mime/lite';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { J as wpPluginAnalyzeBody } from './redirects_jp1t_nEU.mjs';
import { g as getSource } from './index_CfxEjB-M.mjs';
import { r as resolveAndValidateExternalUrl, S as SsrfError } from './ssrf_CAVg0-kk.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "import:execute");
  if (denied) return denied;
  try {
    const body = await parseBody(request, wpPluginAnalyzeBody);
    if (isParseError(body)) return body;
    try {
      await resolveAndValidateExternalUrl(body.url);
    } catch (e) {
      const msg = e instanceof SsrfError ? e.message : "Invalid URL";
      return apiError("SSRF_BLOCKED", msg, 400);
    }
    const source = getSource("wordpress-plugin");
    if (!source) {
      return apiError("NOT_CONFIGURED", "WordPress plugin source not available", 500);
    }
    const existingCollections = await fetchExistingCollections(emdash?.db);
    const analysis = await source.analyze(
      { type: "url", url: body.url, token: body.token },
      {
        db: emdash?.db,
        getExistingCollections: async () => existingCollections
      }
    );
    return apiSuccess({
      success: true,
      analysis
    });
  } catch (error) {
    return handleError(error, "Failed to analyze WordPress site", "WP_PLUGIN_ANALYZE_ERROR");
  }
};
async function fetchExistingCollections(db) {
  const result = /* @__PURE__ */ new Map();
  if (!db) return result;
  try {
    const registry = new SchemaRegistry(db);
    const collections = await registry.listCollections();
    for (const collection of collections) {
      const fields = await registry.listFields(collection.id);
      const fieldMap = /* @__PURE__ */ new Map();
      for (const field of fields) {
        fieldMap.set(field.slug, { type: field.type });
      }
      result.set(collection.slug, {
        slug: collection.slug,
        fields: fieldMap
      });
    }
  } catch (error) {
    console.warn("Could not fetch schema registry:", error);
  }
  return result;
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
