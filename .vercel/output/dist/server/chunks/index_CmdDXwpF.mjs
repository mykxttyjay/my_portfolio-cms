import { h as hasPermission } from './index_Bxms_uoh.mjs';
import { r as requirePerm, a as requireOwnerPerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult, m as mapErrorStatus } from './error_Da04EfM-.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { D as contentListQuery, E as contentCreateBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, url, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "content:read");
  if (denied) return denied;
  const collection = params.collection;
  const query = parseQuery(url, contentListQuery);
  if (isParseError(query)) return query;
  if (!emdash?.handleContentList) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const params_ = hasPermission(user, "content:read_drafts") ? query : { ...query, status: "published" };
  const result = await emdash.handleContentList(collection, params_);
  return unwrapResult(result);
};
const POST = async ({ params, request, locals, cache }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "content:create");
  if (denied) return denied;
  const collection = params.collection;
  const body = await parseBody(request, contentCreateBody);
  if (isParseError(body)) return body;
  if (!emdash?.handleContentCreate || !emdash?.handleContentGet) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  if (body.translationOf) {
    const source = await emdash.handleContentGet(collection, body.translationOf);
    if (!source.success) {
      return apiError(
        source.error?.code ?? "NOT_FOUND",
        source.error?.message ?? "Translation source not found",
        mapErrorStatus(source.error?.code)
      );
    }
    const sourceAuthor = source.data.item.authorId ?? "";
    const translationDenied = requireOwnerPerm(
      user,
      sourceAuthor,
      "content:edit_own",
      "content:edit_any"
    );
    if (translationDenied) return translationDenied;
  }
  const hasDateOverride = body.publishedAt !== void 0 || body.createdAt !== void 0;
  if (hasDateOverride && !hasPermission(user, "content:publish_any")) {
    return apiError(
      "FORBIDDEN",
      "Writing publishedAt or createdAt requires content:publish_any permission",
      403
    );
  }
  const result = await emdash.handleContentCreate(collection, {
    ...body,
    authorId: user?.id,
    locale: body.locale,
    translationOf: body.translationOf
  });
  if (!result.success) return unwrapResult(result);
  if (cache?.enabled) await cache.invalidate({ tags: [collection] });
  return unwrapResult(result, 201);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
