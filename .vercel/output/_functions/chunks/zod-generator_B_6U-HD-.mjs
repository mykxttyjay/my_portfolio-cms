import { z } from 'zod';

const PASCAL_CASE_SPLIT_PATTERN = /[_\-\s]+/;
function generateZodSchema(collection) {
  const shape = {};
  for (const field of collection.fields) {
    shape[field.slug] = generateFieldSchema(field);
  }
  return z.object(shape);
}
function generateFieldSchema(field) {
  let schema = getBaseSchema(field.type, field);
  if (field.validation) {
    schema = applyValidation(schema, field);
  }
  if (!field.required) {
    schema = schema.nullish();
  }
  if (field.defaultValue !== void 0) {
    schema = schema.default(field.defaultValue);
  }
  return schema;
}
function getBaseSchema(type, field) {
  switch (type) {
    case "url":
      return z.string().url();
    case "string":
    case "text":
    case "slug":
      return z.string();
    case "number":
      return z.number();
    case "integer":
      return z.number().int();
    case "boolean":
      return z.preprocess((v) => v === 0 || v === 1 ? Boolean(v) : v, z.boolean());
    case "datetime":
      return z.string().datetime().or(z.string().date());
    case "select": {
      const options = field.validation?.options;
      if (options && options.length > 0) {
        const [first, ...rest] = options;
        return z.enum([first, ...rest]);
      }
      return z.string();
    }
    case "multiSelect": {
      const multiOptions = field.validation?.options;
      if (multiOptions && multiOptions.length > 0) {
        const [first, ...rest] = multiOptions;
        return z.array(z.enum([first, ...rest]));
      }
      return z.array(z.string());
    }
    case "portableText":
      return z.array(
        z.object({
          _type: z.string(),
          _key: z.string().optional()
        }).passthrough()
      );
    case "image":
      return z.object({
        id: z.string(),
        src: z.string().optional(),
        alt: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        /** Provider ID (e.g. "local", "cloudflare-images") */
        provider: z.string().optional(),
        /** Admin-side preview URL for external providers (not persisted by plugins) */
        previewUrl: z.string().optional(),
        /** Provider-specific metadata; for local media this carries storageKey */
        meta: z.record(z.string(), z.unknown()).optional()
      });
    case "file":
      return z.object({
        id: z.string(),
        src: z.string().optional(),
        filename: z.string().optional(),
        mimeType: z.string().optional(),
        size: z.number().optional(),
        /** Provider ID (e.g. "local", "s3") */
        provider: z.string().optional(),
        /** Provider-specific metadata; for local media this carries storageKey */
        meta: z.record(z.string(), z.unknown()).optional()
      });
    case "reference":
      return z.string();
    // Reference ID
    case "json":
      return z.unknown();
    default:
      return z.unknown();
  }
}
function applyValidation(schema, field) {
  const validation = field.validation;
  if (!validation) return schema;
  if (schema instanceof z.ZodString) {
    let strSchema = schema;
    if (validation.minLength !== void 0) {
      strSchema = strSchema.min(validation.minLength);
    }
    if (validation.maxLength !== void 0) {
      strSchema = strSchema.max(validation.maxLength);
    }
    if (validation.pattern) {
      strSchema = strSchema.regex(new RegExp(validation.pattern));
    }
    return strSchema;
  }
  if (schema instanceof z.ZodNumber) {
    let numSchema = schema;
    if (validation.min !== void 0) {
      numSchema = numSchema.min(validation.min);
    }
    if (validation.max !== void 0) {
      numSchema = numSchema.max(validation.max);
    }
    return numSchema;
  }
  return schema;
}
const schemaCache = /* @__PURE__ */ new Map();
function getCachedSchema(collection, version) {
  const cacheKey = collection.slug;
  const cached = schemaCache.get(cacheKey);
  if (cached && (!version || cached.version === version)) {
    return cached.schema;
  }
  const schema = generateZodSchema(collection);
  schemaCache.set(cacheKey, {
    schema,
    version: version || collection.updatedAt
  });
  return schema;
}
function invalidateSchemaCache(slug) {
  schemaCache.delete(slug);
}
function clearSchemaCache() {
  schemaCache.clear();
}
function validateContent(collection, data) {
  const schema = getCachedSchema(collection);
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
function generateTypeScript(collection) {
  const interfaceName = getInterfaceName(collection);
  const lines = [];
  lines.push(`export interface ${interfaceName} {`);
  lines.push(`  id: string;`);
  lines.push(`  slug: string | null;`);
  lines.push(`  status: string;`);
  for (const field of collection.fields) {
    const tsType = fieldTypeToTypeScript(field);
    const optional = field.required ? "" : "?";
    lines.push(`  ${field.slug}${optional}: ${tsType};`);
  }
  lines.push(`  createdAt: Date;`);
  lines.push(`  updatedAt: Date;`);
  lines.push(`  publishedAt: Date | null;`);
  lines.push(`  bylines?: ContentBylineCredit[];`);
  lines.push(`}`);
  return lines.join("\n");
}
function fieldTypeToTypeScript(field) {
  switch (field.type) {
    case "string":
    case "text":
    case "slug":
    case "url":
    case "datetime":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "select":
      const options = field.validation?.options;
      if (options && options.length > 0) {
        return options.map((o) => `"${o}"`).join(" | ");
      }
      return "string";
    case "multiSelect":
      const multiOptions = field.validation?.options;
      if (multiOptions && multiOptions.length > 0) {
        return `(${multiOptions.map((o) => `"${o}"`).join(" | ")})[]`;
      }
      return "string[]";
    case "portableText":
      return "PortableTextBlock[]";
    case "image":
      return "{ id: string; src?: string; alt?: string; width?: number; height?: number; provider?: string; previewUrl?: string; meta?: Record<string, unknown> }";
    case "file":
      return "{ id: string; src?: string; filename?: string; mimeType?: string; size?: number; provider?: string; meta?: Record<string, unknown> }";
    case "reference":
      return "string";
    case "json":
      return "unknown";
    default:
      return "unknown";
  }
}
function pascalCase(str) {
  return str.split(PASCAL_CASE_SPLIT_PATTERN).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
}
function singularize(str) {
  if (str.endsWith("ies")) {
    return str.slice(0, -3) + "y";
  }
  if (str.endsWith("es") && (str.endsWith("sses") || str.endsWith("xes") || str.endsWith("ches") || str.endsWith("shes"))) {
    return str.slice(0, -2);
  }
  if (str.endsWith("s") && !str.endsWith("ss")) {
    return str.slice(0, -1);
  }
  return str;
}
function getInterfaceName(collection) {
  return pascalCase(collection.labelSingular || singularize(collection.slug));
}

export { generateFieldSchema as a, generateZodSchema as b, clearSchemaCache as c, getCachedSchema as d, generateTypeScript as g, invalidateSchemaCache as i, validateContent as v };
