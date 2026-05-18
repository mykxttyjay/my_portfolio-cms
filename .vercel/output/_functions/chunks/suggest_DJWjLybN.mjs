import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { a as parseQuery, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { ae as searchSuggestQuery } from './redirects_jp1t_nEU.mjs';
import 'kysely';
import { a as getSuggestions } from './query_noBLK03F.mjs';

const prerender = false;
const GET = async ({ url, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
  }
  const query = parseQuery(url, searchSuggestQuery);
  if (isParseError(query)) return query;
  const collections = query.collections ? query.collections.split(",").map((c) => c.trim()) : void 0;
  try {
    await emdash.ensureSearchHealthy?.();
    const suggestions = await getSuggestions(emdash.db, query.q, {
      collections,
      locale: query.locale,
      limit: query.limit
    });
    return apiSuccess({ items: suggestions });
  } catch (error) {
    return handleError(error, "Failed to get suggestions", "SUGGESTION_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
