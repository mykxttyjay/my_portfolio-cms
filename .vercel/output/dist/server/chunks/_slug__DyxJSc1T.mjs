import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, r as requireDb, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { handleTermDelete, handleTermGet, handleTermUpdate } from './taxonomies_nAuOqHDY.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { an as updateTermBody, V as localeFilterQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { name, slug } = params;
  if (!name || !slug) return apiError("VALIDATION_ERROR", "Taxonomy name and slug required", 400);
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "taxonomies:read");
  if (denied) return denied;
  const query = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(query)) return query;
  try {
    const result = await handleTermGet(emdash.db, name, slug, { locale: query.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to get term", "TERM_GET_ERROR");
  }
};
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { name, slug } = params;
  if (!name || !slug) return apiError("VALIDATION_ERROR", "Taxonomy name and slug required", 400);
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "taxonomies:manage");
  if (denied) return denied;
  const query = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(query)) return query;
  try {
    const body = await parseBody(request, updateTermBody);
    if (isParseError(body)) return body;
    const result = await handleTermUpdate(emdash.db, name, slug, body, { locale: query.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to update term", "TERM_UPDATE_ERROR");
  }
};
const DELETE = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { name, slug } = params;
  if (!name || !slug) return apiError("VALIDATION_ERROR", "Taxonomy name and slug required", 400);
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "taxonomies:manage");
  if (denied) return denied;
  const query = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(query)) return query;
  try {
    const result = await handleTermDelete(emdash.db, name, slug, { locale: query.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to delete term", "TERM_DELETE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	DELETE,
	GET,
	PUT,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
