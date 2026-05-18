import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { b as parseOptionalBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { y as contentPreviewUrlBody } from './redirects_jp1t_nEU.mjs';
import { r as resolveSecretsCached } from './secrets_DDNzJf5c.mjs';
import { a as encodeBase64url } from './base64_CEvRaSBc.mjs';

const DURATION_PATTERN$1 = /^(\d+)([smhdw])$/;
function parseDuration(duration) {
  if (typeof duration === "number") {
    return duration;
  }
  const match = duration.match(DURATION_PATTERN$1);
  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}". Use "1h", "30m", "1d", "2w", or seconds.`
    );
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    case "w":
      return value * 60 * 60 * 24 * 7;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}
async function createSignature(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(signature);
}
async function generatePreviewToken(options) {
  const { contentId, expiresIn = "1h", secret } = options;
  if (!secret) {
    throw new Error("Preview secret is required");
  }
  if (!contentId || !contentId.includes(":")) {
    throw new Error('Content ID must be in format "collection:id"');
  }
  const now = Math.floor(Date.now() / 1e3);
  const duration = parseDuration(expiresIn);
  const payload = {
    cid: contentId,
    exp: now + duration,
    iat: now
  };
  const payloadJson = JSON.stringify(payload);
  const encodedPayload = encodeBase64url(new TextEncoder().encode(payloadJson));
  const signature = await createSignature(encodedPayload, secret);
  const encodedSignature = encodeBase64url(signature);
  return `${encodedPayload}.${encodedSignature}`;
}

const REPEATED_SLASHES = /\/{2,}/g;
async function getPreviewUrl(options) {
  const {
    collection,
    id,
    secret,
    expiresIn = "1h",
    baseUrl,
    pathPattern = "/{collection}/{id}",
    locale = ""
  } = options;
  const token = await generatePreviewToken({
    contentId: `${collection}:${id}`,
    expiresIn,
    secret
  });
  let path = pathPattern.replace("{collection}", collection).replace("{id}", id).replace("{locale}", locale);
  path = path.replace(REPEATED_SLASHES, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const url = new URL(path, baseUrl || "http://placeholder");
  url.searchParams.set("_preview", token);
  if (!baseUrl) {
    return `${url.pathname}${url.search}`;
  }
  return url.toString();
}

const prerender = false;
const DURATION_PATTERN = /^(\d+)([smhdw])$/;
const POST = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "content:read_drafts");
  if (denied) return denied;
  const collection = params.collection;
  const id = params.id;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const { previewSecret } = await resolveSecretsCached(emdash.db);
  let entryLocale = null;
  if (emdash?.handleContentGet) {
    const result = await emdash.handleContentGet(collection, id);
    if (!result.success) return unwrapResult(result);
    entryLocale = result.data?.item?.locale ?? null;
  }
  const body = await parseOptionalBody(request, contentPreviewUrlBody, {});
  if (isParseError(body)) return body;
  const expiresIn = body.expiresIn || "1h";
  const defaultPathPattern = "/{collection}/{id}";
  const pathPattern = body.pathPattern || defaultPathPattern;
  let localeSegment = "";
  if (entryLocale) {
    localeSegment = entryLocale;
  }
  const expiresInSeconds = typeof expiresIn === "number" ? expiresIn : parseExpiresIn(expiresIn);
  const expiresAt = Math.floor(Date.now() / 1e3) + expiresInSeconds;
  try {
    const url = await getPreviewUrl({
      collection,
      id,
      secret: previewSecret,
      expiresIn,
      pathPattern,
      locale: localeSegment
    });
    return apiSuccess({ url, expiresAt });
  } catch (error) {
    return handleError(error, "Failed to generate preview URL", "TOKEN_ERROR");
  }
};
function parseExpiresIn(duration) {
  const match = duration.match(DURATION_PATTERN);
  if (!match) {
    return 3600;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    case "w":
      return value * 60 * 60 * 24 * 7;
    default:
      return 3600;
  }
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
