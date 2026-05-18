import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { d as handleRedirectDelete, e as handleRedirectGet, f as handleRedirectUpdate } from './redirects_B14b1HDp.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { a2 as updateRedirectBody } from './redirects_jp1t_nEU.mjs';
import { invalidateRedirectCache } from './cache_BTiid5_I.mjs';

const prerender = false;
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const { id } = params;
  const denied = requirePerm(user, "redirects:read");
  if (denied) return denied;
  if (!id) {
    return apiError("VALIDATION_ERROR", "id is required", 400);
  }
  try {
    const result = await handleRedirectGet(db, id);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to fetch redirect", "REDIRECT_GET_ERROR");
  }
};
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const { id } = params;
  const denied = requirePerm(user, "redirects:manage");
  if (denied) return denied;
  if (!id) {
    return apiError("VALIDATION_ERROR", "id is required", 400);
  }
  try {
    const body = await parseBody(request, updateRedirectBody);
    if (isParseError(body)) return body;
    const result = await handleRedirectUpdate(db, id, body);
    invalidateRedirectCache();
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to update redirect", "REDIRECT_UPDATE_ERROR");
  }
};
const DELETE = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const { id } = params;
  const denied = requirePerm(user, "redirects:manage");
  if (denied) return denied;
  if (!id) {
    return apiError("VALIDATION_ERROR", "id is required", 400);
  }
  try {
    const result = await handleRedirectDelete(db, id);
    invalidateRedirectCache();
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to delete redirect", "REDIRECT_DELETE_ERROR");
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
