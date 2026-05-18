import { z } from 'zod';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import 'kysely';
import './revision_CCTbRhmI.mjs';
import './request-cache_BRmSfhRF.mjs';
import './user_C8998lto.mjs';
import './request-context_Dj39IhTD.mjs';
import './index_DUdTeXmb.mjs';
import { h as handleMarketplaceInstall } from './marketplace_DW2P5rH2.mjs';
import { b as parseOptionalBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import './redirects_jp1t_nEU.mjs';

const prerender = false;
const installBodySchema = z.object({
  version: z.string().min(1).optional()
});
const POST = async ({ params, request, locals }) => {
  try {
    const { emdash, user } = locals;
    const { id } = params;
    if (!emdash?.db) {
      return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
    }
    const denied = requirePerm(user, "plugins:manage");
    if (denied) return denied;
    if (!id) {
      return apiError("INVALID_REQUEST", "Plugin ID required", 400);
    }
    const body = await parseOptionalBody(request, installBodySchema, {});
    if (isParseError(body)) return body;
    const configuredPluginIds = new Set(
      emdash.configuredPlugins.map((p) => p.id)
    );
    const siteOrigin = new URL(request.url).origin;
    const result = await handleMarketplaceInstall(
      emdash.db,
      emdash.storage,
      emdash.getSandboxRunner(),
      emdash.config.marketplace,
      id,
      { version: body.version, configuredPluginIds, siteOrigin }
    );
    if (!result.success) return unwrapResult(result);
    await emdash.syncMarketplacePlugins();
    return unwrapResult(result, 201);
  } catch (error) {
    console.error("[marketplace-install] Unhandled error:", error);
    return handleError(error, "Failed to install plugin from marketplace", "INSTALL_FAILED");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
