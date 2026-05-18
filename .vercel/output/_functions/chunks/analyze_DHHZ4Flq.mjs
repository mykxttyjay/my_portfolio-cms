import { ah as parseWxrString, S as SchemaRegistry } from './adapt-sandbox-entry_H5gl0boC.mjs';
import 'better-sqlite3';
import 'kysely';
import 'image-size';
import '@emdash-cms/plugin-types';
import mime from 'mime/lite';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { R as RESERVED_COLLECTION_SLUGS } from './types_DVbKIzvo.mjs';

const prerender = false;
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;
const INVALID_SLUG_CHARS = /[^a-z0-9_]/g;
const LEADING_NON_ALPHA = /^[^a-z]+/;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "import:execute");
  if (denied) return denied;
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;
    if (!file) {
      return apiError("VALIDATION_ERROR", "No file provided", 400);
    }
    const text = await file.text();
    const wxr = await parseWxrString(text);
    const existingCollections = await fetchExistingCollections(emdash?.db);
    const analysis = analyzeWxr(wxr, existingCollections);
    return apiSuccess(analysis);
  } catch (error) {
    return handleError(error, "Failed to analyze file", "WXR_ANALYZE_ERROR");
  }
};
async function fetchExistingCollections(db) {
  const result = /* @__PURE__ */ new Map();
  if (!db) return result;
  try {
    const registry = new SchemaRegistry(db);
    const collections = await registry.listCollections();
    for (const collection of collections) {
      const fields = await registry.listFields(collection.id);
      const fieldMap = /* @__PURE__ */ new Map();
      for (const field of fields) {
        fieldMap.set(field.slug, {
          type: field.type,
          columnType: field.columnType
        });
      }
      result.set(collection.slug, {
        slug: collection.slug,
        fields: fieldMap
      });
    }
  } catch (error) {
    console.warn("Could not fetch schema registry:", error);
  }
  return result;
}
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
function analyzeWxr(wxr, existingCollections) {
  const postTypeCounts = /* @__PURE__ */ new Map();
  const postTypesWithThumbnails = /* @__PURE__ */ new Set();
  const metaKeys = /* @__PURE__ */ new Map();
  const authorPostCounts = /* @__PURE__ */ new Map();
  for (const post of wxr.posts) {
    const type = post.postType || "post";
    postTypeCounts.set(type, (postTypeCounts.get(type) || 0) + 1);
    if (post.creator) {
      authorPostCounts.set(post.creator, (authorPostCounts.get(post.creator) || 0) + 1);
    }
    if (post.meta.has("_thumbnail_id")) {
      postTypesWithThumbnails.add(type);
    }
    for (const [key, value] of post.meta) {
      const existing = metaKeys.get(key);
      if (existing) {
        existing.count++;
        if (existing.samples.length < 3 && value) {
          existing.samples.push(value.slice(0, 100));
        }
      } else {
        metaKeys.set(key, {
          count: 1,
          samples: value ? [value.slice(0, 100)] : [],
          isInternal: isInternalMetaKey(key)
        });
      }
    }
  }
  const customFields = [...metaKeys.entries()].filter(([_, info]) => !info.isInternal).map(([key, info]) => ({
    key,
    count: info.count,
    samples: info.samples,
    suggestedField: mapMetaKeyToField(key),
    suggestedType: inferMetaType(key, info.samples[0]),
    isInternal: info.isInternal
  })).toSorted((a, b) => b.count - a.count);
  const seenSlugs = /* @__PURE__ */ new Map();
  const postTypes = [...postTypeCounts.entries()].filter(([type]) => !isInternalPostType(type)).map(([name, count]) => {
    let suggestedCollection = mapPostTypeToCollection(name);
    const seen = seenSlugs.get(suggestedCollection) ?? 0;
    seenSlugs.set(suggestedCollection, seen + 1);
    if (seen > 0) {
      suggestedCollection = `${suggestedCollection}_${seen}`;
    }
    const existingCollection = existingCollections.get(suggestedCollection);
    const requiredFields = [...BASE_REQUIRED_FIELDS];
    if (postTypesWithThumbnails.has(name)) {
      requiredFields.push(FEATURED_IMAGE_FIELD);
    }
    const schemaStatus = checkSchemaCompatibility(requiredFields, existingCollection);
    return {
      name,
      count,
      suggestedCollection,
      requiredFields,
      schemaStatus
    };
  }).toSorted((a, b) => b.count - a.count);
  const attachmentItems = wxr.attachments.map((att) => {
    const filename = att.url ? getFilenameFromUrl(att.url) : void 0;
    const mimeType = filename ? guessMimeType(filename) : void 0;
    return {
      id: att.id,
      title: att.title,
      url: att.url,
      filename,
      mimeType
    };
  });
  return {
    site: {
      title: wxr.site.title || "WordPress Site",
      url: wxr.site.link || ""
    },
    postTypes,
    attachments: {
      count: wxr.attachments.length,
      items: attachmentItems
    },
    categories: wxr.categories.length,
    tags: wxr.tags.length,
    authors: wxr.authors.map((a) => ({
      id: a.id,
      login: a.login,
      email: a.email,
      displayName: a.displayName || a.login || "Unknown",
      postCount: a.login ? authorPostCounts.get(a.login) || 0 : 0
    })),
    customFields
  };
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
      // We can create it
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
  const reason = canImport ? void 0 : `Incompatible field types: ${incompatibleFields.join(", ")}. Existing fields have different types than required for import.`;
  return {
    exists: true,
    fieldStatus,
    canImport,
    reason
  };
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
function isInternalPostType(type) {
  return [
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
  ].includes(type);
}
function isInternalMetaKey(key) {
  if (key.startsWith("_edit_")) return true;
  if (key.startsWith("_wp_")) return true;
  if (key === "_edit_last" || key === "_edit_lock") return true;
  if (key === "_pingme" || key === "_encloseme") return true;
  if (key === "_thumbnail_id") return false;
  if (key.startsWith("_yoast_")) return false;
  if (key.startsWith("_rank_math_")) return false;
  if (key.startsWith("_")) return true;
  return false;
}
function sanitizeSlug(slug) {
  const sanitized = slug.toLowerCase().replace(INVALID_SLUG_CHARS, "_").replace(LEADING_NON_ALPHA, "");
  if (!sanitized) return "imported";
  if (RESERVED_COLLECTION_SLUGS.includes(sanitized)) return `wp_${sanitized}`;
  return sanitized;
}
function mapPostTypeToCollection(postType) {
  const mapping = {
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
  return mapping[postType] || sanitizeSlug(postType);
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
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function singularize(str) {
  if (str.endsWith("ies")) return str.slice(0, -3) + "y";
  if (str.endsWith("s")) return str.slice(0, -1);
  return str;
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	capitalize,
	mapPostTypeToCollection,
	prerender,
	sanitizeSlug,
	singularize
}, Symbol.toStringTag, { value: 'Module' }));

export { _page as _, singularize as a, capitalize as c, sanitizeSlug as s };
