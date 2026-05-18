import { ulid } from 'ulidx';
import { TaxonomyRepository } from './taxonomy_CAMPWGuD.mjs';
import { invalidateTermCache } from './index_BanegER5.mjs';

const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
function buildTree(flatTerms) {
  const map = /* @__PURE__ */ new Map();
  const roots = [];
  for (const term of flatTerms) map.set(term.id, term);
  for (const term of flatTerms) {
    if (term.parentId && map.has(term.parentId)) {
      map.get(term.parentId).children.push(term);
    } else {
      roots.push(term);
    }
  }
  return roots;
}
async function requireTaxonomyDef(db, name, locale) {
  let query = db.selectFrom("_emdash_taxonomy_defs").selectAll().where("name", "=", name);
  const def = await query.orderBy("locale", "asc").executeTakeFirst();
  if (!def) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: `Taxonomy '${name}' not found` }
    };
  }
  return { success: true, def };
}
function rowToDef(row) {
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    labelSingular: row.label_singular ?? void 0,
    hierarchical: row.hierarchical === 1,
    collections: row.collections ? JSON.parse(row.collections) : [],
    locale: row.locale,
    translationGroup: row.translation_group
  };
}
async function handleTaxonomyList(db, options = {}) {
  try {
    let query = db.selectFrom("_emdash_taxonomy_defs").selectAll();
    if (options.locale !== void 0) query = query.where("locale", "=", options.locale);
    const [rows, collectionRows] = await Promise.all([
      query.execute(),
      db.selectFrom("_emdash_collections").select("slug").execute()
    ]);
    const realCollections = new Set(collectionRows.map((r) => r.slug));
    const taxonomies = rows.map((row) => {
      const def = rowToDef(row);
      return { ...def, collections: def.collections.filter((slug) => realCollections.has(slug)) };
    });
    return { success: true, data: { taxonomies } };
  } catch {
    return {
      success: false,
      error: { code: "TAXONOMY_LIST_ERROR", message: "Failed to list taxonomies" }
    };
  }
}
async function handleTaxonomyCreate(db, input) {
  try {
    if (!NAME_PATTERN.test(input.name)) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Taxonomy name must start with a letter and contain only lowercase letters, numbers, and underscores"
        }
      };
    }
    const collections = [...new Set(input.collections ?? [])];
    if (collections.length > 0) {
      const existingCollections = await db.selectFrom("_emdash_collections").select("slug").where("slug", "in", collections).execute();
      const existingSlugs = new Set(existingCollections.map((c) => c.slug));
      const invalid = collections.filter((c) => !existingSlugs.has(c));
      if (invalid.length > 0) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Unknown collection(s): ${invalid.join(", ")}`
          }
        };
      }
    }
    let translationGroup = null;
    if (input.translationOf) {
      const source = await db.selectFrom("_emdash_taxonomy_defs").selectAll().where("id", "=", input.translationOf).executeTakeFirst();
      if (!source) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Source taxonomy for translation not found" }
        };
      }
      translationGroup = source.translation_group ?? source.id;
    }
    if (input.locale !== void 0) {
      const existing = await db.selectFrom("_emdash_taxonomy_defs").select("id").where("name", "=", input.name).where("locale", "=", input.locale).executeTakeFirst();
      if (existing) {
        return {
          success: false,
          error: {
            code: "CONFLICT",
            message: `Taxonomy '${input.name}' already exists in locale '${input.locale}'`
          }
        };
      }
    }
    const id = ulid();
    await db.insertInto("_emdash_taxonomy_defs").values({
      id,
      name: input.name,
      label: input.label,
      label_singular: input.labelSingular ?? null,
      hierarchical: input.hierarchical ? 1 : 0,
      collections: JSON.stringify(collections),
      ...input.locale !== void 0 ? { locale: input.locale } : {},
      translation_group: translationGroup ?? id
    }).execute();
    const row = await db.selectFrom("_emdash_taxonomy_defs").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    return { success: true, data: { taxonomy: rowToDef(row) } };
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return {
        success: false,
        error: { code: "CONFLICT", message: `Taxonomy '${input.name}' already exists` }
      };
    }
    return {
      success: false,
      error: { code: "TAXONOMY_CREATE_ERROR", message: "Failed to create taxonomy" }
    };
  }
}
async function handleTaxonomyDefTranslations(db, idOrGroup) {
  try {
    const anchor = await db.selectFrom("_emdash_taxonomy_defs").selectAll().where((eb) => eb.or([eb("id", "=", idOrGroup), eb("translation_group", "=", idOrGroup)])).executeTakeFirst();
    if (!anchor) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Taxonomy not found" }
      };
    }
    const group = anchor.translation_group ?? anchor.id;
    const rows = await db.selectFrom("_emdash_taxonomy_defs").selectAll().where("translation_group", "=", group).orderBy("locale", "asc").execute();
    return {
      success: true,
      data: {
        translationGroup: group,
        translations: rows.map((r) => ({
          id: r.id,
          name: r.name,
          label: r.label,
          locale: r.locale
        }))
      }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "TAXONOMY_TRANSLATIONS_ERROR",
        message: "Failed to list taxonomy translations"
      }
    };
  }
}
async function handleTermList(db, taxonomyName, options = {}) {
  try {
    const lookup = await requireTaxonomyDef(db, taxonomyName);
    if (!lookup.success) return lookup;
    const repo = new TaxonomyRepository(db);
    const terms = await repo.findByName(taxonomyName, { locale: options.locale });
    const groups = terms.map((t) => t.translationGroup ?? t.id);
    const countsByGroup = await repo.countEntriesForTerms(groups);
    const termData = terms.map((term) => ({
      id: term.id,
      name: term.name,
      slug: term.slug,
      label: term.label,
      parentId: term.parentId,
      description: typeof term.data?.description === "string" ? term.data.description : void 0,
      children: [],
      count: countsByGroup.get(term.translationGroup ?? term.id) ?? 0,
      locale: term.locale,
      translationGroup: term.translationGroup
    }));
    const isHierarchical = lookup.def.hierarchical === 1;
    const result = isHierarchical ? buildTree(termData) : termData;
    return { success: true, data: { terms: result } };
  } catch {
    return {
      success: false,
      error: { code: "TERM_LIST_ERROR", message: "Failed to list terms" }
    };
  }
}
async function validateParentTerm(repo, taxonomyName, termId, parentId) {
  if (parentId === void 0 || parentId === null) return null;
  if (termId !== void 0 && parentId === termId) {
    return {
      code: "VALIDATION_ERROR",
      message: "A term cannot be its own parent"
    };
  }
  const parent = await repo.findById(parentId);
  if (!parent) {
    return {
      code: "VALIDATION_ERROR",
      message: `Parent term '${parentId}' not found`
    };
  }
  if (parent.name !== taxonomyName) {
    return {
      code: "VALIDATION_ERROR",
      message: `Parent term '${parentId}' belongs to taxonomy '${parent.name}', not '${taxonomyName}'`
    };
  }
  const MAX_DEPTH = 100;
  let cursor = parent.parentId;
  let steps = 0;
  while (cursor !== null && steps < MAX_DEPTH) {
    if (termId !== void 0 && cursor === termId) {
      return {
        code: "VALIDATION_ERROR",
        message: "Cycle detected: cannot make a descendant the parent"
      };
    }
    const next = await repo.findById(cursor);
    if (!next) break;
    cursor = next.parentId;
    steps++;
  }
  if (cursor !== null && steps >= MAX_DEPTH) {
    return {
      code: "VALIDATION_ERROR",
      message: "Parent chain exceeds maximum depth"
    };
  }
  return null;
}
async function handleTermCreate(db, taxonomyName, input) {
  try {
    const lookup = await requireTaxonomyDef(db, taxonomyName);
    if (!lookup.success) return lookup;
    const repo = new TaxonomyRepository(db);
    let parentId = input.parentId === "" || input.parentId === void 0 ? void 0 : input.parentId;
    const existing = await repo.findBySlug(taxonomyName, input.slug, input.locale);
    if (existing) {
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: input.locale ? `Term '${input.slug}' already exists in '${taxonomyName}' (${input.locale})` : `Term with slug '${input.slug}' already exists in taxonomy '${taxonomyName}'`
        }
      };
    }
    if (input.translationOf && parentId) {
      const source = await repo.findById(input.translationOf);
      if (source?.parentId === parentId && input.locale) {
        const sourceParent = await repo.findById(parentId);
        if (sourceParent?.translationGroup) {
          const translatedParent = await db.selectFrom("taxonomies").select("id").where("translation_group", "=", sourceParent.translationGroup).where("locale", "=", input.locale).executeTakeFirst();
          if (translatedParent) parentId = translatedParent.id;
        }
      }
    }
    const parentError = await validateParentTerm(repo, taxonomyName, void 0, parentId);
    if (parentError) {
      return { success: false, error: parentError };
    }
    const term = await repo.create({
      name: taxonomyName,
      slug: input.slug,
      label: input.label,
      parentId: parentId ?? void 0,
      data: input.description ? { description: input.description } : void 0,
      locale: input.locale,
      translationOf: input.translationOf
    });
    invalidateTermCache();
    return {
      success: true,
      data: {
        term: {
          id: term.id,
          name: term.name,
          slug: term.slug,
          label: term.label,
          parentId: term.parentId,
          description: typeof term.data?.description === "string" ? term.data.description : void 0,
          locale: term.locale,
          translationGroup: term.translationGroup
        }
      }
    };
  } catch {
    return {
      success: false,
      error: { code: "TERM_CREATE_ERROR", message: "Failed to create term" }
    };
  }
}
async function handleTermGet(db, taxonomyName, termSlug, options = {}) {
  try {
    const repo = new TaxonomyRepository(db);
    const term = await repo.findBySlug(taxonomyName, termSlug, options.locale);
    if (!term) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Term '${termSlug}' not found in taxonomy '${taxonomyName}'`
        }
      };
    }
    const count = await repo.countEntriesWithTerm(term.id);
    const children = await repo.findChildren(term.id);
    return {
      success: true,
      data: {
        term: {
          id: term.id,
          name: term.name,
          slug: term.slug,
          label: term.label,
          parentId: term.parentId,
          description: typeof term.data?.description === "string" ? term.data.description : void 0,
          count,
          children: children.map((c) => ({ id: c.id, slug: c.slug, label: c.label })),
          locale: term.locale,
          translationGroup: term.translationGroup
        }
      }
    };
  } catch {
    return {
      success: false,
      error: { code: "TERM_GET_ERROR", message: "Failed to get term" }
    };
  }
}
async function handleTermTranslations(db, idOrGroup) {
  try {
    const anchor = await db.selectFrom("taxonomies").selectAll().where((eb) => eb.or([eb("id", "=", idOrGroup), eb("translation_group", "=", idOrGroup)])).executeTakeFirst();
    if (!anchor) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Term not found" }
      };
    }
    const group = anchor.translation_group ?? anchor.id;
    const rows = await db.selectFrom("taxonomies").selectAll().where("translation_group", "=", group).orderBy("locale", "asc").execute();
    return {
      success: true,
      data: {
        translationGroup: group,
        translations: rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          label: r.label,
          locale: r.locale
        }))
      }
    };
  } catch {
    return {
      success: false,
      error: { code: "TERM_TRANSLATIONS_ERROR", message: "Failed to list term translations" }
    };
  }
}
async function handleTermUpdate(db, taxonomyName, termSlug, input, options = {}) {
  try {
    const repo = new TaxonomyRepository(db);
    const term = await repo.findBySlug(taxonomyName, termSlug, options.locale);
    if (!term) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Term '${termSlug}' not found in taxonomy '${taxonomyName}'`
        }
      };
    }
    const newSlug = input.slug === "" || input.slug === void 0 ? void 0 : input.slug;
    const newParentId = input.parentId === "" || input.parentId === void 0 ? void 0 : input.parentId;
    if (newSlug !== void 0 && newSlug !== termSlug) {
      const existing = await repo.findBySlug(taxonomyName, newSlug, options.locale);
      if (existing && existing.id !== term.id) {
        return {
          success: false,
          error: {
            code: "CONFLICT",
            message: `Term with slug '${newSlug}' already exists in taxonomy '${taxonomyName}'`
          }
        };
      }
    }
    const parentError = await validateParentTerm(repo, taxonomyName, term.id, newParentId);
    if (parentError) {
      return { success: false, error: parentError };
    }
    const updated = await repo.update(term.id, {
      slug: newSlug,
      label: input.label,
      parentId: newParentId,
      data: input.description !== void 0 ? { description: input.description } : void 0
    });
    invalidateTermCache();
    if (!updated) {
      return {
        success: false,
        error: { code: "TERM_UPDATE_ERROR", message: "Failed to update term" }
      };
    }
    return {
      success: true,
      data: {
        term: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          label: updated.label,
          parentId: updated.parentId,
          description: typeof updated.data?.description === "string" ? updated.data.description : void 0,
          locale: updated.locale,
          translationGroup: updated.translationGroup
        }
      }
    };
  } catch {
    return {
      success: false,
      error: { code: "TERM_UPDATE_ERROR", message: "Failed to update term" }
    };
  }
}
async function handleTermDelete(db, taxonomyName, termSlug, options = {}) {
  try {
    const repo = new TaxonomyRepository(db);
    const term = await repo.findBySlug(taxonomyName, termSlug, options.locale);
    if (!term) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Term '${termSlug}' not found in taxonomy '${taxonomyName}'`
        }
      };
    }
    const children = await repo.findChildren(term.id);
    if (children.length > 0) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Cannot delete term with children. Delete children first."
        }
      };
    }
    const deleted = await repo.delete(term.id);
    if (!deleted) {
      return {
        success: false,
        error: { code: "TERM_DELETE_ERROR", message: "Failed to delete term" }
      };
    }
    invalidateTermCache();
    return { success: true, data: { deleted: true } };
  } catch {
    return {
      success: false,
      error: { code: "TERM_DELETE_ERROR", message: "Failed to delete term" }
    };
  }
}

export { handleTaxonomyCreate, handleTaxonomyDefTranslations, handleTaxonomyList, handleTermCreate, handleTermDelete, handleTermGet, handleTermList, handleTermTranslations, handleTermUpdate };
