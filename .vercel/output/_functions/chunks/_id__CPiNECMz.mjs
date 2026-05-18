import { h as hasPermission } from './index_Bxms_uoh.mjs';
import { a as requireOwnerPerm, r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, m as mapErrorStatus, u as unwrapResult } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { C as contentUpdateBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, url, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "content:read");
  if (denied) return denied;
  const collection = params.collection;
  const id = params.id;
  const locale = url.searchParams.get("locale") || void 0;
  if (!emdash?.handleContentGet) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const result = await emdash.handleContentGet(collection, id, locale);
  if (result.success && !hasPermission(user, "content:read_drafts")) {
    const data = result.data && typeof result.data === "object" ? (
      // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- handler returns unknown data; narrowed by typeof check
      result.data
    ) : void 0;
    const item = data?.item && typeof data.item === "object" ? (
      // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- narrowed by typeof check
      data.item
    ) : void 0;
    const status = typeof item?.status === "string" ? item.status : null;
    if (status !== "published") {
      return apiError("NOT_FOUND", `Content item not found: ${id}`, 404);
    }
    if (item) {
      if (item.liveData && typeof item.liveData === "object") {
        item.data = item.liveData;
      }
      delete item.liveData;
      delete item.draftRevisionId;
    }
  }
  return unwrapResult(result);
};
const PUT = async ({ params, request, locals, cache }) => {
  const { emdash, user } = locals;
  const collection = params.collection;
  const id = params.id;
  const body = await parseBody(request, contentUpdateBody);
  if (isParseError(body)) return body;
  if (!emdash?.handleContentUpdate || !emdash?.handleContentGet) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
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
  const editDenied = requireOwnerPerm(user, authorId, "content:edit_own", "content:edit_any");
  if (editDenied) return editDenied;
  if (body.publishedAt !== void 0 && !hasPermission(user, "content:publish_any")) {
    return apiError(
      "FORBIDDEN",
      "Writing publishedAt requires content:publish_any permission",
      403
    );
  }
  const resolvedId = typeof existingItem?.id === "string" ? existingItem.id : id;
  const canChangeAuthor = body.authorId !== void 0 && user && hasPermission(user, "content:edit_any");
  const updateBody = canChangeAuthor ? body : { ...body, authorId: void 0 };
  const result = await emdash.handleContentUpdate(collection, resolvedId, {
    ...updateBody,
    _rev: body._rev
  });
  if (!result.success) return unwrapResult(result);
  if (cache?.enabled) await cache.invalidate({ tags: [collection, resolvedId] });
  return unwrapResult(result);
};
const DELETE = async ({ params, locals, cache }) => {
  const { emdash, user } = locals;
  const collection = params.collection;
  const id = params.id;
  if (!emdash?.handleContentDelete || !emdash?.handleContentGet) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const existing = await emdash.handleContentGet(collection, id);
  if (!existing.success) {
    return apiError(
      existing.error?.code ?? "UNKNOWN_ERROR",
      existing.error?.message ?? "Unknown error",
      mapErrorStatus(existing.error?.code)
    );
  }
  const deleteData = existing.data && typeof existing.data === "object" ? (
    // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- handler returns unknown data; narrowed by typeof check above
    existing.data
  ) : void 0;
  const deleteItem = deleteData?.item && typeof deleteData.item === "object" ? (
    // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- narrowed by typeof check above
    deleteData.item
  ) : deleteData;
  const authorId = typeof deleteItem?.authorId === "string" ? deleteItem.authorId : "";
  const deleteDenied = requireOwnerPerm(user, authorId, "content:delete_own", "content:delete_any");
  if (deleteDenied) return deleteDenied;
  const resolvedId = typeof deleteItem?.id === "string" ? deleteItem.id : id;
  const result = await emdash.handleContentDelete(collection, resolvedId);
  if (!result.success) return unwrapResult(result);
  if (cache?.enabled) await cache.invalidate({ tags: [collection, resolvedId] });
  return unwrapResult(result);
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
