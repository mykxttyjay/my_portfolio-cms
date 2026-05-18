import { sql } from 'kysely';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { I as wpRewriteUrlsBody } from './redirects_jp1t_nEU.mjs';
import { v as validateIdentifier } from './validate_AseaonR5.mjs';

const INTERNAL_MEDIA_PREFIX = "/_emdash/api/media/file/";
const URL_PATTERN = /^https?:\/\//;
async function normalizeMediaValue(value, getProvider) {
  if (value == null) return null;
  if (typeof value === "string") {
    return normalizeStringUrl(value, getProvider);
  }
  if (!isRecord(value)) return null;
  if (!("id" in value) && !("src" in value)) return null;
  const provider = (typeof value.provider === "string" ? value.provider : void 0) || "local";
  const id = typeof value.id === "string" ? value.id : "";
  if (provider === "external") {
    return recordToMediaValue(value);
  }
  const result = { ...recordToMediaValue(value), provider };
  if (provider === "local") {
    delete result.src;
  }
  const needsDimensions = result.width == null || result.height == null;
  const needsStorageKey = provider === "local" && !result.meta?.storageKey;
  const needsFileInfo = !result.mimeType || !result.filename;
  const needsLookup = needsDimensions || needsStorageKey || needsFileInfo;
  if (!needsLookup || !id) return result;
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
  if (url.startsWith(INTERNAL_MEDIA_PREFIX)) {
    return resolveInternalUrl(url, getProvider);
  }
  if (URL_PATTERN.test(url)) {
    return Promise.resolve({
      provider: "external",
      id: "",
      src: url
    });
  }
  return Promise.resolve({
    provider: "external",
    id: "",
    src: url
  });
}
async function resolveInternalUrl(url, getProvider) {
  const storageKey = url.slice(INTERNAL_MEDIA_PREFIX.length);
  const localProvider = getProvider("local");
  if (!localProvider?.get) {
    return { provider: "external", id: "", src: url };
  }
  let item;
  try {
    item = await localProvider.get(storageKey);
  } catch {
    return { provider: "external", id: "", src: url };
  }
  if (!item) {
    return { provider: "external", id: "", src: url };
  }
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
function mergeProviderData(existing, item) {
  const result = { ...existing };
  if (result.width == null && item.width != null) result.width = item.width;
  if (result.height == null && item.height != null) result.height = item.height;
  if (!result.filename && item.filename) result.filename = item.filename;
  if (!result.mimeType && item.mimeType) result.mimeType = item.mimeType;
  if (!result.alt && item.alt) result.alt = item.alt;
  if (item.meta) {
    result.meta = { ...item.meta, ...result.meta };
  }
  return result;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function recordToMediaValue(obj) {
  const result = {
    id: typeof obj.id === "string" ? obj.id : ""
  };
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

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
const WORDPRESS_IMAGE_SIZE_SUFFIX = /-\d+x\d+(?=\.[^./?#]+$)/;
const BASE_URL_EXTENSION = /^(.+)(\.[^./?#]+)$/;
function getBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0] || url;
  }
}
function buildBaseUrlMap(urlMap) {
  const baseMap = /* @__PURE__ */ new Map();
  for (const [oldUrl, newUrl] of Object.entries(urlMap)) {
    const baseUrl = getBaseUrl(oldUrl);
    baseMap.set(baseUrl, newUrl);
  }
  return baseMap;
}
function findMatchingUrl(url, exactMap, baseMap) {
  if (exactMap[url]) {
    return exactMap[url];
  }
  const baseUrl = getBaseUrl(url);
  const baseMatch = baseMap.get(baseUrl);
  if (baseMatch) {
    return baseMatch;
  }
  const wordPressImageMatch = baseMap.get(stripWordPressImageSizeSuffix(baseUrl));
  if (wordPressImageMatch) {
    return wordPressImageMatch;
  }
  return null;
}
function rewritePortableTextUrls(blocks, exactMap, baseMap) {
  let changed = false;
  let urlsRewritten = 0;
  for (const block of blocks) {
    if (block._type === "image" && block.asset?.url) {
      const newUrl = findMatchingUrl(block.asset.url, exactMap, baseMap);
      if (newUrl) {
        block.asset.url = newUrl;
        block.asset._ref = newUrl;
        changed = true;
        urlsRewritten++;
      }
    }
    if (block._type === "image" && block.link) {
      const newUrl = findMatchingUrl(block.link, exactMap, baseMap);
      if (newUrl) {
        block.link = newUrl;
        changed = true;
        urlsRewritten++;
      }
    }
    if (block._type === "gallery" && Array.isArray(block.images)) {
      const result = rewritePortableTextUrls(block.images, exactMap, baseMap);
      if (result.changed) {
        changed = true;
        urlsRewritten += result.urlsRewritten;
      }
    }
    if (block._type === "columns" && Array.isArray(block.columns)) {
      for (const column of block.columns) {
        if (Array.isArray(column.content)) {
          const result = rewritePortableTextUrls(column.content, exactMap, baseMap);
          if (result.changed) {
            changed = true;
            urlsRewritten += result.urlsRewritten;
          }
        }
      }
    }
  }
  return { changed, urlsRewritten };
}
function rewriteStringUrls(value, exactMap, baseMap) {
  let newValue = value;
  let changed = false;
  let urlsRewritten = 0;
  for (const [oldUrl, newUrl] of Object.entries(exactMap)) {
    if (newValue.includes(oldUrl)) {
      newValue = newValue.split(oldUrl).join(newUrl);
      changed = true;
      urlsRewritten++;
    }
  }
  for (const [baseUrl, newUrl] of baseMap.entries()) {
    const regex = buildBaseUrlMatchRegex(baseUrl);
    const matches = newValue.match(regex);
    if (matches) {
      for (const match of matches) {
        if (!exactMap[match]) {
          newValue = newValue.split(match).join(newUrl);
          changed = true;
          urlsRewritten++;
        }
      }
    }
  }
  return { newValue, changed, urlsRewritten };
}
function escapeRegExp(string) {
  return string.replace(REGEX_SPECIAL_CHARS, "\\$&");
}
function stripWordPressImageSizeSuffix(url) {
  return url.replace(WORDPRESS_IMAGE_SIZE_SUFFIX, "");
}
function buildBaseUrlMatchRegex(baseUrl) {
  const extensionMatch = BASE_URL_EXTENSION.exec(baseUrl);
  const basePattern = extensionMatch ? `${escapeRegExp(extensionMatch[1])}(?:-\\d+x\\d+)?${escapeRegExp(extensionMatch[2])}` : escapeRegExp(baseUrl);
  return new RegExp(
    `${basePattern}(\\?[^"'\\s]*)?(?=$|["'\\s<>)\\],;:!?]|\\.(?=$|["'\\s<>)\\]]))`,
    "g"
  );
}

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NO_DB", "Database not initialized", 500);
  }
  const denied = requirePerm(user, "import:execute");
  if (denied) return denied;
  try {
    const body = await parseBody(request, wpRewriteUrlsBody);
    if (isParseError(body)) return body;
    const urlEntries = Object.entries(body.urlMap);
    if (urlEntries.length === 0) {
      return apiSuccess({
        updated: 0,
        byCollection: {},
        urlsRewritten: 0,
        errors: []
      });
    }
    const getProvider = (id) => emdash.getMediaProvider(id);
    const result = await rewriteUrls(emdash.db, body.urlMap, getProvider, body.collections);
    return apiSuccess(result);
  } catch (error) {
    return handleError(error, "Failed to rewrite URLs", "REWRITE_ERROR");
  }
};
async function rewriteUrls(db, urlMap, getProvider, collections) {
  const { SchemaRegistry } = await import('./registry_5tlwwm-G.mjs');
  const registry = new SchemaRegistry(db);
  const result = {
    updated: 0,
    byCollection: {},
    urlsRewritten: 0,
    errors: []
  };
  const baseMap = buildBaseUrlMap(urlMap);
  const allCollections = await registry.listCollections();
  const targetCollections = collections?.length ? allCollections.filter((c) => collections.includes(c.slug)) : allCollections;
  for (const collection of targetCollections) {
    const fields = await registry.listFields(collection.id);
    const portableTextFields = fields.filter((f) => f.type === "portableText");
    const stringFields = fields.filter((f) => ["text", "string"].includes(f.type));
    const mediaFields = fields.filter((f) => ["image", "file"].includes(f.type));
    if (portableTextFields.length === 0 && stringFields.length === 0 && mediaFields.length === 0)
      continue;
    validateIdentifier(collection.slug, "collection slug");
    const tableName = `ec_${collection.slug}`;
    try {
      const rows = await sql`
				SELECT * FROM ${sql.ref(tableName)}
				WHERE deleted_at IS NULL
			`.execute(db);
      for (const row of rows.rows) {
        let rowUpdated = false;
        const updates = {};
        let rowUrlsRewritten = 0;
        for (const field of portableTextFields) {
          const value = row[field.slug];
          if (!value || typeof value !== "string") continue;
          try {
            const blocks = JSON.parse(value);
            if (!Array.isArray(blocks)) continue;
            const rewriteResult = rewritePortableTextUrls(blocks, urlMap, baseMap);
            if (rewriteResult.changed) {
              updates[field.slug] = JSON.stringify(blocks);
              rowUpdated = true;
              rowUrlsRewritten += rewriteResult.urlsRewritten;
            }
          } catch {
            const stringResult = rewriteStringUrls(value, urlMap, baseMap);
            if (stringResult.changed) {
              updates[field.slug] = stringResult.newValue;
              rowUpdated = true;
              rowUrlsRewritten += stringResult.urlsRewritten;
            }
          }
        }
        for (const field of stringFields) {
          const value = row[field.slug];
          if (!value || typeof value !== "string") continue;
          const stringResult = rewriteStringUrls(value, urlMap, baseMap);
          if (stringResult.changed) {
            updates[field.slug] = stringResult.newValue;
            rowUpdated = true;
            rowUrlsRewritten += stringResult.urlsRewritten;
          }
        }
        for (const field of mediaFields) {
          const value = row[field.slug];
          if (!value || typeof value !== "string") continue;
          const newUrl = findMatchingUrl(value, urlMap, baseMap);
          if (newUrl) {
            try {
              const normalized = await normalizeMediaValue(newUrl, getProvider);
              updates[field.slug] = normalized ? JSON.stringify(normalized) : newUrl;
            } catch {
              updates[field.slug] = newUrl;
            }
            rowUpdated = true;
            rowUrlsRewritten++;
          }
        }
        if (rowUpdated) {
          try {
            let query = db.updateTable(tableName).where("id", "=", row.id);
            for (const [key, value] of Object.entries(updates)) {
              query = query.set({ [key]: value });
            }
            await query.execute();
            result.updated++;
            result.urlsRewritten += rowUrlsRewritten;
            result.byCollection[collection.slug] = (result.byCollection[collection.slug] || 0) + 1;
          } catch (updateError) {
            result.errors.push({
              collection: collection.slug,
              id: row.id,
              error: updateError instanceof Error ? updateError.message : "Update failed"
            });
          }
        }
      }
    } catch (queryError) {
      result.errors.push({
        collection: collection.slug,
        id: "*",
        error: queryError instanceof Error ? queryError.message : "Query failed for collection"
      });
    }
  }
  return result;
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
