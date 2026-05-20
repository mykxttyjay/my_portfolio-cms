import { a as apiError, h as handleError, b as apiSuccess } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { g as getPublicOrigin } from './public-url_B8zVhtAZ.mjs';
import { am as setupBody } from './redirects_jp1t_nEU.mjs';
import { g as getAuthMode } from './mode_CNhffo5w.mjs';
import { r as runMigrations } from './runner_B0zqy-AO.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';
import { imageSize } from 'image-size';
import mime from 'mime/lite';
import { ulid } from 'ulidx';
import { B as BylineRepository } from './byline_BJnlLrR9.mjs';
import { C as ContentRepository } from './content_B4ef0P4I.mjs';
import { M as MediaRepository } from './media_CEdPKDLW.mjs';
import { R as RedirectRepository } from './redirect_CY-XSwpk.mjs';
import { R as RevisionRepository } from './revision_CCTbRhmI.mjs';
import { TaxonomyRepository } from './taxonomy_CAMPWGuD.mjs';
import { w as withTransaction } from './transaction_DUEGi9iw.mjs';
import { v as validateExternalUrl, s as ssrfSafeFetch } from './ssrf_CAVg0-kk.mjs';
import { SchemaRegistry } from './registry_5tlwwm-G.mjs';
import { FTSManager } from './fts-manager_BjkO4e5p.mjs';
import { s as setSiteSettings } from './index_DUdTeXmb.mjs';
import { F as FIELD_TYPES } from './types_DVbKIzvo.mjs';
import { a as loadSeed } from './load_BbhXrqPv.mjs';

const COLLECTION_FIELD_SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const REDIRECT_TYPES = /* @__PURE__ */ new Set([301, 302, 307, 308]);
const CRLF_PATTERN = /[\r\n]/;
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isValidRedirectPath(path) {
  if (!path.startsWith("/") || path.startsWith("//") || CRLF_PATTERN.test(path)) {
    return false;
  }
  try {
    return !decodeURIComponent(path).split("/").includes("..");
  } catch {
    return false;
  }
}
function validateSeed(data) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== "object") {
    return {
      valid: false,
      errors: ["Seed must be an object"],
      warnings: []
    };
  }
  const seed = data;
  if (!seed.version) {
    errors.push("Seed must have a version field");
  } else if (seed.version !== "1") {
    errors.push(`Unsupported seed version: ${String(seed.version)}`);
  }
  if (seed.collections) {
    if (!Array.isArray(seed.collections)) {
      errors.push("collections must be an array");
    } else {
      const collectionSlugs = /* @__PURE__ */ new Set();
      for (let i = 0; i < seed.collections.length; i++) {
        const collection = seed.collections[i];
        const prefix = `collections[${i}]`;
        if (!collection.slug) {
          errors.push(`${prefix}: slug is required`);
        } else {
          if (!COLLECTION_FIELD_SLUG_PATTERN.test(collection.slug)) {
            errors.push(
              `${prefix}.slug: must start with a letter and contain only lowercase letters, numbers, and underscores`
            );
          }
          if (collectionSlugs.has(collection.slug)) {
            errors.push(`${prefix}.slug: duplicate collection slug "${collection.slug}"`);
          }
          collectionSlugs.add(collection.slug);
        }
        if (!collection.label) {
          errors.push(`${prefix}: label is required`);
        }
        if (!Array.isArray(collection.fields)) {
          errors.push(`${prefix}.fields: must be an array`);
        } else {
          const fieldSlugs = /* @__PURE__ */ new Set();
          for (let j = 0; j < collection.fields.length; j++) {
            const field = collection.fields[j];
            const fieldPrefix = `${prefix}.fields[${j}]`;
            if (!field.slug) {
              errors.push(`${fieldPrefix}: slug is required`);
            } else {
              if (!COLLECTION_FIELD_SLUG_PATTERN.test(field.slug)) {
                errors.push(
                  `${fieldPrefix}.slug: must start with a letter and contain only lowercase letters, numbers, and underscores`
                );
              }
              if (fieldSlugs.has(field.slug)) {
                errors.push(
                  `${fieldPrefix}.slug: duplicate field slug "${field.slug}" in collection "${collection.slug}"`
                );
              }
              fieldSlugs.add(field.slug);
            }
            if (!field.label) {
              errors.push(`${fieldPrefix}: label is required`);
            }
            if (!field.type) {
              errors.push(`${fieldPrefix}: type is required`);
            } else if (!FIELD_TYPES.includes(field.type)) {
              errors.push(`${fieldPrefix}.type: unsupported field type "${field.type}"`);
            }
          }
        }
      }
    }
  }
  if (seed.taxonomies) {
    if (!Array.isArray(seed.taxonomies)) {
      errors.push("taxonomies must be an array");
    } else {
      const taxonomyNames = /* @__PURE__ */ new Set();
      for (let i = 0; i < seed.taxonomies.length; i++) {
        const taxonomy = seed.taxonomies[i];
        const prefix = `taxonomies[${i}]`;
        if (!taxonomy.name) {
          errors.push(`${prefix}: name is required`);
        } else {
          const key = `${taxonomy.name}::${taxonomy.locale ?? ""}`;
          if (taxonomyNames.has(key)) {
            errors.push(
              taxonomy.locale ? `${prefix}.name: duplicate taxonomy "${taxonomy.name}" in locale "${taxonomy.locale}"` : `${prefix}.name: duplicate taxonomy name "${taxonomy.name}"`
            );
          }
          taxonomyNames.add(key);
        }
        if (!taxonomy.label) {
          errors.push(`${prefix}: label is required`);
        }
        if (taxonomy.hierarchical === void 0) {
          errors.push(`${prefix}: hierarchical is required`);
        }
        if (!Array.isArray(taxonomy.collections)) {
          errors.push(`${prefix}.collections: must be an array`);
        } else if (taxonomy.collections.length === 0) {
          warnings.push(
            `${prefix}.collections: taxonomy "${taxonomy.name}" is not assigned to any collections`
          );
        }
        if (taxonomy.terms) {
          if (!Array.isArray(taxonomy.terms)) {
            errors.push(`${prefix}.terms: must be an array`);
          } else {
            const termSlugs = /* @__PURE__ */ new Set();
            for (let j = 0; j < taxonomy.terms.length; j++) {
              const term = taxonomy.terms[j];
              const termPrefix = `${prefix}.terms[${j}]`;
              if (!term.slug) {
                errors.push(`${termPrefix}: slug is required`);
              } else {
                const key = `${term.slug}::${term.locale ?? taxonomy.locale ?? ""}`;
                if (termSlugs.has(key)) {
                  errors.push(
                    `${termPrefix}.slug: duplicate term slug "${term.slug}" in taxonomy "${taxonomy.name}"`
                  );
                }
                termSlugs.add(key);
              }
              if (!term.label) {
                errors.push(`${termPrefix}: label is required`);
              }
              if (term.parent && taxonomy.hierarchical) ; else if (term.parent && !taxonomy.hierarchical) {
                warnings.push(
                  `${termPrefix}.parent: taxonomy "${taxonomy.name}" is not hierarchical, parent will be ignored`
                );
              }
            }
            if (taxonomy.hierarchical && taxonomy.terms) {
              for (let j = 0; j < taxonomy.terms.length; j++) {
                const term = taxonomy.terms[j];
                const termLocale = term.locale ?? taxonomy.locale ?? "";
                if (term.parent && !termSlugs.has(`${term.parent}::${termLocale}`)) {
                  errors.push(
                    `${prefix}.terms[${j}].parent: parent term "${term.parent}" not found in taxonomy`
                  );
                }
                if (term.parent === term.slug) {
                  errors.push(`${prefix}.terms[${j}].parent: term cannot be its own parent`);
                }
              }
            }
          }
        }
      }
    }
  }
  if (seed.menus) {
    if (!Array.isArray(seed.menus)) {
      errors.push("menus must be an array");
    } else {
      const menuNames = /* @__PURE__ */ new Set();
      for (let i = 0; i < seed.menus.length; i++) {
        const menu = seed.menus[i];
        const prefix = `menus[${i}]`;
        if (!menu.name) {
          errors.push(`${prefix}: name is required`);
        } else {
          const key = `${menu.name}::${menu.locale ?? ""}`;
          if (menuNames.has(key)) {
            errors.push(
              menu.locale ? `${prefix}.name: duplicate menu "${menu.name}" in locale "${menu.locale}"` : `${prefix}.name: duplicate menu name "${menu.name}"`
            );
          }
          menuNames.add(key);
        }
        if (!menu.label) {
          errors.push(`${prefix}: label is required`);
        }
        if (!Array.isArray(menu.items)) {
          errors.push(`${prefix}.items: must be an array`);
        } else {
          validateMenuItems(menu.items, prefix, errors);
        }
      }
    }
  }
  if (seed.redirects) {
    if (!Array.isArray(seed.redirects)) {
      errors.push("redirects must be an array");
    } else {
      const redirectSources = /* @__PURE__ */ new Set();
      for (let i = 0; i < seed.redirects.length; i++) {
        const redirect = seed.redirects[i];
        const prefix = `redirects[${i}]`;
        if (!isRecord(redirect)) {
          errors.push(`${prefix}: must be an object`);
          continue;
        }
        const source = typeof redirect.source === "string" ? redirect.source : void 0;
        const destination = typeof redirect.destination === "string" ? redirect.destination : void 0;
        if (!source) {
          errors.push(`${prefix}: source is required`);
        } else {
          if (!isValidRedirectPath(source)) {
            errors.push(
              `${prefix}.source: must be a path starting with / (no protocol-relative URLs, path traversal, or newlines)`
            );
          }
          if (redirectSources.has(source)) {
            errors.push(`${prefix}.source: duplicate redirect source "${source}"`);
          }
          redirectSources.add(source);
        }
        if (!destination) {
          errors.push(`${prefix}: destination is required`);
        } else if (!isValidRedirectPath(destination)) {
          errors.push(
            `${prefix}.destination: must be a path starting with / (no protocol-relative URLs, path traversal, or newlines)`
          );
        }
        if (redirect.type !== void 0) {
          if (typeof redirect.type !== "number" || !REDIRECT_TYPES.has(redirect.type)) {
            errors.push(`${prefix}.type: must be 301, 302, 307, or 308`);
          }
        }
        if (redirect.enabled !== void 0 && typeof redirect.enabled !== "boolean") {
          errors.push(`${prefix}.enabled: must be a boolean`);
        }
        if (redirect.groupName !== void 0 && typeof redirect.groupName !== "string" && redirect.groupName !== null) {
          errors.push(`${prefix}.groupName: must be a string or null`);
        }
      }
    }
  }
  if (seed.widgetAreas) {
    if (!Array.isArray(seed.widgetAreas)) {
      errors.push("widgetAreas must be an array");
    } else {
      const areaNames = /* @__PURE__ */ new Set();
      for (let i = 0; i < seed.widgetAreas.length; i++) {
        const area = seed.widgetAreas[i];
        const prefix = `widgetAreas[${i}]`;
        if (!area.name) {
          errors.push(`${prefix}: name is required`);
        } else {
          if (areaNames.has(area.name)) {
            errors.push(`${prefix}.name: duplicate widget area name "${area.name}"`);
          }
          areaNames.add(area.name);
        }
        if (!area.label) {
          errors.push(`${prefix}: label is required`);
        }
        if (!Array.isArray(area.widgets)) {
          errors.push(`${prefix}.widgets: must be an array`);
        } else {
          for (let j = 0; j < area.widgets.length; j++) {
            const widget = area.widgets[j];
            const widgetPrefix = `${prefix}.widgets[${j}]`;
            if (!widget.type) {
              errors.push(`${widgetPrefix}: type is required`);
            } else if (!["content", "menu", "component"].includes(widget.type)) {
              errors.push(`${widgetPrefix}.type: must be "content", "menu", or "component"`);
            }
            if (widget.type === "menu" && !widget.menuName) {
              errors.push(`${widgetPrefix}: menuName is required for menu widgets`);
            }
            if (widget.type === "component" && !widget.componentId) {
              errors.push(`${widgetPrefix}: componentId is required for component widgets`);
            }
          }
        }
      }
    }
  }
  if (seed.sections) {
    if (!Array.isArray(seed.sections)) {
      errors.push("sections must be an array");
    } else {
      const sectionSlugs = /* @__PURE__ */ new Set();
      for (let i = 0; i < seed.sections.length; i++) {
        const section = seed.sections[i];
        const prefix = `sections[${i}]`;
        if (!section.slug) {
          errors.push(`${prefix}: slug is required`);
        } else {
          if (!SLUG_PATTERN.test(section.slug)) {
            errors.push(
              `${prefix}.slug: must contain only lowercase letters, numbers, and hyphens`
            );
          }
          if (sectionSlugs.has(section.slug)) {
            errors.push(`${prefix}.slug: duplicate section slug "${section.slug}"`);
          }
          sectionSlugs.add(section.slug);
        }
        if (!section.title) {
          errors.push(`${prefix}: title is required`);
        }
        if (!Array.isArray(section.content)) {
          errors.push(`${prefix}.content: must be an array`);
        }
        if (section.source && !["theme", "import"].includes(section.source)) {
          errors.push(`${prefix}.source: must be "theme" or "import"`);
        }
      }
    }
  }
  if (seed.bylines) {
    if (!Array.isArray(seed.bylines)) {
      errors.push("bylines must be an array");
    } else {
      const bylineIds = /* @__PURE__ */ new Set();
      const bylineSlugs = /* @__PURE__ */ new Set();
      for (let i = 0; i < seed.bylines.length; i++) {
        const byline = seed.bylines[i];
        const prefix = `bylines[${i}]`;
        if (!byline.id) {
          errors.push(`${prefix}: id is required`);
        } else {
          if (bylineIds.has(byline.id)) {
            errors.push(`${prefix}.id: duplicate byline id "${byline.id}"`);
          }
          bylineIds.add(byline.id);
        }
        if (!byline.slug) {
          errors.push(`${prefix}: slug is required`);
        } else {
          if (!SLUG_PATTERN.test(byline.slug)) {
            errors.push(
              `${prefix}.slug: must contain only lowercase letters, numbers, and hyphens`
            );
          }
          if (bylineSlugs.has(byline.slug)) {
            errors.push(`${prefix}.slug: duplicate byline slug "${byline.slug}"`);
          }
          bylineSlugs.add(byline.slug);
        }
        if (!byline.displayName) {
          errors.push(`${prefix}: displayName is required`);
        }
      }
    }
  }
  if (seed.content) {
    if (typeof seed.content !== "object" || Array.isArray(seed.content)) {
      errors.push("content must be an object (collection -> entries)");
    } else {
      for (const [collectionSlug, entries] of Object.entries(seed.content)) {
        if (!Array.isArray(entries)) {
          errors.push(`content.${collectionSlug}: must be an array`);
          continue;
        }
        const entryIds = /* @__PURE__ */ new Set();
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const prefix = `content.${collectionSlug}[${i}]`;
          if (!entry.id) {
            errors.push(`${prefix}: id is required`);
          } else {
            if (entryIds.has(entry.id)) {
              errors.push(
                `${prefix}.id: duplicate entry id "${entry.id}" in collection "${collectionSlug}"`
              );
            }
            entryIds.add(entry.id);
          }
          if (!entry.slug) {
            errors.push(`${prefix}: slug is required`);
          }
          if (!entry.data || typeof entry.data !== "object") {
            errors.push(`${prefix}: data must be an object`);
          }
          if (entry.translationOf) {
            if (!entry.locale) {
              errors.push(`${prefix}: locale is required when translationOf is set`);
            }
          }
        }
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (entry.translationOf && !entryIds.has(entry.translationOf)) {
            errors.push(
              `content.${collectionSlug}[${i}].translationOf: references "${entry.translationOf}" which is not in this collection`
            );
          }
        }
      }
    }
  }
  if (seed.menus && seed.content) {
    const allContentIds = /* @__PURE__ */ new Set();
    for (const entries of Object.values(seed.content)) {
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (entry.id) {
            allContentIds.add(entry.id);
          }
        }
      }
    }
    for (const menu of seed.menus) {
      if (Array.isArray(menu.items)) {
        validateMenuItemRefs(menu.items, allContentIds, warnings);
      }
    }
  }
  if (seed.content) {
    const seedBylineIds = new Set((seed.bylines ?? []).map((byline) => byline.id));
    for (const [collectionSlug, entries] of Object.entries(seed.content)) {
      if (!Array.isArray(entries)) continue;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.bylines) continue;
        if (!Array.isArray(entry.bylines)) {
          errors.push(`content.${collectionSlug}[${i}].bylines: must be an array`);
          continue;
        }
        for (let j = 0; j < entry.bylines.length; j++) {
          const credit = entry.bylines[j];
          const prefix = `content.${collectionSlug}[${i}].bylines[${j}]`;
          if (!credit.byline) {
            errors.push(`${prefix}.byline: is required`);
            continue;
          }
          if (!seedBylineIds.has(credit.byline)) {
            errors.push(`${prefix}.byline: references unknown byline "${credit.byline}"`);
          }
        }
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
function validateMenuItems(items, prefix, errors, warnings) {
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const itemPrefix = `${prefix}.items[${i}]`;
    if (!isRecord(raw)) {
      errors.push(`${itemPrefix}: must be an object`);
      continue;
    }
    const item = raw;
    const itemType = typeof item.type === "string" ? item.type : void 0;
    if (!itemType) {
      errors.push(`${itemPrefix}: type is required`);
    } else if (!["custom", "page", "post", "taxonomy", "collection"].includes(itemType)) {
      errors.push(
        `${itemPrefix}.type: must be "custom", "page", "post", "taxonomy", or "collection"`
      );
    }
    if (itemType === "custom" && !item.url) {
      errors.push(`${itemPrefix}: url is required for custom menu items`);
    }
    if ((itemType === "page" || itemType === "post") && !item.ref) {
      errors.push(`${itemPrefix}: ref is required for page/post menu items`);
    }
    if (Array.isArray(item.children)) {
      validateMenuItems(item.children, itemPrefix, errors);
    }
  }
}
function validateMenuItemRefs(items, contentIds, warnings) {
  for (const item of items) {
    if ((item.type === "page" || item.type === "post") && item.ref) {
      if (!contentIds.has(item.ref)) {
        warnings.push(`Menu item references content "${item.ref}" which is not in the seed file`);
      }
    }
    if (item.children) {
      validateMenuItemRefs(item.children, contentIds, warnings);
    }
  }
}

const FILE_EXTENSION_PATTERN = /\.([a-z0-9]+)(?:\?|$)/i;
const EXTENSION_PATTERN = /\.[^.]+$/;
const QUERY_PARAM_PATTERN = /\?.*$/;
const SANITIZE_PATTERN = /[^a-zA-Z0-9_-]/g;
const MULTIPLE_HYPHENS_PATTERN = /-+/g;
async function applySeed(db, seed, options = {}) {
  const validation = validateSeed(seed);
  if (!validation.valid) {
    throw new Error(`Invalid seed file:
${validation.errors.join("\n")}`);
  }
  const {
    includeContent = false,
    storage,
    skipMediaDownload = false,
    onConflict = "skip"
  } = options;
  const result = {
    collections: { created: 0, skipped: 0, updated: 0 },
    fields: { created: 0, skipped: 0, updated: 0 },
    taxonomies: { created: 0, terms: 0 },
    bylines: { created: 0, skipped: 0, updated: 0 },
    menus: { created: 0, items: 0 },
    redirects: { created: 0, skipped: 0, updated: 0 },
    widgetAreas: { created: 0, widgets: 0 },
    sections: { created: 0, skipped: 0, updated: 0 },
    settings: { applied: 0 },
    content: { created: 0, skipped: 0, updated: 0 },
    media: { created: 0, skipped: 0 }
  };
  const mediaContext = {
    db,
    storage: storage ?? null,
    skipMediaDownload,
    mediaCache: /* @__PURE__ */ new Map()
    // Cache downloaded media by URL to avoid re-downloading
  };
  const seedIdMap = /* @__PURE__ */ new Map();
  const seedBylineIdMap = /* @__PURE__ */ new Map();
  if (seed.settings) {
    await setSiteSettings(seed.settings, db);
    result.settings.applied = Object.keys(seed.settings).length;
  }
  if (seed.collections) {
    const registry = new SchemaRegistry(db);
    for (const collection of seed.collections) {
      const existing = await registry.getCollection(collection.slug);
      if (existing) {
        if (onConflict === "error") {
          throw new Error(`Conflict: collection "${collection.slug}" already exists`);
        }
        if (onConflict === "update") {
          await registry.updateCollection(collection.slug, {
            label: collection.label,
            labelSingular: collection.labelSingular,
            description: collection.description,
            icon: collection.icon,
            supports: collection.supports || [],
            urlPattern: collection.urlPattern,
            commentsEnabled: collection.commentsEnabled
          });
          result.collections.updated++;
          for (const field of collection.fields) {
            const existingField = await registry.getField(collection.slug, field.slug);
            if (existingField) {
              await registry.updateField(collection.slug, field.slug, {
                label: field.label,
                required: field.required || false,
                unique: field.unique || false,
                searchable: field.searchable || false,
                defaultValue: field.defaultValue,
                validation: field.validation,
                widget: field.widget,
                options: field.options
              });
              result.fields.updated++;
            } else {
              await registry.createField(collection.slug, {
                slug: field.slug,
                label: field.label,
                type: field.type,
                required: field.required || false,
                unique: field.unique || false,
                searchable: field.searchable || false,
                defaultValue: field.defaultValue,
                validation: field.validation,
                widget: field.widget,
                options: field.options
              });
              result.fields.created++;
            }
          }
          continue;
        }
        result.collections.skipped++;
        result.fields.skipped += collection.fields.length;
        continue;
      }
      await registry.createCollection({
        slug: collection.slug,
        label: collection.label,
        labelSingular: collection.labelSingular,
        description: collection.description,
        icon: collection.icon,
        supports: collection.supports || [],
        source: "seed",
        urlPattern: collection.urlPattern,
        commentsEnabled: collection.commentsEnabled
      });
      result.collections.created++;
      for (const field of collection.fields) {
        await registry.createField(collection.slug, {
          slug: field.slug,
          label: field.label,
          type: field.type,
          required: field.required || false,
          unique: field.unique || false,
          searchable: field.searchable || false,
          defaultValue: field.defaultValue,
          validation: field.validation,
          widget: field.widget,
          options: field.options
        });
        result.fields.created++;
      }
    }
  }
  if (seed.taxonomies) {
    const defSeedIdMap = /* @__PURE__ */ new Map();
    const termSeedIdMap = /* @__PURE__ */ new Map();
    const fallbackLocale = "en";
    for (const taxonomy of seed.taxonomies) {
      const defLocale = taxonomy.locale ?? fallbackLocale;
      const existingDef = await db.selectFrom("_emdash_taxonomy_defs").selectAll().where("name", "=", taxonomy.name).where("locale", "=", defLocale).executeTakeFirst();
      let defId;
      let defTranslationGroup;
      if (existingDef) {
        defId = existingDef.id;
        defTranslationGroup = existingDef.translation_group ?? existingDef.id;
        if (onConflict === "error") {
          throw new Error(`Conflict: taxonomy "${taxonomy.name}" (${defLocale}) already exists`);
        }
        if (onConflict === "update") {
          await db.updateTable("_emdash_taxonomy_defs").set({
            label: taxonomy.label,
            label_singular: taxonomy.labelSingular ?? null,
            hierarchical: taxonomy.hierarchical ? 1 : 0,
            collections: JSON.stringify(taxonomy.collections)
          }).where("id", "=", existingDef.id).execute();
        }
      } else {
        defId = ulid();
        defTranslationGroup = defId;
        if (taxonomy.translationOf) {
          const source = defSeedIdMap.get(taxonomy.translationOf);
          if (source) defTranslationGroup = source.translationGroup;
          else
            console.warn(
              `taxonomy "${taxonomy.name}" (${defLocale}): translationOf "${taxonomy.translationOf}" not found yet; minting a fresh group.`
            );
        }
        await db.insertInto("_emdash_taxonomy_defs").values({
          id: defId,
          name: taxonomy.name,
          label: taxonomy.label,
          label_singular: taxonomy.labelSingular ?? null,
          hierarchical: taxonomy.hierarchical ? 1 : 0,
          collections: JSON.stringify(taxonomy.collections),
          locale: defLocale,
          translation_group: defTranslationGroup
        }).execute();
        result.taxonomies.created++;
      }
      if (taxonomy.id)
        defSeedIdMap.set(taxonomy.id, { id: defId, translationGroup: defTranslationGroup });
      if (taxonomy.terms && taxonomy.terms.length > 0) {
        const termRepo = new TaxonomyRepository(db);
        if (taxonomy.hierarchical) {
          await applyHierarchicalTerms(
            termRepo,
            taxonomy.name,
            defLocale,
            taxonomy.terms,
            termSeedIdMap,
            result,
            onConflict
          );
        } else {
          for (const term of taxonomy.terms) {
            const termLocale = term.locale ?? defLocale;
            const existing = await termRepo.findBySlug(taxonomy.name, term.slug, termLocale);
            if (existing) {
              if (onConflict === "error") {
                throw new Error(
                  `Conflict: taxonomy term "${term.slug}" in "${taxonomy.name}" (${termLocale}) already exists`
                );
              }
              if (onConflict === "update") {
                await termRepo.update(existing.id, {
                  label: term.label,
                  data: term.description ? { description: term.description } : {}
                });
                result.taxonomies.terms++;
              }
              if (term.id) termSeedIdMap.set(term.id, existing.id);
            } else {
              const translationOf = term.translationOf ? termSeedIdMap.get(term.translationOf) : void 0;
              const created = await termRepo.create({
                name: taxonomy.name,
                slug: term.slug,
                label: term.label,
                data: term.description ? { description: term.description } : void 0,
                locale: termLocale,
                translationOf
              });
              if (term.id) termSeedIdMap.set(term.id, created.id);
              result.taxonomies.terms++;
            }
          }
        }
      }
    }
  }
  if (seed.bylines) {
    const bylineRepo = new BylineRepository(db);
    for (const byline of seed.bylines) {
      const existing = await bylineRepo.findBySlug(byline.slug);
      if (existing) {
        if (onConflict === "error") {
          throw new Error(`Conflict: byline "${byline.slug}" already exists`);
        }
        if (onConflict === "update") {
          await bylineRepo.update(existing.id, {
            displayName: byline.displayName,
            bio: byline.bio ?? null,
            websiteUrl: byline.websiteUrl ?? null,
            isGuest: byline.isGuest
          });
          seedBylineIdMap.set(byline.id, existing.id);
          result.bylines.updated++;
          continue;
        }
        seedBylineIdMap.set(byline.id, existing.id);
        result.bylines.skipped++;
        continue;
      }
      const created = await bylineRepo.create({
        slug: byline.slug,
        displayName: byline.displayName,
        bio: byline.bio ?? null,
        websiteUrl: byline.websiteUrl ?? null,
        isGuest: byline.isGuest
      });
      seedBylineIdMap.set(byline.id, created.id);
      result.bylines.created++;
    }
  }
  if (includeContent && seed.content) {
    const contentRepo = new ContentRepository(db);
    for (const [collectionSlug, entries] of Object.entries(seed.content)) {
      for (const entry of entries) {
        const existing = await contentRepo.findBySlug(collectionSlug, entry.slug, entry.locale);
        if (existing) {
          if (onConflict === "error") {
            throw new Error(
              `Conflict: content "${entry.slug}" in "${collectionSlug}" already exists`
            );
          }
          if (onConflict === "update") {
            const resolvedData2 = await resolveReferences(
              entry.data,
              seedIdMap,
              mediaContext,
              result
            );
            const status2 = entry.status || "published";
            await withTransaction(db, async (trx) => {
              const trxContentRepo = new ContentRepository(trx);
              const trxBylineRepo = new BylineRepository(trx);
              const trxRevisionRepo = new RevisionRepository(trx);
              await trxContentRepo.update(collectionSlug, existing.id, {
                status: status2,
                data: resolvedData2
              });
              await applyContentBylines(
                trxBylineRepo,
                collectionSlug,
                existing.id,
                entry,
                seedBylineIdMap,
                true
              );
              await applyContentTaxonomies(trx, collectionSlug, existing.id, entry, true);
              if (status2 === "published") {
                const draft = await trxRevisionRepo.create({
                  collection: collectionSlug,
                  entryId: existing.id,
                  data: resolvedData2
                });
                await trxContentRepo.setDraftRevision(collectionSlug, existing.id, draft.id);
                await trxContentRepo.publish(collectionSlug, existing.id);
              }
            });
            seedIdMap.set(entry.id, existing.id);
            result.content.updated++;
            continue;
          }
          result.content.skipped++;
          seedIdMap.set(entry.id, existing.id);
          continue;
        }
        const resolvedData = await resolveReferences(entry.data, seedIdMap, mediaContext, result);
        let translationOf;
        if (entry.translationOf) {
          const sourceId = seedIdMap.get(entry.translationOf);
          if (!sourceId) {
            console.warn(
              `content.${collectionSlug}: translationOf "${entry.translationOf}" not found (not yet created or missing). Skipping translation link.`
            );
          } else {
            translationOf = sourceId;
          }
        }
        const status = entry.status || "published";
        const created = await withTransaction(db, async (trx) => {
          const trxContentRepo = new ContentRepository(trx);
          const trxBylineRepo = new BylineRepository(trx);
          const item = await trxContentRepo.create({
            type: collectionSlug,
            slug: entry.slug,
            status,
            data: resolvedData,
            locale: entry.locale,
            translationOf,
            publishedAt: status === "published" ? (/* @__PURE__ */ new Date()).toISOString() : null
          });
          await applyContentBylines(trxBylineRepo, collectionSlug, item.id, entry, seedBylineIdMap);
          await applyContentTaxonomies(trx, collectionSlug, item.id, entry, false);
          if (status === "published") {
            await trxContentRepo.publish(collectionSlug, item.id);
          }
          return item;
        });
        seedIdMap.set(entry.id, created.id);
        result.content.created++;
      }
    }
  }
  if (seed.menus) {
    const menuSeedIdMap = /* @__PURE__ */ new Map();
    const itemSeedIdMap = /* @__PURE__ */ new Map();
    const fallbackLocale = "en";
    for (const menu of seed.menus) {
      const locale = menu.locale ?? fallbackLocale;
      let lookup = db.selectFrom("_emdash_menus").selectAll().where("name", "=", menu.name).where("locale", "=", locale);
      const existingMenu = await lookup.executeTakeFirst();
      let menuId;
      let translationGroup;
      if (existingMenu) {
        menuId = existingMenu.id;
        translationGroup = existingMenu.translation_group ?? existingMenu.id;
        await db.deleteFrom("_emdash_menu_items").where("menu_id", "=", menuId).execute();
      } else {
        menuId = ulid();
        translationGroup = menuId;
        if (menu.translationOf) {
          const source = menuSeedIdMap.get(menu.translationOf);
          if (source) translationGroup = source.translationGroup;
          else
            console.warn(
              `menu "${menu.name}" (${locale}): translationOf "${menu.translationOf}" not found yet; minting a fresh group.`
            );
        }
        await db.insertInto("_emdash_menus").values({
          id: menuId,
          name: menu.name,
          label: menu.label,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString(),
          locale,
          translation_group: translationGroup
        }).execute();
        result.menus.created++;
      }
      if (menu.id) menuSeedIdMap.set(menu.id, { id: menuId, translationGroup });
      const itemCount = await applyMenuItems(
        db,
        menuId,
        locale,
        menu.items,
        null,
        // parent_id
        0,
        // sort_order
        seedIdMap,
        itemSeedIdMap
      );
      result.menus.items += itemCount;
    }
  }
  if (seed.redirects) {
    const redirectRepo = new RedirectRepository(db);
    for (const redirect of seed.redirects) {
      const existing = await redirectRepo.findBySource(redirect.source);
      if (existing) {
        if (onConflict === "error") {
          throw new Error(`Conflict: redirect "${redirect.source}" already exists`);
        }
        if (onConflict === "update") {
          await redirectRepo.update(existing.id, {
            destination: redirect.destination,
            type: redirect.type,
            enabled: redirect.enabled,
            groupName: redirect.groupName
          });
          result.redirects.updated++;
          continue;
        }
        result.redirects.skipped++;
        continue;
      }
      await redirectRepo.create({
        source: redirect.source,
        destination: redirect.destination,
        type: redirect.type,
        enabled: redirect.enabled,
        groupName: redirect.groupName
      });
      result.redirects.created++;
    }
  }
  if (seed.widgetAreas) {
    for (const area of seed.widgetAreas) {
      const existingArea = await db.selectFrom("_emdash_widget_areas").selectAll().where("name", "=", area.name).executeTakeFirst();
      let areaId;
      if (existingArea) {
        areaId = existingArea.id;
        await db.deleteFrom("_emdash_widgets").where("area_id", "=", areaId).execute();
      } else {
        areaId = ulid();
        await db.insertInto("_emdash_widget_areas").values({
          id: areaId,
          name: area.name,
          label: area.label,
          description: area.description ?? null
        }).execute();
        result.widgetAreas.created++;
      }
      for (let i = 0; i < area.widgets.length; i++) {
        const widget = area.widgets[i];
        await applyWidget(db, areaId, widget, i);
        result.widgetAreas.widgets++;
      }
    }
  }
  if (seed.sections) {
    for (const section of seed.sections) {
      const existing = await db.selectFrom("_emdash_sections").select("id").where("slug", "=", section.slug).executeTakeFirst();
      if (existing) {
        if (onConflict === "error") {
          throw new Error(`Conflict: section "${section.slug}" already exists`);
        }
        if (onConflict === "update") {
          await db.updateTable("_emdash_sections").set({
            title: section.title,
            description: section.description ?? null,
            keywords: section.keywords ? JSON.stringify(section.keywords) : null,
            content: JSON.stringify(section.content),
            source: section.source || "theme",
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).where("id", "=", existing.id).execute();
          result.sections.updated++;
          continue;
        }
        result.sections.skipped++;
        continue;
      }
      const id = ulid();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.insertInto("_emdash_sections").values({
        id,
        slug: section.slug,
        title: section.title,
        description: section.description ?? null,
        keywords: section.keywords ? JSON.stringify(section.keywords) : null,
        content: JSON.stringify(section.content),
        preview_media_id: null,
        source: section.source || "theme",
        theme_id: section.source === "theme" ? section.slug : null,
        created_at: now,
        updated_at: now
      }).execute();
      result.sections.created++;
    }
  }
  if (seed.collections) {
    const ftsManager = new FTSManager(db);
    for (const collection of seed.collections) {
      if (collection.supports?.includes("search")) {
        const searchableFields = await ftsManager.getSearchableFields(collection.slug);
        if (searchableFields.length > 0) {
          try {
            await ftsManager.enableSearch(collection.slug);
          } catch (err) {
            console.warn(`Failed to enable search for ${collection.slug}:`, err);
          }
        }
      }
    }
  }
  const { invalidateBylineCache } = await import('./index_QNee-ffH.mjs');
  const { invalidateRedirectCache } = await import('./cache_BTiid5_I.mjs');
  const { invalidateUrlPatternCache } = await import('./query_YLWZ2uuM.mjs');
  invalidateBylineCache();
  invalidateRedirectCache();
  invalidateUrlPatternCache();
  return result;
}
async function applyHierarchicalTerms(termRepo, taxonomyName, defLocale, terms, termSeedIdMap, result, onConflict = "skip") {
  const slugToId = /* @__PURE__ */ new Map();
  let remaining = [...terms];
  let maxPasses = 10;
  while (remaining.length > 0 && maxPasses > 0) {
    const processedThisPass = [];
    for (const term of remaining) {
      const termLocale = term.locale ?? defLocale;
      const parentReady = !term.parent || slugToId.has(`${termLocale}::${term.parent}`);
      const translationReady = !term.translationOf || termSeedIdMap.has(term.translationOf);
      if (!parentReady || !translationReady) continue;
      const parentId = term.parent ? slugToId.get(`${termLocale}::${term.parent}`) : void 0;
      const translationOf = term.translationOf ? termSeedIdMap.get(term.translationOf) : void 0;
      const existing = await termRepo.findBySlug(taxonomyName, term.slug, termLocale);
      if (existing) {
        if (onConflict === "error") {
          throw new Error(
            `Conflict: taxonomy term "${term.slug}" in "${taxonomyName}" (${termLocale}) already exists`
          );
        }
        if (onConflict === "update") {
          await termRepo.update(existing.id, {
            label: term.label,
            parentId,
            data: term.description ? { description: term.description } : {}
          });
          result.taxonomies.terms++;
        }
        slugToId.set(`${termLocale}::${term.slug}`, existing.id);
        if (term.id) termSeedIdMap.set(term.id, existing.id);
      } else {
        const created = await termRepo.create({
          name: taxonomyName,
          slug: term.slug,
          label: term.label,
          parentId,
          data: term.description ? { description: term.description } : void 0,
          locale: termLocale,
          translationOf
        });
        slugToId.set(`${termLocale}::${term.slug}`, created.id);
        if (term.id) termSeedIdMap.set(term.id, created.id);
        result.taxonomies.terms++;
      }
      processedThisPass.push(term.slug + "::" + termLocale);
    }
    remaining = remaining.filter(
      (t) => !processedThisPass.includes(t.slug + "::" + (t.locale ?? defLocale))
    );
    maxPasses--;
  }
  if (remaining.length > 0) {
    console.warn(`Could not process ${remaining.length} terms due to missing parents/translations`);
  }
}
async function applyContentBylines(bylineRepo, collectionSlug, contentId, entry, seedBylineIdMap, isUpdate = false) {
  if (!entry.bylines || entry.bylines.length === 0) {
    if (isUpdate) {
      await bylineRepo.setContentBylines(collectionSlug, contentId, []);
    }
    return;
  }
  const credits = entry.bylines.map((credit) => {
    const bylineId = seedBylineIdMap.get(credit.byline);
    if (!bylineId) return null;
    return {
      bylineId,
      roleLabel: credit.roleLabel ?? null
    };
  }).filter((credit) => Boolean(credit));
  if (credits.length !== entry.bylines.length) {
    console.warn(
      `content.${collectionSlug}.${entry.slug}: one or more byline refs could not be resolved`
    );
  }
  if (credits.length > 0 || isUpdate) {
    await bylineRepo.setContentBylines(collectionSlug, contentId, credits);
  }
}
async function applyContentTaxonomies(db, collectionSlug, contentId, entry, isUpdate) {
  if (isUpdate) {
    await db.deleteFrom("content_taxonomies").where("collection", "=", collectionSlug).where("entry_id", "=", contentId).execute();
  }
  if (!entry.taxonomies) {
    if (isUpdate) {
      const { invalidateTermCache: invalidateTermCache2 } = await import('./index_BanegER5.mjs');
      invalidateTermCache2();
    }
    return;
  }
  for (const [taxonomyName, termSlugs] of Object.entries(entry.taxonomies)) {
    const termRepo = new TaxonomyRepository(db);
    for (const termSlug of termSlugs) {
      const term = await termRepo.findBySlug(taxonomyName, termSlug);
      if (term) {
        await termRepo.attachToEntry(collectionSlug, contentId, term.id);
      }
    }
  }
  const { invalidateTermCache } = await import('./index_BanegER5.mjs');
  invalidateTermCache();
}
async function applyMenuItems(db, menuId, locale, items, parentId, startOrder, seedIdMap, itemSeedIdMap) {
  let count = 0;
  let order = startOrder;
  for (const item of items) {
    const itemId = ulid();
    const itemLocale = item.locale ?? locale;
    let referenceId = null;
    let referenceCollection = null;
    if (item.type === "page" || item.type === "post") {
      if (item.ref && seedIdMap.has(item.ref)) {
        referenceId = seedIdMap.get(item.ref);
        referenceCollection = item.collection || `${item.type}s`;
      }
    }
    let translationGroup = itemId;
    if (item.translationOf) {
      const source = itemSeedIdMap.get(item.translationOf);
      if (source) translationGroup = source.translationGroup;
      else
        console.warn(
          `menu item "${item.label ?? item.url ?? item.ref ?? "(unlabeled)"}" (${itemLocale}): translationOf "${item.translationOf}" not found yet; minting a fresh group.`
        );
    }
    await db.insertInto("_emdash_menu_items").values({
      id: itemId,
      menu_id: menuId,
      parent_id: parentId,
      sort_order: order,
      type: item.type,
      reference_collection: referenceCollection,
      reference_id: referenceId,
      custom_url: item.url ?? null,
      label: item.label || "",
      title_attr: item.titleAttr ?? null,
      target: item.target ?? null,
      css_classes: item.cssClasses ?? null,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      locale: itemLocale,
      translation_group: translationGroup
    }).execute();
    if (item.id) itemSeedIdMap.set(item.id, { id: itemId, translationGroup });
    count++;
    order++;
    if (item.children && item.children.length > 0) {
      const childCount = await applyMenuItems(
        db,
        menuId,
        itemLocale,
        item.children,
        itemId,
        0,
        seedIdMap,
        itemSeedIdMap
      );
      count += childCount;
    }
  }
  return count;
}
async function applyWidget(db, areaId, widget, sortOrder) {
  await db.insertInto("_emdash_widgets").values({
    id: ulid(),
    area_id: areaId,
    sort_order: sortOrder,
    type: widget.type,
    title: widget.title ?? null,
    // `widget.content` is Portable Text for content-type widgets;
    // for other widget kinds it's null.
    content: widget.content ? JSON.stringify(widget.content) : null,
    menu_name: widget.menuName ?? null,
    component_id: widget.componentId ?? null,
    component_props: widget.props ? JSON.stringify(widget.props) : null
  }).execute();
}
function isSeedMediaReference(value) {
  if (typeof value !== "object" || value === null || !("$media" in value)) {
    return false;
  }
  const media = value.$media;
  return typeof media === "object" && media !== null && "url" in media && typeof media.url === "string";
}
async function resolveReferences(data, seedIdMap, mediaContext, result) {
  const resolved = {};
  for (const [key, value] of Object.entries(data)) {
    resolved[key] = await resolveValue(value, seedIdMap, mediaContext, result);
  }
  return resolved;
}
async function resolveValue(value, seedIdMap, mediaContext, result) {
  if (typeof value === "string" && value.startsWith("$ref:")) {
    const seedId = value.slice(5);
    return seedIdMap.get(seedId) ?? value;
  }
  if (isSeedMediaReference(value)) {
    return resolveMedia(value, mediaContext, result);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => resolveValue(item, seedIdMap, mediaContext, result)));
  }
  if (typeof value === "object" && value !== null) {
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = await resolveValue(v, seedIdMap, mediaContext, result);
    }
    return resolved;
  }
  return value;
}
async function resolveMedia(ref, ctx, result) {
  const { url, alt, filename, caption } = ref.$media;
  const cached = ctx.mediaCache.get(url);
  if (cached) {
    result.media.skipped++;
    return { ...cached, alt: alt ?? cached.alt };
  }
  if (ctx.skipMediaDownload) {
    const mediaValue = {
      provider: "external",
      id: ulid(),
      src: url,
      alt: alt ?? void 0,
      filename: filename ?? void 0
    };
    ctx.mediaCache.set(url, mediaValue);
    result.media.created++;
    return mediaValue;
  }
  if (!ctx.storage) {
    console.warn(`Skipping $media reference (no storage configured): ${url}`);
    result.media.skipped++;
    return null;
  }
  try {
    validateExternalUrl(url);
    console.log(`  📥 Downloading: ${url}`);
    const response = await ssrfSafeFetch(url, {
      headers: {
        // Some services like Unsplash require a user-agent
        "User-Agent": "EmDash-CMS/1.0"
      }
    });
    if (!response.ok) {
      console.warn(`  ⚠️ Failed to download ${url}: ${response.status}`);
      result.media.skipped++;
      return null;
    }
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const ext = getExtensionFromContentType(contentType) || getExtensionFromUrl(url) || ".bin";
    const id = ulid();
    const finalFilename = filename || generateFilename(url, ext);
    const storageKey = `${id}${ext}`;
    const arrayBuffer = await response.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);
    let width;
    let height;
    if (contentType.startsWith("image/")) {
      const dimensions = getImageDimensions(body);
      width = dimensions?.width;
      height = dimensions?.height;
    }
    await ctx.storage.upload({
      key: storageKey,
      body,
      contentType
    });
    const mediaRepo = new MediaRepository(ctx.db);
    await mediaRepo.create({
      filename: finalFilename,
      mimeType: contentType,
      size: body.length,
      width,
      height,
      alt,
      caption,
      storageKey,
      status: "ready"
    });
    const mediaValue = {
      provider: "local",
      id,
      alt: alt ?? void 0,
      width,
      height,
      mimeType: contentType,
      filename: finalFilename,
      meta: { storageKey }
    };
    ctx.mediaCache.set(url, mediaValue);
    result.media.created++;
    console.log(`  ✅ Uploaded: ${finalFilename}`);
    return mediaValue;
  } catch (error) {
    console.warn(
      `  ⚠️ Error processing $media ${url}:`,
      error instanceof Error ? error.message : error
    );
    result.media.skipped++;
    return null;
  }
}
function getExtensionFromContentType(contentType) {
  const baseMime = contentType.split(";")[0].trim();
  const ext = mime.getExtension(baseMime);
  return ext ? `.${ext}` : null;
}
function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(FILE_EXTENSION_PATTERN);
    return match ? `.${match[1]}` : null;
  } catch {
    return null;
  }
}
function generateFilename(url, ext) {
  try {
    const pathname = new URL(url).pathname;
    const basename = pathname.split("/").pop() || "media";
    const name = basename.replace(EXTENSION_PATTERN, "").replace(QUERY_PARAM_PATTERN, "");
    const sanitized = name.replace(SANITIZE_PATTERN, "-").replace(MULTIPLE_HYPHENS_PATTERN, "-");
    return `${sanitized || "media"}${ext}`;
  } catch {
    return `media${ext}`;
  }
}
function getImageDimensions(buffer) {
  try {
    const result = imageSize(buffer);
    if (result.width != null && result.height != null) {
      return { width: result.width, height: result.height };
    }
    return null;
  } catch {
    return null;
  }
}

const prerender = false;
const POST = async ({ request, url, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    try {
      const options = new OptionsRepository(emdash.db);
      const setupComplete = await options.get("emdash:setup_complete");
      if (setupComplete === true || setupComplete === "true") {
        return apiError("ALREADY_CONFIGURED", "Setup has already been completed", 409);
      }
    } catch {
    }
    const body = await parseBody(request, setupBody);
    if (isParseError(body)) return body;
    try {
      await runMigrations(emdash.db);
    } catch (error) {
      return handleError(error, "Failed to run database migrations", "MIGRATION_ERROR");
    }
    const seed = await loadSeed();
    seed.settings = {
      ...seed.settings,
      title: body.title,
      tagline: body.tagline
    };
    const validation = validateSeed(seed);
    if (!validation.valid) {
      return apiError("INVALID_SEED", `Invalid seed file: ${validation.errors.join(", ")}`, 400);
    }
    let result;
    try {
      result = await applySeed(emdash.db, seed, {
        includeContent: body.includeContent,
        onConflict: "skip",
        storage: emdash.storage ?? void 0
      });
    } catch (error) {
      return handleError(error, "Failed to apply seed", "SEED_ERROR");
    }
    const authMode = getAuthMode(emdash.config);
    const useExternalAuth = authMode.type === "external";
    try {
      const options = new OptionsRepository(emdash.db);
      const siteUrl = getPublicOrigin(url, emdash.config);
      await options.setIfAbsent("emdash:site_url", siteUrl);
      if (useExternalAuth) {
        await options.set("emdash:setup_complete", true);
        await options.set("emdash:site_title", body.title);
        if (body.tagline) {
          await options.set("emdash:site_tagline", body.tagline);
        }
      } else {
        await options.set("emdash:setup_state", {
          step: "site_complete",
          title: body.title,
          tagline: body.tagline
        });
      }
    } catch (error) {
      console.error("Failed to save setup state:", error);
    }
    return apiSuccess({
      success: true,
      // In external auth mode, setup is complete - redirect to admin
      setupComplete: useExternalAuth,
      result
    });
  } catch (error) {
    return handleError(error, "Setup failed", "SETUP_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
