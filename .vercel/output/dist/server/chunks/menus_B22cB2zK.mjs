import { ulid } from 'ulidx';
import { w as withTransaction } from './transaction_DUEGi9iw.mjs';

function getI18nConfig() {
  return null;
}

function ambiguousMenuLocaleError(name, locales) {
  const sortedLocales = locales.toSorted();
  return {
    success: false,
    error: {
      code: "AMBIGUOUS_LOCALE",
      message: `Menu '${name}' exists in multiple locales (${sortedLocales.join(
        ", "
      )}); pass 'locale' to disambiguate.`
    }
  };
}
async function handleMenuList(db, options = {}) {
  try {
    let query = db.selectFrom("_emdash_menus as m").leftJoin("_emdash_menu_items as i", "i.menu_id", "m.id").select(({ fn }) => [
      "m.id",
      "m.name",
      "m.label",
      "m.created_at",
      "m.updated_at",
      "m.locale",
      "m.translation_group",
      fn.count("i.id").as("itemCount")
    ]).groupBy([
      "m.id",
      "m.name",
      "m.label",
      "m.created_at",
      "m.updated_at",
      "m.locale",
      "m.translation_group"
    ]).orderBy("m.name", "asc");
    if (options.locale !== void 0) query = query.where("m.locale", "=", options.locale);
    const rows = await query.execute();
    const menusWithCounts = rows.map((row) => ({
      id: row.id,
      name: row.name,
      label: row.label,
      created_at: row.created_at,
      updated_at: row.updated_at,
      locale: row.locale,
      translation_group: row.translation_group,
      itemCount: typeof row.itemCount === "string" ? Number(row.itemCount) : row.itemCount
    }));
    return { success: true, data: menusWithCounts };
  } catch {
    return {
      success: false,
      error: { code: "MENU_LIST_ERROR", message: "Failed to fetch menus" }
    };
  }
}
async function handleMenuCreate(db, input) {
  try {
    if (input.translationOf && !input.locale) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "`locale` is required when `translationOf` is provided"
        }
      };
    }
    let translationGroup = null;
    let sourceMenu = null;
    if (input.translationOf) {
      const src = await db.selectFrom("_emdash_menus").selectAll().where("id", "=", input.translationOf).executeTakeFirst();
      if (!src) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Source menu for translation not found" }
        };
      }
      sourceMenu = src;
      translationGroup = src.translation_group ?? src.id;
    }
    const effectiveLocale = input.locale ?? getI18nConfig()?.defaultLocale ?? "en";
    const existing = await db.selectFrom("_emdash_menus").select("id").where("name", "=", input.name).where("locale", "=", effectiveLocale).executeTakeFirst();
    if (existing) {
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: `Menu "${input.name}" already exists${input.locale ? ` in locale "${input.locale}"` : ""}`
        }
      };
    }
    const id = ulid();
    await withTransaction(db, async (trx) => {
      await trx.insertInto("_emdash_menus").values({
        id,
        name: input.name,
        label: input.label,
        ...input.locale !== void 0 ? { locale: input.locale } : {},
        translation_group: translationGroup ?? id
      }).execute();
      if (sourceMenu) {
        const sourceItems = await trx.selectFrom("_emdash_menu_items").selectAll().where("menu_id", "=", sourceMenu.id).orderBy("sort_order", "asc").execute();
        if (sourceItems.length > 0) {
          const idMap = /* @__PURE__ */ new Map();
          for (const item of sourceItems) idMap.set(item.id, ulid());
          await trx.insertInto("_emdash_menu_items").values(
            sourceItems.map((item) => {
              const newId = idMap.get(item.id);
              return {
                id: newId,
                menu_id: id,
                parent_id: item.parent_id ? idMap.get(item.parent_id) ?? null : null,
                sort_order: item.sort_order,
                type: item.type,
                reference_collection: item.reference_collection,
                reference_id: item.reference_id,
                custom_url: item.custom_url,
                label: item.label,
                title_attr: item.title_attr,
                target: item.target,
                css_classes: item.css_classes,
                ...input.locale !== void 0 ? { locale: input.locale } : {},
                translation_group: item.translation_group ?? item.id
              };
            })
          ).execute();
        }
      }
    });
    const menu = await db.selectFrom("_emdash_menus").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    return { success: true, data: menu };
  } catch {
    return {
      success: false,
      error: { code: "MENU_CREATE_ERROR", message: "Failed to create menu" }
    };
  }
}
async function handleMenuGet(db, name, options = {}) {
  try {
    let query = db.selectFrom("_emdash_menus").selectAll().where("name", "=", name);
    if (options.locale !== void 0) query = query.where("locale", "=", options.locale);
    const menu = await query.orderBy("locale", "asc").executeTakeFirst();
    if (!menu) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: `Menu '${name}' not found` }
      };
    }
    const items = await db.selectFrom("_emdash_menu_items").selectAll().where("menu_id", "=", menu.id).orderBy("sort_order", "asc").execute();
    return { success: true, data: { ...menu, items } };
  } catch {
    return {
      success: false,
      error: { code: "MENU_GET_ERROR", message: "Failed to fetch menu" }
    };
  }
}
async function handleMenuGetById(db, id) {
  try {
    const menu = await db.selectFrom("_emdash_menus").selectAll().where("id", "=", id).executeTakeFirst();
    if (!menu) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: `Menu '${id}' not found` }
      };
    }
    const items = await db.selectFrom("_emdash_menu_items").selectAll().where("menu_id", "=", menu.id).orderBy("sort_order", "asc").execute();
    return { success: true, data: { ...menu, items } };
  } catch {
    return {
      success: false,
      error: { code: "MENU_GET_ERROR", message: "Failed to fetch menu" }
    };
  }
}
async function handleMenuUpdate(db, name, input) {
  try {
    let query = db.selectFrom("_emdash_menus").select(["id", "locale"]).where("name", "=", name);
    if (input.locale !== void 0) query = query.where("locale", "=", input.locale);
    const matches = await query.execute();
    if (matches.length === 0) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Menu '${name}' not found${input.locale ? ` in locale '${input.locale}'` : ""}`
        }
      };
    }
    if (matches.length > 1) {
      return ambiguousMenuLocaleError(
        name,
        matches.map((m) => m.locale)
      );
    }
    const menu = matches[0];
    if (input.label) {
      await db.updateTable("_emdash_menus").set({ label: input.label }).where("id", "=", menu.id).execute();
    }
    const updated = await db.selectFrom("_emdash_menus").selectAll().where("id", "=", menu.id).executeTakeFirstOrThrow();
    return { success: true, data: updated };
  } catch {
    return {
      success: false,
      error: { code: "MENU_UPDATE_ERROR", message: "Failed to update menu" }
    };
  }
}
async function handleMenuDelete(db, name, options = {}) {
  try {
    let query = db.selectFrom("_emdash_menus").select(["id", "locale"]).where("name", "=", name);
    if (options.locale !== void 0) query = query.where("locale", "=", options.locale);
    const matches = await query.execute();
    if (matches.length === 0) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Menu '${name}' not found${options.locale ? ` in locale '${options.locale}'` : ""}`
        }
      };
    }
    if (matches.length > 1) {
      return ambiguousMenuLocaleError(
        name,
        matches.map((m) => m.locale)
      );
    }
    const menu = matches[0];
    await db.deleteFrom("_emdash_menu_items").where("menu_id", "=", menu.id).execute();
    await db.deleteFrom("_emdash_menus").where("id", "=", menu.id).execute();
    return { success: true, data: { deleted: true } };
  } catch {
    return {
      success: false,
      error: { code: "MENU_DELETE_ERROR", message: "Failed to delete menu" }
    };
  }
}
async function handleMenuTranslations(db, idOrGroup) {
  try {
    const anchor = await db.selectFrom("_emdash_menus").selectAll().where((eb) => eb.or([eb("id", "=", idOrGroup), eb("translation_group", "=", idOrGroup)])).executeTakeFirst();
    if (!anchor) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Menu not found" }
      };
    }
    const group = anchor.translation_group ?? anchor.id;
    const rows = await db.selectFrom("_emdash_menus").selectAll().where("translation_group", "=", group).orderBy("locale", "asc").execute();
    return {
      success: true,
      data: {
        translationGroup: group,
        translations: rows.map((row) => ({
          id: row.id,
          name: row.name,
          locale: row.locale,
          label: row.label,
          updatedAt: row.updated_at
        }))
      }
    };
  } catch {
    return {
      success: false,
      error: { code: "MENU_TRANSLATIONS_ERROR", message: "Failed to list menu translations" }
    };
  }
}
async function handleMenuItemCreate(db, menuName, input, options = {}) {
  try {
    let menuQuery = db.selectFrom("_emdash_menus").select(["id", "locale"]).where("name", "=", menuName);
    if (options.locale !== void 0) menuQuery = menuQuery.where("locale", "=", options.locale);
    const matches = await menuQuery.execute();
    if (matches.length === 0) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Menu not found" }
      };
    }
    if (matches.length > 1) {
      return ambiguousMenuLocaleError(
        menuName,
        matches.map((m) => m.locale)
      );
    }
    const menu = matches[0];
    let sortOrder = input.sortOrder ?? 0;
    if (input.sortOrder === void 0) {
      const maxOrder = await db.selectFrom("_emdash_menu_items").select(({ fn }) => fn.max("sort_order").as("max")).where("menu_id", "=", menu.id).where("parent_id", "is", input.parentId ?? null).executeTakeFirst();
      sortOrder = (maxOrder?.max ?? -1) + 1;
    }
    const id = ulid();
    await db.insertInto("_emdash_menu_items").values({
      id,
      menu_id: menu.id,
      parent_id: input.parentId ?? null,
      sort_order: sortOrder,
      type: input.type,
      reference_collection: input.referenceCollection ?? null,
      reference_id: input.referenceId ?? null,
      custom_url: input.customUrl ?? null,
      label: input.label,
      title_attr: input.titleAttr ?? null,
      target: input.target ?? null,
      css_classes: input.cssClasses ?? null,
      locale: menu.locale,
      translation_group: id
    }).execute();
    const item = await db.selectFrom("_emdash_menu_items").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    return { success: true, data: item };
  } catch {
    return {
      success: false,
      error: { code: "MENU_ITEM_CREATE_ERROR", message: "Failed to create menu item" }
    };
  }
}
async function handleMenuItemUpdate(db, menuName, itemId, input, options = {}) {
  try {
    let menuQuery = db.selectFrom("_emdash_menus").select(["id", "locale"]).where("name", "=", menuName);
    if (options.locale !== void 0) menuQuery = menuQuery.where("locale", "=", options.locale);
    const matches = await menuQuery.execute();
    if (matches.length === 0) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Menu not found" }
      };
    }
    if (matches.length > 1) {
      return ambiguousMenuLocaleError(
        menuName,
        matches.map((m) => m.locale)
      );
    }
    const menu = matches[0];
    const item = await db.selectFrom("_emdash_menu_items").select("id").where("id", "=", itemId).where("menu_id", "=", menu.id).executeTakeFirst();
    if (!item) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Menu item not found" }
      };
    }
    const updates = {};
    if (input.label !== void 0) updates.label = input.label;
    if (input.customUrl !== void 0) updates.custom_url = input.customUrl;
    if (input.target !== void 0) updates.target = input.target;
    if (input.titleAttr !== void 0) updates.title_attr = input.titleAttr;
    if (input.cssClasses !== void 0) updates.css_classes = input.cssClasses;
    if (input.parentId !== void 0) updates.parent_id = input.parentId;
    if (input.sortOrder !== void 0) updates.sort_order = input.sortOrder;
    if (Object.keys(updates).length > 0) {
      await db.updateTable("_emdash_menu_items").set(updates).where("id", "=", itemId).execute();
    }
    const updated = await db.selectFrom("_emdash_menu_items").selectAll().where("id", "=", itemId).executeTakeFirstOrThrow();
    return { success: true, data: updated };
  } catch {
    return {
      success: false,
      error: { code: "MENU_ITEM_UPDATE_ERROR", message: "Failed to update menu item" }
    };
  }
}
async function handleMenuItemDelete(db, menuName, itemId, options = {}) {
  try {
    let menuQuery = db.selectFrom("_emdash_menus").select(["id", "locale"]).where("name", "=", menuName);
    if (options.locale !== void 0) menuQuery = menuQuery.where("locale", "=", options.locale);
    const matches = await menuQuery.execute();
    if (matches.length === 0) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Menu not found" }
      };
    }
    if (matches.length > 1) {
      return ambiguousMenuLocaleError(
        menuName,
        matches.map((m) => m.locale)
      );
    }
    const menu = matches[0];
    const result = await db.deleteFrom("_emdash_menu_items").where("id", "=", itemId).where("menu_id", "=", menu.id).execute();
    if (result[0]?.numDeletedRows === 0n) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Menu item not found" }
      };
    }
    return { success: true, data: { deleted: true } };
  } catch {
    return {
      success: false,
      error: { code: "MENU_ITEM_DELETE_ERROR", message: "Failed to delete menu item" }
    };
  }
}
async function handleMenuSetItems(db, menuName, items, options = {}) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.parentIndex !== void 0) {
      if (item.parentIndex < 0 || item.parentIndex >= i) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `item[${i}].parentIndex (${item.parentIndex}) must reference an earlier item`
          }
        };
      }
    }
  }
  try {
    const notFoundSentinel = /* @__PURE__ */ Symbol("menu-not-found");
    let ambiguousLocales = null;
    const ambiguousSentinel = /* @__PURE__ */ Symbol("menu-ambiguous-locale");
    try {
      await withTransaction(db, async (trx) => {
        let menuQuery = trx.selectFrom("_emdash_menus").select(["id", "locale"]).where("name", "=", menuName);
        if (options.locale !== void 0) {
          menuQuery = menuQuery.where("locale", "=", options.locale);
        }
        const matches = await menuQuery.execute();
        if (matches.length === 0) {
          throw notFoundSentinel;
        }
        if (matches.length > 1) {
          ambiguousLocales = matches.map((m) => m.locale);
          throw ambiguousSentinel;
        }
        const menu = matches[0];
        await trx.deleteFrom("_emdash_menu_items").where("menu_id", "=", menu.id).execute();
        const insertedIds = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item) continue;
          const id = ulid();
          const parentId = item.parentIndex !== void 0 ? insertedIds[item.parentIndex] ?? null : null;
          await trx.insertInto("_emdash_menu_items").values({
            id,
            menu_id: menu.id,
            parent_id: parentId,
            sort_order: i,
            type: item.type,
            reference_collection: item.referenceCollection ?? null,
            reference_id: item.referenceId ?? null,
            custom_url: item.customUrl ?? null,
            label: item.label,
            title_attr: item.titleAttr ?? null,
            target: item.target ?? null,
            css_classes: item.cssClasses ?? null,
            locale: menu.locale
          }).execute();
          insertedIds.push(id);
        }
        await trx.updateTable("_emdash_menus").set({ updated_at: (/* @__PURE__ */ new Date()).toISOString() }).where("id", "=", menu.id).execute();
      });
    } catch (error) {
      if (error === notFoundSentinel) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Menu '${menuName}' not found${options.locale ? ` in locale '${options.locale}'` : ""}`
          }
        };
      }
      if (error === ambiguousSentinel && ambiguousLocales) {
        return ambiguousMenuLocaleError(menuName, ambiguousLocales);
      }
      throw error;
    }
    return { success: true, data: { name: menuName, itemCount: items.length } };
  } catch (error) {
    console.error("[emdash] handleMenuSetItems failed:", error);
    return {
      success: false,
      error: { code: "MENU_SET_ITEMS_ERROR", message: "Failed to set menu items" }
    };
  }
}
async function handleMenuItemReorder(db, menuName, items, options = {}) {
  try {
    let menuQuery = db.selectFrom("_emdash_menus").select(["id", "locale"]).where("name", "=", menuName);
    if (options.locale !== void 0) menuQuery = menuQuery.where("locale", "=", options.locale);
    const matches = await menuQuery.execute();
    if (matches.length === 0) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Menu not found" }
      };
    }
    if (matches.length > 1) {
      return ambiguousMenuLocaleError(
        menuName,
        matches.map((m) => m.locale)
      );
    }
    const menu = matches[0];
    const updatedItems = await withTransaction(db, async (trx) => {
      for (const item of items) {
        await trx.updateTable("_emdash_menu_items").set({
          parent_id: item.parentId,
          sort_order: item.sortOrder
        }).where("id", "=", item.id).where("menu_id", "=", menu.id).execute();
      }
      return trx.selectFrom("_emdash_menu_items").selectAll().where("menu_id", "=", menu.id).orderBy("sort_order", "asc").execute();
    });
    return { success: true, data: updatedItems };
  } catch {
    return {
      success: false,
      error: { code: "MENU_REORDER_ERROR", message: "Failed to reorder menu items" }
    };
  }
}

export { handleMenuCreate, handleMenuDelete, handleMenuGet, handleMenuGetById, handleMenuItemCreate, handleMenuItemDelete, handleMenuItemReorder, handleMenuItemUpdate, handleMenuList, handleMenuSetItems, handleMenuTranslations, handleMenuUpdate };
