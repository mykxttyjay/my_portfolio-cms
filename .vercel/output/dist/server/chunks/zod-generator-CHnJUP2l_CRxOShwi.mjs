import { z } from 'zod';

//#region src/utils/hash.ts
/**
* SHA-256 hash of a string, truncated to 16 hex chars (64 bits).
* For cache invalidation / ETags — not for security.
*/
async function hashString(content) {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
	return Array.from(new Uint8Array(buf).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}
/**
* Compute content hash using Web Crypto API
*
* Uses SHA-1 which is the fastest option in SubtleCrypto.
* SHA-1 is cryptographically weak but fine for content deduplication
* where we only need to detect identical files, not resist attacks.
*
* Returns hex string prefixed with "sha1:" for future-proofing
*/
async function computeContentHash(content) {
	let buf;
	if (content instanceof ArrayBuffer) buf = content;
	else {
		buf = new ArrayBuffer(content.byteLength);
		new Uint8Array(buf).set(content);
	}
	const hashBuffer = await crypto.subtle.digest("SHA-1", buf);
	const hashArray = new Uint8Array(hashBuffer);
	return `sha1:${Array.from(hashArray, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

//#endregion
//#region src/schema/zod-generator.ts
/**
* Generate a Zod schema from a collection's field definitions
*
* This allows runtime validation of content based on dynamically
* defined schemas stored in D1.
*/
function generateZodSchema(collection) {
	const shape = {};
	for (const field of collection.fields) shape[field.slug] = generateFieldSchema(field);
	return z.object(shape);
}
/**
* Generate Zod schema for a single field
*/
function generateFieldSchema(field) {
	let schema = getBaseSchema(field.type, field);
	if (field.validation) schema = applyValidation(schema, field);
	if (!field.required) schema = schema.nullish();
	if (field.defaultValue !== void 0) schema = schema.default(field.defaultValue);
	return schema;
}
/**
* Get base Zod schema for a field type
*/
function getBaseSchema(type, field) {
	switch (type) {
		case "url": return z.string().url();
		case "string":
		case "text":
		case "slug": return z.string();
		case "number": return z.number();
		case "integer": return z.number().int();
		case "boolean": return z.preprocess((v) => v === 0 || v === 1 ? Boolean(v) : v, z.boolean());
		case "datetime": return z.string().datetime().or(z.string().date());
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
		case "portableText": return z.array(z.object({
			_type: z.string(),
			_key: z.string().optional()
		}).passthrough());
		case "image": return z.object({
			id: z.string(),
			src: z.string().optional(),
			alt: z.string().optional(),
			width: z.number().optional(),
			height: z.number().optional(),
			provider: z.string().optional(),
			previewUrl: z.string().optional(),
			meta: z.record(z.string(), z.unknown()).optional()
		});
		case "file": return z.object({
			id: z.string(),
			src: z.string().optional(),
			filename: z.string().optional(),
			mimeType: z.string().optional(),
			size: z.number().optional(),
			provider: z.string().optional(),
			meta: z.record(z.string(), z.unknown()).optional()
		});
		case "reference": return z.string();
		case "json": return z.unknown();
		default: return z.unknown();
	}
}
/**
* Apply validation rules to a schema
*/
function applyValidation(schema, field) {
	const validation = field.validation;
	if (!validation) return schema;
	if (schema instanceof z.ZodString) {
		let strSchema = schema;
		if (validation.minLength !== void 0) strSchema = strSchema.min(validation.minLength);
		if (validation.maxLength !== void 0) strSchema = strSchema.max(validation.maxLength);
		if (validation.pattern) strSchema = strSchema.regex(new RegExp(validation.pattern));
		return strSchema;
	}
	if (schema instanceof z.ZodNumber) {
		let numSchema = schema;
		if (validation.min !== void 0) numSchema = numSchema.min(validation.min);
		if (validation.max !== void 0) numSchema = numSchema.max(validation.max);
		return numSchema;
	}
	return schema;
}

export { computeContentHash as c, generateZodSchema as g, hashString as h };
