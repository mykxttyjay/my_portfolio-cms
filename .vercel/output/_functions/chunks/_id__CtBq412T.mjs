import { r as requirePerm, a as requireOwnerPerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { Q as mediaUpdateBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const { id } = params;
  const readDenied = requirePerm(user, "media:read");
  if (readDenied) return readDenied;
  if (!id) {
    return apiError("INVALID_REQUEST", "Media ID required", 400);
  }
  if (!emdash?.handleMediaGet) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const result = await emdash.handleMediaGet(id);
  return unwrapResult(result);
};
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { id } = params;
  const editDenied = requirePerm(user, "media:edit_own");
  if (editDenied) return editDenied;
  if (!id) {
    return apiError("INVALID_REQUEST", "Media ID required", 400);
  }
  if (!emdash?.handleMediaGet || !emdash?.handleMediaUpdate) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const getResult = await emdash.handleMediaGet(id);
    if (!getResult.success || !getResult.data?.item) {
      return apiError("NOT_FOUND", "Media item not found", 404);
    }
    const media = getResult.data.item;
    const ownerDenied = requireOwnerPerm(user, media.authorId, "media:edit_own", "media:edit_any");
    if (ownerDenied) return ownerDenied;
    const body = await parseBody(request, mediaUpdateBody);
    if (isParseError(body)) return body;
    const result = await emdash.handleMediaUpdate(id, {
      alt: body.alt,
      caption: body.caption,
      width: body.width,
      height: body.height
    });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to update media", "MEDIA_UPDATE_ERROR");
  }
};
const DELETE = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const { id } = params;
  const deleteDenied = requirePerm(user, "media:delete_own");
  if (deleteDenied) return deleteDenied;
  if (!id) {
    return apiError("INVALID_REQUEST", "Media ID required", 400);
  }
  if (!emdash?.handleMediaGet || !emdash?.handleMediaDelete) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const getResult = await emdash.handleMediaGet(id);
    if (!getResult.success || !getResult.data?.item) {
      return apiError("NOT_FOUND", "Media item not found", 404);
    }
    const media = getResult.data.item;
    const ownerDenied = requireOwnerPerm(
      user,
      media.authorId,
      "media:delete_own",
      "media:delete_any"
    );
    if (ownerDenied) return ownerDenied;
    if (emdash.storage) {
      try {
        await emdash.storage.delete(media.storageKey);
      } catch {
      }
    }
    const result = await emdash.handleMediaDelete(id);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to delete media", "MEDIA_DELETE_ERROR");
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
