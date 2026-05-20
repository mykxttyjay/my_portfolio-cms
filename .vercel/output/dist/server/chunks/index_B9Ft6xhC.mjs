import './index_Bxms_uoh.mjs';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { d as bylinesListQuery, e as bylineCreateBody } from './redirects_jp1t_nEU.mjs';
import { invalidateBylineCache } from './index_QNee-ffH.mjs';
import { B as BylineRepository } from './byline_BJnlLrR9.mjs';
import { R as Role } from './types-ndj-bYfi_CoL8kXti.mjs';

const prerender = false;
const GET = async ({ url, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const denied = requirePerm(user, "content:read");
  if (denied) return denied;
  const query = parseQuery(url, bylinesListQuery);
  if (isParseError(query)) return query;
  try {
    const repo = new BylineRepository(emdash.db);
    const result = await repo.findMany({
      search: query.search,
      isGuest: query.isGuest,
      userId: query.userId,
      cursor: query.cursor,
      limit: query.limit
    });
    return apiSuccess(result);
  } catch (error) {
    return handleError(error, "Failed to list bylines", "BYLINE_LIST_ERROR");
  }
};
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  if (!user || user.role < Role.EDITOR) {
    return apiError("FORBIDDEN", "Editor privileges required", 403);
  }
  const body = await parseBody(request, bylineCreateBody);
  if (isParseError(body)) return body;
  try {
    const repo = new BylineRepository(emdash.db);
    const byline = await repo.create({
      slug: body.slug,
      displayName: body.displayName,
      bio: body.bio ?? null,
      avatarMediaId: body.avatarMediaId ?? null,
      websiteUrl: body.websiteUrl ?? null,
      userId: body.userId ?? null,
      isGuest: body.isGuest
    });
    invalidateBylineCache();
    return apiSuccess(byline, 201);
  } catch (error) {
    return handleError(error, "Failed to create byline", "BYLINE_CREATE_ERROR");
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
