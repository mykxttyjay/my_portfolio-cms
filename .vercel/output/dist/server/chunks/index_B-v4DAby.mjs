import './index_Bxms_uoh.mjs';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { c as bylineUpdateBody } from './redirects_jp1t_nEU.mjs';
import { invalidateBylineCache } from './index_QNee-ffH.mjs';
import { B as BylineRepository } from './byline_BJnlLrR9.mjs';
import { R as Role } from './types-ndj-bYfi_CoL8kXti.mjs';

const prerender = false;
function requireEditor(user) {
  if (!user || user.role < Role.EDITOR) {
    return apiError("FORBIDDEN", "Editor privileges required", 403);
  }
  return null;
}
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "content:read");
  if (denied) return denied;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const repo = new BylineRepository(emdash.db);
    const byline = await repo.findById(params.id);
    if (!byline) return apiError("NOT_FOUND", "Byline not found", 404);
    return apiSuccess(byline);
  } catch (error) {
    return handleError(error, "Failed to get byline", "BYLINE_GET_ERROR");
  }
};
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const denied = requireEditor(user);
  if (denied) return denied;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const body = await parseBody(request, bylineUpdateBody);
  if (isParseError(body)) return body;
  try {
    const repo = new BylineRepository(emdash.db);
    const byline = await repo.update(params.id, {
      slug: body.slug,
      displayName: body.displayName,
      bio: body.bio ?? null,
      avatarMediaId: body.avatarMediaId ?? null,
      websiteUrl: body.websiteUrl ?? null,
      userId: body.userId ?? null,
      isGuest: body.isGuest
    });
    if (!byline) return apiError("NOT_FOUND", "Byline not found", 404);
    invalidateBylineCache();
    return apiSuccess(byline);
  } catch (error) {
    return handleError(error, "Failed to update byline", "BYLINE_UPDATE_ERROR");
  }
};
const DELETE = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const denied = requireEditor(user);
  if (denied) return denied;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const repo = new BylineRepository(emdash.db);
    const deleted = await repo.delete(params.id);
    if (!deleted) return apiError("NOT_FOUND", "Byline not found", 404);
    invalidateBylineCache();
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleError(error, "Failed to delete byline", "BYLINE_DELETE_ERROR");
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
