import { M as MediaRepository } from './adapt-sandbox-entry_C2M6Z8Ap.mjs';
import 'better-sqlite3';
import 'kysely';
import 'image-size';
import '@emdash-cms/plugin-types';
import 'mime/lite';
import { r as requirePerm, a as requireOwnerPerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { b as parseOptionalBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { P as mediaConfirmBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
function addUrlToMedia(item) {
  return {
    ...item,
    url: `/_emdash/api/media/file/${item.storageKey}`
  };
}
const POST = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { id } = params;
  const denied = requirePerm(user, "media:upload");
  if (denied) return denied;
  if (!id) {
    return apiError("INVALID_REQUEST", "Media ID is required", 400);
  }
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const body = await parseOptionalBody(request, mediaConfirmBody, {});
    if (isParseError(body)) return body;
    const repo = new MediaRepository(emdash.db);
    const existing = await repo.findById(id);
    if (!existing) {
      return apiError("NOT_FOUND", `Media item not found: ${id}`, 404);
    }
    if (existing.status !== "pending") {
      return apiError("INVALID_STATE", `Media item is not pending: ${existing.status}`, 400);
    }
    const ownerDenied = requireOwnerPerm(
      user,
      existing.authorId ?? "",
      "media:edit_own",
      "media:edit_any"
    );
    if (ownerDenied) return ownerDenied;
    if (emdash.storage) {
      const exists = await emdash.storage.exists(existing.storageKey);
      if (!exists) {
        await repo.markFailed(id);
        return apiError("FILE_NOT_FOUND", "File was not uploaded to storage", 400);
      }
    }
    const item = await repo.confirmUpload(id, {
      size: body.size,
      width: body.width,
      height: body.height
    });
    if (!item) {
      return apiError("CONFIRM_FAILED", "Failed to confirm upload", 500);
    }
    const itemWithUrl = addUrlToMedia(item);
    return apiSuccess({ item: itemWithUrl });
  } catch (error) {
    return handleError(error, "Failed to confirm upload", "CONFIRM_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
