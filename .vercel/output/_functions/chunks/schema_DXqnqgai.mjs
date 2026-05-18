import { SchemaRegistry, SchemaError } from './registry_5tlwwm-G.mjs';
import 'kysely';
import './request-context_Dj39IhTD.mjs';
import './request-cache_BRmSfhRF.mjs';

async function handleSchemaCollectionList(db) {
  try {
    const registry = new SchemaRegistry(db);
    const items = await registry.listCollections();
    return {
      success: true,
      data: { items }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "SCHEMA_LIST_ERROR",
        message: "Failed to list collections"
      }
    };
  }
}
async function handleSchemaCollectionGet(db, slug, options) {
  try {
    const registry = new SchemaRegistry(db);
    if (options?.includeFields) {
      const item2 = await registry.getCollectionWithFields(slug);
      if (!item2) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Collection not found: ${slug}`
          }
        };
      }
      return {
        success: true,
        data: { item: item2 }
      };
    }
    const item = await registry.getCollection(slug);
    if (!item) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Collection not found: ${slug}`
        }
      };
    }
    return {
      success: true,
      data: { item }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "SCHEMA_GET_ERROR",
        message: "Failed to get collection"
      }
    };
  }
}
async function handleSchemaCollectionCreate(db, input) {
  try {
    const registry = new SchemaRegistry(db);
    const item = await registry.createCollection(input);
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }
    console.error("[emdash] Failed to create collection:", error);
    return {
      success: false,
      error: {
        code: "SCHEMA_CREATE_ERROR",
        message: "Failed to create collection"
      }
    };
  }
}
async function handleSchemaCollectionUpdate(db, slug, input) {
  try {
    const registry = new SchemaRegistry(db);
    const item = await registry.updateCollection(slug, input);
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }
    return {
      success: false,
      error: {
        code: "SCHEMA_UPDATE_ERROR",
        message: "Failed to update collection"
      }
    };
  }
}
async function handleSchemaCollectionDelete(db, slug, options) {
  try {
    const registry = new SchemaRegistry(db);
    await registry.deleteCollection(slug, options);
    return {
      success: true,
      data: { success: true }
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }
    return {
      success: false,
      error: {
        code: "SCHEMA_DELETE_ERROR",
        message: "Failed to delete collection"
      }
    };
  }
}
async function handleSchemaFieldList(db, collectionSlug) {
  try {
    const registry = new SchemaRegistry(db);
    const collection = await registry.getCollection(collectionSlug);
    if (!collection) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Collection not found: ${collectionSlug}`
        }
      };
    }
    const items = await registry.listFields(collection.id);
    return {
      success: true,
      data: { items }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "SCHEMA_FIELD_LIST_ERROR",
        message: "Failed to list fields"
      }
    };
  }
}
async function handleSchemaFieldGet(db, collectionSlug, fieldSlug) {
  try {
    const registry = new SchemaRegistry(db);
    const item = await registry.getField(collectionSlug, fieldSlug);
    if (!item) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Field not found: ${fieldSlug} in collection ${collectionSlug}`
        }
      };
    }
    return {
      success: true,
      data: { item }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "SCHEMA_FIELD_GET_ERROR",
        message: "Failed to get field"
      }
    };
  }
}
async function handleSchemaFieldCreate(db, collectionSlug, input) {
  try {
    const registry = new SchemaRegistry(db);
    const item = await registry.createField(collectionSlug, input);
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }
    return {
      success: false,
      error: {
        code: "SCHEMA_FIELD_CREATE_ERROR",
        message: "Failed to create field"
      }
    };
  }
}
async function handleSchemaFieldUpdate(db, collectionSlug, fieldSlug, input) {
  try {
    const registry = new SchemaRegistry(db);
    const item = await registry.updateField(collectionSlug, fieldSlug, input);
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }
    return {
      success: false,
      error: {
        code: "SCHEMA_FIELD_UPDATE_ERROR",
        message: "Failed to update field"
      }
    };
  }
}
async function handleSchemaFieldDelete(db, collectionSlug, fieldSlug) {
  try {
    const registry = new SchemaRegistry(db);
    await registry.deleteField(collectionSlug, fieldSlug);
    return {
      success: true,
      data: { success: true }
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }
    return {
      success: false,
      error: {
        code: "SCHEMA_FIELD_DELETE_ERROR",
        message: "Failed to delete field"
      }
    };
  }
}
async function handleSchemaFieldReorder(db, collectionSlug, fieldSlugs) {
  try {
    const registry = new SchemaRegistry(db);
    await registry.reorderFields(collectionSlug, fieldSlugs);
    return {
      success: true,
      data: { success: true }
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }
    return {
      success: false,
      error: {
        code: "SCHEMA_FIELD_REORDER_ERROR",
        message: "Failed to reorder fields"
      }
    };
  }
}
async function handleOrphanedTableList(db) {
  try {
    const registry = new SchemaRegistry(db);
    const items = await registry.discoverOrphanedTables();
    return {
      success: true,
      data: { items }
    };
  } catch (error) {
    console.error("[emdash] Failed to list orphaned tables:", error);
    return {
      success: false,
      error: {
        code: "ORPHAN_LIST_ERROR",
        message: "Failed to list orphaned tables"
      }
    };
  }
}
async function handleOrphanedTableRegister(db, slug, options) {
  try {
    const registry = new SchemaRegistry(db);
    const item = await registry.registerOrphanedTable(slug, options);
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof SchemaError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }
    return {
      success: false,
      error: {
        code: "ORPHAN_REGISTER_ERROR",
        message: "Failed to register orphaned table"
      }
    };
  }
}

export { handleSchemaFieldDelete as a, handleSchemaFieldGet as b, handleSchemaFieldUpdate as c, handleSchemaFieldList as d, handleSchemaFieldCreate as e, handleSchemaCollectionDelete as f, handleSchemaCollectionGet as g, handleSchemaFieldReorder as h, handleSchemaCollectionUpdate as i, handleSchemaCollectionList as j, handleSchemaCollectionCreate as k, handleOrphanedTableRegister as l, handleOrphanedTableList as m };
