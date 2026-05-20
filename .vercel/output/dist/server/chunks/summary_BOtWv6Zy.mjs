import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { h as handleNotFoundSummary } from './redirects_B14b1HDp.mjs';
import { a as parseQuery, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { $ as notFoundSummaryQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ url, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const denied = requirePerm(user, "redirects:read");
  if (denied) return denied;
  try {
    const query = parseQuery(url, notFoundSummaryQuery);
    if (isParseError(query)) return query;
    const result = await handleNotFoundSummary(db, query.limit);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to fetch 404 summary", "NOT_FOUND_SUMMARY_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
