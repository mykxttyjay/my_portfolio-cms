import mime from 'mime/lite';
import { s as slugify } from './slugify_CsLGd2A7.mjs';

const INTERNAL_POST_TYPES = [
  "revision",
  "nav_menu_item",
  "custom_css",
  "customize_changeset",
  "oembed_cache",
  "wp_global_styles",
  "wp_navigation",
  "wp_template",
  "wp_template_part",
  "attachment",
  // Handled separately as media
  "wp_block"
  // Handled separately as sections (reusable blocks)
];
const INTERNAL_META_PREFIXES = ["_edit_", "_wp_"];
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;
const TRAILING_SLASHES = /\/+$/;
const WP_JSON_SUFFIX = /\/wp-json\/?.*$/;
const INTERNAL_META_KEYS = ["_edit_last", "_edit_lock", "_pingme", "_encloseme"];
const BASE_REQUIRED_FIELDS = [
  { slug: "title", label: "Title", type: "string", required: true, searchable: true },
  { slug: "content", label: "Content", type: "portableText", required: false, searchable: true },
  { slug: "excerpt", label: "Excerpt", type: "text", required: false }
];
const FEATURED_IMAGE_FIELD = {
  slug: "featured_image",
  label: "Featured Image",
  type: "image",
  required: false
};
function isInternalPostType(type) {
  return INTERNAL_POST_TYPES.includes(type);
}
function isInternalMetaKey(key) {
  if (INTERNAL_META_KEYS.includes(key)) return true;
  for (const prefix of INTERNAL_META_PREFIXES) {
    if (key.startsWith(prefix)) return true;
  }
  if (key === "_thumbnail_id") return false;
  if (key.startsWith("_yoast_")) return false;
  if (key.startsWith("_rank_math_")) return false;
  if (key.startsWith("_")) return true;
  return false;
}
function mapWpStatus(status) {
  switch (status) {
    case "publish":
      return "publish";
    case "draft":
      return "draft";
    case "pending":
      return "pending";
    case "private":
      return "private";
    case "future":
      return "future";
    default:
      return "draft";
  }
}
const POST_TYPE_TO_COLLECTION = {
  post: "posts",
  page: "pages",
  attachment: "media",
  product: "products",
  portfolio: "portfolio",
  testimonial: "testimonials",
  team: "team",
  event: "events",
  faq: "faqs"
};
function mapPostTypeToCollection(postType) {
  return POST_TYPE_TO_COLLECTION[postType] || postType;
}
function mapMetaKeyToField(key) {
  if (key === "_yoast_wpseo_title") return "seo_title";
  if (key === "_yoast_wpseo_metadesc") return "seo_description";
  if (key === "_rank_math_title") return "seo_title";
  if (key === "_rank_math_description") return "seo_description";
  if (key === "_thumbnail_id") return "featured_image";
  if (key.startsWith("_")) return key.slice(1);
  return key;
}
function inferMetaType(key, value) {
  if (key.endsWith("_id") || key === "_thumbnail_id") return "string";
  if (key.endsWith("_date") || key.endsWith("_time")) return "date";
  if (key.endsWith("_count") || key.endsWith("_number")) return "number";
  if (!value) return "string";
  if (value.startsWith("a:") || value.startsWith("{") || value.startsWith("[")) return "json";
  if (NUMERIC_PATTERN.test(value)) return "number";
  if (["0", "1", "true", "false"].includes(value)) return "boolean";
  return "string";
}
function normalizeUrl(url) {
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = `https://${normalized}`;
  }
  normalized = normalized.replace(TRAILING_SLASHES, "");
  normalized = normalized.replace(WP_JSON_SUFFIX, "");
  return normalized;
}
function getFilenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.pop();
  } catch {
    return void 0;
  }
}
function guessMimeType(filename) {
  return mime.getType(filename) ?? void 0;
}
function buildAttachmentMap(attachments) {
  const map = /* @__PURE__ */ new Map();
  for (const att of attachments) {
    if (att.id && att.url) {
      map.set(String(att.id), att.url);
    }
  }
  return map;
}
function isTypeCompatible(requiredType, existingType) {
  if (requiredType === existingType) return true;
  const compatibleTypes = {
    string: ["string", "text", "slug"],
    text: ["string", "text"],
    portableText: ["portableText", "json"],
    number: ["number", "integer"],
    integer: ["number", "integer"]
  };
  const compatible = compatibleTypes[requiredType];
  return compatible?.includes(existingType) ?? false;
}
const MAX_SLUG_COLLISION_ATTEMPTS = 1e3;
async function ensureUniqueBylineSlug(bylineRepo, baseSlug) {
  let candidate = baseSlug;
  let suffix = 2;
  while (await bylineRepo.findBySlug(candidate)) {
    if (suffix > MAX_SLUG_COLLISION_ATTEMPTS) {
      throw new Error(
        `Byline slug collision limit exceeded for base slug "${baseSlug}". Tried ${MAX_SLUG_COLLISION_ATTEMPTS} variants.`
      );
    }
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }
  return candidate;
}
async function resolveImportByline(authorLogin, displayName, mappedUserId, bylineRepo, cache) {
  if (!authorLogin) return void 0;
  const cacheKey = `${authorLogin}:${mappedUserId ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  if (mappedUserId) {
    const existingForUser = await bylineRepo.findByUserId(mappedUserId);
    if (existingForUser) {
      cache.set(cacheKey, existingForUser.id);
      return existingForUser.id;
    }
  }
  const name = displayName || authorLogin;
  const slugBase = slugify(authorLogin);
  const slug = await ensureUniqueBylineSlug(bylineRepo, slugBase || "author");
  const created = await bylineRepo.create({
    slug,
    displayName: name,
    userId: mappedUserId ?? null,
    isGuest: !mappedUserId
  });
  cache.set(cacheKey, created.id);
  return created.id;
}
function checkSchemaCompatibility(requiredFields, existingCollection) {
  if (!existingCollection) {
    const fieldStatus2 = {};
    for (const field of requiredFields) {
      fieldStatus2[field.slug] = {
        status: "missing",
        requiredType: field.type
      };
    }
    return {
      exists: false,
      fieldStatus: fieldStatus2,
      canImport: true
    };
  }
  const fieldStatus = {};
  const incompatibleFields = [];
  for (const field of requiredFields) {
    const existingField = existingCollection.fields.get(field.slug);
    if (!existingField) {
      fieldStatus[field.slug] = {
        status: "missing",
        requiredType: field.type
      };
    } else if (isTypeCompatible(field.type, existingField.type)) {
      fieldStatus[field.slug] = {
        status: "compatible",
        existingType: existingField.type,
        requiredType: field.type
      };
    } else {
      fieldStatus[field.slug] = {
        status: "type_mismatch",
        existingType: existingField.type,
        requiredType: field.type
      };
      incompatibleFields.push(field.slug);
    }
  }
  const canImport = incompatibleFields.length === 0;
  const reason = canImport ? void 0 : `Incompatible field types: ${incompatibleFields.join(", ")}`;
  return {
    exists: true,
    fieldStatus,
    canImport,
    reason
  };
}

export { BASE_REQUIRED_FIELDS as B, FEATURED_IMAGE_FIELD as F, isInternalMetaKey as a, buildAttachmentMap as b, inferMetaType as c, mapMetaKeyToField as d, checkSchemaCompatibility as e, guessMimeType as f, getFilenameFromUrl as g, mapPostTypeToCollection as h, isInternalPostType as i, mapWpStatus as m, normalizeUrl as n, resolveImportByline as r };
