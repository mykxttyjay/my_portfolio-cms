import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { h as handleSectionDelete, a as handleSectionGet, b as handleSectionUpdate } from './sections_B1nkfU_k.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { ag as updateSectionBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const { slug } = params;
  const denied = requirePerm(user, "sections:read");
  if (denied) return denied;
  if (!slug) {
    return apiError("VALIDATION_ERROR", "slug is required", 400);
  }
  try {
    const result = await handleSectionGet(db, slug);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to fetch section", "SECTION_GET_ERROR");
  }
};
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const { slug } = params;
  const denied = requirePerm(user, "sections:manage");
  if (denied) return denied;
  if (!slug) {
    return apiError("VALIDATION_ERROR", "slug is required", 400);
  }
  try {
    const body = await parseBody(request, updateSectionBody);
    if (isParseError(body)) return body;
    const result = await handleSectionUpdate(db, slug, body);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to update section", "SECTION_UPDATE_ERROR");
  }
};
const DELETE = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const { slug } = params;
  const denied = requirePerm(user, "sections:manage");
  if (denied) return denied;
  if (!slug) {
    return apiError("VALIDATION_ERROR", "slug is required", 400);
  }
  try {
    const result = await handleSectionDelete(db, slug);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to delete section", "SECTION_DELETE_ERROR");
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
