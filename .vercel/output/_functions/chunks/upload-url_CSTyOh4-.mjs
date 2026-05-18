import * as path from 'node:path';
import { M as MediaRepository } from './adapt-sandbox-entry_H5gl0boC.mjs';
import 'better-sqlite3';
import 'kysely';
import { ulid } from 'ulidx';
import 'image-size';
import '@emdash-cms/plugin-types';
import 'mime/lite';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { r as resolveFieldAllowlist, G as GLOBAL_UPLOAD_ALLOWLIST, m as matchesMimeAllowlist, n as normalizeMime } from './media-allowlist_C_sBMk_s.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { N as DEFAULT_MAX_UPLOAD_SIZE, O as mediaUploadUrlBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "media:upload");
  if (denied) return denied;
  if (!emdash?.storage) {
    return apiError(
      "NO_STORAGE",
      "Storage not configured. Signed URL uploads require S3-compatible storage.",
      501
    );
  }
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const maxSize = emdash.config.maxUploadSize ?? DEFAULT_MAX_UPLOAD_SIZE;
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      return apiError(
        "CONFIGURATION_ERROR",
        "Invalid maxUploadSize configuration. Expected a positive finite number.",
        500
      );
    }
    const body = await parseBody(request, mediaUploadUrlBody(maxSize));
    if (isParseError(body)) return body;
    const fieldAllowlist = body.fieldId ? await resolveFieldAllowlist(emdash.db, body.fieldId) : null;
    const allowlist = fieldAllowlist ?? [...GLOBAL_UPLOAD_ALLOWLIST];
    if (!matchesMimeAllowlist(body.contentType, allowlist)) {
      return apiError("INVALID_TYPE", "File type not allowed", 400);
    }
    const repo = new MediaRepository(emdash.db);
    if (body.contentHash) {
      const existing = await repo.findByContentHash(body.contentHash);
      if (existing) {
        const response2 = {
          existing: true,
          mediaId: existing.id,
          storageKey: existing.storageKey,
          url: `/_emdash/api/media/file/${existing.storageKey}`
        };
        return apiSuccess(response2);
      }
    }
    const id = ulid();
    const ext = path.extname(body.filename) || "";
    const storageKey = `${id}${ext}`;
    const mediaItem = await repo.createPending({
      filename: body.filename,
      mimeType: normalizeMime(body.contentType),
      size: body.size,
      storageKey,
      contentHash: body.contentHash,
      authorId: user?.id
    });
    const signedUrl = await emdash.storage.getSignedUploadUrl({
      key: storageKey,
      contentType: body.contentType,
      size: body.size,
      expiresIn: 3600
      // 1 hour
    });
    const response = {
      uploadUrl: signedUrl.url,
      method: signedUrl.method,
      headers: signedUrl.headers,
      mediaId: mediaItem.id,
      storageKey,
      expiresAt: signedUrl.expiresAt
    };
    return apiSuccess(response);
  } catch (error) {
    if (error instanceof Error && "code" in error && // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- narrowing error to check custom code property after "code" in error guard
    error.code === "NOT_SUPPORTED") {
      return apiError(
        "NOT_SUPPORTED",
        "Storage does not support signed upload URLs. Use direct upload.",
        501
      );
    }
    return handleError(error, "Failed to generate upload URL", "UPLOAD_URL_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
