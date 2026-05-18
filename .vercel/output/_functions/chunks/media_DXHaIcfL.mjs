import * as path from 'node:path';
import { M as MediaRepository } from './adapt-sandbox-entry_H5gl0boC.mjs';
import 'better-sqlite3';
import 'kysely';
import { ulid } from 'ulidx';
import 'image-size';
import { c as computeContentHash } from './zod-generator-CHnJUP2l_CRxOShwi.mjs';
import '@emdash-cms/plugin-types';
import mime from 'mime/lite';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { G as wpMediaImportBody } from './redirects_jp1t_nEU.mjs';
import { v as validateExternalUrl, S as SsrfError, s as ssrfSafeFetch } from './ssrf_CAVg0-kk.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "import:execute");
  if (denied) return denied;
  if (!emdash?.storage) {
    return apiError("NO_STORAGE", "Storage not configured. Media import requires storage.", 501);
  }
  if (!emdash?.db) {
    return apiError("NO_DB", "Database not initialized", 500);
  }
  try {
    const body = await parseBody(request, wpMediaImportBody);
    if (isParseError(body)) return body;
    const attachments = body.attachments;
    const shouldStream = body.stream !== false;
    if (shouldStream) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const sendProgress = (progress) => {
            controller.enqueue(encoder.encode(JSON.stringify(progress) + "\n"));
          };
          const result2 = await importMediaWithProgress(
            attachments,
            emdash.db,
            emdash.storage,
            sendProgress
          );
          controller.enqueue(encoder.encode(JSON.stringify({ ...result2, type: "result" }) + "\n"));
          controller.close();
        }
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "private, no-store",
          "Transfer-Encoding": "chunked"
        }
      });
    }
    const result = await importMediaWithProgress(
      attachments,
      emdash.db,
      emdash.storage,
      () => {
      }
      // No-op progress callback
    );
    return apiSuccess(result);
  } catch (error) {
    return handleError(error, "Failed to import media", "IMPORT_ERROR");
  }
};
async function importMediaWithProgress(attachments, db, storage, onProgress) {
  const repo = new MediaRepository(db);
  const total = attachments.length;
  const result = {
    imported: [],
    failed: [],
    urlMap: {}
  };
  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i];
    const current = i + 1;
    const filename = attachment.filename || `file-${attachment.id}`;
    if (!attachment.url) {
      result.failed.push({
        wpId: attachment.id,
        originalUrl: "",
        error: "No URL provided"
      });
      onProgress({
        type: "progress",
        current,
        total,
        filename,
        status: "failed",
        error: "No URL provided"
      });
      continue;
    }
    try {
      try {
        validateExternalUrl(attachment.url);
      } catch (e) {
        const msg = e instanceof SsrfError ? e.message : "Invalid URL";
        result.failed.push({
          wpId: attachment.id,
          originalUrl: attachment.url,
          error: `Blocked: ${msg}`
        });
        onProgress({
          type: "progress",
          current,
          total,
          filename,
          status: "failed",
          error: `Blocked: ${msg}`
        });
        continue;
      }
      onProgress({
        type: "progress",
        current,
        total,
        filename,
        status: "downloading"
      });
      const response = await ssrfSafeFetch(attachment.url, {
        headers: {
          "User-Agent": "EmDash-Importer/1.0"
        }
      });
      if (!response.ok) {
        result.failed.push({
          wpId: attachment.id,
          originalUrl: attachment.url,
          error: `HTTP ${response.status}: ${response.statusText}`
        });
        onProgress({
          type: "progress",
          current,
          total,
          filename,
          status: "failed",
          error: `HTTP ${response.status}`
        });
        continue;
      }
      const contentType = response.headers.get("content-type") || attachment.mimeType || "application/octet-stream";
      const buffer = await response.arrayBuffer();
      const size = buffer.byteLength;
      const contentHash = await computeContentHash(buffer);
      const existing = await repo.findByContentHash(contentHash);
      if (existing) {
        const existingUrl = `/_emdash/api/media/file/${existing.storageKey}`;
        result.urlMap[attachment.url] = existingUrl;
        result.imported.push({
          wpId: attachment.id,
          originalUrl: attachment.url,
          newUrl: existingUrl,
          mediaId: existing.id
        });
        onProgress({
          type: "progress",
          current,
          total,
          filename,
          status: "skipped"
        });
        continue;
      }
      onProgress({
        type: "progress",
        current,
        total,
        filename,
        status: "uploading"
      });
      const id = ulid();
      const ext = attachment.filename ? path.extname(attachment.filename) : getExtensionFromMimeType(contentType);
      const storageKey = `${id}${ext}`;
      await storage.upload({
        key: storageKey,
        body: new Uint8Array(buffer),
        contentType
      });
      const mediaItem = await repo.create({
        filename: attachment.filename || `media-${attachment.id}${ext}`,
        mimeType: contentType,
        size,
        storageKey,
        contentHash,
        width: void 0,
        height: void 0
      });
      const newUrl = `/_emdash/api/media/file/${storageKey}`;
      result.imported.push({
        wpId: attachment.id,
        originalUrl: attachment.url,
        newUrl,
        mediaId: mediaItem.id
      });
      result.urlMap[attachment.url] = newUrl;
      onProgress({
        type: "progress",
        current,
        total,
        filename,
        status: "done"
      });
    } catch (error) {
      console.error(`Media import error for "${filename}":`, error);
      const errorMsg = "Failed to import media";
      result.failed.push({
        wpId: attachment.id,
        originalUrl: attachment.url,
        error: errorMsg
      });
      onProgress({
        type: "progress",
        current,
        total,
        filename,
        status: "failed",
        error: errorMsg
      });
    }
  }
  return result;
}
function getExtensionFromMimeType(mimeType) {
  const ext = mime.getExtension(mimeType);
  return ext ? `.${ext}` : "";
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
