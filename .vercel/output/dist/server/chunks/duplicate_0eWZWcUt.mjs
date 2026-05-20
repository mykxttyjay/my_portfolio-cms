import { r as requirePerm, a as requireOwnerPerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, m as mapErrorStatus, u as unwrapResult } from './error_Da04EfM-.mjs';

const prerender = false;
const POST = async ({ params, locals, cache }) => {
  const { emdash, user } = locals;
  const collection = params.collection;
  const id = params.id;
  const denied = requirePerm(user, "content:create");
  if (denied) return denied;
  if (!emdash?.handleContentDuplicate || !emdash?.handleContentGet) {
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
  const readDenied = requireOwnerPerm(user, authorId, "content:edit_own", "content:edit_any");
  if (readDenied) return readDenied;
  const resolvedId = typeof existingItem?.id === "string" ? existingItem.id : id;
  const result = await emdash.handleContentDuplicate(collection, resolvedId, user?.id);
  if (!result.success) return unwrapResult(result);
  if (cache?.enabled) await cache.invalidate({ tags: [collection] });
  return unwrapResult(result, 201);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
