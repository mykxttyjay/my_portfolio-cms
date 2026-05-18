import { aj as ContentRepository, S as SchemaRegistry } from './adapt-sandbox-entry_H5gl0boC.mjs';
import 'better-sqlite3';
import 'kysely';
import 'image-size';
import '@emdash-cms/plugin-types';
import 'mime/lite';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { K as wpPluginExecuteBody } from './redirects_jp1t_nEU.mjs';
import { B as BylineRepository } from './byline_BJnlLrR9.mjs';
import { g as getSource } from './index_CfxEjB-M.mjs';
import { r as resolveAndValidateExternalUrl, S as SsrfError } from './ssrf_CAVg0-kk.mjs';
import { r as resolveImportByline } from './utils_BNW-PpXM.mjs';
import { s as slugify } from './slugify_CsLGd2A7.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "import:execute");
  if (denied) return denied;
  if (!emdash?.handleContentCreate) {
    return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
  }
  try {
    const emdashManifest = await emdash.getManifest();
    const body = await parseBody(request, wpPluginExecuteBody);
    if (isParseError(body)) return body;
    try {
      await resolveAndValidateExternalUrl(body.url);
    } catch (e) {
      const msg = e instanceof SsrfError ? e.message : "Invalid URL";
      return apiError("SSRF_BLOCKED", msg, 400);
    }
    const config = body.config;
    const source = getSource("wordpress-plugin");
    if (!source) {
      return apiError("NOT_CONFIGURED", "WordPress plugin source not available", 500);
    }
    const postTypes = Object.entries(config.postTypeMappings).filter(([_, mapping]) => mapping.enabled).map(([postType]) => postType);
    if (postTypes.length === 0) {
      return apiError("VALIDATION_ERROR", "No post types selected for import", 400);
    }
    console.log("[WP Plugin Import] Starting import for:", body.url);
    console.log("[WP Plugin Import] Post types:", postTypes);
    const result = await importContent(
      source.fetchContent(
        { type: "url", url: body.url, token: body.token },
        { postTypes, includeDrafts: true }
      ),
      config,
      emdash,
      emdashManifest
    );
    console.log("[WP Plugin Import] Import result:", JSON.stringify(result, null, 2));
    return apiSuccess({
      success: true,
      result
    });
  } catch (error) {
    return handleError(error, "Failed to import from WordPress", "WP_PLUGIN_IMPORT_ERROR");
  }
};
const IMPORT_FIELDS = [
  {
    slug: "title",
    label: "Title",
    type: "string",
    check: () => true
  },
  {
    slug: "content",
    label: "Content",
    type: "portableText",
    check: () => true
  },
  {
    slug: "excerpt",
    label: "Excerpt",
    type: "text",
    check: (item) => !!item.excerpt
  },
  {
    slug: "featured_image",
    label: "Featured Image",
    type: "image",
    check: (item) => !!item.featuredImage
  }
];
async function importContent(items, config, emdash, manifest) {
  const result = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    byCollection: {}
  };
  const contentRepo = new ContentRepository(emdash.db);
  const bylineRepo = new BylineRepository(emdash.db);
  const bylineCache = /* @__PURE__ */ new Map();
  const schemaRegistry = new SchemaRegistry(emdash.db);
  const ensuredCollections = /* @__PURE__ */ new Set();
  const translationGroupMap = /* @__PURE__ */ new Map();
  for await (const item of items) {
    console.log("[WP Plugin Import] Processing item:", {
      sourceId: item.sourceId,
      title: item.title,
      postType: item.postType,
      status: item.status,
      contentBlocks: Array.isArray(item.content) ? item.content.length : 0,
      featuredImage: item.featuredImage,
      locale: item.locale,
      translationGroup: item.translationGroup
    });
    const mapping = config.postTypeMappings[item.postType];
    if (!mapping || !mapping.enabled) {
      result.skipped++;
      continue;
    }
    const collection = mapping.collection;
    if (!manifest?.collections[collection]) {
      result.errors.push({
        title: item.title || "Untitled",
        error: `Collection "${collection}" does not exist`
      });
      continue;
    }
    try {
      if (!ensuredCollections.has(collection)) {
        for (const field of IMPORT_FIELDS) {
          if (field.check(item)) {
            const existingField = await schemaRegistry.getField(collection, field.slug);
            if (!existingField) {
              console.log(
                `[WP Plugin Import] Creating missing field "${field.slug}" in collection "${collection}"`
              );
              try {
                await schemaRegistry.createField(collection, {
                  slug: field.slug,
                  label: field.label,
                  type: field.type,
                  required: false
                });
              } catch (e) {
                console.log(
                  `[WP Plugin Import] Field "${field.slug}" creation skipped:`,
                  e instanceof Error ? e.message : e
                );
              }
            }
          }
        }
        ensuredCollections.add(collection);
      }
      const slug = item.slug || slugify(item.title || `post-${item.sourceId}`);
      if (config.skipExisting) {
        const existing = await contentRepo.findBySlug(collection, slug, item.locale);
        if (existing) {
          if (item.translationGroup) {
            translationGroupMap.set(item.translationGroup, existing.id);
          }
          result.skipped++;
          continue;
        }
      }
      const status = mapStatus(item.status);
      const data = {};
      data.title = item.title || "Untitled";
      data.content = item.content;
      if (item.excerpt) {
        data.excerpt = item.excerpt;
      }
      if (item.featuredImage) {
        data.featured_image = item.featuredImage;
        console.log("[WP Plugin Import] Adding featured_image:", item.featuredImage);
      }
      let authorId;
      if (config.authorMappings && item.author) {
        const mappedUserId = config.authorMappings[item.author];
        if (mappedUserId !== void 0 && mappedUserId !== null) {
          authorId = mappedUserId;
        }
      }
      const bylineId = await resolveImportByline(
        item.author,
        item.author,
        // display name fallback is the login
        authorId,
        bylineRepo,
        bylineCache
      );
      let translationOf;
      if (item.translationGroup) {
        const existingGroupItem = translationGroupMap.get(item.translationGroup);
        if (existingGroupItem) {
          translationOf = existingGroupItem;
        }
      }
      const itemDateTime = item.date?.getTime();
      const createdAt = itemDateTime !== void 0 && !Number.isNaN(itemDateTime) ? item.date.toISOString() : void 0;
      const publishedAt = status === "published" && createdAt ? createdAt : void 0;
      const createResult = await emdash.handleContentCreate(collection, {
        data,
        slug,
        status,
        authorId,
        bylines: bylineId ? [{ bylineId }] : void 0,
        locale: item.locale,
        translationOf,
        createdAt,
        publishedAt
      });
      if (createResult.success) {
        result.imported++;
        result.byCollection[collection] = (result.byCollection[collection] || 0) + 1;
        if (item.translationGroup && !translationGroupMap.has(item.translationGroup)) {
          const createdData = createResult.data;
          if (createdData?.id) {
            translationGroupMap.set(item.translationGroup, createdData.id);
          }
        }
      } else {
        result.errors.push({
          title: item.title || "Untitled",
          error: typeof createResult.error === "object" && createResult.error !== null ? createResult.error.message || "Unknown error" : String(createResult.error)
        });
      }
    } catch (error) {
      console.error(`Import error for "${item.title || "Untitled"}":`, error);
      result.errors.push({
        title: item.title || "Untitled",
        error: error instanceof Error && error.message ? error.message : "Failed to import item"
      });
    }
  }
  result.success = result.errors.length === 0;
  return result;
}
function mapStatus(wpStatus) {
  switch (wpStatus) {
    case "publish":
      return "published";
    case "draft":
      return "draft";
    case "pending":
      return "draft";
    case "private":
      return "draft";
    default:
      return "draft";
  }
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
