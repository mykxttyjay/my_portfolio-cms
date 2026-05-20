import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult } from './error_Da04EfM-.mjs';
import 'kysely';
import './revision_CCTbRhmI.mjs';
import './request-cache_BRmSfhRF.mjs';
import './user_C8998lto.mjs';
import './request-context_Dj39IhTD.mjs';
import './index_DUdTeXmb.mjs';
import { g as handleThemeSearch } from './marketplace_DW2P5rH2.mjs';
import './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ url, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const denied = requirePerm(user, "plugins:read");
  if (denied) return denied;
  const query = url.searchParams.get("q") ?? void 0;
  const keyword = url.searchParams.get("keyword") ?? void 0;
  const sortParam = url.searchParams.get("sort");
  const validSorts = /* @__PURE__ */ new Set(["name", "created", "updated"]);
  let sort;
  if (sortParam && validSorts.has(sortParam)) {
    sort = sortParam;
  }
  const cursor = url.searchParams.get("cursor") ?? void 0;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 100) : void 0;
  const result = await handleThemeSearch(emdash.config.marketplace, query, {
    keyword,
    sort,
    cursor,
    limit
  });
  return unwrapResult(result);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
