import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, r as requireDb, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { handleTermList, handleTermCreate } from './taxonomies_nAuOqHDY.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { ao as createTermBody, V as localeFilterQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { name } = params;
  if (!name) return apiError("VALIDATION_ERROR", "Taxonomy name required", 400);
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "taxonomies:read");
  if (denied) return denied;
  const query = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(query)) return query;
  try {
    const result = await handleTermList(emdash.db, name, { locale: query.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to list terms", "TERM_LIST_ERROR");
  }
};
const POST = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { name } = params;
  if (!name) return apiError("VALIDATION_ERROR", "Taxonomy name required", 400);
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "taxonomies:manage");
  if (denied) return denied;
  try {
    const body = await parseBody(request, createTermBody);
    if (isParseError(body)) return body;
    const result = await handleTermCreate(emdash.db, name, body);
    return unwrapResult(result, 201);
  } catch (error) {
    return handleError(error, "Failed to create term", "TERM_CREATE_ERROR");
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
