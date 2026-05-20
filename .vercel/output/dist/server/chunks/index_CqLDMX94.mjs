import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult } from './error_Da04EfM-.mjs';
import 'kysely';
import './revision_CCTbRhmI.mjs';
import './request-cache_BRmSfhRF.mjs';
import './user_C8998lto.mjs';
import './request-context_Dj39IhTD.mjs';
import './index_DUdTeXmb.mjs';
import { a as handleMarketplaceGetPlugin } from './marketplace_DW2P5rH2.mjs';
import './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const { id } = params;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const denied = requirePerm(user, "plugins:read");
  if (denied) return denied;
  if (!id) {
    return apiError("INVALID_REQUEST", "Plugin ID required", 400);
  }
  const result = await handleMarketplaceGetPlugin(emdash.config.marketplace, id);
  return unwrapResult(result);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
