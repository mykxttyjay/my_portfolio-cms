import { d as defineMiddleware, ae as sequence } from './chunks/params-and-props_DwyEVPUa.mjs';
import { d as decodeBase64url, O as OptionsRepository, e as encodeBase64url, M as MediaRepository, i as invalidateSiteSettingsCache, c as createNoopSandboxRunner, a as createRequestMetrics, r as runWithContext, g as getRequestContext, s as setI18nConfig, S as SchemaRegistry, b as createHookPipeline, f as definePlugin, E as EmailPipeline, h as runMigrations, P as PluginStateRepository, l as loadBundleFromR2, n as normalizeManifestRoute, j as resolveExclusiveHooks, k as requestCached, m as isSqlite, F as FTSManager, o as handleContentList, p as handleContentGet, q as handleContentGetIncludingTrashed, R as RevisionRepository, t as handleContentCreate, v as validateRev, u as validateIdentifier, w as handleContentUpdate, x as handleContentDelete, y as handleContentListTrashed, z as handleContentRestore, A as handleContentPermanentDelete, B as handleContentCountTrashed, C as handleContentDuplicate, D as handleContentPublish, G as handleContentUnpublish, H as handleContentSchedule, I as handleContentUnschedule, J as handleContentCountScheduled, K as handleContentDiscardDraft, L as handleContentCompare, N as handleContentTranslations, Q as handleMediaList, T as handleMediaGet, U as handleMediaCreate, V as handleMediaUpdate, W as handleMediaDelete, X as handleRevisionList, Y as handleRevisionGet, Z as handleRevisionRestore, _ as PluginRouteRegistry, $ as getTrustedProxyHeaders, a0 as after, a1 as sanitizeHeadersForSandbox, a2 as extractRequestMeta, a3 as CronExecutor, a4 as RedirectRepository, a5 as getCachedRedirects, a6 as setCachedRedirects, a7 as matchCachedPatterns } from './chunks/adapt-sandbox-entry_C2M6Z8Ap.mjs';
import { i as isInstrumentationEnabled, c as createRecorder, f as flushRecorder, g as getDb, k as kyselyLogOption } from './chunks/loader-ou_PXAjg_C6kEC2mY.mjs';
import 'better-sqlite3';
import { Kysely, sql } from 'kysely';
import 'image-size';
import { h as hashString } from './chunks/zod-generator-CHnJUP2l_CRxOShwi.mjs';
import '@emdash-cms/plugin-types';
import { a as invalidateUrlPatternCache } from './chunks/query-yA3-rFji_DDWmMCXT.mjs';
import mime from 'mime/lite';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeHexLowerCase } from '@oslojs/encoding';
import 'piccolore';
import 'clsx';
import virtualConfig from './chunks/config_Bn36CnMO.mjs';
import { createRequestScopedDb, createDialect } from './chunks/dialect_5VqW4Yvc.mjs';
import * as path from 'node:path';
import { existsSync, createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createKyselyAdapter } from './chunks/kysely_B71kB-eV.mjs';
import { ulid } from 'ulidx';
import './chunks/index_Bxms_uoh.mjs';
import { h as hasScope, a as hashPrefixedToken } from './chunks/authenticate-BiDGbUVY_CNGQ9xrZ.mjs';

async function verifySignature(data, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, ["verify"]);
  const sigBuffer = new ArrayBuffer(signature.byteLength);
  new Uint8Array(sigBuffer).set(signature);
  return crypto.subtle.verify("HMAC", key, sigBuffer, encoder.encode(data));
}
async function verifyPreviewToken(options) {
  const { secret } = options;
  if (!secret) throw new Error("Preview secret is required");
  const token = "url" in options ? options.url.searchParams.get("_preview") : options.token;
  if (!token) return {
    valid: false,
    error: "none"
  };
  const parts = token.split(".");
  if (parts.length !== 2) return {
    valid: false,
    error: "malformed"
  };
  const [encodedPayload, encodedSignature] = parts;
  let signature;
  try {
    signature = decodeBase64url(encodedSignature);
  } catch {
    return {
      valid: false,
      error: "malformed"
    };
  }
  if (!await verifySignature(encodedPayload, signature, secret)) return {
    valid: false,
    error: "invalid"
  };
  let payload;
  try {
    const payloadBytes = decodeBase64url(encodedPayload);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    payload = JSON.parse(payloadJson);
  } catch {
    return {
      valid: false,
      error: "malformed"
    };
  }
  if (typeof payload.cid !== "string" || typeof payload.exp !== "number" || typeof payload.iat !== "number") return {
    valid: false,
    error: "malformed"
  };
  const now = Math.floor(Date.now() / 1e3);
  if (payload.exp < now) return {
    valid: false,
    error: "expired"
  };
  return {
    valid: true,
    payload
  };
}
function parseContentId(contentId) {
  const colonIndex = contentId.indexOf(":");
  if (colonIndex === -1) throw new Error('Content ID must be in format "collection:id"');
  return {
    collection: contentId.slice(0, colonIndex),
    id: contentId.slice(colonIndex + 1)
  };
}

//#region src/media/normalize.ts
const INTERNAL_MEDIA_PREFIX = "/_emdash/api/media/file/";
const URL_PATTERN = /^https?:\/\//;
/**
* Normalize a media field value into a consistent MediaValue shape.
*
* - `null`/`undefined` → `null`
* - Bare URL string → `{ provider: "external", id: "", src: url }`
* - Bare internal media URL → resolved via local provider's `get()`
* - Object with `provider` + `id` → enriched with missing fields from provider
*/
async function normalizeMediaValue(value, getProvider) {
	if (value == null) return null;
	if (typeof value === "string") return normalizeStringUrl(value, getProvider);
	if (!isRecord(value)) return null;
	if (!("id" in value) && !("src" in value)) return null;
	const provider = (typeof value.provider === "string" ? value.provider : void 0) || "local";
	const id = typeof value.id === "string" ? value.id : "";
	if (provider === "external") return recordToMediaValue(value);
	const result = {
		...recordToMediaValue(value),
		provider
	};
	if (provider === "local") delete result.src;
	const needsDimensions = result.width == null || result.height == null;
	const needsStorageKey = provider === "local" && !result.meta?.storageKey;
	const needsFileInfo = !result.mimeType || !result.filename;
	if (!(needsDimensions || needsStorageKey || needsFileInfo) || !id) return result;
	const mediaProvider = getProvider(provider);
	if (!mediaProvider?.get) return result;
	let providerItem;
	try {
		providerItem = await mediaProvider.get(id);
	} catch {
		return result;
	}
	if (!providerItem) return result;
	return mergeProviderData(result, providerItem);
}
function normalizeStringUrl(url, getProvider) {
	if (url.startsWith(INTERNAL_MEDIA_PREFIX)) return resolveInternalUrl(url, getProvider);
	if (URL_PATTERN.test(url)) return Promise.resolve({
		provider: "external",
		id: "",
		src: url
	});
	return Promise.resolve({
		provider: "external",
		id: "",
		src: url
	});
}
async function resolveInternalUrl(url, getProvider) {
	const storageKey = url.slice(24);
	const localProvider = getProvider("local");
	if (!localProvider?.get) return {
		provider: "external",
		id: "",
		src: url
	};
	let item;
	try {
		item = await localProvider.get(storageKey);
	} catch {
		return {
			provider: "external",
			id: "",
			src: url
		};
	}
	if (!item) return {
		provider: "external",
		id: "",
		src: url
	};
	return {
		provider: "local",
		id: item.id,
		filename: item.filename,
		mimeType: item.mimeType,
		width: item.width,
		height: item.height,
		alt: item.alt,
		meta: item.meta
	};
}
/**
* Merge provider data into an existing MediaValue, preserving caller-supplied fields.
* Caller `alt` takes priority over provider `alt` (per-usage, not per-image).
*/
function mergeProviderData(existing, item) {
	const result = { ...existing };
	if (result.width == null && item.width != null) result.width = item.width;
	if (result.height == null && item.height != null) result.height = item.height;
	if (!result.filename && item.filename) result.filename = item.filename;
	if (!result.mimeType && item.mimeType) result.mimeType = item.mimeType;
	if (!result.alt && item.alt) result.alt = item.alt;
	if (item.meta) result.meta = {
		...item.meta,
		...result.meta
	};
	return result;
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Extract known MediaValue fields from a runtime-checked record.
* Avoids unsafe `as MediaValue` cast by reading each property explicitly.
*/
function recordToMediaValue(obj) {
	const result = { id: typeof obj.id === "string" ? obj.id : "" };
	if (typeof obj.provider === "string") result.provider = obj.provider;
	if (typeof obj.src === "string") result.src = obj.src;
	if (typeof obj.previewUrl === "string") result.previewUrl = obj.previewUrl;
	if (typeof obj.filename === "string") result.filename = obj.filename;
	if (typeof obj.mimeType === "string") result.mimeType = obj.mimeType;
	if (typeof obj.width === "number") result.width = obj.width;
	if (typeof obj.height === "number") result.height = obj.height;
	if (typeof obj.alt === "string") result.alt = obj.alt;
	if (isRecord(obj.meta)) result.meta = obj.meta;
	return result;
}

//#region src/api/error.ts
/**
* Standard cache headers for all API responses.
*
* Cache-Control: private, no-store -- prevents CDN/proxy caching of authenticated data.
* no-store already tells caches not to store the response, so Vary is unnecessary.
*/
const API_CACHE_HEADERS = { "Cache-Control": "private, no-store" };
/**
* Create a standardized error response.
*
* Always returns `{ error: { code, message } }` with correct Content-Type.
* Use this for all error responses in API routes.
*/
function apiError(code, message, status) {
	return Response.json({ error: {
		code,
		message
	} }, {
		status,
		headers: API_CACHE_HEADERS
	});
}

//#region src/storage/types.ts
/**
* Storage error with additional context
*/
var EmDashStorageError = class extends Error {
	constructor(message, code, cause) {
		super(message);
		this.code = code;
		this.cause = cause;
		this.name = "EmDashStorageError";
	}
};

//#region src/version.ts
const VERSION = "0.12.0";
const COMMIT = "29eeee7";

//#region src/auth/mode.ts
/**
* Determine the active auth mode from config.
*
* Accepts `EmDashConfig` (or subtype) — checks for `auth` field via duck typing.
*
* @param config EmDash configuration
* @returns The active auth mode
*/
function getAuthMode(config) {
	const auth = config?.auth;
	if (auth && "entrypoint" in auth && auth.entrypoint) return {
		type: "external",
		providerType: auth.type,
		entrypoint: auth.entrypoint,
		config: auth.config
	};
	return { type: "passkey" };
}

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": undefined, "SSR": true};
const ENCRYPTION_KEY_PREFIX = "emdash_enc_v1_";
const ENCRYPTION_KEY_BODY_LENGTH = 43;
const ENCRYPTION_KEY_PATTERN = new RegExp(`^${ENCRYPTION_KEY_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[A-Za-z0-9_-]{${ENCRYPTION_KEY_BODY_LENGTH}}$`);
const IP_SALT_OPTION_KEY = "emdash:ip_salt";
const PREVIEW_SECRET_OPTION_KEY = "emdash:preview_secret";
const GENERATED_SECRET_BYTES = 32;
var EmDashSecretsError = class extends Error {
  name = "EmDashSecretsError";
  code;
  constructor(message, code) {
    super(message);
    this.code = code;
  }
};
async function parseEncryptionKeys(raw) {
  if (!raw) return null;
  const entries = raw.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  if (entries.length === 0) return null;
  const parsed = [];
  const seenKids = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (!ENCRYPTION_KEY_PATTERN.test(entry)) throw new EmDashSecretsError(`EMDASH_ENCRYPTION_KEY entry is malformed (expected "${ENCRYPTION_KEY_PREFIX}" followed by ${ENCRYPTION_KEY_BODY_LENGTH} base64url chars). Generate one with \`emdash secrets generate\`.`, "INVALID_ENCRYPTION_KEY");
    const body = entry.slice(14);
    const key = decodeBase64urlStrict(body);
    if (!key) throw new EmDashSecretsError("EMDASH_ENCRYPTION_KEY body is not valid base64url", "INVALID_ENCRYPTION_KEY");
    if (key.length !== GENERATED_SECRET_BYTES) throw new EmDashSecretsError(`EMDASH_ENCRYPTION_KEY must decode to ${GENERATED_SECRET_BYTES} bytes, got ${key.length}`, "INVALID_ENCRYPTION_KEY");
    if (encodeBase64url(key) !== body) throw new EmDashSecretsError("EMDASH_ENCRYPTION_KEY body is not canonical base64url. Generate one with `emdash secrets generate`.", "INVALID_ENCRYPTION_KEY");
    const kid = fingerprintKeyBytes(key);
    if (seenKids.has(kid)) continue;
    seenKids.add(kid);
    parsed.push({
      kid,
      key,
      raw: entry
    });
  }
  return parsed;
}
function fingerprintKeyBytes(key) {
  return encodeHexLowerCase(sha256(key)).slice(0, 8);
}
async function resolveSecrets(options) {
  const env = options.env ?? readDefaultEnv();
  const repo = options._repo ?? new OptionsRepository(options.db);
  const previewEnvOverride = pickFirstNonEmpty(env.EMDASH_PREVIEW_SECRET, env.PREVIEW_SECRET);
  const ipSaltEnvOverride = pickFirstNonEmpty(env.EMDASH_IP_SALT, env.EMDASH_AUTH_SECRET, env.AUTH_SECRET);
  const [previewSecret, ipSalt] = await Promise.all([previewEnvOverride !== null ? Promise.resolve({
    value: previewEnvOverride,
    source: "env"
  }) : ensureGeneratedOption(repo, PREVIEW_SECRET_OPTION_KEY), ipSaltEnvOverride !== null ? Promise.resolve({
    value: ipSaltEnvOverride,
    source: "env"
  }) : ensureGeneratedOption(repo, IP_SALT_OPTION_KEY)]);
  return {
    previewSecret: previewSecret.value,
    previewSecretSource: previewSecret.source,
    ipSalt: ipSalt.value,
    ipSaltSource: ipSalt.source
  };
}
async function validateEncryptionKeyAtStartup(env) {
  const resolved = readDefaultEnv();
  try {
    await parseEncryptionKeys(resolved.EMDASH_ENCRYPTION_KEY);
    return true;
  } catch (error) {
    if (error instanceof EmDashSecretsError) {
      console.error(`[emdash] EMDASH_ENCRYPTION_KEY is invalid: ${error.message} Plugin-secret encryption will fail once it ships. Generate a fresh key with \`emdash secrets generate\`.`);
      return false;
    }
    throw error;
  }
}
const SECRETS_CACHE_KEY = /* @__PURE__ */ Symbol.for("@emdash-cms/core/secrets-cache@1");
function getSecretsCache() {
  const holder = globalThis;
  let entry = holder[SECRETS_CACHE_KEY];
  if (!entry) {
    entry = { cache: /* @__PURE__ */ new WeakMap() };
    holder[SECRETS_CACHE_KEY] = entry;
  }
  return entry.cache;
}
function resolveSecretsCached(db) {
  const cache = getSecretsCache();
  const cached = cache.get(db);
  if (cached) return cached;
  const promise = resolveSecrets({ db }).catch((error) => {
    cache.delete(db);
    throw error;
  });
  cache.set(db, promise);
  return promise;
}
async function ensureGeneratedOption(repo, optionKey) {
  const existing = await repo.get(optionKey);
  if (typeof existing === "string" && existing.length > 0) return {
    value: existing,
    source: "db"
  };
  const generated = generateRandomSecret();
  if (await repo.setIfAbsent(optionKey, generated)) return {
    value: generated,
    source: "db"
  };
  const winner = await repo.get(optionKey);
  if (typeof winner !== "string" || winner.length === 0) throw new EmDashSecretsError(`Failed to persist generated secret for "${optionKey}"`, "SECRET_PERSIST_FAILED");
  return {
    value: winner,
    source: "db"
  };
}
function generateRandomSecret() {
  const bytes = new Uint8Array(GENERATED_SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return encodeBase64url(bytes);
}
function pickFirstNonEmpty(...values) {
  for (const value of values) if (typeof value === "string" && value.length > 0) return value;
  return null;
}
const BASE64URL_CHARSET_PATTERN = /^[A-Za-z0-9_-]+$/;
function decodeBase64urlStrict(input) {
  if (!BASE64URL_CHARSET_PATTERN.test(input)) return null;
  try {
    return decodeBase64url(input);
  } catch {
    return null;
  }
}
function readDefaultEnv() {
  const meta = Object.assign(__vite_import_meta_env__, {}) ?? {};
  const proc = typeof process !== "undefined" && process.env ? process.env : {};
  return {
    EMDASH_ENCRYPTION_KEY: meta.EMDASH_ENCRYPTION_KEY ?? proc.EMDASH_ENCRYPTION_KEY,
    EMDASH_PREVIEW_SECRET: meta.EMDASH_PREVIEW_SECRET ?? proc.EMDASH_PREVIEW_SECRET,
    PREVIEW_SECRET: meta.PREVIEW_SECRET ?? proc.PREVIEW_SECRET,
    EMDASH_IP_SALT: meta.EMDASH_IP_SALT ?? proc.EMDASH_IP_SALT,
    EMDASH_AUTH_SECRET: meta.EMDASH_AUTH_SECRET ?? proc.EMDASH_AUTH_SECRET,
    AUTH_SECRET: meta.AUTH_SECRET ?? proc.AUTH_SECRET
  };
}

//#region src/media/local-runtime.ts
/**
* Create the local media provider
*/
const createMediaProvider = (config) => {
	const { db, storage } = config;
	if (!db) throw new Error("Local media provider requires database connection");
	const repo = new MediaRepository(db);
	return {
		async list(options) {
			const result = await repo.findMany({
				cursor: options.cursor,
				limit: options.limit,
				mimeType: options.mimeType
			});
			return {
				items: result.items.map((item) => ({
					id: item.id,
					filename: item.filename,
					mimeType: item.mimeType,
					size: item.size ?? void 0,
					width: item.width ?? void 0,
					height: item.height ?? void 0,
					alt: item.alt ?? void 0,
					previewUrl: `/_emdash/api/media/file/${item.storageKey}`,
					meta: {
						storageKey: item.storageKey,
						caption: item.caption,
						blurhash: item.blurhash,
						dominantColor: item.dominantColor
					}
				})),
				nextCursor: result.nextCursor
			};
		},
		async get(id) {
			const item = await repo.findById(id);
			if (!item) return null;
			return {
				id: item.id,
				filename: item.filename,
				mimeType: item.mimeType,
				size: item.size ?? void 0,
				width: item.width ?? void 0,
				height: item.height ?? void 0,
				alt: item.alt ?? void 0,
				previewUrl: `/_emdash/api/media/file/${item.storageKey}`,
				meta: {
					storageKey: item.storageKey,
					caption: item.caption,
					blurhash: item.blurhash,
					dominantColor: item.dominantColor
				}
			};
		},
		async upload(_input) {
			if (!storage) throw new Error("Storage not configured for local media provider");
			throw new Error("Local upload should use /_emdash/api/media endpoint");
		},
		async delete(id) {
			const item = await repo.findById(id);
			if (!item) return;
			if (storage) try {
				await storage.delete(item.storageKey);
			} catch {}
			await repo.delete(id);
			invalidateSiteSettingsCache();
		},
		getEmbed(value, _options) {
			const src = `/_emdash/api/media/file/${typeof value.meta?.storageKey === "string" ? value.meta.storageKey : value.id}`;
			const mimeType = value.mimeType || "";
			if (mimeType.startsWith("image/")) return {
				type: "image",
				src,
				width: value.width,
				height: value.height,
				alt: value.alt
			};
			if (mimeType.startsWith("video/")) return {
				type: "video",
				src,
				width: value.width,
				height: value.height,
				controls: true,
				preload: "metadata"
			};
			if (mimeType.startsWith("audio/")) return {
				type: "audio",
				src,
				controls: true,
				preload: "metadata"
			};
			return {
				type: "image",
				src,
				width: value.width,
				height: value.height,
				alt: value.alt
			};
		},
		getThumbnailUrl(id, _mimeType) {
			return `/_emdash/api/media/file/${id}`;
		}
	};
};

/** Media provider descriptors with factory functions */
const mediaProviders = [
  {
	id: "local",
	name: "Library",
	icon: "folder",
	capabilities: { browse: true, search: false, upload: true, delete: true },
	createProvider: (ctx) => createMediaProvider({ ...ctx}),
}
];

const plugins = [];

const createSandboxRunner = createNoopSandboxRunner;
const sandboxEnabled = false;

// No sandboxed plugins configured
const sandboxedPlugins = [];

//#region src/storage/local.ts
/**
* Local Filesystem Storage Implementation
*
* For development and testing. Stores files in a local directory.
*/
/** Type guard for Node.js ErrnoException */
function isNodeError(error) {
	return error instanceof Error && "code" in error;
}
/** Pattern to remove leading slashes */
const LEADING_SLASH_PATTERN$1 = /^\//;
/** Pattern to remove trailing slashes */
const TRAILING_SLASH_PATTERN = /\/$/;
/**
* Local filesystem storage implementation
*/
var LocalStorage = class {
	/** Resolved absolute base directory for all stored files */
	directory;
	baseUrl;
	constructor(config) {
		this.directory = path.resolve(config.directory);
		this.baseUrl = config.baseUrl.replace(TRAILING_SLASH_PATTERN, "");
	}
	/**
	* Resolve a storage key to an absolute file path, ensuring it stays
	* within the configured storage directory. Uses path.resolve() for
	* canonical resolution rather than regex stripping.
	*
	* @throws EmDashStorageError if the resolved path escapes the base directory
	*/
	getFilePath(key) {
		const normalizedKey = key.replace(LEADING_SLASH_PATTERN$1, "");
		const resolved = path.resolve(this.directory, normalizedKey);
		if (!resolved.startsWith(this.directory + path.sep) && resolved !== this.directory) throw new EmDashStorageError("Invalid file path", "INVALID_PATH");
		return resolved;
	}
	async upload(options) {
		try {
			const filePath = this.getFilePath(options.key);
			const dir = path.dirname(filePath);
			await fs.mkdir(dir, { recursive: true });
			let buffer;
			if (options.body instanceof ReadableStream) {
				const chunks = [];
				const reader = options.body.getReader();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					chunks.push(value);
				}
				buffer = Buffer.concat(chunks);
			} else if (options.body instanceof Uint8Array) buffer = Buffer.from(options.body);
			else buffer = options.body;
			await fs.writeFile(filePath, buffer);
			return {
				key: options.key,
				url: this.getPublicUrl(options.key),
				size: buffer.length
			};
		} catch (error) {
			throw new EmDashStorageError(`Failed to upload file: ${options.key}`, "UPLOAD_FAILED", error);
		}
	}
	async download(key) {
		try {
			const filePath = this.getFilePath(key);
			if (!existsSync(filePath)) throw new EmDashStorageError(`File not found: ${key}`, "NOT_FOUND");
			const stat = await fs.stat(filePath);
			const nodeStream = createReadStream(filePath);
			return {
				body: Readable.toWeb(nodeStream),
				contentType: getContentType(path.extname(key).toLowerCase()),
				size: stat.size
			};
		} catch (error) {
			if (error instanceof EmDashStorageError) throw error;
			throw new EmDashStorageError(`Failed to download file: ${key}`, "DOWNLOAD_FAILED", error);
		}
	}
	async delete(key) {
		try {
			const filePath = this.getFilePath(key);
			await fs.unlink(filePath);
		} catch (error) {
			if (!isNodeError(error) || error.code !== "ENOENT") throw new EmDashStorageError(`Failed to delete file: ${key}`, "DELETE_FAILED", error);
		}
	}
	async exists(key) {
		try {
			const filePath = this.getFilePath(key);
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}
	async list(options = {}) {
		try {
			const prefix = options.prefix || "";
			const searchDir = path.resolve(this.directory, path.dirname(prefix));
			if (!searchDir.startsWith(this.directory + path.sep) && searchDir !== this.directory) throw new EmDashStorageError("Invalid list prefix", "INVALID_PATH");
			const prefixBase = path.basename(prefix);
			try {
				await fs.access(searchDir);
			} catch {
				return { files: [] };
			}
			const entries = await fs.readdir(searchDir, { withFileTypes: true });
			const files = [];
			for (const entry of entries) if (entry.isFile() && entry.name.startsWith(prefixBase)) {
				const key = path.join(path.dirname(prefix), entry.name);
				const filePath = path.join(searchDir, entry.name);
				const stat = await fs.stat(filePath);
				files.push({
					key,
					size: stat.size,
					lastModified: stat.mtime
				});
			}
			files.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
			const startIndex = options.cursor ? parseInt(options.cursor, 10) : 0;
			const limit = options.limit || 1e3;
			return {
				files: files.slice(startIndex, startIndex + limit),
				nextCursor: startIndex + limit < files.length ? String(startIndex + limit) : void 0
			};
		} catch (error) {
			throw new EmDashStorageError("Failed to list files", "LIST_FAILED", error);
		}
	}
	async getSignedUploadUrl(_options) {
		throw new EmDashStorageError("Local storage does not support signed upload URLs. Upload files directly through the API.", "NOT_SUPPORTED");
	}
	getPublicUrl(key) {
		return `${this.baseUrl}/${key}`;
	}
};
/**
* Get content type from file extension
*/
function getContentType(ext) {
	return mime.getType(ext) ?? "application/octet-stream";
}
/**
* Create local storage adapter
* This is the factory function called at runtime
*/
function createStorage$1(config) {
	return new LocalStorage({
		directory: typeof config.directory === "string" ? config.directory : "",
		baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : ""
	});
}

const createStorage = createStorage$1;

async function cleanupExpiredChallenges(db) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await db.deleteFrom("auth_challenges").where("expires_at", "<", now).executeTakeFirst();
  return Number(result.numDeletedRows ?? 0);
}
const REVISION_KEEP_COUNT = 50;
const REVISION_PRUNE_THRESHOLD = REVISION_KEEP_COUNT;
async function runSystemCleanup(db, storage) {
  const result = {
    challenges: -1,
    expiredTokens: -1,
    pendingUploads: -1,
    pendingUploadFiles: -1,
    revisionsPruned: -1
  };
  try {
    result.challenges = await cleanupExpiredChallenges(db);
  } catch (error) {
    console.error("[cleanup] Failed to clean expired challenges:", error);
  }
  try {
    await createKyselyAdapter(db).deleteExpiredTokens();
    result.expiredTokens = 0;
  } catch (error) {
    console.error("[cleanup] Failed to clean expired tokens:", error);
  }
  try {
    const orphanedKeys = await new MediaRepository(db).cleanupPendingUploads();
    result.pendingUploads = orphanedKeys.length;
    if (storage && orphanedKeys.length > 0) {
      let filesDeleted = 0;
      for (const key of orphanedKeys) try {
        await storage.delete(key);
        filesDeleted++;
      } catch (error) {
        console.error(`[cleanup] Failed to delete storage file ${key}:`, error);
      }
      result.pendingUploadFiles = filesDeleted;
    } else result.pendingUploadFiles = 0;
  } catch (error) {
    console.error("[cleanup] Failed to clean pending uploads:", error);
  }
  try {
    result.revisionsPruned = await pruneExcessiveRevisions(db);
  } catch (error) {
    console.error("[cleanup] Failed to prune revisions:", error);
  }
  return result;
}
async function pruneExcessiveRevisions(db) {
  const entries = await sql`
		SELECT collection, entry_id
		FROM revisions
		GROUP BY collection, entry_id
		HAVING COUNT(*) > ${REVISION_PRUNE_THRESHOLD}
	`.execute(db);
  if (entries.rows.length === 0) return 0;
  const revisionRepo = new RevisionRepository(db);
  let totalPruned = 0;
  for (const row of entries.rows) try {
    const pruned = await revisionRepo.pruneOldRevisions(row.collection, row.entry_id, REVISION_KEEP_COUNT);
    totalPruned += pruned;
  } catch (error) {
    console.error(`[cleanup] Failed to prune revisions for ${row.collection}/${row.entry_id}:`, error);
  }
  return totalPruned;
}
const DEFAULT_COMMENT_MODERATOR_PLUGIN_ID = "emdash-default-comment-moderator";
async function defaultCommentModerate(event, _ctx) {
  const { comment, collectionSettings, priorApprovedCount } = event;
  if (collectionSettings.commentsAutoApproveUsers && comment.authorUserId) return {
    status: "approved",
    reason: "Authenticated CMS user"
  };
  if (collectionSettings.commentsModeration === "none") return {
    status: "approved",
    reason: "Moderation disabled"
  };
  if (collectionSettings.commentsModeration === "first_time" && priorApprovedCount > 0) return {
    status: "approved",
    reason: "Returning commenter"
  };
  return {
    status: "pending",
    reason: "Held for review"
  };
}
const MIN_INTERVAL_MS = 1e3;
const MAX_INTERVAL_MS = 300 * 1e3;
var NodeCronScheduler = class {
  timer = null;
  running = false;
  systemCleanup = null;
  constructor(executor) {
    this.executor = executor;
  }
  setSystemCleanup(fn) {
    this.systemCleanup = fn;
  }
  start() {
    this.running = true;
    this.arm();
  }
  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  reschedule() {
    if (!this.running) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.arm();
  }
  arm() {
    if (!this.running) return;
    this.executor.getNextDueTime().then((nextDue) => {
      if (!this.running) return void 0;
      let delayMs;
      if (nextDue) {
        const dueAt = new Date(nextDue).getTime();
        delayMs = Math.max(dueAt - Date.now(), MIN_INTERVAL_MS);
        delayMs = Math.min(delayMs, MAX_INTERVAL_MS);
      } else delayMs = MAX_INTERVAL_MS;
      this.timer = setTimeout(() => {
        if (!this.running) return;
        this.executeTick();
      }, delayMs);
      if (this.timer && typeof this.timer === "object" && "unref" in this.timer) this.timer.unref();
    }).catch((error) => {
      console.error("[cron:node] Failed to get next due time:", error);
      if (this.running) {
        this.timer = setTimeout(() => this.arm(), MAX_INTERVAL_MS);
        if (this.timer && typeof this.timer === "object" && "unref" in this.timer) this.timer.unref();
      }
    });
  }
  executeTick() {
    if (!this.running) return;
    const tasks = [this.executor.tick(), this.executor.recoverStaleLocks()];
    if (this.systemCleanup) tasks.push(this.systemCleanup());
    Promise.allSettled(tasks).then((results) => {
      for (const r of results) if (r.status === "rejected") console.error("[cron:node] Tick task failed:", r.reason);
    }).finally(() => {
      if (this.running) this.arm();
    });
  }
};
const DEBOUNCE_MS = 60 * 1e3;
var PiggybackScheduler = class {
  lastTickAt = 0;
  running = false;
  systemCleanup = null;
  constructor(executor) {
    this.executor = executor;
  }
  setSystemCleanup(fn) {
    this.systemCleanup = fn;
  }
  start() {
    this.running = true;
  }
  stop() {
    this.running = false;
  }
  /**
  * No-op for piggyback — tick happens on next request.
  */
  reschedule() {
  }
  /**
  * Call this from middleware on each request.
  * Debounced: only actually ticks if enough time has passed.
  */
  onRequest() {
    if (!this.running) return;
    const now = Date.now();
    if (now - this.lastTickAt < DEBOUNCE_MS) return;
    this.lastTickAt = now;
    const tasks = [this.executor.tick(), this.executor.recoverStaleLocks()];
    if (this.systemCleanup) tasks.push(this.systemCleanup());
    Promise.allSettled(tasks).then((results) => {
      for (const r of results) if (r.status === "rejected") console.error("[cron:piggyback] Tick task failed:", r.reason);
    });
  }
};
const LEADING_SLASH_PATTERN = /^\//;
function parseStringArray(raw) {
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v) => typeof v === "string");
}
const VALID_METADATA_KINDS = /* @__PURE__ */ new Set([
  "meta",
  "property",
  "link",
  "jsonld"
]);
const VALID_LINK_REL = /* @__PURE__ */ new Set([
  "canonical",
  "alternate",
  "author",
  "license",
  "nlweb",
  "site.standard.document"
]);
function isValidMetadataContribution(c) {
  if (!c || typeof c !== "object" || !("kind" in c)) return false;
  const obj = c;
  if (typeof obj.kind !== "string" || !VALID_METADATA_KINDS.has(obj.kind)) return false;
  switch (obj.kind) {
    case "meta":
      return typeof obj.name === "string" && typeof obj.content === "string";
    case "property":
      return typeof obj.property === "string" && typeof obj.content === "string";
    case "link":
      return typeof obj.href === "string" && typeof obj.rel === "string" && VALID_LINK_REL.has(obj.rel);
    case "jsonld":
      return obj.graph != null && typeof obj.graph === "object";
    default:
      return false;
  }
}
const FIELD_TYPE_TO_KIND = {
  string: "string",
  slug: "string",
  url: "url",
  text: "richText",
  number: "number",
  integer: "number",
  boolean: "boolean",
  datetime: "datetime",
  select: "select",
  multiSelect: "multiSelect",
  portableText: "portableText",
  image: "image",
  file: "file",
  reference: "reference",
  json: "json",
  repeater: "repeater"
};
function contentItemToRecord(item) {
  return { ...item };
}
const dbCache = /* @__PURE__ */ new Map();
let dbInitPromise = null;
const storageCache = /* @__PURE__ */ new Map();
const sandboxedPluginCache = /* @__PURE__ */ new Map();
const marketplacePluginKeys = /* @__PURE__ */ new Set();
const marketplaceManifestCache = /* @__PURE__ */ new Map();
const sandboxedRouteMetaCache = /* @__PURE__ */ new Map();
let sandboxRunner = null;
var EmDashRuntime = class EmDashRuntime2 {
  /**
  * The singleton database instance (worker-lifetime cached).
  * Use the `db` getter instead — it checks the request context first
  * for per-request overrides (D1 read replica sessions, DO multi-site).
  */
  _db;
  storage;
  configuredPlugins;
  sandboxedPlugins;
  sandboxedPluginEntries;
  schemaRegistry;
  _hooks;
  config;
  mediaProviders;
  mediaProviderEntries;
  cronExecutor;
  email;
  cronScheduler;
  enabledPlugins;
  pluginStates;
  /**
  * Set to true after FTS indexes have been verified for this worker
  * lifetime so we don't re-scan on every admin request. See
  * ensureSearchHealthy().
  */
  _searchHealthChecked = false;
  _searchHealthPromise = null;
  /** Current hook pipeline. Use the `hooks` getter for external access. */
  get hooks() {
    return this._hooks;
  }
  /** All plugins eligible for the hook pipeline (includes built-in plugins).
  *  Stored so we can rebuild the pipeline when plugins are enabled/disabled. */
  allPipelinePlugins;
  /** Factory options for the hook pipeline context factory */
  pipelineFactoryOptions;
  /** Dependencies needed for exclusive hook resolution */
  runtimeDeps;
  /** Mutable ref for the cron invokeCronHook closure to read the current pipeline */
  pipelineRef;
  /**
  * Get the database instance for the current request.
  *
  * Checks the ALS-based request context first — middleware sets a
  * per-request Kysely instance there for D1 read replica sessions
  * or DO preview databases. Falls back to the singleton instance.
  */
  get db() {
    const ctx = getRequestContext();
    if (ctx?.db) return ctx.db;
    return this._db;
  }
  constructor(parts) {
    this._db = parts.db;
    this.storage = parts.storage;
    this.configuredPlugins = parts.configuredPlugins;
    this.sandboxedPlugins = parts.sandboxedPlugins;
    this.sandboxedPluginEntries = parts.sandboxedPluginEntries;
    this.schemaRegistry = new SchemaRegistry(parts.db);
    this._hooks = parts.hooks;
    this.enabledPlugins = parts.enabledPlugins;
    this.pluginStates = parts.pluginStates;
    this.config = parts.config;
    this.mediaProviders = parts.mediaProviders;
    this.mediaProviderEntries = parts.mediaProviderEntries;
    this.cronExecutor = parts.cronExecutor;
    this.cronScheduler = parts.cronScheduler;
    this.email = parts.emailPipeline;
    this.allPipelinePlugins = parts.allPipelinePlugins;
    this.pipelineFactoryOptions = parts.pipelineFactoryOptions;
    this.runtimeDeps = parts.runtimeDeps;
    this.pipelineRef = parts.pipelineRef;
  }
  /**
  * Get the sandbox runner instance (for marketplace install/update)
  */
  getSandboxRunner() {
    return sandboxRunner;
  }
  /**
  * Tick the cron system from request context (piggyback mode).
  * Call this from middleware on each request to ensure cron tasks
  * execute even when no dedicated scheduler is available.
  */
  tickCron() {
    if (this.cronScheduler instanceof PiggybackScheduler) this.cronScheduler.onRequest();
  }
  /**
  * Stop the cron scheduler gracefully.
  * Call during worker shutdown or hot-reload.
  */
  async stopCron() {
    if (this.cronScheduler) await this.cronScheduler.stop();
  }
  /**
  * Update in-memory plugin status and rebuild the hook pipeline.
  *
  * Rebuilding the pipeline ensures disabled plugins' hooks stop firing
  * and re-enabled plugins' hooks start firing again without a restart.
  * Exclusive hook selections are re-resolved after each rebuild.
  */
  async setPluginStatus(pluginId, status) {
    this.pluginStates.set(pluginId, status);
    if (status === "active") {
      this.enabledPlugins.add(pluginId);
      await this.rebuildHookPipeline();
      await this._hooks.runPluginActivate(pluginId);
    } else {
      await this._hooks.runPluginDeactivate(pluginId);
      this.enabledPlugins.delete(pluginId);
      await this.rebuildHookPipeline();
    }
  }
  /**
  * Rebuild the hook pipeline from the current set of enabled plugins.
  *
  * Filters `allPipelinePlugins` to only those in `enabledPlugins`,
  * creates a fresh HookPipeline, re-resolves exclusive hook selections,
  * and re-wires the context factory so existing references (cron
  * callbacks, email pipeline) use the new pipeline.
  */
  async rebuildHookPipeline() {
    const newPipeline = createHookPipeline(this.allPipelinePlugins.filter((p) => this.enabledPlugins.has(p.id)), this.pipelineFactoryOptions);
    await EmDashRuntime2.resolveExclusiveHooks(newPipeline, this.db, this.runtimeDeps);
    if (this.email) newPipeline.setContextFactory({
      db: this.db,
      emailPipeline: this.email
    });
    if (this.cronScheduler) {
      const scheduler = this.cronScheduler;
      newPipeline.setContextFactory({ cronReschedule: () => scheduler.reschedule() });
    }
    if (this.email) this.email.setPipeline(newPipeline);
    this.pipelineRef.current = newPipeline;
    this._hooks = newPipeline;
  }
  /**
  * Synchronize marketplace plugin runtime state with DB + storage.
  *
  * Ensures install/update/uninstall changes take effect immediately in the
  * current worker: loads newly active plugins and removes uninstalled ones.
  */
  async syncMarketplacePlugins() {
    if (!this.config.marketplace || !this.storage) return;
    if (!sandboxRunner || !sandboxRunner.isAvailable()) return;
    try {
      const marketplaceStates = await new PluginStateRepository(this.db).getMarketplacePlugins();
      const desired = /* @__PURE__ */ new Map();
      for (const state of marketplaceStates) {
        this.pluginStates.set(state.pluginId, state.status);
        if (state.status === "active") this.enabledPlugins.add(state.pluginId);
        else this.enabledPlugins.delete(state.pluginId);
        if (state.status !== "active") continue;
        desired.set(state.pluginId, state.marketplaceVersion ?? state.version);
      }
      const keysToRemove = [];
      for (const key of marketplacePluginKeys) {
        const [pluginId] = key.split(":");
        if (!pluginId) continue;
        const desiredVersion = desired.get(pluginId);
        if (desiredVersion && key === `${pluginId}:${desiredVersion}`) continue;
        keysToRemove.push(key);
      }
      for (const key of keysToRemove) {
        const [pluginId] = key.split(":");
        if (!pluginId) continue;
        if (!desired.get(pluginId)) {
          this.pluginStates.delete(pluginId);
          this.enabledPlugins.delete(pluginId);
        }
        const existing = sandboxedPluginCache.get(key);
        if (existing) try {
          await existing.terminate();
        } catch (error) {
          console.warn(`EmDash: Failed to terminate sandboxed plugin ${key}:`, error);
        }
        sandboxedPluginCache.delete(key);
        this.sandboxedPlugins.delete(key);
        marketplacePluginKeys.delete(key);
        if (pluginId) {
          sandboxedRouteMetaCache.delete(pluginId);
          marketplaceManifestCache.delete(pluginId);
        }
      }
      for (const [pluginId, version] of desired) {
        const key = `${pluginId}:${version}`;
        if (sandboxedPluginCache.has(key)) {
          marketplacePluginKeys.add(key);
          continue;
        }
        const bundle = await loadBundleFromR2(this.storage, pluginId, version);
        if (!bundle) {
          console.warn(`EmDash: Marketplace plugin ${pluginId}@${version} not found in R2`);
          continue;
        }
        const loaded = await sandboxRunner.load(bundle.manifest, bundle.backendCode);
        sandboxedPluginCache.set(key, loaded);
        this.sandboxedPlugins.set(key, loaded);
        marketplacePluginKeys.add(key);
        marketplaceManifestCache.set(pluginId, {
          id: bundle.manifest.id,
          version: bundle.manifest.version,
          admin: bundle.manifest.admin
        });
        if (bundle.manifest.routes.length > 0) {
          const routeMetaMap = /* @__PURE__ */ new Map();
          for (const entry of bundle.manifest.routes) {
            const normalized = normalizeManifestRoute(entry);
            routeMetaMap.set(normalized.name, { public: normalized.public === true });
          }
          sandboxedRouteMetaCache.set(pluginId, routeMetaMap);
        } else sandboxedRouteMetaCache.delete(pluginId);
      }
    } catch (error) {
      console.error("EmDash: Failed to sync marketplace plugins:", error);
    }
  }
  /**
  * Create and initialize the runtime
  */
  static async create(deps, timings) {
    const phase = async (name, desc, fn) => {
      if (!timings) return fn();
      const t0 = performance.now();
      try {
        return await fn();
      } finally {
        timings.push({
          name,
          dur: performance.now() - t0,
          desc
        });
      }
    };
    const db = await phase("rt.db", "DB init + migrations", () => EmDashRuntime2.getDatabase(deps));
    await phase("rt.secrets", "Validate encryption key", () => validateEncryptionKeyAtStartup());
    const storage = EmDashRuntime2.getStorage(deps);
    let pluginStates = /* @__PURE__ */ new Map();
    await phase("rt.plugins", "Plugin states", async () => {
      try {
        const states = await db.selectFrom("_plugin_state").select(["plugin_id", "status"]).execute();
        pluginStates = new Map(states.map((s) => [s.plugin_id, s.status]));
      } catch {
      }
    });
    const enabledPlugins = /* @__PURE__ */ new Set();
    for (const plugin of deps.plugins) {
      const status = pluginStates.get(plugin.id);
      if (status === void 0 || status === "active") enabledPlugins.add(plugin.id);
    }
    let siteInfo;
    await phase("rt.site", "Site info options", async () => {
      try {
        const siteOpts = await new OptionsRepository(db).getMany([
          "emdash:site_title",
          "emdash:site_url",
          "emdash:locale"
        ]);
        siteInfo = {
          siteName: siteOpts.get("emdash:site_title") ?? void 0,
          siteUrl: siteOpts.get("emdash:site_url") ?? void 0,
          locale: siteOpts.get("emdash:locale") ?? void 0
        };
      } catch {
      }
    });
    const allPipelinePlugins = [...deps.plugins];
    try {
      const defaultModeratorPlugin = definePlugin({
        id: DEFAULT_COMMENT_MODERATOR_PLUGIN_ID,
        version: "0.0.0",
        capabilities: ["users:read"],
        hooks: { "comment:moderate": {
          exclusive: true,
          handler: defaultCommentModerate
        } }
      });
      allPipelinePlugins.push(defaultModeratorPlugin);
      enabledPlugins.add(defaultModeratorPlugin.id);
    } catch (error) {
      console.warn("[comments] Failed to register default moderator:", error);
    }
    const enabledPluginList = allPipelinePlugins.filter((p) => enabledPlugins.has(p.id));
    const pipelineFactoryOptions = {
      db,
      storage: storage ?? void 0,
      siteInfo
    };
    const pipeline = createHookPipeline(enabledPluginList, pipelineFactoryOptions);
    const sandboxedPlugins2 = await phase("rt.sandbox", "Sandboxed plugins", () => EmDashRuntime2.loadSandboxedPlugins(deps, db));
    if (deps.config.marketplace && storage) await phase("rt.market", "Marketplace plugins", () => EmDashRuntime2.loadMarketplacePlugins(db, storage, deps, sandboxedPlugins2));
    const mediaProviders2 = /* @__PURE__ */ new Map();
    const mediaProviderEntries = deps.mediaProviderEntries ?? [];
    const providerContext = {
      db,
      storage
    };
    for (const entry of mediaProviderEntries) try {
      const provider = entry.createProvider(providerContext);
      mediaProviders2.set(entry.id, provider);
    } catch (error) {
      console.warn(`Failed to initialize media provider "${entry.id}":`, error);
    }
    await phase("rt.hooks", "Exclusive hook resolution", () => EmDashRuntime2.resolveExclusiveHooks(pipeline, db, deps));
    const emailPipeline = new EmailPipeline(pipeline);
    if (sandboxRunner) sandboxRunner.setEmailSend((message, pluginId) => emailPipeline.send(message, pluginId));
    const pipelineRef = { current: pipeline };
    const invokeCronHook = async (pluginId, event) => {
      const result = await pipelineRef.current.invokeCronHook(pluginId, event);
      if (!result.success && result.error) throw result.error;
    };
    pipeline.setContextFactory({
      db,
      emailPipeline
    });
    let cronExecutor = null;
    let cronScheduler = null;
    await phase("rt.cron", "Cron init (recovery deferred post-response)", async () => {
      try {
        cronExecutor = new CronExecutor(db, invokeCronHook);
        const executorForRecovery = cronExecutor;
        after(async () => {
          try {
            const recovered = await executorForRecovery.recoverStaleLocks();
            if (recovered > 0) console.log(`[cron] Recovered ${recovered} stale task lock(s)`);
          } catch (error) {
            console.error("[cron] Failed to recover stale task locks:", error);
          }
        });
        if (typeof globalThis.navigator !== "undefined" && globalThis.navigator.userAgent === "Cloudflare-Workers") cronScheduler = new PiggybackScheduler(cronExecutor);
        else cronScheduler = new NodeCronScheduler(cronExecutor);
        cronScheduler.setSystemCleanup(async () => {
          try {
            await runSystemCleanup(db, storage ?? void 0);
          } catch (error) {
            console.error("[cleanup] System cleanup failed:", error);
          }
        });
        pipeline.setContextFactory({ cronReschedule: () => cronScheduler?.reschedule() });
        await cronScheduler.start();
      } catch (error) {
        console.warn("[cron] Failed to initialize cron system:", error);
      }
    });
    return new EmDashRuntime2({
      db,
      storage,
      configuredPlugins: deps.plugins,
      sandboxedPlugins: sandboxedPlugins2,
      sandboxedPluginEntries: deps.sandboxedPluginEntries,
      hooks: pipeline,
      enabledPlugins,
      pluginStates,
      config: deps.config,
      mediaProviders: mediaProviders2,
      mediaProviderEntries,
      cronExecutor,
      cronScheduler,
      emailPipeline,
      allPipelinePlugins,
      pipelineFactoryOptions,
      runtimeDeps: deps,
      pipelineRef
    });
  }
  /**
  * Get a media provider by ID
  */
  getMediaProvider(providerId) {
    return this.mediaProviders.get(providerId);
  }
  /**
  * Get all media provider entries (for admin UI)
  */
  getMediaProviderList() {
    return this.mediaProviderEntries.map((e) => ({
      id: e.id,
      name: e.name,
      icon: e.icon,
      capabilities: e.capabilities
    }));
  }
  /**
  * Get or create database instance
  */
  static async getDatabase(deps) {
    const ctx = getRequestContext();
    if (ctx?.dbIsIsolated && ctx.db) return ctx.db;
    const dbConfig = deps.config.database;
    if (!dbConfig) try {
      return await getDb();
    } catch {
      throw new Error("EmDash database not configured. Either configure database in astro.config.mjs or use emdashLoader in live.config.ts");
    }
    const cacheKey = dbConfig.entrypoint;
    const cached = dbCache.get(cacheKey);
    if (cached) return cached;
    if (dbInitPromise) return dbInitPromise;
    dbInitPromise = (async () => {
      const db = new Kysely({
        dialect: deps.createDialect(dbConfig.config),
        log: kyselyLogOption()
      });
      await runMigrations(db);
      try {
        const [collectionCount, setupOption] = await Promise.all([db.selectFrom("_emdash_collections").select((eb) => eb.fn.countAll().as("count")).executeTakeFirstOrThrow(), db.selectFrom("options").select("value").where("name", "=", "emdash:setup_complete").executeTakeFirst()]);
        const setupDone = (() => {
          try {
            return setupOption && JSON.parse(setupOption.value) === true;
          } catch {
            return false;
          }
        })();
        if (collectionCount.count === 0 && !setupDone) {
          const { applySeed } = await import('./chunks/adapt-sandbox-entry_C2M6Z8Ap.mjs').then(n => n.at).then((n) => n.n);
          const { loadSeed } = await import('./chunks/load-DR1VwFXR_CQtvCF8K.mjs').then((n) => n.r);
          const { validateSeed } = await import('./chunks/adapt-sandbox-entry_C2M6Z8Ap.mjs').then(n => n.as).then((n) => n.n);
          const seed = await loadSeed();
          if (validateSeed(seed).valid) {
            await applySeed(db, seed, { onConflict: "skip" });
            console.log("Auto-seeded default collections");
          }
        }
      } catch {
      }
      dbCache.set(cacheKey, db);
      return db;
    })();
    try {
      return await dbInitPromise;
    } finally {
      dbInitPromise = null;
    }
  }
  /**
  * Get or create storage instance
  */
  static getStorage(deps) {
    const storageConfig = deps.config.storage;
    if (!storageConfig || !deps.createStorage) return null;
    const cacheKey = storageConfig.entrypoint;
    const cached = storageCache.get(cacheKey);
    if (cached) return cached;
    const storage = deps.createStorage(storageConfig.config);
    storageCache.set(cacheKey, storage);
    return storage;
  }
  /**
  * Load sandboxed plugins using SandboxRunner
  */
  static async loadSandboxedPlugins(deps, db) {
    if (sandboxedPluginCache.size > 0) return sandboxedPluginCache;
    if (!deps.sandboxEnabled || deps.sandboxedPluginEntries.length === 0) return sandboxedPluginCache;
    if (!sandboxRunner && deps.createSandboxRunner) sandboxRunner = deps.createSandboxRunner({ db });
    if (!sandboxRunner) return sandboxedPluginCache;
    if (!sandboxRunner.isAvailable()) {
      console.debug("EmDash: Sandbox runner not available (missing bindings), skipping sandbox");
      return sandboxedPluginCache;
    }
    for (const entry of deps.sandboxedPluginEntries) {
      const pluginKey = `${entry.id}:${entry.version}`;
      if (sandboxedPluginCache.has(pluginKey)) continue;
      try {
        const manifest = {
          id: entry.id,
          version: entry.version,
          capabilities: entry.capabilities ?? [],
          allowedHosts: entry.allowedHosts ?? [],
          storage: entry.storage ?? {},
          hooks: [],
          routes: [],
          admin: {}
        };
        const plugin = await sandboxRunner.load(manifest, entry.code);
        sandboxedPluginCache.set(pluginKey, plugin);
        console.log(`EmDash: Loaded sandboxed plugin ${pluginKey} with capabilities: [${manifest.capabilities.join(", ")}]`);
      } catch (error) {
        console.error(`EmDash: Failed to load sandboxed plugin ${entry.id}:`, error);
      }
    }
    return sandboxedPluginCache;
  }
  /**
  * Cold-start: load marketplace-installed plugins from site-local R2 storage
  *
  * Queries _plugin_state for source='marketplace' rows, fetches each bundle
  * from R2, and loads via SandboxRunner.
  */
  static async loadMarketplacePlugins(db, storage, deps, cache) {
    if (!sandboxRunner && deps.createSandboxRunner) sandboxRunner = deps.createSandboxRunner({ db });
    if (!sandboxRunner || !sandboxRunner.isAvailable()) return;
    try {
      const marketplacePlugins = await new PluginStateRepository(db).getMarketplacePlugins();
      for (const plugin of marketplacePlugins) {
        if (plugin.status !== "active") continue;
        const version = plugin.marketplaceVersion ?? plugin.version;
        const pluginKey = `${plugin.pluginId}:${version}`;
        if (cache.has(pluginKey)) continue;
        try {
          const bundle = await loadBundleFromR2(storage, plugin.pluginId, version);
          if (!bundle) {
            console.warn(`EmDash: Marketplace plugin ${plugin.pluginId}@${version} not found in R2`);
            continue;
          }
          const loaded = await sandboxRunner.load(bundle.manifest, bundle.backendCode);
          cache.set(pluginKey, loaded);
          marketplacePluginKeys.add(pluginKey);
          marketplaceManifestCache.set(plugin.pluginId, {
            id: bundle.manifest.id,
            version: bundle.manifest.version,
            admin: bundle.manifest.admin
          });
          if (bundle.manifest.routes.length > 0) {
            const routeMeta = /* @__PURE__ */ new Map();
            for (const entry of bundle.manifest.routes) {
              const normalized = normalizeManifestRoute(entry);
              routeMeta.set(normalized.name, { public: normalized.public === true });
            }
            sandboxedRouteMetaCache.set(plugin.pluginId, routeMeta);
          }
          console.log(`EmDash: Loaded marketplace plugin ${pluginKey} with capabilities: [${bundle.manifest.capabilities.join(", ")}]`);
        } catch (error) {
          console.error(`EmDash: Failed to load marketplace plugin ${plugin.pluginId}:`, error);
        }
      }
    } catch {
    }
  }
  /**
  * Resolve exclusive hook selections on startup.
  *
  * Delegates to the shared resolveExclusiveHooks() in hooks.ts.
  * The runtime version considers all pipeline providers as "active" since
  * the pipeline was already built from only active/enabled plugins.
  */
  static async resolveExclusiveHooks(pipeline, db, deps) {
    if (pipeline.getRegisteredExclusiveHooks().length === 0) return;
    let optionsRepo;
    try {
      optionsRepo = new OptionsRepository(db);
    } catch {
      return;
    }
    const preferredHints = /* @__PURE__ */ new Map();
    for (const entry of deps.sandboxedPluginEntries) if (entry.preferred && entry.preferred.length > 0) preferredHints.set(entry.id, entry.preferred);
    await resolveExclusiveHooks({
      pipeline,
      isActive: () => true,
      getOption: (key) => optionsRepo.get(key),
      setOption: (key, value) => optionsRepo.set(key, value),
      deleteOption: async (key) => {
        await optionsRepo.delete(key);
      },
      preferredHints
    });
  }
  /**
  * Build the admin manifest from the live database.
  *
  * Used by the admin UI (sidebar collections, content editor field
  * dispatch, manifest endpoint) and by WordPress import — it's never
  * read on a public request, so this isn't on any anonymous hot path.
  *
  * No cross-request cache. The previous worker-isolate cache produced
  * a class of cross-isolate staleness bugs (#776, #873, #876, #877)
  * because Cloudflare Workers keeps multiple warm isolates per region
  * and there's no fan-out primitive to invalidate them in step. The
  * cache existed to amortize an N+1 schema query pattern; now that
  * `listCollectionsWithFields()` does the same work in two queries,
  * the rebuild is fast enough to pay on every admin request.
  *
  * Within a single request, `requestCached` deduplicates concurrent
  * callers (the manifest endpoint and an admin SSR template, say).
  */
  getManifest() {
    return requestCached("emdash:manifest", () => this._buildManifest());
  }
  /**
  * Build the manifest from the database.
  *
  * Constant query shapes via `listCollectionsWithFields()` — one query
  * for collections, one batched query for fields (chunked at
  * `SQL_BATCH_SIZE` collection IDs to stay under D1's bound-parameter
  * limit). Typical sites stay well under the chunk threshold, so this
  * is two queries in practice; never N+1.
  */
  async _buildManifest() {
    const manifestCollections = {};
    try {
      const dbCollections = await new SchemaRegistry(this.db).listCollectionsWithFields();
      for (const collection of dbCollections) {
        const fields = {};
        for (const field of collection.fields) {
          const entry = {
            kind: FIELD_TYPE_TO_KIND[field.type] ?? "string",
            label: field.label,
            required: field.required
          };
          entry.id = field.id;
          if (field.widget) entry.widget = field.widget;
          if (field.options) entry.options = field.options;
          if (field.validation?.options) entry.options = field.validation.options.map((v) => ({
            value: v,
            label: v.charAt(0).toUpperCase() + v.slice(1)
          }));
          if ((field.type === "repeater" || field.type === "file" || field.type === "image") && field.validation) entry.validation = { ...field.validation };
          fields[field.slug] = entry;
        }
        manifestCollections[collection.slug] = {
          label: collection.label,
          labelSingular: collection.labelSingular || collection.label,
          supports: collection.supports || [],
          hasSeo: collection.hasSeo,
          urlPattern: collection.urlPattern,
          fields
        };
      }
    } catch (error) {
      console.debug("EmDash: Could not load database collections:", error);
    }
    const manifestPlugins = {};
    for (const plugin of this.configuredPlugins) {
      const status = this.pluginStates.get(plugin.id);
      const enabled = status === void 0 || status === "active";
      const hasAdminEntry = !!plugin.admin?.entry;
      const hasAdminPages = (plugin.admin?.pages?.length ?? 0) > 0;
      const hasWidgets = (plugin.admin?.widgets?.length ?? 0) > 0;
      let adminMode = "none";
      if (hasAdminEntry) adminMode = "react";
      else if (hasAdminPages || hasWidgets) adminMode = "blocks";
      manifestPlugins[plugin.id] = {
        version: plugin.version,
        enabled,
        adminMode,
        adminPages: plugin.admin?.pages ?? [],
        dashboardWidgets: plugin.admin?.widgets ?? [],
        portableTextBlocks: plugin.admin?.portableTextBlocks,
        fieldWidgets: plugin.admin?.fieldWidgets
      };
    }
    for (const entry of this.sandboxedPluginEntries) {
      const status = this.pluginStates.get(entry.id);
      const enabled = status === void 0 || status === "active";
      const hasAdminPages = (entry.adminPages?.length ?? 0) > 0;
      const hasWidgets = (entry.adminWidgets?.length ?? 0) > 0;
      manifestPlugins[entry.id] = {
        version: entry.version,
        enabled,
        sandboxed: true,
        adminMode: hasAdminPages || hasWidgets ? "blocks" : "none",
        adminPages: entry.adminPages ?? [],
        dashboardWidgets: entry.adminWidgets ?? []
      };
    }
    for (const [pluginId, meta] of marketplaceManifestCache) {
      if (manifestPlugins[pluginId]) continue;
      const enabled = this.pluginStates.get(pluginId) === "active";
      const pages = meta.admin?.pages;
      const widgets = meta.admin?.widgets;
      const hasAdminPages = (pages?.length ?? 0) > 0;
      const hasWidgets = (widgets?.length ?? 0) > 0;
      manifestPlugins[pluginId] = {
        version: meta.version,
        enabled,
        sandboxed: true,
        adminMode: hasAdminPages || hasWidgets ? "blocks" : "none",
        adminPages: pages ?? [],
        dashboardWidgets: widgets ?? []
      };
    }
    let manifestTaxonomies = [];
    try {
      manifestTaxonomies = (await this.db.selectFrom("_emdash_taxonomy_defs").selectAll().orderBy("name").execute()).map((row) => ({
        name: row.name,
        label: row.label,
        labelSingular: row.label_singular ?? void 0,
        hierarchical: row.hierarchical === 1,
        collections: parseStringArray(row.collections).toSorted()
      }));
    } catch (error) {
      console.debug("EmDash: Could not load taxonomy definitions:", error);
    }
    const manifestHash = await hashString(JSON.stringify(manifestCollections) + JSON.stringify(manifestPlugins) + JSON.stringify(manifestTaxonomies));
    const authMode = getAuthMode(this.config);
    const authModeValue = authMode.type === "external" ? authMode.providerType : "passkey";
    const i18nConfig = virtualConfig?.i18n;
    const i18n = i18nConfig && i18nConfig.locales && i18nConfig.locales.length > 1 ? {
      defaultLocale: i18nConfig.defaultLocale,
      locales: i18nConfig.locales
    } : void 0;
    return {
      version: VERSION,
      commit: COMMIT,
      hash: manifestHash,
      collections: manifestCollections,
      plugins: manifestPlugins,
      taxonomies: manifestTaxonomies,
      authMode: authModeValue,
      i18n,
      marketplace: !!this.config.marketplace
    };
  }
  /**
  * Verify and repair FTS indexes on demand. Runs at most once per worker
  * lifetime.
  *
  * Originally called from `EmDashRuntime.create()`, but on a busy D1 link
  * (e.g. SIN replica ~80-150ms per query) it added ~1.5s to every cold
  * start for a modest-sized site — more than every other init phase
  * combined. Anonymous public reads never touch the search write path,
  * so the cost isn't paid back for the vast majority of requests.
  *
  * Instead, search endpoints call this lazily: the first request that
  * actually needs the index pays the verify cost (usually fast — no
  * rebuild needed), everyone else runs cold-free.
  *
  * Uses the runtime's singleton database (`this._db`) rather than the
  * request-scoped DB. Verify reads only, but `rebuildIndex` writes, and
  * a GET search request on D1 carries a `first-unconstrained` session
  * that's free to route at a read replica — unsafe for writes. The
  * singleton always goes through the default binding, which the D1
  * adapter will promote to `first-primary` for write statements.
  *
  * Safe to call concurrently: repeated callers share the same in-flight
  * promise. Errors are swallowed internally so callers don't need to
  * defend against FTS not existing yet (pre-setup).
  */
  async ensureSearchHealthy() {
    if (this._searchHealthChecked) return;
    if (this._searchHealthPromise) return this._searchHealthPromise;
    if (!isSqlite(this._db)) {
      this._searchHealthChecked = true;
      return;
    }
    this._searchHealthPromise = (async () => {
      try {
        const repaired = await new FTSManager(this._db).verifyAndRepairAll();
        if (repaired > 0) console.log(`Repaired ${repaired} corrupted FTS index(es)`);
      } catch {
      } finally {
        this._searchHealthChecked = true;
        this._searchHealthPromise = null;
      }
    })();
    return this._searchHealthPromise;
  }
  async handleContentList(collection, params) {
    return handleContentList(this.db, collection, params);
  }
  async handleContentGet(collection, id, locale) {
    const result = await handleContentGet(this.db, collection, id, locale);
    return this.hydrateDraftData(result);
  }
  async handleContentGetIncludingTrashed(collection, id, locale) {
    const result = await handleContentGetIncludingTrashed(this.db, collection, id, locale);
    return this.hydrateDraftData(result);
  }
  /**
  * If the response item has a `draftRevisionId`, replace `item.data` with
  * the draft revision's data and expose the original published values as
  * `liveData`. This makes the content_get / content_update round-trip
  * intuitive — read returns the latest content the caller has saved
  * (their pending draft), with the previously-published values still
  * accessible for compare-style flows.
  *
  * No-op when no draft exists or the response is an error.
  */
  async hydrateDraftData(result) {
    if (!result || typeof result !== "object") return result;
    const r = result;
    if (!r.success || !r.data?.item) return result;
    const item = r.data.item;
    const draftRevisionId = typeof item.draftRevisionId === "string" ? item.draftRevisionId : null;
    if (!draftRevisionId) return result;
    try {
      const revision = await new RevisionRepository(this.db).findById(draftRevisionId);
      if (!revision) return result;
      const liveData = item.data && typeof item.data === "object" ? item.data : {};
      const revisionData = {};
      for (const [key, value] of Object.entries(revision.data)) if (!key.startsWith("_")) revisionData[key] = value;
      const mergedData = {
        ...liveData,
        ...revisionData
      };
      return {
        ...result,
        data: {
          ...r.data,
          item: {
            ...item,
            data: mergedData,
            liveData
          }
        }
      };
    } catch (error) {
      console.error("[emdash] draft hydration failed:", error);
      return result;
    }
  }
  async handleContentCreate(collection, body) {
    let processedData = body.data;
    if (this.hooks.hasHooks("content:beforeSave")) processedData = (await this.hooks.runContentBeforeSave(body.data, collection, true)).content;
    processedData = await this.runSandboxedBeforeSave(processedData, collection, true);
    processedData = await this.normalizeMediaFields(collection, processedData);
    const { validateContentData } = await import('./chunks/validation-Vc5DQkJa_MH_0zf6c.mjs');
    const validation = await validateContentData(this.db, collection, processedData, { partial: false });
    if (!validation.ok) return {
      success: false,
      error: validation.error
    };
    const result = await handleContentCreate(this.db, collection, {
      ...body,
      data: processedData,
      authorId: body.authorId,
      bylines: body.bylines
    });
    if (result.success && result.data) this.runAfterSaveHooks(contentItemToRecord(result.data.item), collection, true);
    return result;
  }
  async handleContentUpdate(collection, id, body) {
    const { ContentRepository } = await import('./chunks/adapt-sandbox-entry_C2M6Z8Ap.mjs').then(n => n.aq).then((n) => n.n);
    const repo = new ContentRepository(this.db);
    const resolvedItem = await repo.findByIdOrSlug(collection, id);
    const resolvedId = resolvedItem?.id ?? id;
    if (body._rev) {
      if (!resolvedItem) return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Content item not found: ${id}`
        }
      };
      const revCheck = validateRev(body._rev, resolvedItem);
      if (!revCheck.valid) return {
        success: false,
        error: {
          code: "CONFLICT",
          message: revCheck.message
        }
      };
    }
    const { _rev: _discardedRev, ...bodyWithoutRev } = body;
    let processedData = bodyWithoutRev.data;
    if (bodyWithoutRev.data) {
      if (this.hooks.hasHooks("content:beforeSave")) processedData = (await this.hooks.runContentBeforeSave(bodyWithoutRev.data, collection, false)).content;
      processedData = await this.runSandboxedBeforeSave(processedData, collection, false);
      processedData = await this.normalizeMediaFields(collection, processedData);
      const { validateContentData } = await import('./chunks/validation-Vc5DQkJa_MH_0zf6c.mjs');
      const validation = await validateContentData(this.db, collection, processedData, { partial: true });
      if (!validation.ok) return {
        success: false,
        error: validation.error
      };
    }
    let usesDraftRevisions = false;
    if (processedData) try {
      if ((await this.schemaRegistry.getCollectionWithFields(collection))?.supports?.includes("revisions")) {
        usesDraftRevisions = true;
        const revisionRepo = new RevisionRepository(this.db);
        const existing = await repo.findById(collection, resolvedId);
        if (existing) {
          let baseData;
          if (existing.draftRevisionId) baseData = (await revisionRepo.findById(existing.draftRevisionId))?.data ?? existing.data;
          else baseData = existing.data;
          const mergedData = {
            ...baseData,
            ...processedData
          };
          if (bodyWithoutRev.slug !== void 0) mergedData._slug = bodyWithoutRev.slug;
          if (bodyWithoutRev.skipRevision && existing.draftRevisionId) await revisionRepo.updateData(existing.draftRevisionId, mergedData);
          else {
            const revision = await revisionRepo.create({
              collection,
              entryId: resolvedId,
              data: mergedData,
              authorId: bodyWithoutRev.authorId ?? void 0
            });
            validateIdentifier(collection, "collection");
            const tableName = `ec_${collection}`;
            await sql`
								UPDATE ${sql.ref(tableName)}
								SET draft_revision_id = ${revision.id},
									updated_at = ${(/* @__PURE__ */ new Date()).toISOString()}
								WHERE id = ${resolvedId}
							`.execute(this.db);
            revisionRepo.pruneOldRevisions(collection, resolvedId, 50).catch(() => {
            });
          }
        }
      }
    } catch {
    }
    const result = await handleContentUpdate(this.db, collection, resolvedId, {
      ...bodyWithoutRev,
      data: usesDraftRevisions ? void 0 : processedData,
      slug: usesDraftRevisions ? void 0 : bodyWithoutRev.slug,
      authorId: bodyWithoutRev.authorId,
      bylines: bodyWithoutRev.bylines
    });
    const hydrated = await this.hydrateDraftData(result);
    if (hydrated.success && hydrated.data) this.runAfterSaveHooks(contentItemToRecord(hydrated.data.item), collection, false);
    return hydrated;
  }
  async handleContentDelete(collection, id) {
    if (this.hooks.hasHooks("content:beforeDelete")) {
      const { allowed } = await this.hooks.runContentBeforeDelete(id, collection);
      if (!allowed) return {
        success: false,
        error: {
          code: "DELETE_BLOCKED",
          message: "Delete blocked by plugin hook"
        }
      };
    }
    if (!await this.runSandboxedBeforeDelete(id, collection)) return {
      success: false,
      error: {
        code: "DELETE_BLOCKED",
        message: "Delete blocked by sandboxed plugin hook"
      }
    };
    const result = await handleContentDelete(this.db, collection, id);
    if (result.success) this.runAfterDeleteHooks(id, collection, false);
    return result;
  }
  async handleContentListTrashed(collection, params = {}) {
    return handleContentListTrashed(this.db, collection, params);
  }
  async handleContentRestore(collection, id) {
    return handleContentRestore(this.db, collection, id);
  }
  async handleContentPermanentDelete(collection, id) {
    const result = await handleContentPermanentDelete(this.db, collection, id);
    if (result.success) this.runAfterDeleteHooks(id, collection, true);
    return result;
  }
  async handleContentCountTrashed(collection) {
    return handleContentCountTrashed(this.db, collection);
  }
  async handleContentDuplicate(collection, id, authorId) {
    return handleContentDuplicate(this.db, collection, id, authorId);
  }
  async handleContentPublish(collection, id, options = {}) {
    const result = await handleContentPublish(this.db, collection, id, options);
    if (result.success && result.data) this.runAfterPublishHooks(contentItemToRecord(result.data.item), collection);
    return result;
  }
  async handleContentUnpublish(collection, id) {
    const result = await handleContentUnpublish(this.db, collection, id);
    if (result.success && result.data) this.runAfterUnpublishHooks(contentItemToRecord(result.data.item), collection);
    return result;
  }
  async handleContentSchedule(collection, id, scheduledAt) {
    return handleContentSchedule(this.db, collection, id, scheduledAt);
  }
  async handleContentUnschedule(collection, id) {
    return handleContentUnschedule(this.db, collection, id);
  }
  async handleContentCountScheduled(collection) {
    return handleContentCountScheduled(this.db, collection);
  }
  async handleContentDiscardDraft(collection, id) {
    return handleContentDiscardDraft(this.db, collection, id);
  }
  async handleContentCompare(collection, id) {
    return handleContentCompare(this.db, collection, id);
  }
  async handleContentTranslations(collection, id) {
    return handleContentTranslations(this.db, collection, id);
  }
  async handleMediaList(params) {
    return handleMediaList(this.db, params);
  }
  async handleMediaGet(id) {
    return handleMediaGet(this.db, id);
  }
  async handleMediaCreate(input) {
    let processedInput = input;
    if (this.hooks.hasHooks("media:beforeUpload")) {
      const hookResult = await this.hooks.runMediaBeforeUpload({
        name: input.filename,
        type: input.mimeType,
        size: input.size || 0
      });
      processedInput = {
        ...input,
        filename: hookResult.file.name,
        mimeType: hookResult.file.type,
        size: hookResult.file.size
      };
    }
    const result = await handleMediaCreate(this.db, processedInput);
    if (result.success && this.hooks.hasHooks("media:afterUpload")) {
      const item = result.data.item;
      const mediaItem = {
        id: item.id,
        filename: item.filename,
        mimeType: item.mimeType,
        size: item.size,
        url: `/media/${item.id}/${item.filename}`,
        createdAt: item.createdAt
      };
      this.hooks.runMediaAfterUpload(mediaItem).catch((err) => console.error("EmDash afterUpload hook error:", err));
    }
    return result;
  }
  async handleMediaUpdate(id, input) {
    const result = await handleMediaUpdate(this.db, id, input);
    if (result.success) invalidateSiteSettingsCache();
    return result;
  }
  async handleMediaDelete(id) {
    const result = await handleMediaDelete(this.db, id);
    if (result.success) invalidateSiteSettingsCache();
    return result;
  }
  async handleRevisionList(collection, entryId, params = {}) {
    return handleRevisionList(this.db, collection, entryId, params);
  }
  async handleRevisionGet(revisionId) {
    return handleRevisionGet(this.db, revisionId);
  }
  async handleRevisionRestore(revisionId, callerUserId) {
    const revisionRepo = new RevisionRepository(this.db);
    const revision = await revisionRepo.findById(revisionId);
    if (!revision) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Revision not found: ${revisionId}`
      }
    };
    if (!((await this.schemaRegistry.getCollectionWithFields(revision.collection))?.supports?.includes("revisions") ?? false)) {
      const result = await handleRevisionRestore(this.db, revisionId, callerUserId);
      return this.hydrateDraftData(result);
    }
    try {
      const newDraft = await revisionRepo.create({
        collection: revision.collection,
        entryId: revision.entryId,
        data: revision.data,
        authorId: callerUserId
      });
      validateIdentifier(revision.collection, "collection");
      const tableName = `ec_${revision.collection}`;
      await sql`
				UPDATE ${sql.ref(tableName)}
				SET draft_revision_id = ${newDraft.id},
					updated_at = ${(/* @__PURE__ */ new Date()).toISOString()}
				WHERE id = ${revision.entryId}
			`.execute(this.db);
      revisionRepo.pruneOldRevisions(revision.collection, revision.entryId, 50).catch(() => {
      });
      const refetched = await handleContentGet(this.db, revision.collection, revision.entryId);
      return this.hydrateDraftData(refetched);
    } catch (error) {
      console.error("[emdash] revision restore failed:", error);
      return {
        success: false,
        error: {
          code: "REVISION_RESTORE_ERROR",
          message: "Failed to restore revision"
        }
      };
    }
  }
  /**
  * Get route metadata for a plugin route without invoking the handler.
  * Used by the catch-all route to decide auth before dispatch.
  * Returns null if the plugin or route doesn't exist.
  */
  getPluginRouteMeta(pluginId, path) {
    if (!this.isPluginEnabled(pluginId)) return null;
    const routeKey = path.replace(LEADING_SLASH_PATTERN, "");
    const trustedPlugin = this.configuredPlugins.find((p) => p.id === pluginId);
    if (trustedPlugin) {
      const route = trustedPlugin.routes[routeKey];
      if (!route) return null;
      return { public: route.public === true };
    }
    const meta = sandboxedRouteMetaCache.get(pluginId);
    if (meta) {
      const routeMeta = meta.get(routeKey);
      if (routeMeta) return routeMeta;
    }
    if (routeKey === "admin") {
      const manifestMeta = marketplaceManifestCache.get(pluginId);
      if (manifestMeta?.admin?.pages?.length || manifestMeta?.admin?.widgets?.length) return { public: false };
      const entry = this.sandboxedPluginEntries.find((e) => e.id === pluginId);
      if (entry?.adminPages?.length || entry?.adminWidgets?.length) return { public: false };
    }
    if (this.findSandboxedPlugin(pluginId)) return { public: false };
    return null;
  }
  async handlePluginApiRoute(pluginId, _method, path, request) {
    if (!this.isPluginEnabled(pluginId)) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Plugin not enabled: ${pluginId}`
      }
    };
    const trustedPlugin = this.configuredPlugins.find((p) => p.id === pluginId);
    if (trustedPlugin && this.enabledPlugins.has(trustedPlugin.id)) {
      const routeRegistry = new PluginRouteRegistry({
        db: this.db,
        emailPipeline: this.email ?? void 0,
        trustedProxyHeaders: getTrustedProxyHeaders(this.config)
      });
      routeRegistry.register(trustedPlugin);
      const routeKey = path.replace(LEADING_SLASH_PATTERN, "");
      let body = void 0;
      try {
        body = await request.json();
      } catch {
      }
      return routeRegistry.invoke(pluginId, routeKey, {
        request,
        body
      });
    }
    const sandboxedPlugin = this.findSandboxedPlugin(pluginId);
    if (sandboxedPlugin) return this.handleSandboxedRoute(sandboxedPlugin, path, request);
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Plugin not found: ${pluginId}`
      }
    };
  }
  findSandboxedPlugin(pluginId) {
    for (const [key, plugin] of this.sandboxedPlugins) if (key.startsWith(pluginId + ":")) return plugin;
  }
  /**
  * Normalize image/file fields in content data.
  * Fills missing dimensions, storageKey, mimeType, and filename from providers.
  */
  async normalizeMediaFields(collection, data) {
    let collectionInfo;
    try {
      collectionInfo = await this.schemaRegistry.getCollectionWithFields(collection);
    } catch {
      return data;
    }
    if (!collectionInfo?.fields) return data;
    const imageFields = collectionInfo.fields.filter((f) => f.type === "image" || f.type === "file");
    if (imageFields.length === 0) return data;
    const getProvider = (id) => this.getMediaProvider(id);
    const result = { ...data };
    for (const field of imageFields) {
      const value = result[field.slug];
      if (value == null) continue;
      try {
        const normalized = await normalizeMediaValue(value, getProvider);
        if (normalized) result[field.slug] = normalized;
      } catch {
      }
    }
    return result;
  }
  async runSandboxedBeforeSave(content, collection, isNew) {
    let result = content;
    for (const [pluginKey, plugin] of this.sandboxedPlugins) {
      const [id] = pluginKey.split(":");
      if (!id || !this.isPluginEnabled(id)) continue;
      try {
        const hookResult = await plugin.invokeHook("content:beforeSave", {
          content: result,
          collection,
          isNew
        });
        if (hookResult && typeof hookResult === "object" && !Array.isArray(hookResult)) {
          const record = {};
          for (const [k, v] of Object.entries(hookResult)) record[k] = v;
          result = record;
        }
      } catch (error) {
        console.error(`EmDash: Sandboxed plugin ${id} beforeSave hook error:`, error);
      }
    }
    return result;
  }
  async runSandboxedBeforeDelete(id, collection) {
    for (const [pluginKey, plugin] of this.sandboxedPlugins) {
      const [pluginId] = pluginKey.split(":");
      if (!pluginId || !this.isPluginEnabled(pluginId)) continue;
      try {
        if (await plugin.invokeHook("content:beforeDelete", {
          id,
          collection
        }) === false) return false;
      } catch (error) {
        console.error(`EmDash: Sandboxed plugin ${pluginId} beforeDelete hook error:`, error);
      }
    }
    return true;
  }
  runAfterSaveHooks(content, collection, isNew) {
    after(async () => {
      if (this.hooks.hasHooks("content:afterSave")) try {
        await this.hooks.runContentAfterSave(content, collection, isNew);
      } catch (err) {
        console.error("EmDash afterSave hook error:", err);
      }
      const tasks = [];
      for (const [pluginKey, plugin] of this.sandboxedPlugins) {
        const [id] = pluginKey.split(":");
        if (!id || !this.isPluginEnabled(id)) continue;
        tasks.push((async () => {
          try {
            await plugin.invokeHook("content:afterSave", {
              content,
              collection,
              isNew
            });
          } catch (err) {
            console.error(`EmDash: Sandboxed plugin ${id} afterSave error:`, err);
          }
        })());
      }
      await Promise.allSettled(tasks);
    });
  }
  runAfterDeleteHooks(id, collection, permanent) {
    if (this.hooks.hasHooks("content:afterDelete")) this.hooks.runContentAfterDelete(id, collection, permanent).catch((err) => console.error("EmDash afterDelete hook error:", err));
    for (const [pluginKey, plugin] of this.sandboxedPlugins) {
      const [pluginId] = pluginKey.split(":");
      if (!pluginId || !this.isPluginEnabled(pluginId)) continue;
      plugin.invokeHook("content:afterDelete", {
        id,
        collection,
        permanent
      }).catch((err) => console.error(`EmDash: Sandboxed plugin ${pluginId} afterDelete error:`, err));
    }
  }
  runAfterPublishHooks(content, collection) {
    after(async () => {
      if (this.hooks.hasHooks("content:afterPublish")) try {
        await this.hooks.runContentAfterPublish(content, collection);
      } catch (err) {
        console.error("EmDash afterPublish hook error:", err);
      }
      const tasks = [];
      for (const [pluginKey, plugin] of this.sandboxedPlugins) {
        const [pluginId] = pluginKey.split(":");
        if (!pluginId || !this.isPluginEnabled(pluginId)) continue;
        tasks.push((async () => {
          try {
            await plugin.invokeHook("content:afterPublish", {
              content,
              collection
            });
          } catch (err) {
            console.error(`EmDash: Sandboxed plugin ${pluginId} afterPublish error:`, err);
          }
        })());
      }
      await Promise.allSettled(tasks);
    });
  }
  runAfterUnpublishHooks(content, collection) {
    if (this.hooks.hasHooks("content:afterUnpublish")) this.hooks.runContentAfterUnpublish(content, collection).catch((err) => console.error("EmDash afterUnpublish hook error:", err));
    for (const [pluginKey, plugin] of this.sandboxedPlugins) {
      const [pluginId] = pluginKey.split(":");
      if (!pluginId || !this.isPluginEnabled(pluginId)) continue;
      plugin.invokeHook("content:afterUnpublish", {
        content,
        collection
      }).catch((err) => console.error(`EmDash: Sandboxed plugin ${pluginId} afterUnpublish error:`, err));
    }
  }
  async handleSandboxedRoute(plugin, path, request) {
    const routeName = path.replace(LEADING_SLASH_PATTERN, "");
    let body = void 0;
    try {
      body = await request.json();
    } catch {
    }
    try {
      const headers = sanitizeHeadersForSandbox(request.headers);
      const meta = extractRequestMeta(request, this.config);
      return {
        success: true,
        data: await plugin.invokeRoute(routeName, body, {
          url: request.url,
          method: request.method,
          headers,
          meta
        })
      };
    } catch (error) {
      console.error(`EmDash: Sandboxed plugin route error:`, error);
      return {
        success: false,
        error: {
          code: "ROUTE_ERROR",
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  /**
  * Cache for page contributions. Uses a WeakMap keyed on the PublicPageContext
  * object so results are collected once per page context per request, even when
  * multiple render components (EmDashHead, EmDashBodyStart, EmDashBodyEnd)
  * request contributions from the same page.
  */
  pageContributionCache = /* @__PURE__ */ new WeakMap();
  /**
  * Collect all page contributions (metadata + fragments) in a single pass.
  * Results are cached by page context object identity.
  */
  async collectPageContributions(page) {
    const cached = this.pageContributionCache.get(page);
    if (cached) return cached;
    const promise = this.doCollectPageContributions(page);
    this.pageContributionCache.set(page, promise);
    return promise;
  }
  async doCollectPageContributions(page) {
    const metadata = [];
    const fragments = [];
    if (this.hooks.hasHooks("page:metadata")) {
      const results = await this.hooks.runPageMetadata({ page });
      for (const r of results) metadata.push(...r.contributions);
    }
    if (this.hooks.hasHooks("page:fragments")) {
      const results = await this.hooks.runPageFragments({ page });
      for (const r of results) fragments.push(...r.contributions);
    }
    for (const [pluginKey, plugin] of this.sandboxedPlugins) {
      const [id] = pluginKey.split(":");
      if (!id || !this.isPluginEnabled(id)) continue;
      try {
        const result = await plugin.invokeHook("page:metadata", { page });
        if (result != null) {
          const items = Array.isArray(result) ? result : [result];
          for (const item of items) if (isValidMetadataContribution(item)) metadata.push(item);
        }
      } catch (error) {
        console.error(`EmDash: Sandboxed plugin ${id} page:metadata error:`, error);
      }
    }
    return {
      metadata,
      fragments
    };
  }
  /**
  * Collect page metadata contributions from trusted and sandboxed plugins.
  * Delegates to the single-pass collector and returns the metadata portion.
  */
  async collectPageMetadata(page) {
    const { metadata } = await this.collectPageContributions(page);
    return metadata;
  }
  /**
  * Collect page fragment contributions from trusted plugins only.
  * Delegates to the single-pass collector and returns the fragments portion.
  */
  async collectPageFragments(page) {
    const { fragments } = await this.collectPageContributions(page);
    return fragments;
  }
  isPluginEnabled(pluginId) {
    const status = this.pluginStates.get(pluginId);
    return status === void 0 || status === "active";
  }
};
function resolvePublicMediaUrl(storage, storageKey) {
  if (!storageKey) return "";
  if (storage) return storage.getPublicUrl(storageKey);
  return `/_emdash/api/media/file/${storageKey}`;
}
function createPublicMediaUrlResolver(storage) {
  return (key) => resolvePublicMediaUrl(storage, key);
}
let runtimeInstance = null;
let runtimeInitializing = false;
let i18nInitialized = false;
let setupVerified = false;
function getConfig() {
  if (virtualConfig && typeof virtualConfig === "object") {
    if (!i18nInitialized) {
      i18nInitialized = true;
      const config = virtualConfig;
      if (config.i18n && typeof config.i18n === "object") setI18nConfig(config.i18n);
      else setI18nConfig(null);
    }
    return virtualConfig;
  }
  return null;
}
function getPlugins() {
  return plugins || [];
}
function buildDependencies(config) {
  return {
    config,
    plugins: getPlugins(),
    createDialect,
    createStorage,
    sandboxEnabled,
    sandboxedPluginEntries: sandboxedPlugins || [],
    createSandboxRunner,
    mediaProviderEntries: mediaProviders || []
  };
}
async function getRuntime(config, initTimings) {
  if (runtimeInstance) return runtimeInstance;
  if (runtimeInitializing) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return getRuntime(config, initTimings);
  }
  runtimeInitializing = true;
  try {
    const deps = buildDependencies(config);
    const runtime = await EmDashRuntime.create(deps, initTimings);
    runtimeInstance = runtime;
    return runtime;
  } finally {
    runtimeInitializing = false;
  }
}
const ASTRO_COOKIES_SYMBOL = /* @__PURE__ */ Symbol.for("astro.cookies");
function finalizeResponse(response, serverTimings) {
  const res = new Response(response.body, response);
  const astroCookies = Reflect.get(response, ASTRO_COOKIES_SYMBOL);
  if (astroCookies !== void 0) Reflect.set(res, ASTRO_COOKIES_SYMBOL, astroCookies);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (!res.headers.has("Content-Security-Policy")) res.headers.set("X-Frame-Options", "SAMEORIGIN");
  if (serverTimings && serverTimings.length > 0) res.headers.set("Server-Timing", serverTimings.map((t) => {
    const dur = Math.round(t.dur);
    return t.desc ? `${t.name};dur=${dur};desc="${t.desc}"` : `${t.name};dur=${dur}`;
  }).join(", "));
  return res;
}
function pushMetricsTimings(timings, metrics) {
  if (metrics.dbCount > 0) {
    timings.push({
      name: "db.total",
      dur: metrics.dbTotalMs,
      desc: "DB total"
    });
    timings.push({
      name: "db.count",
      dur: metrics.dbCount,
      desc: "Query count"
    });
    if (metrics.dbFirstOffset !== null) timings.push({
      name: "db.first",
      dur: metrics.dbFirstOffset,
      desc: "First query at"
    });
    if (metrics.dbLastOffset !== null) timings.push({
      name: "db.last",
      dur: metrics.dbLastOffset,
      desc: "Last query at"
    });
  }
  if (metrics.cacheHits + metrics.cacheMisses > 0) {
    timings.push({
      name: "cache.hit",
      dur: metrics.cacheHits,
      desc: "Cache hits"
    });
    timings.push({
      name: "cache.miss",
      dur: metrics.cacheMisses,
      desc: "Cache misses"
    });
  }
}
const PUBLIC_RUNTIME_ROUTES = /* @__PURE__ */ new Set(["/sitemap.xml", "/robots.txt"]);
const SITEMAP_COLLECTION_RE = /^\/sitemap-[a-z][a-z0-9_]*\.xml$/;
function createRequestScopedDb$1(opts) {
  if (typeof createRequestScopedDb !== "function") return null;
  return createRequestScopedDb();
}
const onRequest$5 = defineMiddleware(async (context, next) => {
  const { request, locals, cookies } = context;
  const url = context.url;
  if (!url.pathname.startsWith("/_emdash") && virtualConfig?.authProviders) {
    if (virtualConfig.authProviders.some((p) => p.routes?.some((r) => r.pattern && url.pathname === r.pattern))) return finalizeResponse(await next());
  }
  const queryRecorder = isInstrumentationEnabled() ? createRecorder(url.pathname, request.method, request.headers.get("x-perf-phase") ?? "default") : void 0;
  const metrics = createRequestMetrics(performance.now());
  const run = async () => {
    const isEmDashRoute = url.pathname.startsWith("/_emdash");
    const isPublicRuntimeRoute = PUBLIC_RUNTIME_ROUTES.has(url.pathname) || SITEMAP_COLLECTION_RE.test(url.pathname);
    const hasEditCookie = cookies.get("emdash-edit-mode")?.value === "true";
    const hasPreviewToken = url.searchParams.has("_preview");
    const playgroundDb = locals.__playgroundDb;
    const hasSessionCookie = cookies.get("astro-session") !== void 0;
    const sessionUser = context.isPrerendered || !hasSessionCookie ? null : await context.session?.get("user");
    if (!isEmDashRoute && !isPublicRuntimeRoute && !hasEditCookie && !hasPreviewToken) {
      if (!sessionUser && !playgroundDb) {
        const timings = [];
        const mwStart = performance.now();
        if (!setupVerified) {
          const t0 = performance.now();
          try {
            const { getDb: getDb2 } = await import('./chunks/loader-ou_PXAjg_C6kEC2mY.mjs').then(n => n.l).then((n) => n.i);
            await (await getDb2()).selectFrom("_emdash_migrations").selectAll().limit(1).execute();
            setupVerified = true;
          } catch {
            return context.redirect("/_emdash/admin/setup");
          }
          timings.push({
            name: "setup",
            dur: performance.now() - t0,
            desc: "Setup probe"
          });
        }
        const config2 = getConfig();
        if (config2) {
          const initSubTimings = [];
          const t0 = performance.now();
          try {
            const runtime = await getRuntime(config2, initSubTimings);
            setupVerified = true;
            locals.emdash = {
              collectPageMetadata: runtime.collectPageMetadata.bind(runtime),
              collectPageFragments: runtime.collectPageFragments.bind(runtime),
              getPublicMediaUrl: createPublicMediaUrlResolver(runtime.storage)
            };
          } catch {
          }
          timings.push({
            name: "rt",
            dur: performance.now() - t0,
            desc: "Runtime init"
          });
          for (const sub of initSubTimings) timings.push(sub);
        }
        const anonScoped = createRequestScopedDb$1({
          config: config2?.database?.config,
          isWrite: request.method !== "GET" && request.method !== "HEAD"});
        const runAnon = async () => {
          const t0 = performance.now();
          const response = await next();
          timings.push({
            name: "render",
            dur: performance.now() - t0,
            desc: "Page render"
          });
          timings.push({
            name: "mw",
            dur: performance.now() - mwStart,
            desc: "Total middleware"
          });
          pushMetricsTimings(timings, metrics);
          return finalizeResponse(response, timings);
        };
        if (anonScoped) {
          const parent = getRequestContext();
          return runWithContext(parent ? {
            ...parent,
            db: anonScoped.db
          } : {
            editMode: false,
            db: anonScoped.db,
            metrics
          }, async () => {
            const response = await runAnon();
            anonScoped.commit();
            return response;
          });
        }
        return runAnon();
      }
    }
    const config = getConfig();
    if (!config) {
      console.error("EmDash: No configuration found");
      return finalizeResponse(await next());
    }
    const doInit = async () => {
      const timings = [];
      const mwStart = performance.now();
      try {
        const initSubTimings = [];
        let t0 = performance.now();
        const runtime = await getRuntime(config, initSubTimings);
        timings.push({
          name: "rt",
          dur: performance.now() - t0,
          desc: "Runtime init"
        });
        for (const sub of initSubTimings) timings.push(sub);
        setupVerified = true;
        locals.emdash = {
          handleContentList: runtime.handleContentList.bind(runtime),
          handleContentGet: runtime.handleContentGet.bind(runtime),
          handleContentCreate: runtime.handleContentCreate.bind(runtime),
          handleContentUpdate: runtime.handleContentUpdate.bind(runtime),
          handleContentDelete: runtime.handleContentDelete.bind(runtime),
          handleContentListTrashed: runtime.handleContentListTrashed.bind(runtime),
          handleContentRestore: runtime.handleContentRestore.bind(runtime),
          handleContentPermanentDelete: runtime.handleContentPermanentDelete.bind(runtime),
          handleContentCountTrashed: runtime.handleContentCountTrashed.bind(runtime),
          handleContentGetIncludingTrashed: runtime.handleContentGetIncludingTrashed.bind(runtime),
          handleContentDuplicate: runtime.handleContentDuplicate.bind(runtime),
          handleContentPublish: runtime.handleContentPublish.bind(runtime),
          handleContentUnpublish: runtime.handleContentUnpublish.bind(runtime),
          handleContentSchedule: runtime.handleContentSchedule.bind(runtime),
          handleContentUnschedule: runtime.handleContentUnschedule.bind(runtime),
          handleContentCountScheduled: runtime.handleContentCountScheduled.bind(runtime),
          handleContentDiscardDraft: runtime.handleContentDiscardDraft.bind(runtime),
          handleContentCompare: runtime.handleContentCompare.bind(runtime),
          handleContentTranslations: runtime.handleContentTranslations.bind(runtime),
          handleMediaList: runtime.handleMediaList.bind(runtime),
          handleMediaGet: runtime.handleMediaGet.bind(runtime),
          handleMediaCreate: runtime.handleMediaCreate.bind(runtime),
          handleMediaUpdate: runtime.handleMediaUpdate.bind(runtime),
          handleMediaDelete: runtime.handleMediaDelete.bind(runtime),
          handleRevisionList: runtime.handleRevisionList.bind(runtime),
          handleRevisionGet: runtime.handleRevisionGet.bind(runtime),
          handleRevisionRestore: runtime.handleRevisionRestore.bind(runtime),
          handlePluginApiRoute: runtime.handlePluginApiRoute.bind(runtime),
          getPluginRouteMeta: runtime.getPluginRouteMeta.bind(runtime),
          getMediaProvider: runtime.getMediaProvider.bind(runtime),
          getMediaProviderList: runtime.getMediaProviderList.bind(runtime),
          collectPageMetadata: runtime.collectPageMetadata.bind(runtime),
          collectPageFragments: runtime.collectPageFragments.bind(runtime),
          ensureSearchHealthy: runtime.ensureSearchHealthy.bind(runtime),
          storage: runtime.storage,
          db: runtime.db,
          getPublicMediaUrl: createPublicMediaUrlResolver(runtime.storage),
          hooks: runtime.hooks,
          email: runtime.email,
          configuredPlugins: runtime.configuredPlugins,
          config,
          getManifest: runtime.getManifest.bind(runtime),
          invalidateUrlPatternCache,
          getSandboxRunner: runtime.getSandboxRunner.bind(runtime),
          syncMarketplacePlugins: runtime.syncMarketplacePlugins.bind(runtime),
          setPluginStatus: runtime.setPluginStatus.bind(runtime)
        };
      } catch (error) {
        console.error("EmDash middleware error:", error);
      }
      const scoped = createRequestScopedDb$1({
        config: config?.database?.config,
        isWrite: request.method !== "GET" && request.method !== "HEAD",
        cookies: context.cookies});
      const renderAndFinalize = async () => {
        const t0 = performance.now();
        const response = await next();
        timings.push({
          name: "render",
          dur: performance.now() - t0,
          desc: "Page render"
        });
        timings.push({
          name: "mw",
          dur: performance.now() - mwStart,
          desc: "Total middleware"
        });
        pushMetricsTimings(timings, metrics);
        return finalizeResponse(response, timings);
      };
      if (scoped) {
        const parent = getRequestContext();
        return runWithContext(parent ? {
          ...parent,
          db: scoped.db
        } : {
          editMode: false,
          db: scoped.db,
          metrics
        }, async () => {
          const response = await renderAndFinalize();
          scoped.commit();
          return response;
        });
      }
      return renderAndFinalize();
    };
    if (playgroundDb) {
      const editMode = context.cookies.get("emdash-edit-mode")?.value === "true";
      const parent = getRequestContext();
      return runWithContext(parent ? {
        ...parent,
        editMode,
        db: playgroundDb,
        dbIsIsolated: true
      } : {
        editMode,
        db: playgroundDb,
        dbIsIsolated: true,
        metrics
      }, doInit);
    }
    return doInit();
  };
  try {
    return await runWithContext({
      editMode: false,
      queryRecorder,
      metrics
    }, run);
  } finally {
    if (queryRecorder) flushRecorder(queryRecorder);
  }
});

//#region src/astro/middleware/redirect.ts
/**
* Redirect middleware
*
* Intercepts incoming requests and checks for matching redirect rules.
* Runs after runtime init (needs db) but before setup/auth (should handle
* ALL routes, including public ones, and should be fast).
*
* Skip paths:
* - /_emdash/* (admin UI, API routes, auth endpoints)
* - /_image (Astro image optimization)
* - Static assets (files with extensions)
*
* 404 logging happens post-response: if next() returns 404 and the path
* wasn't already matched by a redirect, log it.
*/
/** Paths that should never be intercepted by redirects */
const SKIP_PREFIXES = ["/_emdash", "/_image"];
/** Static asset extensions -- don't redirect file requests */
const ASSET_EXTENSION = /\.\w{1,10}$/;
function isRedirectCode(code) {
	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
}
const onRequest$4 = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return next();
	if (ASSET_EXTENSION.test(pathname)) return next();
	let db = context.locals.emdash?.db;
	if (!db) try {
		db = await getDb();
	} catch {
		return next();
	}
	try {
		const repo = new RedirectRepository(db);
		let cached = getCachedRedirects();
		if (!cached) cached = setCachedRedirects(await repo.findAllEnabled());
		const exact = cached.exact.get(pathname);
		if (exact) {
			const dest = exact.destination;
			if (dest.startsWith("//") || dest.startsWith("/\\")) return next();
			repo.recordHit(exact.id).catch(() => {});
			const code = isRedirectCode(exact.type) ? exact.type : 301;
			return context.redirect(dest, code);
		}
		const patternMatch = matchCachedPatterns(cached.patterns, pathname);
		if (patternMatch) {
			const { redirect, destination } = patternMatch;
			if (destination.startsWith("//") || destination.startsWith("/\\")) return next();
			repo.recordHit(redirect.id).catch(() => {});
			const code = isRedirectCode(redirect.type) ? redirect.type : 301;
			return context.redirect(destination, code);
		}
		const response = await next();
		if (response.status === 404) {
			const referrer = context.request.headers.get("referer") ?? null;
			const userAgent = context.request.headers.get("user-agent") ?? null;
			repo.log404({
				path: pathname,
				referrer,
				userAgent
			}).catch(() => {});
		}
		return response;
	} catch {
		return next();
	}
});

//#region src/astro/middleware/setup.ts
/**
* Setup detection middleware
*
* Redirects to setup wizard if the site hasn't been set up yet.
* Checks both "emdash:setup_complete" option AND user existence.
*
* Detection logic (in order):
* 1. Does options table exist? No → setup needed
* 2. Is setup_complete true? No → setup needed
* 3. In passkey mode: Are there any users? No → setup needed
*    In Access mode: Skip user check (first user created on first login)
* 4. Proceed to admin
*/
const onRequest$3 = defineMiddleware(async (context, next) => {
	const isAdminRoute = context.url.pathname.startsWith("/_emdash/admin");
	const isSetupRoute = context.url.pathname.startsWith("/_emdash/admin/setup");
	if (isAdminRoute && !isSetupRoute) {
		const { emdash } = context.locals;
		if (!emdash?.db) return next();
		try {
			const setupComplete = await emdash.db.selectFrom("options").select("value").where("name", "=", "emdash:setup_complete").executeTakeFirst();
			if (!(setupComplete && (() => {
				try {
					const parsed = JSON.parse(setupComplete.value);
					return parsed === true || parsed === "true";
				} catch {
					return false;
				}
			})())) return context.redirect("/_emdash/admin/setup");
			if (getAuthMode(emdash.config).type === "passkey") {
				if ((await emdash.db.selectFrom("users").select((eb) => eb.fn.countAll().as("count")).executeTakeFirstOrThrow()).count === 0) return context.redirect("/_emdash/admin/setup");
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes("no such table")) return context.redirect("/_emdash/admin/setup");
			console.error("Setup middleware error:", error);
		}
	}
	return next();
});

let _envSiteUrl = null;
function getEnvSiteUrl() {
  if (_envSiteUrl !== null) return _envSiteUrl || void 0;
  try {
    const value = typeof process !== "undefined" && process.env?.EMDASH_SITE_URL || typeof process !== "undefined" && process.env?.SITE_URL || "";
    if (value) {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        _envSiteUrl = "";
        return;
      }
      _envSiteUrl = parsed.origin;
    } else _envSiteUrl = "";
  } catch {
    _envSiteUrl = "";
  }
  return _envSiteUrl || void 0;
}
function getPublicOrigin(url, config) {
  return config?.siteUrl || getEnvSiteUrl() || url.origin;
}

const authenticate = undefined;

function checkPublicCsrf(request, url, publicOrigin) {
  if (request.headers.get("X-EmDash-Request") === "1") return null;
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.origin === url.origin) return null;
      if (publicOrigin && originUrl.origin === publicOrigin) return null;
    } catch {
    }
    return apiError("CSRF_REJECTED", "Cross-origin request blocked", 403);
  }
  return null;
}
async function resolveApiToken(db, rawToken) {
  const hash = hashPrefixedToken(rawToken);
  const row = await db.selectFrom("_emdash_api_tokens").select([
    "id",
    "user_id",
    "scopes",
    "expires_at"
  ]).where("token_hash", "=", hash).executeTakeFirst();
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) < /* @__PURE__ */ new Date()) return null;
  db.updateTable("_emdash_api_tokens").set({ last_used_at: (/* @__PURE__ */ new Date()).toISOString() }).where("id", "=", row.id).execute().catch(() => {
  });
  return {
    userId: row.user_id,
    scopes: JSON.parse(row.scopes)
  };
}
async function resolveOAuthToken(db, rawToken) {
  const hash = hashPrefixedToken(rawToken);
  const row = await db.selectFrom("_emdash_oauth_tokens").select([
    "user_id",
    "scopes",
    "expires_at",
    "token_type"
  ]).where("token_hash", "=", hash).where("token_type", "=", "access").executeTakeFirst();
  if (!row) return null;
  if (new Date(row.expires_at) < /* @__PURE__ */ new Date()) return null;
  return {
    userId: row.user_id,
    scopes: JSON.parse(row.scopes)
  };
}
function buildEmDashCsp() {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' https: data: blob:",
    "object-src 'none'",
    "base-uri 'self'"
  ].join("; ");
}
const MW_CACHE_HEADERS = { "Cache-Control": "private, no-store" };
const ROLE_ADMIN = 50;
const MCP_ENDPOINT_PATH = "/_emdash/api/mcp";
function isUnsafeMethod(method) {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}
function csrfRejectedResponse() {
  return new Response(JSON.stringify({ error: {
    code: "CSRF_REJECTED",
    message: "Missing required header"
  } }), {
    status: 403,
    headers: {
      "Content-Type": "application/json",
      ...MW_CACHE_HEADERS
    }
  });
}
function mcpUnauthorizedResponse(url, config) {
  const origin = getPublicOrigin(url, config);
  return Response.json({ error: {
    code: "NOT_AUTHENTICATED",
    message: "Not authenticated"
  } }, {
    status: 401,
    headers: {
      "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      ...MW_CACHE_HEADERS
    }
  });
}
const PUBLIC_API_PREFIXES = [
  "/_emdash/api/setup",
  "/_emdash/api/auth/login",
  "/_emdash/api/auth/register",
  "/_emdash/api/auth/dev-bypass",
  "/_emdash/api/auth/signup/",
  "/_emdash/api/auth/magic-link/",
  "/_emdash/api/auth/invite/",
  "/_emdash/api/auth/oauth/",
  "/_emdash/api/oauth/device/token",
  "/_emdash/api/oauth/device/code",
  "/_emdash/api/oauth/token",
  "/_emdash/api/oauth/register",
  "/_emdash/api/comments/",
  "/_emdash/api/media/file/",
  "/_emdash/.well-known/"
];
const PUBLIC_API_EXACT = /* @__PURE__ */ new Set([
  "/_emdash/api/auth/passkey/options",
  "/_emdash/api/auth/passkey/verify",
  "/_emdash/api/auth/mode",
  "/_emdash/api/oauth/token",
  "/_emdash/api/snapshot",
  "/_emdash/api/search"
]);
const { exact: _providerExactRoutes, prefixes: _providerPrefixRoutes } = (() => {
  const exact = /* @__PURE__ */ new Set();
  const prefixes = [];
  if (!virtualConfig?.authProviders) return {
    exact,
    prefixes
  };
  for (const route of virtualConfig.authProviders.flatMap((p) => p.publicRoutes ?? [])) if (route.endsWith("/")) prefixes.push(route);
  else exact.add(route);
  return {
    exact,
    prefixes
  };
})();
const CSRF_EXEMPT_PUBLIC_ROUTES = /* @__PURE__ */ new Set([
  "/_emdash/api/oauth/token",
  "/_emdash/api/oauth/register",
  "/_emdash/api/oauth/device/code",
  "/_emdash/api/oauth/device/token"
]);
function isPublicEmDashRoute(pathname) {
  if (PUBLIC_API_EXACT.has(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (_providerExactRoutes.has(pathname)) return true;
  if (_providerPrefixRoutes.some((p) => pathname.startsWith(p))) return true;
  return false;
}
function isCsrfExemptPublicRoute(pathname) {
  return CSRF_EXEMPT_PUBLIC_ROUTES.has(pathname);
}
const onRequest$2 = defineMiddleware(async (context, next) => {
  const { url } = context;
  const isAdminRoute = url.pathname.startsWith("/_emdash/admin");
  const isSetupRoute = url.pathname.startsWith("/_emdash/admin/setup");
  const isApiRoute = url.pathname.startsWith("/_emdash/api");
  const isPublicApiRoute = isPublicEmDashRoute(url.pathname);
  const isPublicRoute = !isAdminRoute && !isApiRoute;
  if (isPublicApiRoute) {
    if (isUnsafeMethod(context.request.method.toUpperCase()) && !isCsrfExemptPublicRoute(url.pathname)) {
      const publicOrigin = getPublicOrigin(url, context.locals.emdash?.config);
      const csrfError = checkPublicCsrf(context.request, url, publicOrigin);
      if (csrfError) return csrfError;
    }
    return next();
  }
  if (url.pathname.startsWith("/_emdash/api/plugins/")) {
    const method2 = context.request.method.toUpperCase();
    if (method2 !== "GET" && method2 !== "HEAD" && method2 !== "OPTIONS") {
      const publicOrigin = getPublicOrigin(url, context.locals.emdash?.config);
      const csrfError = checkPublicCsrf(context.request, url, publicOrigin);
      if (csrfError) return csrfError;
    }
    return handlePluginRouteAuth(context, next);
  }
  if (isSetupRoute) {
    const method2 = context.request.method.toUpperCase();
    if (method2 !== "GET" && method2 !== "HEAD" && method2 !== "OPTIONS") {
      if (context.request.headers.get("X-EmDash-Request") !== "1") return new Response(JSON.stringify({ error: {
        code: "CSRF_REJECTED",
        message: "Missing required header"
      } }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          ...MW_CACHE_HEADERS
        }
      });
    }
    return next();
  }
  if (isPublicRoute) return handlePublicRouteAuth(context, next);
  const bearerResult = await handleBearerAuth(context);
  if (bearerResult === "invalid") {
    const headers = {
      "Content-Type": "application/json",
      ...MW_CACHE_HEADERS
    };
    if (url.pathname === "/_emdash/api/mcp") headers["WWW-Authenticate"] = `Bearer resource_metadata="${getPublicOrigin(url, context.locals.emdash?.config)}/.well-known/oauth-protected-resource"`;
    return new Response(JSON.stringify({ error: {
      code: "INVALID_TOKEN",
      message: "Invalid or expired token"
    } }), {
      status: 401,
      headers
    });
  }
  const isTokenAuth = bearerResult === "authenticated";
  const method = context.request.method.toUpperCase();
  if (url.pathname === MCP_ENDPOINT_PATH && !isTokenAuth) return mcpUnauthorizedResponse(url, context.locals.emdash?.config);
  const isOAuthConsent = url.pathname.startsWith("/_emdash/oauth/authorize");
  if (isApiRoute && !isTokenAuth && !isOAuthConsent && isUnsafeMethod(method) && !isPublicApiRoute) {
    if (context.request.headers.get("X-EmDash-Request") !== "1") return csrfRejectedResponse();
  }
  if (isTokenAuth) {
    const scopeError = enforceTokenScope(url.pathname, method, context.locals.tokenScopes);
    if (scopeError) return scopeError;
    const response2 = await next();
    response2.headers.set("Content-Security-Policy", buildEmDashCsp());
    return response2;
  }
  const response = await handleEmDashAuth(context, next);
  response.headers.set("Content-Security-Policy", buildEmDashCsp());
  return response;
});
async function handleEmDashAuth(context, next) {
  const { url, locals } = context;
  const { emdash } = locals;
  const isPublicAdminRoute = url.pathname.startsWith("/_emdash/admin/login") || url.pathname.startsWith("/_emdash/admin/invite/accept");
  const isApiRoute = url.pathname.startsWith("/_emdash/api");
  if (!emdash?.db) return next();
  const authMode = getAuthMode(emdash.config);
  if (authMode.type === "external") {
    return handleExternalAuth(context, next, authMode);
  }
  if (isPublicAdminRoute) return next();
  return handlePasskeyAuth(context, next, isApiRoute);
}
async function handlePluginRouteAuth(context, next) {
  const { locals } = context;
  const { emdash } = locals;
  try {
    const bearerResult = await handleBearerAuth(context);
    if (bearerResult === "authenticated") return next();
    if (bearerResult === "invalid") return new Response(JSON.stringify({ error: {
      code: "INVALID_TOKEN",
      message: "Invalid or expired token"
    } }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...MW_CACHE_HEADERS
      }
    });
  } catch (error) {
    console.error("Plugin route bearer auth error:", error);
  }
  try {
    const { session } = context;
    const sessionUser = await session?.get("user");
    if (sessionUser?.id && emdash?.db) {
      const user = await createKyselyAdapter(emdash.db).getUserById(sessionUser.id);
      if (user && !user.disabled) locals.user = user;
    }
  } catch (error) {
    console.error("Plugin route session auth error:", error);
  }
  return next();
}
async function handlePublicRouteAuth(context, next) {
  const { locals, session } = context;
  const { emdash } = locals;
  try {
    const sessionUser = await session?.get("user");
    if (sessionUser?.id && emdash?.db) {
      const user = await createKyselyAdapter(emdash.db).getUserById(sessionUser.id);
      if (user && !user.disabled) locals.user = user;
    }
  } catch {
  }
  return next();
}
async function handleExternalAuth(context, next, authMode, _isApiRoute) {
  const { locals, request } = context;
  const { emdash } = locals;
  try {
    if (typeof authenticate !== "function") throw new Error(`Auth provider ${authMode.entrypoint} does not export an authenticate function`);
    const authResult = await authenticate(request, authMode.config);
    const externalConfig = authMode.config;
    const adapter = createKyselyAdapter(emdash.db);
    let user = await adapter.getUserByEmail(authResult.email);
    if (!user) {
      if (externalConfig.autoProvision === false) return new Response("User not authorized", {
        status: 403,
        headers: {
          "Content-Type": "text/plain",
          ...MW_CACHE_HEADERS
        }
      });
      const userCount = await emdash.db.selectFrom("users").select(emdash.db.fn.count("id").as("count")).executeTakeFirst();
      const isFirstUser = Number(userCount?.count ?? 0) === 0;
      const role = isFirstUser ? ROLE_ADMIN : authResult.role;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const newUser = {
        id: ulid(),
        email: authResult.email,
        name: authResult.name,
        role,
        email_verified: 1,
        created_at: now,
        updated_at: now
      };
      await emdash.db.insertInto("users").values(newUser).execute();
      user = await adapter.getUserByEmail(authResult.email);
      console.log(`[external-auth] Provisioned user: ${authResult.email} (role: ${role}, first: ${isFirstUser})`);
    } else {
      const updates = {};
      let newName;
      let newRole;
      if (authResult.name && user.name !== authResult.name) {
        newName = authResult.name;
        updates.name = newName;
      }
      if (externalConfig.syncRoles && user.role !== authResult.role) {
        newRole = authResult.role;
        updates.role = newRole;
      }
      if (Object.keys(updates).length > 0) {
        updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        await emdash.db.updateTable("users").set(updates).where("id", "=", user.id).execute();
        user = {
          ...user,
          ...newName ? { name: newName } : {},
          ...newRole ? { role: newRole } : {}
        };
        console.log(`[external-auth] Updated user ${authResult.email}:`, Object.keys(updates).filter((k) => k !== "updated_at"));
      }
    }
    if (!user) return new Response("Failed to provision user", {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
        ...MW_CACHE_HEADERS
      }
    });
    if (user.disabled) return new Response("Account disabled", {
      status: 403,
      headers: {
        "Content-Type": "text/plain",
        ...MW_CACHE_HEADERS
      }
    });
    locals.user = user;
    const { session } = context;
    session?.set("user", { id: user.id });
    return next();
  } catch (error) {
    console.error("[external-auth] Auth error:", error);
    return new Response("Authentication failed", {
      status: 401,
      headers: {
        "Content-Type": "text/plain",
        ...MW_CACHE_HEADERS
      }
    });
  }
}
async function handleBearerAuth(context) {
  const authHeader = context.request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return "none";
  const token = authHeader.slice(7);
  if (!token) return "none";
  const { locals } = context;
  const { emdash } = locals;
  if (!emdash?.db) return "none";
  let resolved = null;
  if (token.startsWith("ec_pat_")) resolved = await resolveApiToken(emdash.db, token);
  else if (token.startsWith("ec_oat_")) resolved = await resolveOAuthToken(emdash.db, token);
  else return "invalid";
  if (!resolved) return "invalid";
  const user = await createKyselyAdapter(emdash.db).getUserById(resolved.userId);
  if (!user || user.disabled) return "invalid";
  locals.user = user;
  locals.tokenScopes = resolved.scopes;
  return "authenticated";
}
async function handlePasskeyAuth(context, next, isApiRoute) {
  const { url, locals, session } = context;
  const { emdash } = locals;
  try {
    const sessionUser = await session?.get("user");
    if (!sessionUser?.id) {
      if (isApiRoute) return Response.json({ error: {
        code: "NOT_AUTHENTICATED",
        message: "Not authenticated"
      } }, {
        status: 401,
        headers: MW_CACHE_HEADERS
      });
      const loginUrl = new URL("/_emdash/admin/login", getPublicOrigin(url, emdash?.config));
      loginUrl.searchParams.set("redirect", url.pathname);
      return context.redirect(loginUrl.toString());
    }
    const user = await createKyselyAdapter(emdash.db).getUserById(sessionUser.id);
    if (!user) {
      session?.destroy();
      if (isApiRoute) return Response.json({ error: {
        code: "NOT_FOUND",
        message: "User not found"
      } }, {
        status: 401,
        headers: MW_CACHE_HEADERS
      });
      const loginUrl = new URL("/_emdash/admin/login", getPublicOrigin(url, emdash?.config));
      return context.redirect(loginUrl.toString());
    }
    if (user.disabled) {
      session?.destroy();
      if (isApiRoute) return apiError("ACCOUNT_DISABLED", "Account disabled", 403);
      const loginUrl = new URL("/_emdash/admin/login", getPublicOrigin(url, emdash?.config));
      loginUrl.searchParams.set("error", "account_disabled");
      return context.redirect(loginUrl.toString());
    }
    locals.user = user;
  } catch (error) {
    console.error("Auth middleware error:", error);
    return context.redirect("/_emdash/admin/login");
  }
  return next();
}
const SCOPE_RULES = [
  [
    "/_emdash/api/content",
    "GET",
    "content:read"
  ],
  [
    "/_emdash/api/content",
    "WRITE",
    "content:write"
  ],
  [
    "/_emdash/api/media/file",
    "*",
    "media:read"
  ],
  [
    "/_emdash/api/media",
    "GET",
    "media:read"
  ],
  [
    "/_emdash/api/media",
    "WRITE",
    "media:write"
  ],
  [
    "/_emdash/api/schema",
    "GET",
    "schema:read"
  ],
  [
    "/_emdash/api/schema",
    "WRITE",
    "schema:write"
  ],
  [
    "/_emdash/api/taxonomies",
    "GET",
    "content:read"
  ],
  [
    "/_emdash/api/taxonomies",
    "WRITE",
    "taxonomies:manage"
  ],
  [
    "/_emdash/api/menus",
    "GET",
    "content:read"
  ],
  [
    "/_emdash/api/menus",
    "WRITE",
    "menus:manage"
  ],
  [
    "/_emdash/api/sections",
    "GET",
    "content:read"
  ],
  [
    "/_emdash/api/sections",
    "WRITE",
    "content:write"
  ],
  [
    "/_emdash/api/widget-areas",
    "GET",
    "content:read"
  ],
  [
    "/_emdash/api/widget-areas",
    "WRITE",
    "content:write"
  ],
  [
    "/_emdash/api/revisions",
    "GET",
    "content:read"
  ],
  [
    "/_emdash/api/revisions",
    "WRITE",
    "content:write"
  ],
  [
    "/_emdash/api/search",
    "GET",
    "content:read"
  ],
  [
    "/_emdash/api/search",
    "WRITE",
    "admin"
  ],
  [
    "/_emdash/api/import",
    "*",
    "admin"
  ],
  [
    "/_emdash/api/admin",
    "*",
    "admin"
  ],
  [
    "/_emdash/api/plugins",
    "*",
    "admin"
  ],
  [
    "/_emdash/api/settings",
    "GET",
    "settings:read"
  ],
  [
    "/_emdash/api/settings",
    "WRITE",
    "settings:manage"
  ],
  [
    "/_emdash/api/mcp",
    "*",
    "content:read"
  ]
];
const WRITE_METHODS = /* @__PURE__ */ new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE"
]);
function enforceTokenScope(pathname, method, tokenScopes) {
  if (!tokenScopes) return null;
  const isWrite = WRITE_METHODS.has(method);
  for (const [prefix, ruleMethod, scope] of SCOPE_RULES) {
    if (pathname !== prefix && !pathname.startsWith(prefix + "/")) continue;
    if (ruleMethod === "*" || ruleMethod === "WRITE" && isWrite || ruleMethod === method) {
      if (hasScope(tokenScopes, scope)) return null;
      return new Response(JSON.stringify({ error: {
        code: "INSUFFICIENT_SCOPE",
        message: `Token lacks required scope: ${scope}`
      } }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          ...MW_CACHE_HEADERS
        }
      });
    }
  }
  if (hasScope(tokenScopes, "admin")) return null;
  return new Response(JSON.stringify({ error: {
    code: "INSUFFICIENT_SCOPE",
    message: "Token lacks required scope: admin"
  } }), {
    status: 403,
    headers: {
      "Content-Type": "application/json",
      ...MW_CACHE_HEADERS
    }
  });
}

//#region src/visual-editing/toolbar.ts
function renderToolbar(config) {
	const { editMode, isPreview } = config;
	return `
<!-- EmDash Visual Editing Toolbar -->
<div id="emdash-toolbar" data-edit-mode="${editMode}" data-preview="${isPreview}">
  <div class="emdash-tb-inner">
    <span class="emdash-tb-logo">EmDash</span>

    <div class="emdash-tb-divider"></div>

    <label class="emdash-tb-toggle" title="Toggle edit mode">
      <input type="checkbox" id="emdash-edit-toggle" ${editMode ? "checked" : ""} />
      <span class="emdash-tb-toggle-track">
        <span class="emdash-tb-toggle-thumb"></span>
      </span>
      <span class="emdash-tb-toggle-label">Edit</span>
    </label>

    <span class="emdash-tb-status" id="emdash-tb-status"></span>

    <span class="emdash-tb-save-status" id="emdash-tb-save-status"></span>

    <a class="emdash-tb-admin" id="emdash-tb-admin" href="#" target="emdash-admin" style="display:none" title="Open in admin">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </a>

    <button class="emdash-tb-publish" id="emdash-tb-publish" style="display:none">Publish</button>
  </div>
</div>

<style>
  #emdash-toolbar {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    line-height: 1;
    -webkit-font-smoothing: antialiased;
  }

  .emdash-tb-inner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: #1a1a1a;
    color: #e0e0e0;
    border-radius: 999px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08);
    white-space: nowrap;
    user-select: none;
  }

  .emdash-tb-logo {
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.02em;
    color: #fff;
    opacity: 0.7;
  }

  .emdash-tb-divider {
    width: 1px;
    height: 16px;
    background: rgba(255,255,255,0.15);
  }

  /* Toggle switch */
  .emdash-tb-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .emdash-tb-toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .emdash-tb-toggle-track {
    position: relative;
    width: 32px;
    height: 18px;
    background: #444;
    border-radius: 9px;
    transition: background 0.2s;
  }

  .emdash-tb-toggle input:checked + .emdash-tb-toggle-track {
    background: #3b82f6;
  }

  .emdash-tb-toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .emdash-tb-toggle input:checked + .emdash-tb-toggle-track .emdash-tb-toggle-thumb {
    transform: translateX(14px);
  }

  .emdash-tb-toggle-label {
    font-size: 12px;
    color: #aaa;
  }

  .emdash-tb-toggle input:checked ~ .emdash-tb-toggle-label {
    color: #fff;
  }

  /* Status area — flex for multiple badges */
  .emdash-tb-status {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  /* Badges */
  .emdash-tb-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .emdash-tb-badge--preview {
    background: rgba(139,92,246,0.2);
    color: #a78bfa;
  }

  .emdash-tb-badge--draft {
    background: rgba(245,158,11,0.2);
    color: #fbbf24;
  }

  .emdash-tb-badge--published {
    background: rgba(34,197,94,0.2);
    color: #4ade80;
  }

  .emdash-tb-badge--pending {
    background: rgba(59,130,246,0.2);
    color: #60a5fa;
  }

  .emdash-tb-badge--unsaved {
    background: rgba(245,158,11,0.2);
    color: #fbbf24;
  }

  .emdash-tb-badge--saving {
    background: rgba(148,163,184,0.2);
    color: #94a3b8;
  }

  .emdash-tb-badge--saved {
    background: rgba(34,197,94,0.2);
    color: #4ade80;
    transition: opacity 0.3s;
  }

  .emdash-tb-badge--error {
    background: rgba(239,68,68,0.2);
    color: #f87171;
  }

  /* Admin link */
  .emdash-tb-admin {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #888;
    text-decoration: none;
    padding: 2px;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .emdash-tb-admin:hover {
    color: #fff;
  }

  /* Publish button */
  .emdash-tb-publish {
    padding: 4px 12px;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
  }

  .emdash-tb-publish:hover {
    background: #2563eb;
  }

  .emdash-tb-publish:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Edit mode: editable hover styles — uses :has() to check toolbar state */
  body:has(#emdash-toolbar[data-edit-mode="true"]) [data-emdash-ref] {
    transition: box-shadow 0.15s, background-color 0.15s;
  }

  body:has(#emdash-toolbar[data-edit-mode="true"]) [data-emdash-ref]:hover {
    box-shadow: 0 0 0 2px rgba(59,130,246,0.5);
    border-radius: 4px;
    background-color: rgba(59,130,246,0.04);
    cursor: text;
  }

  /* Active editing state — override hover pencil cursor */
  [data-emdash-editing] {
    box-shadow: 0 0 0 2px #3b82f6 !important;
    border-radius: 4px !important;
    background-color: rgba(59,130,246,0.04) !important;
    cursor: text !important;
  }

  /* Suppress browser focus ring on contenteditable and tiptap editor */
  [data-emdash-editing]:focus,
  [data-emdash-ref] .tiptap:focus,
  [data-emdash-ref] .ProseMirror:focus {
    outline: none !important;
  }

  /* Image editor popover */
  .emdash-img-popover {
    position: fixed;
    z-index: 1000000;
    background: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08);
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    width: 320px;
    overflow: hidden;
    animation: emdash-img-fadein 0.15s ease-out;
  }

  @keyframes emdash-img-fadein {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .emdash-img-popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }

  .emdash-img-popover-title {
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
  }

  .emdash-img-popover-close {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    padding: 2px;
    line-height: 1;
    font-size: 16px;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .emdash-img-popover-close:hover {
    color: #fff;
  }

  .emdash-img-popover-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .emdash-img-preview {
    width: 100%;
    max-height: 160px;
    object-fit: contain;
    border-radius: 6px;
    background: #111;
  }

  .emdash-img-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    border: 2px dashed rgba(255,255,255,0.15);
    border-radius: 6px;
    color: #666;
    font-size: 12px;
  }

  .emdash-img-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .emdash-img-field label {
    font-size: 11px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .emdash-img-field input[type="text"] {
    background: #111;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    color: #e0e0e0;
    padding: 6px 8px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }

  .emdash-img-field input[type="text"]:focus {
    border-color: #3b82f6;
  }

  .emdash-img-actions {
    display: flex;
    gap: 6px;
  }

  .emdash-img-btn {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    background: #222;
    color: #e0e0e0;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    text-align: center;
    white-space: nowrap;
  }

  .emdash-img-btn:hover {
    background: #333;
    border-color: rgba(255,255,255,0.2);
  }

  .emdash-img-btn--primary {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
  }

  .emdash-img-btn--primary:hover {
    background: #2563eb;
    border-color: #2563eb;
  }

  .emdash-img-btn--danger {
    color: #f87171;
    border-color: rgba(248,113,113,0.3);
  }

  .emdash-img-btn--danger:hover {
    background: rgba(248,113,113,0.1);
    border-color: rgba(248,113,113,0.5);
  }

  /* Media browser within the popover */
  .emdash-img-browser {
    border-top: 1px solid rgba(255,255,255,0.08);
    padding: 12px;
  }

  .emdash-img-browser-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .emdash-img-browser-title {
    font-size: 12px;
    font-weight: 600;
    color: #999;
  }

  .emdash-img-browser-back {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    padding: 2px 4px;
  }

  .emdash-img-browser-back:hover {
    text-decoration: underline;
  }

  .emdash-img-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
  }

  .emdash-img-grid-item {
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color 0.15s;
    background: #111;
  }

  .emdash-img-grid-item:hover {
    border-color: rgba(59,130,246,0.5);
  }

  .emdash-img-grid-item--selected {
    border-color: #3b82f6;
  }

  .emdash-img-grid-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .emdash-img-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    color: #666;
    font-size: 12px;
  }

  .emdash-img-drop {
    border: 2px dashed #3b82f6;
    background: rgba(59,130,246,0.05);
  }

  .emdash-img-uploading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: #999;
    font-size: 12px;
  }

  .emdash-img-popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999999;
  }
</style>

<script>
(function() {
  var toolbar = document.getElementById("emdash-toolbar");
  var toggle = document.getElementById("emdash-edit-toggle");
  var statusEl = document.getElementById("emdash-tb-status");
  var saveStatusEl = document.getElementById("emdash-tb-save-status");
  var publishBtn = document.getElementById("emdash-tb-publish");
  if (!toolbar || !toggle || !statusEl || !publishBtn || !saveStatusEl) return;

  var isEditMode = toolbar.getAttribute("data-edit-mode") === "true";

  // CSRF-protected fetch — adds X-EmDash-Request header to all API calls
  function ecFetch(url, init) {
    init = init || {};
    init.headers = Object.assign({ "X-EmDash-Request": "1" }, init.headers || {});
    return fetch(url, init);
  }

  // --- Save status tracking ---
  var saveState = "idle"; // idle | unsaved | saving | saved | error
  var saveHideTimer = null;
  var pendingSavePromise = null;

  function setSaveState(state) {
    saveState = state;
    clearTimeout(saveHideTimer);

    switch (state) {
      case "unsaved":
        saveStatusEl.innerHTML = '<span class="emdash-tb-badge emdash-tb-badge--unsaved">Unsaved</span>';
        break;
      case "saving":
        saveStatusEl.innerHTML = '<span class="emdash-tb-badge emdash-tb-badge--saving">Saving\u2026</span>';
        break;
      case "saved":
        saveStatusEl.innerHTML = '<span class="emdash-tb-badge emdash-tb-badge--saved">Saved</span>';
        saveHideTimer = setTimeout(function() {
          saveStatusEl.innerHTML = "";
          saveState = "idle";
        }, 2000);
        break;
      case "error":
        saveStatusEl.innerHTML = '<span class="emdash-tb-badge emdash-tb-badge--error">Save failed</span>';
        saveHideTimer = setTimeout(function() {
          saveStatusEl.innerHTML = "";
          saveState = "idle";
        }, 3000);
        break;
      default:
        saveStatusEl.innerHTML = "";
    }
  }

  // Listen for save events from inline editors (e.g. PT editor)
  document.addEventListener("emdash:save", function(e) {
    var detail = e.detail || {};
    if (detail.state) {
      setSaveState(detail.state);
    }
  });

  document.addEventListener("emdash:content-changed", function(e) {
    var detail = e.detail || {};
    if (detail.collection && detail.id) {
      showUnpublishedChanges(detail.collection, detail.id);
    }
  });

  // --- Entry status ---
  var entryRef = null;

  function updateStatus() {
    if (!isEditMode) {
      statusEl.innerHTML = "";
      publishBtn.style.display = "none";
      return;
    }

    var first = document.querySelector("[data-emdash-ref]");
    if (!first) {
      statusEl.innerHTML = "";
      publishBtn.style.display = "none";
      return;
    }

    try {
      var ref = JSON.parse(first.getAttribute("data-emdash-ref"));
      entryRef = ref;
      if (!ref.status) return;

      // Show admin link
      var adminLink = document.getElementById("emdash-tb-admin");
      if (adminLink) {
        adminLink.href = "/_emdash/admin/content/" + encodeURIComponent(ref.collection) + "/" + encodeURIComponent(ref.id);
        adminLink.style.display = "";
      }

      if (ref.status === "draft") {
        statusEl.innerHTML = '<span class="emdash-tb-badge emdash-tb-badge--draft">Draft</span>';
        publishBtn.style.display = "";
        publishBtn.onclick = function() { publish(ref.collection, ref.id); };
      } else if (ref.status === "published" && ref.hasDraft) {
        statusEl.innerHTML = '<span class="emdash-tb-badge emdash-tb-badge--pending">Unpublished changes</span>';
        publishBtn.style.display = "";
        publishBtn.onclick = function() { publish(ref.collection, ref.id); };
      } else if (ref.status === "published") {
        statusEl.innerHTML = '<span class="emdash-tb-badge emdash-tb-badge--published">Published</span>';
        publishBtn.style.display = "none";
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  // Publish action
  function publish(collection, id) {
    if (pendingSavePromise) {
      pendingSavePromise.then(function() { publish(collection, id); });
      return;
    }

    publishBtn.disabled = true;
    publishBtn.textContent = "Publishing\u2026";

    ecFetch("/_emdash/api/content/" + encodeURIComponent(collection) + "/" + encodeURIComponent(id) + "/publish", {
      method: "POST",
      credentials: "same-origin",
    })
    .then(function(res) {
      if (res.ok) {
        if (document.startViewTransition) {
          document.startViewTransition(function() { location.reload(); });
        } else {
          location.reload();
        }
      } else {
        publishBtn.disabled = false;
        publishBtn.textContent = "Publish";
        console.error("Publish failed:", res.status);
      }
    })
    .catch(function(err) {
      publishBtn.disabled = false;
      publishBtn.textContent = "Publish";
      console.error("Publish failed:", err);
    });
  }

  // Edit mode toggle
  toggle.addEventListener("change", function() {
    if (toggle.checked) {
      document.cookie = "emdash-edit-mode=true;path=/;samesite=lax";
    } else {
      document.cookie = "emdash-edit-mode=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }

    if (document.startViewTransition) {
      document.startViewTransition(function() { location.replace(location.href); });
    } else {
      location.replace(location.href);
    }
  });

  // --- Inline editing ---

  // Cached manifest (fetched once on first edit click)
  var manifestCache = null;
  var manifestPromise = null;

  function fetchManifest() {
    if (manifestCache) return Promise.resolve(manifestCache);
    if (manifestPromise) return manifestPromise;
    manifestPromise = ecFetch("/_emdash/api/manifest", { credentials: "same-origin" })
      .then(function(r) { return r.json(); })
      .then(function(m) {
        // The manifest endpoint wraps the payload in a { data } envelope (ApiResponse shape).
        // Unwrap it so getFieldKind can read manifest.collections directly.
        manifestCache = m && m.data ? m.data : m;
        return manifestCache;
      });
    return manifestPromise;
  }

  function getFieldKind(manifest, collection, field) {
    var col = manifest.collections && manifest.collections[collection];
    if (!col || !col.fields) return null;
    var f = col.fields[field];
    return f ? f.kind : null;
  }

  // Load manifest early so the first click can resolve field kinds without racing the event.
  if (isEditMode) {
    fetchManifest();
  }

  // Save a single field value
  function saveField(collection, id, field, value) {
    setSaveState("saving");
    return ecFetch("/_emdash/api/content/" + encodeURIComponent(collection) + "/" + encodeURIComponent(id), {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { [field]: value } }),
    })
    .then(function(res) {
      if (res.ok) {
        setSaveState("saved");
        // A save creates/updates a draft — show unpublished changes
        showUnpublishedChanges(collection, id);
      } else {
        setSaveState("error");
        console.error("Save failed:", res.status);
      }
    })
    .catch(function(err) {
      setSaveState("error");
      console.error("Save failed:", err);
    });
  }

  function showUnpublishedChanges(collection, id) {
    statusEl.innerHTML = '<span class="emdash-tb-badge emdash-tb-badge--pending">Unpublished changes</span>';
    publishBtn.style.display = "";
    publishBtn.disabled = false;
    publishBtn.textContent = "Publish";
    publishBtn.onclick = function() { publish(collection, id); };
  }

  // Plain text inline editing (contenteditable)
  var currentlyEditing = null;

  function startTextEdit(element, annotation) {
    if (currentlyEditing === element) return;
    if (currentlyEditing) endCurrentEdit();

    currentlyEditing = element;
    var originalText = element.textContent || "";

    element.setAttribute("data-emdash-editing", "");
    element.contentEditable = "plaintext-only";
    element.focus();

    // Select all text
    var range = document.createRange();
    range.selectNodeContents(element);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Track dirty state via input events
    function handleInput() {
      var current = (element.textContent || "").trim();
      if (current !== originalText.trim()) {
        setSaveState("unsaved");
      } else {
        setSaveState("idle");
      }
    }

    function handleBlur() {
      element.removeEventListener("blur", handleBlur);
      element.removeEventListener("keydown", handleKeydown);
      element.removeEventListener("input", handleInput);
      element.contentEditable = "false";
      element.removeAttribute("data-emdash-editing");
      currentlyEditing = null;

      var newValue = (element.textContent || "").trim();
      if (newValue !== originalText.trim()) {
        pendingSavePromise = saveField(annotation.collection, annotation.id, annotation.field, newValue).then(function() {
          pendingSavePromise = null;
        }, function() {
          pendingSavePromise = null;
        });
      } else {
        setSaveState("idle");
      }
    }

    function handleKeydown(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        element.blur();
      }
      if (e.key === "Escape") {
        element.textContent = originalText;
        setSaveState("idle");
        element.blur();
      }
    }

    element.addEventListener("input", handleInput);
    element.addEventListener("blur", handleBlur);
    element.addEventListener("keydown", handleKeydown);
  }

  function endCurrentEdit() {
    if (currentlyEditing) {
      currentlyEditing.blur();
    }
  }

  // Fallback: open admin
  function openAdmin(annotation) {
    var url = "/_emdash/admin/content/" + encodeURIComponent(annotation.collection) + "/" + encodeURIComponent(annotation.id);
    if (annotation.field) {
      url += "?field=" + encodeURIComponent(annotation.field);
    }
    window.open(url, "emdash-admin");
  }

  // --- Inline image editing ---
  var activeImagePopover = null;

  function closeImagePopover() {
    if (activeImagePopover) {
      activeImagePopover.backdrop.remove();
      activeImagePopover.popover.remove();
      if (activeImagePopover.escapeHandler) {
        document.removeEventListener("keydown", activeImagePopover.escapeHandler);
      }
      activeImagePopover = null;
    }
  }

  function startImageEdit(element, annotation) {
    closeImagePopover();

    // Find the current image value by fetching the entry
    var collection = annotation.collection;
    var id = annotation.id;
    var field = annotation.field;

    // Find img element inside the annotated container (or the element itself if it's an img)
    var imgEl = element.tagName === "IMG" ? element : element.querySelector("img");

    // Fetch current field value from the content API
    ecFetch("/_emdash/api/content/" + encodeURIComponent(collection) + "/" + encodeURIComponent(id), {
      credentials: "same-origin"
    })
    .then(function(r) { return r.json(); })
    .then(function(entry) {
      var currentValue = entry.data && entry.data[field];
      showImagePopover(element, imgEl, annotation, currentValue);
    })
    .catch(function() {
      // If fetch fails, still show popover with what we can infer from DOM
      showImagePopover(element, imgEl, annotation, null);
    });
  }

  function showImagePopover(element, imgEl, annotation, currentValue) {
    closeImagePopover();

    var collection = annotation.collection;
    var id = annotation.id;
    var field = annotation.field;

    // Position near the element
    var rect = element.getBoundingClientRect();
    var viewportH = window.innerHeight;
    var viewportW = window.innerWidth;

    // Create backdrop for click-outside-to-close
    var backdrop = document.createElement("div");
    backdrop.className = "emdash-img-popover-backdrop";
    backdrop.addEventListener("click", function(e) {
      if (e.target === backdrop) closeImagePopover();
    });

    // Create popover
    var popover = document.createElement("div");
    popover.className = "emdash-img-popover";

    var currentSrc = currentValue ? (currentValue.previewUrl || currentValue.src) : (imgEl ? imgEl.src : null);
    var currentAlt = currentValue ? (currentValue.alt || "") : (imgEl ? (imgEl.alt || "") : "");

    // Build popover HTML
    var html = '';
    html += '<div class="emdash-img-popover-header">';
    html += '  <span class="emdash-img-popover-title">Image</span>';
    html += '  <button class="emdash-img-popover-close" data-action="close">&times;</button>';
    html += '</div>';
    html += '<div class="emdash-img-popover-body" id="emdash-img-main">';

    if (currentSrc) {
      html += '<img class="emdash-img-preview" src="' + escapeAttr(currentSrc) + '" alt="" />';
    } else {
      html += '<div class="emdash-img-empty">No image selected</div>';
    }

    html += '<div class="emdash-img-field">';
    html += '  <label for="emdash-img-alt">Alt text</label>';
    html += '  <input type="text" id="emdash-img-alt" value="' + escapeAttr(currentAlt) + '" placeholder="Describe the image" />';
    html += '</div>';

    html += '<div class="emdash-img-actions">';
    html += '  <button class="emdash-img-btn emdash-img-btn--primary" data-action="browse">Replace</button>';
    html += '  <label class="emdash-img-btn" style="cursor:pointer">';
    html += '    Upload';
    html += '    <input type="file" accept="image/*" id="emdash-img-upload" style="display:none" />';
    html += '  </label>';
    if (currentSrc) {
      html += '  <button class="emdash-img-btn emdash-img-btn--danger" data-action="remove">Remove</button>';
    }
    html += '</div>';
    html += '</div>';

    popover.innerHTML = html;

    backdrop.appendChild(popover);
    document.body.appendChild(backdrop);

    // Position the popover
    positionPopover(popover, rect, viewportW, viewportH);

    // Escape key handler
    function handleEscape(e) {
      if (e.key === "Escape") {
        closeImagePopover();
        document.removeEventListener("keydown", handleEscape);
      }
    }
    document.addEventListener("keydown", handleEscape);

    activeImagePopover = {
      backdrop: backdrop,
      popover: popover,
      annotation: annotation,
      currentValue: currentValue,
      element: element,
      imgEl: imgEl,
      escapeHandler: handleEscape
    };

    // Event handlers
    popover.querySelector('[data-action="close"]').addEventListener("click", closeImagePopover);

    popover.querySelector('[data-action="browse"]').addEventListener("click", function() {
      showMediaBrowser(popover, annotation, currentValue, element, imgEl);
    });

    var uploadInput = popover.querySelector("#emdash-img-upload");
    uploadInput.addEventListener("change", function(e) {
      var file = e.target.files && e.target.files[0];
      if (file) handleImageUpload(file, popover, annotation, element, imgEl);
    });

    var removeBtn = popover.querySelector('[data-action="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener("click", function() {
        saveField(collection, id, field, null).then(function() {
          if (imgEl) {
            imgEl.style.display = "none";
          }
          closeImagePopover();
        });
      });
    }

    // Save alt text on change (debounced)
    var altInput = popover.querySelector("#emdash-img-alt");
    var altTimer = null;
    altInput.addEventListener("input", function() {
      clearTimeout(altTimer);
      altTimer = setTimeout(function() {
        var newAlt = altInput.value;
        if (currentValue) {
          var updated = Object.assign({}, currentValue, { alt: newAlt });
          saveField(collection, id, field, updated);
          if (imgEl) imgEl.alt = newAlt;
        }
      }, 500);
    });

    // Handle drag and drop on the popover body
    var body = popover.querySelector(".emdash-img-popover-body");
    body.addEventListener("dragover", function(e) {
      e.preventDefault();
      body.classList.add("emdash-img-drop");
    });
    body.addEventListener("dragleave", function() {
      body.classList.remove("emdash-img-drop");
    });
    body.addEventListener("drop", function(e) {
      e.preventDefault();
      body.classList.remove("emdash-img-drop");
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        handleImageUpload(file, popover, annotation, element, imgEl);
      }
    });
  }

  function positionPopover(popover, targetRect, viewportW, viewportH) {
    var popoverW = 320;
    var gap = 8;

    // Try to place to the right of the element
    var left = targetRect.right + gap;
    var top = targetRect.top;

    // If it overflows right, place to the left
    if (left + popoverW > viewportW - 16) {
      left = targetRect.left - popoverW - gap;
    }
    // If it still overflows (narrow viewport), center below
    if (left < 16) {
      left = Math.max(16, (viewportW - popoverW) / 2);
      top = targetRect.bottom + gap;
    }
    // Clamp vertically
    if (top + 400 > viewportH - 80) { // 80 for toolbar
      top = Math.max(16, viewportH - 480);
    }
    if (top < 16) top = 16;

    popover.style.left = left + "px";
    popover.style.top = top + "px";
  }

  function escapeAttr(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showMediaBrowser(popover, annotation, currentValue, element, imgEl) {
    var mainBody = popover.querySelector("#emdash-img-main");
    if (mainBody) mainBody.style.display = "none";

    // Remove existing browser if any
    var existing = popover.querySelector(".emdash-img-browser");
    if (existing) existing.remove();

    var browser = document.createElement("div");
    browser.className = "emdash-img-browser";

    browser.innerHTML = '<div class="emdash-img-browser-header">' +
      '<span class="emdash-img-browser-title">Media Library</span>' +
      '<button class="emdash-img-browser-back">Back</button>' +
      '</div>' +
      '<div class="emdash-img-loading">Loading\u2026</div>';

    popover.appendChild(browser);

    browser.querySelector(".emdash-img-browser-back").addEventListener("click", function() {
      browser.remove();
      if (mainBody) mainBody.style.display = "";
    });

    // Fetch media
    ecFetch("/_emdash/api/media?mimeType=image/&limit=30", { credentials: "same-origin" })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var items = data.items || [];
      var loadingEl = browser.querySelector(".emdash-img-loading");
      if (loadingEl) loadingEl.remove();

      if (items.length === 0) {
        var empty = document.createElement("div");
        empty.className = "emdash-img-loading";
        empty.textContent = "No images found";
        browser.appendChild(empty);
        return;
      }

      var grid = document.createElement("div");
      grid.className = "emdash-img-grid";

      items.forEach(function(item) {
        var thumb = document.createElement("div");
        thumb.className = "emdash-img-grid-item";
        if (currentValue && currentValue.id === item.id) {
          thumb.classList.add("emdash-img-grid-item--selected");
        }
        var thumbUrl = item.url || item.previewUrl || ("/_emdash/api/media/file/" + item.storageKey);
        thumb.innerHTML = '<img src="' + escapeAttr(thumbUrl) + '" alt="' + escapeAttr(item.alt || item.filename || "") + '" loading="lazy" />';

        thumb.addEventListener("click", function() {
          selectMediaItem(item, annotation, element, imgEl);
        });

        grid.appendChild(thumb);
      });

      browser.appendChild(grid);
    })
    .catch(function(err) {
      var loadingEl = browser.querySelector(".emdash-img-loading");
      if (loadingEl) loadingEl.textContent = "Failed to load media";
      console.error("Media fetch error:", err);
    });
  }

  function selectMediaItem(item, annotation, element, imgEl) {
    var collection = annotation.collection;
    var id = annotation.id;
    var field = annotation.field;

    var isLocal = !item.provider || item.provider === "local";
    var itemUrl = item.url || item.previewUrl || ("/_emdash/api/media/file/" + item.storageKey);

    var newValue = {
      id: item.id,
      provider: item.provider || "local",
      src: isLocal ? itemUrl : undefined,
      previewUrl: isLocal ? undefined : itemUrl,
      alt: item.alt || "",
      width: item.width,
      height: item.height,
      meta: item.meta
    };

    // Clean undefined fields
    Object.keys(newValue).forEach(function(k) {
      if (newValue[k] === undefined) delete newValue[k];
    });

    saveField(collection, id, field, newValue).then(function() {
      // Update the image in the DOM
      if (imgEl) {
        imgEl.src = itemUrl;
        imgEl.alt = item.alt || "";
        imgEl.style.display = "";
      }
      closeImagePopover();
    });
  }

  function handleImageUpload(file, popover, annotation, element, imgEl) {
    var collection = annotation.collection;
    var id = annotation.id;
    var field = annotation.field;

    // Show uploading state
    var mainBody = popover.querySelector("#emdash-img-main");
    var browserEl = popover.querySelector(".emdash-img-browser");
    if (browserEl) browserEl.remove();
    if (mainBody) {
      mainBody.innerHTML = '<div class="emdash-img-uploading">' +
        '<span>Uploading ' + escapeAttr(file.name) + '\u2026</span>' +
        '</div>';
      mainBody.style.display = "";
    }

    // Detect dimensions before upload
    var dimPromise = new Promise(function(resolve) {
      if (!file.type.startsWith("image/")) return resolve({});
      var img = new Image();
      img.onload = function() {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function() {
        resolve({});
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });

    dimPromise.then(function(dims) {
      // Generate a thumbnail for large images to avoid OOM in server-side
      // blurhash generation on memory-constrained runtimes (Workers).
      // Thumbnail fits within a 64x64 box (scale by max dimension) so that
      // extreme aspect ratios don't explode into a huge canvas client-side.
      var thumbPromise;
      if (dims.width && dims.height && dims.width * dims.height * 4 > 32 * 1024 * 1024) {
        thumbPromise = new Promise(function(resolve) {
          try {
            var maxDim = Math.max(dims.width, dims.height);
            var scale = Math.min(1, 64 / maxDim);
            var thumbW = Math.max(1, Math.round(dims.width * scale));
            var thumbH = Math.max(1, Math.round(dims.height * scale));
            var canvas = document.createElement("canvas");
            canvas.width = thumbW;
            canvas.height = thumbH;
            var ctx = canvas.getContext("2d");
            if (ctx) {
              var img = new Image();
              img.onload = function() {
                try {
                  ctx.drawImage(img, 0, 0, thumbW, thumbH);
                  canvas.toBlob(function(blob) {
                    URL.revokeObjectURL(img.src);
                    resolve(blob);
                  }, "image/png");
                } catch (e) {
                  URL.revokeObjectURL(img.src);
                  resolve(null);
                }
              };
              img.onerror = function() {
                URL.revokeObjectURL(img.src);
                resolve(null);
              };
              img.src = URL.createObjectURL(file);
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      } else {
        thumbPromise = Promise.resolve(null);
      }

      return thumbPromise.then(function(thumbnail) {
        var formData = new FormData();
        formData.append("file", file);
        if (dims.width) formData.append("width", String(dims.width));
        if (dims.height) formData.append("height", String(dims.height));
        if (thumbnail) formData.append("thumbnail", thumbnail, "thumb.png");

        return ecFetch("/_emdash/api/media", {
          method: "POST",
          credentials: "same-origin",
          body: formData
        });
      });
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.item) throw new Error("Upload failed");
      var item = data.item;
      selectMediaItem(item, annotation, element, imgEl);
    })
    .catch(function(err) {
      console.error("Upload error:", err);
      setSaveState("error");
      closeImagePopover();
    });
  }

  // Click handler for edit mode
  if (isEditMode) {
    document.addEventListener("click", function(e) {
      var target = e.target;

      // Don't intercept clicks on elements currently being edited
      if (target.hasAttribute && target.hasAttribute("data-emdash-editing")) return;

      // Walk up to find annotated element
      while (target && target !== document.body) {
        if (target.hasAttribute && target.hasAttribute("data-emdash-editing")) return;

        var ref = target.getAttribute && target.getAttribute("data-emdash-ref");
        if (ref) {
          try {
            var annotation = JSON.parse(ref);

            // Entry-level annotation (no field) — keep walking for a field-level ancestor
            if (!annotation.field) {
              target = target.parentElement;
              continue;
            }

            function dispatchInline(kind) {
              closeImagePopover();
              // Portable Text is edited in-page by InlinePortableTextEditor — do not open admin
              if (kind === "portableText") {
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              if (kind === "string" || kind === "text") {
                startTextEdit(target, annotation);
              } else if (kind === "image") {
                startImageEdit(target, annotation);
              } else {
                openAdmin(annotation);
              }
            }

            if (manifestCache) {
              dispatchInline(getFieldKind(manifestCache, annotation.collection, annotation.field));
            } else {
              fetchManifest().then(function(manifest) {
                dispatchInline(getFieldKind(manifest, annotation.collection, annotation.field));
              });
            }
          } catch (err) {
            console.error("Failed to parse emdash ref:", err);
          }
          return;
        }
        target = target.parentElement;
      }
    }, true);
  }

  updateStatus();
})();
<\/script>
`;
}

//#endregion
//#region src/astro/middleware/request-context.ts
/**
* EmDash Request Context Middleware
*
* Sets up AsyncLocalStorage-based request context for query functions.
* Skips ALS entirely for logged-out users with no CMS signals (fast path).
*
* Handles:
* - Preview tokens: _preview query param with signed HMAC token
* - Edit mode: emdash-edit-mode cookie (for visual editing)
* - Toolbar injection: floating pill for authenticated editors
*/
/**
* Inject toolbar HTML into a response if it's an HTML page.
* Returns the original response if not HTML.
*/
async function injectToolbar(response, toolbarHtml) {
	if (!response.headers.get("content-type")?.includes("text/html")) return response;
	const html = await response.text();
	if (!html.includes("</body>")) return new Response(html, response);
	const injected = html.replace("</body>", `${toolbarHtml}</body>`);
	return new Response(injected, {
		status: response.status,
		headers: response.headers
	});
}
const onRequest$1 = defineMiddleware(async (context, next) => {
	const { cookies, url } = context;
	if (url.pathname.startsWith("/_emdash")) return next();
	const { user } = context.locals;
	const isEditor = !!user && user.role >= 30;
	const playgroundDb = context.locals.__playgroundDb;
	if (playgroundDb) return runWithContext({
		editMode: cookies.get("emdash-edit-mode")?.value === "true",
		db: playgroundDb,
		dbIsIsolated: true
	}, () => next());
	const hasEditCookie = cookies.get("emdash-edit-mode")?.value === "true";
	const hasPreviewToken = url.searchParams.has("_preview");
	if (!hasEditCookie && !hasPreviewToken && !isEditor) return next();
	const editMode = hasEditCookie && isEditor;
	const locale = context.currentLocale;
	let preview;
	if (hasPreviewToken) {
		const db = context.locals.emdash?.db;
		if (db) {
			const { previewSecret } = await resolveSecretsCached(db);
			const result = await verifyPreviewToken({
				url,
				secret: previewSecret
			});
			if (result.valid) {
				const { collection, id } = parseContentId(result.payload.cid);
				preview = {
					collection,
					id
				};
			}
		} else console.warn("[emdash] Preview token present but EmDash runtime not initialized; preview disabled.");
	}
	if (hasEditCookie || hasPreviewToken) return runWithContext({
		...getRequestContext(),
		editMode,
		preview,
		locale
	}, async () => {
		let response = await next();
		if (preview) {
			response = new Response(response.body, response);
			response.headers.set("Cache-Control", "private, no-store");
		}
		if (isEditor) {
			const toolbarHtml = renderToolbar({
				editMode,
				isPreview: !!preview
			});
			return injectToolbar(response, toolbarHtml);
		}
		return response;
	});
	if (isEditor) return injectToolbar(await next(), renderToolbar({
		editMode: false,
		isPreview: false
	}));
	return next();
});

const onRequest = sequence(
	onRequest$5,onRequest$4,onRequest$3,onRequest$2,onRequest$1,
	
	
);

export { onRequest };
