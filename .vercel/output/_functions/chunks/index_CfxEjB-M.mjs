import { gutenbergToPortableText } from '@emdash-cms/gutenberg-to-portable-text';
import { r as resolveAndValidateExternalUrl, v as validateExternalUrl, s as ssrfSafeFetch } from './ssrf_CAVg0-kk.mjs';
import sax from 'sax';
import { b as buildAttachmentMap, i as isInternalPostType, m as mapWpStatus, a as isInternalMetaKey, c as inferMetaType, d as mapMetaKeyToField, e as checkSchemaCompatibility, B as BASE_REQUIRED_FIELDS, g as getFilenameFromUrl, f as guessMimeType, h as mapPostTypeToCollection, F as FEATURED_IMAGE_FIELD, n as normalizeUrl$1 } from './utils_BNW-PpXM.mjs';
import { s as slugify } from './slugify_CsLGd2A7.mjs';

const TRAILING_SLASHES_PATTERN = /\/+$/;
const sources = /* @__PURE__ */ new Map();
function registerSource(source) {
  sources.set(source.id, source);
}
function getSource(id) {
  return sources.get(id);
}
function getAllSources() {
  return [...sources.values()];
}
function getUrlSources() {
  return getAllSources().filter((s) => s.canProbe);
}
async function probeUrl(url) {
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  normalizedUrl = normalizedUrl.replace(TRAILING_SLASHES_PATTERN, "");
  await resolveAndValidateExternalUrl(normalizedUrl);
  const results = [];
  const urlSources = getUrlSources();
  const probePromises = urlSources.map(async (source) => {
    try {
      const result = await source.probe?.(normalizedUrl);
      if (result) {
        return result;
      }
    } catch (error) {
      console.debug(`Probe failed for ${source.id}:`, error);
    }
    return null;
  });
  const probeResults = await Promise.allSettled(probePromises);
  for (const result of probeResults) {
    if (result.status === "fulfilled" && result.value) {
      results.push(result.value);
    }
  }
  const confidenceOrder = { definite: 0, likely: 1, possible: 2 };
  results.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);
  return {
    url: normalizedUrl,
    isWordPress: results.length > 0,
    bestMatch: results[0] ?? null,
    allMatches: results
  };
}

const PHP_SERIALIZED_STRING_PATTERN = /s:\d+:"([^"]+)"/g;
const PHP_SERIALIZED_STRING_MATCH_PATTERN = /s:\d+:"([^"]+)"/;
function attrStr(attr) {
  if (typeof attr === "string") return attr;
  if (attr && typeof attr === "object" && "value" in attr) return attr.value;
  return "";
}
function isCompleteWxrTerm(term) {
  return term.id !== void 0 && term.taxonomy !== void 0 && term.slug !== void 0 && term.name !== void 0;
}
function parseWxrString(xml) {
  return new Promise((resolve, reject) => {
    const parser = sax.parser(true, { trim: false, normalize: false });
    const data = {
      site: {},
      posts: [],
      attachments: [],
      categories: [],
      tags: [],
      authors: [],
      terms: [],
      navMenus: []
    };
    let currentPath = [];
    let currentText = "";
    let currentItem = null;
    let currentAttachment = null;
    let currentCategory = null;
    let currentTag = null;
    let currentAuthor = null;
    let currentTerm = null;
    let currentMetaKey = "";
    const navMenuItemPosts = [];
    const menuTermsBySlug = /* @__PURE__ */ new Map();
    parser.onopentag = (node) => {
      const tag = node.name.toLowerCase();
      currentPath.push(tag);
      currentText = "";
      if (tag === "item") {
        currentItem = {
          categories: [],
          tags: [],
          customTaxonomies: /* @__PURE__ */ new Map(),
          meta: /* @__PURE__ */ new Map()
        };
      } else if (tag === "wp:category") {
        currentCategory = {};
      } else if (tag === "wp:tag") {
        currentTag = {};
      } else if (tag === "wp:author") {
        currentAuthor = {};
      } else if (tag === "wp:term") {
        currentTerm = {};
      }
      if (tag === "category" && currentItem && node.attributes) {
        const domain = attrStr(node.attributes.domain);
        const nicename = attrStr(node.attributes.nicename);
        if (domain === "category" && nicename) {
          currentItem.categories.push(nicename);
        } else if (domain === "post_tag" && nicename) {
          currentItem.tags.push(nicename);
        } else if (domain && nicename && domain !== "category" && domain !== "post_tag") {
          if (!currentItem.customTaxonomies) {
            currentItem.customTaxonomies = /* @__PURE__ */ new Map();
          }
          const existing = currentItem.customTaxonomies.get(domain) || [];
          existing.push(nicename);
          currentItem.customTaxonomies.set(domain, existing);
        }
      }
    };
    parser.ontext = (text) => {
      currentText += text;
    };
    parser.oncdata = (cdata) => {
      currentText += cdata;
    };
    parser.onclosetag = (tagName) => {
      const tag = tagName.toLowerCase();
      const text = currentText.trim();
      if (currentPath.length === 2 && currentPath[0] === "rss") {
        switch (tag) {
          case "title":
            data.site.title = text;
            break;
          case "link":
            data.site.link = text;
            break;
          case "description":
            data.site.description = text;
            break;
          case "language":
            data.site.language = text;
            break;
          case "wp:base_site_url":
            data.site.baseSiteUrl = text;
            break;
          case "wp:base_blog_url":
            data.site.baseBlogUrl = text;
            break;
        }
      }
      if (currentItem) {
        switch (tag) {
          case "title":
            currentItem.title = text;
            break;
          case "link":
            currentItem.link = text;
            break;
          case "pubdate":
            currentItem.pubDate = text;
            break;
          case "dc:creator":
            currentItem.creator = text;
            break;
          case "guid":
            currentItem.guid = text;
            break;
          case "description":
            currentItem.description = text;
            break;
          case "content:encoded":
            currentItem.content = text;
            break;
          case "excerpt:encoded":
            currentItem.excerpt = text;
            break;
          case "wp:post_id":
            currentItem.id = parseInt(text, 10);
            break;
          case "wp:post_date":
            currentItem.postDate = text;
            break;
          case "wp:post_date_gmt":
            currentItem.postDateGmt = text;
            break;
          case "wp:post_modified":
            currentItem.postModified = text;
            break;
          case "wp:post_modified_gmt":
            currentItem.postModifiedGmt = text;
            break;
          case "wp:comment_status":
            currentItem.commentStatus = text;
            break;
          case "wp:ping_status":
            currentItem.pingStatus = text;
            break;
          case "wp:post_name":
            currentItem.postName = text;
            break;
          case "wp:status":
            currentItem.status = text;
            break;
          case "wp:post_parent":
            currentItem.postParent = parseInt(text, 10);
            break;
          case "wp:menu_order":
            currentItem.menuOrder = parseInt(text, 10);
            break;
          case "wp:post_type":
            currentItem.postType = text;
            if (text === "attachment") {
              currentAttachment = {
                id: currentItem.id,
                title: currentItem.title,
                url: currentItem.link,
                postDate: currentItem.postDate,
                meta: /* @__PURE__ */ new Map()
              };
            }
            break;
          case "wp:post_password":
            currentItem.postPassword = text || void 0;
            break;
          case "wp:is_sticky":
            currentItem.isSticky = text === "1";
            break;
          case "wp:attachment_url":
            if (currentAttachment) {
              currentAttachment.url = text;
            }
            break;
          case "wp:meta_key":
            currentMetaKey = text;
            break;
          case "wp:meta_value":
            if (currentMetaKey && currentItem.meta) {
              currentItem.meta.set(currentMetaKey, text);
            }
            break;
          case "item":
            if (currentAttachment) {
              data.attachments.push(currentAttachment);
              currentAttachment = null;
            } else if (currentItem.postType === "nav_menu_item") {
              navMenuItemPosts.push(currentItem);
              data.posts.push(currentItem);
            } else if (currentItem.postType !== "attachment") {
              data.posts.push(currentItem);
            }
            currentItem = null;
            break;
        }
      }
      if (currentCategory) {
        switch (tag) {
          case "wp:term_id":
            currentCategory.id = parseInt(text, 10);
            break;
          case "wp:category_nicename":
            currentCategory.nicename = text;
            break;
          case "wp:cat_name":
            currentCategory.name = text;
            break;
          case "wp:category_parent":
            currentCategory.parent = text || void 0;
            break;
          case "wp:category_description":
            currentCategory.description = text || void 0;
            break;
          case "wp:category":
            if (currentCategory.name) {
              data.categories.push(currentCategory);
            }
            currentCategory = null;
            break;
        }
      }
      if (currentTag) {
        switch (tag) {
          case "wp:term_id":
            currentTag.id = parseInt(text, 10);
            break;
          case "wp:tag_slug":
            currentTag.slug = text;
            break;
          case "wp:tag_name":
            currentTag.name = text;
            break;
          case "wp:tag_description":
            currentTag.description = text || void 0;
            break;
          case "wp:tag":
            if (currentTag.name) {
              data.tags.push(currentTag);
            }
            currentTag = null;
            break;
        }
      }
      if (currentAuthor) {
        switch (tag) {
          case "wp:author_id":
            currentAuthor.id = parseInt(text, 10);
            break;
          case "wp:author_login":
            currentAuthor.login = text;
            break;
          case "wp:author_email":
            currentAuthor.email = text;
            break;
          case "wp:author_display_name":
            currentAuthor.displayName = text;
            break;
          case "wp:author_first_name":
            currentAuthor.firstName = text;
            break;
          case "wp:author_last_name":
            currentAuthor.lastName = text;
            break;
          case "wp:author":
            if (currentAuthor.login) {
              data.authors.push(currentAuthor);
            }
            currentAuthor = null;
            break;
        }
      }
      if (currentTerm) {
        switch (tag) {
          case "wp:term_id":
            currentTerm.id = parseInt(text, 10);
            break;
          case "wp:term_taxonomy":
            currentTerm.taxonomy = text;
            break;
          case "wp:term_slug":
            currentTerm.slug = text;
            break;
          case "wp:term_name":
            currentTerm.name = text;
            break;
          case "wp:term_parent":
            currentTerm.parent = text || void 0;
            break;
          case "wp:term_description":
            currentTerm.description = text || void 0;
            break;
          case "wp:term":
            if (isCompleteWxrTerm(currentTerm)) {
              data.terms.push(currentTerm);
              if (currentTerm.taxonomy === "nav_menu") {
                menuTermsBySlug.set(currentTerm.slug, currentTerm.id);
              }
            }
            currentTerm = null;
            break;
        }
      }
      currentPath.pop();
      currentText = "";
    };
    parser.onerror = (err) => {
      reject(new Error(`XML parsing error: ${err.message}`));
    };
    parser.onend = () => {
      data.navMenus = buildNavMenus(navMenuItemPosts, menuTermsBySlug);
      resolve(data);
    };
    parser.write(xml).close();
  });
}
function buildNavMenus(navMenuItemPosts, menuTermsBySlug) {
  const menuItemsByMenu = /* @__PURE__ */ new Map();
  for (const post of navMenuItemPosts) {
    const navMenuSlugs = post.customTaxonomies?.get("nav_menu");
    if (!navMenuSlugs || navMenuSlugs.length === 0) continue;
    const menuSlug = navMenuSlugs[0];
    if (!menuSlug) continue;
    const items = menuItemsByMenu.get(menuSlug) || [];
    items.push(post);
    menuItemsByMenu.set(menuSlug, items);
  }
  const menus = [];
  for (const [menuSlug, posts] of menuItemsByMenu) {
    const menuId = menuTermsBySlug.get(menuSlug) || 0;
    const items = posts.map((post) => {
      const meta = post.meta;
      const menuItemTypeRaw = meta.get("_menu_item_type") || "custom";
      const menuItemType = menuItemTypeRaw === "post_type" || menuItemTypeRaw === "taxonomy" ? menuItemTypeRaw : "custom";
      const objectType = meta.get("_menu_item_object");
      const objectIdStr = meta.get("_menu_item_object_id");
      const url = meta.get("_menu_item_url");
      const parentIdStr = meta.get("_menu_item_menu_item_parent");
      const target = meta.get("_menu_item_target");
      const classesStr = meta.get("_menu_item_classes");
      let classes;
      if (classesStr) {
        const matches = classesStr.match(PHP_SERIALIZED_STRING_PATTERN);
        if (matches) {
          classes = matches.map((m) => m.match(PHP_SERIALIZED_STRING_MATCH_PATTERN)?.[1]).filter(Boolean).join(" ");
        }
      }
      return {
        id: post.id || 0,
        menuId,
        parentId: parentIdStr ? parseInt(parentIdStr, 10) || void 0 : void 0,
        sortOrder: post.menuOrder || 0,
        type: menuItemType,
        objectType: objectType || void 0,
        objectId: objectIdStr ? parseInt(objectIdStr, 10) : void 0,
        url: url || void 0,
        title: post.title || "",
        target: target || void 0,
        classes: classes || void 0
      };
    });
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    menus.push({
      id: menuId,
      name: menuSlug,
      label: menuSlug,
      // Will be enhanced when we have term data
      items
    });
  }
  return menus;
}

const wxrSource = {
  id: "wxr",
  name: "WordPress Export File",
  description: "Upload a WordPress export file (.xml)",
  icon: "upload",
  requiresFile: true,
  canProbe: false,
  async analyze(input, context) {
    if (input.type !== "file") {
      throw new Error("WXR source requires a file input");
    }
    const text = await input.file.text();
    const wxr = await parseWxrString(text);
    const existingCollections = context.getExistingCollections ? await context.getExistingCollections() : /* @__PURE__ */ new Map();
    return analyzeWxrData(wxr, existingCollections);
  },
  async *fetchContent(input, options) {
    if (input.type !== "file") {
      throw new Error("WXR source requires a file input");
    }
    const text = await input.file.text();
    const wxr = await parseWxrString(text);
    const attachmentMap = buildAttachmentMap(wxr.attachments);
    let count = 0;
    for (const post of wxr.posts) {
      const postType = post.postType || "post";
      if (!options.postTypes.includes(postType)) {
        continue;
      }
      if (isInternalPostType(postType)) {
        continue;
      }
      if (!options.includeDrafts && post.status !== "publish") {
        continue;
      }
      yield wxrPostToNormalizedItem(post, attachmentMap);
      count++;
      if (options.limit && count >= options.limit) {
        break;
      }
    }
  }
};
function analyzeWxrData(wxr, existingCollections) {
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
  const postTypes = [...postTypeCounts.entries()].filter(([type]) => !isInternalPostType(type)).map(([name, count]) => {
    const suggestedCollection = mapPostTypeToCollection(name);
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
  const navMenus = wxr.navMenus.map((menu) => ({
    name: menu.name,
    label: menu.label,
    itemCount: menu.items.length
  }));
  const taxonomyMap = /* @__PURE__ */ new Map();
  for (const term of wxr.terms) {
    if (term.taxonomy === "category" || term.taxonomy === "post_tag" || term.taxonomy === "nav_menu") {
      continue;
    }
    const existing = taxonomyMap.get(term.taxonomy);
    if (existing) {
      existing.count++;
      if (existing.samples.length < 3) {
        existing.samples.push(term.name);
      }
    } else {
      taxonomyMap.set(term.taxonomy, {
        count: 1,
        samples: [term.name]
      });
    }
  }
  const customTaxonomies = Array.from(
    taxonomyMap.entries(),
    ([slug, info]) => ({
      slug,
      termCount: info.count,
      sampleTerms: info.samples
    })
  ).toSorted((a, b) => b.termCount - a.termCount);
  const reusableBlocks = wxr.posts.filter((post) => post.postType === "wp_block").map((post) => ({
    id: post.id || 0,
    title: post.title || "Untitled Block",
    slug: post.postName || slugify(post.title || `block-${post.id || Date.now()}`)
  }));
  return {
    sourceId: "wxr",
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
    navMenus: navMenus.length > 0 ? navMenus : void 0,
    customTaxonomies: customTaxonomies.length > 0 ? customTaxonomies : void 0,
    reusableBlocks: reusableBlocks.length > 0 ? reusableBlocks : void 0,
    customFields
  };
}
function wxrPostToNormalizedItem(post, attachmentMap) {
  const content = post.content ? gutenbergToPortableText(post.content) : [];
  const thumbnailId = post.meta.get("_thumbnail_id");
  const featuredImage = thumbnailId ? attachmentMap.get(String(thumbnailId)) : void 0;
  let customTaxonomies;
  if (post.customTaxonomies && post.customTaxonomies.size > 0) {
    customTaxonomies = Object.fromEntries(post.customTaxonomies);
  }
  return {
    sourceId: post.id || 0,
    postType: post.postType || "post",
    status: mapWpStatus(post.status),
    slug: post.postName || slugify(post.title || `post-${post.id || Date.now()}`),
    title: post.title || "Untitled",
    content,
    excerpt: post.excerpt,
    date: parseWxrDate(post.postDateGmt, post.pubDate, post.postDate) ?? /* @__PURE__ */ new Date(),
    modified: parseWxrDate(post.postModifiedGmt, void 0, post.postModified),
    author: post.creator,
    categories: post.categories,
    tags: post.tags,
    meta: Object.fromEntries(post.meta),
    featuredImage,
    // Hierarchical content support
    parentId: post.postParent && post.postParent !== 0 ? post.postParent : void 0,
    menuOrder: post.menuOrder,
    // Custom taxonomy assignments
    customTaxonomies
  };
}
const WXR_ZERO_DATE = "0000-00-00 00:00:00";
function parseWxrDate(gmtDate, pubDate, localDate) {
  if (gmtDate && gmtDate !== WXR_ZERO_DATE) {
    return /* @__PURE__ */ new Date(gmtDate.replace(" ", "T") + "Z");
  }
  if (pubDate) {
    const d = new Date(pubDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (localDate) {
    const d = new Date(localDate.replace(" ", "T"));
    if (!isNaN(d.getTime())) return d;
  }
  return void 0;
}

const TRAILING_SLASHES = /\/+$/;
const WP_JSON_SUFFIX = /\/wp-json\/?$/;
const wordpressRestSource = {
  id: "wordpress-rest",
  name: "WordPress Site",
  description: "Connect to a self-hosted WordPress site",
  icon: "globe",
  requiresFile: false,
  canProbe: true,
  async probe(url) {
    try {
      const siteUrl = normalizeUrl(url);
      validateExternalUrl(siteUrl);
      const apiUrl = `${siteUrl}/wp-json/`;
      const response = await ssrfSafeFetch(apiUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(1e4)
      });
      if (!response.ok) {
        const altResponse = await ssrfSafeFetch(`${siteUrl}/?rest_route=/`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(1e4)
        });
        if (!altResponse.ok) {
          return null;
        }
      }
      const data = await response.json();
      if (!data.namespaces?.includes("wp/v2")) {
        return null;
      }
      const preview = await getPublicContentCounts(siteUrl);
      const hasAppPasswords = !!data.authentication?.["application-passwords"];
      return {
        sourceId: "wordpress-rest",
        confidence: "definite",
        detected: {
          platform: "wordpress",
          siteTitle: data.name,
          siteUrl: data.url || data.home || siteUrl
        },
        capabilities: {
          publicContent: true,
          privateContent: false,
          // Would need auth
          customPostTypes: false,
          // Only if show_in_rest: true
          allMeta: false,
          // Only if registered for REST
          mediaStream: true
        },
        auth: hasAppPasswords ? {
          type: "password",
          instructions: "To import drafts and private content, create an Application Password in WordPress → Users → Your Profile → Application Passwords"
        } : void 0,
        preview,
        suggestedAction: {
          type: "upload",
          instructions: "For a complete import including drafts, custom post types, and all metadata, export your content from WordPress (Tools → Export) and upload the file here."
        }
      };
    } catch {
      return null;
    }
  },
  async analyze(_input, _context) {
    throw new Error("Direct REST API import not implemented. Please upload a WXR export file.");
  },
  // eslint-disable-next-line require-yield
  async *fetchContent(_input, _options) {
    throw new Error("Direct REST API import not implemented. Please upload a WXR export file.");
  }
};
function normalizeUrl(url) {
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = `https://${normalized}`;
  }
  normalized = normalized.replace(TRAILING_SLASHES, "");
  normalized = normalized.replace(WP_JSON_SUFFIX, "");
  return normalized;
}
async function getPublicContentCounts(siteUrl) {
  const result = {};
  try {
    const [postsRes, pagesRes, mediaRes] = await Promise.allSettled([
      ssrfSafeFetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
        signal: AbortSignal.timeout(5e3)
      }),
      ssrfSafeFetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=1`, {
        signal: AbortSignal.timeout(5e3)
      }),
      ssrfSafeFetch(`${siteUrl}/wp-json/wp/v2/media?per_page=1`, {
        signal: AbortSignal.timeout(5e3)
      })
    ]);
    if (postsRes.status === "fulfilled" && postsRes.value.ok) {
      const total = postsRes.value.headers.get("X-WP-Total");
      if (total) result.posts = parseInt(total, 10);
    }
    if (pagesRes.status === "fulfilled" && pagesRes.value.ok) {
      const total = pagesRes.value.headers.get("X-WP-Total");
      if (total) result.pages = parseInt(total, 10);
    }
    if (mediaRes.status === "fulfilled" && mediaRes.value.ok) {
      const total = mediaRes.value.headers.get("X-WP-Total");
      if (total) result.media = parseInt(total, 10);
    }
  } catch {
  }
  return result;
}

const wordpressPluginSource = {
  id: "wordpress-plugin",
  name: "WordPress (EmDash Exporter)",
  description: "Import from WordPress sites with the EmDash Exporter plugin installed",
  icon: "plug",
  requiresFile: false,
  canProbe: true,
  async probe(url) {
    try {
      const siteUrl = normalizeUrl$1(url);
      validateExternalUrl(siteUrl);
      const probeUrl = `${siteUrl}/wp-json/emdash/v1/probe`;
      const response = await ssrfSafeFetch(probeUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(1e4)
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (!data.emdash_exporter) {
        return null;
      }
      return {
        sourceId: "wordpress-plugin",
        confidence: "definite",
        detected: {
          platform: "wordpress",
          version: data.wordpress_version,
          siteTitle: data.site.title,
          siteUrl: data.site.url
        },
        capabilities: {
          publicContent: true,
          privateContent: true,
          // Full access with auth
          customPostTypes: true,
          allMeta: true,
          mediaStream: true
        },
        auth: data.capabilities.application_passwords ? {
          type: "password",
          instructions: data.auth_instructions.instructions
        } : void 0,
        preview: {
          posts: data.post_types.find((p) => p.name === "post")?.count,
          pages: data.post_types.find((p) => p.name === "page")?.count,
          media: data.media_count
        },
        suggestedAction: {
          type: "proceed"
        },
        i18n: pluginI18nToDetection(data.i18n)
      };
    } catch {
      return null;
    }
  },
  async analyze(input, context) {
    const { siteUrl, headers } = getRequestConfig(input);
    const response = await ssrfSafeFetch(`${siteUrl}/wp-json/emdash/v1/analyze`, {
      headers,
      signal: AbortSignal.timeout(3e4)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to analyze site: ${response.statusText}`);
    }
    const data = await response.json();
    const existingCollections = context.getExistingCollections ? await context.getExistingCollections() : /* @__PURE__ */ new Map();
    const postTypes = data.post_types.filter((pt) => pt.total > 0).map((pt) => {
      const suggestedCollection = mapPostTypeToCollection(pt.name);
      const existingCollection = existingCollections.get(suggestedCollection);
      const supportsThumbnail = pt.supports && "thumbnail" in pt.supports;
      const requiredFields = supportsThumbnail ? [...BASE_REQUIRED_FIELDS, FEATURED_IMAGE_FIELD] : [...BASE_REQUIRED_FIELDS];
      return {
        name: pt.name,
        count: pt.total,
        suggestedCollection,
        requiredFields,
        schemaStatus: checkSchemaCompatibility(requiredFields, existingCollection)
      };
    });
    const attachments = [];
    if (data.attachments.count > 0) {
      try {
        const mediaResponse = await ssrfSafeFetch(
          `${siteUrl}/wp-json/emdash/v1/media?per_page=500`,
          {
            headers,
            signal: AbortSignal.timeout(3e4)
          }
        );
        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json();
          for (const item of mediaData.items) {
            attachments.push({
              id: item.id,
              url: item.url,
              filename: item.filename,
              mimeType: item.mime_type,
              title: item.title,
              alt: item.alt,
              caption: item.caption,
              width: item.width,
              height: item.height
            });
          }
        }
      } catch (e) {
        console.warn("Failed to fetch media list:", e);
      }
    }
    const categoryTaxonomy = data.taxonomies.find((t) => t.name === "category");
    const tagTaxonomy = data.taxonomies.find((t) => t.name === "post_tag");
    return {
      sourceId: "wordpress-plugin",
      site: {
        title: data.site.title,
        url: data.site.url
      },
      postTypes,
      attachments: {
        count: data.attachments.count,
        items: attachments
      },
      categories: categoryTaxonomy?.term_count ?? 0,
      tags: tagTaxonomy?.term_count ?? 0,
      authors: data.authors.map((a) => ({
        id: a.id,
        login: a.login,
        email: a.email,
        displayName: a.display_name,
        postCount: a.post_count
      })),
      i18n: pluginI18nToDetection(data.i18n)
    };
  },
  async *fetchContent(input, options) {
    const { siteUrl, headers } = getRequestConfig(input);
    for (const postType of options.postTypes) {
      let page = 1;
      let totalPages = 1;
      let yielded = 0;
      while (page <= totalPages) {
        const status = options.includeDrafts ? "any" : "publish";
        const url = `${siteUrl}/wp-json/emdash/v1/content?post_type=${postType}&status=${status}&per_page=100&page=${page}`;
        const response = await ssrfSafeFetch(url, {
          headers,
          signal: AbortSignal.timeout(6e4)
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch ${postType}: ${response.statusText}`);
        }
        const data = await response.json();
        totalPages = data.pages;
        for (const post of data.items) {
          yield pluginPostToNormalizedItem(post);
          yielded++;
          if (options.limit && yielded >= options.limit) {
            return;
          }
        }
        page++;
      }
    }
  },
  async fetchMedia(url, _input) {
    validateExternalUrl(url);
    const response = await ssrfSafeFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.statusText}`);
    }
    return response.blob();
  }
};
function pluginI18nToDetection(i18n) {
  if (!i18n) return void 0;
  return {
    plugin: i18n.plugin,
    defaultLocale: i18n.default_locale,
    locales: i18n.locales
  };
}
function getRequestConfig(input) {
  if (input.type === "url") {
    const siteUrl = normalizeUrl$1(input.url);
    validateExternalUrl(siteUrl);
    const headers = {
      Accept: "application/json"
    };
    if (input.token) {
      headers["Authorization"] = `Basic ${input.token}`;
    }
    return { siteUrl, headers };
  }
  if (input.type === "oauth") {
    const oauthSiteUrl = normalizeUrl$1(input.url);
    validateExternalUrl(oauthSiteUrl);
    return {
      siteUrl: oauthSiteUrl,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`
      }
    };
  }
  throw new Error("WordPress plugin source requires URL or OAuth input");
}
function pluginPostToNormalizedItem(post) {
  const content = post.content ? gutenbergToPortableText(post.content) : [];
  const categories = post.taxonomies?.category?.map((c) => c.slug) ?? post.taxonomies?.categories?.map((c) => c.slug) ?? [];
  const tags = post.taxonomies?.post_tag?.map((t) => t.slug) ?? post.taxonomies?.tags?.map((t) => t.slug) ?? [];
  const meta = { ...post.meta };
  if (post.acf) {
    meta._acf = post.acf;
  }
  if (post.yoast) {
    meta._yoast = post.yoast;
  }
  if (post.rankmath) {
    meta._rankmath = post.rankmath;
  }
  return {
    sourceId: post.id,
    postType: post.post_type,
    status: mapWpStatus(post.status),
    slug: post.slug,
    title: post.title,
    content,
    excerpt: post.excerpt || void 0,
    date: new Date(post.date_gmt || post.date),
    modified: post.modified_gmt ? new Date(post.modified_gmt) : new Date(post.modified),
    author: post.author?.login,
    categories,
    tags,
    meta,
    featuredImage: post.featured_image?.url,
    locale: post.locale,
    translationGroup: post.translation_group
  };
}

registerSource(wordpressPluginSource);
registerSource(wordpressRestSource);
registerSource(wxrSource);

export { getSource as g, probeUrl as p };
