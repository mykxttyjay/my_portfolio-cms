import { h as hasPermission } from './index_Bxms_uoh.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { a as parseQuery, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { af as searchQuery } from './redirects_jp1t_nEU.mjs';
import 'kysely';
import { s as searchWithDb } from './query_CQjuX4M5.mjs';

const prerender = false;
const GET = async ({ url, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
  }
  const query = parseQuery(url, searchQuery);
  if (isParseError(query)) return query;
  const collections = query.collections ? query.collections.split(",").map((c) => c.trim()) : void 0;
  const status = query.status && query.status !== "published" && hasPermission(user, "content:read_drafts") ? query.status : "published";
  try {
    await emdash.ensureSearchHealthy?.();
    const result = await searchWithDb(emdash.db, query.q, {
      collections,
      status,
      locale: query.locale,
      limit: query.limit
    });
    return apiSuccess(result);
  } catch (error) {
    return handleError(error, "Search failed", "SEARCH_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
