import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { g as handleRedirectList, i as handleRedirectCreate } from './redirects_B14b1HDp.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { a3 as redirectsListQuery, a4 as createRedirectBody } from './redirects_jp1t_nEU.mjs';
import { invalidateRedirectCache } from './cache_BTiid5_I.mjs';

const prerender = false;
const GET = async ({ url, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const denied = requirePerm(user, "redirects:read");
  if (denied) return denied;
  try {
    const query = parseQuery(url, redirectsListQuery);
    if (isParseError(query)) return query;
    const result = await handleRedirectList(db, query);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to fetch redirects", "REDIRECT_LIST_ERROR");
  }
};
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const denied = requirePerm(user, "redirects:manage");
  if (denied) return denied;
  try {
    const body = await parseBody(request, createRedirectBody);
    if (isParseError(body)) return body;
    const result = await handleRedirectCreate(db, body);
    invalidateRedirectCache();
    return unwrapResult(result, 201);
  } catch (error) {
    return handleError(error, "Failed to create redirect", "REDIRECT_CREATE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
