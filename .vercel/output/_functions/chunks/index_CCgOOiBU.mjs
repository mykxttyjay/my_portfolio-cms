import { SchemaRegistry } from './registry_5tlwwm-G.mjs';
export { SchemaError } from './registry_5tlwwm-G.mjs';
export { b as FIELD_TYPE_TO_COLUMN, R as RESERVED_COLLECTION_SLUGS, a as RESERVED_FIELD_SLUGS } from './types_DVbKIzvo.mjs';
import { g as getDb } from './loader_DjfVmeQr.mjs';
import { r as requestCached } from './request-cache_BRmSfhRF.mjs';
export { c as clearSchemaCache, a as generateFieldSchema, g as generateTypeScript, b as generateZodSchema, d as getCachedSchema, i as invalidateSchemaCache, v as validateContent } from './zod-generator_B_6U-HD-.mjs';

async function getCollectionInfo(slug) {
  return requestCached(`collection-info:${slug}`, async () => {
    const db = await getDb();
    return getCollectionInfoWithDb(db, slug);
  });
}
async function getCollectionInfoWithDb(db, slug) {
  const registry = new SchemaRegistry(db);
  return registry.getCollection(slug);
}

export { SchemaRegistry, getCollectionInfo, getCollectionInfoWithDb };
