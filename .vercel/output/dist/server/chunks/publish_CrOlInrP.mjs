import { h as hasPermission } from './index_Bxms_uoh.mjs';
import { a as requireOwnerPerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, m as mapErrorStatus, u as unwrapResult } from './error_Da04EfM-.mjs';
import { b as parseOptionalBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { z as contentPublishBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const POST = async ({ params, request, locals, cache }) => {
  const { emdash, user } = locals;
  const collection = params.collection;
  const id = params.id;
  if (!emdash?.handleContentPublish || !emdash?.handleContentGet) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const body = await parseOptionalBody(request, contentPublishBody, {});
  if (isParseError(body)) return body;
  const existing = await emdash.handleContentGet(collection, id);
  if (!existing.success) {
    return apiError(
      existing.error?.code ?? "UNKNOWN_ERROR",
      existing.error?.message ?? "Unknown error",
      mapErrorStatus(existing.error?.code)
    );
  }
  const existingData = existing.data && typeof existing.data === "object" ? (
    // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- handler returns unknown data; narrowed by typeof check above
    existing.data
  ) : void 0;
  const existingItem = existingData?.item && typeof existingData.item === "object" ? (
    // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- narrowed by typeof check above
    existingData.item
  ) : existingData;
  const authorId = typeof existingItem?.authorId === "string" ? existingItem.authorId : "";
  const denied = requireOwnerPerm(user, authorId, "content:publish_own", "content:publish_any");
  if (denied) return denied;
  const publishedAt = body?.publishedAt;
  if (publishedAt !== void 0 && !hasPermission(user, "content:publish_any")) {
    return apiError(
      "FORBIDDEN",
      "Setting publishedAt requires content:publish_any permission",
      403
    );
  }
  const resolvedId = typeof existingItem?.id === "string" ? existingItem.id : id;
  const result = await emdash.handleContentPublish(collection, resolvedId, {
    publishedAt
  });
  if (!result.success) return unwrapResult(result);
  if (cache?.enabled) await cache.invalidate({ tags: [collection, resolvedId] });
  return unwrapResult(result);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
