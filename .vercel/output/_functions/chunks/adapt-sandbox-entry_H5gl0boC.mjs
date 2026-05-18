import { sql, Migrator } from 'kysely';
import { ulid, monotonicFactory } from 'ulidx';
import { AsyncLocalStorage } from 'node:async_hooks';
import { z as z$1 } from 'zod';
import { normalizeCapabilities } from '@emdash-cms/plugin-types';
import { imageSize } from 'image-size';
import mime from 'mime/lite';
import * as z from 'zod/v4';
import sax from 'sax';
import { Cron } from 'croner';
import { gutenbergToPortableText } from '@emdash-cms/gutenberg-to-portable-text';

//#region src/database/validate.ts
/**
* SQL Identifier Validation
*
* Validates identifiers (table names, column names, index names) before
* they are used in raw SQL expressions. This is the primary defense against
* SQL injection via dynamic identifier interpolation.
*
* @see AGENTS.md § Database: Never Interpolate Into SQL
*/
/**
* Pattern for safe SQL identifiers.
* Must start with a lowercase letter, followed by lowercase letters, digits, or underscores.
*/
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;
/**
* Pattern for generic alphanumeric identifiers (case-insensitive).
* Must start with a letter, followed by letters, digits, or underscores.
*/
const GENERIC_IDENTIFIER_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;
/**
* Pattern for plugin identifiers.
* Must start with a lowercase letter, followed by lowercase letters, digits, underscores, or hyphens.
*/
const PLUGIN_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_-]*$/;
/**
* Maximum length for SQL identifiers.
* SQLite has no formal limit, but we cap at 128 for sanity.
*/
const MAX_IDENTIFIER_LENGTH = 128;
/**
* Error thrown when an identifier fails validation.
*/
var IdentifierError = class extends Error {
	constructor(message, identifier) {
		super(message);
		this.identifier = identifier;
		this.name = "IdentifierError";
	}
};
/**
* Validate that a string is a safe SQL identifier.
*
* Safe identifiers match `/^[a-z][a-z0-9_]*$/` and are at most 128 characters.
* This prevents SQL injection when identifiers must be interpolated into raw SQL
* (e.g., dynamic table names, column names in json_extract paths).
*
* @param value - The string to validate
* @param label - Human-readable label for error messages (e.g., "field name", "table name")
* @throws {IdentifierError} If the value is not a valid identifier
*
* @example
* ```typescript
* validateIdentifier(fieldName, "field name");
* // safe to use in: json_extract(data, '$.${fieldName}')
* ```
*/
function validateIdentifier(value, label = "identifier") {
	if (!value || typeof value !== "string") throw new IdentifierError(`${label} must be a non-empty string`, String(value));
	if (value.length > MAX_IDENTIFIER_LENGTH) throw new IdentifierError(`${label} must be ${MAX_IDENTIFIER_LENGTH} characters or less, got ${value.length}`, value);
	if (!IDENTIFIER_PATTERN.test(value)) throw new IdentifierError(`${label} must match /^[a-z][a-z0-9_]*$/ (got "${value}")`, value);
}
/**
* Validate that a string is a safe JSON field name for use in json_extract paths.
*
* More permissive than `validateIdentifier` — allows camelCase (mixed case)
* since JSON keys in plugin storage data blobs commonly use camelCase.
* Matches `/^[a-zA-Z][a-zA-Z0-9_]*$/`.
*
* @param value - The string to validate
* @param label - Human-readable label for error messages
* @throws {IdentifierError} If the value is not valid
*/
function validateJsonFieldName(value, label = "JSON field name") {
	if (!value || typeof value !== "string") throw new IdentifierError(`${label} must be a non-empty string`, String(value));
	if (value.length > MAX_IDENTIFIER_LENGTH) throw new IdentifierError(`${label} must be ${MAX_IDENTIFIER_LENGTH} characters or less, got ${value.length}`, value);
	if (!GENERIC_IDENTIFIER_PATTERN.test(value)) throw new IdentifierError(`${label} must match /^[a-zA-Z][a-zA-Z0-9_]*$/ (got "${value}")`, value);
}
/**
* Validate that a string is a safe SQL identifier, allowing hyphens.
*
* Like `validateIdentifier` but also permits hyphens, which appear in
* plugin IDs (e.g., "my-plugin"). Matches `/^[a-z][a-z0-9_-]*$/`.
*
* @param value - The string to validate
* @param label - Human-readable label for error messages
* @throws {IdentifierError} If the value is not valid
*/
function validatePluginIdentifier(value, label = "plugin identifier") {
	if (!value || typeof value !== "string") throw new IdentifierError(`${label} must be a non-empty string`, String(value));
	if (value.length > MAX_IDENTIFIER_LENGTH) throw new IdentifierError(`${label} must be ${MAX_IDENTIFIER_LENGTH} characters or less, got ${value.length}`, value);
	if (!PLUGIN_IDENTIFIER_PATTERN.test(value)) throw new IdentifierError(`${label} must match /^[a-z][a-z0-9_-]*$/ (got "${value}")`, value);
}

//#region src/database/dialect-helpers.ts
/**
* Detect dialect type from a Kysely instance via the adapter class name.
*/
function detectDialect(db) {
	if (db.getExecutor().adapter.constructor.name === "PostgresAdapter") return "postgres";
	return "sqlite";
}
function isSqlite(db) {
	return detectDialect(db) === "sqlite";
}
function isPostgres(db) {
	return detectDialect(db) === "postgres";
}
/**
* Default timestamp expression for column defaults.
* Wrapped in parens for use in CREATE TABLE ... DEFAULT (...).
*
* sqlite:   (datetime('now'))
* postgres: CURRENT_TIMESTAMP
*/
function currentTimestamp(db) {
	if (isPostgres(db)) return sql`CURRENT_TIMESTAMP`;
	return sql`(datetime('now'))`;
}
/**
* Timestamp expression for use in WHERE clauses and SET expressions.
* No wrapping parens.
*
* sqlite:   datetime('now')
* postgres: CURRENT_TIMESTAMP
*/
function currentTimestampValue(db) {
	if (isPostgres(db)) return sql`CURRENT_TIMESTAMP`;
	return sql`datetime('now')`;
}
/**
* Check if a table exists in the database.
*/
async function tableExists(db, tableName) {
	if (isPostgres(db)) return (await sql`
			SELECT EXISTS(
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = ${tableName}
			) as exists
		`.execute(db)).rows[0]?.exists === true;
	return (await sql`
		SELECT name FROM sqlite_master
		WHERE type = 'table' AND name = ${tableName}
	`.execute(db)).rows.length > 0;
}
/**
* Check if a column exists in the database.
*/
async function columnExists(db, tableName, columnName) {
	if (isPostgres(db)) return (await sql`
			SELECT EXISTS(
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = current_schema()
					AND table_name = ${tableName}
					AND column_name = ${columnName}
			) as exists
		`.execute(db)).rows[0]?.exists === true;
	return (await sql`
		SELECT name FROM pragma_table_info(${tableName})
		WHERE name = ${columnName}
	`.execute(db)).rows.length > 0;
}
/**
* List tables matching a LIKE pattern.
*/
async function listTablesLike(db, pattern) {
	if (isPostgres(db)) return (await sql`
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name LIKE ${pattern}
		`.execute(db)).rows.map((r) => r.table_name);
	return (await sql`
		SELECT name FROM sqlite_master
		WHERE type = 'table' AND name LIKE ${pattern}
	`.execute(db)).rows.map((r) => r.name);
}
/**
* Column type for binary data.
*
* sqlite:   blob
* postgres: bytea
*/
function binaryType(db) {
	if (isPostgres(db)) return "bytea";
	return "blob";
}
/**
* SQL expression for extracting a field from a JSON/JSONB column.
*
* sqlite:   json_extract(column, '$.path')
* postgres: column->>'path'
*/
function jsonExtractExpr(db, column, path) {
	validateIdentifier(column, "JSON column name");
	validateJsonFieldName(path, "JSON path");
	if (isPostgres(db)) return `${column}->>'${path}'`;
	return `json_extract(${column}, '$.${path}')`;
}

//#region src/i18n/config.ts
let _config;
/**
* Initialize i18n config from virtual module data.
* Called during runtime initialization.
*/
function setI18nConfig(config) {
	_config = config;
}
/**
* Get the current i18n config.
* Returns null if i18n is not configured.
*/
function getI18nConfig() {
	return _config ?? null;
}
/**
* Check if i18n is enabled.
* Returns true when multiple locales are configured.
*/
function isI18nEnabled() {
	return _config != null && _config.locales.length > 1;
}
/**
* Resolve fallback locale chain for a given locale.
* Returns array of locales to try, from most preferred to least.
* Always ends with defaultLocale.
*/
function getFallbackChain(locale) {
	if (!_config) return [locale];
	const chain = [locale];
	let current = locale;
	const visited = new Set([locale]);
	while (_config.fallback?.[current]) {
		const next = _config.fallback[current];
		if (visited.has(next)) break;
		chain.push(next);
		visited.add(next);
		current = next;
	}
	if (!visited.has(_config.defaultLocale)) chain.push(_config.defaultLocale);
	return chain;
}

//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) {
		__defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	}
	{
		__defProp(target, Symbol.toStringTag, { value: "Module" });
	}
	return target;
};

//#endregion
//#region src/database/migrations/001_initial.ts
var _001_initial_exports = /* @__PURE__ */ __exportAll({
	down: () => down$35,
	up: () => up$35
});
/**
* Initial schema migration
*
* Note: Content tables (ec_posts, ec_pages, etc.) are created dynamically
* by the SchemaRegistry when collections are added via the admin UI.
* This migration only creates system tables.
*/
async function up$35(db) {
	await db.schema.createTable("revisions").ifNotExists().addColumn("id", "text", (col) => col.primaryKey()).addColumn("collection", "text", (col) => col.notNull()).addColumn("entry_id", "text", (col) => col.notNull()).addColumn("data", "text", (col) => col.notNull()).addColumn("author_id", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.schema.createIndex("idx_revisions_entry").ifNotExists().on("revisions").columns(["collection", "entry_id"]).execute();
	await db.schema.createTable("taxonomies").ifNotExists().addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull()).addColumn("slug", "text", (col) => col.notNull()).addColumn("label", "text", (col) => col.notNull()).addColumn("parent_id", "text").addColumn("data", "text").addUniqueConstraint("taxonomies_name_slug_unique", ["name", "slug"]).addForeignKeyConstraint("taxonomies_parent_fk", ["parent_id"], "taxonomies", ["id"], (cb) => cb.onDelete("set null")).execute();
	await db.schema.createIndex("idx_taxonomies_name").ifNotExists().on("taxonomies").column("name").execute();
	await db.schema.createTable("content_taxonomies").ifNotExists().addColumn("collection", "text", (col) => col.notNull()).addColumn("entry_id", "text", (col) => col.notNull()).addColumn("taxonomy_id", "text", (col) => col.notNull()).addPrimaryKeyConstraint("content_taxonomies_pk", [
		"collection",
		"entry_id",
		"taxonomy_id"
	]).addForeignKeyConstraint("content_taxonomies_taxonomy_fk", ["taxonomy_id"], "taxonomies", ["id"], (cb) => cb.onDelete("cascade")).execute();
	await db.schema.createTable("media").ifNotExists().addColumn("id", "text", (col) => col.primaryKey()).addColumn("filename", "text", (col) => col.notNull()).addColumn("mime_type", "text", (col) => col.notNull()).addColumn("size", "integer").addColumn("width", "integer").addColumn("height", "integer").addColumn("alt", "text").addColumn("caption", "text").addColumn("storage_key", "text", (col) => col.notNull()).addColumn("content_hash", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("author_id", "text").execute();
	await db.schema.createIndex("idx_media_content_hash").ifNotExists().on("media").column("content_hash").execute();
	await db.schema.createTable("users").ifNotExists().addColumn("id", "text", (col) => col.primaryKey()).addColumn("email", "text", (col) => col.notNull().unique()).addColumn("password_hash", "text", (col) => col.notNull()).addColumn("name", "text").addColumn("role", "text", (col) => col.defaultTo("subscriber")).addColumn("avatar_id", "text").addColumn("data", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.schema.createIndex("idx_users_email").ifNotExists().on("users").column("email").execute();
	await db.schema.createTable("options").ifNotExists().addColumn("name", "text", (col) => col.primaryKey()).addColumn("value", "text", (col) => col.notNull()).execute();
	await db.schema.createTable("audit_logs").ifNotExists().addColumn("id", "text", (col) => col.primaryKey()).addColumn("timestamp", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("actor_id", "text").addColumn("actor_ip", "text").addColumn("action", "text", (col) => col.notNull()).addColumn("resource_type", "text").addColumn("resource_id", "text").addColumn("details", "text").addColumn("status", "text").execute();
	await db.schema.createIndex("idx_audit_actor").ifNotExists().on("audit_logs").column("actor_id").execute();
	await db.schema.createIndex("idx_audit_action").ifNotExists().on("audit_logs").column("action").execute();
	await db.schema.createIndex("idx_audit_timestamp").ifNotExists().on("audit_logs").column("timestamp").execute();
}
async function down$35(db) {
	await db.schema.dropTable("audit_logs").execute();
	await db.schema.dropTable("options").execute();
	await db.schema.dropTable("users").execute();
	await db.schema.dropTable("media").execute();
	await db.schema.dropTable("content_taxonomies").execute();
	await db.schema.dropTable("taxonomies").execute();
	await db.schema.dropTable("revisions").execute();
}

//#endregion
//#region src/database/migrations/002_media_status.ts
var _002_media_status_exports = /* @__PURE__ */ __exportAll({
	down: () => down$34,
	up: () => up$34
});
/**
* Add status column to media table for tracking upload state.
* Status values: 'pending' | 'ready' | 'failed'
*/
async function up$34(db) {
	await db.schema.alterTable("media").addColumn("status", "text", (col) => col.notNull().defaultTo("ready")).execute();
	await db.schema.createIndex("idx_media_status").on("media").column("status").execute();
}
async function down$34(db) {
	await db.schema.dropIndex("idx_media_status").execute();
}

//#endregion
//#region src/database/migrations/003_schema_registry.ts
var _003_schema_registry_exports = /* @__PURE__ */ __exportAll({
	down: () => down$33,
	up: () => up$33
});
/**
* Migration: Schema Registry Tables
*
* Creates the schema registry tables that store collection and field definitions.
* This enables dynamic schema management where D1 is the source of truth.
*/
async function up$33(db) {
	await db.schema.createTable("_emdash_collections").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("label_singular", "text").addColumn("description", "text").addColumn("icon", "text").addColumn("supports", "text").addColumn("source", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.schema.createTable("_emdash_fields").addColumn("id", "text", (col) => col.primaryKey()).addColumn("collection_id", "text", (col) => col.notNull()).addColumn("slug", "text", (col) => col.notNull()).addColumn("label", "text", (col) => col.notNull()).addColumn("type", "text", (col) => col.notNull()).addColumn("column_type", "text", (col) => col.notNull()).addColumn("required", "integer", (col) => col.defaultTo(0)).addColumn("unique", "integer", (col) => col.defaultTo(0)).addColumn("default_value", "text").addColumn("validation", "text").addColumn("widget", "text").addColumn("options", "text").addColumn("sort_order", "integer", (col) => col.defaultTo(0)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint("fields_collection_fk", ["collection_id"], "_emdash_collections", ["id"], (cb) => cb.onDelete("cascade")).execute();
	await db.schema.createIndex("idx_fields_collection_slug").on("_emdash_fields").columns(["collection_id", "slug"]).unique().execute();
	await db.schema.createIndex("idx_fields_collection").on("_emdash_fields").column("collection_id").execute();
	await db.schema.createIndex("idx_fields_sort").on("_emdash_fields").columns(["collection_id", "sort_order"]).execute();
}
async function down$33(db) {
	await db.schema.dropTable("_emdash_fields").execute();
	await db.schema.dropTable("_emdash_collections").execute();
}

//#endregion
//#region src/database/migrations/004_plugins.ts
var _004_plugins_exports = /* @__PURE__ */ __exportAll({
	down: () => down$32,
	up: () => up$32
});
/**
* Migration: Plugin System Tables
*
* Creates the plugin storage table and plugin state tracking.
* Plugin storage uses a document store with declared indexes.
*
* @see PLUGIN-SYSTEM.md § Plugin Storage
*/
async function up$32(db) {
	await db.schema.createTable("_plugin_storage").addColumn("plugin_id", "text", (col) => col.notNull()).addColumn("collection", "text", (col) => col.notNull()).addColumn("id", "text", (col) => col.notNull()).addColumn("data", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addPrimaryKeyConstraint("pk_plugin_storage", [
		"plugin_id",
		"collection",
		"id"
	]).execute();
	await db.schema.createIndex("idx_plugin_storage_list").on("_plugin_storage").columns([
		"plugin_id",
		"collection",
		"created_at"
	]).execute();
	await db.schema.createTable("_plugin_state").addColumn("plugin_id", "text", (col) => col.primaryKey()).addColumn("version", "text", (col) => col.notNull()).addColumn("status", "text", (col) => col.notNull().defaultTo("installed")).addColumn("installed_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("activated_at", "text").addColumn("deactivated_at", "text").addColumn("data", "text").execute();
	await db.schema.createTable("_plugin_indexes").addColumn("plugin_id", "text", (col) => col.notNull()).addColumn("collection", "text", (col) => col.notNull()).addColumn("index_name", "text", (col) => col.notNull()).addColumn("fields", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addPrimaryKeyConstraint("pk_plugin_indexes", [
		"plugin_id",
		"collection",
		"index_name"
	]).execute();
}
async function down$32(db) {
	await db.schema.dropTable("_plugin_indexes").execute();
	await db.schema.dropTable("_plugin_state").execute();
	await db.schema.dropTable("_plugin_storage").execute();
}

//#endregion
//#region src/database/migrations/005_menus.ts
var _005_menus_exports = /* @__PURE__ */ __exportAll({
	down: () => down$31,
	up: () => up$31
});
/**
* Navigation Menus migration
*
* Creates tables for admin-editable navigation menus.
* Menu items can reference content entries, taxonomy terms, or custom URLs.
*/
async function up$31(db) {
	await db.schema.createTable("_emdash_menus").addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.schema.createTable("_emdash_menu_items").addColumn("id", "text", (col) => col.primaryKey()).addColumn("menu_id", "text", (col) => col.notNull()).addColumn("parent_id", "text").addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0)).addColumn("type", "text", (col) => col.notNull()).addColumn("reference_collection", "text").addColumn("reference_id", "text").addColumn("custom_url", "text").addColumn("label", "text", (col) => col.notNull()).addColumn("title_attr", "text").addColumn("target", "text").addColumn("css_classes", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint("menu_items_menu_fk", ["menu_id"], "_emdash_menus", ["id"], (cb) => cb.onDelete("cascade")).addForeignKeyConstraint("menu_items_parent_fk", ["parent_id"], "_emdash_menu_items", ["id"], (cb) => cb.onDelete("cascade")).execute();
	await db.schema.createIndex("idx_menu_items_menu").on("_emdash_menu_items").columns(["menu_id", "sort_order"]).execute();
	await db.schema.createIndex("idx_menu_items_parent").on("_emdash_menu_items").column("parent_id").execute();
}
async function down$31(db) {
	await db.schema.dropTable("_emdash_menu_items").execute();
	await db.schema.dropTable("_emdash_menus").execute();
}

//#endregion
//#region src/database/migrations/006_taxonomy_defs.ts
var _006_taxonomy_defs_exports = /* @__PURE__ */ __exportAll({
	down: () => down$30,
	up: () => up$30
});
/**
* Taxonomy definitions migration
*
* Adds _emdash_taxonomy_defs table to store taxonomy definitions (category, tag, custom)
* and seeds default category and tag taxonomies.
*/
async function up$30(db) {
	await db.schema.createTable("_emdash_taxonomy_defs").addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("label_singular", "text").addColumn("hierarchical", "integer", (col) => col.defaultTo(0)).addColumn("collections", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.insertInto("_emdash_taxonomy_defs").values([{
		id: "taxdef_category",
		name: "category",
		label: "Categories",
		label_singular: "Category",
		hierarchical: 1,
		collections: JSON.stringify(["posts"])
	}, {
		id: "taxdef_tag",
		name: "tag",
		label: "Tags",
		label_singular: "Tag",
		hierarchical: 0,
		collections: JSON.stringify(["posts"])
	}]).execute();
}
async function down$30(db) {
	await db.schema.dropTable("_emdash_taxonomy_defs").execute();
}

//#endregion
//#region src/database/migrations/007_widgets.ts
var _007_widgets_exports = /* @__PURE__ */ __exportAll({
	down: () => down$29,
	up: () => up$29
});
async function up$29(db) {
	await db.schema.createTable("_emdash_widget_areas").addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("description", "text").addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
	await db.schema.createTable("_emdash_widgets").addColumn("id", "text", (col) => col.primaryKey()).addColumn("area_id", "text", (col) => col.notNull().references("_emdash_widget_areas.id").onDelete("cascade")).addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0)).addColumn("type", "text", (col) => col.notNull()).addColumn("title", "text").addColumn("content", "text").addColumn("menu_name", "text").addColumn("component_id", "text").addColumn("component_props", "text").addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
	await db.schema.createIndex("idx_widgets_area").on("_emdash_widgets").columns(["area_id", "sort_order"]).execute();
}
async function down$29(db) {
	await db.schema.dropTable("_emdash_widgets").execute();
	await db.schema.dropTable("_emdash_widget_areas").execute();
}

//#endregion
//#region src/database/migrations/008_auth.ts
var _008_auth_exports = /* @__PURE__ */ __exportAll({
	down: () => down$28,
	up: () => up$28
});
/**
* Auth migration - passkey-first authentication
*
* Changes:
* - Removes password_hash from users (no passwords)
* - Adds role as integer (RBAC levels)
* - Adds email_verified, avatar_url, updated_at to users
* - Creates credentials table (passkeys)
* - Creates auth_tokens table (magic links, invites)
* - Creates oauth_accounts table (external provider links)
* - Creates allowed_domains table (self-signup)
*/
async function up$28(db) {
	await db.schema.createTable("users_new").addColumn("id", "text", (col) => col.primaryKey()).addColumn("email", "text", (col) => col.notNull().unique()).addColumn("name", "text").addColumn("avatar_url", "text").addColumn("role", "integer", (col) => col.notNull().defaultTo(10)).addColumn("email_verified", "integer", (col) => col.notNull().defaultTo(0)).addColumn("data", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await sql`
		INSERT INTO users_new (id, email, name, role, data, created_at, updated_at)
		SELECT
			id,
			email,
			name,
			CASE role
				WHEN 'admin' THEN 50
				WHEN 'editor' THEN 40
				WHEN 'author' THEN 30
				WHEN 'contributor' THEN 20
				ELSE 10
			END,
			data,
			created_at,
			${currentTimestampValue(db)}
		FROM users
	`.execute(db);
	await db.schema.dropTable("users").execute();
	await sql`ALTER TABLE users_new RENAME TO users`.execute(db);
	await db.schema.createIndex("idx_users_email").on("users").column("email").execute();
	await db.schema.createTable("credentials").addColumn("id", "text", (col) => col.primaryKey()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("public_key", binaryType(db), (col) => col.notNull()).addColumn("counter", "integer", (col) => col.notNull().defaultTo(0)).addColumn("device_type", "text", (col) => col.notNull()).addColumn("backed_up", "integer", (col) => col.notNull().defaultTo(0)).addColumn("transports", "text").addColumn("name", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("last_used_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint("credentials_user_fk", ["user_id"], "users", ["id"], (cb) => cb.onDelete("cascade")).execute();
	await db.schema.createIndex("idx_credentials_user").on("credentials").column("user_id").execute();
	await db.schema.createTable("auth_tokens").addColumn("hash", "text", (col) => col.primaryKey()).addColumn("user_id", "text").addColumn("email", "text").addColumn("type", "text", (col) => col.notNull()).addColumn("role", "integer").addColumn("invited_by", "text").addColumn("expires_at", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint("auth_tokens_user_fk", ["user_id"], "users", ["id"], (cb) => cb.onDelete("cascade")).addForeignKeyConstraint("auth_tokens_invited_by_fk", ["invited_by"], "users", ["id"], (cb) => cb.onDelete("set null")).execute();
	await db.schema.createIndex("idx_auth_tokens_email").on("auth_tokens").column("email").execute();
	await db.schema.createTable("oauth_accounts").addColumn("provider", "text", (col) => col.notNull()).addColumn("provider_account_id", "text", (col) => col.notNull()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addPrimaryKeyConstraint("oauth_accounts_pk", ["provider", "provider_account_id"]).addForeignKeyConstraint("oauth_accounts_user_fk", ["user_id"], "users", ["id"], (cb) => cb.onDelete("cascade")).execute();
	await db.schema.createIndex("idx_oauth_accounts_user").on("oauth_accounts").column("user_id").execute();
	await db.schema.createTable("allowed_domains").addColumn("domain", "text", (col) => col.primaryKey()).addColumn("default_role", "integer", (col) => col.notNull().defaultTo(20)).addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.schema.createTable("auth_challenges").addColumn("challenge", "text", (col) => col.primaryKey()).addColumn("type", "text", (col) => col.notNull()).addColumn("user_id", "text").addColumn("data", "text").addColumn("expires_at", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.schema.createIndex("idx_auth_challenges_expires").on("auth_challenges").column("expires_at").execute();
}
async function down$28(db) {
	await db.schema.dropTable("auth_challenges").execute();
	await db.schema.dropTable("allowed_domains").execute();
	await db.schema.dropTable("oauth_accounts").execute();
	await db.schema.dropTable("auth_tokens").execute();
	await db.schema.dropTable("credentials").execute();
	await db.schema.createTable("users_old").addColumn("id", "text", (col) => col.primaryKey()).addColumn("email", "text", (col) => col.notNull().unique()).addColumn("password_hash", "text", (col) => col.notNull()).addColumn("name", "text").addColumn("role", "text", (col) => col.defaultTo("subscriber")).addColumn("avatar_id", "text").addColumn("data", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await sql`
		INSERT INTO users_old (id, email, password_hash, name, role, data, created_at)
		SELECT
			id,
			email,
			'', -- No way to restore password
			name,
			CASE role
				WHEN 50 THEN 'admin'
				WHEN 40 THEN 'editor'
				WHEN 30 THEN 'author'
				WHEN 20 THEN 'contributor'
				ELSE 'subscriber'
			END,
			data,
			created_at
		FROM users
	`.execute(db);
	await db.schema.dropTable("users").execute();
	await sql`ALTER TABLE users_old RENAME TO users`.execute(db);
	await db.schema.createIndex("idx_users_email").on("users").column("email").execute();
}

//#endregion
//#region src/database/migrations/009_user_disabled.ts
var _009_user_disabled_exports = /* @__PURE__ */ __exportAll({
	down: () => down$27,
	up: () => up$27
});
/**
* User disabled column - for soft-disabling users
*
* Changes:
* - Adds disabled column to users table (INTEGER, default 0)
* - Disabled users cannot log in
*/
async function up$27(db) {
	await sql`ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0`.execute(db);
	await db.schema.createIndex("idx_users_disabled").on("users").column("disabled").execute();
}
async function down$27(db) {
	await db.schema.dropIndex("idx_users_disabled").execute();
}

//#endregion
//#region src/database/migrations/011_sections.ts
var _011_sections_exports = /* @__PURE__ */ __exportAll({
	down: () => down$26,
	up: () => up$26
});
/**
* Migration: Add sections tables and performance indexes
*
* Sections are reusable content blocks that can be inserted into any Portable Text field.
* They provide a library of pre-built page sections (heroes, CTAs, testimonials, etc.)
* that content authors can browse and insert with a single click.
*/
async function up$26(db) {
	await db.schema.createTable("_emdash_section_categories").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("sort_order", "integer", (col) => col.defaultTo(0)).addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
	await db.schema.createTable("_emdash_sections").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("title", "text", (col) => col.notNull()).addColumn("description", "text").addColumn("category_id", "text", (col) => col.references("_emdash_section_categories.id").onDelete("set null")).addColumn("keywords", "text").addColumn("content", "text", (col) => col.notNull()).addColumn("preview_media_id", "text").addColumn("source", "text", (col) => col.notNull().defaultTo("user")).addColumn("theme_id", "text").addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).addColumn("updated_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
	await db.schema.createIndex("idx_sections_category").on("_emdash_sections").columns(["category_id"]).execute();
	await db.schema.createIndex("idx_sections_source").on("_emdash_sections").columns(["source"]).execute();
}
async function down$26(db) {
	await db.schema.dropIndex("idx_sections_source").execute();
	await db.schema.dropIndex("idx_sections_category").execute();
	await db.schema.dropTable("_emdash_sections").execute();
	await db.schema.dropTable("_emdash_section_categories").execute();
}

//#endregion
//#region src/database/migrations/012_search.ts
var _012_search_exports = /* @__PURE__ */ __exportAll({
	down: () => down$25,
	up: () => up$25
});
/**
* Migration: Search Support
*
* Adds search configuration to collections and searchable flag to fields.
* FTS5 tables are created dynamically when search is enabled for a collection.
*/
async function up$25(db) {
	await db.schema.alterTable("_emdash_collections").addColumn("search_config", "text").execute();
	await db.schema.alterTable("_emdash_fields").addColumn("searchable", "integer", (col) => col.defaultTo(0)).execute();
}
async function down$25(db) {
	await db.schema.alterTable("_emdash_fields").dropColumn("searchable").execute();
	await db.schema.alterTable("_emdash_collections").dropColumn("search_config").execute();
}

//#endregion
//#region src/database/migrations/013_scheduled_publishing.ts
var _013_scheduled_publishing_exports = /* @__PURE__ */ __exportAll({
	down: () => down$24,
	up: () => up$24
});
/**
* Migration: Add scheduled publishing support
*
* Adds scheduled_at column to all ec_* content tables.
* When scheduled_at is set and status is 'scheduled', the content
* will be auto-published when the scheduled time is reached.
*/
async function up$24(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`
			ALTER TABLE ${sql.ref(table.name)} 
			ADD COLUMN scheduled_at TEXT
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${table.name}_scheduled`)} 
			ON ${sql.ref(table.name)} (scheduled_at)
			WHERE scheduled_at IS NOT NULL AND status = 'scheduled'
		`.execute(db);
	}
}
async function down$24(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`
			DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_scheduled`)}
		`.execute(db);
		await sql`
			ALTER TABLE ${sql.ref(table.name)} 
			DROP COLUMN scheduled_at
		`.execute(db);
	}
}

//#endregion
//#region src/database/migrations/014_draft_revisions.ts
var _014_draft_revisions_exports = /* @__PURE__ */ __exportAll({
	down: () => down$23,
	up: () => up$23
});
async function up$23(db) {
	const tables = await db.selectFrom("_emdash_collections").select("slug").execute();
	for (const row of tables) {
		const tableName = `ec_${row.slug}`;
		await sql`
			ALTER TABLE ${sql.ref(tableName)}
			ADD COLUMN live_revision_id TEXT REFERENCES revisions(id)
		`.execute(db);
		await sql`
			ALTER TABLE ${sql.ref(tableName)}
			ADD COLUMN draft_revision_id TEXT REFERENCES revisions(id)
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${row.slug}_live_revision`)}
			ON ${sql.ref(tableName)} (live_revision_id)
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${row.slug}_draft_revision`)}
			ON ${sql.ref(tableName)} (draft_revision_id)
		`.execute(db);
	}
}
async function down$23(db) {
	const tables = await db.selectFrom("_emdash_collections").select("slug").execute();
	for (const row of tables) {
		const tableName = `ec_${row.slug}`;
		await sql`
			DROP INDEX IF EXISTS ${sql.ref(`idx_${row.slug}_draft_revision`)}
		`.execute(db);
		await sql`
			DROP INDEX IF EXISTS ${sql.ref(`idx_${row.slug}_live_revision`)}
		`.execute(db);
		await sql`
			ALTER TABLE ${sql.ref(tableName)}
			DROP COLUMN draft_revision_id
		`.execute(db);
		await sql`
			ALTER TABLE ${sql.ref(tableName)}
			DROP COLUMN live_revision_id
		`.execute(db);
	}
}

//#endregion
//#region src/database/migrations/015_indexes.ts
var _015_indexes_exports = /* @__PURE__ */ __exportAll({
	down: () => down$22,
	up: () => up$22
});
/**
* Add performance indexes for common query patterns.
*
* Covers:
* 1. Media table: mime_type, filename, created_at
* 2. content_taxonomies: reverse lookup by taxonomy_id
* 3. taxonomies: parent_id FK
* 4. audit_logs: compound (resource_type, resource_id)
* 5. Retroactive author_id + updated_at on existing ec_* content tables
*    (new tables get these from createContentTable() in registry.ts)
*/
async function up$22(db) {
	await db.schema.createIndex("idx_media_mime_type").on("media").column("mime_type").execute();
	await db.schema.createIndex("idx_media_filename").on("media").column("filename").execute();
	await db.schema.createIndex("idx_media_created_at").on("media").column("created_at").execute();
	await db.schema.createIndex("idx_content_taxonomies_term").on("content_taxonomies").column("taxonomy_id").execute();
	await db.schema.createIndex("idx_taxonomies_parent").on("taxonomies").column("parent_id").execute();
	await db.schema.createIndex("idx_audit_resource").on("audit_logs").columns(["resource_type", "resource_id"]).execute();
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`
			CREATE INDEX ${sql.ref(`idx_${table.name}_author`)} 
			ON ${sql.ref(table.name)} (author_id)
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${table.name}_updated`)} 
			ON ${sql.ref(table.name)} (updated_at)
		`.execute(db);
	}
}
async function down$22(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_updated`)}`.execute(db);
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_author`)}`.execute(db);
	}
	await db.schema.dropIndex("idx_audit_resource").execute();
	await db.schema.dropIndex("idx_taxonomies_parent").execute();
	await db.schema.dropIndex("idx_content_taxonomies_term").execute();
	await db.schema.dropIndex("idx_media_created_at").execute();
	await db.schema.dropIndex("idx_media_filename").execute();
	await db.schema.dropIndex("idx_media_mime_type").execute();
}

//#endregion
//#region src/database/migrations/016_api_tokens.ts
var _016_api_tokens_exports = /* @__PURE__ */ __exportAll({
	down: () => down$21,
	up: () => up$21
});
/**
* API token tables for programmatic access.
*
* Three tables:
* 1. _emdash_api_tokens — Personal Access Tokens (ec_pat_...)
* 2. _emdash_oauth_tokens — OAuth access/refresh tokens (ec_oat_/ec_ort_...)
* 3. _emdash_device_codes — OAuth Device Flow state (RFC 8628)
*
* Every CREATE is guarded with `.ifNotExists()` so the migration is safe to
* re-run against a partially-applied schema. See #954 for the failure mode:
* if `up()` crashes mid-way (D1 subrequest limit, isolate cancellation,
* transient connection error), the migration record never gets inserted
* into `_emdash_migrations`, and the next request retries `up()` from the
* top. Without these guards, the retry crashed with `table ... already
* exists` and blocked every subsequent boot of the Worker.
*/
async function up$21(db) {
	await db.schema.createTable("_emdash_api_tokens").ifNotExists().addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull()).addColumn("token_hash", "text", (col) => col.notNull().unique()).addColumn("prefix", "text", (col) => col.notNull()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("scopes", "text", (col) => col.notNull()).addColumn("expires_at", "text").addColumn("last_used_at", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint("api_tokens_user_fk", ["user_id"], "users", ["id"], (cb) => cb.onDelete("cascade")).execute();
	await db.schema.createIndex("idx_api_tokens_token_hash").ifNotExists().on("_emdash_api_tokens").column("token_hash").execute();
	await db.schema.createIndex("idx_api_tokens_user_id").ifNotExists().on("_emdash_api_tokens").column("user_id").execute();
	await db.schema.createTable("_emdash_oauth_tokens").ifNotExists().addColumn("token_hash", "text", (col) => col.primaryKey()).addColumn("token_type", "text", (col) => col.notNull()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("scopes", "text", (col) => col.notNull()).addColumn("client_type", "text", (col) => col.notNull().defaultTo("cli")).addColumn("expires_at", "text", (col) => col.notNull()).addColumn("refresh_token_hash", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint("oauth_tokens_user_fk", ["user_id"], "users", ["id"], (cb) => cb.onDelete("cascade")).execute();
	await db.schema.createIndex("idx_oauth_tokens_user_id").ifNotExists().on("_emdash_oauth_tokens").column("user_id").execute();
	await db.schema.createIndex("idx_oauth_tokens_expires").ifNotExists().on("_emdash_oauth_tokens").column("expires_at").execute();
	await db.schema.createTable("_emdash_device_codes").ifNotExists().addColumn("device_code", "text", (col) => col.primaryKey()).addColumn("user_code", "text", (col) => col.notNull().unique()).addColumn("scopes", "text", (col) => col.notNull()).addColumn("user_id", "text").addColumn("status", "text", (col) => col.notNull().defaultTo("pending")).addColumn("expires_at", "text", (col) => col.notNull()).addColumn("interval", "integer", (col) => col.notNull().defaultTo(5)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
}
async function down$21(db) {
	await db.schema.dropTable("_emdash_device_codes").ifExists().execute();
	await db.schema.dropTable("_emdash_oauth_tokens").ifExists().execute();
	await db.schema.dropTable("_emdash_api_tokens").ifExists().execute();
}

//#endregion
//#region src/database/migrations/017_authorization_codes.ts
var _017_authorization_codes_exports = /* @__PURE__ */ __exportAll({
	down: () => down$20,
	up: () => up$20
});
/**
* Authorization codes for OAuth 2.1 Authorization Code + PKCE flow.
*
* Used by MCP clients (Claude Desktop, VS Code, etc.) to authenticate
* via the standard OAuth authorization code grant.
*
* Also adds client_id tracking to oauth_tokens for per-client revocation.
*/
async function up$20(db) {
	await db.schema.createTable("_emdash_authorization_codes").addColumn("code_hash", "text", (col) => col.primaryKey()).addColumn("client_id", "text", (col) => col.notNull()).addColumn("redirect_uri", "text", (col) => col.notNull()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("scopes", "text", (col) => col.notNull()).addColumn("code_challenge", "text", (col) => col.notNull()).addColumn("code_challenge_method", "text", (col) => col.notNull().defaultTo("S256")).addColumn("resource", "text").addColumn("expires_at", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint("auth_codes_user_fk", ["user_id"], "users", ["id"], (cb) => cb.onDelete("cascade")).execute();
	await db.schema.createIndex("idx_auth_codes_expires").on("_emdash_authorization_codes").column("expires_at").execute();
	await sql`ALTER TABLE _emdash_oauth_tokens ADD COLUMN client_id TEXT`.execute(db);
}
async function down$20(db) {
	await db.schema.dropTable("_emdash_authorization_codes").execute();
}

//#endregion
//#region src/database/migrations/018_seo.ts
var _018_seo_exports = /* @__PURE__ */ __exportAll({
	down: () => down$19,
	up: () => up$19
});
/**
* Migration: SEO support
*
* Creates:
* - `_emdash_seo` table: per-content SEO metadata (separate from content tables)
* - `has_seo` column on `_emdash_collections`: opt-in flag per collection
*
* SEO is not a universal concern — only collections representing web pages
* need it. The `has_seo` flag controls whether the admin shows SEO fields
* and whether the collection's content appears in sitemaps.
*/
async function up$19(db) {
	await db.schema.createTable("_emdash_seo").addColumn("collection", "text", (col) => col.notNull()).addColumn("content_id", "text", (col) => col.notNull()).addColumn("seo_title", "text").addColumn("seo_description", "text").addColumn("seo_image", "text").addColumn("seo_canonical", "text").addColumn("seo_no_index", "integer", (col) => col.notNull().defaultTo(0)).addColumn("created_at", "text", (col) => col.notNull().defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.notNull().defaultTo(currentTimestamp(db))).addPrimaryKeyConstraint("_emdash_seo_pk", ["collection", "content_id"]).execute();
	await sql`
		CREATE INDEX idx_emdash_seo_collection
		ON _emdash_seo (collection)
	`.execute(db);
	await sql`
		ALTER TABLE _emdash_collections
		ADD COLUMN has_seo INTEGER NOT NULL DEFAULT 0
	`.execute(db);
}
async function down$19(db) {
	await sql`DROP TABLE IF EXISTS _emdash_seo`.execute(db);
	await sql`
		ALTER TABLE _emdash_collections
		DROP COLUMN has_seo
	`.execute(db);
}

//#endregion
//#region src/database/migrations/019_i18n.ts
var _019_i18n_exports = /* @__PURE__ */ __exportAll({
	down: () => down$18,
	up: () => up$18
});
/**
* Quote an identifier for use in raw SQL. Escapes embedded double-quotes
* per SQL standard (double them). The name should first pass
* validateIdentifier() or validateTableName() for defense-in-depth.
*/
const DOUBLE_QUOTE_RE = /"/g;
function quoteIdent(name) {
	return `"${name.replace(DOUBLE_QUOTE_RE, "\"\"")}"`;
}
/** Suffix added to tmp tables during i18n migration rebuild. */
const I18N_TMP_SUFFIX = /_i18n_tmp$/;
/** Table names from sqlite_master are ec_{slug} — validate the pattern. */
const TABLE_NAME_PATTERN = /^ec_[a-z][a-z0-9_]*$/;
function validateTableName(name) {
	if (!TABLE_NAME_PATTERN.test(name)) throw new Error(`Invalid content table name: "${name}"`);
}
/** SQLite column types produced by EmDash's schema registry. */
const ALLOWED_COLUMN_TYPES = new Set([
	"TEXT",
	"INTEGER",
	"REAL",
	"BLOB",
	"JSON",
	"NUMERIC",
	""
]);
function validateColumnType(type, colName) {
	if (!ALLOWED_COLUMN_TYPES.has(type.toUpperCase())) throw new Error(`Unexpected column type "${type}" for column "${colName}"`);
}
/**
* Validate that a default value expression from PRAGMA table_info is safe
* to interpolate into DDL. Allows: string literals, numeric literals,
* NULL, and known function calls like datetime('now').
*
* Note: PRAGMA table_info strips the outer parens from expression defaults,
* so `DEFAULT (datetime('now'))` is reported as `datetime('now')`.
* We accept both forms and re-wrap in parens via normalizeDdlDefault().
*/
const SAFE_DEFAULT_PATTERN = /^(?:'[^']*'|NULL|-?\d+(?:\.\d+)?|\(?datetime\('now'\)\)?|\(?json\('[^']*'\)\)?|0|1)$/i;
function validateDefaultValue(value, colName) {
	if (!SAFE_DEFAULT_PATTERN.test(value)) throw new Error(`Unexpected default value "${value}" for column "${colName}"`);
}
/**
* Normalize a PRAGMA table_info default value for use in DDL.
* Function-call defaults (e.g. `datetime('now')`) must be wrapped in parens
* to form valid expression defaults: `DEFAULT (datetime('now'))`.
* PRAGMA strips the outer parens, so we re-add them here.
*/
const FUNCTION_DEFAULT_PATTERN = /^(?:datetime|json)\(/i;
function normalizeDdlDefault(value) {
	if (value.startsWith("(")) return value;
	if (FUNCTION_DEFAULT_PATTERN.test(value)) return `(${value})`;
	return value;
}
/**
* Validate that a CREATE INDEX statement from sqlite_master is safe to replay.
* Must start with CREATE [UNIQUE] INDEX and not contain suspicious patterns.
*/
const CREATE_INDEX_PATTERN = /^CREATE\s+(UNIQUE\s+)?INDEX\s+/i;
function validateCreateIndexSql(sqlStr, idxName) {
	if (!CREATE_INDEX_PATTERN.test(sqlStr)) throw new Error(`Unexpected index SQL for "${idxName}": does not match CREATE INDEX pattern`);
	if (sqlStr.includes(";")) throw new Error(`Unexpected index SQL for "${idxName}": contains semicolon`);
}
/**
* PostgreSQL path: ALTER TABLE supports ADD COLUMN and DROP CONSTRAINT directly.
* No table rebuild needed.
*/
async function upPostgres(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const t of tableNames) {
		validateTableName(t);
		if ((await sql`
			SELECT EXISTS(
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = ${t} AND column_name = 'locale'
			) as exists
		`.execute(db)).rows[0]?.exists === true) continue;
		await sql`ALTER TABLE ${sql.ref(t)} ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'`.execute(db);
		await sql`ALTER TABLE ${sql.ref(t)} ADD COLUMN translation_group TEXT`.execute(db);
		const constraints = await sql`
			SELECT conname FROM pg_constraint
			WHERE conrelid = ${t}::regclass
			AND contype = 'u'
			AND array_length(conkey, 1) = 1
			AND conkey[1] = (
				SELECT attnum FROM pg_attribute
				WHERE attrelid = ${t}::regclass AND attname = 'slug'
			)
		`.execute(db);
		for (const c of constraints.rows) await sql`ALTER TABLE ${sql.ref(t)} DROP CONSTRAINT ${sql.ref(c.conname)}`.execute(db);
		await sql`
			ALTER TABLE ${sql.ref(t)}
			ADD CONSTRAINT ${sql.ref(`${t}_slug_locale_unique`)} UNIQUE (slug, locale)
		`.execute(db);
		await sql`UPDATE ${sql.ref(t)} SET translation_group = id`.execute(db);
		await sql`CREATE INDEX ${sql.ref(`idx_${t}_locale`)} ON ${sql.ref(t)} (locale)`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${t}_translation_group`)}
			ON ${sql.ref(t)} (translation_group)
		`.execute(db);
	}
	if ((await sql`
		SELECT EXISTS(
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = '_emdash_fields' AND column_name = 'translatable'
		) as exists
	`.execute(db)).rows[0]?.exists !== true) await sql`
			ALTER TABLE _emdash_fields
			ADD COLUMN translatable INTEGER NOT NULL DEFAULT 1
		`.execute(db);
}
async function up$18(db) {
	if (!isSqlite(db)) return upPostgres(db);
	const orphanedTmps = await listTablesLike(db, "ec_%_i18n_tmp");
	for (const tmpName of orphanedTmps) {
		validateTableName(tmpName.replace(I18N_TMP_SUFFIX, ""));
		await sql`DROP TABLE IF EXISTS ${sql.ref(tmpName)}`.execute(db);
	}
	const tables = { rows: (await listTablesLike(db, "ec_%")).map((name) => ({ name })) };
	for (const table of tables.rows) {
		const t = table.name;
		validateTableName(t);
		const tmp = `${t}_i18n_tmp`;
		{
			const trx = db;
			const columns = (await sql`
				PRAGMA table_info(${sql.ref(t)})
			`.execute(trx)).rows;
			if (columns.some((col) => col.name === "locale")) continue;
			const idxResult = await sql`
				PRAGMA index_list(${sql.ref(t)})
			`.execute(trx);
			const indexDefs = [];
			for (const idx of idxResult.rows) {
				if (idx.origin === "pk" || idx.name.startsWith("sqlite_autoindex_")) continue;
				const idxColResult = await sql`
					PRAGMA index_info(${sql.ref(idx.name)})
				`.execute(trx);
				indexDefs.push({
					name: idx.name,
					unique: idx.unique === 1,
					columns: idxColResult.rows.map((c) => c.name),
					partial: idx.partial
				});
			}
			const partialSqls = /* @__PURE__ */ new Map();
			for (const idx of indexDefs) if (idx.partial) {
				const createResult = await sql`
						SELECT sql FROM sqlite_master 
						WHERE type = 'index' AND name = ${idx.name}
					`.execute(trx);
				if (createResult.rows[0]?.sql) partialSqls.set(idx.name, createResult.rows[0].sql);
			}
			for (const col of columns) validateIdentifier(col.name, "column name");
			const colDefs = [];
			const colNames = [];
			for (const col of columns) {
				validateColumnType(col.type || "TEXT", col.name);
				colNames.push(quoteIdent(col.name));
				let def = `${quoteIdent(col.name)} ${col.type || "TEXT"}`;
				if (col.pk) def += " PRIMARY KEY";
				else if (col.name === "slug") ; else if (col.notnull) def += " NOT NULL";
				if (col.dflt_value !== null) {
					validateDefaultValue(col.dflt_value, col.name);
					def += ` DEFAULT ${normalizeDdlDefault(col.dflt_value)}`;
				}
				colDefs.push(def);
			}
			colDefs.push("\"locale\" TEXT NOT NULL DEFAULT 'en'");
			colDefs.push("\"translation_group\" TEXT");
			colDefs.push("UNIQUE(\"slug\", \"locale\")");
			const createColsSql = colDefs.join(",\n				");
			const selectColsSql = colNames.join(", ");
			for (const idx of indexDefs) await sql`DROP INDEX IF EXISTS ${sql.ref(idx.name)}`.execute(trx);
			await sql.raw(`CREATE TABLE ${quoteIdent(tmp)} (\n\t\t\t\t${createColsSql}\n\t\t\t)`).execute(trx);
			await sql.raw(`INSERT INTO ${quoteIdent(tmp)} (${selectColsSql}, "locale", "translation_group")\n\t\t\t SELECT ${selectColsSql}, 'en', "id" FROM ${quoteIdent(t)}`).execute(trx);
			await sql`DROP TABLE ${sql.ref(t)}`.execute(trx);
			await sql.raw(`ALTER TABLE ${quoteIdent(tmp)} RENAME TO ${quoteIdent(t)}`).execute(trx);
			for (const idx of indexDefs) {
				if (idx.name === `idx_${t}_slug`) continue;
				if (idx.partial && partialSqls.has(idx.name)) {
					const idxSql = partialSqls.get(idx.name);
					validateCreateIndexSql(idxSql, idx.name);
					await sql.raw(idxSql).execute(trx);
				} else {
					for (const c of idx.columns) validateIdentifier(c, "index column name");
					const cols = idx.columns.map((c) => quoteIdent(c)).join(", ");
					const unique = idx.unique ? "UNIQUE " : "";
					await sql.raw(`CREATE ${unique}INDEX ${quoteIdent(idx.name)} ON ${quoteIdent(t)} (${cols})`).execute(trx);
				}
			}
			await sql`
				CREATE INDEX ${sql.ref(`idx_${t}_slug`)} 
				ON ${sql.ref(t)} (slug)
			`.execute(trx);
			await sql`
				CREATE INDEX ${sql.ref(`idx_${t}_locale`)} 
				ON ${sql.ref(t)} (locale)
			`.execute(trx);
			await sql`
				CREATE INDEX ${sql.ref(`idx_${t}_translation_group`)} 
				ON ${sql.ref(t)} (translation_group)
			`.execute(trx);
		}
	}
	if (!(await sql`
		PRAGMA table_info(_emdash_fields)
	`.execute(db)).rows.some((col) => col.name === "translatable")) await sql`
			ALTER TABLE _emdash_fields 
			ADD COLUMN translatable INTEGER NOT NULL DEFAULT 1
		`.execute(db);
}
/**
* PostgreSQL down path: straightforward ALTER TABLE operations.
*/
async function downPostgres(db) {
	await sql`ALTER TABLE _emdash_fields DROP COLUMN translatable`.execute(db);
	const tableNames = await listTablesLike(db, "ec_%");
	for (const t of tableNames) {
		validateTableName(t);
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${t}_locale`)}`.execute(db);
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${t}_translation_group`)}`.execute(db);
		await sql`ALTER TABLE ${sql.ref(t)} DROP CONSTRAINT IF EXISTS ${sql.ref(`${t}_slug_locale_unique`)}`.execute(db);
		await sql`ALTER TABLE ${sql.ref(t)} ADD CONSTRAINT ${sql.ref(`${t}_slug_unique`)} UNIQUE (slug)`.execute(db);
		await sql`ALTER TABLE ${sql.ref(t)} DROP COLUMN locale`.execute(db);
		await sql`ALTER TABLE ${sql.ref(t)} DROP COLUMN translation_group`.execute(db);
	}
}
async function down$18(db) {
	if (!isSqlite(db)) return downPostgres(db);
	await sql`
		ALTER TABLE _emdash_fields
		DROP COLUMN translatable
	`.execute(db);
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const t = tableName;
		validateTableName(t);
		const tmp = `${t}_i18n_tmp`;
		{
			const trx = db;
			const columns = (await sql`
				PRAGMA table_info(${sql.ref(t)})
			`.execute(trx)).rows;
			const idxResult = await sql`
				PRAGMA index_list(${sql.ref(t)})
			`.execute(trx);
			const indexDefs = [];
			for (const idx of idxResult.rows) {
				if (idx.origin === "pk" || idx.name.startsWith("sqlite_autoindex_")) continue;
				const idxColResult = await sql`
					PRAGMA index_info(${sql.ref(idx.name)})
				`.execute(trx);
				indexDefs.push({
					name: idx.name,
					unique: idx.unique === 1,
					columns: idxColResult.rows.map((c) => c.name),
					partial: idx.partial
				});
			}
			const partialSqls = /* @__PURE__ */ new Map();
			for (const idx of indexDefs) if (idx.partial) {
				const createResult = await sql`
						SELECT sql FROM sqlite_master 
						WHERE type = 'index' AND name = ${idx.name}
					`.execute(trx);
				if (createResult.rows[0]?.sql) partialSqls.set(idx.name, createResult.rows[0].sql);
			}
			for (const col of columns) {
				if (col.name === "locale" || col.name === "translation_group") continue;
				validateIdentifier(col.name, "column name");
			}
			const colDefs = [];
			const colNames = [];
			for (const col of columns) {
				if (col.name === "locale" || col.name === "translation_group") continue;
				validateColumnType(col.type || "TEXT", col.name);
				colNames.push(quoteIdent(col.name));
				let def = `${quoteIdent(col.name)} ${col.type || "TEXT"}`;
				if (col.pk) def += " PRIMARY KEY";
				else if (col.name === "slug") def += " UNIQUE";
				else if (col.notnull) def += " NOT NULL";
				if (col.dflt_value !== null) {
					validateDefaultValue(col.dflt_value, col.name);
					def += ` DEFAULT ${normalizeDdlDefault(col.dflt_value)}`;
				}
				colDefs.push(def);
			}
			const createColsSql = colDefs.join(",\n				");
			const selectColsSql = colNames.join(", ");
			for (const idx of indexDefs) await sql`DROP INDEX IF EXISTS ${sql.ref(idx.name)}`.execute(trx);
			await sql.raw(`CREATE TABLE ${quoteIdent(tmp)} (\n\t\t\t\t${createColsSql}\n\t\t\t)`).execute(trx);
			await sql.raw(`INSERT OR IGNORE INTO ${quoteIdent(tmp)} (${selectColsSql})
			 SELECT ${selectColsSql} FROM ${quoteIdent(t)}
			 WHERE "locale" = 'en'`).execute(trx);
			await sql.raw(`INSERT OR IGNORE INTO ${quoteIdent(tmp)} (${selectColsSql})
			 SELECT ${selectColsSql} FROM ${quoteIdent(t)}
			 WHERE "id" NOT IN (SELECT "id" FROM ${quoteIdent(tmp)})
			 AND "id" IN (
				SELECT "id" FROM ${quoteIdent(t)} AS t2
				WHERE t2."translation_group" IS NOT NULL
				AND t2."locale" = (
					SELECT MIN(t3."locale") FROM ${quoteIdent(t)} AS t3
					WHERE t3."translation_group" = t2."translation_group"
				)
			 )`).execute(trx);
			await sql.raw(`INSERT OR IGNORE INTO ${quoteIdent(tmp)} (${selectColsSql})
			 SELECT ${selectColsSql} FROM ${quoteIdent(t)}
			 WHERE "id" NOT IN (SELECT "id" FROM ${quoteIdent(tmp)})
			 AND "translation_group" IS NULL`).execute(trx);
			await sql`DROP TABLE ${sql.ref(t)}`.execute(trx);
			await sql.raw(`ALTER TABLE ${quoteIdent(tmp)} RENAME TO ${quoteIdent(t)}`).execute(trx);
			for (const idx of indexDefs) {
				if (idx.name === `idx_${t}_locale`) continue;
				if (idx.name === `idx_${t}_translation_group`) continue;
				if (idx.partial && partialSqls.has(idx.name)) {
					const idxSql = partialSqls.get(idx.name);
					validateCreateIndexSql(idxSql, idx.name);
					await sql.raw(idxSql).execute(trx);
				} else {
					const cols = idx.columns.filter((c) => c !== "locale" && c !== "translation_group");
					if (cols.length === 0) continue;
					for (const c of cols) validateIdentifier(c, "index column name");
					const colsSql = cols.map((c) => quoteIdent(c)).join(", ");
					const unique = idx.unique ? "UNIQUE " : "";
					await sql.raw(`CREATE ${unique}INDEX ${quoteIdent(idx.name)} ON ${quoteIdent(t)} (${colsSql})`).execute(trx);
				}
			}
		}
	}
}

//#endregion
//#region src/database/migrations/020_collection_url_pattern.ts
var _020_collection_url_pattern_exports = /* @__PURE__ */ __exportAll({
	down: () => down$17,
	up: () => up$17
});
/**
* Migration: URL pattern for collections
*
* Adds `url_pattern` column to `_emdash_collections` so each collection
* can declare its own URL structure (e.g. "/{slug}" for pages, "/blog/{slug}"
* for posts). Used for menu URL resolution, sitemaps, and path-based lookups.
*/
async function up$17(db) {
	await sql`
		ALTER TABLE _emdash_collections
		ADD COLUMN url_pattern TEXT
	`.execute(db);
}
async function down$17(db) {
	await sql`
		ALTER TABLE _emdash_collections
		DROP COLUMN url_pattern
	`.execute(db);
}

//#endregion
//#region src/database/migrations/021_remove_section_categories.ts
var _021_remove_section_categories_exports = /* @__PURE__ */ __exportAll({
	down: () => down$16,
	up: () => up$16
});
/**
* Migration: Remove section categories
*
* Section categories had a complete backend but no UI to create or manage them.
* Rather than building the missing UI for a feature with very little need at this stage,
* we're removing the feature entirely.
*/
async function up$16(db) {
	await db.schema.dropIndex("idx_sections_category").ifExists().execute();
	await db.schema.alterTable("_emdash_sections").dropColumn("category_id").execute();
	await db.schema.dropTable("_emdash_section_categories").execute();
}
async function down$16(db) {
	await db.schema.createTable("_emdash_section_categories").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("sort_order", "integer", (col) => col.defaultTo(0)).addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
	await db.schema.alterTable("_emdash_sections").addColumn("category_id", "text", (col) => col.references("_emdash_section_categories.id").onDelete("set null")).execute();
	await db.schema.createIndex("idx_sections_category").on("_emdash_sections").columns(["category_id"]).execute();
}

//#endregion
//#region src/database/migrations/022_marketplace_plugin_state.ts
var _022_marketplace_plugin_state_exports = /* @__PURE__ */ __exportAll({
	down: () => down$15,
	up: () => up$15
});
/**
* Migration: Add marketplace fields to _plugin_state
*
* Adds `source` and `marketplace_version` columns to track
* whether a plugin was installed from config or marketplace,
* and which marketplace version is installed.
*/
async function up$15(db) {
	await sql`
		ALTER TABLE _plugin_state
		ADD COLUMN source TEXT NOT NULL DEFAULT 'config'
	`.execute(db);
	await sql`
		ALTER TABLE _plugin_state
		ADD COLUMN marketplace_version TEXT
	`.execute(db);
	await sql`
		CREATE INDEX idx_plugin_state_source
		ON _plugin_state (source)
		WHERE source = 'marketplace'
	`.execute(db);
}
async function down$15(db) {
	await sql`
		DROP INDEX IF EXISTS idx_plugin_state_source
	`.execute(db);
	await sql`
		ALTER TABLE _plugin_state
		DROP COLUMN marketplace_version
	`.execute(db);
	await sql`
		ALTER TABLE _plugin_state
		DROP COLUMN source
	`.execute(db);
}

//#endregion
//#region src/database/migrations/023_plugin_metadata.ts
var _023_plugin_metadata_exports = /* @__PURE__ */ __exportAll({
	down: () => down$14,
	up: () => up$14
});
/**
* Migration: Add display metadata to _plugin_state
*
* Stores display_name and description for marketplace plugins
* so the admin UI can show meaningful info without re-fetching
* from the marketplace on every page load.
*/
async function up$14(db) {
	await sql`
		ALTER TABLE _plugin_state
		ADD COLUMN display_name TEXT
	`.execute(db);
	await sql`
		ALTER TABLE _plugin_state
		ADD COLUMN description TEXT
	`.execute(db);
}
async function down$14(db) {
	await sql`
		ALTER TABLE _plugin_state
		DROP COLUMN description
	`.execute(db);
	await sql`
		ALTER TABLE _plugin_state
		DROP COLUMN display_name
	`.execute(db);
}

//#endregion
//#region src/database/migrations/024_media_placeholders.ts
var _024_media_placeholders_exports = /* @__PURE__ */ __exportAll({
	down: () => down$13,
	up: () => up$13
});
/**
* Migration: Add placeholder columns to media table
*
* Stores blurhash and dominant_color for LQIP (Low Quality Image Placeholder)
* support. Generated at upload time from image pixel data.
*/
async function up$13(db) {
	await sql`
		ALTER TABLE media
		ADD COLUMN blurhash TEXT
	`.execute(db);
	await sql`
		ALTER TABLE media
		ADD COLUMN dominant_color TEXT
	`.execute(db);
}
async function down$13(db) {
	await sql`
		ALTER TABLE media
		DROP COLUMN dominant_color
	`.execute(db);
	await sql`
		ALTER TABLE media
		DROP COLUMN blurhash
	`.execute(db);
}

//#endregion
//#region src/database/migrations/025_oauth_clients.ts
var _025_oauth_clients_exports = /* @__PURE__ */ __exportAll({
	down: () => down$12,
	up: () => up$12
});
/**
* Migration: Create OAuth clients table
*
* Implements the oauth_clients registry so that the authorization endpoint
* can validate client_id and enforce a per-client redirect URI allowlist.
*
* Each client has a set of pre-registered redirect URIs (JSON array).
* The authorize endpoint rejects any redirect_uri not in the client's list.
*/
async function up$12(db) {
	await db.schema.createTable("_emdash_oauth_clients").addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull()).addColumn("redirect_uris", "text", (col) => col.notNull()).addColumn("scopes", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
}
async function down$12(db) {
	await db.schema.dropTable("_emdash_oauth_clients").execute();
}

//#endregion
//#region src/database/migrations/026_cron_tasks.ts
var _026_cron_tasks_exports = /* @__PURE__ */ __exportAll({
	down: () => down$11,
	up: () => up$11
});
/**
* Migration: Create cron tasks table for plugin scheduled tasks.
*
* Each plugin can register cron tasks (recurring or one-shot) which are
* stored here and executed by the platform-specific scheduler.
*
* The `next_run_at` + `status` + `enabled` index drives the "find overdue
* tasks" query used by CronExecutor.tick().
*/
async function up$11(db) {
	await db.schema.createTable("_emdash_cron_tasks").addColumn("id", "text", (col) => col.primaryKey()).addColumn("plugin_id", "text", (col) => col.notNull()).addColumn("task_name", "text", (col) => col.notNull()).addColumn("schedule", "text", (col) => col.notNull()).addColumn("is_oneshot", "integer", (col) => col.notNull().defaultTo(0)).addColumn("data", "text").addColumn("next_run_at", "text", (col) => col.notNull()).addColumn("last_run_at", "text").addColumn("status", "text", (col) => col.notNull().defaultTo("idle")).addColumn("locked_at", "text").addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addUniqueConstraint("uq_cron_tasks_plugin_task", ["plugin_id", "task_name"]).execute();
	await db.schema.createIndex("idx_cron_tasks_due").on("_emdash_cron_tasks").columns([
		"enabled",
		"status",
		"next_run_at"
	]).execute();
	await db.schema.createIndex("idx_cron_tasks_plugin").on("_emdash_cron_tasks").column("plugin_id").execute();
}
async function down$11(db) {
	await db.schema.dropTable("_emdash_cron_tasks").execute();
}

//#endregion
//#region src/database/migrations/027_comments.ts
var _027_comments_exports = /* @__PURE__ */ __exportAll({
	down: () => down$10,
	up: () => up$10
});
async function up$10(db) {
	await db.schema.createTable("_emdash_comments").addColumn("id", "text", (col) => col.primaryKey()).addColumn("collection", "text", (col) => col.notNull()).addColumn("content_id", "text", (col) => col.notNull()).addColumn("parent_id", "text", (col) => col.references("_emdash_comments.id").onDelete("cascade")).addColumn("author_name", "text", (col) => col.notNull()).addColumn("author_email", "text", (col) => col.notNull()).addColumn("author_url", "text").addColumn("author_user_id", "text", (col) => col.references("users.id").onDelete("set null")).addColumn("body", "text", (col) => col.notNull()).addColumn("status", "text", (col) => col.notNull().defaultTo("pending")).addColumn("ip_hash", "text").addColumn("user_agent", "text").addColumn("moderation_metadata", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.schema.createIndex("idx_comments_content").on("_emdash_comments").columns([
		"collection",
		"content_id",
		"status"
	]).execute();
	await db.schema.createIndex("idx_comments_parent").on("_emdash_comments").column("parent_id").execute();
	await db.schema.createIndex("idx_comments_status").on("_emdash_comments").columns(["status", "created_at"]).execute();
	await db.schema.createIndex("idx_comments_author_email").on("_emdash_comments").column("author_email").execute();
	await db.schema.createIndex("idx_comments_author_user").on("_emdash_comments").column("author_user_id").execute();
	await db.schema.alterTable("_emdash_collections").addColumn("comments_enabled", "integer", (col) => col.defaultTo(0)).execute();
	await db.schema.alterTable("_emdash_collections").addColumn("comments_moderation", "text", (col) => col.defaultTo("first_time")).execute();
	await db.schema.alterTable("_emdash_collections").addColumn("comments_closed_after_days", "integer", (col) => col.defaultTo(90)).execute();
	await db.schema.alterTable("_emdash_collections").addColumn("comments_auto_approve_users", "integer", (col) => col.defaultTo(1)).execute();
}
async function down$10(db) {
	await db.schema.dropTable("_emdash_comments").execute();
}

//#endregion
//#region src/database/migrations/028_drop_author_url.ts
var _028_drop_author_url_exports = /* @__PURE__ */ __exportAll({
	down: () => down$9,
	up: () => up$9
});
async function up$9(db) {
	await sql`ALTER TABLE _emdash_comments DROP COLUMN author_url`.execute(db);
}
async function down$9(db) {
	await db.schema.alterTable("_emdash_comments").addColumn("author_url", "text").execute();
}

//#endregion
//#region src/database/migrations/029_redirects.ts
var _029_redirects_exports = /* @__PURE__ */ __exportAll({
	down: () => down$8,
	up: () => up$8
});
async function up$8(db) {
	await db.schema.createTable("_emdash_redirects").addColumn("id", "text", (col) => col.primaryKey()).addColumn("source", "text", (col) => col.notNull()).addColumn("destination", "text", (col) => col.notNull()).addColumn("type", "integer", (col) => col.notNull().defaultTo(301)).addColumn("is_pattern", "integer", (col) => col.notNull().defaultTo(0)).addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1)).addColumn("hits", "integer", (col) => col.notNull().defaultTo(0)).addColumn("last_hit_at", "text").addColumn("group_name", "text").addColumn("auto", "integer", (col) => col.notNull().defaultTo(0)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.schema.createIndex("idx_redirects_source").on("_emdash_redirects").column("source").execute();
	await db.schema.createIndex("idx_redirects_enabled").on("_emdash_redirects").column("enabled").execute();
	await db.schema.createIndex("idx_redirects_group").on("_emdash_redirects").column("group_name").execute();
	await db.schema.createTable("_emdash_404_log").addColumn("id", "text", (col) => col.primaryKey()).addColumn("path", "text", (col) => col.notNull()).addColumn("referrer", "text").addColumn("user_agent", "text").addColumn("ip", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await db.schema.createIndex("idx_404_log_path").on("_emdash_404_log").column("path").execute();
	await db.schema.createIndex("idx_404_log_created").on("_emdash_404_log").column("created_at").execute();
}
async function down$8(db) {
	await db.schema.dropTable("_emdash_404_log").execute();
	await db.schema.dropTable("_emdash_redirects").execute();
}

//#endregion
//#region src/database/migrations/030_widen_scheduled_index.ts
var _030_widen_scheduled_index_exports = /* @__PURE__ */ __exportAll({
	down: () => down$7,
	up: () => up$7
});
/**
* Migration: Widen scheduled publishing index
*
* The original partial index (013) only covered status='scheduled'.
* Published posts can now have scheduled draft changes, so widen the
* index to cover all rows where scheduled_at IS NOT NULL.
*/
async function up$7(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`
			DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_scheduled`)}
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${table.name}_scheduled`)}
			ON ${sql.ref(table.name)} (scheduled_at)
			WHERE scheduled_at IS NOT NULL
		`.execute(db);
	}
}
async function down$7(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`
			DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_scheduled`)}
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${table.name}_scheduled`)}
			ON ${sql.ref(table.name)} (scheduled_at)
			WHERE scheduled_at IS NOT NULL AND status = 'scheduled'
		`.execute(db);
	}
}

//#endregion
//#region src/database/migrations/031_bylines.ts
var _031_bylines_exports = /* @__PURE__ */ __exportAll({
	down: () => down$6,
	up: () => up$6
});
async function up$6(db) {
	await db.schema.createTable("_emdash_bylines").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("display_name", "text", (col) => col.notNull()).addColumn("bio", "text").addColumn("avatar_media_id", "text", (col) => col.references("media.id").onDelete("set null")).addColumn("website_url", "text").addColumn("user_id", "text", (col) => col.references("users.id").onDelete("set null")).addColumn("is_guest", "integer", (col) => col.notNull().defaultTo(0)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
	await sql`
		CREATE UNIQUE INDEX ${sql.ref("idx_bylines_user_id_unique")}
		ON ${sql.ref("_emdash_bylines")} (user_id)
		WHERE user_id IS NOT NULL
	`.execute(db);
	await db.schema.createIndex("idx_bylines_slug").on("_emdash_bylines").column("slug").execute();
	await db.schema.createIndex("idx_bylines_display_name").on("_emdash_bylines").column("display_name").execute();
	await db.schema.createTable("_emdash_content_bylines").addColumn("id", "text", (col) => col.primaryKey()).addColumn("collection_slug", "text", (col) => col.notNull()).addColumn("content_id", "text", (col) => col.notNull()).addColumn("byline_id", "text", (col) => col.notNull().references("_emdash_bylines.id").onDelete("cascade")).addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0)).addColumn("role_label", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addUniqueConstraint("content_bylines_unique", [
		"collection_slug",
		"content_id",
		"byline_id"
	]).execute();
	await db.schema.createIndex("idx_content_bylines_content").on("_emdash_content_bylines").columns([
		"collection_slug",
		"content_id",
		"sort_order"
	]).execute();
	await db.schema.createIndex("idx_content_bylines_byline").on("_emdash_content_bylines").column("byline_id").execute();
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		await sql`
			ALTER TABLE ${sql.ref(tableName)}
			ADD COLUMN primary_byline_id TEXT
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_primary_byline`)}
			ON ${sql.ref(tableName)} (primary_byline_id)
		`.execute(db);
	}
}
async function down$6(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		await sql`
			DROP INDEX IF EXISTS ${sql.ref(`idx_${tableName}_primary_byline`)}
		`.execute(db);
		await sql`
			ALTER TABLE ${sql.ref(tableName)}
			DROP COLUMN primary_byline_id
		`.execute(db);
	}
	await db.schema.dropTable("_emdash_content_bylines").execute();
	await db.schema.dropTable("_emdash_bylines").execute();
}

//#endregion
//#region src/database/migrations/032_rate_limits.ts
var _032_rate_limits_exports = /* @__PURE__ */ __exportAll({
	down: () => down$5,
	up: () => up$5
});
/**
* Migration: Rate limits table + device code polling tracking.
*
* 1. Create _emdash_rate_limits for database-backed rate limiting
*    of unauthenticated endpoints (device code, magic link, passkey).
*
* 2. Add last_polled_at column to _emdash_device_codes for
*    RFC 8628 slow_down enforcement.
*/
async function up$5(db) {
	await db.schema.createTable("_emdash_rate_limits").addColumn("key", "text", (col) => col.notNull()).addColumn("window", "text", (col) => col.notNull()).addColumn("count", "integer", (col) => col.notNull().defaultTo(1)).addPrimaryKeyConstraint("pk_rate_limits", ["key", "window"]).execute();
	await db.schema.createIndex("idx_rate_limits_window").on("_emdash_rate_limits").column("window").execute();
	await db.schema.alterTable("_emdash_device_codes").addColumn("last_polled_at", "text").execute();
}
async function down$5(db) {
	await db.schema.dropTable("_emdash_rate_limits").execute();
	await db.schema.alterTable("_emdash_device_codes").dropColumn("last_polled_at").execute();
}

//#endregion
//#region src/database/migrations/033_optimize_content_indexes.ts
var _033_optimize_content_indexes_exports = /* @__PURE__ */ __exportAll({
	down: () => down$4,
	up: () => up$4
});
/**
* Migration: Optimize content table indexes for D1 performance
*
* Addresses GitHub issue #131: Full table scans causing massive D1 row reads.
*
* Changes:
* 1. Replaces single-column indexes with composite indexes on ec_* tables
* 2. Adds partial indexes for _emdash_comments status counting
*
* Impact: Reduces D1 row reads by 90%+ for admin panel operations.
*/
async function up$4(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_status`)}`.execute(db);
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_created`)}`.execute(db);
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_deleted`)}`.execute(db);
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_updated`)}`.execute(db);
		await sql`
			CREATE INDEX IF NOT EXISTS ${sql.ref(`idx_${table.name}_deleted_updated_id`)}
			ON ${sql.ref(table.name)} (deleted_at, updated_at DESC, id DESC)
		`.execute(db);
		await sql`
			CREATE INDEX IF NOT EXISTS ${sql.ref(`idx_${table.name}_deleted_status`)}
			ON ${sql.ref(table.name)} (deleted_at, status)
		`.execute(db);
		await sql`
			CREATE INDEX IF NOT EXISTS ${sql.ref(`idx_${table.name}_deleted_created_id`)}
			ON ${sql.ref(table.name)} (deleted_at, created_at DESC, id DESC)
		`.execute(db);
	}
	await sql`
		CREATE INDEX IF NOT EXISTS idx_comments_pending
		ON _emdash_comments (id)
		WHERE status = 'pending'
	`.execute(db);
	await sql`
		CREATE INDEX IF NOT EXISTS idx_comments_approved
		ON _emdash_comments (id)
		WHERE status = 'approved'
	`.execute(db);
	await sql`
		CREATE INDEX IF NOT EXISTS idx_comments_spam
		ON _emdash_comments (id)
		WHERE status = 'spam'
	`.execute(db);
	await sql`
		CREATE INDEX IF NOT EXISTS idx_comments_trash
		ON _emdash_comments (id)
		WHERE status = 'trash'
	`.execute(db);
}
async function down$4(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_deleted_updated_id`)}`.execute(db);
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_deleted_status`)}`.execute(db);
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_deleted_created_id`)}`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${table.name}_status`)}
			ON ${sql.ref(table.name)} (status)
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${table.name}_created`)}
			ON ${sql.ref(table.name)} (created_at)
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${table.name}_deleted`)}
			ON ${sql.ref(table.name)} (deleted_at)
		`.execute(db);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${table.name}_updated`)}
			ON ${sql.ref(table.name)} (updated_at)
		`.execute(db);
	}
	await sql`DROP INDEX IF EXISTS idx_comments_pending`.execute(db);
	await sql`DROP INDEX IF EXISTS idx_comments_approved`.execute(db);
	await sql`DROP INDEX IF EXISTS idx_comments_spam`.execute(db);
	await sql`DROP INDEX IF EXISTS idx_comments_trash`.execute(db);
}

//#endregion
//#region src/database/migrations/034_published_at_index.ts
var _034_published_at_index_exports = /* @__PURE__ */ __exportAll({
	down: () => down$3,
	up: () => up$3
});
async function up$3(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`
			CREATE INDEX IF NOT EXISTS ${sql.ref(`idx_${table.name}_deleted_published_id`)}
			ON ${sql.ref(table.name)} (deleted_at, published_at DESC, id DESC)
		`.execute(db);
	}
}
async function down$3(db) {
	const tableNames = await listTablesLike(db, "ec_%");
	for (const tableName of tableNames) {
		const table = { name: tableName };
		await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_deleted_published_id`)}`.execute(db);
	}
}

//#endregion
//#region src/database/migrations/035_bounded_404_log.ts
var _035_bounded_404_log_exports = /* @__PURE__ */ __exportAll({
	down: () => down$2,
	up: () => up$2
});
/**
* Migration: Bounded 404 logging
*
* Hardens `_emdash_404_log` against unauthenticated DoS. Previously every 404
* inserted a new row, so an attacker could grow the table without bound.
*
* Changes:
*   - Adds `hits` (default 1, NOT NULL)
*   - Adds `last_seen_at` (nullable; SQLite can't add NOT NULL with a
*     non-constant default to a populated table, so the column is nullable
*     at the schema level and backfilled from `created_at` for existing rows;
*     new inserts via `log404` always set it)
*   - Deduplicates existing rows by path, keeping the most recent row per
*     path and summing hits
*   - Adds a UNIQUE index on `path` so upsert semantics work
*/
async function up$2(db) {
	const hitsExists = await columnExists(db, "_emdash_404_log", "hits");
	if (!hitsExists) await db.schema.alterTable("_emdash_404_log").addColumn("hits", "integer", (col) => col.notNull().defaultTo(1)).execute();
	if (!await columnExists(db, "_emdash_404_log", "last_seen_at")) await db.schema.alterTable("_emdash_404_log").addColumn("last_seen_at", "text").execute();
	await sql`
		UPDATE _emdash_404_log
		SET last_seen_at = created_at
		WHERE last_seen_at IS NULL
	`.execute(db);
	if (!hitsExists) {
		await sql`
			WITH ranked AS (
				SELECT
					id,
					path,
					ROW_NUMBER() OVER (
						PARTITION BY path
						ORDER BY created_at DESC, id DESC
					) AS rn,
					COUNT(*) OVER (PARTITION BY path) AS path_count,
					MAX(created_at) OVER (PARTITION BY path) AS latest_created_at
				FROM _emdash_404_log
			)
			UPDATE _emdash_404_log
			SET
				hits = (SELECT path_count FROM ranked WHERE ranked.id = _emdash_404_log.id),
				last_seen_at = (SELECT latest_created_at FROM ranked WHERE ranked.id = _emdash_404_log.id)
			WHERE id IN (SELECT id FROM ranked WHERE rn = 1)
		`.execute(db);
		await sql`
			DELETE FROM _emdash_404_log
			WHERE id IN (
				SELECT id FROM (
					SELECT
						id,
						ROW_NUMBER() OVER (
							PARTITION BY path
							ORDER BY created_at DESC, id DESC
						) AS rn
					FROM _emdash_404_log
				) AS ranked
				WHERE rn > 1
			)
		`.execute(db);
	}
	await db.schema.createIndex("idx_404_log_path_unique").ifNotExists().on("_emdash_404_log").column("path").unique().execute();
	await db.schema.dropIndex("idx_404_log_path").ifExists().execute();
	await db.schema.createIndex("idx_404_log_last_seen").ifNotExists().on("_emdash_404_log").column("last_seen_at").execute();
}
async function down$2(db) {
	await db.schema.dropIndex("idx_404_log_last_seen").ifExists().execute();
	await db.schema.dropIndex("idx_404_log_path_unique").ifExists().execute();
	await db.schema.createIndex("idx_404_log_path").ifNotExists().on("_emdash_404_log").column("path").execute();
	await db.schema.alterTable("_emdash_404_log").dropColumn("last_seen_at").execute();
	await db.schema.alterTable("_emdash_404_log").dropColumn("hits").execute();
}

//#endregion
//#region src/database/migrations/036_i18n_menus_and_taxonomies.ts
var _036_i18n_menus_and_taxonomies_exports = /* @__PURE__ */ __exportAll({
	down: () => down$1,
	up: () => up$1
});
/**
* i18n for menus + taxonomies. Adds `locale` + `translation_group` to system
* tables and stores translation_groups (not row ids) in
* `_emdash_menu_items.reference_id` and `content_taxonomies.taxonomy_id`.
* Backfill locale and column DEFAULTs use the site's configured defaultLocale.
*/
function getDefaultLocale() {
	return getI18nConfig()?.defaultLocale ?? "en";
}
async function up$1(db) {
	const defaultLocale = getDefaultLocale();
	if (isSqlite(db)) {
		await sql.raw(`PRAGMA foreign_keys = OFF`).execute(db);
		try {
			await rebuildMenus(db, defaultLocale);
			await addItemColumns(db, defaultLocale);
			await rebuildTaxonomies(db, defaultLocale);
			await rebuildTaxonomyDefs(db, defaultLocale);
			await rebuildContentTaxonomies(db);
			await remapMenuItemRefs(db);
		} finally {
			await sql.raw(`PRAGMA foreign_keys = ON`).execute(db);
		}
		return;
	}
	await pgWiden(db, "_emdash_menus", ["name"], ["name", "locale"], defaultLocale);
	await pgWiden(db, "_emdash_menu_items", null, null, defaultLocale);
	await pgWiden(db, "taxonomies", ["name", "slug"], [
		"name",
		"slug",
		"locale"
	], defaultLocale);
	await pgWiden(db, "_emdash_taxonomy_defs", ["name"], ["name", "locale"], defaultLocale);
	await pgRemapContentTaxonomies(db);
	await remapMenuItemRefs(db);
}
async function rebuildMenus(db, defaultLocale) {
	if (await hasColumn(db, "_emdash_menus", "locale")) return;
	await sql.raw(`DROP TABLE IF EXISTS "_emdash_menus_new"`).execute(db);
	await db.schema.createTable("_emdash_menus_new").addColumn("id", "text", (c) => c.primaryKey()).addColumn("name", "text", (c) => c.notNull()).addColumn("label", "text", (c) => c.notNull()).addColumn("created_at", "text", (c) => c.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (c) => c.defaultTo(currentTimestamp(db))).addColumn("locale", "text", (c) => c.notNull().defaultTo(defaultLocale)).addColumn("translation_group", "text").addUniqueConstraint("_emdash_menus_name_locale_unique", ["name", "locale"]).execute();
	await sql`
		INSERT INTO _emdash_menus_new (id, name, label, created_at, updated_at, locale, translation_group)
		SELECT id, name, label, created_at, updated_at, ${defaultLocale}, id FROM _emdash_menus
	`.execute(db);
	await db.schema.dropTable("_emdash_menus").execute();
	await sql`ALTER TABLE _emdash_menus_new RENAME TO _emdash_menus`.execute(db);
	await db.schema.createIndex("idx__emdash_menus_locale").on("_emdash_menus").column("locale").execute();
	await db.schema.createIndex("idx__emdash_menus_translation_group").on("_emdash_menus").column("translation_group").execute();
}
async function addItemColumns(db, defaultLocale) {
	if (await hasColumn(db, "_emdash_menu_items", "locale")) return;
	await db.schema.alterTable("_emdash_menu_items").addColumn("locale", "text", (c) => c.notNull().defaultTo(defaultLocale)).execute();
	await db.schema.alterTable("_emdash_menu_items").addColumn("translation_group", "text").execute();
	await sql`UPDATE _emdash_menu_items SET translation_group = id`.execute(db);
	await db.schema.createIndex("idx__emdash_menu_items_locale").on("_emdash_menu_items").column("locale").execute();
	await db.schema.createIndex("idx__emdash_menu_items_translation_group").on("_emdash_menu_items").column("translation_group").execute();
}
async function rebuildTaxonomies(db, defaultLocale) {
	if (await hasColumn(db, "taxonomies", "locale")) return;
	await sql.raw(`DROP TABLE IF EXISTS "taxonomies_new"`).execute(db);
	await sql`DROP INDEX IF EXISTS idx_taxonomies_name`.execute(db);
	await db.schema.createTable("taxonomies_new").addColumn("id", "text", (c) => c.primaryKey()).addColumn("name", "text", (c) => c.notNull()).addColumn("slug", "text", (c) => c.notNull()).addColumn("label", "text", (c) => c.notNull()).addColumn("parent_id", "text").addColumn("data", "text").addColumn("locale", "text", (c) => c.notNull().defaultTo(defaultLocale)).addColumn("translation_group", "text").addUniqueConstraint("taxonomies_name_slug_locale_unique", [
		"name",
		"slug",
		"locale"
	]).addForeignKeyConstraint("taxonomies_parent_fk", ["parent_id"], "taxonomies", ["id"], (cb) => cb.onDelete("set null")).execute();
	await sql`
		INSERT INTO taxonomies_new (id, name, slug, label, parent_id, data, locale, translation_group)
		SELECT id, name, slug, label, parent_id, data, ${defaultLocale}, id FROM taxonomies
	`.execute(db);
	await db.schema.dropTable("taxonomies").execute();
	await sql`ALTER TABLE taxonomies_new RENAME TO taxonomies`.execute(db);
	await db.schema.createIndex("idx_taxonomies_name").on("taxonomies").column("name").execute();
	await db.schema.createIndex("idx_taxonomies_locale").on("taxonomies").column("locale").execute();
	await db.schema.createIndex("idx_taxonomies_translation_group").on("taxonomies").column("translation_group").execute();
}
async function rebuildTaxonomyDefs(db, defaultLocale) {
	if (await hasColumn(db, "_emdash_taxonomy_defs", "locale")) return;
	await sql.raw(`DROP TABLE IF EXISTS "_emdash_taxonomy_defs_new"`).execute(db);
	await db.schema.createTable("_emdash_taxonomy_defs_new").addColumn("id", "text", (c) => c.primaryKey()).addColumn("name", "text", (c) => c.notNull()).addColumn("label", "text", (c) => c.notNull()).addColumn("label_singular", "text").addColumn("hierarchical", "integer", (c) => c.defaultTo(0)).addColumn("collections", "text").addColumn("created_at", "text", (c) => c.defaultTo(currentTimestamp(db))).addColumn("locale", "text", (c) => c.notNull().defaultTo(defaultLocale)).addColumn("translation_group", "text").addUniqueConstraint("_emdash_taxonomy_defs_name_locale_unique", ["name", "locale"]).execute();
	await sql`
		INSERT INTO _emdash_taxonomy_defs_new
			(id, name, label, label_singular, hierarchical, collections, created_at, locale, translation_group)
		SELECT id, name, label, label_singular, hierarchical, collections, created_at, ${defaultLocale}, id
		FROM _emdash_taxonomy_defs
	`.execute(db);
	await db.schema.dropTable("_emdash_taxonomy_defs").execute();
	await sql`ALTER TABLE _emdash_taxonomy_defs_new RENAME TO _emdash_taxonomy_defs`.execute(db);
	await db.schema.createIndex("idx__emdash_taxonomy_defs_locale").on("_emdash_taxonomy_defs").column("locale").execute();
	await db.schema.createIndex("idx__emdash_taxonomy_defs_translation_group").on("_emdash_taxonomy_defs").column("translation_group").execute();
}
async function rebuildContentTaxonomies(db) {
	if ((await sql`PRAGMA foreign_key_list(content_taxonomies)`.execute(db)).rows.length === 0) return;
	await sql.raw(`DROP TABLE IF EXISTS "content_taxonomies_new"`).execute(db);
	await db.schema.createTable("content_taxonomies_new").addColumn("collection", "text", (c) => c.notNull()).addColumn("entry_id", "text", (c) => c.notNull()).addColumn("taxonomy_id", "text", (c) => c.notNull()).addPrimaryKeyConstraint("content_taxonomies_pk", [
		"collection",
		"entry_id",
		"taxonomy_id"
	]).execute();
	await sql`
		INSERT OR IGNORE INTO content_taxonomies_new (collection, entry_id, taxonomy_id)
		SELECT ct.collection, ct.entry_id, COALESCE(
			(SELECT t.translation_group FROM taxonomies t WHERE t.id = ct.taxonomy_id),
			ct.taxonomy_id
		)
		FROM content_taxonomies ct
	`.execute(db);
	await db.schema.dropTable("content_taxonomies").execute();
	await sql`ALTER TABLE content_taxonomies_new RENAME TO content_taxonomies`.execute(db);
}
async function remapMenuItemRefs(db) {
	const collections = await sql`SELECT slug FROM _emdash_collections`.execute(db);
	for (const { slug } of collections.rows) {
		validateIdentifier(slug, "collection slug");
		const ec = sql.ref(`ec_${slug}`);
		await sql`
			UPDATE _emdash_menu_items SET reference_id = (
				SELECT translation_group FROM ${ec} WHERE ${ec}.id = _emdash_menu_items.reference_id
			)
			WHERE reference_collection = ${slug} AND reference_id IS NOT NULL
				AND EXISTS (SELECT 1 FROM ${ec} WHERE ${ec}.id = _emdash_menu_items.reference_id)
		`.execute(db);
	}
	await sql`
		UPDATE _emdash_menu_items SET reference_id = (
			SELECT translation_group FROM taxonomies WHERE taxonomies.id = _emdash_menu_items.reference_id
		)
		WHERE type = 'taxonomy' AND reference_id IS NOT NULL
			AND EXISTS (SELECT 1 FROM taxonomies WHERE taxonomies.id = _emdash_menu_items.reference_id)
	`.execute(db);
}
async function pgWiden(db, table, oldCols, newCols, defaultLocale) {
	validateSystemIdent(table);
	const ref = sql.ref(table);
	await sql`ALTER TABLE ${ref} ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT ${sql.lit(defaultLocale)}`.execute(db);
	await sql`ALTER TABLE ${ref} ADD COLUMN IF NOT EXISTS translation_group TEXT`.execute(db);
	await sql`UPDATE ${ref} SET translation_group = id WHERE translation_group IS NULL`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS ${sql.ref(`idx_${table}_locale`)} ON ${ref} (locale)`.execute(db);
	await sql`
		CREATE INDEX IF NOT EXISTS ${sql.ref(`idx_${table}_translation_group`)} ON ${ref} (translation_group)
	`.execute(db);
	if (!oldCols || !newCols) return;
	for (const c of [...oldCols, ...newCols]) validateSystemIdent(c);
	const cons = await sql`
		SELECT conname FROM pg_constraint c
		WHERE c.conrelid = ${table}::regclass AND c.contype = 'u'
			AND array_length(c.conkey, 1) = ${oldCols.length}
			AND (
				SELECT array_agg(a.attname ORDER BY pos.ord)
				FROM unnest(c.conkey) WITH ORDINALITY AS pos(attnum, ord)
				JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = pos.attnum
			)::text[] = ${oldCols}::text[]
	`.execute(db);
	for (const c of cons.rows) await sql`ALTER TABLE ${ref} DROP CONSTRAINT ${sql.ref(c.conname)}`.execute(db);
	const cols = sql.join(newCols.map((c) => sql.ref(c)), sql`, `);
	await sql`
		ALTER TABLE ${ref}
		ADD CONSTRAINT ${sql.ref(`${table}_${newCols.join("_")}_unique`)} UNIQUE (${cols})
	`.execute(db);
}
async function pgRemapContentTaxonomies(db) {
	const fks = await sql`
		SELECT conname FROM pg_constraint
		WHERE conrelid = 'content_taxonomies'::regclass AND contype = 'f'
	`.execute(db);
	for (const c of fks.rows) await sql`ALTER TABLE content_taxonomies DROP CONSTRAINT ${sql.ref(c.conname)}`.execute(db);
	await sql`
		UPDATE content_taxonomies SET taxonomy_id = t.translation_group
		FROM taxonomies t WHERE t.id = content_taxonomies.taxonomy_id
	`.execute(db);
}
async function hasColumn(db, table, column) {
	return (await sql`PRAGMA table_info(${sql.ref(table)})`.execute(db)).rows.some((r) => r.name === column);
}
const SYSTEM_IDENT = /^[_a-z][a-z0-9_]*$/;
function validateSystemIdent(name) {
	if (!SYSTEM_IDENT.test(name)) throw new Error(`Invalid identifier: "${name}"`);
}
/**
* down() is destructive on multi-locale installs (dropping `locale` collapses
* translated rows onto an ambiguous unique key). Refuse to run when any row
* sits at a locale other than the configured defaultLocale.
*/
async function assertSingleLocale(db, defaultLocale) {
	for (const table of [
		"_emdash_menus",
		"_emdash_menu_items",
		"taxonomies",
		"_emdash_taxonomy_defs"
	]) {
		validateSystemIdent(table);
		const result = await sql`
			SELECT COUNT(*) AS count FROM ${sql.ref(table)} WHERE locale != ${defaultLocale}
		`.execute(db);
		const count = Number(result.rows[0]?.count ?? 0);
		if (count > 0) throw new Error(`Cannot revert migration 036_i18n_menus_and_taxonomies: ${count} row(s) in "${table}" use a non-default locale (defaultLocale="${defaultLocale}"). Reverting would drop them silently. Export translations first (or delete them) and re-run the rollback. See packages/core/src/database/migrations/036_i18n_menus_and_taxonomies.ts.`);
	}
}
async function down$1(db) {
	const defaultLocale = getDefaultLocale();
	await assertSingleLocale(db, defaultLocale);
	const widenedTables = [
		"_emdash_menus",
		"_emdash_menu_items",
		"taxonomies",
		"_emdash_taxonomy_defs"
	];
	if (isSqlite(db)) {
		await sql.raw(`PRAGMA foreign_keys = OFF`).execute(db);
		try {
			for (const t of widenedTables) {
				await sql.raw(`DROP INDEX IF EXISTS idx_${t}_locale`).execute(db);
				await sql.raw(`DROP INDEX IF EXISTS idx_${t}_translation_group`).execute(db);
			}
			await rebuildContentTaxonomiesDown(db, defaultLocale);
			await rebuildMenusDown(db);
			await rebuildMenuItemsDown(db);
			await rebuildTaxonomiesDown(db);
			await rebuildTaxonomyDefsDown(db);
		} finally {
			await sql.raw(`PRAGMA foreign_keys = ON`).execute(db);
		}
		return;
	}
	for (const t of widenedTables) {
		await sql.raw(`DROP INDEX IF EXISTS idx_${t}_locale`).execute(db);
		await sql.raw(`DROP INDEX IF EXISTS idx_${t}_translation_group`).execute(db);
		await sql.raw(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS locale`).execute(db);
		await sql.raw(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS translation_group`).execute(db);
	}
}
async function rebuildContentTaxonomiesDown(db, defaultLocale) {
	await sql.raw(`DROP TABLE IF EXISTS "content_taxonomies_new"`).execute(db);
	await db.schema.createTable("content_taxonomies_new").addColumn("collection", "text", (c) => c.notNull()).addColumn("entry_id", "text", (c) => c.notNull()).addColumn("taxonomy_id", "text", (c) => c.notNull()).addPrimaryKeyConstraint("content_taxonomies_pk", [
		"collection",
		"entry_id",
		"taxonomy_id"
	]).addForeignKeyConstraint("content_taxonomies_taxonomy_fk", ["taxonomy_id"], "taxonomies", ["id"], (cb) => cb.onDelete("cascade")).execute();
	await sql`
		INSERT OR IGNORE INTO content_taxonomies_new (collection, entry_id, taxonomy_id)
		SELECT ct.collection, ct.entry_id, COALESCE(
			(SELECT t.id FROM taxonomies t WHERE t.translation_group = ct.taxonomy_id AND t.locale = ${defaultLocale}),
			ct.taxonomy_id
		)
		FROM content_taxonomies ct
	`.execute(db);
	await db.schema.dropTable("content_taxonomies").execute();
	await sql`ALTER TABLE content_taxonomies_new RENAME TO content_taxonomies`.execute(db);
}
async function rebuildMenusDown(db) {
	await sql.raw(`DROP TABLE IF EXISTS "_emdash_menus_old"`).execute(db);
	await db.schema.createTable("_emdash_menus_old").addColumn("id", "text", (c) => c.primaryKey()).addColumn("name", "text", (c) => c.notNull().unique()).addColumn("label", "text", (c) => c.notNull()).addColumn("created_at", "text", (c) => c.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (c) => c.defaultTo(currentTimestamp(db))).execute();
	await sql`
		INSERT INTO _emdash_menus_old (id, name, label, created_at, updated_at)
		SELECT id, name, label, created_at, updated_at FROM _emdash_menus
	`.execute(db);
	await db.schema.dropTable("_emdash_menus").execute();
	await sql`ALTER TABLE _emdash_menus_old RENAME TO _emdash_menus`.execute(db);
}
async function rebuildMenuItemsDown(db) {
	await sql.raw(`ALTER TABLE _emdash_menu_items DROP COLUMN locale`).execute(db);
	await sql.raw(`ALTER TABLE _emdash_menu_items DROP COLUMN translation_group`).execute(db);
}
async function rebuildTaxonomiesDown(db) {
	await sql.raw(`DROP TABLE IF EXISTS "taxonomies_old"`).execute(db);
	await db.schema.createTable("taxonomies_old").addColumn("id", "text", (c) => c.primaryKey()).addColumn("name", "text", (c) => c.notNull()).addColumn("slug", "text", (c) => c.notNull()).addColumn("label", "text", (c) => c.notNull()).addColumn("parent_id", "text").addColumn("data", "text").addUniqueConstraint("taxonomies_name_slug_unique", ["name", "slug"]).addForeignKeyConstraint("taxonomies_parent_fk", ["parent_id"], "taxonomies_old", ["id"], (cb) => cb.onDelete("set null")).execute();
	await sql`
		INSERT INTO taxonomies_old (id, name, slug, label, parent_id, data)
		SELECT id, name, slug, label, parent_id, data FROM taxonomies
	`.execute(db);
	await db.schema.dropTable("taxonomies").execute();
	await sql`ALTER TABLE taxonomies_old RENAME TO taxonomies`.execute(db);
	await db.schema.createIndex("idx_taxonomies_name").on("taxonomies").column("name").execute();
}
async function rebuildTaxonomyDefsDown(db) {
	await sql.raw(`DROP TABLE IF EXISTS "_emdash_taxonomy_defs_old"`).execute(db);
	await db.schema.createTable("_emdash_taxonomy_defs_old").addColumn("id", "text", (c) => c.primaryKey()).addColumn("name", "text", (c) => c.notNull().unique()).addColumn("label", "text", (c) => c.notNull()).addColumn("label_singular", "text").addColumn("hierarchical", "integer", (c) => c.defaultTo(0)).addColumn("collections", "text").addColumn("created_at", "text", (c) => c.defaultTo(currentTimestamp(db))).execute();
	await sql`
		INSERT INTO _emdash_taxonomy_defs_old
			(id, name, label, label_singular, hierarchical, collections, created_at)
		SELECT id, name, label, label_singular, hierarchical, collections, created_at
		FROM _emdash_taxonomy_defs
	`.execute(db);
	await db.schema.dropTable("_emdash_taxonomy_defs").execute();
	await sql`ALTER TABLE _emdash_taxonomy_defs_old RENAME TO _emdash_taxonomy_defs`.execute(db);
}

//#endregion
//#region src/database/migrations/037_credential_algorithm.ts
var _037_credential_algorithm_exports = /* @__PURE__ */ __exportAll({
	down: () => down,
	up: () => up
});
async function up(db) {
	if (!await columnExists(db, "credentials", "algorithm")) await db.schema.alterTable("credentials").addColumn("algorithm", "integer", (col) => col.notNull().defaultTo(-7)).execute();
}
async function down(db) {
	if (await columnExists(db, "credentials", "algorithm")) await db.schema.alterTable("credentials").dropColumn("algorithm").execute();
}

//#endregion
//#region src/database/migrations/runner.ts
const MIGRATIONS = Object.freeze({
	"001_initial": _001_initial_exports,
	"002_media_status": _002_media_status_exports,
	"003_schema_registry": _003_schema_registry_exports,
	"004_plugins": _004_plugins_exports,
	"005_menus": _005_menus_exports,
	"006_taxonomy_defs": _006_taxonomy_defs_exports,
	"007_widgets": _007_widgets_exports,
	"008_auth": _008_auth_exports,
	"009_user_disabled": _009_user_disabled_exports,
	"011_sections": _011_sections_exports,
	"012_search": _012_search_exports,
	"013_scheduled_publishing": _013_scheduled_publishing_exports,
	"014_draft_revisions": _014_draft_revisions_exports,
	"015_indexes": _015_indexes_exports,
	"016_api_tokens": _016_api_tokens_exports,
	"017_authorization_codes": _017_authorization_codes_exports,
	"018_seo": _018_seo_exports,
	"019_i18n": _019_i18n_exports,
	"020_collection_url_pattern": _020_collection_url_pattern_exports,
	"021_remove_section_categories": _021_remove_section_categories_exports,
	"022_marketplace_plugin_state": _022_marketplace_plugin_state_exports,
	"023_plugin_metadata": _023_plugin_metadata_exports,
	"024_media_placeholders": _024_media_placeholders_exports,
	"025_oauth_clients": _025_oauth_clients_exports,
	"026_cron_tasks": _026_cron_tasks_exports,
	"027_comments": _027_comments_exports,
	"028_drop_author_url": _028_drop_author_url_exports,
	"029_redirects": _029_redirects_exports,
	"030_widen_scheduled_index": _030_widen_scheduled_index_exports,
	"031_bylines": _031_bylines_exports,
	"032_rate_limits": _032_rate_limits_exports,
	"033_optimize_content_indexes": _033_optimize_content_indexes_exports,
	"034_published_at_index": _034_published_at_index_exports,
	"035_bounded_404_log": _035_bounded_404_log_exports,
	"036_i18n_menus_and_taxonomies": _036_i18n_menus_and_taxonomies_exports,
	"037_credential_algorithm": _037_credential_algorithm_exports
});
/** Total number of registered migrations. Exported for use in tests. */
const MIGRATION_COUNT = Object.keys(MIGRATIONS).length;
/**
* Migration provider that uses statically imported migrations.
* This approach works well with bundlers and avoids filesystem access.
*/
var StaticMigrationProvider = class {
	async getMigrations() {
		return MIGRATIONS;
	}
};
/** Custom migration table name */
const MIGRATION_TABLE = "_emdash_migrations";
const MIGRATION_LOCK_TABLE = "_emdash_migrations_lock";
/** Pattern for escaping special regex characters. Matches the shared helper in `database/repositories/content.ts`. */
const REGEX_ESCAPE_PATTERN$1 = /[.*+?^${}()|[\]\\]/g;
/** Escape special regex characters so a string can be embedded literally in `new RegExp()`. */
function escapeRegExp$1(value) {
	return value.replace(REGEX_ESCAPE_PATTERN$1, "\\$&");
}
/**
* Pattern used to detect the concurrent-migration race. The Kysely
* `SqliteAdapter.acquireMigrationLock` is a no-op (inherited by `kysely-d1`
* and our `EmDashD1Dialect`), so two isolates running migrations against the
* same database can both attempt `INSERT INTO _emdash_migrations` for the
* same migration name. The losing insert fails with a UNIQUE constraint
* error, which is benign: the other isolate is applying the same schema.
*
* We match on the table name (not the full error text) because different
* SQLite drivers phrase the message differently
* (`UNIQUE constraint failed: _emdash_migrations.name` for better-sqlite3,
* `D1_ERROR: UNIQUE constraint failed: _emdash_migrations.name: SQLITE_CONSTRAINT`
* for D1, etc.). The pattern is built from `MIGRATION_TABLE` so a rename
* cannot silently disable race detection.
*/
const MIGRATION_RACE_PATTERN = new RegExp(`UNIQUE constraint failed: ${escapeRegExp$1(MIGRATION_TABLE)}\\.name`, "i");
/** How long to wait for a concurrent migrator to finish before giving up. */
const MIGRATION_RACE_WAIT_MS = 1e4;
/** Polling interval while waiting for a concurrent migrator. */
const MIGRATION_RACE_POLL_MS = 100;
/**
* Pattern used to detect "table does not exist" errors across the dialects
* EmDash supports. The phrasing differs by driver:
*
*   - better-sqlite3: `no such table: _emdash_migrations`
*   - D1:             `D1_ERROR: no such table: _emdash_migrations: SQLITE_ERROR`
*   - PostgreSQL:     `relation "_emdash_migrations" does not exist`
*                     (also occasionally `table "_emdash_migrations" does not exist`)
*
* We deliberately match on the migration table name (rather than using the
* generic `isMissingTableError` helper) so an unexpected missing-table error
* naming a different table — implausible today since
* `getAppliedMigrationCount` only references `MIGRATION_TABLE`, but cheap
* insurance against future edits — is not silently swallowed. The pattern is
* built from `MIGRATION_TABLE` so a rename cannot drift.
*/
const MIGRATION_TABLE_MISSING_PATTERN = new RegExp(`(?:no such table:\\s*${escapeRegExp$1(MIGRATION_TABLE)}\\b|(?:relation|table)\\s+"?${escapeRegExp$1(MIGRATION_TABLE)}"?\\s+does(?:n't| not) exist\\b)`, "i");
/**
* Read the count of applied migrations.
*
* Returns `null` only when the migration table does not exist yet (which is
* the normal state on a fresh database before the first migration runs).
* Any other error is rethrown so callers — particularly
* `waitForConcurrentMigrator` — don't silently mask connection failures,
* permission errors, or other unexpected driver problems behind a 10s wait
* and a bogus "we're done" verdict.
*/
async function getAppliedMigrationCount(db) {
	try {
		const result = await sql`
			SELECT COUNT(*) as count FROM ${sql.ref(MIGRATION_TABLE)}
		`.execute(db);
		return Number(result.rows[0]?.count ?? 0);
	} catch (error) {
		if (MIGRATION_TABLE_MISSING_PATTERN.test(deepErrorMessage(error))) return null;
		throw error;
	}
}
/**
* Wait for a concurrent migrator to finish applying all migrations.
*
* Resolves to `true` once the migration table contains at least
* `MIGRATION_COUNT` rows (i.e. every migration this build knows about has
* been recorded), `false` if the deadline elapses first. We use `>=` rather
* than `===` so that an old isolate observing a database that has already
* been migrated by a newer build still treats the wait as settled instead
* of timing out.
*/
async function waitForConcurrentMigrator(db) {
	const deadline = Date.now() + MIGRATION_RACE_WAIT_MS;
	while (Date.now() < deadline) {
		const count = await getAppliedMigrationCount(db);
		if (count !== null && count >= MIGRATION_COUNT) return true;
		await new Promise((resolve) => setTimeout(resolve, MIGRATION_RACE_POLL_MS));
	}
	const finalCount = await getAppliedMigrationCount(db);
	return finalCount !== null && finalCount >= MIGRATION_COUNT;
}
/** Extract the deepest error message available from a thrown value. */
function deepErrorMessage(error) {
	if (error instanceof Error) {
		const own = error.message ?? "";
		if (error.cause) {
			const causeMsg = deepErrorMessage(error.cause);
			return own ? `${own}: ${causeMsg}` : causeMsg;
		}
		return own;
	}
	if (typeof error === "string") return error;
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}
/**
* Run all pending migrations.
*
* Includes a fast-path: if the migration table already exists and contains
* at least MIGRATION_COUNT rows, all migrations this build knows about have
* been applied and we can skip the Kysely Migrator entirely. This avoids
* the expensive `pragma_table_info` introspection that Kysely runs for
* every table in the database (twice!) just to check if the migration
* tables exist. On D1 with ~57 tables, that's ~116 queries saved per init.
*
* Concurrent-migration safety: the Kysely Migrator's `acquireMigrationLock`
* is a no-op for SQLite (and therefore D1), so two callers running this
* concurrently against the same database will both try to apply pending
* migrations. SQLite serializes the writes, but the loser still surfaces a
* `UNIQUE constraint failed: _emdash_migrations.name` error. We treat that
* specific error as benign: another caller is already applying the same
* schema. We wait for the concurrent migrator to finish, then return
* success. This matches the user-observable expectation that running
* migrations twice in a row is a no-op.
*/
async function runMigrations(db) {
	const initialCount = await getAppliedMigrationCount(db);
	if (initialCount !== null && initialCount >= MIGRATION_COUNT) return { applied: [] };
	const { error, results } = await new Migrator({
		db,
		provider: new StaticMigrationProvider(),
		migrationTableName: MIGRATION_TABLE,
		migrationLockTableName: MIGRATION_LOCK_TABLE
	}).migrateToLatest();
	const applied = results?.filter((r) => r.status === "Success").map((r) => r.migrationName) ?? [];
	if (error) {
		const msg = deepErrorMessage(error);
		const failedMigration = results?.find((r) => r.status === "Error");
		if (MIGRATION_RACE_PATTERN.test(msg)) {
			if (await waitForConcurrentMigrator(db)) return { applied };
		}
		const failedSuffix = failedMigration ? ` (migration: ${failedMigration.migrationName})` : "";
		throw new Error(`Migration failed: ${msg || "unknown error"}${failedSuffix}`);
	}
	return { applied };
}

//#region src/request-context.ts
/**
* EmDash Request Context
*
* Uses AsyncLocalStorage to provide request-scoped state to query functions
* without requiring explicit parameter passing. The middleware wraps next()
* in als.run(), making the context available to all code during rendering.
*
* Middleware always wraps each request in a context so per-request
* metrics (db.*, cache.*) can be surfaced via Server-Timing. The cost is
* one ALS frame per request — sub-microsecond, negligible compared to
* any real work.
*
* The AsyncLocalStorage instance is stored on globalThis with a Symbol key
* to guarantee a singleton even when bundlers duplicate this module across
* code-split chunks. Without this, Rollup/Vite may inline the module into
* multiple chunks (e.g. middleware and page components), each with its own
* ALS instance — breaking request-scoped state propagation.
*/
function createRequestMetrics(start) {
	return {
		start,
		dbCount: 0,
		dbTotalMs: 0,
		dbFirstOffset: null,
		dbLastOffset: null,
		cacheHits: 0,
		cacheMisses: 0
	};
}
const ALS_KEY = Symbol.for("emdash:request-context");
const storage = globalThis[ALS_KEY] ?? (() => {
	const als = new AsyncLocalStorage();
	globalThis[ALS_KEY] = als;
	return als;
})();
/**
* Run a function within an EmDash request context.
* Called by middleware to wrap next().
*/
function runWithContext(ctx, fn) {
	return storage.run(ctx, fn);
}
/**
* Get the current request context.
* Returns undefined if no context is set (logged-out fast path).
*/
function getRequestContext() {
	return storage.getStore();
}

//#region src/utils/base64.ts
/**
* Base64 encoding/decoding utilities.
*
* Uses native Uint8Array.prototype.toBase64 / Uint8Array.fromBase64 when
* available (workerd, Node 26+, modern browsers), falls back to btoa/atob.
*
* All base64url encoding uses the { alphabet: "base64url" } option natively
* or manual character replacement as fallback.
*
* Delete the fallback paths when the minimum Node version supports these
* methods natively.
*/
const hasNative = typeof Uint8Array.prototype.toBase64 === "function" && typeof Uint8Array.fromBase64 === "function";
const BASE64_PLUS_PATTERN = /\+/g;
const BASE64_SLASH_PATTERN = /\//g;
const BASE64_PADDING_PATTERN = /=+$/;
const BASE64URL_DASH_PATTERN = /-/g;
const BASE64URL_UNDERSCORE_PATTERN = /_/g;
/** Encode a UTF-8 string as standard base64. */
function encodeBase64(str) {
	const bytes = new TextEncoder().encode(str);
	if (hasNative) return bytes.toBase64();
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary);
}
/** Decode a standard base64 string to a UTF-8 string. */
function decodeBase64(base64) {
	if (hasNative) return new TextDecoder().decode(Uint8Array.fromBase64(base64));
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder().decode(bytes);
}
/** Encode bytes as base64url without padding. */
function encodeBase64url(bytes) {
	if (hasNative) return bytes.toBase64({
		alphabet: "base64url",
		omitPadding: true
	});
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(BASE64_PLUS_PATTERN, "-").replace(BASE64_SLASH_PATTERN, "_").replace(BASE64_PADDING_PATTERN, "");
}
/** Decode a base64url string (with or without padding) to bytes. */
function decodeBase64url(encoded) {
	if (hasNative) return Uint8Array.fromBase64(encoded, { alphabet: "base64url" });
	const base64 = encoded.replace(BASE64URL_DASH_PATTERN, "+").replace(BASE64URL_UNDERSCORE_PATTERN, "/");
	const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

//#region src/database/repositories/types.ts
/**
* Hard cap on cursor length. Cursors we issue are short JSON-in-base64
* blobs; a real cursor is well under 200 chars. This guards against
* malicious callers passing megabyte-sized strings to force the base64
* decoder to allocate (decodeBase64 is O(N) in input size). The MCP and
* REST schemas also clamp at 2048 — this 4096 cap is a defense-in-depth
* floor inside the repository helpers.
*/
const MAX_CURSOR_LENGTH = 4096;
/** Encode a cursor from order value + id */
function encodeCursor(orderValue, id) {
	return encodeBase64(JSON.stringify({
		orderValue,
		id
	}));
}
/**
* Thrown when a pagination cursor cannot be decoded.
*
* Repository callers should let this propagate; handler catch blocks
* map it to a structured `INVALID_CURSOR` error so client pagination
* bugs surface immediately rather than silently re-fetching the first
* page.
*/
var InvalidCursorError = class extends Error {
	constructor(cursor) {
		const display = cursor.length > 50 ? `${cursor.slice(0, 47)}...` : cursor;
		super(`Invalid pagination cursor: ${display}`);
		this.name = "InvalidCursorError";
	}
};
/**
* Decode a cursor to order value + id.
*
* Throws `InvalidCursorError` if the cursor is empty, not valid base64,
* not valid JSON, or doesn't contain string `orderValue` and `id` fields.
*/
function decodeCursor(cursor) {
	if (!cursor) throw new InvalidCursorError(cursor);
	if (cursor.length > MAX_CURSOR_LENGTH) throw new InvalidCursorError(cursor);
	let parsed;
	try {
		parsed = JSON.parse(decodeBase64(cursor));
	} catch {
		throw new InvalidCursorError(cursor);
	}
	if (parsed === null || typeof parsed !== "object") throw new InvalidCursorError(cursor);
	const candidate = parsed;
	if (typeof candidate.orderValue !== "string" || typeof candidate.id !== "string") throw new InvalidCursorError(cursor);
	return {
		orderValue: candidate.orderValue,
		id: candidate.id
	};
}
var EmDashValidationError = class extends Error {
	constructor(message, details) {
		super(message);
		this.details = details;
		this.name = "EmDashValidationError";
	}
};

//#region src/utils/slugify.ts
const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const WHITESPACE_UNDERSCORE_PATTERN = /[\s_]+/g;
const NON_ALPHANUMERIC_HYPHEN_PATTERN = /[^a-z0-9-]/g;
const MULTIPLE_HYPHENS_PATTERN$1 = /-+/g;
const LEADING_TRAILING_HYPHEN_PATTERN = /^-|-$/g;
const TRAILING_HYPHEN_PATTERN = /-$/;
/**
* Convert a string to a URL-friendly slug.
*
* Handles unicode by normalizing to NFD and stripping diacritics,
* so "café" becomes "cafe", "naïve" becomes "naive", etc.
*/
/**
* Decode a URI-encoded slug parameter.
*
* Browsers percent-encode non-ASCII characters in URLs, so a slug like
* "మేష-రాసి" arrives as "%e0%b0%ae%e0%b1%87%e0%b0%b7-%e0%b0%b0%e0%b0%be%e0%b0%b8%e0%b0%bf".
* Call this on `Astro.params.slug` before using it in database lookups.
*/
function decodeSlug(raw) {
	return raw ? decodeURIComponent(raw) : void 0;
}
function slugify(text, maxLength = 80) {
	return text.toLowerCase().normalize("NFD").replace(DIACRITICS_PATTERN, "").replace(WHITESPACE_UNDERSCORE_PATTERN, "-").replace(NON_ALPHANUMERIC_HYPHEN_PATTERN, "").replace(MULTIPLE_HYPHENS_PATTERN$1, "-").replace(LEADING_TRAILING_HYPHEN_PATTERN, "").slice(0, maxLength).replace(TRAILING_HYPHEN_PATTERN, "");
}

//#endregion
//#region src/database/repositories/revision.ts
const monotonic = monotonicFactory();
/**
* Revision repository for version history
*
* Each revision stores a JSON snapshot of the content at a point in time.
* Used when collection has `supports: ["revisions"]` enabled.
*/
var RevisionRepository = class {
	constructor(db) {
		this.db = db;
	}
	/**
	* Create a new revision
	*/
	async create(input) {
		const id = monotonic();
		const row = {
			id,
			collection: input.collection,
			entry_id: input.entryId,
			data: JSON.stringify(input.data),
			author_id: input.authorId ?? null
		};
		await this.db.insertInto("revisions").values(row).execute();
		const revision = await this.findById(id);
		if (!revision) throw new Error("Failed to create revision");
		return revision;
	}
	/**
	* Find revision by ID
	*/
	async findById(id) {
		const row = await this.db.selectFrom("revisions").selectAll().where("id", "=", id).executeTakeFirst();
		return row ? this.rowToRevision(row) : null;
	}
	/**
	* Get all revisions for an entry (newest first)
	*
	* Orders by monotonic ULID (descending). The monotonic factory
	* guarantees strictly increasing IDs even within the same millisecond.
	*/
	async findByEntry(collection, entryId, options = {}) {
		let query = this.db.selectFrom("revisions").selectAll().where("collection", "=", collection).where("entry_id", "=", entryId).orderBy("id", "desc");
		if (options.limit) query = query.limit(options.limit);
		return (await query.execute()).map((row) => this.rowToRevision(row));
	}
	/**
	* Get the most recent revision for an entry
	*/
	async findLatest(collection, entryId) {
		const row = await this.db.selectFrom("revisions").selectAll().where("collection", "=", collection).where("entry_id", "=", entryId).orderBy("id", "desc").limit(1).executeTakeFirst();
		return row ? this.rowToRevision(row) : null;
	}
	/**
	* Count revisions for an entry
	*/
	async countByEntry(collection, entryId) {
		const result = await this.db.selectFrom("revisions").select((eb) => eb.fn.count("id").as("count")).where("collection", "=", collection).where("entry_id", "=", entryId).executeTakeFirst();
		return Number(result?.count || 0);
	}
	/**
	* Delete all revisions for an entry (use when entry is deleted)
	*/
	async deleteByEntry(collection, entryId) {
		const result = await this.db.deleteFrom("revisions").where("collection", "=", collection).where("entry_id", "=", entryId).executeTakeFirst();
		return Number(result.numDeletedRows ?? 0);
	}
	/**
	* Delete old revisions, keeping the most recent N
	*/
	async pruneOldRevisions(collection, entryId, keepCount) {
		const keepIds = (await this.db.selectFrom("revisions").select("id").where("collection", "=", collection).where("entry_id", "=", entryId).orderBy("created_at", "desc").orderBy("id", "desc").limit(keepCount).execute()).map((r) => r.id);
		if (keepIds.length === 0) return 0;
		const result = await this.db.deleteFrom("revisions").where("collection", "=", collection).where("entry_id", "=", entryId).where("id", "not in", keepIds).executeTakeFirst();
		return Number(result.numDeletedRows ?? 0);
	}
	/**
	* Update revision data in place
	* Used for autosave to avoid creating many small revisions.
	*/
	async updateData(id, data) {
		await this.db.updateTable("revisions").set({ data: JSON.stringify(data) }).where("id", "=", id).execute();
	}
	/**
	* Convert database row to Revision object
	*/
	rowToRevision(row) {
		return {
			id: row.id,
			collection: row.collection,
			entryId: row.entry_id,
			data: JSON.parse(row.data),
			authorId: row.author_id,
			createdAt: row.created_at
		};
	}
};

//#endregion
//#region src/database/repositories/content.ts
var content_exports = /* @__PURE__ */ __exportAll({ ContentRepository: () => ContentRepository });
const ULID_PATTERN = /^[0-9A-Z]{26}$/;
/**
* System columns that exist in every ec_* table
*/
const SYSTEM_COLUMNS = new Set([
	"id",
	"slug",
	"status",
	"author_id",
	"primary_byline_id",
	"created_at",
	"updated_at",
	"published_at",
	"scheduled_at",
	"deleted_at",
	"version",
	"live_revision_id",
	"draft_revision_id",
	"locale",
	"translation_group"
]);
/**
* Get the table name for a collection type
*/
function getTableName(type) {
	validateIdentifier(type, "collection type");
	return `ec_${type}`;
}
/**
* Serialize a value for database storage
* Objects/arrays are JSON-stringified
* Booleans are converted to 0/1 for SQLite
*/
function serializeValue(value) {
	if (value === null || value === void 0) return null;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "object") return JSON.stringify(value);
	return value;
}
/**
* Deserialize a value from database storage
* Attempts to parse JSON strings that look like objects/arrays
*/
function deserializeValue(value) {
	if (typeof value === "string") {
		if (value.startsWith("{") || value.startsWith("[")) try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}
	return value;
}
/** Pattern for escaping special regex characters */
const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;
/**
* Escape special regex characters in a string for use in `new RegExp()`
*/
function escapeRegExp(s) {
	return s.replace(REGEX_ESCAPE_PATTERN, "\\$&");
}
/**
* Repository for content CRUD operations
*
* Content is stored in per-collection tables (ec_posts, ec_pages, etc.)
* Each field becomes a real column in the table.
*/
var ContentRepository = class {
	constructor(db) {
		this.db = db;
	}
	/**
	* Create a new content item
	*/
	async create(input) {
		const id = ulid();
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const { type, slug, data, status = "draft", authorId, primaryBylineId, locale, translationOf, publishedAt, createdAt } = input;
		if (!type) throw new EmDashValidationError("Content type is required");
		const tableName = getTableName(type);
		let translationGroup = id;
		if (translationOf) {
			const source = await this.findById(type, translationOf);
			if (!source) throw new EmDashValidationError("Translation source content not found");
			translationGroup = source.translationGroup || source.id;
		}
		const columns = [
			"id",
			"slug",
			"status",
			"author_id",
			"primary_byline_id",
			"created_at",
			"updated_at",
			"published_at",
			"version",
			"locale",
			"translation_group"
		];
		const values = [
			id,
			slug || null,
			status,
			authorId || null,
			primaryBylineId ?? null,
			createdAt || now,
			now,
			publishedAt || null,
			1,
			locale || "en",
			translationGroup
		];
		if (data && typeof data === "object") {
			for (const [key, value] of Object.entries(data)) if (!SYSTEM_COLUMNS.has(key)) {
				validateIdentifier(key, "content field name");
				columns.push(key);
				values.push(serializeValue(value));
			}
		}
		const columnRefs = columns.map((c) => sql.ref(c));
		const valuePlaceholders = values.map((v) => v === null ? sql`NULL` : sql`${v}`);
		await sql`
			INSERT INTO ${sql.ref(tableName)} (${sql.join(columnRefs, sql`, `)})
			VALUES (${sql.join(valuePlaceholders, sql`, `)})
		`.execute(this.db);
		const item = await this.findById(type, id);
		if (!item) throw new Error("Failed to create content");
		return item;
	}
	/**
	* Generate a unique slug for a content item within a collection.
	*
	* Checks the collection table for existing slugs that match `baseSlug`
	* (optionally scoped to a locale) and appends a numeric suffix (`-1`,
	* `-2`, etc.) on collision to guarantee uniqueness.
	*
	* Returns `null` if `baseSlug` is empty after slugification.
	*/
	async generateUniqueSlug(type, text, locale) {
		const baseSlug = slugify(text);
		if (!baseSlug) return null;
		const tableName = getTableName(type);
		if ((locale ? await sql`
					SELECT slug FROM ${sql.ref(tableName)}
					WHERE slug = ${baseSlug}
					AND locale = ${locale}
					LIMIT 1
				`.execute(this.db) : await sql`
					SELECT slug FROM ${sql.ref(tableName)}
					WHERE slug = ${baseSlug}
					LIMIT 1
				`.execute(this.db)).rows.length === 0) return baseSlug;
		const pattern = `${baseSlug}-%`;
		const candidates = locale ? await sql`
					SELECT slug FROM ${sql.ref(tableName)}
					WHERE (slug = ${baseSlug} OR slug LIKE ${pattern})
					AND locale = ${locale}
				`.execute(this.db) : await sql`
					SELECT slug FROM ${sql.ref(tableName)}
					WHERE slug = ${baseSlug} OR slug LIKE ${pattern}
				`.execute(this.db);
		let maxSuffix = 0;
		const suffixPattern = new RegExp(`^${escapeRegExp(baseSlug)}-(\\d+)$`);
		for (const row of candidates.rows) {
			const match = suffixPattern.exec(row.slug);
			if (match) {
				const n = parseInt(match[1], 10);
				if (n > maxSuffix) maxSuffix = n;
			}
		}
		return `${baseSlug}-${maxSuffix + 1}`;
	}
	/**
	* Duplicate a content item
	* Creates a new draft copy with "(Copy)" appended to the title.
	* A slug is auto-generated from the new title by the handler layer.
	*/
	async duplicate(type, id, authorId) {
		const original = await this.findById(type, id);
		if (!original) throw new EmDashValidationError("Content item not found");
		const newData = { ...original.data };
		if (typeof newData.title === "string") newData.title = `${newData.title} (Copy)`;
		else if (typeof newData.name === "string") newData.name = `${newData.name} (Copy)`;
		const slugSource = typeof newData.title === "string" ? newData.title : typeof newData.name === "string" ? newData.name : null;
		const slug = slugSource ? await this.generateUniqueSlug(type, slugSource, original.locale ?? void 0) : null;
		return this.create({
			type,
			slug,
			data: newData,
			status: "draft",
			authorId: authorId || original.authorId || void 0
		});
	}
	/**
	* Find content by ID
	*/
	async findById(type, id) {
		const tableName = getTableName(type);
		const row = (await sql`
			SELECT * FROM ${sql.ref(tableName)}
			WHERE id = ${id}
			AND deleted_at IS NULL
		`.execute(this.db)).rows[0];
		if (!row) return null;
		return this.mapRow(type, row);
	}
	/**
	* Find content by id, including trashed (soft-deleted) items.
	* Used by restore endpoint for ownership checks.
	*/
	async findByIdIncludingTrashed(type, id) {
		const tableName = getTableName(type);
		const row = (await sql`
			SELECT * FROM ${sql.ref(tableName)}
			WHERE id = ${id}
		`.execute(this.db)).rows[0];
		if (!row) return null;
		return this.mapRow(type, row);
	}
	/**
	* Find content by ID or slug. Tries ID first if it looks like a ULID,
	* otherwise tries slug. Falls back to the other if the first lookup misses.
	*/
	async findByIdOrSlug(type, identifier, locale) {
		return this._findByIdOrSlug(type, identifier, false, locale);
	}
	/**
	* Find content by ID or slug, including trashed (soft-deleted) items.
	* Used by restore/permanent-delete endpoints.
	*/
	async findByIdOrSlugIncludingTrashed(type, identifier, locale) {
		return this._findByIdOrSlug(type, identifier, true, locale);
	}
	async _findByIdOrSlug(type, identifier, includeTrashed, locale) {
		const looksLikeUlid = ULID_PATTERN.test(identifier);
		const findById = includeTrashed ? (t, id) => this.findByIdIncludingTrashed(t, id) : (t, id) => this.findById(t, id);
		const findBySlug = includeTrashed ? (t, s) => this.findBySlugIncludingTrashed(t, s, locale) : (t, s) => this.findBySlug(t, s, locale);
		if (looksLikeUlid) {
			const byId = await findById(type, identifier);
			if (byId) return byId;
			return findBySlug(type, identifier);
		}
		const bySlug = await findBySlug(type, identifier);
		if (bySlug) return bySlug;
		return findById(type, identifier);
	}
	/**
	* Find content by slug
	*/
	async findBySlug(type, slug, locale) {
		const tableName = getTableName(type);
		const row = (locale ? await sql`
					SELECT * FROM ${sql.ref(tableName)}
					WHERE slug = ${slug}
					AND locale = ${locale}
					AND deleted_at IS NULL
				`.execute(this.db) : await sql`
					SELECT * FROM ${sql.ref(tableName)}
					WHERE slug = ${slug}
					AND deleted_at IS NULL
					ORDER BY locale ASC
					LIMIT 1
				`.execute(this.db)).rows[0];
		if (!row) return null;
		return this.mapRow(type, row);
	}
	/**
	* Find content by slug, including trashed (soft-deleted) items.
	* Used by restore/permanent-delete endpoints.
	*/
	async findBySlugIncludingTrashed(type, slug, locale) {
		const tableName = getTableName(type);
		const row = (locale ? await sql`
					SELECT * FROM ${sql.ref(tableName)}
					WHERE slug = ${slug}
					AND locale = ${locale}
				`.execute(this.db) : await sql`
					SELECT * FROM ${sql.ref(tableName)}
					WHERE slug = ${slug}
					ORDER BY locale ASC
					LIMIT 1
				`.execute(this.db)).rows[0];
		if (!row) return null;
		return this.mapRow(type, row);
	}
	/**
	* Find many content items with filtering and pagination
	*/
	async findMany(type, options = {}) {
		const tableName = getTableName(type);
		const limit = Math.min(options.limit || 50, 100);
		const orderField = options.orderBy?.field || "createdAt";
		const orderDirection = options.orderBy?.direction || "desc";
		const dbField = this.mapOrderField(orderField);
		const safeOrderDirection = orderDirection.toLowerCase() === "asc" ? "ASC" : "DESC";
		let query = this.db.selectFrom(tableName).selectAll().where("deleted_at", "is", null);
		if (options.where?.status) query = query.where("status", "=", options.where.status);
		if (options.where?.authorId) query = query.where("author_id", "=", options.where.authorId);
		if (options.where?.locale) query = query.where("locale", "=", options.where.locale);
		if (options.cursor) {
			const { orderValue, id: cursorId } = decodeCursor(options.cursor);
			if (safeOrderDirection === "DESC") query = query.where((eb) => eb.or([eb(dbField, "<", orderValue), eb.and([eb(dbField, "=", orderValue), eb("id", "<", cursorId)])]));
			else query = query.where((eb) => eb.or([eb(dbField, ">", orderValue), eb.and([eb(dbField, "=", orderValue), eb("id", ">", cursorId)])]));
		}
		query = query.orderBy(dbField, safeOrderDirection === "ASC" ? "asc" : "desc").orderBy("id", safeOrderDirection === "ASC" ? "asc" : "desc").limit(limit + 1);
		const rows = await query.execute();
		const hasMore = rows.length > limit;
		const items = rows.slice(0, limit);
		const mappedResult = { items: items.map((row) => this.mapRow(type, row)) };
		if (hasMore && items.length > 0) {
			const lastRow = items.at(-1);
			const lastOrderValue = lastRow[dbField];
			mappedResult.nextCursor = encodeCursor(typeof lastOrderValue === "string" || typeof lastOrderValue === "number" ? String(lastOrderValue) : "", String(lastRow.id));
		}
		return mappedResult;
	}
	/**
	* Update content
	*/
	async update(type, id, input) {
		const tableName = getTableName(type);
		const updates = {
			updated_at: (/* @__PURE__ */ new Date()).toISOString(),
			version: sql`version + 1`
		};
		if (input.status !== void 0) updates.status = input.status;
		if (input.slug !== void 0) updates.slug = input.slug;
		if (input.publishedAt !== void 0) updates.published_at = input.publishedAt;
		if (input.scheduledAt !== void 0) updates.scheduled_at = input.scheduledAt;
		if (input.authorId !== void 0) updates.author_id = input.authorId;
		if (input.primaryBylineId !== void 0) updates.primary_byline_id = input.primaryBylineId;
		if (input.data !== void 0 && typeof input.data === "object") {
			for (const [key, value] of Object.entries(input.data)) if (!SYSTEM_COLUMNS.has(key)) {
				validateIdentifier(key, "content field name");
				updates[key] = serializeValue(value);
			}
		}
		await this.db.updateTable(tableName).set(updates).where("id", "=", id).where("deleted_at", "is", null).execute();
		const updated = await this.findById(type, id);
		if (!updated) throw new Error("Content not found");
		return updated;
	}
	/**
	* Delete content (soft delete - moves to trash)
	*/
	async delete(type, id) {
		const tableName = getTableName(type);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		return ((await sql`
			UPDATE ${sql.ref(tableName)}
			SET deleted_at = ${now}
			WHERE id = ${id}
			AND deleted_at IS NULL
		`.execute(this.db)).numAffectedRows ?? 0n) > 0n;
	}
	/**
	* Restore content from trash
	*/
	async restore(type, id) {
		const tableName = getTableName(type);
		return ((await sql`
			UPDATE ${sql.ref(tableName)}
			SET deleted_at = NULL
			WHERE id = ${id}
			AND deleted_at IS NOT NULL
		`.execute(this.db)).numAffectedRows ?? 0n) > 0n;
	}
	/**
	* Permanently delete content (cannot be undone)
	*/
	/**
	* Permanently delete a soft-deleted content row.
	*
	* Returns `true` only when a soft-deleted (trashed) row was removed.
	* Returns `false` when no row exists OR when the row exists but is live —
	* the caller is responsible for distinguishing these cases (typically via
	* a follow-up `findByIdOrSlugIncludingTrashed` to surface NOT_FOUND vs
	* NOT_TRASHED). The `AND deleted_at IS NOT NULL` clause is the safety net
	* that prevents permanent delete from bypassing the trash workflow.
	*/
	async permanentDelete(type, id) {
		const tableName = getTableName(type);
		return ((await sql`
			DELETE FROM ${sql.ref(tableName)}
			WHERE id = ${id}
			AND deleted_at IS NOT NULL
		`.execute(this.db)).numAffectedRows ?? 0n) > 0n;
	}
	/**
	* Find trashed content items
	*/
	async findTrashed(type, options = {}) {
		const tableName = getTableName(type);
		const limit = Math.min(options.limit || 50, 100);
		const orderField = options.orderBy?.field || "deletedAt";
		const orderDirection = options.orderBy?.direction || "desc";
		const dbField = this.mapOrderField(orderField);
		const safeOrderDirection = orderDirection.toLowerCase() === "asc" ? "ASC" : "DESC";
		let query = this.db.selectFrom(tableName).selectAll().where("deleted_at", "is not", null);
		if (options.cursor) {
			const { orderValue, id: cursorId } = decodeCursor(options.cursor);
			if (safeOrderDirection === "DESC") query = query.where((eb) => eb.or([eb(dbField, "<", orderValue), eb.and([eb(dbField, "=", orderValue), eb("id", "<", cursorId)])]));
			else query = query.where((eb) => eb.or([eb(dbField, ">", orderValue), eb.and([eb(dbField, "=", orderValue), eb("id", ">", cursorId)])]));
		}
		query = query.orderBy(dbField, safeOrderDirection === "ASC" ? "asc" : "desc").orderBy("id", safeOrderDirection === "ASC" ? "asc" : "desc").limit(limit + 1);
		const rows = await query.execute();
		const hasMore = rows.length > limit;
		const items = rows.slice(0, limit);
		const mappedResult = { items: items.map((row) => {
			const record = row;
			return {
				...this.mapRow(type, record),
				deletedAt: typeof record.deleted_at === "string" ? record.deleted_at : ""
			};
		}) };
		if (hasMore && items.length > 0) {
			const lastRow = items.at(-1);
			const lastOrderValue = lastRow[dbField];
			mappedResult.nextCursor = encodeCursor(typeof lastOrderValue === "string" || typeof lastOrderValue === "number" ? String(lastOrderValue) : "", String(lastRow.id));
		}
		return mappedResult;
	}
	/**
	* Count trashed content items
	*/
	async countTrashed(type) {
		const tableName = getTableName(type);
		const result = await this.db.selectFrom(tableName).select((eb) => eb.fn.count("id").as("count")).where("deleted_at", "is not", null).executeTakeFirst();
		return Number(result?.count || 0);
	}
	/**
	* Count content items
	*/
	async count(type, where) {
		const tableName = getTableName(type);
		let query = this.db.selectFrom(tableName).select((eb) => eb.fn.count("id").as("count")).where("deleted_at", "is", null);
		if (where?.status) query = query.where("status", "=", where.status);
		if (where?.authorId) query = query.where("author_id", "=", where.authorId);
		if (where?.locale) query = query.where("locale", "=", where.locale);
		const result = await query.executeTakeFirst();
		return Number(result?.count || 0);
	}
	async getStats(type) {
		const tableName = getTableName(type);
		const result = await this.db.selectFrom(tableName).select((eb) => [
			eb.fn.count("id").as("total"),
			eb.fn.sum(eb.case().when("status", "=", "published").then(1).else(0).end()).as("published"),
			eb.fn.sum(eb.case().when("status", "=", "draft").then(1).else(0).end()).as("draft")
		]).where("deleted_at", "is", null).executeTakeFirst();
		return {
			total: Number(result?.total || 0),
			published: Number(result?.published || 0),
			draft: Number(result?.draft || 0)
		};
	}
	/**
	* Schedule content for future publishing
	*
	* Sets status to 'scheduled' and stores the scheduled publish time.
	* The content will be auto-published when the scheduled time is reached.
	*/
	async schedule(type, id, scheduledAt) {
		const tableName = getTableName(type);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const scheduledDate = new Date(scheduledAt);
		if (isNaN(scheduledDate.getTime())) throw new EmDashValidationError("Invalid scheduled date");
		if (scheduledDate <= /* @__PURE__ */ new Date()) throw new EmDashValidationError("Scheduled date must be in the future");
		const existing = await this.findById(type, id);
		if (!existing) throw new EmDashValidationError("Content item not found");
		const newStatus = existing.status === "published" ? "published" : "scheduled";
		await sql`
			UPDATE ${sql.ref(tableName)}
			SET status = ${newStatus},
				scheduled_at = ${scheduledAt},
				updated_at = ${now}
			WHERE id = ${id}
			AND deleted_at IS NULL
		`.execute(this.db);
		const updated = await this.findById(type, id);
		if (!updated) throw new Error("Content not found");
		return updated;
	}
	/**
	* Unschedule content
	*
	* Clears the scheduled time. Published posts stay published;
	* draft/scheduled posts revert to 'draft'.
	*/
	async unschedule(type, id) {
		const tableName = getTableName(type);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const existing = await this.findById(type, id);
		if (!existing) throw new EmDashValidationError("Content item not found");
		const newStatus = existing.status === "published" ? "published" : "draft";
		await sql`
			UPDATE ${sql.ref(tableName)}
			SET status = ${newStatus},
				scheduled_at = NULL,
				updated_at = ${now}
			WHERE id = ${id}
			AND scheduled_at IS NOT NULL
			AND deleted_at IS NULL
		`.execute(this.db);
		const updated = await this.findById(type, id);
		if (!updated) throw new Error("Content not found");
		return updated;
	}
	/**
	* Find content that is ready to be published
	*
	* Returns all content where scheduled_at <= now, regardless of status.
	* This covers both draft-scheduled posts (status='scheduled') and
	* published posts with scheduled draft changes (status='published').
	*/
	async findReadyToPublish(type) {
		const tableName = getTableName(type);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		return (await sql`
			SELECT * FROM ${sql.ref(tableName)}
			WHERE scheduled_at IS NOT NULL
			AND scheduled_at <= ${now}
			AND deleted_at IS NULL
			ORDER BY scheduled_at ASC
		`.execute(this.db)).rows.map((row) => this.mapRow(type, row));
	}
	/**
	* Find all translations in a translation group
	*/
	async findTranslations(type, translationGroup) {
		const tableName = getTableName(type);
		return (await sql`
			SELECT * FROM ${sql.ref(tableName)}
			WHERE translation_group = ${translationGroup}
			AND deleted_at IS NULL
			ORDER BY locale ASC
		`.execute(this.db)).rows.map((row) => this.mapRow(type, row));
	}
	/**
	* Publish the current draft
	*
	* Promotes draft_revision_id to live_revision_id and clears draft pointer.
	* Syncs the draft revision's data into the content table columns so the
	* content table always reflects the published version.
	* If no draft revision exists, creates one from current data and publishes it.
	*
	* `publishedAt` (optional) overrides the publication timestamp. If omitted,
	* the existing `published_at` is preserved (idempotent re-publish keeps the
	* original date) and falls back to the current time on first publish. Pass
	* an explicit value to backdate a publish (e.g. when migrating content from
	* another CMS).
	*/
	async publish(type, id, publishedAt) {
		const tableName = getTableName(type);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const existing = await this.findById(type, id);
		if (!existing) throw new EmDashValidationError("Content item not found");
		const revisionRepo = new RevisionRepository(this.db);
		let revisionToPublish = existing.draftRevisionId || existing.liveRevisionId;
		if (!revisionToPublish) revisionToPublish = (await revisionRepo.create({
			collection: type,
			entryId: id,
			data: existing.data
		})).id;
		const revision = await revisionRepo.findById(revisionToPublish);
		if (revision) {
			await this.syncDataColumns(type, id, revision.data);
			if (typeof revision.data._slug === "string") await sql`
					UPDATE ${sql.ref(tableName)}
					SET slug = ${revision.data._slug}
					WHERE id = ${id}
				`.execute(this.db);
		}
		if (publishedAt !== void 0) await sql`
				UPDATE ${sql.ref(tableName)}
				SET live_revision_id = ${revisionToPublish},
					draft_revision_id = NULL,
					status = 'published',
					scheduled_at = NULL,
					published_at = ${publishedAt},
					updated_at = ${now}
				WHERE id = ${id}
				AND deleted_at IS NULL
			`.execute(this.db);
		else await sql`
				UPDATE ${sql.ref(tableName)}
				SET live_revision_id = ${revisionToPublish},
					draft_revision_id = NULL,
					status = 'published',
					scheduled_at = NULL,
					published_at = COALESCE(published_at, ${now}),
					updated_at = ${now}
				WHERE id = ${id}
				AND deleted_at IS NULL
			`.execute(this.db);
		const updated = await this.findById(type, id);
		if (!updated) throw new Error("Content not found");
		return updated;
	}
	/**
	* Unpublish content
	*
	* Removes live pointer but preserves draft. If no draft exists,
	* creates one from the live version so the content isn't lost.
	*/
	async unpublish(type, id) {
		const tableName = getTableName(type);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const existing = await this.findById(type, id);
		if (!existing) throw new EmDashValidationError("Content item not found");
		if (!existing.draftRevisionId && existing.liveRevisionId) {
			const revisionRepo = new RevisionRepository(this.db);
			const liveRevision = await revisionRepo.findById(existing.liveRevisionId);
			if (liveRevision) {
				const draft = await revisionRepo.create({
					collection: type,
					entryId: id,
					data: liveRevision.data
				});
				await sql`
					UPDATE ${sql.ref(tableName)}
					SET draft_revision_id = ${draft.id}
					WHERE id = ${id}
				`.execute(this.db);
			}
		}
		await sql`
			UPDATE ${sql.ref(tableName)}
			SET live_revision_id = NULL,
				status = 'draft',
				published_at = NULL,
				updated_at = ${now}
			WHERE id = ${id}
			AND deleted_at IS NULL
		`.execute(this.db);
		const updated = await this.findById(type, id);
		if (!updated) throw new Error("Content not found");
		return updated;
	}
	/**
	* Set the draft revision pointer for a content item.
	*
	* Used by seed/import paths that stage a new revision's data before
	* promoting it to live via `publish()`.
	*
	* Validates that the content item exists and is not soft-deleted, that
	* the revision exists, and that the revision belongs to the same
	* collection and entry. Without these checks, a caller could leave the
	* content row pointing at a missing or unrelated revision.
	*/
	async setDraftRevision(type, id, revisionId) {
		const tableName = getTableName(type);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		if (!await this.findById(type, id)) throw new EmDashValidationError("Content item not found");
		const revision = await new RevisionRepository(this.db).findById(revisionId);
		if (!revision) throw new EmDashValidationError("Revision not found");
		if (revision.collection !== type || revision.entryId !== id) throw new EmDashValidationError("Revision does not belong to the specified content item");
		await sql`
			UPDATE ${sql.ref(tableName)}
			SET draft_revision_id = ${revisionId},
				updated_at = ${now}
			WHERE id = ${id}
			AND deleted_at IS NULL
		`.execute(this.db);
	}
	/**
	* Discard pending draft changes
	*
	* Clears draft_revision_id. The content table columns already hold the
	* published version, so no data sync is needed.
	*/
	async discardDraft(type, id) {
		const tableName = getTableName(type);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const existing = await this.findById(type, id);
		if (!existing) throw new EmDashValidationError("Content item not found");
		if (!existing.draftRevisionId) return existing;
		await sql`
			UPDATE ${sql.ref(tableName)}
			SET draft_revision_id = NULL,
				updated_at = ${now}
			WHERE id = ${id}
			AND deleted_at IS NULL
		`.execute(this.db);
		const updated = await this.findById(type, id);
		if (!updated) throw new Error("Content not found");
		return updated;
	}
	/**
	* Sync data columns in the content table from a data object.
	* Used to promote revision data into the content table on publish.
	* Keys starting with _ are revision metadata (e.g. _slug) and are skipped.
	*/
	async syncDataColumns(type, id, data) {
		const tableName = getTableName(type);
		const updates = {};
		for (const [key, value] of Object.entries(data)) {
			if (SYSTEM_COLUMNS.has(key)) continue;
			if (key.startsWith("_")) continue;
			validateIdentifier(key, "content field name");
			updates[key] = serializeValue(value);
		}
		if (Object.keys(updates).length === 0) return;
		await this.db.updateTable(tableName).set(updates).where("id", "=", id).execute();
	}
	/**
	* Count content items with a pending schedule.
	* Includes both draft-scheduled (status='scheduled') and published
	* posts with scheduled draft changes (status='published', scheduled_at set).
	*/
	async countScheduled(type) {
		const tableName = getTableName(type);
		const result = await sql`
			SELECT COUNT(id) as count FROM ${sql.ref(tableName)}
			WHERE scheduled_at IS NOT NULL
			AND deleted_at IS NULL
		`.execute(this.db);
		return Number(result.rows[0]?.count || 0);
	}
	/**
	* Map database row to ContentItem
	* Extracts system columns and puts content fields in data
	* Excludes null values from data to match input semantics
	*/
	mapRow(type, row) {
		const data = {};
		for (const [key, value] of Object.entries(row)) if (!SYSTEM_COLUMNS.has(key) && value !== null) data[key] = deserializeValue(value);
		return {
			id: row.id,
			type,
			slug: row.slug,
			status: row.status,
			data,
			authorId: row.author_id,
			primaryBylineId: row.primary_byline_id ?? null,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			publishedAt: row.published_at,
			scheduledAt: row.scheduled_at,
			liveRevisionId: row.live_revision_id ?? null,
			draftRevisionId: row.draft_revision_id ?? null,
			version: typeof row.version === "number" ? row.version : 1,
			locale: row.locale ?? null,
			translationGroup: row.translation_group ?? null
		};
	}
	/**
	* Map order field names to database columns.
	* Only allows known fields to prevent column enumeration via crafted orderBy values.
	*/
	mapOrderField(field) {
		const mapped = {
			createdAt: "created_at",
			updatedAt: "updated_at",
			publishedAt: "published_at",
			scheduledAt: "scheduled_at",
			deletedAt: "deleted_at",
			title: "title",
			name: "name",
			slug: "slug",
			status: "status",
			locale: "locale"
		}[field];
		if (!mapped) throw new EmDashValidationError(`Invalid order field: ${field}`);
		return mapped;
	}
};

const contentCERxPUN0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	a: slugify,
	i: decodeSlug,
	n: content_exports,
	r: RevisionRepository,
	t: ContentRepository
}, Symbol.toStringTag, { value: 'Module' }));

//#region src/database/repositories/options.ts
function escapeLike$1(value) {
	return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
/**
* Options repository for key-value settings storage
*
* Used for site settings, plugin configuration, and other arbitrary key-value data.
* Values are stored as JSON for flexibility.
*/
var OptionsRepository = class {
	constructor(db) {
		this.db = db;
	}
	/**
	* Get an option value
	*/
	async get(name) {
		const row = await this.db.selectFrom("options").select("value").where("name", "=", name).executeTakeFirst();
		if (!row) return null;
		return JSON.parse(row.value);
	}
	/**
	* Get an option value with a default
	*/
	async getOrDefault(name, defaultValue) {
		return await this.get(name) ?? defaultValue;
	}
	/**
	* Set an option value (creates or updates)
	*/
	async set(name, value) {
		const row = {
			name,
			value: JSON.stringify(value)
		};
		await this.db.insertInto("options").values(row).onConflict((oc) => oc.column("name").doUpdateSet({ value: row.value })).execute();
	}
	/**
	* Set an option value only if no row with that name exists. Atomic at the
	* database level via INSERT ... ON CONFLICT DO NOTHING, so concurrent
	* callers can't race past the check.
	*
	* Returns true when the row was inserted, false when a row already
	* existed (regardless of its value — even an empty string or null).
	*/
	async setIfAbsent(name, value) {
		const row = {
			name,
			value: JSON.stringify(value)
		};
		return ((await this.db.insertInto("options").values(row).onConflict((oc) => oc.column("name").doNothing()).executeTakeFirst()).numInsertedOrUpdatedRows ?? 0n) > 0n;
	}
	/**
	* Delete an option
	*/
	async delete(name) {
		return ((await this.db.deleteFrom("options").where("name", "=", name).executeTakeFirst()).numDeletedRows ?? 0) > 0;
	}
	/**
	* Check if an option exists
	*/
	async exists(name) {
		return !!await this.db.selectFrom("options").select("name").where("name", "=", name).executeTakeFirst();
	}
	/**
	* Get multiple options at once
	*/
	async getMany(names) {
		if (names.length === 0) return /* @__PURE__ */ new Map();
		const rows = await this.db.selectFrom("options").select(["name", "value"]).where("name", "in", names).execute();
		const result = /* @__PURE__ */ new Map();
		for (const row of rows) result.set(row.name, JSON.parse(row.value));
		return result;
	}
	/**
	* Set multiple options at once
	*/
	async setMany(options) {
		const entries = Object.entries(options);
		if (entries.length === 0) return;
		for (const [name, value] of entries) await this.set(name, value);
	}
	/**
	* Get all options (use sparingly)
	*/
	async getAll() {
		const rows = await this.db.selectFrom("options").select(["name", "value"]).execute();
		const result = /* @__PURE__ */ new Map();
		for (const row of rows) result.set(row.name, JSON.parse(row.value));
		return result;
	}
	/**
	* Get all options matching a prefix
	*/
	async getByPrefix(prefix) {
		const pattern = `${escapeLike$1(prefix)}%`;
		const rows = await this.db.selectFrom("options").select(["name", "value"]).where(sql`name LIKE ${pattern} ESCAPE '\\'`).execute();
		const result = /* @__PURE__ */ new Map();
		for (const row of rows) result.set(row.name, JSON.parse(row.value));
		return result;
	}
	/**
	* Delete all options matching a prefix
	*/
	async deleteByPrefix(prefix) {
		const pattern = `${escapeLike$1(prefix)}%`;
		const result = await this.db.deleteFrom("options").where(sql`name LIKE ${pattern} ESCAPE '\\'`).executeTakeFirst();
		return Number(result.numDeletedRows ?? 0);
	}
};

//#region src/request-cache.ts
const STORE_KEY = Symbol.for("emdash:request-cache");
const g$2 = globalThis;
const store = g$2[STORE_KEY] ?? (() => {
	const wm = /* @__PURE__ */ new WeakMap();
	g$2[STORE_KEY] = wm;
	return wm;
})();
/**
* Return a cached result for `key` if one exists in the current
* request scope, otherwise call `fn`, cache its promise, and return it.
*
* Caches the *promise*, not the resolved value, so concurrent calls
* with the same key share a single in-flight query.
*/
function requestCached(key, fn) {
	const ctx = getRequestContext();
	if (!ctx) return fn();
	let cache = store.get(ctx);
	if (!cache) {
		cache = /* @__PURE__ */ new Map();
		store.set(ctx, cache);
	}
	const existing = cache.get(key);
	if (existing) {
		if (ctx.metrics) ctx.metrics.cacheHits += 1;
		return existing;
	}
	if (ctx.metrics) ctx.metrics.cacheMisses += 1;
	const promise = Promise.resolve().then(fn).catch((error) => {
		cache.delete(key);
		throw error;
	});
	cache.set(key, promise);
	return promise;
}
/**
* Look up an entry in the request-scoped cache without inserting one.
*
* Returns the in-flight or resolved promise if the key exists in the
* current request, otherwise `undefined`. Callers can use this to
* opportunistically satisfy a narrower query (e.g. `getSiteSetting("seo")`)
* from a broader one (`getSiteSettings()`) that's already been loaded
* by a parent template — avoiding a redundant round-trip.
*
* No-ops outside a request context.
*/
function peekRequestCache(key) {
	const ctx = getRequestContext();
	if (!ctx) return void 0;
	return store.get(ctx)?.get(key);
}
/**
* Pre-populate the request-scoped cache with a resolved value.
*
* Internal helper shared between hydration paths (taxonomy terms,
* bylines, etc.) that already have the data in hand and want downstream
* callers using `requestCached(key, ...)` to skip the database entirely.
* Not exported from the package entrypoint — keep it internal until we
* have a documented plugin/extension surface for hydration.
*
* No-ops outside a request context (local dev without ALS).
*
* Does not overwrite an existing entry — if a query for this key is already
* in flight, its promise wins.
*/
function setRequestCacheEntry(key, value) {
	const ctx = getRequestContext();
	if (!ctx) return;
	let cache = store.get(ctx);
	if (!cache) {
		cache = /* @__PURE__ */ new Map();
		store.set(ctx, cache);
	}
	if (cache.has(key)) return;
	cache.set(key, Promise.resolve(value));
}

//#region src/utils/db-errors.ts
/**
* Shared detection helpers for database-layer error messages.
*
* Different SQL dialects phrase "table or relation does not exist" differently:
*
* - SQLite / D1:    "no such table: foo"
* - PostgreSQL:     'relation "foo" does not exist'
*                   'table "foo" does not exist'
* - MySQL (future): "Table 'db.foo' doesn't exist"
*
* Runtime code paths that short-circuit on missing tables (pre-migration
* probes, optional feature tables, etc.) should use these helpers rather
* than hand-rolling string matches per call-site.
*/
/**
* Extract a lowercase error message from any unknown value, safely.
*/
function messageOf(error) {
	if (error instanceof Error) return error.message.toLowerCase();
	if (typeof error === "string") return error.toLowerCase();
	return "";
}
/**
* Returns true when `error` is a "table does not exist" error across the
* dialects EmDash supports (D1/SQLite and PostgreSQL). Used by runtime
* probes to treat pre-migration databases as empty without logging a scary
* warning, while still propagating unrelated errors (permissions, connection
* loss, syntax issues) to callers.
*/
function isMissingTableError(error) {
	const message = messageOf(error);
	if (!message) return false;
	if (message.includes("no such table")) return true;
	if (message.includes("does not exist") || message.includes("doesn't exist")) return message.includes("relation") || message.includes("table");
	return false;
}

//#region src/database/repositories/media.ts
/** Escape LIKE wildcard characters and the escape char itself in user-supplied values */
function escapeLike(value) {
	return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
/**
* Normalize a mimeType filter (string or array) into a clean string[].
* Entries that are empty strings are dropped.
*/
function normalizeMimeFilter(input) {
	if (!input) return [];
	return (Array.isArray(input) ? input : [input]).filter((entry) => typeof entry === "string" && entry.length > 0).map((entry) => entry.endsWith("/") ? entry.toLowerCase() : entry.split(";")[0].trim().toLowerCase());
}
/**
* Build a WHERE clause that matches `mime_type` against any of the given
* filter entries — exact equality for full MIMEs, LIKE prefix for entries
* ending in "/".
*/
function mimeMatchExpr(eb, filters) {
	return eb.or(filters.map((entry) => entry.endsWith("/") ? sql`mime_type LIKE ${`${escapeLike(entry)}%`} ESCAPE '\\'` : eb("mime_type", "=", entry)));
}
/**
* Media repository for database operations
*/
var MediaRepository = class {
	constructor(db) {
		this.db = db;
	}
	/**
	* Create a new media item
	*/
	async create(input) {
		const id = ulid();
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const row = {
			id,
			filename: input.filename,
			mime_type: input.mimeType,
			size: input.size ?? null,
			width: input.width ?? null,
			height: input.height ?? null,
			alt: input.alt ?? null,
			caption: input.caption ?? null,
			storage_key: input.storageKey,
			content_hash: input.contentHash ?? null,
			blurhash: input.blurhash ?? null,
			dominant_color: input.dominantColor ?? null,
			status: input.status ?? "ready",
			created_at: now,
			author_id: input.authorId ?? null
		};
		await this.db.insertInto("media").values(row).execute();
		return this.rowToItem(row);
	}
	/**
	* Create a pending media item (for signed URL upload flow)
	*/
	async createPending(input) {
		return this.create({
			...input,
			status: "pending"
		});
	}
	/**
	* Confirm upload (mark as ready)
	*/
	async confirmUpload(id, metadata) {
		if (!await this.findById(id)) return null;
		const updates = { status: "ready" };
		if (metadata?.width !== void 0) updates.width = metadata.width;
		if (metadata?.height !== void 0) updates.height = metadata.height;
		if (metadata?.size !== void 0) updates.size = metadata.size;
		await this.db.updateTable("media").set(updates).where("id", "=", id).execute();
		return this.findById(id);
	}
	/**
	* Mark upload as failed
	*/
	async markFailed(id) {
		if (!await this.findById(id)) return null;
		await this.db.updateTable("media").set({ status: "failed" }).where("id", "=", id).execute();
		return this.findById(id);
	}
	/**
	* Find media by ID
	*/
	async findById(id) {
		const row = await this.db.selectFrom("media").selectAll().where("id", "=", id).executeTakeFirst();
		return row ? this.rowToItem(row) : null;
	}
	/**
	* Find media by filename
	* Useful for idempotent imports
	*/
	async findByFilename(filename) {
		const row = await this.db.selectFrom("media").selectAll().where("filename", "=", filename).executeTakeFirst();
		return row ? this.rowToItem(row) : null;
	}
	/**
	* Find media by content hash
	* Used for deduplication - same content = same hash
	*/
	async findByContentHash(contentHash) {
		const row = await this.db.selectFrom("media").selectAll().where("content_hash", "=", contentHash).where("status", "=", "ready").executeTakeFirst();
		return row ? this.rowToItem(row) : null;
	}
	/**
	* Find many media items with cursor pagination
	*
	* Uses keyset pagination (cursor-based) for consistent results.
	* The cursor encodes the created_at and id of the last item.
	*/
	async findMany(options = {}) {
		const limit = Math.min(options.limit || 50, 100);
		let query = this.db.selectFrom("media").selectAll().orderBy("created_at", "desc").orderBy("id", "desc").limit(limit + 1);
		if (options.cursor) {
			const { orderValue: createdAt, id: cursorId } = decodeCursor(options.cursor);
			query = query.where((eb) => eb.or([eb("created_at", "<", createdAt), eb.and([eb("created_at", "=", createdAt), eb("id", "<", cursorId)])]));
		}
		const mimeFilters = normalizeMimeFilter(options.mimeType);
		if (mimeFilters.length > 0) query = query.where((eb) => mimeMatchExpr(eb, mimeFilters));
		if (options.status !== "all") query = query.where("status", "=", options.status ?? "ready");
		const rows = await query.execute();
		const hasMore = rows.length > limit;
		const items = rows.slice(0, limit).map((row) => this.rowToItem(row));
		let nextCursor;
		if (hasMore && items.length > 0) {
			const lastItem = items.at(-1);
			nextCursor = encodeCursor(lastItem.createdAt, lastItem.id);
		}
		return {
			items,
			nextCursor
		};
	}
	/**
	* Update media metadata
	*/
	async update(id, input) {
		if (!await this.findById(id)) return null;
		const updates = {};
		if (input.alt !== void 0) updates.alt = input.alt;
		if (input.caption !== void 0) updates.caption = input.caption;
		if (input.width !== void 0) updates.width = input.width;
		if (input.height !== void 0) updates.height = input.height;
		if (Object.keys(updates).length > 0) await this.db.updateTable("media").set(updates).where("id", "=", id).execute();
		return this.findById(id);
	}
	/**
	* Delete media item
	*/
	async delete(id) {
		return ((await this.db.deleteFrom("media").where("id", "=", id).executeTakeFirst()).numDeletedRows ?? 0) > 0;
	}
	/**
	* Count media items
	*/
	async count(mimeType) {
		const filters = normalizeMimeFilter(mimeType);
		let query = this.db.selectFrom("media").select((eb) => eb.fn.count("id").as("count"));
		if (filters.length > 0) query = query.where((eb) => mimeMatchExpr(eb, filters));
		const result = await query.executeTakeFirst();
		return Number(result?.count || 0);
	}
	/**
	* Delete pending uploads older than the given age.
	* Pending uploads that were never confirmed indicate abandoned upload flows.
	*
	* Returns the storage keys of deleted rows so callers can remove the
	* corresponding files from object storage.
	*/
	async cleanupPendingUploads(maxAgeMs = 3600 * 1e3) {
		const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
		const rows = await this.db.selectFrom("media").select("storage_key").where("status", "=", "pending").where("created_at", "<", cutoff).execute();
		if (rows.length === 0) return [];
		await this.db.deleteFrom("media").where("status", "=", "pending").where("created_at", "<", cutoff).execute();
		return rows.map((r) => r.storage_key);
	}
	/**
	* Convert database row to MediaItem
	*/
	rowToItem(row) {
		return {
			id: row.id,
			filename: row.filename,
			mimeType: row.mime_type,
			size: row.size,
			width: row.width,
			height: row.height,
			alt: row.alt,
			caption: row.caption,
			storageKey: row.storage_key,
			contentHash: row.content_hash,
			blurhash: row.blurhash,
			dominantColor: row.dominant_color,
			status: row.status,
			createdAt: row.created_at,
			authorId: row.author_id
		};
	}
};

//#endregion
//#region src/settings/index.ts
/** Prefix for site settings in the options table */
const SETTINGS_PREFIX = "site:";
const SITE_SETTINGS_CACHE_KEY = Symbol.for("emdash:site-settings");
const g$1 = globalThis;
const holder = g$1[SITE_SETTINGS_CACHE_KEY] ?? (() => {
	const h = {
		version: 0,
		cached: null,
		cachedVersion: -1
	};
	g$1[SITE_SETTINGS_CACHE_KEY] = h;
	return h;
})();
/**
* Bump the isolate-wide site-settings cache version, forcing the next
* `getSiteSettings()` to re-query the database.
*
* Called from every `site:*` write path. Other isolates still serve their
* own cached copy until they expire — staleness bounded by isolate lifetime.
*/
function invalidateSiteSettingsCache() {
	holder.version++;
	holder.cached = null;
	holder.cachedVersion = -1;
}
/**
* Set site settings (internal function used by admin API)
*
* Merges provided settings with existing ones. Only provided fields are updated.
* Media references should include just the mediaId; URLs are resolved on read.
*
* @param settings - Partial settings object with values to update
* @param db - Kysely database instance
* @returns Promise that resolves when settings are saved
*
* @internal
*
* @example
* ```ts
* // Update multiple settings at once
* await setSiteSettings({
*   title: "My Site",
*   tagline: "Welcome",
*   logo: { mediaId: "med_123", alt: "Logo" }
* }, db);
* ```
*/
async function setSiteSettings(settings, db) {
	const options = new OptionsRepository(db);
	const updates = {};
	for (const [key, value] of Object.entries(settings)) if (value !== void 0) updates[`${SETTINGS_PREFIX}${key}`] = value;
	try {
		await options.setMany(updates);
	} finally {
		invalidateSiteSettingsCache();
	}
}

//#region src/database/transaction.ts
/**
* Run a callback inside a transaction if supported, or directly if not.
*
* Probes the database once on first call to determine if transactions work.
* The result is cached for the lifetime of the process/worker.
*/
let transactionsSupported = null;
const TRANSACTIONS_NOT_SUPPORTED_RE = /transactions are not supported/i;
async function withTransaction(db, fn) {
	if (transactionsSupported === true) return db.transaction().execute(fn);
	if (transactionsSupported === false) return fn(db);
	try {
		const result = await db.transaction().execute(fn);
		transactionsSupported = true;
		return result;
	} catch (error) {
		if (error instanceof Error && TRANSACTIONS_NOT_SUPPORTED_RE.test(error.message)) {
			transactionsSupported = false;
			return fn(db);
		}
		throw error;
	}
}

//#region src/redirects/patterns.ts
/**
* URL pattern matching for redirects.
*
* Uses Astro's route syntax: [param] for named segments, [...rest] for catch-all.
* Compiles patterns to safe regexes -- no user-supplied regex, no ReDoS risk.
*
* @example
* ```ts
* const compiled = compilePattern("/old-blog/[...path]");
* const match = matchPattern(compiled, "/old-blog/2024/01/post");
* // match = { path: "2024/01/post" }
*
* interpolateDestination("/blog/[...path]", match);
* // "/blog/2024/01/post"
* ```
*/
/** Matches [paramName] placeholders */
const PARAM_PATTERN = /\[(\w+)\]/g;
/** Matches [...splatName] placeholders */
const SPLAT_PATTERN = /\[\.\.\.(\w+)\]/g;
/** Combined pattern for validation: matches both [param] and [...splat] */
const ANY_PLACEHOLDER = /\[(?:\.\.\.)?(\w+)\]/g;
/** Split on capture groups in compiled regex string */
const CAPTURE_GROUP_SPLIT = /(\([^)]+\))/;
/** Escape regex-special characters in literal parts */
const REGEX_SPECIAL_CHARS = /[.*+?^${}|\\]/g;
/**
* Returns true if a source string contains [param] or [...splat] placeholders.
*/
function isPattern(source) {
	return source.match(ANY_PLACEHOLDER) !== null;
}
/**
* Compile a URL pattern into a regex for matching.
*
* - `[param]` matches a single path segment (`[^/]+`)
* - `[...rest]` matches one or more remaining segments (`.+`)
*/
function compilePattern(source) {
	const paramNames = [];
	let regexStr = source.replace(SPLAT_PATTERN, (_match, name) => {
		paramNames.push(name);
		return "(.+)";
	});
	regexStr = regexStr.replace(PARAM_PATTERN, (_match, name) => {
		paramNames.push(name);
		return "([^/]+)";
	});
	const escaped = regexStr.split(CAPTURE_GROUP_SPLIT).map((part, i) => {
		if (i % 2 === 1) return part;
		return part.replace(REGEX_SPECIAL_CHARS, "\\$&");
	}).join("");
	return {
		regex: new RegExp(`^${escaped}$`),
		paramNames,
		source
	};
}
/**
* Match a path against a compiled pattern.
* Returns captured params or null if no match.
*/
function matchPattern(compiled, path) {
	const match = path.match(compiled.regex);
	if (!match) return null;
	const params = {};
	for (let i = 0; i < compiled.paramNames.length; i++) {
		const value = match[i + 1];
		if (value !== void 0) params[compiled.paramNames[i]] = value;
	}
	return params;
}
/**
* Interpolate captured params into a destination pattern.
*
* @example
* interpolateDestination("/blog/[...path]", { path: "2024/01/post" })
* // "/blog/2024/01/post"
*/
function interpolateDestination(destination, params) {
	let result = destination.replace(SPLAT_PATTERN, (_match, name) => {
		return params[name] ?? "";
	});
	result = result.replace(PARAM_PATTERN, (_match, name) => {
		return params[name] ?? "";
	});
	return result;
}

//#region src/database/repositories/redirect.ts
/**
* Hard cap on rows stored in `_emdash_404_log`. When exceeded, the oldest
* rows (by `last_seen_at`) are evicted on insert. Prevents an unauthenticated
* attacker from growing the table without bound by requesting unique URLs.
*/
const MAX_404_LOG_ROWS = 1e4;
/** Max stored length for the `Referer` header — truncated on insert. */
const REFERRER_MAX_LENGTH = 512;
/** Max stored length for the `User-Agent` header — truncated on insert. */
const USER_AGENT_MAX_LENGTH = 256;
/** Pattern to escape LIKE wildcards: %, _, and backslash */
const LIKE_ESCAPE_RE$1 = /[\\%_]/g;
/**
* Truncate a header-derived string to `max` chars, preserving `null`/`undefined`
* as `null`. Empty strings stay empty (the caller decides whether to coerce).
*/
function truncateOrNull(value, max) {
	if (value === null || value === void 0) return null;
	return value.length > max ? value.slice(0, max) : value;
}
function rowToRedirect(row) {
	return {
		id: row.id,
		source: row.source,
		destination: row.destination,
		type: row.type,
		isPattern: row.is_pattern === 1,
		enabled: row.enabled === 1,
		hits: row.hits,
		lastHitAt: row.last_hit_at,
		groupName: row.group_name,
		auto: row.auto === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}
var RedirectRepository = class {
	constructor(db) {
		this.db = db;
	}
	async findById(id) {
		const row = await this.db.selectFrom("_emdash_redirects").selectAll().where("id", "=", id).executeTakeFirst();
		return row ? rowToRedirect(row) : null;
	}
	async findBySource(source) {
		const row = await this.db.selectFrom("_emdash_redirects").selectAll().where("source", "=", source).executeTakeFirst();
		return row ? rowToRedirect(row) : null;
	}
	async findMany(opts) {
		const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
		let query = this.db.selectFrom("_emdash_redirects").selectAll().orderBy("created_at", "desc").orderBy("id", "desc").limit(limit + 1);
		if (opts.search) {
			const term = `%${opts.search.replace(LIKE_ESCAPE_RE$1, (c) => `\\${c}`)}%`;
			query = query.where((eb) => eb.or([sql`source LIKE ${term} ESCAPE '\\'`, sql`destination LIKE ${term} ESCAPE '\\'`]));
		}
		if (opts.group !== void 0) query = query.where("group_name", "=", opts.group);
		if (opts.enabled !== void 0) query = query.where("enabled", "=", opts.enabled ? 1 : 0);
		if (opts.auto !== void 0) query = query.where("auto", "=", opts.auto ? 1 : 0);
		if (opts.cursor) {
			const decoded = decodeCursor(opts.cursor);
			query = query.where((eb) => eb.or([eb("created_at", "<", decoded.orderValue), eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)])]));
		}
		const rows = await query.execute();
		const items = rows.slice(0, limit).map(rowToRedirect);
		const result = { items };
		if (rows.length > limit) {
			const last = items.at(-1);
			result.nextCursor = encodeCursor(last.createdAt, last.id);
		}
		return result;
	}
	async create(input) {
		const id = ulid();
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const patternFlag = input.isPattern ?? isPattern(input.source);
		await this.db.insertInto("_emdash_redirects").values({
			id,
			source: input.source,
			destination: input.destination,
			type: input.type ?? 301,
			is_pattern: patternFlag ? 1 : 0,
			enabled: input.enabled !== false ? 1 : 0,
			hits: 0,
			last_hit_at: null,
			group_name: input.groupName ?? null,
			auto: input.auto ? 1 : 0,
			created_at: now,
			updated_at: now
		}).execute();
		return await this.findById(id);
	}
	async update(id, input) {
		if (!await this.findById(id)) return null;
		const values = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
		if (input.source !== void 0) {
			values.source = input.source;
			values.is_pattern = input.isPattern !== void 0 ? input.isPattern ? 1 : 0 : isPattern(input.source) ? 1 : 0;
		} else if (input.isPattern !== void 0) values.is_pattern = input.isPattern ? 1 : 0;
		if (input.destination !== void 0) values.destination = input.destination;
		if (input.type !== void 0) values.type = input.type;
		if (input.enabled !== void 0) values.enabled = input.enabled ? 1 : 0;
		if (input.groupName !== void 0) values.group_name = input.groupName;
		await this.db.updateTable("_emdash_redirects").set(values).where("id", "=", id).execute();
		return await this.findById(id);
	}
	async delete(id) {
		const result = await this.db.deleteFrom("_emdash_redirects").where("id", "=", id).executeTakeFirst();
		return BigInt(result.numDeletedRows) > 0n;
	}
	/**
	* Fetch all enabled redirects (for loop detection graph building).
	* Not paginated — returns the full set.
	*/
	async findAllEnabled() {
		return (await this.db.selectFrom("_emdash_redirects").selectAll().where("enabled", "=", 1).execute()).map(rowToRedirect);
	}
	async findExactMatch(path) {
		const row = await this.db.selectFrom("_emdash_redirects").selectAll().where("source", "=", path).where("enabled", "=", 1).where("is_pattern", "=", 0).executeTakeFirst();
		return row ? rowToRedirect(row) : null;
	}
	async findEnabledPatternRules() {
		return (await this.db.selectFrom("_emdash_redirects").selectAll().where("enabled", "=", 1).where("is_pattern", "=", 1).execute()).map(rowToRedirect);
	}
	/**
	* Match a request path against all enabled redirect rules.
	* Checks exact matches first (indexed), then pattern rules.
	* Returns the matched redirect and the resolved destination URL.
	*/
	async matchPath(path) {
		const exact = await this.findExactMatch(path);
		if (exact) return {
			redirect: exact,
			resolvedDestination: exact.destination
		};
		const patterns = await this.findEnabledPatternRules();
		for (const redirect of patterns) {
			const params = matchPattern(compilePattern(redirect.source), path);
			if (params) return {
				redirect,
				resolvedDestination: interpolateDestination(redirect.destination, params)
			};
		}
		return null;
	}
	async recordHit(id) {
		await sql`
			UPDATE _emdash_redirects
			SET hits = hits + 1, last_hit_at = ${currentTimestampValue(this.db)}, updated_at = ${currentTimestampValue(this.db)}
			WHERE id = ${id}
		`.execute(this.db);
	}
	/**
	* Create an auto-redirect when a content slug changes.
	* Uses the collection's URL pattern to compute old/new URLs.
	* Collapses existing redirect chains pointing to the old URL.
	*/
	async createAutoRedirect(collection, oldSlug, newSlug, contentId, urlPattern) {
		const oldUrl = urlPattern ? urlPattern.replace("{slug}", oldSlug).replace("{id}", contentId) : `/${collection}/${oldSlug}`;
		const newUrl = urlPattern ? urlPattern.replace("{slug}", newSlug).replace("{id}", contentId) : `/${collection}/${newSlug}`;
		await this.collapseChains(oldUrl, newUrl);
		const existing = await this.findBySource(oldUrl);
		if (existing) return await this.update(existing.id, { destination: newUrl });
		return this.create({
			source: oldUrl,
			destination: newUrl,
			type: 301,
			isPattern: false,
			auto: true,
			groupName: "Auto: slug change"
		});
	}
	/**
	* Update all redirects whose destination matches oldDestination
	* to point to newDestination instead. Prevents redirect chains.
	* Returns the number of updated rows.
	*/
	async collapseChains(oldDestination, newDestination) {
		const result = await this.db.updateTable("_emdash_redirects").set({
			destination: newDestination,
			updated_at: (/* @__PURE__ */ new Date()).toISOString()
		}).where("destination", "=", oldDestination).executeTakeFirst();
		return Number(result.numUpdatedRows);
	}
	/**
	* Record a 404 hit for `entry.path`.
	*
	* Dedups by path: repeat hits increment `hits` and refresh `last_seen_at`
	* on the existing row instead of inserting a new one. Referrer and
	* user-agent are truncated to bounded lengths so a malicious client can't
	* blow up storage with huge headers. When the table would exceed
	* MAX_404_LOG_ROWS, the oldest entries (by `last_seen_at`) are evicted.
	*
	* This is called from the public redirect middleware on every 404 and
	* must never throw for an unauthenticated caller — failures bubble up to
	* the middleware, which swallows them.
	*/
	async log404(entry) {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const referrer = truncateOrNull(entry.referrer, REFERRER_MAX_LENGTH);
		const userAgent = truncateOrNull(entry.userAgent, USER_AGENT_MAX_LENGTH);
		const ip = entry.ip ?? null;
		await this.db.insertInto("_emdash_404_log").values({
			id: ulid(),
			path: entry.path,
			referrer,
			user_agent: userAgent,
			ip,
			hits: 1,
			last_seen_at: now,
			created_at: now
		}).onConflict((oc) => oc.column("path").doUpdateSet({
			hits: sql`hits + 1`,
			last_seen_at: now,
			referrer,
			user_agent: userAgent,
			ip
		})).execute();
		await this.enforce404Cap();
	}
	/**
	* Delete the oldest rows from `_emdash_404_log` if the row count exceeds
	* MAX_404_LOG_ROWS. "Oldest" is by `last_seen_at`, so a path that keeps
	* getting hit stays in the table even if it was first seen long ago.
	*
	* Private — callers use `log404`, which invokes this after every upsert.
	*/
	async enforce404Cap() {
		const countRow = await this.db.selectFrom("_emdash_404_log").select((eb) => eb.fn.countAll().as("c")).executeTakeFirst();
		const count = Number(countRow?.c ?? 0);
		if (count <= MAX_404_LOG_ROWS) return;
		const excess = count - MAX_404_LOG_ROWS;
		await this.db.deleteFrom("_emdash_404_log").where("id", "in", this.db.selectFrom("_emdash_404_log").select("id").orderBy("last_seen_at", "asc").orderBy("id", "asc").limit(excess)).execute();
	}
	async find404s(opts) {
		const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
		let query = this.db.selectFrom("_emdash_404_log").selectAll().orderBy("created_at", "desc").orderBy("id", "desc").limit(limit + 1);
		if (opts.search) {
			const term = `%${opts.search.replace(LIKE_ESCAPE_RE$1, (c) => `\\${c}`)}%`;
			query = query.where(sql`path LIKE ${term} ESCAPE '\\'`);
		}
		if (opts.cursor) {
			const decoded = decodeCursor(opts.cursor);
			query = query.where((eb) => eb.or([eb("created_at", "<", decoded.orderValue), eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)])]));
		}
		const rows = await query.execute();
		const items = rows.slice(0, limit).map((row) => ({
			id: row.id,
			path: row.path,
			referrer: row.referrer,
			userAgent: row.user_agent,
			ip: row.ip,
			createdAt: row.created_at
		}));
		const result = { items };
		if (rows.length > limit) {
			const last = items.at(-1);
			result.nextCursor = encodeCursor(last.createdAt, last.id);
		}
		return result;
	}
	async get404Summary(limit = 50) {
		return (await sql`
			SELECT
				path,
				SUM(hits) as count,
				MAX(last_seen_at) as last_seen,
				(
					SELECT referrer FROM _emdash_404_log AS inner_log
					WHERE inner_log.path = _emdash_404_log.path
						AND referrer IS NOT NULL AND referrer != ''
					LIMIT 1
				) as top_referrer
			FROM _emdash_404_log
			GROUP BY path
			ORDER BY count DESC
			LIMIT ${limit}
		`.execute(this.db)).rows.map((row) => ({
			path: row.path,
			count: Number(row.count),
			lastSeen: row.last_seen,
			topReferrer: row.top_referrer
		}));
	}
	async delete404(id) {
		const result = await this.db.deleteFrom("_emdash_404_log").where("id", "=", id).executeTakeFirst();
		return BigInt(result.numDeletedRows) > 0n;
	}
	async clear404s() {
		const result = await this.db.deleteFrom("_emdash_404_log").executeTakeFirst();
		return Number(result.numDeletedRows);
	}
	async prune404s(olderThan) {
		const result = await this.db.deleteFrom("_emdash_404_log").where("created_at", "<", olderThan).executeTakeFirst();
		return Number(result.numDeletedRows);
	}
};

//#region src/utils/chunks.ts
var chunks_exports = /* @__PURE__ */ __exportAll({
	SQL_BATCH_SIZE: () => SQL_BATCH_SIZE,
	chunks: () => chunks
});
/**
* Split an array into chunks of at most `size` elements.
*
* Used to keep SQL `IN (?, ?, …)` clauses within Cloudflare D1's
* bound-parameter limit (~100 per statement).
*/
function chunks(arr, size) {
	if (arr.length === 0) return [];
	const result = [];
	for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
	return result;
}
/** Conservative default chunk size for SQL IN clauses (well within D1's limit). */
const SQL_BATCH_SIZE = 50;

const chunksBK1oZSL = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	n: chunks,
	r: chunks_exports,
	t: SQL_BATCH_SIZE
}, Symbol.toStringTag, { value: 'Module' }));

//#region src/database/repositories/byline.ts
function rowToByline(row) {
	return {
		id: row.id,
		slug: row.slug,
		displayName: row.display_name,
		bio: row.bio,
		avatarMediaId: row.avatar_media_id,
		websiteUrl: row.website_url,
		userId: row.user_id,
		isGuest: row.is_guest === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}
var BylineRepository = class {
	constructor(db) {
		this.db = db;
	}
	async findById(id) {
		const row = await this.db.selectFrom("_emdash_bylines").selectAll().where("id", "=", id).executeTakeFirst();
		return row ? rowToByline(row) : null;
	}
	async findBySlug(slug) {
		const row = await this.db.selectFrom("_emdash_bylines").selectAll().where("slug", "=", slug).executeTakeFirst();
		return row ? rowToByline(row) : null;
	}
	async findByUserId(userId) {
		const row = await this.db.selectFrom("_emdash_bylines").selectAll().where("user_id", "=", userId).executeTakeFirst();
		return row ? rowToByline(row) : null;
	}
	async findMany(options) {
		const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
		let query = this.db.selectFrom("_emdash_bylines").selectAll().orderBy("created_at", "desc").orderBy("id", "desc").limit(limit + 1);
		if (options?.search) {
			const term = `%${options.search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
			query = query.where((eb) => eb.or([eb("display_name", "like", term), eb("slug", "like", term)]));
		}
		if (options?.isGuest !== void 0) query = query.where("is_guest", "=", options.isGuest ? 1 : 0);
		if (options?.userId !== void 0) query = query.where("user_id", "=", options.userId);
		if (options?.cursor) {
			const decoded = decodeCursor(options.cursor);
			query = query.where((eb) => eb.or([eb("created_at", "<", decoded.orderValue), eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)])]));
		}
		const rows = await query.execute();
		const items = rows.slice(0, limit).map(rowToByline);
		const result = { items };
		if (rows.length > limit) {
			const last = items.at(-1);
			if (last) result.nextCursor = encodeCursor(last.createdAt, last.id);
		}
		return result;
	}
	async create(input) {
		const id = ulid();
		const now = (/* @__PURE__ */ new Date()).toISOString();
		await this.db.insertInto("_emdash_bylines").values({
			id,
			slug: input.slug,
			display_name: input.displayName,
			bio: input.bio ?? null,
			avatar_media_id: input.avatarMediaId ?? null,
			website_url: input.websiteUrl ?? null,
			user_id: input.userId ?? null,
			is_guest: input.isGuest ? 1 : 0,
			created_at: now,
			updated_at: now
		}).execute();
		const byline = await this.findById(id);
		if (!byline) throw new Error("Failed to create byline");
		return byline;
	}
	async update(id, input) {
		if (!await this.findById(id)) return null;
		const updates = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
		if (input.slug !== void 0) updates.slug = input.slug;
		if (input.displayName !== void 0) updates.display_name = input.displayName;
		if (input.bio !== void 0) updates.bio = input.bio;
		if (input.avatarMediaId !== void 0) updates.avatar_media_id = input.avatarMediaId;
		if (input.websiteUrl !== void 0) updates.website_url = input.websiteUrl;
		if (input.userId !== void 0) updates.user_id = input.userId;
		if (input.isGuest !== void 0) updates.is_guest = input.isGuest ? 1 : 0;
		await this.db.updateTable("_emdash_bylines").set(updates).where("id", "=", id).execute();
		return await this.findById(id);
	}
	async delete(id) {
		if (!await this.findById(id)) return false;
		await withTransaction(this.db, async (trx) => {
			await trx.deleteFrom("_emdash_content_bylines").where("byline_id", "=", id).execute();
			await trx.deleteFrom("_emdash_bylines").where("id", "=", id).execute();
			const tableNames = await listTablesLike(trx, "ec_%");
			for (const tableName of tableNames) {
				validateIdentifier(tableName, "content table");
				await sql`
					UPDATE ${sql.ref(tableName)}
					SET primary_byline_id = NULL
					WHERE primary_byline_id = ${id}
				`.execute(trx);
			}
		});
		return true;
	}
	async getContentBylines(collectionSlug, contentId) {
		return (await this.db.selectFrom("_emdash_content_bylines as cb").innerJoin("_emdash_bylines as b", "b.id", "cb.byline_id").select([
			"cb.sort_order as sort_order",
			"cb.role_label as role_label",
			"b.id as id",
			"b.slug as slug",
			"b.display_name as display_name",
			"b.bio as bio",
			"b.avatar_media_id as avatar_media_id",
			"b.website_url as website_url",
			"b.user_id as user_id",
			"b.is_guest as is_guest",
			"b.created_at as created_at",
			"b.updated_at as updated_at"
		]).where("cb.collection_slug", "=", collectionSlug).where("cb.content_id", "=", contentId).orderBy("cb.sort_order", "asc").execute()).map((row) => ({
			byline: rowToByline(row),
			sortOrder: row.sort_order,
			roleLabel: row.role_label
		}));
	}
	/**
	* Batch-fetch byline credits for multiple content items in a single query.
	* Returns a Map keyed by contentId.
	*/
	async getContentBylinesMany(collectionSlug, contentIds) {
		const result = /* @__PURE__ */ new Map();
		if (contentIds.length === 0) return result;
		const uniqueContentIds = [...new Set(contentIds)];
		for (const chunk of chunks(uniqueContentIds, SQL_BATCH_SIZE)) {
			const rows = await this.db.selectFrom("_emdash_content_bylines as cb").innerJoin("_emdash_bylines as b", "b.id", "cb.byline_id").select([
				"cb.content_id as content_id",
				"cb.sort_order as sort_order",
				"cb.role_label as role_label",
				"b.id as id",
				"b.slug as slug",
				"b.display_name as display_name",
				"b.bio as bio",
				"b.avatar_media_id as avatar_media_id",
				"b.website_url as website_url",
				"b.user_id as user_id",
				"b.is_guest as is_guest",
				"b.created_at as created_at",
				"b.updated_at as updated_at"
			]).where("cb.collection_slug", "=", collectionSlug).where("cb.content_id", "in", chunk).orderBy("cb.sort_order", "asc").execute();
			for (const row of rows) {
				const contentId = row.content_id;
				const credit = {
					byline: rowToByline(row),
					sortOrder: row.sort_order,
					roleLabel: row.role_label
				};
				const existing = result.get(contentId);
				if (existing) existing.push(credit);
				else result.set(contentId, [credit]);
			}
		}
		return result;
	}
	/**
	* Batch-fetch byline profiles linked to user IDs in a single query.
	* Returns a Map keyed by userId.
	*/
	async findByUserIds(userIds) {
		const result = /* @__PURE__ */ new Map();
		if (userIds.length === 0) return result;
		for (const chunk of chunks(userIds, SQL_BATCH_SIZE)) {
			const rows = await this.db.selectFrom("_emdash_bylines").selectAll().where("user_id", "in", chunk).execute();
			for (const row of rows) if (row.user_id) result.set(row.user_id, rowToByline(row));
		}
		return result;
	}
	async setContentBylines(collectionSlug, contentId, inputBylines) {
		validateIdentifier(collectionSlug, "collection slug");
		const tableName = `ec_${collectionSlug}`;
		validateIdentifier(tableName, "content table");
		const seen = /* @__PURE__ */ new Set();
		const bylines = inputBylines.filter((item) => {
			if (seen.has(item.bylineId)) return false;
			seen.add(item.bylineId);
			return true;
		});
		if (bylines.length > 0) {
			const ids = bylines.map((item) => item.bylineId);
			if ((await this.db.selectFrom("_emdash_bylines").select("id").where("id", "in", ids).execute()).length !== ids.length) throw new Error("One or more byline IDs do not exist");
		}
		await this.db.deleteFrom("_emdash_content_bylines").where("collection_slug", "=", collectionSlug).where("content_id", "=", contentId).execute();
		for (let i = 0; i < bylines.length; i++) {
			const item = bylines[i];
			await this.db.insertInto("_emdash_content_bylines").values({
				id: ulid(),
				collection_slug: collectionSlug,
				content_id: contentId,
				byline_id: item.bylineId,
				sort_order: i,
				role_label: item.roleLabel ?? null,
				created_at: (/* @__PURE__ */ new Date()).toISOString()
			}).execute();
		}
		await sql`
			UPDATE ${sql.ref(tableName)}
			SET primary_byline_id = ${bylines[0]?.bylineId ?? null}
			WHERE id = ${contentId}
		`.execute(this.db);
		return await this.getContentBylines(collectionSlug, contentId);
	}
};

//#region src/redirects/cache.ts
var cache_exports = /* @__PURE__ */ __exportAll({
	getCachedRedirects: () => getCachedRedirects,
	invalidateRedirectCache: () => invalidateRedirectCache,
	matchCachedPatterns: () => matchCachedPatterns,
	setCachedRedirects: () => setCachedRedirects
});
/**
* Cached enabled redirects.
* null = not yet populated, object = cached.
*/
let cachedRedirects = null;
/**
* Invalidate the cached redirects (both exact and pattern).
* Call when redirects are created, updated, or deleted.
*/
function invalidateRedirectCache() {
	cachedRedirects = null;
}
/**
* Get the cached redirects, or null if the cache is cold.
*/
function getCachedRedirects() {
	return cachedRedirects;
}
/**
* Populate the cache from a list of enabled redirects (both exact and
* pattern). The caller is responsible for passing only enabled rows — the
* cache stores them as-is.
*/
function setCachedRedirects(redirects) {
	const exact = /* @__PURE__ */ new Map();
	const patterns = [];
	for (const r of redirects) if (r.isPattern) patterns.push({
		redirect: r,
		compiled: compilePattern(r.source)
	});
	else exact.set(r.source, r);
	cachedRedirects = {
		exact,
		patterns
	};
	return cachedRedirects;
}
/**
* Match a path against the cached pattern rules.
* Returns the resolved destination and matching redirect, or null.
*/
function matchCachedPatterns(rules, pathname) {
	for (const { redirect, compiled } of rules) {
		const params = matchPattern(compiled, pathname);
		if (params) return {
			redirect,
			destination: interpolateDestination(redirect.destination, params)
		};
	}
	return null;
}

const cacheBAJbeoZ8 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	a: setCachedRedirects,
	i: matchCachedPatterns,
	n: getCachedRedirects,
	r: invalidateRedirectCache,
	t: cache_exports
}, Symbol.toStringTag, { value: 'Module' }));

//#region src/schema/types.ts
/**
* Array of all field types for validation
*/
const FIELD_TYPES$1 = [
	"string",
	"text",
	"url",
	"number",
	"integer",
	"boolean",
	"datetime",
	"select",
	"multiSelect",
	"portableText",
	"image",
	"file",
	"reference",
	"json",
	"slug",
	"repeater"
];
/**
* Map field types to their SQLite column types
*/
const FIELD_TYPE_TO_COLUMN = {
	string: "TEXT",
	text: "TEXT",
	number: "REAL",
	integer: "INTEGER",
	boolean: "INTEGER",
	datetime: "TEXT",
	select: "TEXT",
	multiSelect: "JSON",
	portableText: "JSON",
	image: "TEXT",
	file: "TEXT",
	reference: "TEXT",
	json: "JSON",
	slug: "TEXT",
	url: "TEXT",
	repeater: "JSON"
};
/**
* Reserved field slugs that cannot be used.
*
* Includes names reserved for runtime hydration (`terms`, `bylines`, `byline`)
* so user-defined fields never shadow the auto-hydrated values on entry.data.
*/
const RESERVED_FIELD_SLUGS = [
	"id",
	"slug",
	"status",
	"author_id",
	"primary_byline_id",
	"created_at",
	"updated_at",
	"published_at",
	"scheduled_at",
	"deleted_at",
	"version",
	"live_revision_id",
	"draft_revision_id",
	"terms",
	"bylines",
	"byline"
];
/**
* Reserved collection slugs that cannot be used
*/
const RESERVED_COLLECTION_SLUGS = [
	"content",
	"media",
	"users",
	"revisions",
	"taxonomies",
	"options",
	"audit_logs"
];

//#region src/search/fts-manager.ts
/**
* FTS5 Manager
*
* Handles creation, deletion, and management of FTS5 virtual tables
* for full-text search on content collections.
*/
var FTSManager = class {
	constructor(db) {
		this.db = db;
	}
	/**
	* Validate a collection slug and its searchable field names.
	* Must be called before any raw SQL interpolation.
	*/
	validateInputs(collectionSlug, searchableFields) {
		validateIdentifier(collectionSlug, "collection slug");
		if (searchableFields) for (const field of searchableFields) validateIdentifier(field, "searchable field name");
	}
	/**
	* Get the FTS table name for a collection
	* Uses _emdash_ prefix to clearly mark as internal/system table
	*/
	getFtsTableName(collectionSlug) {
		validateIdentifier(collectionSlug, "collection slug");
		return `_emdash_fts_${collectionSlug}`;
	}
	/**
	* Get the content table name for a collection
	*/
	getContentTableName(collectionSlug) {
		validateIdentifier(collectionSlug, "collection slug");
		return `ec_${collectionSlug}`;
	}
	/**
	* Check if an FTS table exists for a collection
	*/
	async ftsTableExists(collectionSlug) {
		const ftsTable = this.getFtsTableName(collectionSlug);
		return tableExists(this.db, ftsTable);
	}
	/**
	* Create an FTS5 virtual table for a collection.
	* FTS5 is SQLite-only; on other dialects this is a no-op.
	*
	* @param collectionSlug - The collection slug
	* @param searchableFields - Array of field names to index
	* @param weights - Optional field weights for ranking
	*/
	async createFtsTable(collectionSlug, searchableFields, _weights) {
		if (!isSqlite(this.db)) return;
		this.validateInputs(collectionSlug, searchableFields);
		const ftsTable = this.getFtsTableName(collectionSlug);
		const contentTable = this.getContentTableName(collectionSlug);
		const columns = [
			"id UNINDEXED",
			"locale UNINDEXED",
			...searchableFields
		].join(", ");
		await sql.raw(`
			CREATE VIRTUAL TABLE IF NOT EXISTS "${ftsTable}" USING fts5(
				${columns},
				content='${contentTable}',
				content_rowid='rowid',
				tokenize='porter unicode61'
			)
		`).execute(this.db);
		await this.createTriggers(collectionSlug, searchableFields);
	}
	/**
	* Create triggers to keep FTS table in sync with content table.
	*
	* The insert and update triggers only add rows to the FTS index when
	* `deleted_at IS NULL`. This keeps soft-deleted content out of the
	* search index and ensures the FTS row count matches the non-deleted
	* content count (which `verifyAndRepairIndex` relies on).
	*/
	async createTriggers(collectionSlug, searchableFields) {
		this.validateInputs(collectionSlug, searchableFields);
		const ftsTable = this.getFtsTableName(collectionSlug);
		const contentTable = this.getContentTableName(collectionSlug);
		const fieldList = searchableFields.join(", ");
		const newFieldList = searchableFields.map((f) => `NEW.${f}`).join(", ");
		await sql.raw(`
			CREATE TRIGGER IF NOT EXISTS "${ftsTable}_insert" 
			AFTER INSERT ON "${contentTable}" 
			WHEN NEW.deleted_at IS NULL
			BEGIN
				INSERT INTO "${ftsTable}"(rowid, id, locale, ${fieldList})
				VALUES (NEW.rowid, NEW.id, NEW.locale, ${newFieldList});
			END
		`).execute(this.db);
		await sql.raw(`
			CREATE TRIGGER IF NOT EXISTS "${ftsTable}_update" 
			AFTER UPDATE ON "${contentTable}" 
			BEGIN
				DELETE FROM "${ftsTable}" WHERE rowid = OLD.rowid;
				INSERT INTO "${ftsTable}"(rowid, id, locale, ${fieldList})
				SELECT NEW.rowid, NEW.id, NEW.locale, ${newFieldList}
				WHERE NEW.deleted_at IS NULL;
			END
		`).execute(this.db);
		await sql.raw(`
			CREATE TRIGGER IF NOT EXISTS "${ftsTable}_delete" 
			AFTER DELETE ON "${contentTable}" 
			BEGIN
				DELETE FROM "${ftsTable}" WHERE rowid = OLD.rowid;
			END
		`).execute(this.db);
	}
	/**
	* Drop triggers for a collection
	*/
	async dropTriggers(collectionSlug) {
		this.validateInputs(collectionSlug);
		const ftsTable = this.getFtsTableName(collectionSlug);
		await sql.raw(`DROP TRIGGER IF EXISTS "${ftsTable}_insert"`).execute(this.db);
		await sql.raw(`DROP TRIGGER IF EXISTS "${ftsTable}_update"`).execute(this.db);
		await sql.raw(`DROP TRIGGER IF EXISTS "${ftsTable}_delete"`).execute(this.db);
	}
	/**
	* Drop the FTS table and triggers for a collection
	*/
	async dropFtsTable(collectionSlug) {
		if (!isSqlite(this.db)) return;
		this.validateInputs(collectionSlug);
		const ftsTable = this.getFtsTableName(collectionSlug);
		await this.dropTriggers(collectionSlug);
		await sql.raw(`DROP TABLE IF EXISTS "${ftsTable}"`).execute(this.db);
	}
	/**
	* Rebuild the FTS index for a collection
	*
	* This is useful after bulk imports or if the index gets out of sync.
	*/
	async rebuildIndex(collectionSlug, searchableFields, weights) {
		if (!isSqlite(this.db)) return;
		await this.dropFtsTable(collectionSlug);
		await this.createFtsTable(collectionSlug, searchableFields, weights);
		await this.populateFromContent(collectionSlug, searchableFields);
	}
	/**
	* Populate the FTS table from existing content
	*/
	async populateFromContent(collectionSlug, searchableFields) {
		if (!isSqlite(this.db)) return;
		this.validateInputs(collectionSlug, searchableFields);
		const ftsTable = this.getFtsTableName(collectionSlug);
		const contentTable = this.getContentTableName(collectionSlug);
		const fieldList = searchableFields.join(", ");
		await sql.raw(`
			INSERT INTO "${ftsTable}"(rowid, id, locale, ${fieldList})
			SELECT rowid, id, locale, ${fieldList} FROM "${contentTable}"
			WHERE deleted_at IS NULL
		`).execute(this.db);
	}
	/**
	* Get the search configuration for a collection
	*/
	async getSearchConfig(collectionSlug) {
		const result = await this.db.selectFrom("_emdash_collections").select("search_config").where("slug", "=", collectionSlug).executeTakeFirst();
		if (!result?.search_config) return null;
		try {
			const parsed = JSON.parse(result.search_config);
			if (typeof parsed !== "object" || parsed === null || !("enabled" in parsed) || typeof parsed.enabled !== "boolean") return null;
			const config = { enabled: parsed.enabled };
			if ("weights" in parsed && typeof parsed.weights === "object" && parsed.weights !== null) {
				const weights = {};
				for (const [k, v] of Object.entries(parsed.weights)) if (typeof v === "number") weights[k] = v;
				config.weights = weights;
			}
			return config;
		} catch {
			return null;
		}
	}
	/**
	* Update the search configuration for a collection
	*/
	async setSearchConfig(collectionSlug, config) {
		await this.db.updateTable("_emdash_collections").set({ search_config: JSON.stringify(config) }).where("slug", "=", collectionSlug).execute();
	}
	/**
	* Get searchable fields for a collection
	*/
	async getSearchableFields(collectionSlug) {
		const collection = await this.db.selectFrom("_emdash_collections").select("id").where("slug", "=", collectionSlug).executeTakeFirst();
		if (!collection) return [];
		return (await this.db.selectFrom("_emdash_fields").select("slug").where("collection_id", "=", collection.id).where("searchable", "=", 1).execute()).map((f) => f.slug);
	}
	/**
	* Enable search for a collection.
	*
	* Uses rebuildIndex to ensure a clean state -- drop any existing FTS
	* table/triggers, recreate them, and populate from content. This avoids
	* duplicate rows when triggers have already populated the index (e.g.
	* during seeding where content is inserted before search is enabled).
	*/
	async enableSearch(collectionSlug, options) {
		if (!isSqlite(this.db)) throw new Error("Full-text search is only available with SQLite databases");
		const searchableFields = await this.getSearchableFields(collectionSlug);
		if (searchableFields.length === 0) throw new Error(`No searchable fields defined for collection "${collectionSlug}". Mark at least one field as searchable before enabling search.`);
		await this.rebuildIndex(collectionSlug, searchableFields, options?.weights);
		await this.setSearchConfig(collectionSlug, {
			enabled: true,
			weights: options?.weights
		});
	}
	/**
	* Disable search for a collection
	*
	* Drops the FTS table and triggers.
	*/
	async disableSearch(collectionSlug) {
		if (!isSqlite(this.db)) return;
		await this.dropFtsTable(collectionSlug);
		const existing = await this.getSearchConfig(collectionSlug);
		await this.setSearchConfig(collectionSlug, {
			enabled: false,
			weights: existing?.weights
		});
	}
	/**
	* Get index statistics for a collection
	*/
	async getIndexStats(collectionSlug) {
		if (!isSqlite(this.db)) return null;
		this.validateInputs(collectionSlug);
		const ftsDocsizeTable = `${this.getFtsTableName(collectionSlug)}_docsize`;
		if (!await this.ftsTableExists(collectionSlug)) return null;
		return { indexed: (await sql`
			SELECT COUNT(*) as count FROM "${sql.raw(ftsDocsizeTable)}"
		`.execute(this.db)).rows[0]?.count ?? 0 };
	}
	/**
	* Verify FTS index integrity and rebuild if corrupted.
	*
	* Checks for row count mismatch between content table and FTS table.
	*
	* Returns true if the index was rebuilt, false if it was healthy.
	*/
	async verifyAndRepairIndex(collectionSlug) {
		if (!isSqlite(this.db)) return false;
		this.validateInputs(collectionSlug);
		const ftsDocsizeTable = `${this.getFtsTableName(collectionSlug)}_docsize`;
		const contentTable = this.getContentTableName(collectionSlug);
		const fields = await this.getSearchableFields(collectionSlug);
		const config = await this.getSearchConfig(collectionSlug);
		if (!await this.ftsTableExists(collectionSlug)) {
			if (!config?.enabled || fields.length === 0) return false;
			console.warn(`FTS index for "${collectionSlug}" is missing. Rebuilding.`);
			await this.rebuildIndex(collectionSlug, fields, config.weights);
			return true;
		}
		const contentCount = await sql`
			SELECT COUNT(*) as count FROM ${sql.ref(contentTable)}
			WHERE deleted_at IS NULL
		`.execute(this.db);
		const ftsCount = await sql`
			SELECT COUNT(*) as count FROM "${sql.raw(ftsDocsizeTable)}"
		`.execute(this.db);
		const contentRows = contentCount.rows[0]?.count ?? 0;
		const ftsRows = ftsCount.rows[0]?.count ?? 0;
		if (contentRows !== ftsRows) {
			console.warn(`FTS index for "${collectionSlug}" has ${ftsRows} rows but content table has ${contentRows}. Rebuilding.`);
			if (fields.length > 0) await this.rebuildIndex(collectionSlug, fields, config?.weights);
			return true;
		}
		return false;
	}
	/**
	* Verify and repair FTS indexes for all search-enabled collections.
	*
	* Intended to run at startup to auto-heal any corruption from
	* previous process crashes.
	*/
	async verifyAndRepairAll() {
		if (!isSqlite(this.db)) return 0;
		const collections = await this.db.selectFrom("_emdash_collections").select("slug").where("search_config", "is not", null).execute();
		let repaired = 0;
		for (const { slug } of collections) {
			if (!(await this.getSearchConfig(slug))?.enabled) continue;
			try {
				if (await this.verifyAndRepairIndex(slug)) repaired++;
			} catch (error) {
				console.error(`Failed to verify/repair FTS index for "${slug}":`, error);
			}
		}
		return repaired;
	}
};

//#endregion
//#region src/schema/registry.ts
var registry_exports = /* @__PURE__ */ __exportAll({
	SchemaError: () => SchemaError,
	SchemaRegistry: () => SchemaRegistry
});
const SLUG_VALIDATION_PATTERN = /^[a-z][a-z0-9_]*$/;
const EC_PREFIX_PATTERN = /^ec_/;
const SINGLE_QUOTE_PATTERN = /'/g;
const UNDERSCORE_PATTERN = /_/g;
const WORD_BOUNDARY_PATTERN = /\b\w/g;
/** Valid column types for runtime validation */
const COLUMN_TYPES = new Set([
	"TEXT",
	"REAL",
	"INTEGER",
	"JSON"
]);
/** Valid collection source prefixes/values */
const VALID_SOURCES = new Set([
	"manual",
	"discovered",
	"seed"
]);
function isCollectionSource(value) {
	return VALID_SOURCES.has(value) || value.startsWith("template:") || value.startsWith("import:");
}
function isFieldType(value) {
	return value in FIELD_TYPE_TO_COLUMN;
}
function isColumnType(value) {
	return COLUMN_TYPES.has(value);
}
const VALID_COLLECTION_SUPPORTS = new Set([
	"drafts",
	"revisions",
	"preview",
	"scheduling",
	"search",
	"seo"
]);
function isCollectionSupport(value) {
	return typeof value === "string" && VALID_COLLECTION_SUPPORTS.has(value);
}
/**
* Parse a collection's `supports` column (stored as a JSON array of
* CollectionSupport keys). Unknown/invalid entries are filtered out so the
* runtime value matches the declared `CollectionSupport[]` type.
*
* Throws on malformed JSON so corruption surfaces loudly; returns an empty
* array only for explicitly null/empty values or non-array JSON.
*/
function parseSupports(raw) {
	if (!raw) return [];
	const parsed = JSON.parse(raw);
	if (!Array.isArray(parsed)) return [];
	return parsed.filter(isCollectionSupport);
}
/**
* Error thrown when a schema operation fails
*/
var SchemaError = class extends Error {
	constructor(message, code, details) {
		super(message);
		this.code = code;
		this.details = details;
		this.name = "SchemaError";
	}
};
/**
* Schema Registry
*
* Manages collection and field definitions stored in D1.
* Handles runtime DDL operations (CREATE TABLE, ALTER TABLE).
*/
var SchemaRegistry = class {
	constructor(db) {
		this.db = db;
	}
	/**
	* List all collections
	*/
	async listCollections() {
		return (await this.db.selectFrom("_emdash_collections").selectAll().orderBy("slug", "asc").execute()).map(this.mapCollectionRow);
	}
	/**
	* Get a collection by slug
	*/
	async getCollection(slug) {
		const row = await this.db.selectFrom("_emdash_collections").where("slug", "=", slug).selectAll().executeTakeFirst();
		return row ? this.mapCollectionRow(row) : null;
	}
	/**
	* Get a collection with all its fields
	*/
	async getCollectionWithFields(slug) {
		const collection = await this.getCollection(slug);
		if (!collection) return null;
		const fields = await this.listFields(collection.id);
		return {
			...collection,
			fields
		};
	}
	/**
	* List every collection together with its fields in O(1) query shapes
	* — one for collections, then one batched query for the fields of every
	* returned collection — instead of the N+1 pattern of `listCollections`
	* + per-collection `listFields`. The fields query is chunked at
	* `SQL_BATCH_SIZE` to stay under D1's bound-parameter limit, so on
	* sites with more than `SQL_BATCH_SIZE` collections the field fetch
	* becomes `ceil(collectionCount / SQL_BATCH_SIZE)` queries — still
	* a constant factor, not N+1. Typical sites have well under
	* `SQL_BATCH_SIZE` collections, so this is two queries in practice.
	*
	* Used by the manifest build, which previously paid N+1 round-trips on
	* every admin request. Each round-trip costs ~80–150ms against the D1
	* primary on a busy link, so a 10-collection site spent ~1 s rebuilding
	* a manifest that is now built fresh per admin request (no cache).
	*/
	async listCollectionsWithFields() {
		const collectionRows = await this.db.selectFrom("_emdash_collections").selectAll().orderBy("slug", "asc").execute();
		if (collectionRows.length === 0) return [];
		const fieldsByCollection = /* @__PURE__ */ new Map();
		for (const idChunk of chunks(collectionRows.map((c) => c.id), SQL_BATCH_SIZE)) {
			const fieldRows = await this.db.selectFrom("_emdash_fields").where("collection_id", "in", idChunk).selectAll().orderBy("collection_id", "asc").orderBy("sort_order", "asc").orderBy("created_at", "asc").execute();
			for (const row of fieldRows) {
				const list = fieldsByCollection.get(row.collection_id) ?? [];
				list.push(this.mapFieldRow(row));
				fieldsByCollection.set(row.collection_id, list);
			}
		}
		return collectionRows.map((c) => ({
			...this.mapCollectionRow(c),
			fields: fieldsByCollection.get(c.id) ?? []
		}));
	}
	/**
	* Create a new collection
	*/
	async createCollection(input) {
		this.validateSlug(input.slug, "collection");
		if (RESERVED_COLLECTION_SLUGS.includes(input.slug)) throw new SchemaError(`Collection slug "${input.slug}" is reserved`, "RESERVED_SLUG");
		if (await this.getCollection(input.slug)) throw new SchemaError(`Collection "${input.slug}" already exists`, "COLLECTION_EXISTS");
		const id = ulid();
		const supports = input.supports ?? ["drafts", "revisions"];
		const hasSeo = input.hasSeo ?? supports.includes("seo") ?? false;
		await withTransaction(this.db, async (trx) => {
			await trx.insertInto("_emdash_collections").values({
				id,
				slug: input.slug,
				label: input.label,
				label_singular: input.labelSingular ?? null,
				description: input.description ?? null,
				icon: input.icon ?? null,
				supports: JSON.stringify(supports),
				source: input.source ?? "manual",
				has_seo: hasSeo ? 1 : 0,
				comments_enabled: input.commentsEnabled ? 1 : 0,
				url_pattern: input.urlPattern ?? null
			}).execute();
			await this.createContentTable(input.slug, trx);
		});
		const collection = await this.getCollection(input.slug);
		if (!collection) throw new SchemaError("Failed to create collection", "CREATE_FAILED");
		return collection;
	}
	/**
	* Update a collection
	*/
	async updateCollection(slug, input) {
		const existing = await this.getCollection(slug);
		if (!existing) throw new SchemaError(`Collection "${slug}" not found`, "COLLECTION_NOT_FOUND");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const supportsArray = input.supports ?? existing.supports;
		const hasSeo = input.hasSeo !== void 0 ? input.hasSeo : input.supports !== void 0 ? supportsArray.includes("seo") : existing.hasSeo;
		return withTransaction(this.db, async (trx) => {
			await trx.updateTable("_emdash_collections").set({
				label: input.label ?? existing.label,
				label_singular: input.labelSingular ?? existing.labelSingular ?? null,
				description: input.description ?? existing.description ?? null,
				icon: input.icon ?? existing.icon ?? null,
				supports: input.supports ? JSON.stringify(input.supports) : JSON.stringify(existing.supports),
				url_pattern: input.urlPattern !== void 0 ? input.urlPattern ?? null : existing.urlPattern ?? null,
				has_seo: hasSeo ? 1 : 0,
				comments_enabled: input.commentsEnabled !== void 0 ? input.commentsEnabled ? 1 : 0 : existing.commentsEnabled ? 1 : 0,
				comments_moderation: input.commentsModeration ?? existing.commentsModeration,
				comments_closed_after_days: input.commentsClosedAfterDays !== void 0 ? input.commentsClosedAfterDays : existing.commentsClosedAfterDays,
				comments_auto_approve_users: input.commentsAutoApproveUsers !== void 0 ? input.commentsAutoApproveUsers ? 1 : 0 : existing.commentsAutoApproveUsers ? 1 : 0,
				updated_at: now
			}).where("slug", "=", slug).execute();
			const row = await trx.selectFrom("_emdash_collections").where("slug", "=", slug).selectAll().executeTakeFirst();
			if (!row) throw new SchemaError("Failed to update collection", "UPDATE_FAILED");
			if (input.supports !== void 0) {
				if (existing.supports.includes("search") !== parseSupports(row.supports).includes("search")) await this.syncSearchState(slug, trx);
			}
			return this.mapCollectionRow(row);
		});
	}
	/**
	* Delete a collection
	*/
	async deleteCollection(slug, options) {
		const existing = await this.getCollection(slug);
		if (!existing) throw new SchemaError(`Collection "${slug}" not found`, "COLLECTION_NOT_FOUND");
		if (!options?.force) {
			if (await this.collectionHasContent(slug)) throw new SchemaError(`Collection "${slug}" has content. Use force: true to delete.`, "COLLECTION_HAS_CONTENT");
		}
		await withTransaction(this.db, async (trx) => {
			await new FTSManager(trx).dropFtsTable(slug);
			const tableName = this.getTableName(slug);
			await sql`DROP TABLE IF EXISTS ${sql.ref(tableName)}`.execute(trx);
			await trx.deleteFrom("_emdash_collections").where("id", "=", existing.id).execute();
		});
	}
	/**
	* List fields for a collection
	*/
	async listFields(collectionId) {
		return (await this.db.selectFrom("_emdash_fields").where("collection_id", "=", collectionId).selectAll().orderBy("sort_order", "asc").orderBy("created_at", "asc").execute()).map(this.mapFieldRow);
	}
	/**
	* Get a field by slug within a collection
	*/
	async getField(collectionSlug, fieldSlug) {
		const collection = await this.getCollection(collectionSlug);
		if (!collection) return null;
		const row = await this.db.selectFrom("_emdash_fields").where("collection_id", "=", collection.id).where("slug", "=", fieldSlug).selectAll().executeTakeFirst();
		return row ? this.mapFieldRow(row) : null;
	}
	/**
	* Create a new field
	*/
	async createField(collectionSlug, input) {
		const collection = await this.getCollection(collectionSlug);
		if (!collection) throw new SchemaError(`Collection "${collectionSlug}" not found`, "COLLECTION_NOT_FOUND");
		this.validateSlug(input.slug, "field");
		if (RESERVED_FIELD_SLUGS.includes(input.slug)) throw new SchemaError(`Field slug "${input.slug}" is reserved`, "RESERVED_SLUG");
		if (await this.getField(collectionSlug, input.slug)) throw new SchemaError(`Field "${input.slug}" already exists in collection "${collectionSlug}"`, "FIELD_EXISTS");
		const id = ulid();
		const columnType = FIELD_TYPE_TO_COLUMN[input.type];
		const maxSort = await this.db.selectFrom("_emdash_fields").where("collection_id", "=", collection.id).select((eb) => eb.fn.max("sort_order").as("max")).executeTakeFirst();
		const sortOrder = input.sortOrder ?? (maxSort?.max ?? -1) + 1;
		return withTransaction(this.db, async (trx) => {
			await trx.insertInto("_emdash_fields").values({
				id,
				collection_id: collection.id,
				slug: input.slug,
				label: input.label,
				type: input.type,
				column_type: columnType,
				required: input.required ? 1 : 0,
				unique: input.unique ? 1 : 0,
				default_value: input.defaultValue !== void 0 ? JSON.stringify(input.defaultValue) : null,
				validation: input.validation ? JSON.stringify(input.validation) : null,
				widget: input.widget ?? null,
				options: input.options ? JSON.stringify(input.options) : null,
				sort_order: sortOrder,
				searchable: input.searchable ? 1 : 0,
				translatable: input.translatable === false ? 0 : 1
			}).execute();
			await this.addColumn(collectionSlug, input.slug, input.type, {
				required: input.required,
				defaultValue: input.defaultValue
			}, trx);
			const fieldRow = await trx.selectFrom("_emdash_fields").where("collection_id", "=", collection.id).where("slug", "=", input.slug).selectAll().executeTakeFirst();
			if (!fieldRow) throw new SchemaError("Failed to create field", "CREATE_FAILED");
			const field = this.mapFieldRow(fieldRow);
			if (input.searchable) await this.syncSearchState(collectionSlug, trx);
			return field;
		});
	}
	/**
	* Update a field
	*/
	async updateField(collectionSlug, fieldSlug, input) {
		const field = await this.getField(collectionSlug, fieldSlug);
		if (!field) throw new SchemaError(`Field "${fieldSlug}" not found in collection "${collectionSlug}"`, "FIELD_NOT_FOUND");
		const nextValidation = input.validation === void 0 ? field.validation : input.validation;
		return withTransaction(this.db, async (trx) => {
			await trx.updateTable("_emdash_fields").set({
				label: input.label ?? field.label,
				required: input.required !== void 0 ? input.required ? 1 : 0 : field.required ? 1 : 0,
				unique: input.unique !== void 0 ? input.unique ? 1 : 0 : field.unique ? 1 : 0,
				searchable: input.searchable !== void 0 ? input.searchable ? 1 : 0 : field.searchable ? 1 : 0,
				translatable: input.translatable !== void 0 ? input.translatable ? 1 : 0 : field.translatable ? 1 : 0,
				default_value: input.defaultValue !== void 0 ? JSON.stringify(input.defaultValue) : field.defaultValue !== void 0 ? JSON.stringify(field.defaultValue) : null,
				validation: nextValidation ? JSON.stringify(nextValidation) : null,
				widget: input.widget ?? field.widget ?? null,
				options: input.options ? JSON.stringify(input.options) : field.options ? JSON.stringify(field.options) : null,
				sort_order: input.sortOrder ?? field.sortOrder
			}).where("id", "=", field.id).execute();
			const updatedRow = await trx.selectFrom("_emdash_fields").where("collection_id", "=", field.collectionId).where("slug", "=", fieldSlug).selectAll().executeTakeFirst();
			if (!updatedRow) throw new SchemaError("Failed to update field", "UPDATE_FAILED");
			const updated = this.mapFieldRow(updatedRow);
			if (input.searchable !== void 0 && input.searchable !== field.searchable) await this.syncSearchState(collectionSlug, trx);
			return updated;
		});
	}
	/**
	* Synchronize an existing FTS index with the collection's current state.
	*
	* Only rebuilds or disables — never first-time enables. First-time FTS
	* enablement is handled by the seed's explicit enableSearch call (which
	* is try-caught) or the admin UI toggle.
	*
	* - FTS active + still has search support and searchable fields → rebuild
	* - FTS active + lost search support or no searchable fields    → disable
	* - FTS not active                                              → no-op
	*
	* Pass `db` when calling from within a transaction so FTS operations
	* participate in the same transaction and are rolled back on failure.
	*/
	async syncSearchState(collectionSlug, db) {
		const conn = db ?? this.db;
		const ftsManager = new FTSManager(conn);
		const row = await conn.selectFrom("_emdash_collections").where("slug", "=", collectionSlug).select("supports").executeTakeFirst();
		if (!row) return;
		const wantsSearch = parseSupports(row.supports).includes("search");
		const searchableFields = await ftsManager.getSearchableFields(collectionSlug);
		const config = await ftsManager.getSearchConfig(collectionSlug);
		const ftsActive = config?.enabled === true;
		if (wantsSearch && searchableFields.length > 0 && ftsActive) await ftsManager.rebuildIndex(collectionSlug, searchableFields, config?.weights);
		else if (ftsActive && (!wantsSearch || searchableFields.length === 0)) await ftsManager.disableSearch(collectionSlug);
	}
	/**
	* Delete a field
	*/
	async deleteField(collectionSlug, fieldSlug) {
		const field = await this.getField(collectionSlug, fieldSlug);
		if (!field) throw new SchemaError(`Field "${fieldSlug}" not found in collection "${collectionSlug}"`, "FIELD_NOT_FOUND");
		await withTransaction(this.db, async (trx) => {
			await trx.deleteFrom("_emdash_fields").where("id", "=", field.id).execute();
			if (field.searchable) await this.syncSearchState(collectionSlug, trx);
			await this.dropColumn(collectionSlug, fieldSlug, trx);
		});
	}
	/**
	* Reorder fields
	*/
	async reorderFields(collectionSlug, fieldSlugs) {
		const collection = await this.getCollection(collectionSlug);
		if (!collection) throw new SchemaError(`Collection "${collectionSlug}" not found`, "COLLECTION_NOT_FOUND");
		for (let i = 0; i < fieldSlugs.length; i++) await this.db.updateTable("_emdash_fields").set({ sort_order: i }).where("collection_id", "=", collection.id).where("slug", "=", fieldSlugs[i]).execute();
	}
	/**
	* Create a content table for a collection
	*/
	async createContentTable(slug, db) {
		const conn = db ?? this.db;
		const tableName = this.getTableName(slug);
		await conn.schema.createTable(tableName).addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text").addColumn("status", "text", (col) => col.defaultTo("draft")).addColumn("author_id", "text").addColumn("primary_byline_id", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(conn))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(conn))).addColumn("published_at", "text").addColumn("scheduled_at", "text").addColumn("deleted_at", "text").addColumn("version", "integer", (col) => col.defaultTo(1)).addColumn("live_revision_id", "text", (col) => col.references("revisions.id")).addColumn("draft_revision_id", "text", (col) => col.references("revisions.id")).addColumn("locale", "text", (col) => col.notNull().defaultTo("en")).addColumn("translation_group", "text").addUniqueConstraint(`${tableName}_slug_locale_unique`, ["slug", "locale"]).execute();
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_slug`)}
			ON ${sql.ref(tableName)} (slug)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_scheduled`)}
			ON ${sql.ref(tableName)} (scheduled_at)
			WHERE scheduled_at IS NOT NULL
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_live_revision`)}
			ON ${sql.ref(tableName)} (live_revision_id)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_draft_revision`)}
			ON ${sql.ref(tableName)} (draft_revision_id)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_author`)}
			ON ${sql.ref(tableName)} (author_id)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_primary_byline`)}
			ON ${sql.ref(tableName)} (primary_byline_id)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_locale`)}
			ON ${sql.ref(tableName)} (locale)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_translation_group`)}
			ON ${sql.ref(tableName)} (translation_group)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_deleted_updated_id`)}
			ON ${sql.ref(tableName)} (deleted_at, updated_at DESC, id DESC)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_deleted_status`)}
			ON ${sql.ref(tableName)} (deleted_at, status)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_deleted_created_id`)}
			ON ${sql.ref(tableName)} (deleted_at, created_at DESC, id DESC)
		`.execute(conn);
		await sql`
			CREATE INDEX ${sql.ref(`idx_${tableName}_deleted_published_id`)}
			ON ${sql.ref(tableName)} (deleted_at, published_at DESC, id DESC)
		`.execute(conn);
	}
	/**
	* Add a column to a content table
	*/
	async addColumn(collectionSlug, fieldSlug, fieldType, options, db) {
		const conn = db ?? this.db;
		const tableName = this.getTableName(collectionSlug);
		const columnType = FIELD_TYPE_TO_COLUMN[fieldType];
		const columnName = this.getColumnName(fieldSlug);
		if (options?.required && options?.defaultValue !== void 0) {
			const defaultVal = this.formatDefaultValue(options.defaultValue, fieldType);
			await sql`
				ALTER TABLE ${sql.ref(tableName)}
				ADD COLUMN ${sql.ref(columnName)} ${sql.raw(columnType)} NOT NULL DEFAULT ${sql.raw(defaultVal)}
			`.execute(conn);
		} else if (options?.required) {
			const defaultVal = this.getEmptyDefault(fieldType);
			await sql`
				ALTER TABLE ${sql.ref(tableName)}
				ADD COLUMN ${sql.ref(columnName)} ${sql.raw(columnType)} NOT NULL DEFAULT ${sql.raw(defaultVal)}
			`.execute(conn);
		} else await sql`
				ALTER TABLE ${sql.ref(tableName)}
				ADD COLUMN ${sql.ref(columnName)} ${sql.raw(columnType)}
			`.execute(conn);
	}
	/**
	* Drop a column from a content table
	*/
	async dropColumn(collectionSlug, fieldSlug, db) {
		const tableName = this.getTableName(collectionSlug);
		const columnName = this.getColumnName(fieldSlug);
		await sql`
			ALTER TABLE ${sql.ref(tableName)}
			DROP COLUMN ${sql.ref(columnName)}
		`.execute(db ?? this.db);
	}
	/**
	* Check if a collection has any content
	*/
	async collectionHasContent(slug) {
		const tableName = this.getTableName(slug);
		try {
			return ((await sql`
				SELECT COUNT(*) as count FROM ${sql.ref(tableName)}
				WHERE deleted_at IS NULL
			`.execute(this.db)).rows[0]?.count ?? 0) > 0;
		} catch {
			return false;
		}
	}
	/**
	* Get table name for a collection
	*/
	getTableName(slug) {
		validateIdentifier(slug, "collection slug");
		return `ec_${slug}`;
	}
	/**
	* Get column name for a field
	*/
	getColumnName(slug) {
		validateIdentifier(slug, "field slug");
		return slug;
	}
	/**
	* Validate a slug
	*/
	validateSlug(slug, type) {
		if (!slug || typeof slug !== "string") throw new SchemaError(`${type} slug is required`, "INVALID_SLUG");
		if (!SLUG_VALIDATION_PATTERN.test(slug)) throw new SchemaError(`${type} slug must start with a letter and contain only lowercase letters, numbers, and underscores`, "INVALID_SLUG");
		if (slug.length > 63) throw new SchemaError(`${type} slug must be 63 characters or less`, "INVALID_SLUG");
	}
	/**
	* Format a default value for SQL.
	*
	* SQLite `ALTER TABLE ADD COLUMN ... DEFAULT` requires a literal constant
	* expression — parameterized values cannot be used here. We manually escape
	* single quotes and coerce types to ensure the output is safe.
	*
	* INTEGER/REAL values are coerced through `Number()` which can only produce
	* digits, `.`, `-`, `e`, `Infinity`, or `NaN` — all safe in SQL.
	* TEXT/JSON values have single quotes escaped via SQL standard doubling (`''`).
	*/
	formatDefaultValue(value, fieldType) {
		if (value === null || value === void 0) return "NULL";
		const columnType = FIELD_TYPE_TO_COLUMN[fieldType];
		if (columnType === "JSON") return `'${JSON.stringify(value).replace(SINGLE_QUOTE_PATTERN, "''")}'`;
		if (columnType === "INTEGER") {
			if (typeof value === "boolean") return value ? "1" : "0";
			const num = Number(value);
			if (!Number.isFinite(num)) return "0";
			return String(Math.trunc(num));
		}
		if (columnType === "REAL") {
			const num = Number(value);
			if (!Number.isFinite(num)) return "0";
			return String(num);
		}
		let text;
		if (typeof value === "string") text = value;
		else if (typeof value === "number" || typeof value === "boolean") text = String(value);
		else if (typeof value === "object" && value !== null) text = JSON.stringify(value);
		else text = "";
		return `'${text.replace(SINGLE_QUOTE_PATTERN, "''")}'`;
	}
	/**
	* Get empty default for a field type
	*/
	getEmptyDefault(fieldType) {
		switch (FIELD_TYPE_TO_COLUMN[fieldType]) {
			case "INTEGER": return "0";
			case "REAL": return "0.0";
			case "JSON": return "'null'";
			default: return "''";
		}
	}
	/**
	* Map a collection row to a Collection object
	*/
	mapCollectionRow = (row) => {
		const moderation = row.comments_moderation;
		return {
			id: row.id,
			slug: row.slug,
			label: row.label,
			labelSingular: row.label_singular ?? void 0,
			description: row.description ?? void 0,
			icon: row.icon ?? void 0,
			supports: parseSupports(row.supports),
			source: row.source && isCollectionSource(row.source) ? row.source : void 0,
			hasSeo: row.has_seo === 1,
			urlPattern: row.url_pattern ?? void 0,
			commentsEnabled: row.comments_enabled === 1,
			commentsModeration: moderation === "all" || moderation === "first_time" || moderation === "none" ? moderation : "first_time",
			commentsClosedAfterDays: row.comments_closed_after_days ?? 90,
			commentsAutoApproveUsers: row.comments_auto_approve_users === 1,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		};
	};
	/**
	* Map a field row to a Field object
	*/
	mapFieldRow = (row) => {
		return {
			id: row.id,
			collectionId: row.collection_id,
			slug: row.slug,
			label: row.label,
			type: isFieldType(row.type) ? row.type : "string",
			columnType: isColumnType(row.column_type) ? row.column_type : "TEXT",
			required: row.required === 1,
			unique: row.unique === 1,
			defaultValue: row.default_value ? JSON.parse(row.default_value) : void 0,
			validation: row.validation ? JSON.parse(row.validation) : void 0,
			widget: row.widget ?? void 0,
			options: row.options ? JSON.parse(row.options) : void 0,
			sortOrder: row.sort_order,
			searchable: row.searchable === 1,
			translatable: row.translatable !== 0,
			createdAt: row.created_at
		};
	};
	/**
	* Discover orphaned content tables
	*
	* Finds ec_* tables that exist in the database but don't have a
	* corresponding entry in _emdash_collections.
	*/
	async discoverOrphanedTables() {
		const allTables = await listTablesLike(this.db, "ec_%");
		const registered = await this.listCollections();
		const registeredSlugs = new Set(registered.map((c) => c.slug));
		const orphans = [];
		for (const tableName of allTables) {
			const slug = tableName.replace(EC_PREFIX_PATTERN, "");
			if (!registeredSlugs.has(slug)) try {
				const countResult = await sql`
						SELECT COUNT(*) as count FROM ${sql.ref(tableName)}
						WHERE deleted_at IS NULL
					`.execute(this.db);
				orphans.push({
					slug,
					tableName,
					rowCount: countResult.rows[0]?.count ?? 0
				});
			} catch {
				orphans.push({
					slug,
					tableName,
					rowCount: 0
				});
			}
		}
		return orphans;
	}
	/**
	* Register an orphaned table as a collection
	*
	* Creates a _emdash_collections entry for an existing ec_* table.
	*/
	async registerOrphanedTable(slug, options) {
		const tableName = this.getTableName(slug);
		if (!await tableExists(this.db, tableName)) throw new SchemaError(`Table "${tableName}" does not exist`, "TABLE_NOT_FOUND");
		if (await this.getCollection(slug)) throw new SchemaError(`Collection "${slug}" is already registered`, "COLLECTION_EXISTS");
		const id = ulid();
		const label = options?.label || this.slugToLabel(slug);
		await this.db.insertInto("_emdash_collections").values({
			id,
			slug,
			label,
			label_singular: options?.labelSingular ?? null,
			description: options?.description ?? null,
			icon: null,
			supports: JSON.stringify([]),
			source: "discovered",
			has_seo: 0,
			url_pattern: null
		}).execute();
		const collection = await this.getCollection(slug);
		if (!collection) throw new SchemaError("Failed to register orphaned table", "REGISTER_FAILED");
		return collection;
	}
	/**
	* Convert slug to human-readable label
	*/
	slugToLabel(slug) {
		return slug.replace(UNDERSCORE_PATTERN, " ").replace(WORD_BOUNDARY_PATTERN, (c) => c.toUpperCase());
	}
};

const registryDo34mz_P = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	i: FTSManager,
	n: SchemaRegistry,
	r: registry_exports,
	t: SchemaError
}, Symbol.toStringTag, { value: 'Module' }));

//#region src/plugins/manifest-schema.ts
/**
* Zod schema for PluginManifest validation
*
* Used to validate manifest.json from plugin bundles at every parse site:
* - Client-side download (marketplace.ts extractBundle)
* - R2 load (api/handlers/marketplace.ts loadBundleFromR2)
* - CLI publish preview (cli/commands/publish.ts readManifestFromTarball)
* - Marketplace ingest extends this with publishing-specific fields
*/
/**
* Current capability names — the ones authors should use going forward.
* See `PluginCapability` in `types.ts` for documentation of each.
*/
const CURRENT_PLUGIN_CAPABILITIES = [
	"network:request",
	"network:request:unrestricted",
	"content:read",
	"content:write",
	"media:read",
	"media:write",
	"users:read",
	"email:send",
	"hooks.email-transport:register",
	"hooks.email-events:register",
	"hooks.page-fragments:register"
];
/**
* Legacy capability names accepted during the deprecation window.
* Normalized to current names via `normalizeCapability()` in types.ts
* before reaching the runtime. Plugin authors are warned at bundle/validate
* and hard-failed at publish.
*/
const DEPRECATED_PLUGIN_CAPABILITIES = [
	"network:fetch",
	"network:fetch:any",
	"read:content",
	"write:content",
	"read:media",
	"write:media",
	"read:users",
	"email:provide",
	"email:intercept",
	"page:inject"
];
/**
* Full set of accepted capability strings — current + deprecated.
*
* The manifest schema accepts both during the transition. The runtime only
* ever sees current names because `normalizeCapability()` rewrites legacy
* names at every external boundary (definePlugin, adaptSandboxEntry).
*/
const PLUGIN_CAPABILITIES = [...CURRENT_PLUGIN_CAPABILITIES, ...DEPRECATED_PLUGIN_CAPABILITIES];
/** Must stay in sync with FieldType in schema/types.ts */
const FIELD_TYPES = [
	"string",
	"text",
	"number",
	"integer",
	"boolean",
	"datetime",
	"select",
	"multiSelect",
	"portableText",
	"image",
	"file",
	"reference",
	"json",
	"slug",
	"repeater"
];
const HOOK_NAMES = [
	"plugin:install",
	"plugin:activate",
	"plugin:deactivate",
	"plugin:uninstall",
	"content:beforeSave",
	"content:afterSave",
	"content:beforeDelete",
	"content:afterDelete",
	"content:afterPublish",
	"content:afterUnpublish",
	"media:beforeUpload",
	"media:afterUpload",
	"cron",
	"email:beforeSend",
	"email:deliver",
	"email:afterSend",
	"comment:beforeCreate",
	"comment:moderate",
	"comment:afterCreate",
	"comment:afterModerate",
	"page:metadata",
	"page:fragments"
];
/**
* Structured hook entry for manifest — name plus optional metadata.
* During a transition period, both plain strings and objects are accepted.
*/
const manifestHookEntrySchema = z$1.object({
	name: z$1.enum(HOOK_NAMES),
	exclusive: z$1.boolean().optional(),
	priority: z$1.number().int().optional(),
	timeout: z$1.number().int().positive().optional()
});
/**
* Structured route entry for manifest — name plus optional metadata.
* Both plain strings and objects are accepted; strings are normalized
* to `{ name }` objects via `normalizeManifestRoute()`.
*/
/** Route names must be safe path segments — alphanumeric, hyphens, underscores, forward slashes */
const routeNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_\-/]*$/;
const manifestRouteEntrySchema = z$1.object({
	name: z$1.string().min(1).regex(routeNamePattern, "Route name must be a safe path segment"),
	public: z$1.boolean().optional()
});
/** Index field names must be valid identifiers to prevent SQL injection via JSON path expressions */
const indexFieldName = z$1.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/);
const storageCollectionSchema = z$1.object({
	indexes: z$1.array(z$1.union([indexFieldName, z$1.array(indexFieldName)])),
	uniqueIndexes: z$1.array(z$1.union([indexFieldName, z$1.array(indexFieldName)])).optional()
});
const baseSettingFields = {
	label: z$1.string(),
	description: z$1.string().optional()
};
const settingFieldSchema = z$1.discriminatedUnion("type", [
	z$1.object({
		...baseSettingFields,
		type: z$1.literal("string"),
		default: z$1.string().optional(),
		multiline: z$1.boolean().optional()
	}),
	z$1.object({
		...baseSettingFields,
		type: z$1.literal("number"),
		default: z$1.number().optional(),
		min: z$1.number().optional(),
		max: z$1.number().optional()
	}),
	z$1.object({
		...baseSettingFields,
		type: z$1.literal("boolean"),
		default: z$1.boolean().optional()
	}),
	z$1.object({
		...baseSettingFields,
		type: z$1.literal("select"),
		options: z$1.array(z$1.object({
			value: z$1.string(),
			label: z$1.string()
		})),
		default: z$1.string().optional()
	}),
	z$1.object({
		...baseSettingFields,
		type: z$1.literal("secret")
	}),
	z$1.object({
		...baseSettingFields,
		type: z$1.literal("url"),
		default: z$1.string().optional(),
		placeholder: z$1.string().optional()
	}),
	z$1.object({
		...baseSettingFields,
		type: z$1.literal("email"),
		default: z$1.string().optional(),
		placeholder: z$1.string().optional()
	})
]);
const adminPageSchema = z$1.object({
	path: z$1.string(),
	label: z$1.string(),
	icon: z$1.string().optional()
});
const dashboardWidgetSchema = z$1.object({
	id: z$1.string(),
	size: z$1.enum([
		"full",
		"half",
		"third"
	]).optional(),
	title: z$1.string().optional()
});
const pluginAdminConfigSchema = z$1.object({
	entry: z$1.string().optional(),
	settingsSchema: z$1.record(z$1.string(), settingFieldSchema).optional(),
	pages: z$1.array(adminPageSchema).optional(),
	widgets: z$1.array(dashboardWidgetSchema).optional(),
	fieldWidgets: z$1.array(z$1.object({
		name: z$1.string().min(1),
		label: z$1.string().min(1),
		fieldTypes: z$1.array(z$1.enum(FIELD_TYPES)),
		elements: z$1.array(z$1.object({
			type: z$1.string(),
			action_id: z$1.string(),
			label: z$1.string().optional()
		}).passthrough()).optional()
	})).optional()
});
/**
* Zod schema matching the PluginManifest interface from types.ts.
*
* Every JSON.parse of a manifest.json should validate through this.
*/
const pluginManifestSchema = z$1.object({
	id: z$1.string().min(1),
	version: z$1.string().min(1),
	capabilities: z$1.array(z$1.enum(PLUGIN_CAPABILITIES)),
	allowedHosts: z$1.array(z$1.string()),
	storage: z$1.record(z$1.string(), storageCollectionSchema),
	hooks: z$1.array(z$1.union([z$1.enum(HOOK_NAMES), manifestHookEntrySchema])),
	routes: z$1.array(z$1.union([z$1.string().min(1).regex(routeNamePattern, "Route name must be a safe path segment"), manifestRouteEntrySchema])),
	admin: pluginAdminConfigSchema
});
/**
* Normalize a manifest route entry — plain strings become `{ name }` objects.
*/
function normalizeManifestRoute(entry) {
	if (typeof entry === "string") return { name: entry };
	return entry;
}

//#region src/database/repositories/taxonomy.ts
var taxonomy_exports = /* @__PURE__ */ __exportAll({ TaxonomyRepository: () => TaxonomyRepository });
/**
* Taxonomy repository for categories, tags, and other classification.
*
* Terms are per-locale. Translations of the same term share a `translation_group`
* ULID. `content_taxonomies.taxonomy_id` stores the translation_group so a single
* association spans every locale of a post.
*
* The repository does not resolve locale fallbacks on its own — callers supply
* the locale they want. Runtime helpers and handlers use `getFallbackChain()`
* from `i18n/config` when they need fallback behaviour.
*/
var TaxonomyRepository = class {
	constructor(db) {
		this.db = db;
	}
	/**
	* Create a new taxonomy term. When `translationOf` is set the new row joins
	* the source term's translation_group; otherwise a fresh group is minted
	* (matching the migration backfill pattern `translation_group = id`).
	*/
	async create(input) {
		const id = ulid();
		const parentId = input.parentId === void 0 || input.parentId === "" ? null : input.parentId;
		let translationGroup = id;
		if (input.translationOf) {
			const source = await this.findById(input.translationOf);
			if (source?.translationGroup) translationGroup = source.translationGroup;
		}
		await this.db.insertInto("taxonomies").values({
			id,
			name: input.name,
			slug: input.slug,
			label: input.label,
			parent_id: parentId,
			data: input.data ? JSON.stringify(input.data) : null,
			...input.locale !== void 0 ? { locale: input.locale } : {},
			translation_group: translationGroup
		}).execute();
		const taxonomy = await this.findById(id);
		if (!taxonomy) throw new Error("Failed to create taxonomy");
		return taxonomy;
	}
	async findById(id) {
		const row = await this.db.selectFrom("taxonomies").selectAll().where("id", "=", id).executeTakeFirst();
		return row ? this.rowToTaxonomy(row) : null;
	}
	/**
	* Find a term by (name, slug). When `locale` is provided, filter by it.
	* When omitted, returns the lowest-locale-code match (deterministic across
	* calls). Mirrors `ContentRepository.findBySlug`.
	*/
	async findBySlug(name, slug, locale) {
		let query = this.db.selectFrom("taxonomies").selectAll().where("name", "=", name).where("slug", "=", slug);
		if (locale !== void 0) query = query.where("locale", "=", locale);
		const row = await query.orderBy("locale", "asc").executeTakeFirst();
		return row ? this.rowToTaxonomy(row) : null;
	}
	/**
	* Get all terms for a taxonomy (e.g., all categories).
	*
	* `id asc` is a stable tiebreaker for terms that share a label. Without it
	* the SQL ordering is implementation-defined when labels match, which
	* breaks keyset pagination over `(label, id)`.
	*/
	async findByName(name, options = {}) {
		let query = this.db.selectFrom("taxonomies").selectAll().where("name", "=", name).orderBy("label", "asc").orderBy("id", "asc");
		if (options.locale !== void 0) query = query.where("locale", "=", options.locale);
		if (options.parentId !== void 0) if (options.parentId === null) query = query.where("parent_id", "is", null);
		else query = query.where("parent_id", "=", options.parentId);
		return (await query.execute()).map((row) => this.rowToTaxonomy(row));
	}
	async findChildren(parentId) {
		return (await this.db.selectFrom("taxonomies").selectAll().where("parent_id", "=", parentId).orderBy("label", "asc").orderBy("id", "asc").execute()).map((row) => this.rowToTaxonomy(row));
	}
	/**
	* Every translation sibling of a term (including itself), identified by
	* their shared `translation_group`.
	*/
	async findTranslations(translationGroup) {
		return (await this.db.selectFrom("taxonomies").selectAll().where("translation_group", "=", translationGroup).orderBy("locale", "asc").execute()).map((row) => this.rowToTaxonomy(row));
	}
	async update(id, input) {
		if (!await this.findById(id)) return null;
		const updates = {};
		if (input.slug !== void 0) updates.slug = input.slug;
		if (input.label !== void 0) updates.label = input.label;
		if (input.parentId !== void 0) updates.parent_id = input.parentId === "" ? null : input.parentId;
		if (input.data !== void 0) updates.data = JSON.stringify(input.data);
		if (Object.keys(updates).length > 0) await this.db.updateTable("taxonomies").set(updates).where("id", "=", id).execute();
		return this.findById(id);
	}
	async delete(id) {
		const term = await this.findById(id);
		if (!term) return false;
		if (term.translationGroup) {
			if ((await this.db.selectFrom("taxonomies").select("id").where("translation_group", "=", term.translationGroup).where("id", "!=", id).execute()).length === 0) await this.db.deleteFrom("content_taxonomies").where("taxonomy_id", "=", term.translationGroup).execute();
		}
		return ((await this.db.deleteFrom("taxonomies").where("id", "=", id).executeTakeFirst()).numDeletedRows ?? 0n) > 0n;
	}
	async attachToEntry(collection, entryId, taxonomyId) {
		const group = await this.resolveTranslationGroup(taxonomyId);
		if (!group) return;
		const row = {
			collection,
			entry_id: entryId,
			taxonomy_id: group
		};
		await this.db.insertInto("content_taxonomies").values(row).onConflict((oc) => oc.doNothing()).execute();
	}
	async detachFromEntry(collection, entryId, taxonomyId) {
		const group = await this.resolveTranslationGroup(taxonomyId);
		if (!group) return;
		await this.db.deleteFrom("content_taxonomies").where("collection", "=", collection).where("entry_id", "=", entryId).where("taxonomy_id", "=", group).execute();
	}
	/**
	* Taxonomy terms assigned to a content entry, resolved into a specific locale.
	* Terms whose translation_group lacks a row in the requested locale are
	* omitted — callers wanting fallback behaviour apply it themselves.
	*/
	async getTermsForEntry(collection, entryId, taxonomyName, locale) {
		let query = this.db.selectFrom("content_taxonomies").innerJoin("taxonomies", "taxonomies.translation_group", "content_taxonomies.taxonomy_id").selectAll("taxonomies").where("content_taxonomies.collection", "=", collection).where("content_taxonomies.entry_id", "=", entryId);
		if (taxonomyName) query = query.where("taxonomies.name", "=", taxonomyName);
		if (locale !== void 0) query = query.where("taxonomies.locale", "=", locale);
		return (await query.orderBy("taxonomies.locale", "asc").execute()).map((row) => this.rowToTaxonomy(row));
	}
	/**
	* Replace all assignments of a given taxonomy for one content entry.
	* Term ids OR translation_groups are accepted and normalised to groups.
	*/
	async setTermsForEntry(collection, entryId, taxonomyName, termIds) {
		const groups = [];
		for (const id of termIds) {
			const group = await this.resolveTranslationGroup(id);
			if (group) groups.push(group);
		}
		const newGroups = new Set(groups);
		const current = await this.db.selectFrom("content_taxonomies").innerJoin("taxonomies", "taxonomies.translation_group", "content_taxonomies.taxonomy_id").select(["content_taxonomies.taxonomy_id as group"]).distinct().where("content_taxonomies.collection", "=", collection).where("content_taxonomies.entry_id", "=", entryId).where("taxonomies.name", "=", taxonomyName).execute();
		const currentGroups = new Set(current.map((r) => r.group));
		const toRemove = [...currentGroups].filter((g) => !newGroups.has(g));
		if (toRemove.length > 0) await this.db.deleteFrom("content_taxonomies").where("collection", "=", collection).where("entry_id", "=", entryId).where("taxonomy_id", "in", toRemove).execute();
		const toAdd = [...newGroups].filter((g) => !currentGroups.has(g));
		if (toAdd.length > 0) await this.db.insertInto("content_taxonomies").values(toAdd.map((taxonomy_id) => ({
			collection,
			entry_id: entryId,
			taxonomy_id
		}))).onConflict((oc) => oc.doNothing()).execute();
	}
	async clearEntryTerms(collection, entryId) {
		const result = await this.db.deleteFrom("content_taxonomies").where("collection", "=", collection).where("entry_id", "=", entryId).executeTakeFirst();
		return Number(result.numDeletedRows ?? 0);
	}
	/**
	* Copy every term assignment from one content entry to another. Used when
	* creating a translation of a post so the new translation inherits the
	* source's term assignments. Safe to call when the source has no terms.
	*/
	async copyEntryTerms(collection, sourceEntryId, targetEntryId) {
		const rows = await this.db.selectFrom("content_taxonomies").select(["taxonomy_id"]).where("collection", "=", collection).where("entry_id", "=", sourceEntryId).execute();
		if (rows.length === 0) return;
		await this.db.insertInto("content_taxonomies").values(rows.map((r) => ({
			collection,
			entry_id: targetEntryId,
			taxonomy_id: r.taxonomy_id
		}))).onConflict((oc) => oc.doNothing()).execute();
	}
	/**
	* Count content entries that use any translation of this term. Accepts
	* either a term id or a translation_group — we normalise to the group.
	*/
	async countEntriesWithTerm(termIdOrGroup) {
		const group = await this.resolveTranslationGroup(termIdOrGroup);
		if (!group) return 0;
		const result = await this.db.selectFrom("content_taxonomies").select((eb) => eb.fn.count("entry_id").as("count")).where("taxonomy_id", "=", group).executeTakeFirst();
		return Number(result?.count ?? 0);
	}
	async resolveTranslationGroup(idOrGroup) {
		return (await this.db.selectFrom("taxonomies").select(["translation_group"]).where((eb) => eb.or([eb("id", "=", idOrGroup), eb("translation_group", "=", idOrGroup)])).executeTakeFirst())?.translation_group ?? null;
	}
	/**
	* Batch count entries for multiple taxonomy translation_groups.
	* Chunks the query at SQL_BATCH_SIZE to stay below D1's bind-parameter limit.
	* Returns a Map from translation_group to count.
	*
	* Pass translation_groups (not term ids) — `content_taxonomies.taxonomy_id`
	* stores the translation_group so a single assignment spans every locale.
	*/
	async countEntriesForTerms(translationGroups) {
		if (translationGroups.length === 0) return /* @__PURE__ */ new Map();
		const { chunks, SQL_BATCH_SIZE } = await Promise.resolve().then(() => chunksBK1oZSL).then((n) => n.r);
		const counts = /* @__PURE__ */ new Map();
		for (const chunk of chunks(translationGroups, SQL_BATCH_SIZE)) {
			const rows = await this.db.selectFrom("content_taxonomies").select(["taxonomy_id", (eb) => eb.fn.count("entry_id").as("count")]).where("taxonomy_id", "in", chunk).groupBy("taxonomy_id").execute();
			for (const row of rows) counts.set(row.taxonomy_id, Number(row.count || 0));
		}
		return counts;
	}
	rowToTaxonomy(row) {
		return {
			id: row.id,
			name: row.name,
			slug: row.slug,
			label: row.label,
			parentId: row.parent_id,
			data: row.data ? JSON.parse(row.data) : null,
			locale: row.locale,
			translationGroup: row.translation_group
		};
	}
};

const taxonomyD6NvlKo8 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	n: taxonomy_exports,
	t: TaxonomyRepository
}, Symbol.toStringTag, { value: 'Module' }));

//#region src/seed/validate.ts
/**
* Seed file validation
*
* Validates a seed file structure before applying it.
*/
var validate_exports = /* @__PURE__ */ __exportAll({ validateSeed: () => validateSeed });
const COLLECTION_FIELD_SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const REDIRECT_TYPES = new Set([
	301,
	302,
	307,
	308
]);
const CRLF_PATTERN = /[\r\n]/;
/** Type guard for Record<string, unknown> */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isValidRedirectPath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || CRLF_PATTERN.test(path)) return false;
	try {
		return !decodeURIComponent(path).split("/").includes("..");
	} catch {
		return false;
	}
}
/**
* Validate a seed file
*
* @param data - Unknown data to validate as a seed file
* @returns Validation result with errors and warnings
*/
function validateSeed(data) {
	const errors = [];
	const warnings = [];
	if (!data || typeof data !== "object") return {
		valid: false,
		errors: ["Seed must be an object"],
		warnings: []
	};
	const seed = data;
	if (!seed.version) errors.push("Seed must have a version field");
	else if (seed.version !== "1") errors.push(`Unsupported seed version: ${String(seed.version)}`);
	if (seed.collections) if (!Array.isArray(seed.collections)) errors.push("collections must be an array");
	else {
		const collectionSlugs = /* @__PURE__ */ new Set();
		for (let i = 0; i < seed.collections.length; i++) {
			const collection = seed.collections[i];
			const prefix = `collections[${i}]`;
			if (!collection.slug) errors.push(`${prefix}: slug is required`);
			else {
				if (!COLLECTION_FIELD_SLUG_PATTERN.test(collection.slug)) errors.push(`${prefix}.slug: must start with a letter and contain only lowercase letters, numbers, and underscores`);
				if (collectionSlugs.has(collection.slug)) errors.push(`${prefix}.slug: duplicate collection slug "${collection.slug}"`);
				collectionSlugs.add(collection.slug);
			}
			if (!collection.label) errors.push(`${prefix}: label is required`);
			if (!Array.isArray(collection.fields)) errors.push(`${prefix}.fields: must be an array`);
			else {
				const fieldSlugs = /* @__PURE__ */ new Set();
				for (let j = 0; j < collection.fields.length; j++) {
					const field = collection.fields[j];
					const fieldPrefix = `${prefix}.fields[${j}]`;
					if (!field.slug) errors.push(`${fieldPrefix}: slug is required`);
					else {
						if (!COLLECTION_FIELD_SLUG_PATTERN.test(field.slug)) errors.push(`${fieldPrefix}.slug: must start with a letter and contain only lowercase letters, numbers, and underscores`);
						if (fieldSlugs.has(field.slug)) errors.push(`${fieldPrefix}.slug: duplicate field slug "${field.slug}" in collection "${collection.slug}"`);
						fieldSlugs.add(field.slug);
					}
					if (!field.label) errors.push(`${fieldPrefix}: label is required`);
					if (!field.type) errors.push(`${fieldPrefix}: type is required`);
					else if (!FIELD_TYPES$1.includes(field.type)) errors.push(`${fieldPrefix}.type: unsupported field type "${field.type}"`);
				}
			}
		}
	}
	if (seed.taxonomies) if (!Array.isArray(seed.taxonomies)) errors.push("taxonomies must be an array");
	else {
		const taxonomyNames = /* @__PURE__ */ new Set();
		for (let i = 0; i < seed.taxonomies.length; i++) {
			const taxonomy = seed.taxonomies[i];
			const prefix = `taxonomies[${i}]`;
			if (!taxonomy.name) errors.push(`${prefix}: name is required`);
			else {
				const key = `${taxonomy.name}::${taxonomy.locale ?? ""}`;
				if (taxonomyNames.has(key)) errors.push(taxonomy.locale ? `${prefix}.name: duplicate taxonomy "${taxonomy.name}" in locale "${taxonomy.locale}"` : `${prefix}.name: duplicate taxonomy name "${taxonomy.name}"`);
				taxonomyNames.add(key);
			}
			if (!taxonomy.label) errors.push(`${prefix}: label is required`);
			if (taxonomy.hierarchical === void 0) errors.push(`${prefix}: hierarchical is required`);
			if (!Array.isArray(taxonomy.collections)) errors.push(`${prefix}.collections: must be an array`);
			else if (taxonomy.collections.length === 0) warnings.push(`${prefix}.collections: taxonomy "${taxonomy.name}" is not assigned to any collections`);
			if (taxonomy.terms) if (!Array.isArray(taxonomy.terms)) errors.push(`${prefix}.terms: must be an array`);
			else {
				const termSlugs = /* @__PURE__ */ new Set();
				for (let j = 0; j < taxonomy.terms.length; j++) {
					const term = taxonomy.terms[j];
					const termPrefix = `${prefix}.terms[${j}]`;
					if (!term.slug) errors.push(`${termPrefix}: slug is required`);
					else {
						const key = `${term.slug}::${term.locale ?? taxonomy.locale ?? ""}`;
						if (termSlugs.has(key)) errors.push(`${termPrefix}.slug: duplicate term slug "${term.slug}" in taxonomy "${taxonomy.name}"`);
						termSlugs.add(key);
					}
					if (!term.label) errors.push(`${termPrefix}: label is required`);
					if (term.parent && taxonomy.hierarchical) ; else if (term.parent && !taxonomy.hierarchical) warnings.push(`${termPrefix}.parent: taxonomy "${taxonomy.name}" is not hierarchical, parent will be ignored`);
				}
				if (taxonomy.hierarchical && taxonomy.terms) for (let j = 0; j < taxonomy.terms.length; j++) {
					const term = taxonomy.terms[j];
					const termLocale = term.locale ?? taxonomy.locale ?? "";
					if (term.parent && !termSlugs.has(`${term.parent}::${termLocale}`)) errors.push(`${prefix}.terms[${j}].parent: parent term "${term.parent}" not found in taxonomy`);
					if (term.parent === term.slug) errors.push(`${prefix}.terms[${j}].parent: term cannot be its own parent`);
				}
			}
		}
	}
	if (seed.menus) if (!Array.isArray(seed.menus)) errors.push("menus must be an array");
	else {
		const menuNames = /* @__PURE__ */ new Set();
		for (let i = 0; i < seed.menus.length; i++) {
			const menu = seed.menus[i];
			const prefix = `menus[${i}]`;
			if (!menu.name) errors.push(`${prefix}: name is required`);
			else {
				const key = `${menu.name}::${menu.locale ?? ""}`;
				if (menuNames.has(key)) errors.push(menu.locale ? `${prefix}.name: duplicate menu "${menu.name}" in locale "${menu.locale}"` : `${prefix}.name: duplicate menu name "${menu.name}"`);
				menuNames.add(key);
			}
			if (!menu.label) errors.push(`${prefix}: label is required`);
			if (!Array.isArray(menu.items)) errors.push(`${prefix}.items: must be an array`);
			else validateMenuItems(menu.items, prefix, errors);
		}
	}
	if (seed.redirects) if (!Array.isArray(seed.redirects)) errors.push("redirects must be an array");
	else {
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
			if (!source) errors.push(`${prefix}: source is required`);
			else {
				if (!isValidRedirectPath(source)) errors.push(`${prefix}.source: must be a path starting with / (no protocol-relative URLs, path traversal, or newlines)`);
				if (redirectSources.has(source)) errors.push(`${prefix}.source: duplicate redirect source "${source}"`);
				redirectSources.add(source);
			}
			if (!destination) errors.push(`${prefix}: destination is required`);
			else if (!isValidRedirectPath(destination)) errors.push(`${prefix}.destination: must be a path starting with / (no protocol-relative URLs, path traversal, or newlines)`);
			if (redirect.type !== void 0) {
				if (typeof redirect.type !== "number" || !REDIRECT_TYPES.has(redirect.type)) errors.push(`${prefix}.type: must be 301, 302, 307, or 308`);
			}
			if (redirect.enabled !== void 0 && typeof redirect.enabled !== "boolean") errors.push(`${prefix}.enabled: must be a boolean`);
			if (redirect.groupName !== void 0 && typeof redirect.groupName !== "string" && redirect.groupName !== null) errors.push(`${prefix}.groupName: must be a string or null`);
		}
	}
	if (seed.widgetAreas) if (!Array.isArray(seed.widgetAreas)) errors.push("widgetAreas must be an array");
	else {
		const areaNames = /* @__PURE__ */ new Set();
		for (let i = 0; i < seed.widgetAreas.length; i++) {
			const area = seed.widgetAreas[i];
			const prefix = `widgetAreas[${i}]`;
			if (!area.name) errors.push(`${prefix}: name is required`);
			else {
				if (areaNames.has(area.name)) errors.push(`${prefix}.name: duplicate widget area name "${area.name}"`);
				areaNames.add(area.name);
			}
			if (!area.label) errors.push(`${prefix}: label is required`);
			if (!Array.isArray(area.widgets)) errors.push(`${prefix}.widgets: must be an array`);
			else for (let j = 0; j < area.widgets.length; j++) {
				const widget = area.widgets[j];
				const widgetPrefix = `${prefix}.widgets[${j}]`;
				if (!widget.type) errors.push(`${widgetPrefix}: type is required`);
				else if (![
					"content",
					"menu",
					"component"
				].includes(widget.type)) errors.push(`${widgetPrefix}.type: must be "content", "menu", or "component"`);
				if (widget.type === "menu" && !widget.menuName) errors.push(`${widgetPrefix}: menuName is required for menu widgets`);
				if (widget.type === "component" && !widget.componentId) errors.push(`${widgetPrefix}: componentId is required for component widgets`);
			}
		}
	}
	if (seed.sections) if (!Array.isArray(seed.sections)) errors.push("sections must be an array");
	else {
		const sectionSlugs = /* @__PURE__ */ new Set();
		for (let i = 0; i < seed.sections.length; i++) {
			const section = seed.sections[i];
			const prefix = `sections[${i}]`;
			if (!section.slug) errors.push(`${prefix}: slug is required`);
			else {
				if (!SLUG_PATTERN.test(section.slug)) errors.push(`${prefix}.slug: must contain only lowercase letters, numbers, and hyphens`);
				if (sectionSlugs.has(section.slug)) errors.push(`${prefix}.slug: duplicate section slug "${section.slug}"`);
				sectionSlugs.add(section.slug);
			}
			if (!section.title) errors.push(`${prefix}: title is required`);
			if (!Array.isArray(section.content)) errors.push(`${prefix}.content: must be an array`);
			if (section.source && !["theme", "import"].includes(section.source)) errors.push(`${prefix}.source: must be "theme" or "import"`);
		}
	}
	if (seed.bylines) if (!Array.isArray(seed.bylines)) errors.push("bylines must be an array");
	else {
		const bylineIds = /* @__PURE__ */ new Set();
		const bylineSlugs = /* @__PURE__ */ new Set();
		for (let i = 0; i < seed.bylines.length; i++) {
			const byline = seed.bylines[i];
			const prefix = `bylines[${i}]`;
			if (!byline.id) errors.push(`${prefix}: id is required`);
			else {
				if (bylineIds.has(byline.id)) errors.push(`${prefix}.id: duplicate byline id "${byline.id}"`);
				bylineIds.add(byline.id);
			}
			if (!byline.slug) errors.push(`${prefix}: slug is required`);
			else {
				if (!SLUG_PATTERN.test(byline.slug)) errors.push(`${prefix}.slug: must contain only lowercase letters, numbers, and hyphens`);
				if (bylineSlugs.has(byline.slug)) errors.push(`${prefix}.slug: duplicate byline slug "${byline.slug}"`);
				bylineSlugs.add(byline.slug);
			}
			if (!byline.displayName) errors.push(`${prefix}: displayName is required`);
		}
	}
	if (seed.content) if (typeof seed.content !== "object" || Array.isArray(seed.content)) errors.push("content must be an object (collection -> entries)");
	else for (const [collectionSlug, entries] of Object.entries(seed.content)) {
		if (!Array.isArray(entries)) {
			errors.push(`content.${collectionSlug}: must be an array`);
			continue;
		}
		const entryIds = /* @__PURE__ */ new Set();
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const prefix = `content.${collectionSlug}[${i}]`;
			if (!entry.id) errors.push(`${prefix}: id is required`);
			else {
				if (entryIds.has(entry.id)) errors.push(`${prefix}.id: duplicate entry id "${entry.id}" in collection "${collectionSlug}"`);
				entryIds.add(entry.id);
			}
			if (!entry.slug) errors.push(`${prefix}: slug is required`);
			if (!entry.data || typeof entry.data !== "object") errors.push(`${prefix}: data must be an object`);
			if (entry.translationOf) {
				if (!entry.locale) errors.push(`${prefix}: locale is required when translationOf is set`);
			}
		}
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (entry.translationOf && !entryIds.has(entry.translationOf)) errors.push(`content.${collectionSlug}[${i}].translationOf: references "${entry.translationOf}" which is not in this collection`);
		}
	}
	if (seed.menus && seed.content) {
		const allContentIds = /* @__PURE__ */ new Set();
		for (const entries of Object.values(seed.content)) if (Array.isArray(entries)) {
			for (const entry of entries) if (entry.id) allContentIds.add(entry.id);
		}
		for (const menu of seed.menus) if (Array.isArray(menu.items)) validateMenuItemRefs(menu.items, allContentIds, warnings);
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
					if (!seedBylineIds.has(credit.byline)) errors.push(`${prefix}.byline: references unknown byline "${credit.byline}"`);
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
/**
* Validate menu items recursively
*/
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
		if (!itemType) errors.push(`${itemPrefix}: type is required`);
		else if (![
			"custom",
			"page",
			"post",
			"taxonomy",
			"collection"
		].includes(itemType)) errors.push(`${itemPrefix}.type: must be "custom", "page", "post", "taxonomy", or "collection"`);
		if (itemType === "custom" && !item.url) errors.push(`${itemPrefix}: url is required for custom menu items`);
		if ((itemType === "page" || itemType === "post") && !item.ref) errors.push(`${itemPrefix}: ref is required for page/post menu items`);
		if (Array.isArray(item.children)) validateMenuItems(item.children, itemPrefix, errors);
	}
}
/**
* Validate menu item references exist in content
*/
function validateMenuItemRefs(items, contentIds, warnings) {
	for (const item of items) {
		if ((item.type === "page" || item.type === "post") && item.ref) {
			if (!contentIds.has(item.ref)) warnings.push(`Menu item references content "${item.ref}" which is not in the seed file`);
		}
		if (item.children) validateMenuItemRefs(item.children, contentIds, warnings);
	}
}

const validateUK4Ja1uo = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	n: validate_exports,
	t: validateSeed
}, Symbol.toStringTag, { value: 'Module' }));

//#region src/import/ssrf.ts
/**
* SSRF protection for import URLs.
*
* Validates that URLs don't target internal/private network addresses.
* Applied before any fetch() call in the import pipeline.
*/
const IPV4_MAPPED_IPV6_DOTTED_PATTERN = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
const IPV4_MAPPED_IPV6_HEX_PATTERN = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
const IPV4_TRANSLATED_HEX_PATTERN = /^::ffff:0:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
const IPV6_EXPANDED_MAPPED_PATTERN = /^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
/**
* IPv4-compatible (deprecated) addresses: ::XXXX:XXXX
*
* The WHATWG URL parser normalizes [::127.0.0.1] to [::7f00:1] (no ffff prefix).
* These are deprecated but still parsed, and bypass the ffff-based checks.
*/
const IPV4_COMPATIBLE_HEX_PATTERN = /^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
/**
* NAT64 prefix (RFC 6052): 64:ff9b::XXXX:XXXX
*
* Used by NAT64 gateways to embed IPv4 addresses in IPv6.
* [64:ff9b::127.0.0.1] normalizes to [64:ff9b::7f00:1].
*/
const NAT64_HEX_PATTERN = /^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
const IPV6_BRACKET_PATTERN = /^\[|\]$/g;
/** Match fc00::/7 ULA — first byte 0xfc or 0xfd followed by any byte. */
const IPV6_ULA_FC_PATTERN = /^fc[0-9a-f]{2}:/;
const IPV6_ULA_FD_PATTERN = /^fd[0-9a-f]{2}:/;
/** Strip trailing dots from an FQDN-form hostname ("localhost." -> "localhost"). */
const TRAILING_DOT_PATTERN = /\.+$/;
/**
* Private and reserved IP ranges that should never be fetched.
*
* Includes:
* - Loopback (127.0.0.0/8)
* - Private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
* - Link-local (169.254.0.0/16)
* - Cloud metadata (169.254.169.254 — AWS/GCP/Azure)
* - IPv6 loopback and link-local
*/
const BLOCKED_PATTERNS = [
	{
		start: ip4ToNum(127, 0, 0, 0),
		end: ip4ToNum(127, 255, 255, 255)
	},
	{
		start: ip4ToNum(10, 0, 0, 0),
		end: ip4ToNum(10, 255, 255, 255)
	},
	{
		start: ip4ToNum(172, 16, 0, 0),
		end: ip4ToNum(172, 31, 255, 255)
	},
	{
		start: ip4ToNum(192, 168, 0, 0),
		end: ip4ToNum(192, 168, 255, 255)
	},
	{
		start: ip4ToNum(169, 254, 0, 0),
		end: ip4ToNum(169, 254, 255, 255)
	},
	{
		start: ip4ToNum(0, 0, 0, 0),
		end: ip4ToNum(0, 255, 255, 255)
	}
];
const BLOCKED_HOSTNAMES = new Set([
	"localhost",
	"metadata.google.internal",
	"metadata.google",
	"::1"
]);
/**
* Wildcard DNS services that publicly resolve arbitrary IPs embedded in the
* hostname. Commonly used in local dev and by SSRF exploit tooling to bypass
* hostname-only blocklists (e.g. 127.0.0.1.nip.io -> 127.0.0.1).
*
* Matched case-insensitively as a suffix, so both the apex and any subdomain
* are blocked.
*/
const BLOCKED_HOSTNAME_SUFFIXES = [
	"nip.io",
	"sslip.io",
	"xip.io",
	"traefik.me",
	"lvh.me",
	"localtest.me"
];
/** Blocked URL schemes */
const ALLOWED_SCHEMES = new Set(["http:", "https:"]);
function ip4ToNum(a, b, c, d) {
	return (a << 24 | b << 16 | c << 8 | d) >>> 0;
}
function parseIpv4(ip) {
	const parts = ip.split(".");
	if (parts.length !== 4) return null;
	const nums = parts.map(Number);
	if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
	return ip4ToNum(nums[0], nums[1], nums[2], nums[3]);
}
/**
* Convert IPv4-mapped/translated IPv6 addresses from hex form back to IPv4.
*
* The WHATWG URL parser normalizes dotted-decimal to hex:
*   [::ffff:127.0.0.1] -> [::ffff:7f00:1]
*   [::ffff:169.254.169.254] -> [::ffff:a9fe:a9fe]
*
* Without this conversion, the hex forms bypass isPrivateIp() regex checks.
*/
function normalizeIPv6MappedToIPv4(ip) {
	let match = ip.match(IPV4_MAPPED_IPV6_HEX_PATTERN);
	if (!match) match = ip.match(IPV4_TRANSLATED_HEX_PATTERN);
	if (!match) match = ip.match(IPV6_EXPANDED_MAPPED_PATTERN);
	if (!match) match = ip.match(IPV4_COMPATIBLE_HEX_PATTERN);
	if (!match) match = ip.match(NAT64_HEX_PATTERN);
	if (match) {
		const high = parseInt(match[1] ?? "", 16);
		const low = parseInt(match[2] ?? "", 16);
		return `${high >> 8 & 255}.${high & 255}.${low >> 8 & 255}.${low & 255}`;
	}
	return null;
}
function isPrivateIp(ip) {
	const normalized = ip.toLowerCase();
	if (normalized === "::1" || normalized === "::ffff:127.0.0.1") return true;
	const hexIpv4 = normalizeIPv6MappedToIPv4(normalized);
	if (hexIpv4) return isPrivateIp(hexIpv4);
	const v4Match = normalized.match(IPV4_MAPPED_IPV6_DOTTED_PATTERN);
	const num = parseIpv4(v4Match ? v4Match[1] : normalized);
	if (num === null) return normalized.startsWith("fe80:") || IPV6_ULA_FC_PATTERN.test(normalized) || IPV6_ULA_FD_PATTERN.test(normalized);
	return BLOCKED_PATTERNS.some((range) => num >= range.start && num <= range.end);
}
/**
* Error thrown when SSRF protection blocks a URL.
*/
var SsrfError = class extends Error {
	code = "SSRF_BLOCKED";
	constructor(message) {
		super(message);
		this.name = "SsrfError";
	}
};
/**
* Validate that a URL is safe to fetch (not targeting internal networks).
*
* Checks:
* 1. URL is well-formed with http/https scheme
* 2. Hostname is not a known internal name (localhost, metadata endpoints)
* 3. If hostname is an IP literal, it's not in a private range
*
* Note: DNS rebinding attacks are not fully mitigated (hostname could resolve
* to a private IP). Full protection requires resolving DNS and checking the IP
* before connecting, which needs a custom fetch implementation. This covers
* the most common SSRF vectors.
*
* @throws SsrfError if the URL targets an internal address
*/
/** Maximum number of redirects to follow in ssrfSafeFetch */
const MAX_REDIRECTS = 5;
function validateExternalUrl(url) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		throw new SsrfError("Invalid URL");
	}
	if (!ALLOWED_SCHEMES.has(parsed.protocol)) throw new SsrfError(`Scheme '${parsed.protocol}' is not allowed`);
	const normalizedHost = parsed.hostname.replace(IPV6_BRACKET_PATTERN, "").toLowerCase().replace(TRAILING_DOT_PATTERN, "");
	if (BLOCKED_HOSTNAMES.has(normalizedHost)) throw new SsrfError("URLs targeting internal hosts are not allowed");
	for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) if (normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`)) throw new SsrfError("URLs targeting wildcard DNS services are not allowed");
	if (isPrivateIp(normalizedHost)) throw new SsrfError("URLs targeting private IP addresses are not allowed");
	return parsed;
}
/**
* Module-level default resolver. Tests can swap this with a stub so fetch
* mocks don't see unexpected DoH round-trips. Production code should leave
* it alone.
*/
let defaultResolver = null;
/** Timeout for a single DoH request, in milliseconds. */
const DOH_TIMEOUT_MS = 3e3;
/** Default DoH endpoint — Cloudflare's public resolver. */
const DEFAULT_DOH_URL = "https://cloudflare-dns.com/dns-query";
function hasProperty(obj, key) {
	return typeof obj === "object" && obj !== null && key in obj;
}
/**
* Narrow an unknown JSON body to a DohResponse shape we can read safely.
* Throws if the body doesn't look like a DoH response — a malformed body is
* indistinguishable from a failure and must not be silently treated as empty.
*/
function parseDohResponse(raw) {
	if (!hasProperty(raw, "Status") || typeof raw.Status !== "number") throw new Error("DoH response missing Status field");
	const answers = [];
	if (hasProperty(raw, "Answer") && Array.isArray(raw.Answer)) {
		for (const entry of raw.Answer) if (hasProperty(entry, "data") && typeof entry.data === "string") answers.push({ data: entry.data });
	}
	return {
		Status: raw.Status,
		Answer: answers
	};
}
/**
* Resolve a hostname via DNS over HTTPS (Cloudflare). Returns all A and AAAA
* records. Works in both Workers and Node without requiring node:dns.
*
* Fails closed: any network error, non-2xx response, or DNS rcode != 0
* causes a rejected promise so the calling validator treats it as a block.
*/
const cloudflareDohResolver = async (hostname) => {
	async function query(type) {
		const params = new URLSearchParams({
			name: hostname,
			type
		});
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);
		try {
			const response = await globalThis.fetch(`${DEFAULT_DOH_URL}?${params.toString()}`, {
				headers: { Accept: "application/dns-json" },
				signal: controller.signal
			});
			if (!response.ok) throw new Error(`DoH lookup failed: ${response.status}`);
			const body = parseDohResponse(await response.json());
			if (body.Status === 3) return [];
			if (body.Status !== 0) throw new Error(`DoH ${type} lookup failed: rcode=${body.Status}`);
			return body.Answer.map((a) => a.data).filter(isIpLiteral);
		} finally {
			clearTimeout(timeout);
		}
	}
	const [a, aaaa] = await Promise.all([query("A"), query("AAAA")]);
	return [...a, ...aaaa];
};
/**
* Validate a URL and resolve its hostname to check the actual IPs against
* the private-range blocklist. This catches DNS rebinding attacks using
* attacker-controlled domains that publicly resolve to private addresses,
* and wildcard DNS services like nip.io used by exploit tooling.
*
* Runs `validateExternalUrl` first for cheap pre-flight checks (scheme,
* literal IP, known-bad hostnames). Then resolves the hostname and rejects
* if ANY returned address is private.
*
* Fails closed: if resolution fails or returns no records, throws SsrfError.
*
* **Caveats.** This does NOT fully close the TOCTOU between check and
* connect. Attacks that still work against this layer include:
*
* - TTL=0 rebind: authoritative server returns public IP to the check, then
*   private IP to the subsequent fetch() a few milliseconds later.
* - Split-view via EDNS Client Subnet or source-IP inspection: the
*   authoritative server returns public IP to Cloudflare's DoH resolver and
*   private IP to the victim's own resolver (used by fetch()).
* - Host-file overrides or split-horizon corporate DNS on self-hosted Node.
* - Attacker-controlled rebinding services the caller has allowlisted.
*
* The only complete defense is a network-layer egress firewall. On
* Cloudflare Workers, the platform fetch pipeline provides most of that.
* On self-hosted Node, operators must restrict egress themselves.
*/
async function resolveAndValidateExternalUrl(url, options) {
	const parsed = validateExternalUrl(url);
	const hostname = parsed.hostname.replace(IPV6_BRACKET_PATTERN, "");
	if (isIpLiteral(hostname)) return parsed;
	const resolver = options?.resolver ?? defaultResolver ?? cloudflareDohResolver;
	let addresses;
	try {
		addresses = await resolver(hostname);
	} catch (error) {
		throw new SsrfError(`Could not resolve hostname: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (addresses.length === 0) throw new SsrfError("Hostname resolved to no addresses");
	for (const ip of addresses) if (isPrivateIp(ip)) throw new SsrfError("Hostname resolves to a private IP address");
	return parsed;
}
/** True when a string looks like an IPv4 or IPv6 literal. */
function isIpLiteral(host) {
	if (parseIpv4(host) !== null) return true;
	return host.includes(":");
}
/**
* Fetch a URL with SSRF protection on redirects.
*
* Uses `redirect: "manual"` to intercept redirects and re-validate each
* redirect target against SSRF rules before following it. This prevents
* an attacker from setting up an allowed external URL that redirects to
* an internal IP (e.g. 169.254.169.254 for cloud metadata).
*
* @throws SsrfError if the initial URL or any redirect target is internal
*/
/** Headers that must be stripped when a redirect crosses origins */
const CREDENTIAL_HEADERS = [
	"authorization",
	"cookie",
	"proxy-authorization"
];
async function ssrfSafeFetch(url, init, options) {
	let currentUrl = url;
	let currentInit = init;
	for (let i = 0; i <= MAX_REDIRECTS; i++) {
		await resolveAndValidateExternalUrl(currentUrl, options);
		const response = await globalThis.fetch(currentUrl, {
			...currentInit,
			redirect: "manual"
		});
		if (response.status < 300 || response.status >= 400) return response;
		const location = response.headers.get("Location");
		if (!location) return response;
		const previousOrigin = new URL(currentUrl).origin;
		currentUrl = new URL(location, currentUrl).href;
		if (previousOrigin !== new URL(currentUrl).origin && currentInit) currentInit = stripCredentialHeaders(currentInit);
	}
	throw new SsrfError(`Too many redirects (max ${MAX_REDIRECTS})`);
}
/**
* Return a copy of init with credential headers removed.
*/
function stripCredentialHeaders(init) {
	if (!init.headers) return init;
	const headers = new Headers(init.headers);
	for (const name of CREDENTIAL_HEADERS) headers.delete(name);
	return {
		...init,
		headers
	};
}

//#endregion
//#region src/seed/apply.ts
/**
* Seed engine - applies seed files to database
*
* This is the core implementation that bootstraps an EmDash site from a seed file.
* Apply order is critical for foreign keys and references.
*/
var apply_exports = /* @__PURE__ */ __exportAll({ applySeed: () => applySeed });
const FILE_EXTENSION_PATTERN = /\.([a-z0-9]+)(?:\?|$)/i;
/** Pattern to remove file extensions */
const EXTENSION_PATTERN = /\.[^.]+$/;
/** Pattern to remove query parameters */
const QUERY_PARAM_PATTERN = /\?.*$/;
/** Pattern to remove non-alphanumeric characters (except dash and underscore) */
const SANITIZE_PATTERN = /[^a-zA-Z0-9_-]/g;
/** Pattern to collapse multiple hyphens */
const MULTIPLE_HYPHENS_PATTERN = /-+/g;
/**
* Apply a seed file to the database
*
* This function is idempotent - safe to run multiple times.
*
* @param db - Kysely database instance
* @param seed - Seed file to apply
* @param options - Application options
* @returns Result summary
*/
async function applySeed(db, seed, options = {}) {
	const validation = validateSeed(seed);
	if (!validation.valid) throw new Error(`Invalid seed file:\n${validation.errors.join("\n")}`);
	const { includeContent = false, storage, skipMediaDownload = false, onConflict = "skip" } = options;
	const result = {
		collections: {
			created: 0,
			skipped: 0,
			updated: 0
		},
		fields: {
			created: 0,
			skipped: 0,
			updated: 0
		},
		taxonomies: {
			created: 0,
			terms: 0
		},
		bylines: {
			created: 0,
			skipped: 0,
			updated: 0
		},
		menus: {
			created: 0,
			items: 0
		},
		redirects: {
			created: 0,
			skipped: 0,
			updated: 0
		},
		widgetAreas: {
			created: 0,
			widgets: 0
		},
		sections: {
			created: 0,
			skipped: 0,
			updated: 0
		},
		settings: { applied: 0 },
		content: {
			created: 0,
			skipped: 0,
			updated: 0
		},
		media: {
			created: 0,
			skipped: 0
		}
	};
	const mediaContext = {
		db,
		storage: storage ?? null,
		skipMediaDownload,
		mediaCache: /* @__PURE__ */ new Map()
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
			if (await registry.getCollection(collection.slug)) {
				if (onConflict === "error") throw new Error(`Conflict: collection "${collection.slug}" already exists`);
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
					for (const field of collection.fields) if (await registry.getField(collection.slug, field.slug)) {
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
		const fallbackLocale = getI18nConfig()?.defaultLocale ?? "en";
		for (const taxonomy of seed.taxonomies) {
			const defLocale = taxonomy.locale ?? fallbackLocale;
			const existingDef = await db.selectFrom("_emdash_taxonomy_defs").selectAll().where("name", "=", taxonomy.name).where("locale", "=", defLocale).executeTakeFirst();
			let defId;
			let defTranslationGroup;
			if (existingDef) {
				defId = existingDef.id;
				defTranslationGroup = existingDef.translation_group ?? existingDef.id;
				if (onConflict === "error") throw new Error(`Conflict: taxonomy "${taxonomy.name}" (${defLocale}) already exists`);
				if (onConflict === "update") await db.updateTable("_emdash_taxonomy_defs").set({
					label: taxonomy.label,
					label_singular: taxonomy.labelSingular ?? null,
					hierarchical: taxonomy.hierarchical ? 1 : 0,
					collections: JSON.stringify(taxonomy.collections)
				}).where("id", "=", existingDef.id).execute();
			} else {
				defId = ulid();
				defTranslationGroup = defId;
				if (taxonomy.translationOf) {
					const source = defSeedIdMap.get(taxonomy.translationOf);
					if (source) defTranslationGroup = source.translationGroup;
					else console.warn(`taxonomy "${taxonomy.name}" (${defLocale}): translationOf "${taxonomy.translationOf}" not found yet; minting a fresh group.`);
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
			if (taxonomy.id) defSeedIdMap.set(taxonomy.id, {
				id: defId,
				translationGroup: defTranslationGroup
			});
			if (taxonomy.terms && taxonomy.terms.length > 0) {
				const termRepo = new TaxonomyRepository(db);
				if (taxonomy.hierarchical) await applyHierarchicalTerms(termRepo, taxonomy.name, defLocale, taxonomy.terms, termSeedIdMap, result, onConflict);
				else for (const term of taxonomy.terms) {
					const termLocale = term.locale ?? defLocale;
					const existing = await termRepo.findBySlug(taxonomy.name, term.slug, termLocale);
					if (existing) {
						if (onConflict === "error") throw new Error(`Conflict: taxonomy term "${term.slug}" in "${taxonomy.name}" (${termLocale}) already exists`);
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
	if (seed.bylines) {
		const bylineRepo = new BylineRepository(db);
		for (const byline of seed.bylines) {
			const existing = await bylineRepo.findBySlug(byline.slug);
			if (existing) {
				if (onConflict === "error") throw new Error(`Conflict: byline "${byline.slug}" already exists`);
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
		for (const [collectionSlug, entries] of Object.entries(seed.content)) for (const entry of entries) {
			const existing = await contentRepo.findBySlug(collectionSlug, entry.slug, entry.locale);
			if (existing) {
				if (onConflict === "error") throw new Error(`Conflict: content "${entry.slug}" in "${collectionSlug}" already exists`);
				if (onConflict === "update") {
					const resolvedData = await resolveReferences(entry.data, seedIdMap, mediaContext, result);
					const status = entry.status || "published";
					await withTransaction(db, async (trx) => {
						const trxContentRepo = new ContentRepository(trx);
						const trxBylineRepo = new BylineRepository(trx);
						const trxRevisionRepo = new RevisionRepository(trx);
						await trxContentRepo.update(collectionSlug, existing.id, {
							status,
							data: resolvedData
						});
						await applyContentBylines(trxBylineRepo, collectionSlug, existing.id, entry, seedBylineIdMap, true);
						await applyContentTaxonomies(trx, collectionSlug, existing.id, entry, true);
						if (status === "published") {
							const draft = await trxRevisionRepo.create({
								collection: collectionSlug,
								entryId: existing.id,
								data: resolvedData
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
				if (!sourceId) console.warn(`content.${collectionSlug}: translationOf "${entry.translationOf}" not found (not yet created or missing). Skipping translation link.`);
				else translationOf = sourceId;
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
				if (status === "published") await trxContentRepo.publish(collectionSlug, item.id);
				return item;
			});
			seedIdMap.set(entry.id, created.id);
			result.content.created++;
		}
	}
	if (seed.menus) {
		const menuSeedIdMap = /* @__PURE__ */ new Map();
		const itemSeedIdMap = /* @__PURE__ */ new Map();
		const fallbackLocale = getI18nConfig()?.defaultLocale ?? "en";
		for (const menu of seed.menus) {
			const locale = menu.locale ?? fallbackLocale;
			const existingMenu = await db.selectFrom("_emdash_menus").selectAll().where("name", "=", menu.name).where("locale", "=", locale).executeTakeFirst();
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
					else console.warn(`menu "${menu.name}" (${locale}): translationOf "${menu.translationOf}" not found yet; minting a fresh group.`);
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
			if (menu.id) menuSeedIdMap.set(menu.id, {
				id: menuId,
				translationGroup
			});
			const itemCount = await applyMenuItems(db, menuId, locale, menu.items, null, 0, seedIdMap, itemSeedIdMap);
			result.menus.items += itemCount;
		}
	}
	if (seed.redirects) {
		const redirectRepo = new RedirectRepository(db);
		for (const redirect of seed.redirects) {
			const existing = await redirectRepo.findBySource(redirect.source);
			if (existing) {
				if (onConflict === "error") throw new Error(`Conflict: redirect "${redirect.source}" already exists`);
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
	if (seed.widgetAreas) for (const area of seed.widgetAreas) {
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
	if (seed.sections) for (const section of seed.sections) {
		const existing = await db.selectFrom("_emdash_sections").select("id").where("slug", "=", section.slug).executeTakeFirst();
		if (existing) {
			if (onConflict === "error") throw new Error(`Conflict: section "${section.slug}" already exists`);
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
	if (seed.collections) {
		const ftsManager = new FTSManager(db);
		for (const collection of seed.collections) if (collection.supports?.includes("search")) {
			if ((await ftsManager.getSearchableFields(collection.slug)).length > 0) try {
				await ftsManager.enableSearch(collection.slug);
			} catch (err) {
				console.warn(`Failed to enable search for ${collection.slug}:`, err);
			}
		}
	}
	const { invalidateBylineCache } = await import('./bylines-DTFI8nDM_WDUzvaAX.mjs').then((n) => n.t);
	const { invalidateRedirectCache } = await Promise.resolve().then(() => cacheBAJbeoZ8).then((n) => n.t);
	const { invalidateUrlPatternCache } = await import('./query-yA3-rFji_DI0XfGdU.mjs').then((n) => n.o);
	invalidateBylineCache();
	invalidateRedirectCache();
	invalidateUrlPatternCache();
	return result;
}
/**
* Apply hierarchical taxonomy terms (parents before children)
*/
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
				if (onConflict === "error") throw new Error(`Conflict: taxonomy term "${term.slug}" in "${taxonomyName}" (${termLocale}) already exists`);
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
		remaining = remaining.filter((t) => !processedThisPass.includes(t.slug + "::" + (t.locale ?? defLocale)));
		maxPasses--;
	}
	if (remaining.length > 0) console.warn(`Could not process ${remaining.length} terms due to missing parents/translations`);
}
/**
* Apply byline credits to a content entry.
* In update mode, clears existing credits even if the seed has none.
*/
async function applyContentBylines(bylineRepo, collectionSlug, contentId, entry, seedBylineIdMap, isUpdate = false) {
	if (!entry.bylines || entry.bylines.length === 0) {
		if (isUpdate) await bylineRepo.setContentBylines(collectionSlug, contentId, []);
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
	if (credits.length !== entry.bylines.length) console.warn(`content.${collectionSlug}.${entry.slug}: one or more byline refs could not be resolved`);
	if (credits.length > 0 || isUpdate) await bylineRepo.setContentBylines(collectionSlug, contentId, credits);
}
/**
* Apply taxonomy term assignments to a content entry.
* In update mode, clears existing assignments before re-attaching.
*/
async function applyContentTaxonomies(db, collectionSlug, contentId, entry, isUpdate) {
	if (isUpdate) await db.deleteFrom("content_taxonomies").where("collection", "=", collectionSlug).where("entry_id", "=", contentId).execute();
	if (!entry.taxonomies) {
		if (isUpdate) {
			const { invalidateTermCache } = await import('./taxonomies-JmQQZiG1_DH1Y73oi.mjs').then((n) => n.u);
			invalidateTermCache();
		}
		return;
	}
	for (const [taxonomyName, termSlugs] of Object.entries(entry.taxonomies)) {
		const termRepo = new TaxonomyRepository(db);
		for (const termSlug of termSlugs) {
			const term = await termRepo.findBySlug(taxonomyName, termSlug);
			if (term) await termRepo.attachToEntry(collectionSlug, contentId, term.id);
		}
	}
	const { invalidateTermCache } = await import('./taxonomies-JmQQZiG1_DH1Y73oi.mjs').then((n) => n.u);
	invalidateTermCache();
}
/**
* Apply menu items recursively.
*
* When a `SeedMenuItem` carries `id`/`translationOf`, the import resolves the
* source item's `translation_group` so cross-locale "same nav entry" links
* survive export → apply. Items without `translationOf` get a fresh group
* (= their own id).
*/
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
			else console.warn(`menu item "${item.label ?? item.url ?? item.ref ?? "(unlabeled)"}" (${itemLocale}): translationOf "${item.translationOf}" not found yet; minting a fresh group.`);
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
		if (item.id) itemSeedIdMap.set(item.id, {
			id: itemId,
			translationGroup
		});
		count++;
		order++;
		if (item.children && item.children.length > 0) {
			const childCount = await applyMenuItems(db, menuId, itemLocale, item.children, itemId, 0, seedIdMap, itemSeedIdMap);
			count += childCount;
		}
	}
	return count;
}
/**
* Apply a widget
*/
async function applyWidget(db, areaId, widget, sortOrder) {
	await db.insertInto("_emdash_widgets").values({
		id: ulid(),
		area_id: areaId,
		sort_order: sortOrder,
		type: widget.type,
		title: widget.title ?? null,
		content: widget.content ? JSON.stringify(widget.content) : null,
		menu_name: widget.menuName ?? null,
		component_id: widget.componentId ?? null,
		component_props: widget.props ? JSON.stringify(widget.props) : null
	}).execute();
}
/**
* Type guard for $media reference
*/
function isSeedMediaReference(value) {
	if (typeof value !== "object" || value === null || !("$media" in value)) return false;
	const media = value.$media;
	return typeof media === "object" && media !== null && "url" in media && typeof media.url === "string";
}
/**
* Resolve $ref: and $media references in content data
*/
async function resolveReferences(data, seedIdMap, mediaContext, result) {
	const resolved = {};
	for (const [key, value] of Object.entries(data)) resolved[key] = await resolveValue(value, seedIdMap, mediaContext, result);
	return resolved;
}
/**
* Resolve a single value recursively
*/
async function resolveValue(value, seedIdMap, mediaContext, result) {
	if (typeof value === "string" && value.startsWith("$ref:")) {
		const seedId = value.slice(5);
		return seedIdMap.get(seedId) ?? value;
	}
	if (isSeedMediaReference(value)) return resolveMedia(value, mediaContext, result);
	if (Array.isArray(value)) return Promise.all(value.map((item) => resolveValue(item, seedIdMap, mediaContext, result)));
	if (typeof value === "object" && value !== null) {
		const resolved = {};
		for (const [k, v] of Object.entries(value)) resolved[k] = await resolveValue(v, seedIdMap, mediaContext, result);
		return resolved;
	}
	return value;
}
/**
* Resolve a $media reference by downloading and uploading the media
*/
async function resolveMedia(ref, ctx, result) {
	const { url, alt, filename, caption } = ref.$media;
	const cached = ctx.mediaCache.get(url);
	if (cached) {
		result.media.skipped++;
		return {
			...cached,
			alt: alt ?? cached.alt
		};
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
		const response = await ssrfSafeFetch(url, { headers: { "User-Agent": "EmDash-CMS/1.0" } });
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
		await new MediaRepository(ctx.db).create({
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
		console.warn(`  ⚠️ Error processing $media ${url}:`, error instanceof Error ? error.message : error);
		result.media.skipped++;
		return null;
	}
}
/**
* Get file extension from content type
*/
function getExtensionFromContentType(contentType) {
	const baseMime = contentType.split(";")[0].trim();
	const ext = mime.getExtension(baseMime);
	return ext ? `.${ext}` : null;
}
/**
* Get file extension from URL
*/
function getExtensionFromUrl(url) {
	try {
		const match = new URL(url).pathname.match(FILE_EXTENSION_PATTERN);
		return match ? `.${match[1]}` : null;
	} catch {
		return null;
	}
}
/**
* Generate a filename from URL
*/
function generateFilename(url, ext) {
	try {
		return `${(new URL(url).pathname.split("/").pop() || "media").replace(EXTENSION_PATTERN, "").replace(QUERY_PARAM_PATTERN, "").replace(SANITIZE_PATTERN, "-").replace(MULTIPLE_HYPHENS_PATTERN, "-") || "media"}${ext}`;
	} catch {
		return `media${ext}`;
	}
}
/**
* Get image dimensions from buffer using image-size.
* Supports PNG, JPEG, GIF, WebP, AVIF, SVG, TIFF, and more.
*/
function getImageDimensions(buffer) {
	try {
		const result = imageSize(buffer);
		if (result.width != null && result.height != null) return {
			width: result.width,
			height: result.height
		};
		return null;
	} catch {
		return null;
	}
}

const applyC1ZORgcy = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	a: ssrfSafeFetch,
	i: resolveAndValidateExternalUrl,
	n: apply_exports,
	o: stripCredentialHeaders,
	r: SsrfError,
	s: validateExternalUrl,
	t: applySeed
}, Symbol.toStringTag, { value: 'Module' }));

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": undefined, "SSR": true};
var UserRepository = class UserRepository2 {
  constructor(db) {
    this.db = db;
  }
  /**
  * Create a new user
  */
  async create(input) {
    const id = ulid();
    const row = {
      id,
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      role: UserRepository2.resolveRole(input.role ?? 10),
      avatar_url: input.avatarUrl ?? null,
      email_verified: 0,
      data: input.data ? JSON.stringify(input.data) : null
    };
    await this.db.insertInto("users").values(row).execute();
    const user = await this.findById(id);
    if (!user) throw new Error("Failed to create user");
    return user;
  }
  /**
  * Find user by ID
  */
  async findById(id) {
    const row = await this.db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
    return row ? this.rowToUser(row) : null;
  }
  /**
  * Find user by email (case-insensitive)
  */
  async findByEmail(email) {
    const row = await this.db.selectFrom("users").selectAll().where("email", "=", email.toLowerCase()).executeTakeFirst();
    return row ? this.rowToUser(row) : null;
  }
  /**
  * List all users with cursor-based pagination
  */
  async findMany(options = {}) {
    const limit = Math.min(Math.max(1, options.limit || 50), 100);
    let query = this.db.selectFrom("users").selectAll().orderBy("created_at", "desc").orderBy("id", "desc").limit(limit + 1);
    if (options.role !== void 0) query = query.where("role", "=", UserRepository2.resolveRole(options.role));
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      query = query.where((eb) => eb.or([eb("created_at", "<", decoded.orderValue), eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)])]));
    }
    const rows = await query.execute();
    const items = rows.slice(0, limit).map((row) => this.rowToUser(row));
    const result = { items };
    if (rows.length > limit && items.length > 0) {
      const last = items.at(-1);
      result.nextCursor = encodeCursor(last.createdAt, last.id);
    }
    return result;
  }
  /**
  * Update a user
  */
  async update(id, input) {
    if (!await this.findById(id)) return null;
    const updates = {};
    if (input.name !== void 0) updates.name = input.name;
    if (input.role !== void 0) updates.role = UserRepository2.resolveRole(input.role);
    if (input.avatarUrl !== void 0) updates.avatar_url = input.avatarUrl;
    if (input.data !== void 0) updates.data = JSON.stringify(input.data);
    if (Object.keys(updates).length > 0) await this.db.updateTable("users").set(updates).where("id", "=", id).execute();
    return this.findById(id);
  }
  /**
  * Delete a user
  */
  async delete(id) {
    return ((await this.db.deleteFrom("users").where("id", "=", id).executeTakeFirst()).numDeletedRows ?? 0) > 0;
  }
  /**
  * Count users
  */
  async count(role) {
    let query = this.db.selectFrom("users").select((eb) => eb.fn.count("id").as("count"));
    if (role !== void 0) query = query.where("role", "=", UserRepository2.resolveRole(role));
    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }
  /**
  * Check if email exists
  */
  async emailExists(email) {
    return !!await this.db.selectFrom("users").select("id").where("email", "=", email.toLowerCase()).executeTakeFirst();
  }
  /**
  * Convert database row to User object
  */
  rowToUser(row) {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: UserRepository2.toRole(row.role),
      avatarUrl: row.avatar_url,
      emailVerified: row.email_verified === 1,
      data: row.data ? JSON.parse(row.data) : null,
      createdAt: row.created_at
    };
  }
  /** Map of role name strings to numeric levels */
  static ROLE_NAME_TO_LEVEL = {
    subscriber: 10,
    contributor: 20,
    author: 30,
    editor: 40,
    admin: 50
  };
  /** Valid numeric role levels */
  static VALID_LEVELS = /* @__PURE__ */ new Set([
    10,
    20,
    30,
    40,
    50
  ]);
  /**
  * Resolve a role name or number to a valid numeric UserRole.
  * Accepts both string names ("admin") and numeric levels (50).
  */
  static resolveRole(role) {
    if (typeof role === "string") {
      const level = UserRepository2.ROLE_NAME_TO_LEVEL[role];
      if (level === void 0) throw new Error(`Invalid role name: ${role}`);
      return level;
    }
    if (!UserRepository2.VALID_LEVELS.has(role)) throw new Error(`Invalid role level: ${role}`);
    return role;
  }
  /**
  * Convert a raw DB integer to a typed UserRole.
  * Falls back to subscriber (10) for unknown values.
  */
  static toRole(level) {
    if (UserRepository2.VALID_LEVELS.has(level)) return level;
    return 10;
  }
};
const LIKE_ESCAPE_RE = /[%_\\]/g;
var CommentRepository = class CommentRepository2 {
  constructor(db) {
    this.db = db;
  }
  /**
  * Create a new comment
  */
  async create(input) {
    const id = ulid();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await this.db.insertInto("_emdash_comments").values({
      id,
      collection: input.collection,
      content_id: input.contentId,
      parent_id: input.parentId ?? null,
      author_name: input.authorName,
      author_email: input.authorEmail,
      author_user_id: input.authorUserId ?? null,
      body: input.body,
      status: input.status ?? "pending",
      ip_hash: input.ipHash ?? null,
      user_agent: input.userAgent ?? null,
      moderation_metadata: input.moderationMetadata ? JSON.stringify(input.moderationMetadata) : null,
      created_at: now,
      updated_at: now
    }).execute();
    const comment = await this.findById(id);
    if (!comment) throw new Error("Failed to create comment");
    return comment;
  }
  /**
  * Find comment by ID
  */
  async findById(id) {
    const row = await this.db.selectFrom("_emdash_comments").selectAll().where("id", "=", id).executeTakeFirst();
    return row ? this.rowToComment(row) : null;
  }
  /**
  * Find comments for a content item with optional status filter.
  * Results are ordered by created_at ASC (oldest first) for display.
  */
  async findByContent(collection, contentId, options = {}) {
    const limit = Math.min(options.limit || 50, 100);
    let query = this.db.selectFrom("_emdash_comments").selectAll().where("collection", "=", collection).where("content_id", "=", contentId);
    if (options.status) query = query.where("status", "=", options.status);
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      query = query.where((eb) => eb.or([eb("created_at", ">", decoded.orderValue), eb.and([eb("created_at", "=", decoded.orderValue), eb("id", ">", decoded.id)])]));
    }
    query = query.orderBy("created_at", "asc").orderBy("id", "asc").limit(limit + 1);
    const rows = await query.execute();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => this.rowToComment(r));
    const result = { items };
    if (hasMore && items.length > 0) {
      const last = items.at(-1);
      result.nextCursor = encodeCursor(last.createdAt, last.id);
    }
    return result;
  }
  /**
  * Find comments by status (moderation inbox).
  * Results are ordered by created_at DESC (newest first).
  */
  async findByStatus(status, options = {}) {
    const limit = Math.min(options.limit || 50, 100);
    let query = this.db.selectFrom("_emdash_comments").selectAll().where("status", "=", status);
    if (options.collection) query = query.where("collection", "=", options.collection);
    if (options.search) {
      const term = `%${options.search.replace(LIKE_ESCAPE_RE, (ch) => `\\${ch}`)}%`;
      query = query.where((eb) => eb.or([
        sql`author_name LIKE ${term} ESCAPE '\\'`,
        sql`author_email LIKE ${term} ESCAPE '\\'`,
        sql`body LIKE ${term} ESCAPE '\\'`
      ]));
    }
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      query = query.where((eb) => eb.or([eb("created_at", "<", decoded.orderValue), eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)])]));
    }
    query = query.orderBy("created_at", "desc").orderBy("id", "desc").limit(limit + 1);
    const rows = await query.execute();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => this.rowToComment(r));
    const result = { items };
    if (hasMore && items.length > 0) {
      const last = items.at(-1);
      result.nextCursor = encodeCursor(last.createdAt, last.id);
    }
    return result;
  }
  /**
  * Update comment status
  */
  async updateStatus(id, status) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await this.db.updateTable("_emdash_comments").set({
      status,
      updated_at: now
    }).where("id", "=", id).execute();
    return this.findById(id);
  }
  /**
  * Bulk update comment statuses
  */
  async bulkUpdateStatus(ids, status) {
    if (ids.length === 0) return 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = await this.db.updateTable("_emdash_comments").set({
      status,
      updated_at: now
    }).where("id", "in", ids).executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0);
  }
  /**
  * Hard-delete a single comment. Replies cascade via FK.
  */
  async delete(id) {
    return ((await this.db.deleteFrom("_emdash_comments").where("id", "=", id).executeTakeFirst()).numDeletedRows ?? 0) > 0;
  }
  /**
  * Bulk hard-delete comments
  */
  async bulkDelete(ids) {
    if (ids.length === 0) return 0;
    const result = await this.db.deleteFrom("_emdash_comments").where("id", "in", ids).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
  /**
  * Delete all comments for a content item (cascade on content deletion)
  */
  async deleteByContent(collection, contentId) {
    const result = await this.db.deleteFrom("_emdash_comments").where("collection", "=", collection).where("content_id", "=", contentId).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
  /**
  * Count comments for a content item, optionally filtered by status
  */
  async countByContent(collection, contentId, status) {
    let query = this.db.selectFrom("_emdash_comments").select((eb) => eb.fn.count("id").as("count")).where("collection", "=", collection).where("content_id", "=", contentId);
    if (status) query = query.where("status", "=", status);
    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }
  /**
  * Count comments grouped by status (for inbox badges)
  *
  * Uses four parallel COUNT queries with WHERE filters to leverage partial indexes
  * (idx_comments_pending, idx_comments_approved, idx_comments_spam, idx_comments_trash)
  * instead of a full table GROUP BY scan.
  */
  async countByStatus() {
    const [pending, approved, spam, trash] = await Promise.all([
      this.db.selectFrom("_emdash_comments").select((eb) => eb.fn.count("id").as("count")).where("status", "=", "pending").executeTakeFirst(),
      this.db.selectFrom("_emdash_comments").select((eb) => eb.fn.count("id").as("count")).where("status", "=", "approved").executeTakeFirst(),
      this.db.selectFrom("_emdash_comments").select((eb) => eb.fn.count("id").as("count")).where("status", "=", "spam").executeTakeFirst(),
      this.db.selectFrom("_emdash_comments").select((eb) => eb.fn.count("id").as("count")).where("status", "=", "trash").executeTakeFirst()
    ]);
    return {
      pending: Number(pending?.count ?? 0),
      approved: Number(approved?.count ?? 0),
      spam: Number(spam?.count ?? 0),
      trash: Number(trash?.count ?? 0)
    };
  }
  /**
  * Count approved comments from a given email address.
  * Used for "first time commenter" moderation logic.
  */
  async countApprovedByEmail(email) {
    const result = await this.db.selectFrom("_emdash_comments").select((eb) => eb.fn.count("id").as("count")).where("author_email", "=", email).where("status", "=", "approved").executeTakeFirst();
    return Number(result?.count ?? 0);
  }
  /**
  * Update the moderation metadata JSON on a comment
  */
  async updateModerationMetadata(id, metadata) {
    await this.db.updateTable("_emdash_comments").set({ moderation_metadata: JSON.stringify(metadata) }).where("id", "=", id).execute();
  }
  /**
  * Assemble a flat list of comments into a threaded structure (1-level nesting)
  */
  static assembleThreads(comments) {
    const roots = [];
    const childrenMap = /* @__PURE__ */ new Map();
    for (const comment of comments) if (comment.parentId) {
      const siblings = childrenMap.get(comment.parentId) ?? [];
      siblings.push(comment);
      childrenMap.set(comment.parentId, siblings);
    } else roots.push(comment);
    return roots.map((root) => ({
      ...root,
      _replies: childrenMap.get(root.id) ?? []
    }));
  }
  /**
  * Convert a Comment to its public-facing shape
  */
  static toPublicComment(comment) {
    const pub = {
      id: comment.id,
      parentId: comment.parentId,
      authorName: comment.authorName,
      isRegisteredUser: comment.authorUserId !== null,
      body: comment.body,
      createdAt: comment.createdAt
    };
    if (comment._replies && comment._replies.length > 0) pub.replies = comment._replies.map((r) => CommentRepository2.toPublicComment(r));
    return pub;
  }
  rowToComment(row) {
    return {
      id: row.id,
      collection: row.collection,
      contentId: row.content_id,
      parentId: row.parent_id,
      authorName: row.author_name,
      authorEmail: row.author_email,
      authorUserId: row.author_user_id,
      body: row.body,
      status: row.status,
      ipHash: row.ip_hash,
      userAgent: row.user_agent,
      moderationMetadata: row.moderation_metadata ? safeJsonParse(row.moderation_metadata) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};
function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
var StorageQueryError = class extends Error {
  constructor(message, field, suggestion) {
    super(message);
    this.field = field;
    this.suggestion = suggestion;
    this.name = "StorageQueryError";
  }
};
function isRangeFilter(value) {
  if (typeof value !== "object" || value === null) return false;
  return "gt" in value || "gte" in value || "lt" in value || "lte" in value;
}
function isInFilter(value) {
  if (typeof value !== "object" || value === null) return false;
  return "in" in value && Array.isArray(value.in);
}
function isStartsWithFilter(value) {
  if (typeof value !== "object" || value === null) return false;
  return "startsWith" in value && typeof value.startsWith === "string";
}
function getIndexedFields(indexes) {
  const fields = /* @__PURE__ */ new Set();
  for (const index of indexes) if (Array.isArray(index)) for (const field of index) fields.add(field);
  else fields.add(index);
  return fields;
}
function validateWhereClause(where, indexedFields, pluginId, collection) {
  for (const field of Object.keys(where)) if (!indexedFields.has(field)) throw new StorageQueryError(`Cannot query on non-indexed field '${field}'.`, field, `Add '${field}' to storage.${collection}.indexes in plugin '${pluginId}' to enable this query.`);
}
function validateOrderByClause(orderBy, indexedFields, pluginId, collection) {
  for (const field of Object.keys(orderBy)) if (!indexedFields.has(field)) throw new StorageQueryError(`Cannot order by non-indexed field '${field}'.`, field, `Add '${field}' to storage.${collection}.indexes in plugin '${pluginId}' to enable ordering by this field.`);
}
function jsonExtract(db, field) {
  validateJsonFieldName(field, "query field name");
  return jsonExtractExpr(db, "data", field);
}
function buildCondition(db, field, value) {
  const extract = jsonExtract(db, field);
  if (value === null) return {
    sql: `${extract} IS NULL`,
    params: []
  };
  if (typeof value === "string" || typeof value === "number") return {
    sql: `${extract} = ?`,
    params: [value]
  };
  if (typeof value === "boolean") return {
    sql: `${extract} = ?`,
    params: [value]
  };
  if (isInFilter(value)) return {
    sql: `${extract} IN (${value.in.map(() => "?").join(", ")})`,
    params: value.in
  };
  if (isStartsWithFilter(value)) return {
    sql: `${extract} LIKE ?`,
    params: [`${value.startsWith}%`]
  };
  if (isRangeFilter(value)) {
    const conditions = [];
    const params = [];
    if (value.gt !== void 0) {
      conditions.push(`${extract} > ?`);
      params.push(value.gt);
    }
    if (value.gte !== void 0) {
      conditions.push(`${extract} >= ?`);
      params.push(value.gte);
    }
    if (value.lt !== void 0) {
      conditions.push(`${extract} < ?`);
      params.push(value.lt);
    }
    if (value.lte !== void 0) {
      conditions.push(`${extract} <= ?`);
      params.push(value.lte);
    }
    return {
      sql: conditions.join(" AND "),
      params
    };
  }
  throw new StorageQueryError(`Unknown filter type for field '${field}'`);
}
function buildWhereClause(db, where) {
  const conditions = [];
  const params = [];
  for (const [field, value] of Object.entries(where)) {
    const condition = buildCondition(db, field, value);
    conditions.push(condition.sql);
    params.push(...condition.params);
  }
  if (conditions.length === 0) return {
    sql: "",
    params: []
  };
  return {
    sql: conditions.join(" AND "),
    params
  };
}
var PluginStorageRepository = class {
  indexedFields;
  constructor(db, pluginId, collection, indexes) {
    this.db = db;
    this.pluginId = pluginId;
    this.collection = collection;
    this.indexedFields = getIndexedFields(indexes);
  }
  /**
  * Get a document by ID
  */
  async get(id) {
    const row = await this.db.selectFrom("_plugin_storage").select("data").where("plugin_id", "=", this.pluginId).where("collection", "=", this.collection).where("id", "=", id).executeTakeFirst();
    if (!row) return null;
    return JSON.parse(row.data);
  }
  /**
  * Store a document
  */
  async put(id, data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const jsonData = JSON.stringify(data);
    await this.db.insertInto("_plugin_storage").values({
      plugin_id: this.pluginId,
      collection: this.collection,
      id,
      data: jsonData,
      created_at: now,
      updated_at: now
    }).onConflict((oc) => oc.columns([
      "plugin_id",
      "collection",
      "id"
    ]).doUpdateSet({
      data: jsonData,
      updated_at: now
    })).execute();
  }
  /**
  * Delete a document
  */
  async delete(id) {
    return ((await this.db.deleteFrom("_plugin_storage").where("plugin_id", "=", this.pluginId).where("collection", "=", this.collection).where("id", "=", id).executeTakeFirst()).numDeletedRows ?? 0) > 0;
  }
  /**
  * Check if a document exists
  */
  async exists(id) {
    return !!await this.db.selectFrom("_plugin_storage").select("id").where("plugin_id", "=", this.pluginId).where("collection", "=", this.collection).where("id", "=", id).executeTakeFirst();
  }
  /**
  * Get multiple documents by ID
  */
  async getMany(ids) {
    if (ids.length === 0) return /* @__PURE__ */ new Map();
    const rows = await this.db.selectFrom("_plugin_storage").select(["id", "data"]).where("plugin_id", "=", this.pluginId).where("collection", "=", this.collection).where("id", "in", ids).execute();
    const result = /* @__PURE__ */ new Map();
    for (const row of rows) result.set(row.id, JSON.parse(row.data));
    return result;
  }
  /**
  * Store multiple documents
  */
  async putMany(items) {
    if (items.length === 0) return;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await withTransaction(this.db, async (trx) => {
      for (const item of items) {
        const jsonData = JSON.stringify(item.data);
        await trx.insertInto("_plugin_storage").values({
          plugin_id: this.pluginId,
          collection: this.collection,
          id: item.id,
          data: jsonData,
          created_at: now,
          updated_at: now
        }).onConflict((oc) => oc.columns([
          "plugin_id",
          "collection",
          "id"
        ]).doUpdateSet({
          data: jsonData,
          updated_at: now
        })).execute();
      }
    });
  }
  /**
  * Delete multiple documents
  */
  async deleteMany(ids) {
    if (ids.length === 0) return 0;
    const result = await this.db.deleteFrom("_plugin_storage").where("plugin_id", "=", this.pluginId).where("collection", "=", this.collection).where("id", "in", ids).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
  /**
  * Query documents with filters
  */
  async query(options = {}) {
    const { where = {}, orderBy = {}, cursor } = options;
    const limit = Math.min(options.limit ?? 50, 100);
    validateWhereClause(where, this.indexedFields, this.pluginId, this.collection);
    if (Object.keys(orderBy).length > 0) validateOrderByClause(orderBy, this.indexedFields, this.pluginId, this.collection);
    let query = this.db.selectFrom("_plugin_storage").select([
      "id",
      "data",
      "created_at"
    ]).where("plugin_id", "=", this.pluginId).where("collection", "=", this.collection);
    const whereResult = buildWhereClause(this.db, where);
    if (whereResult.sql) {
      const whereSqlParts = [];
      let paramIndex = 0;
      const sqlParts = whereResult.sql.split("?");
      for (let i = 0; i < sqlParts.length; i++) {
        if (i > 0) whereSqlParts.push(sql`${whereResult.params[paramIndex++]}`);
        if (sqlParts[i]) whereSqlParts.push(sql.raw(sqlParts[i]));
      }
      query = query.where(({ eb }) => eb(sql.join(whereSqlParts, sql.raw("")), "=", sql.raw("1")));
    }
    if (cursor) {
      const decoded = decodeCursor(cursor);
      query = query.where(({ eb }) => eb(sql`(created_at, id)`, ">", sql`(${decoded.orderValue}, ${decoded.id})`));
    }
    if (Object.keys(orderBy).length > 0) for (const [field, direction] of Object.entries(orderBy)) {
      const extract = jsonExtract(this.db, field);
      const orderExpr = direction === "desc" ? sql`${sql.raw(extract)} desc` : sql`${sql.raw(extract)} asc`;
      query = query.orderBy(orderExpr);
    }
    else query = query.orderBy("created_at", "asc").orderBy("id", "asc");
    query = query.limit(limit + 1);
    const rows = await query.execute();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      data: JSON.parse(row.data)
    }));
    let nextCursor;
    if (hasMore) {
      const lastItem = rows[limit - 1];
      if (lastItem) nextCursor = encodeCursor(lastItem.created_at, lastItem.id);
    }
    return {
      items,
      cursor: nextCursor,
      hasMore
    };
  }
  /**
  * Count documents matching a filter
  */
  async count(where) {
    if (where && Object.keys(where).length > 0) validateWhereClause(where, this.indexedFields, this.pluginId, this.collection);
    let query = this.db.selectFrom("_plugin_storage").select(sql`COUNT(*)`.as("count")).where("plugin_id", "=", this.pluginId).where("collection", "=", this.collection);
    if (where && Object.keys(where).length > 0) {
      const whereResult = buildWhereClause(this.db, where);
      if (whereResult.sql) {
        const whereSqlParts = [];
        let paramIndex = 0;
        const sqlParts = whereResult.sql.split("?");
        for (let i = 0; i < sqlParts.length; i++) {
          if (i > 0) whereSqlParts.push(sql`${whereResult.params[paramIndex++]}`);
          if (sqlParts[i]) whereSqlParts.push(sql.raw(sqlParts[i]));
        }
        query = query.where(({ eb }) => eb(sql.join(whereSqlParts, sql.raw("")), "=", sql.raw("1")));
      }
    }
    return (await query.executeTakeFirst())?.count ?? 0;
  }
};
z.object({
  id: z.string(),
  src: z.string(),
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional()
});
z.object({
  _type: z.string(),
  _key: z.string()
}).passthrough();
const SEO_DEFAULTS$1 = {
  title: null,
  description: null,
  image: null,
  canonical: null,
  noIndex: false
};
function hasAnyField(input) {
  return input.title !== void 0 || input.description !== void 0 || input.image !== void 0 || input.canonical !== void 0 || input.noIndex !== void 0;
}
var SeoRepository = class {
  constructor(db) {
    this.db = db;
  }
  /**
  * Check whether a collection has SEO enabled (`has_seo = 1`).
  * Returns `false` if the collection does not exist.
  */
  async isEnabled(collection) {
    return (await this.db.selectFrom("_emdash_collections").select("has_seo").where("slug", "=", collection).executeTakeFirst())?.has_seo === 1;
  }
  /**
  * Get SEO data for a content item. Returns null defaults if no row exists.
  */
  async get(collection, contentId) {
    const row = await this.db.selectFrom("_emdash_seo").selectAll().where("collection", "=", collection).where("content_id", "=", contentId).executeTakeFirst();
    if (!row) return { ...SEO_DEFAULTS$1 };
    return {
      title: row.seo_title ?? null,
      description: row.seo_description ?? null,
      image: row.seo_image ?? null,
      canonical: row.seo_canonical ?? null,
      noIndex: row.seo_no_index === 1
    };
  }
  /**
  * Get SEO data for multiple content items.
  * Returns a Map keyed by content_id. Items without SEO rows get defaults.
  *
  * Chunks the `content_id IN (…)` clause so the total bound-parameter count
  * per statement (ids + the `collection = ?` filter) stays within Cloudflare
  * D1's 100-variable limit regardless of how many content items are passed.
  */
  async getMany(collection, contentIds) {
    const result = /* @__PURE__ */ new Map();
    if (contentIds.length === 0) return result;
    for (const id of contentIds) result.set(id, { ...SEO_DEFAULTS$1 });
    const uniqueContentIds = [...new Set(contentIds)];
    for (const chunk of chunks(uniqueContentIds, SQL_BATCH_SIZE)) {
      const rows = await this.db.selectFrom("_emdash_seo").selectAll().where("collection", "=", collection).where("content_id", "in", chunk).execute();
      for (const row of rows) result.set(row.content_id, {
        title: row.seo_title ?? null,
        description: row.seo_description ?? null,
        image: row.seo_image ?? null,
        canonical: row.seo_canonical ?? null,
        noIndex: row.seo_no_index === 1
      });
    }
    return result;
  }
  /**
  * Upsert SEO data for a content item using INSERT ON CONFLICT DO UPDATE
  * for atomicity. Skips no-op writes when input has no fields set.
  */
  async upsert(collection, contentId, input) {
    if (!hasAnyField(input)) return this.get(collection, contentId);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await sql`
			INSERT INTO _emdash_seo (
				collection, content_id,
				seo_title, seo_description, seo_image, seo_canonical, seo_no_index,
				created_at, updated_at
			) VALUES (
				${collection}, ${contentId},
				${input.title ?? null}, ${input.description ?? null},
				${input.image ?? null}, ${input.canonical ?? null},
				${input.noIndex ? 1 : 0},
				${now}, ${now}
			)
			ON CONFLICT (collection, content_id) DO UPDATE SET
				seo_title = ${input.title !== void 0 ? sql`${input.title}` : sql`_emdash_seo.seo_title`},
				seo_description = ${input.description !== void 0 ? sql`${input.description}` : sql`_emdash_seo.seo_description`},
				seo_image = ${input.image !== void 0 ? sql`${input.image}` : sql`_emdash_seo.seo_image`},
				seo_canonical = ${input.canonical !== void 0 ? sql`${input.canonical}` : sql`_emdash_seo.seo_canonical`},
				seo_no_index = ${input.noIndex !== void 0 ? sql`${input.noIndex ? 1 : 0}` : sql`_emdash_seo.seo_no_index`},
				updated_at = ${now}
		`.execute(this.db);
    return this.get(collection, contentId);
  }
  /**
  * Delete SEO data for a content item.
  */
  async delete(collection, contentId) {
    await this.db.deleteFrom("_emdash_seo").where("collection", "=", collection).where("content_id", "=", contentId).execute();
  }
  /**
  * Copy SEO data from one content item to another.
  * Used by duplicate. Clears canonical (it pointed to the original).
  */
  async copyForDuplicate(collection, sourceId, targetId) {
    const source = await this.get(collection, sourceId);
    if (source.title !== null || source.description !== null || source.image !== null || source.noIndex) await this.upsert(collection, targetId, {
      title: source.title,
      description: source.description,
      image: source.image,
      canonical: null,
      noIndex: source.noIndex
    });
  }
};
function encodeRev(item) {
  return encodeBase64(`${item.version}:${item.updatedAt}`);
}
function decodeRev(rev) {
  try {
    const decoded = decodeBase64(rev);
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return null;
    const version = parseInt(decoded.slice(0, colonIdx), 10);
    const updatedAt = decoded.slice(colonIdx + 1);
    if (isNaN(version) || !updatedAt) return null;
    return {
      version,
      updatedAt
    };
  } catch {
    return null;
  }
}
function validateRev(rev, item) {
  if (!rev) return { valid: true };
  const decoded = decodeRev(rev);
  if (!decoded) return {
    valid: false,
    message: "Malformed _rev token"
  };
  if (decoded.version !== item.version || decoded.updatedAt !== item.updatedAt) return {
    valid: false,
    message: "Content has been modified since last read (version conflict)"
  };
  return { valid: true };
}
function normalizeMime(mime2) {
  return mime2.split(";")[0].trim().toLowerCase();
}
function matchesMimeAllowlist(mime2, allowList) {
  const normalized = normalizeMime(mime2);
  for (const entry of allowList) {
    if (!entry || !entry.includes("/")) continue;
    const normalizedEntry = normalizeMime(entry);
    if (normalizedEntry.endsWith("/")) {
      if (normalized.startsWith(normalizedEntry)) return true;
    } else if (normalized === normalizedEntry) return true;
  }
  return false;
}
function parseAllowedMimeTypes(rawValidation) {
  if (!rawValidation) return null;
  try {
    const parsed = JSON.parse(rawValidation);
    if (typeof parsed !== "object" || parsed === null) return null;
    const list = parsed.allowedMimeTypes;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.filter((entry) => typeof entry === "string");
  } catch {
    return null;
  }
}
function asMediaRef(value) {
  if (value === null || value === void 0) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function fail(message) {
  return {
    success: false,
    error: {
      code: "INVALID_MIME_FOR_FIELD",
      message
    }
  };
}
async function loadMediaFieldsForCollection(db, collectionSlug) {
  const rows = await db.selectFrom("_emdash_fields").innerJoin("_emdash_collections", "_emdash_collections.id", "_emdash_fields.collection_id").select([
    "_emdash_fields.slug",
    "_emdash_fields.type",
    "_emdash_fields.validation"
  ]).where("_emdash_collections.slug", "=", collectionSlug).where("_emdash_fields.type", "in", ["file", "image"]).execute();
  const out = [];
  for (const row of rows) {
    const list = parseAllowedMimeTypes(row.validation);
    if (!list) continue;
    out.push({
      slug: row.slug,
      type: row.type,
      allowedMimeTypes: list
    });
  }
  return out;
}
async function validateMediaFields(db, collectionSlug, data) {
  const fields = await requestCached(`mediaFields:${collectionSlug}`, () => loadMediaFieldsForCollection(db, collectionSlug));
  if (fields.length === 0) return {
    success: true,
    data: true
  };
  const localIds = /* @__PURE__ */ new Set();
  for (const field of fields) {
    const ref = asMediaRef(data[field.slug]);
    if (!ref) continue;
    if ((typeof ref.provider === "string" ? ref.provider : "local") === "local" && typeof ref.id === "string") localIds.add(ref.id);
  }
  const idList = [...localIds];
  const mimeById = /* @__PURE__ */ new Map();
  if (idList.length > 0) for (const batch of chunks(idList, SQL_BATCH_SIZE)) {
    const rows = await db.selectFrom("media").select(["id", "mime_type"]).where("id", "in", batch).execute();
    for (const r of rows) mimeById.set(r.id, r.mime_type);
  }
  for (const field of fields) {
    const value = data[field.slug];
    if (value === null || value === void 0) continue;
    const ref = asMediaRef(value);
    if (!ref) continue;
    const provider = typeof ref.provider === "string" ? ref.provider : "local";
    let mime2;
    if (provider === "local") {
      if (typeof ref.id !== "string") return fail(`Field '${field.slug}' references media with an invalid id`);
      mime2 = mimeById.get(ref.id);
      if (!mime2) return fail(`Field '${field.slug}' references media with unknown MIME type`);
    } else {
      if (typeof ref.mimeType !== "string") return fail(`Field '${field.slug}' requires a mimeType declaration for non-local media`);
      mime2 = ref.mimeType;
    }
    if (!matchesMimeAllowlist(mime2, field.allowedMimeTypes)) return fail(`Field '${field.slug}' does not accept ${mime2}`);
  }
  return {
    success: true,
    data: true
  };
}
function hasApiError(error) {
  if (!(error instanceof Error) || !("apiError" in error)) return false;
  const { apiError } = error;
  return typeof apiError === "object" && apiError !== null && "code" in apiError && typeof apiError.code === "string";
}
function getSlugSource(data) {
  if (typeof data.title === "string" && data.title.length > 0) return data.title;
  if (typeof data.name === "string" && data.name.length > 0) return data.name;
  return null;
}
const SEO_DEFAULTS = {
  title: null,
  description: null,
  image: null,
  canonical: null,
  noIndex: false
};
async function collectionHasSeo(db, collection) {
  return (await db.selectFrom("_emdash_collections").select("has_seo").where("slug", "=", collection).executeTakeFirst())?.has_seo === 1;
}
async function hydrateSeo(db, collection, item, hasSeo) {
  if (!hasSeo) return;
  item.seo = await new SeoRepository(db).get(collection, item.id);
}
async function hydrateSeoMany(db, collection, items, hasSeo) {
  if (!hasSeo || items.length === 0) return;
  const seoMap = await new SeoRepository(db).getMany(collection, items.map((i) => i.id));
  for (const item of items) item.seo = seoMap.get(item.id) ?? { ...SEO_DEFAULTS };
}
async function hydrateBylines(db, collection, item) {
  const bylineRepo = new BylineRepository(db);
  const bylines = await bylineRepo.getContentBylines(collection, item.id);
  if (bylines.length > 0) {
    item.bylines = bylines.map((c) => ({
      ...c,
      source: "explicit"
    }));
    item.byline = bylines[0]?.byline ?? null;
    return;
  }
  if (item.primaryBylineId) item.primaryBylineId = null;
  if (item.authorId) {
    const fallback = await bylineRepo.findByUserId(item.authorId);
    if (fallback) {
      item.bylines = [{
        byline: fallback,
        sortOrder: 0,
        roleLabel: null,
        source: "inferred"
      }];
      item.byline = fallback;
      return;
    }
  }
  item.bylines = [];
  item.byline = null;
}
async function hydrateBylinesMany(db, collection, items) {
  if (items.length === 0) return;
  const bylineRepo = new BylineRepository(db);
  const contentIds = items.map((i) => i.id);
  const bylinesMap = await bylineRepo.getContentBylinesMany(collection, contentIds);
  const fallbackAuthorIds = [];
  for (const item of items) if (!bylinesMap.has(item.id) && item.authorId) fallbackAuthorIds.push(item.authorId);
  const uniqueAuthorIds = [...new Set(fallbackAuthorIds)];
  const authorBylineMap = await bylineRepo.findByUserIds(uniqueAuthorIds);
  for (const item of items) {
    const explicit = bylinesMap.get(item.id);
    if (explicit && explicit.length > 0) {
      item.bylines = explicit.map((c) => ({
        ...c,
        source: "explicit"
      }));
      item.byline = explicit[0]?.byline ?? null;
      continue;
    }
    if (item.primaryBylineId) item.primaryBylineId = null;
    if (item.authorId) {
      const fallback = authorBylineMap.get(item.authorId);
      if (fallback) {
        item.bylines = [{
          byline: fallback,
          sortOrder: 0,
          roleLabel: null,
          source: "inferred"
        }];
        item.byline = fallback;
        continue;
      }
    }
    item.bylines = [];
    item.byline = null;
  }
}
async function resolveId(repo, collection, identifier, locale) {
  return (await repo.findByIdOrSlug(collection, identifier, locale))?.id ?? null;
}
async function resolveIdIncludingTrashed(repo, collection, identifier, locale) {
  return (await repo.findByIdOrSlugIncludingTrashed(collection, identifier, locale))?.id ?? null;
}
async function handleContentList(db, collection, params) {
  try {
    const repo = new ContentRepository(db);
    const where = {};
    if (params.status) where.status = params.status;
    if (params.locale) where.locale = params.locale;
    const result = await repo.findMany(collection, {
      cursor: params.cursor,
      limit: params.limit || 50,
      where: Object.keys(where).length > 0 ? where : void 0,
      orderBy: params.orderBy ? {
        field: params.orderBy,
        direction: params.order || "desc"
      } : void 0
    });
    const hasSeo = await collectionHasSeo(db, collection);
    await hydrateSeoMany(db, collection, result.items, hasSeo);
    await hydrateBylinesMany(db, collection, result.items);
    return {
      success: true,
      data: {
        items: result.items,
        nextCursor: result.nextCursor
      }
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) return {
      success: false,
      error: {
        code: "INVALID_CURSOR",
        message: error.message
      }
    };
    if (isMissingTableError(error)) return {
      success: false,
      error: {
        code: "COLLECTION_NOT_FOUND",
        message: `Collection '${collection}' not found`
      }
    };
    if (error instanceof EmDashValidationError) return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message
      }
    };
    console.error("Content list error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_LIST_ERROR",
        message: "Failed to list content"
      }
    };
  }
}
async function handleContentGet(db, collection, id, locale) {
  try {
    const item = await new ContentRepository(db).findByIdOrSlug(collection, id, locale);
    if (!item) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Content item not found: ${id}`
      }
    };
    await hydrateSeo(db, collection, item, await collectionHasSeo(db, collection));
    await hydrateBylines(db, collection, item);
    return {
      success: true,
      data: {
        item,
        _rev: encodeRev(item)
      }
    };
  } catch (error) {
    console.error("Content get error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_GET_ERROR",
        message: "Failed to get content"
      }
    };
  }
}
async function handleContentGetIncludingTrashed(db, collection, id, locale) {
  try {
    const item = await new ContentRepository(db).findByIdOrSlugIncludingTrashed(collection, id, locale);
    if (!item) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Content item not found: ${id}`
      }
    };
    await hydrateSeo(db, collection, item, await collectionHasSeo(db, collection));
    await hydrateBylines(db, collection, item);
    return {
      success: true,
      data: {
        item,
        _rev: encodeRev(item)
      }
    };
  } catch (error) {
    console.error("Content get error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_GET_ERROR",
        message: "Failed to get content"
      }
    };
  }
}
async function handleContentCreate(db, collection, body) {
  try {
    const hasSeo = await collectionHasSeo(db, collection);
    if (body.seo && !hasSeo) return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Collection "${collection}" does not have SEO enabled. Remove the seo field or enable SEO on this collection.`
      }
    };
    const mimeCheck = await validateMediaFields(db, collection, body.data);
    if (!mimeCheck.success) return mimeCheck;
    const item = await withTransaction(db, async (trx) => {
      const repo = new ContentRepository(trx);
      const bylineRepo = new BylineRepository(trx);
      let slug = body.slug;
      if (!slug) {
        const slugSource = getSlugSource(body.data);
        if (slugSource) slug = await repo.generateUniqueSlug(collection, slugSource, body.locale);
      }
      const created = await repo.create({
        type: collection,
        slug,
        data: body.data,
        status: body.status || "draft",
        authorId: body.authorId,
        locale: body.locale,
        translationOf: body.translationOf,
        createdAt: body.createdAt,
        publishedAt: body.publishedAt
      });
      if (body.bylines !== void 0) {
        await bylineRepo.setContentBylines(collection, created.id, body.bylines);
        created.primaryBylineId = body.bylines[0]?.bylineId ?? null;
      }
      await hydrateBylines(trx, collection, created);
      if (body.translationOf) {
        const { TaxonomyRepository } = await Promise.resolve().then(() => taxonomyD6NvlKo8).then((n) => n.n);
        await new TaxonomyRepository(trx).copyEntryTerms(collection, body.translationOf, created.id);
      }
      if (body.seo && hasSeo) created.seo = await new SeoRepository(trx).upsert(collection, created.id, body.seo);
      else if (hasSeo) created.seo = { ...SEO_DEFAULTS };
      return created;
    });
    return {
      success: true,
      data: {
        item,
        _rev: encodeRev(item)
      }
    };
  } catch (error) {
    if (isMissingTableError(error)) return {
      success: false,
      error: {
        code: "COLLECTION_NOT_FOUND",
        message: `Collection '${collection}' not found`
      }
    };
    if (error instanceof EmDashValidationError) return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message
      }
    };
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("unique constraint failed") || message.includes("duplicate key")) {
      if (message.includes("slug")) return {
        success: false,
        error: {
          code: "SLUG_CONFLICT",
          message: `Slug '${body.slug ?? "(auto-generated)"}' already exists in collection '${collection}'`
        }
      };
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Unique constraint violation"
        }
      };
    }
    console.error("Content create error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_CREATE_ERROR",
        message: "Failed to create content"
      }
    };
  }
}
async function handleContentUpdate(db, collection, id, body) {
  try {
    const hasSeo = await collectionHasSeo(db, collection);
    if (body.seo && !hasSeo) return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Collection "${collection}" does not have SEO enabled. Remove the seo field or enable SEO on this collection.`
      }
    };
    if (body.data) {
      const mimeCheck = await validateMediaFields(db, collection, body.data);
      if (!mimeCheck.success) return mimeCheck;
    }
    const resolvedId = await resolveId(new ContentRepository(db), collection, id) ?? id;
    const item = await withTransaction(db, async (trx) => {
      const trxRepo = new ContentRepository(trx);
      const bylineRepo = new BylineRepository(trx);
      const existing = body._rev || body.slug ? await trxRepo.findById(collection, resolvedId) : null;
      if (body._rev) {
        if (!existing) throw Object.assign(/* @__PURE__ */ new Error(`Content item not found: ${id}`), { apiError: { code: "NOT_FOUND" } });
        const revCheck = validateRev(body._rev, existing);
        if (!revCheck.valid) throw Object.assign(new Error(revCheck.message), { apiError: { code: "CONFLICT" } });
      }
      let oldSlug;
      if (body.slug && existing?.slug && existing.slug !== body.slug) oldSlug = existing.slug;
      const updated = await trxRepo.update(collection, resolvedId, {
        data: body.data,
        slug: body.slug,
        status: body.status,
        authorId: body.authorId,
        publishedAt: body.publishedAt
      });
      if (body.bylines !== void 0) {
        await bylineRepo.setContentBylines(collection, resolvedId, body.bylines);
        updated.primaryBylineId = body.bylines[0]?.bylineId ?? null;
      }
      if (oldSlug && body.slug) {
        const collectionRow = await trx.selectFrom("_emdash_collections").select("url_pattern").where("slug", "=", collection).executeTakeFirst();
        await new RedirectRepository(trx).createAutoRedirect(collection, oldSlug, body.slug, resolvedId, collectionRow?.url_pattern ?? null);
        invalidateRedirectCache();
      }
      if (isI18nEnabled() && body.data && updated.translationGroup) await syncNonTranslatableFields(trx, collection, updated.id, updated.translationGroup, body.data);
      if (body.seo && hasSeo) updated.seo = await new SeoRepository(trx).upsert(collection, resolvedId, body.seo);
      else if (hasSeo) updated.seo = await new SeoRepository(trx).get(collection, resolvedId);
      await hydrateBylines(trx, collection, updated);
      return updated;
    });
    return {
      success: true,
      data: {
        item,
        _rev: encodeRev(item)
      }
    };
  } catch (error) {
    if (hasApiError(error)) return {
      success: false,
      error: {
        code: error.apiError.code,
        message: error.message
      }
    };
    if (isMissingTableError(error)) return {
      success: false,
      error: {
        code: "COLLECTION_NOT_FOUND",
        message: `Collection '${collection}' not found`
      }
    };
    if (error instanceof EmDashValidationError) return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message
      }
    };
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("unique constraint failed") || message.includes("duplicate key")) {
      if (message.includes("slug")) return {
        success: false,
        error: {
          code: "SLUG_CONFLICT",
          message: `Slug '${body.slug ?? id}' already exists in collection '${collection}'`
        }
      };
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Unique constraint violation"
        }
      };
    }
    console.error("Content update error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_UPDATE_ERROR",
        message: "Failed to update content"
      }
    };
  }
}
async function handleContentDuplicate(db, collection, id, authorId) {
  try {
    const hasSeo = await collectionHasSeo(db, collection);
    return {
      success: true,
      data: { item: await withTransaction(db, async (trx) => {
        const repo = new ContentRepository(trx);
        const bylineRepo = new BylineRepository(trx);
        const resolvedId = await resolveId(repo, collection, id) ?? id;
        const dup = await repo.duplicate(collection, resolvedId, authorId);
        const existingBylines = await bylineRepo.getContentBylines(collection, resolvedId);
        if (existingBylines.length > 0) await bylineRepo.setContentBylines(collection, dup.id, existingBylines.map((entry) => ({
          bylineId: entry.byline.id,
          roleLabel: entry.roleLabel
        })));
        if (hasSeo) {
          const seoRepo = new SeoRepository(trx);
          await seoRepo.copyForDuplicate(collection, resolvedId, dup.id);
          dup.seo = await seoRepo.get(collection, dup.id);
        }
        await hydrateBylines(trx, collection, dup);
        return dup;
      }) }
    };
  } catch (err) {
    if (err instanceof EmDashValidationError) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: err.message
      }
    };
    console.error("Content duplicate error:", err);
    return {
      success: false,
      error: {
        code: "CONTENT_DUPLICATE_ERROR",
        message: "Failed to duplicate content"
      }
    };
  }
}
async function handleContentDelete(db, collection, id) {
  try {
    if (!await withTransaction(db, async (trx) => {
      const repo = new ContentRepository(trx);
      const resolvedId = await resolveId(repo, collection, id) ?? id;
      return repo.delete(collection, resolvedId);
    })) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Content item not found: ${id}`
      }
    };
    return {
      success: true,
      data: { deleted: true }
    };
  } catch (error) {
    console.error("Content delete error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_DELETE_ERROR",
        message: "Failed to delete content"
      }
    };
  }
}
async function handleContentRestore(db, collection, id) {
  try {
    if (!await withTransaction(db, async (trx) => {
      const repo = new ContentRepository(trx);
      const resolvedId = await resolveIdIncludingTrashed(repo, collection, id) ?? id;
      return repo.restore(collection, resolvedId);
    })) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Trashed content item not found: ${id}`
      }
    };
    return {
      success: true,
      data: { restored: true }
    };
  } catch (error) {
    console.error("Content restore error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_RESTORE_ERROR",
        message: "Failed to restore content"
      }
    };
  }
}
async function handleContentPermanentDelete(db, collection, id) {
  try {
    const resolvedId = await resolveIdIncludingTrashed(new ContentRepository(db), collection, id) ?? id;
    if (!await withTransaction(db, async (trx) => {
      const wasDeleted = await new ContentRepository(trx).permanentDelete(collection, resolvedId);
      if (wasDeleted) {
        await new SeoRepository(trx).delete(collection, resolvedId);
        await new CommentRepository(trx).deleteByContent(collection, resolvedId);
        await new RevisionRepository(trx).deleteByEntry(collection, resolvedId);
      }
      return wasDeleted;
    })) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Content item not found: ${id}`
      }
    };
    return {
      success: true,
      data: { deleted: true }
    };
  } catch (error) {
    console.error("Content permanent delete error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_DELETE_ERROR",
        message: "Failed to permanently delete content"
      }
    };
  }
}
async function handleContentListTrashed(db, collection, options = {}) {
  try {
    const result = await new ContentRepository(db).findTrashed(collection, {
      limit: options.limit,
      cursor: options.cursor
    });
    return {
      success: true,
      data: {
        items: result.items.map((item) => ({
          id: item.id,
          type: item.type,
          slug: item.slug,
          status: item.status,
          data: item.data,
          authorId: item.authorId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          publishedAt: item.publishedAt,
          deletedAt: item.deletedAt
        })),
        nextCursor: result.nextCursor
      }
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) return {
      success: false,
      error: {
        code: "INVALID_CURSOR",
        message: error.message
      }
    };
    console.error("Content list trashed error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_LIST_ERROR",
        message: "Failed to list trashed content"
      }
    };
  }
}
async function handleContentCountTrashed(db, collection) {
  try {
    return {
      success: true,
      data: { count: await new ContentRepository(db).countTrashed(collection) }
    };
  } catch (error) {
    console.error("Content count trashed error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_COUNT_ERROR",
        message: "Failed to count trashed content"
      }
    };
  }
}
async function handleContentSchedule(db, collection, id, scheduledAt) {
  try {
    const item = await withTransaction(db, async (trx) => {
      const repo = new ContentRepository(trx);
      const resolvedId = await resolveId(repo, collection, id) ?? id;
      return repo.schedule(collection, resolvedId, scheduledAt);
    });
    await hydrateSeo(db, collection, item, await collectionHasSeo(db, collection));
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof EmDashValidationError) return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message
      }
    };
    console.error("Content schedule error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_SCHEDULE_ERROR",
        message: "Failed to schedule content"
      }
    };
  }
}
async function handleContentUnschedule(db, collection, id) {
  try {
    const item = await withTransaction(db, async (trx) => {
      const repo = new ContentRepository(trx);
      const resolvedId = await resolveId(repo, collection, id) ?? id;
      return repo.unschedule(collection, resolvedId);
    });
    await hydrateSeo(db, collection, item, await collectionHasSeo(db, collection));
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof EmDashValidationError) return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message
      }
    };
    console.error("Content unschedule error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_UNSCHEDULE_ERROR",
        message: "Failed to unschedule content"
      }
    };
  }
}
async function handleContentPublish(db, collection, id, options = {}) {
  try {
    const item = await withTransaction(db, async (trx) => {
      const repo = new ContentRepository(trx);
      const resolvedId = await resolveId(repo, collection, id) ?? id;
      return repo.publish(collection, resolvedId, options.publishedAt);
    });
    await hydrateSeo(db, collection, item, await collectionHasSeo(db, collection));
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof EmDashValidationError) return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message
      }
    };
    console.error("Content publish error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_PUBLISH_ERROR",
        message: "Failed to publish content"
      }
    };
  }
}
async function handleContentUnpublish(db, collection, id) {
  try {
    const item = await withTransaction(db, async (trx) => {
      const repo = new ContentRepository(trx);
      const resolvedId = await resolveId(repo, collection, id) ?? id;
      return repo.unpublish(collection, resolvedId);
    });
    await hydrateSeo(db, collection, item, await collectionHasSeo(db, collection));
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof EmDashValidationError) return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message
      }
    };
    console.error("Content unpublish error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_UNPUBLISH_ERROR",
        message: "Failed to unpublish content"
      }
    };
  }
}
async function handleContentCountScheduled(db, collection) {
  try {
    return {
      success: true,
      data: { count: await new ContentRepository(db).countScheduled(collection) }
    };
  } catch (error) {
    console.error("Content count scheduled error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_COUNT_ERROR",
        message: "Failed to count scheduled content"
      }
    };
  }
}
async function handleContentDiscardDraft(db, collection, id) {
  try {
    const item = await withTransaction(db, async (trx) => {
      const repo = new ContentRepository(trx);
      const resolvedId = await resolveId(repo, collection, id) ?? id;
      return repo.discardDraft(collection, resolvedId);
    });
    await hydrateSeo(db, collection, item, await collectionHasSeo(db, collection));
    return {
      success: true,
      data: { item }
    };
  } catch (error) {
    if (error instanceof EmDashValidationError) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: error.message
      }
    };
    console.error("Content discard draft error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_DISCARD_DRAFT_ERROR",
        message: "Failed to discard draft"
      }
    };
  }
}
async function handleContentCompare(db, collection, id) {
  try {
    const entry = await new ContentRepository(db).findByIdOrSlug(collection, id);
    if (!entry) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Content item not found: ${id}`
      }
    };
    const revisionRepo = new RevisionRepository(db);
    const live = entry.liveRevisionId ? await revisionRepo.findById(entry.liveRevisionId) : null;
    const draft = entry.draftRevisionId ? await revisionRepo.findById(entry.draftRevisionId) : null;
    return {
      success: true,
      data: {
        hasChanges: entry.draftRevisionId !== null && entry.draftRevisionId !== entry.liveRevisionId,
        live: live?.data ?? null,
        draft: draft?.data ?? null
      }
    };
  } catch (error) {
    console.error("Content compare error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_COMPARE_ERROR",
        message: "Failed to compare revisions"
      }
    };
  }
}
async function handleContentTranslations(db, collection, id) {
  try {
    const repo = new ContentRepository(db);
    const item = await repo.findByIdOrSlug(collection, id);
    if (!item) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Content item not found: ${id}`
      }
    };
    if (!item.translationGroup) return {
      success: true,
      data: {
        translationGroup: item.id,
        translations: [{
          id: item.id,
          locale: item.locale,
          slug: item.slug,
          status: item.status,
          updatedAt: item.updatedAt
        }]
      }
    };
    const translations = await repo.findTranslations(collection, item.translationGroup);
    return {
      success: true,
      data: {
        translationGroup: item.translationGroup,
        translations: translations.map((t) => ({
          id: t.id,
          locale: t.locale,
          slug: t.slug,
          status: t.status,
          updatedAt: t.updatedAt
        }))
      }
    };
  } catch (error) {
    if (error instanceof Error) console.error("Content translations error:", error);
    return {
      success: false,
      error: {
        code: "CONTENT_TRANSLATIONS_ERROR",
        message: "Failed to get translations"
      }
    };
  }
}
async function syncNonTranslatableFields(trx, collectionSlug, updatedItemId, translationGroup, data) {
  const collection = await trx.selectFrom("_emdash_collections").select("id").where("slug", "=", collectionSlug).executeTakeFirst();
  if (!collection) return;
  const nonTranslatableSlugs = (await trx.selectFrom("_emdash_fields").select("slug").where("collection_id", "=", collection.id).where("translatable", "=", 0).execute()).map((f) => f.slug);
  if (nonTranslatableSlugs.length === 0) return;
  const syncData = {};
  for (const slug of nonTranslatableSlugs) if (slug in data) syncData[slug] = data[slug];
  if (Object.keys(syncData).length === 0) return;
  validateIdentifier(collectionSlug, "collection slug");
  const tableName = `ec_${collectionSlug}`;
  const setClauses = Object.entries(syncData).map(([key, value]) => {
    validateIdentifier(key, "field slug");
    const serialized = typeof value === "object" && value !== null ? JSON.stringify(value) : value;
    return sql`${sql.ref(key)} = ${serialized}`;
  });
  await sql`
		UPDATE ${sql.ref(tableName)}
		SET ${sql.join(setClauses, sql`, `)}
		WHERE translation_group = ${translationGroup}
		AND id != ${updatedItemId}
	`.execute(trx);
}
async function handleRevisionList(db, collection, entryId, params = {}) {
  try {
    const repo = new RevisionRepository(db);
    const [items, total] = await Promise.all([repo.findByEntry(collection, entryId, { limit: Math.min(params.limit || 50, 100) }), repo.countByEntry(collection, entryId)]);
    return {
      success: true,
      data: {
        items,
        total
      }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "REVISION_LIST_ERROR",
        message: "Failed to list revisions"
      }
    };
  }
}
async function handleRevisionGet(db, revisionId) {
  try {
    const item = await new RevisionRepository(db).findById(revisionId);
    if (!item) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Revision not found: ${revisionId}`
      }
    };
    return {
      success: true,
      data: { item }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "REVISION_GET_ERROR",
        message: "Failed to get revision"
      }
    };
  }
}
async function handleRevisionRestore(db, revisionId, callerUserId) {
  try {
    const revision = await new RevisionRepository(db).findById(revisionId);
    if (!revision) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Revision not found: ${revisionId}`
      }
    };
    const { _slug, ...fieldData } = revision.data;
    const item = await withTransaction(db, async (trx) => {
      const trxContentRepo = new ContentRepository(trx);
      const trxRevisionRepo = new RevisionRepository(trx);
      const updated = await trxContentRepo.update(revision.collection, revision.entryId, {
        data: fieldData,
        slug: typeof _slug === "string" ? _slug : void 0
      });
      await trxRevisionRepo.create({
        collection: revision.collection,
        entryId: revision.entryId,
        data: revision.data,
        authorId: callerUserId
      });
      return updated;
    });
    new RevisionRepository(db).pruneOldRevisions(revision.collection, revision.entryId, 50).catch(() => {
    });
    return {
      success: true,
      data: { item }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "REVISION_RESTORE_ERROR",
        message: "Failed to restore revision"
      }
    };
  }
}
async function handleMediaList(db, params) {
  try {
    const result = await new MediaRepository(db).findMany({
      cursor: params.cursor,
      limit: Math.min(params.limit || 50, 100),
      mimeType: params.mimeType
    });
    return {
      success: true,
      data: {
        items: result.items,
        nextCursor: result.nextCursor
      }
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) return {
      success: false,
      error: {
        code: "INVALID_CURSOR",
        message: error.message
      }
    };
    return {
      success: false,
      error: {
        code: "MEDIA_LIST_ERROR",
        message: "Failed to list media"
      }
    };
  }
}
async function handleMediaGet(db, id) {
  try {
    const item = await new MediaRepository(db).findById(id);
    if (!item) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Media item not found: ${id}`
      }
    };
    return {
      success: true,
      data: { item }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "MEDIA_GET_ERROR",
        message: "Failed to get media"
      }
    };
  }
}
async function handleMediaCreate(db, input) {
  try {
    return {
      success: true,
      data: { item: await new MediaRepository(db).create(input) }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "MEDIA_CREATE_ERROR",
        message: "Failed to create media"
      }
    };
  }
}
async function handleMediaUpdate(db, id, input) {
  try {
    const item = await new MediaRepository(db).update(id, input);
    if (!item) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Media item not found: ${id}`
      }
    };
    return {
      success: true,
      data: { item }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "MEDIA_UPDATE_ERROR",
        message: "Failed to update media"
      }
    };
  }
}
async function handleMediaDelete(db, id) {
  try {
    if (!await new MediaRepository(db).delete(id)) return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Media item not found: ${id}`
      }
    };
    return {
      success: true,
      data: { deleted: true }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "MEDIA_DELETE_ERROR",
        message: "Failed to delete media"
      }
    };
  }
}
function toPluginStatus(value) {
  if (value === "active") return "active";
  return "inactive";
}
function toPluginSource(value) {
  if (value === "marketplace") return "marketplace";
  return "config";
}
var PluginStateRepository = class {
  constructor(db) {
    this.db = db;
  }
  /**
  * Get state for a specific plugin
  */
  async get(pluginId) {
    const row = await this.db.selectFrom("_plugin_state").selectAll().where("plugin_id", "=", pluginId).executeTakeFirst();
    if (!row) return null;
    return {
      pluginId: row.plugin_id,
      status: toPluginStatus(row.status),
      version: row.version,
      installedAt: new Date(row.installed_at),
      activatedAt: row.activated_at ? new Date(row.activated_at) : null,
      deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
      source: toPluginSource(row.source),
      marketplaceVersion: row.marketplace_version ?? null,
      displayName: row.display_name ?? null,
      description: row.description ?? null
    };
  }
  /**
  * Get all plugin states
  */
  async getAll() {
    return (await this.db.selectFrom("_plugin_state").selectAll().execute()).map((row) => ({
      pluginId: row.plugin_id,
      status: toPluginStatus(row.status),
      version: row.version,
      installedAt: new Date(row.installed_at),
      activatedAt: row.activated_at ? new Date(row.activated_at) : null,
      deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
      source: toPluginSource(row.source),
      marketplaceVersion: row.marketplace_version ?? null,
      displayName: row.display_name ?? null,
      description: row.description ?? null
    }));
  }
  /**
  * Get all marketplace-installed plugin states
  */
  async getMarketplacePlugins() {
    return (await this.db.selectFrom("_plugin_state").selectAll().where("source", "=", "marketplace").execute()).map((row) => ({
      pluginId: row.plugin_id,
      status: toPluginStatus(row.status),
      version: row.version,
      installedAt: new Date(row.installed_at),
      activatedAt: row.activated_at ? new Date(row.activated_at) : null,
      deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
      source: toPluginSource(row.source),
      marketplaceVersion: row.marketplace_version ?? null,
      displayName: row.display_name ?? null,
      description: row.description ?? null
    }));
  }
  /**
  * Create or update plugin state
  */
  async upsert(pluginId, version, status, opts) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await this.get(pluginId);
    if (existing) {
      const updates = {
        status,
        version
      };
      if (status === "active" && existing.status !== "active") updates.activated_at = now;
      else if (status === "inactive" && existing.status !== "inactive") updates.deactivated_at = now;
      if (opts?.source) updates.source = opts.source;
      if (opts?.marketplaceVersion !== void 0) updates.marketplace_version = opts.marketplaceVersion;
      if (opts?.displayName !== void 0) updates.display_name = opts.displayName;
      if (opts?.description !== void 0) updates.description = opts.description;
      await this.db.updateTable("_plugin_state").set(updates).where("plugin_id", "=", pluginId).execute();
    } else await this.db.insertInto("_plugin_state").values({
      plugin_id: pluginId,
      status,
      version,
      installed_at: now,
      activated_at: status === "active" ? now : null,
      deactivated_at: null,
      data: null,
      source: opts?.source ?? "config",
      marketplace_version: opts?.marketplaceVersion ?? null,
      display_name: opts?.displayName ?? null,
      description: opts?.description ?? null
    }).execute();
    return await this.get(pluginId);
  }
  /**
  * Enable a plugin
  */
  async enable(pluginId, version) {
    return this.upsert(pluginId, version, "active");
  }
  /**
  * Disable a plugin
  */
  async disable(pluginId, version) {
    return this.upsert(pluginId, version, "inactive");
  }
  /**
  * Delete plugin state
  */
  async delete(pluginId) {
    return ((await this.db.deleteFrom("_plugin_state").where("plugin_id", "=", pluginId).executeTakeFirst()).numDeletedRows ?? 0) > 0;
  }
};
const VERSION_PATTERN = /^[a-z0-9][a-z0-9._+-]*$/i;
function validateVersion(version) {
  if (version.includes("..")) throw new Error("Invalid version format");
  if (!VERSION_PATTERN.test(version)) throw new Error("Invalid version format");
}
async function streamToText(stream) {
  return new Response(stream).text();
}
async function loadBundleFromR2(storage, pluginId, version) {
  validatePluginIdentifier(pluginId, "plugin ID");
  validateVersion(version);
  const prefix = `marketplace/${pluginId}/${version}`;
  try {
    const manifestResult = await storage.download(`${prefix}/manifest.json`);
    const backendResult = await storage.download(`${prefix}/backend.js`);
    const manifestText = await streamToText(manifestResult.body);
    const backendCode = await streamToText(backendResult.body);
    const parsed = JSON.parse(manifestText);
    const result = pluginManifestSchema.safeParse(parsed);
    if (!result.success) return null;
    const manifest = result.data;
    let adminCode;
    try {
      adminCode = await streamToText((await storage.download(`${prefix}/admin.js`)).body);
    } catch {
    }
    return {
      manifest,
      backendCode,
      adminCode
    };
  } catch {
    return null;
  }
}
const VALID_ROLE_LEVELS = /* @__PURE__ */ new Set([
  10,
  20,
  30,
  40,
  50
]);
const roleLevel = z$1.coerce.number().int().refine((n) => VALID_ROLE_LEVELS.has(n), { message: "Invalid role level. Must be 10, 20, 30, 40, or 50" });
const cursorPaginationQuery = z$1.object({
  cursor: z$1.string().max(2048).optional().meta({ description: "Opaque cursor for pagination" }),
  limit: z$1.coerce.number().int().min(1).max(100).optional().default(50).meta({ description: "Maximum number of items to return (1-100, default 50)" })
}).meta({ id: "CursorPaginationQuery" });
z$1.object({
  limit: z$1.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z$1.coerce.number().int().min(0).optional().default(0)
}).meta({ id: "OffsetPaginationQuery" });
const slugPattern = /^[a-z][a-z0-9_]*$/;
const HTTP_SCHEME_RE = /^https?:\/\//i;
const httpUrl = z$1.string().url().refine((url) => HTTP_SCHEME_RE.test(url), "URL must use http or https");
const localeCode = z$1.string().regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i, "Invalid locale code").transform((v) => v.toLowerCase());
z$1.object({ locale: z$1.string().min(1).optional() }).meta({ id: "LocaleFilterQuery" });
z$1.object({ error: z$1.object({
  code: z$1.string().meta({
    description: "Machine-readable error code",
    example: "NOT_FOUND"
  }),
  message: z$1.string().meta({ description: "Human-readable error message" })
}) }).meta({ id: "ApiError" });
z$1.object({ deleted: z$1.literal(true) }).meta({ id: "DeleteResponse" });
z$1.object({ count: z$1.number().int().min(0) }).meta({ id: "CountResponse" });
const bylineSlugPattern = /^[a-z][a-z0-9-]*$/;
const bylineSummarySchema = z$1.object({
  id: z$1.string(),
  slug: z$1.string(),
  displayName: z$1.string(),
  bio: z$1.string().nullable(),
  avatarMediaId: z$1.string().nullable(),
  websiteUrl: z$1.string().nullable(),
  userId: z$1.string().nullable(),
  isGuest: z$1.boolean(),
  createdAt: z$1.string(),
  updatedAt: z$1.string()
}).meta({ id: "BylineSummary" });
const bylineCreditSchema = z$1.object({
  byline: bylineSummarySchema,
  sortOrder: z$1.number().int(),
  roleLabel: z$1.string().nullable(),
  source: z$1.enum(["explicit", "inferred"]).optional().meta({ description: "Whether this credit was explicitly assigned or inferred from authorId" })
}).meta({ id: "BylineCredit" });
const contentBylineInputSchema = z$1.object({
  bylineId: z$1.string().min(1),
  roleLabel: z$1.string().nullish()
}).meta({ id: "ContentBylineInput" });
cursorPaginationQuery.extend({
  search: z$1.string().optional(),
  isGuest: z$1.coerce.boolean().optional(),
  userId: z$1.string().optional()
}).meta({ id: "BylinesListQuery" });
z$1.object({
  slug: z$1.string().min(1).regex(bylineSlugPattern, "Slug must contain only lowercase letters, digits, and hyphens"),
  displayName: z$1.string().min(1),
  bio: z$1.string().nullish(),
  avatarMediaId: z$1.string().nullish(),
  websiteUrl: httpUrl.nullish(),
  userId: z$1.string().nullish(),
  isGuest: z$1.boolean().optional()
}).meta({ id: "BylineCreateBody" });
z$1.object({
  slug: z$1.string().min(1).regex(bylineSlugPattern, "Slug must contain only lowercase letters, digits, and hyphens").optional(),
  displayName: z$1.string().min(1).optional(),
  bio: z$1.string().nullish(),
  avatarMediaId: z$1.string().nullish(),
  websiteUrl: httpUrl.nullish(),
  userId: z$1.string().nullish(),
  isGuest: z$1.boolean().optional()
}).meta({ id: "BylineUpdateBody" });
z$1.object({
  items: z$1.array(bylineSummarySchema),
  nextCursor: z$1.string().optional()
}).meta({ id: "BylineListResponse" });
const contentSeoInput = z$1.object({
  title: z$1.string().max(200).nullish(),
  description: z$1.string().max(500).nullish(),
  image: z$1.string().nullish(),
  canonical: httpUrl.nullish(),
  noIndex: z$1.boolean().optional()
}).meta({ id: "ContentSeoInput" });
cursorPaginationQuery.extend({
  status: z$1.string().optional(),
  orderBy: z$1.string().optional(),
  order: z$1.enum(["asc", "desc"]).optional(),
  locale: localeCode.optional()
}).meta({ id: "ContentListQuery" });
const contentDateOverride = z$1.iso.datetime({
  offset: true,
  message: "must be an ISO 8601 datetime"
}).nullish();
z$1.object({
  data: z$1.record(z$1.string(), z$1.unknown()),
  slug: z$1.string().nullish(),
  status: z$1.enum(["draft"]).optional(),
  bylines: z$1.array(contentBylineInputSchema).optional(),
  locale: localeCode.optional(),
  translationOf: z$1.string().optional(),
  seo: contentSeoInput.optional(),
  publishedAt: contentDateOverride,
  createdAt: contentDateOverride
}).meta({ id: "ContentCreateBody" });
z$1.object({
  data: z$1.record(z$1.string(), z$1.unknown()).optional(),
  slug: z$1.string().nullish(),
  status: z$1.enum(["draft"]).optional(),
  authorId: z$1.string().nullish(),
  bylines: z$1.array(contentBylineInputSchema).optional(),
  _rev: z$1.string().optional().meta({ description: "Opaque revision token for optimistic concurrency" }),
  skipRevision: z$1.boolean().optional(),
  seo: contentSeoInput.optional(),
  publishedAt: contentDateOverride
}).meta({ id: "ContentUpdateBody" });
z$1.object({ scheduledAt: z$1.string().min(1, "scheduledAt is required").meta({
  description: "ISO 8601 datetime for scheduled publishing",
  example: "2025-06-15T09:00:00Z"
}) }).meta({ id: "ContentScheduleBody" });
z$1.object({ publishedAt: z$1.iso.datetime({
  offset: true,
  message: "must be an ISO 8601 datetime"
}).optional().meta({ description: "Optional ISO 8601 datetime to backdate the publish (e.g. when migrating content). Requires content:publish_any permission. Without this, existing published_at is preserved on re-publish." }) }).meta({ id: "ContentPublishBody" });
z$1.object({
  expiresIn: z$1.union([z$1.string(), z$1.number()]).optional(),
  pathPattern: z$1.string().optional()
}).meta({ id: "ContentPreviewUrlBody" });
z$1.object({ termIds: z$1.array(z$1.string()) }).meta({ id: "ContentTermsBody" });
const contentSeoSchema = z$1.object({
  title: z$1.string().nullable(),
  description: z$1.string().nullable(),
  image: z$1.string().nullable(),
  canonical: z$1.string().nullable(),
  noIndex: z$1.boolean()
}).meta({ id: "ContentSeo" });
const contentItemSchema = z$1.object({
  id: z$1.string(),
  type: z$1.string().meta({ description: "Collection slug this item belongs to" }),
  slug: z$1.string().nullable(),
  status: z$1.string().meta({ description: "draft, published, or scheduled" }),
  data: z$1.record(z$1.string(), z$1.unknown()).meta({ description: "User-defined field values" }),
  authorId: z$1.string().nullable(),
  primaryBylineId: z$1.string().nullable(),
  byline: bylineSummarySchema.nullable().optional(),
  bylines: z$1.array(bylineCreditSchema).optional(),
  createdAt: z$1.string(),
  updatedAt: z$1.string(),
  publishedAt: z$1.string().nullable(),
  scheduledAt: z$1.string().nullable(),
  liveRevisionId: z$1.string().nullable(),
  draftRevisionId: z$1.string().nullable(),
  version: z$1.number().int(),
  locale: z$1.string().nullable(),
  translationGroup: z$1.string().nullable(),
  seo: contentSeoSchema.optional()
}).meta({ id: "ContentItem" });
z$1.object({
  item: contentItemSchema,
  _rev: z$1.string().optional().meta({ description: "Opaque revision token for optimistic concurrency" })
}).meta({ id: "ContentResponse" });
z$1.object({
  items: z$1.array(contentItemSchema),
  nextCursor: z$1.string().optional()
}).meta({ id: "ContentListResponse" });
const trashedContentItemSchema = z$1.object({
  id: z$1.string(),
  type: z$1.string(),
  slug: z$1.string().nullable(),
  status: z$1.string(),
  data: z$1.record(z$1.string(), z$1.unknown()),
  authorId: z$1.string().nullable(),
  createdAt: z$1.string(),
  updatedAt: z$1.string(),
  publishedAt: z$1.string().nullable(),
  deletedAt: z$1.string()
}).meta({ id: "TrashedContentItem" });
z$1.object({
  items: z$1.array(trashedContentItemSchema),
  nextCursor: z$1.string().optional()
}).meta({ id: "TrashedContentListResponse" });
z$1.object({
  hasChanges: z$1.boolean(),
  live: z$1.record(z$1.string(), z$1.unknown()).nullable(),
  draft: z$1.record(z$1.string(), z$1.unknown()).nullable()
}).meta({ id: "ContentCompareResponse" });
const contentTranslationSchema = z$1.object({
  id: z$1.string(),
  locale: z$1.string().nullable(),
  slug: z$1.string().nullable(),
  status: z$1.string(),
  updatedAt: z$1.string()
});
z$1.object({
  translationGroup: z$1.string(),
  translations: z$1.array(contentTranslationSchema)
}).meta({ id: "ContentTranslationsResponse" });
const mimeTypeFilter = z$1.union([z$1.string(), z$1.array(z$1.string())]).transform((v) => {
  return (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter((s) => s.length > 0);
}).optional();
cursorPaginationQuery.extend({ mimeType: mimeTypeFilter }).meta({ id: "MediaListQuery" });
z$1.object({
  alt: z$1.string().optional(),
  caption: z$1.string().optional(),
  width: z$1.number().int().positive().optional(),
  height: z$1.number().int().positive().optional()
}).meta({ id: "MediaUpdateBody" });
z$1.object({
  size: z$1.number().int().positive().optional(),
  width: z$1.number().int().positive().optional(),
  height: z$1.number().int().positive().optional()
}).meta({ id: "MediaConfirmBody" });
cursorPaginationQuery.extend({
  query: z$1.string().optional(),
  mimeType: mimeTypeFilter
}).meta({ id: "MediaProviderListQuery" });
const mediaStatusSchema = z$1.enum([
  "pending",
  "ready",
  "failed"
]);
const mediaItemSchema = z$1.object({
  id: z$1.string(),
  filename: z$1.string(),
  mimeType: z$1.string(),
  size: z$1.number().nullable(),
  width: z$1.number().nullable(),
  height: z$1.number().nullable(),
  alt: z$1.string().nullable(),
  caption: z$1.string().nullable(),
  storageKey: z$1.string(),
  status: mediaStatusSchema,
  contentHash: z$1.string().nullable(),
  blurhash: z$1.string().nullable(),
  dominantColor: z$1.string().nullable(),
  createdAt: z$1.string(),
  authorId: z$1.string().nullable()
}).meta({ id: "MediaItem" });
z$1.object({ item: mediaItemSchema }).meta({ id: "MediaResponse" });
z$1.object({
  items: z$1.array(mediaItemSchema),
  nextCursor: z$1.string().optional()
}).meta({ id: "MediaListResponse" });
z$1.object({
  uploadUrl: z$1.string(),
  method: z$1.literal("PUT"),
  headers: z$1.record(z$1.string(), z$1.string()),
  mediaId: z$1.string(),
  storageKey: z$1.string(),
  expiresAt: z$1.string()
}).meta({ id: "MediaUploadUrlResponse" });
z$1.object({
  existing: z$1.literal(true),
  mediaId: z$1.string(),
  storageKey: z$1.string(),
  url: z$1.string()
}).meta({ id: "MediaExistingResponse" });
z$1.object({ item: mediaItemSchema.extend({ url: z$1.string() }) }).meta({ id: "MediaConfirmResponse" });
const collectionSupportValues = z$1.enum([
  "drafts",
  "revisions",
  "preview",
  "scheduling",
  "search"
]);
const collectionSourcePattern = /^(template:.+|import:.+|manual|discovered|seed)$/;
const fieldTypeValues = z$1.enum([
  "string",
  "text",
  "url",
  "number",
  "integer",
  "boolean",
  "datetime",
  "select",
  "multiSelect",
  "portableText",
  "image",
  "file",
  "reference",
  "json",
  "slug",
  "repeater"
]);
const repeaterSubFieldSchema = z$1.object({
  slug: z$1.string().min(1).max(63).regex(slugPattern, "Invalid slug format"),
  type: z$1.enum([
    "string",
    "text",
    "number",
    "integer",
    "boolean",
    "datetime",
    "select"
  ]),
  label: z$1.string().min(1),
  required: z$1.boolean().optional(),
  options: z$1.array(z$1.string()).optional()
});
const fieldValidation = z$1.object({
  required: z$1.boolean().optional(),
  min: z$1.number().optional(),
  max: z$1.number().optional(),
  minLength: z$1.number().int().min(0).optional(),
  maxLength: z$1.number().int().min(0).optional(),
  pattern: z$1.string().optional(),
  options: z$1.array(z$1.string()).optional(),
  subFields: z$1.array(repeaterSubFieldSchema).min(1).optional(),
  minItems: z$1.number().int().min(0).optional(),
  maxItems: z$1.number().int().min(1).optional(),
  allowedMimeTypes: z$1.array(z$1.string().regex(/^[a-z0-9][a-z0-9!#$&^_+\-.]*\/[a-z0-9!#$&^_+\-.]*$/i, "Invalid MIME type")).min(1, "allowedMimeTypes must not be empty — omit the field to allow all types").max(64, "allowedMimeTypes may contain at most 64 entries").optional()
}).optional();
const fieldWidgetOptions = z$1.record(z$1.string(), z$1.unknown()).optional();
z$1.object({
  slug: z$1.string().min(1).max(63).regex(slugPattern, "Invalid slug format"),
  label: z$1.string().min(1),
  labelSingular: z$1.string().optional(),
  description: z$1.string().optional(),
  icon: z$1.string().optional(),
  supports: z$1.array(collectionSupportValues).optional(),
  source: z$1.string().regex(collectionSourcePattern).optional(),
  urlPattern: z$1.string().optional(),
  hasSeo: z$1.boolean().optional()
}).meta({ id: "CreateCollectionBody" });
z$1.object({
  label: z$1.string().min(1).optional(),
  labelSingular: z$1.string().optional(),
  description: z$1.string().optional(),
  icon: z$1.string().optional(),
  supports: z$1.array(collectionSupportValues).optional(),
  urlPattern: z$1.string().nullish(),
  hasSeo: z$1.boolean().optional(),
  commentsEnabled: z$1.boolean().optional(),
  commentsModeration: z$1.enum([
    "all",
    "first_time",
    "none"
  ]).optional(),
  commentsClosedAfterDays: z$1.number().int().min(0).optional(),
  commentsAutoApproveUsers: z$1.boolean().optional()
}).meta({ id: "UpdateCollectionBody" });
z$1.object({
  slug: z$1.string().min(1).max(63).regex(slugPattern, "Invalid slug format"),
  label: z$1.string().min(1),
  type: fieldTypeValues,
  required: z$1.boolean().optional(),
  unique: z$1.boolean().optional(),
  defaultValue: z$1.unknown().optional(),
  validation: fieldValidation.nullable(),
  widget: z$1.string().optional(),
  options: fieldWidgetOptions,
  sortOrder: z$1.number().int().min(0).optional(),
  searchable: z$1.boolean().optional(),
  translatable: z$1.boolean().optional()
}).meta({ id: "CreateFieldBody" });
z$1.object({
  label: z$1.string().min(1).optional(),
  required: z$1.boolean().optional(),
  unique: z$1.boolean().optional(),
  defaultValue: z$1.unknown().optional(),
  validation: fieldValidation.nullable(),
  widget: z$1.string().optional(),
  options: fieldWidgetOptions,
  sortOrder: z$1.number().int().min(0).optional(),
  searchable: z$1.boolean().optional(),
  translatable: z$1.boolean().optional()
}).meta({ id: "UpdateFieldBody" });
z$1.object({ fieldSlugs: z$1.array(z$1.string().min(1)) }).meta({ id: "FieldReorderBody" });
z$1.object({
  label: z$1.string().optional(),
  labelSingular: z$1.string().optional(),
  description: z$1.string().optional()
}).meta({ id: "OrphanRegisterBody" });
z$1.object({ format: z$1.string().optional() });
z$1.object({ includeFields: z$1.string().transform((v) => v === "true").optional() });
const collectionSchema = z$1.object({
  id: z$1.string(),
  slug: z$1.string(),
  label: z$1.string(),
  labelSingular: z$1.string().nullable(),
  description: z$1.string().nullable(),
  icon: z$1.string().nullable(),
  supports: z$1.array(z$1.string()),
  source: z$1.string().nullable(),
  urlPattern: z$1.string().nullable(),
  hasSeo: z$1.boolean(),
  createdAt: z$1.string(),
  updatedAt: z$1.string()
}).meta({ id: "Collection" });
const fieldSchema = z$1.object({
  id: z$1.string(),
  collectionId: z$1.string(),
  slug: z$1.string(),
  label: z$1.string(),
  type: fieldTypeValues,
  required: z$1.boolean(),
  unique: z$1.boolean(),
  defaultValue: z$1.unknown().nullable(),
  validation: z$1.record(z$1.string(), z$1.unknown()).nullable(),
  widget: z$1.string().nullable(),
  options: z$1.record(z$1.string(), z$1.unknown()).nullable(),
  sortOrder: z$1.number().int(),
  searchable: z$1.boolean(),
  translatable: z$1.boolean(),
  createdAt: z$1.string(),
  updatedAt: z$1.string()
}).meta({ id: "Field" });
z$1.object({ item: collectionSchema }).meta({ id: "CollectionResponse" });
z$1.object({ item: collectionSchema.extend({ fields: z$1.array(fieldSchema) }) }).meta({ id: "CollectionWithFieldsResponse" });
z$1.object({ items: z$1.array(collectionSchema) }).meta({ id: "CollectionListResponse" });
z$1.object({ item: fieldSchema }).meta({ id: "FieldResponse" });
z$1.object({ items: z$1.array(fieldSchema) }).meta({ id: "FieldListResponse" });
const orphanedTableSchema = z$1.object({
  slug: z$1.string(),
  tableName: z$1.string(),
  rowCount: z$1.number().int()
}).meta({ id: "OrphanedTable" });
z$1.object({ items: z$1.array(orphanedTableSchema) }).meta({ id: "OrphanedTableListResponse" });
z$1.object({
  authorName: z$1.string().min(1).max(100),
  authorEmail: z$1.string().email(),
  body: z$1.string().min(1).max(5e3),
  parentId: z$1.string().optional(),
  website_url: z$1.string().optional()
}).meta({ id: "CreateCommentBody" });
z$1.object({ status: z$1.enum([
  "approved",
  "pending",
  "spam",
  "trash"
]) }).meta({ id: "CommentStatusBody" });
z$1.object({
  ids: z$1.array(z$1.string().min(1)).min(1).max(100),
  action: z$1.enum([
    "approve",
    "spam",
    "trash",
    "delete"
  ])
}).meta({ id: "CommentBulkBody" });
z$1.object({
  status: z$1.enum([
    "pending",
    "approved",
    "spam",
    "trash"
  ]).optional(),
  collection: z$1.string().optional(),
  search: z$1.string().optional(),
  limit: z$1.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z$1.string().max(2048).optional()
}).meta({ id: "CommentListQuery" });
const commentStatusValues = z$1.enum([
  "pending",
  "approved",
  "spam",
  "trash"
]);
const publicCommentSchema = z$1.object({
  id: z$1.string(),
  authorName: z$1.string(),
  isRegisteredUser: z$1.boolean(),
  body: z$1.string(),
  parentId: z$1.string().nullable(),
  createdAt: z$1.string(),
  replies: z$1.array(z$1.any()).optional()
}).meta({ id: "PublicComment" });
const commentSchema = z$1.object({
  id: z$1.string(),
  collection: z$1.string(),
  contentId: z$1.string(),
  authorName: z$1.string(),
  authorEmail: z$1.string(),
  body: z$1.string(),
  status: commentStatusValues,
  parentId: z$1.string().nullable(),
  ipHash: z$1.string().nullable(),
  createdAt: z$1.string(),
  updatedAt: z$1.string()
}).meta({ id: "Comment" });
z$1.object({
  items: z$1.array(publicCommentSchema),
  nextCursor: z$1.string().optional(),
  total: z$1.number().int()
}).meta({ id: "PublicCommentListResponse" });
z$1.object({
  items: z$1.array(commentSchema),
  nextCursor: z$1.string().optional()
}).meta({ id: "AdminCommentListResponse" });
z$1.object({
  pending: z$1.number().int(),
  approved: z$1.number().int(),
  spam: z$1.number().int(),
  trash: z$1.number().int()
}).meta({ id: "CommentCountsResponse" });
z$1.object({ affected: z$1.number().int() }).meta({ id: "CommentBulkResponse" });
const authenticatorTransport$1 = z$1.enum([
  "usb",
  "nfc",
  "ble",
  "internal",
  "hybrid"
]);
const registrationCredential$1 = z$1.object({
  id: z$1.string(),
  rawId: z$1.string(),
  type: z$1.literal("public-key"),
  response: z$1.object({
    clientDataJSON: z$1.string(),
    attestationObject: z$1.string(),
    transports: z$1.array(authenticatorTransport$1).optional()
  }),
  authenticatorAttachment: z$1.enum(["platform", "cross-platform"]).optional()
});
const authenticationCredential = z$1.object({
  id: z$1.string(),
  rawId: z$1.string(),
  type: z$1.literal("public-key"),
  response: z$1.object({
    clientDataJSON: z$1.string(),
    authenticatorData: z$1.string(),
    signature: z$1.string(),
    userHandle: z$1.string().optional()
  }),
  authenticatorAttachment: z$1.enum(["platform", "cross-platform"]).optional()
});
z$1.object({ email: z$1.string().email() }).meta({ id: "SignupRequestBody" });
z$1.object({
  token: z$1.string().min(1),
  credential: registrationCredential$1,
  name: z$1.string().optional()
}).meta({ id: "SignupCompleteBody" });
z$1.object({
  email: z$1.string().email(),
  role: roleLevel.optional()
}).meta({ id: "InviteCreateBody" });
z$1.object({
  token: z$1.string().min(1),
  name: z$1.string().optional()
}).meta({ id: "InviteRegisterOptionsBody" });
z$1.object({
  token: z$1.string().min(1),
  credential: registrationCredential$1,
  name: z$1.string().optional()
}).meta({ id: "InviteCompleteBody" });
z$1.object({ email: z$1.string().email() }).meta({ id: "MagicLinkSendBody" });
z$1.object({ email: z$1.string().email().optional() }).meta({ id: "PasskeyOptionsBody" });
z$1.object({ credential: authenticationCredential }).meta({ id: "PasskeyVerifyBody" });
z$1.object({ name: z$1.string().optional() }).meta({ id: "PasskeyRegisterOptionsBody" });
z$1.object({
  credential: registrationCredential$1,
  name: z$1.string().optional()
}).meta({ id: "PasskeyRegisterVerifyBody" });
z$1.object({ name: z$1.string().min(1) }).meta({ id: "PasskeyRenameBody" });
z$1.object({ action: z$1.string().min(1) }).meta({ id: "AuthMeActionBody" });
const SAFE_URL_SCHEME_RE = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;
function isSafeHref(url) {
  return SAFE_URL_SCHEME_RE.test(url);
}
const menuItemType = z$1.string().min(1);
const safeHref = z$1.string().trim().refine(isSafeHref, "URL must use http, https, mailto, tel, a relative path, or a fragment identifier");
z$1.object({
  name: z$1.string().min(1),
  label: z$1.string().min(1),
  locale: z$1.string().min(1).optional(),
  translationOf: z$1.string().min(1).optional()
}).meta({ id: "CreateMenuBody" });
z$1.object({ label: z$1.string().min(1).optional() }).meta({ id: "UpdateMenuBody" });
z$1.object({
  type: menuItemType,
  label: z$1.string().min(1),
  referenceCollection: z$1.string().optional(),
  referenceId: z$1.string().optional(),
  customUrl: safeHref.optional(),
  target: z$1.string().optional(),
  titleAttr: z$1.string().optional(),
  cssClasses: z$1.string().optional(),
  parentId: z$1.string().optional(),
  sortOrder: z$1.number().int().min(0).optional()
}).meta({ id: "CreateMenuItemBody" });
z$1.object({
  label: z$1.string().min(1).optional(),
  customUrl: safeHref.optional(),
  target: z$1.string().optional(),
  titleAttr: z$1.string().optional(),
  cssClasses: z$1.string().optional(),
  parentId: z$1.string().nullish(),
  sortOrder: z$1.number().int().min(0).optional()
}).meta({ id: "UpdateMenuItemBody" });
z$1.object({ id: z$1.string().min(1) });
z$1.object({ id: z$1.string().min(1) });
z$1.object({ items: z$1.array(z$1.object({
  id: z$1.string().min(1),
  parentId: z$1.string().nullable(),
  sortOrder: z$1.number().int().min(0)
})) }).meta({ id: "ReorderMenuItemsBody" });
const menuSchema = z$1.object({
  id: z$1.string(),
  name: z$1.string(),
  label: z$1.string(),
  created_at: z$1.string(),
  updated_at: z$1.string(),
  locale: z$1.string(),
  translation_group: z$1.string().nullable()
}).meta({ id: "Menu" });
const menuItemSchema = z$1.object({
  id: z$1.string(),
  menu_id: z$1.string(),
  parent_id: z$1.string().nullable(),
  sort_order: z$1.number().int(),
  type: z$1.string(),
  reference_collection: z$1.string().nullable(),
  reference_id: z$1.string().nullable(),
  custom_url: z$1.string().nullable(),
  label: z$1.string(),
  title_attr: z$1.string().nullable(),
  target: z$1.string().nullable(),
  css_classes: z$1.string().nullable(),
  created_at: z$1.string(),
  locale: z$1.string(),
  translation_group: z$1.string().nullable()
}).meta({ id: "MenuItem" });
z$1.object({
  translationGroup: z$1.string().nullable(),
  translations: z$1.array(z$1.object({
    id: z$1.string(),
    name: z$1.string(),
    label: z$1.string(),
    locale: z$1.string(),
    updatedAt: z$1.string()
  }))
}).meta({ id: "MenuTranslations" });
menuSchema.extend({ itemCount: z$1.number().int() }).meta({ id: "MenuListItem" });
menuSchema.extend({ items: z$1.array(menuItemSchema) }).meta({ id: "MenuWithItems" });
const collectionSlugPattern = /^[a-z][a-z0-9_]*$/;
z$1.object({
  name: z$1.string().min(1).max(63).regex(/^[a-z][a-z0-9_]*$/, "Name must be lowercase alphanumeric with underscores"),
  label: z$1.string().min(1).max(200),
  labelSingular: z$1.string().min(1).max(200).optional(),
  hierarchical: z$1.boolean().optional().default(false),
  collections: z$1.array(z$1.string().min(1).max(63).regex(collectionSlugPattern, "Invalid collection slug format")).max(100).optional().default([]),
  locale: z$1.string().min(1).optional(),
  translationOf: z$1.string().min(1).optional()
}).meta({ id: "CreateTaxonomyDefBody" });
z$1.object({
  slug: z$1.string().min(1),
  label: z$1.string().min(1),
  parentId: z$1.string().nullish(),
  description: z$1.string().optional(),
  locale: z$1.string().min(1).optional(),
  translationOf: z$1.string().min(1).optional()
}).meta({ id: "CreateTermBody" });
z$1.object({
  slug: z$1.string().min(1).optional(),
  label: z$1.string().min(1).optional(),
  parentId: z$1.string().nullish(),
  description: z$1.string().optional()
}).meta({ id: "UpdateTermBody" });
const taxonomyDefSchema = z$1.object({
  id: z$1.string(),
  name: z$1.string(),
  label: z$1.string(),
  labelSingular: z$1.string().optional(),
  hierarchical: z$1.boolean(),
  collections: z$1.array(z$1.string()),
  locale: z$1.string(),
  translationGroup: z$1.string().nullable()
}).meta({ id: "TaxonomyDef" });
z$1.object({
  translationGroup: z$1.string().nullable(),
  translations: z$1.array(z$1.object({
    id: z$1.string(),
    name: z$1.string(),
    label: z$1.string(),
    locale: z$1.string()
  }))
}).meta({ id: "TaxonomyDefTranslations" });
z$1.object({ taxonomies: z$1.array(taxonomyDefSchema) }).meta({ id: "TaxonomyListResponse" });
const termSchema = z$1.object({
  id: z$1.string(),
  name: z$1.string(),
  slug: z$1.string(),
  label: z$1.string(),
  parentId: z$1.string().nullable(),
  description: z$1.string().optional(),
  locale: z$1.string(),
  translationGroup: z$1.string().nullable()
}).meta({ id: "Term" });
z$1.object({
  translationGroup: z$1.string().nullable(),
  translations: z$1.array(z$1.object({
    id: z$1.string(),
    slug: z$1.string(),
    label: z$1.string(),
    locale: z$1.string()
  }))
}).meta({ id: "TermTranslations" });
const termWithCountSchema = z$1.object({
  id: z$1.string(),
  name: z$1.string(),
  slug: z$1.string(),
  label: z$1.string(),
  parentId: z$1.string().nullable(),
  description: z$1.string().optional(),
  count: z$1.number().int(),
  children: z$1.array(z$1.lazy(() => termWithCountSchema)),
  locale: z$1.string(),
  translationGroup: z$1.string().nullable()
}).meta({ id: "TermWithCount" });
z$1.object({ terms: z$1.array(termWithCountSchema) }).meta({ id: "TermListResponse" });
z$1.object({ term: termSchema }).meta({ id: "TermResponse" });
z$1.object({ term: termSchema.extend({
  count: z$1.number().int(),
  children: z$1.array(z$1.object({
    id: z$1.string(),
    slug: z$1.string(),
    label: z$1.string()
  }))
}) }).meta({ id: "TermGetResponse" });
const sectionSource = z$1.enum([
  "theme",
  "user",
  "import"
]);
z$1.object({
  source: sectionSource.optional(),
  search: z$1.string().optional(),
  limit: z$1.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z$1.string().max(2048).optional()
}).meta({ id: "SectionsListQuery" });
z$1.object({
  slug: z$1.string().min(1),
  title: z$1.string().min(1),
  description: z$1.string().optional(),
  keywords: z$1.array(z$1.string()).optional(),
  content: z$1.array(z$1.record(z$1.string(), z$1.unknown())),
  previewMediaId: z$1.string().optional(),
  source: z$1.enum(["user", "import"]).optional(),
  themeId: z$1.string().optional()
}).meta({ id: "CreateSectionBody" });
z$1.object({
  slug: z$1.string().min(1).optional(),
  title: z$1.string().min(1).optional(),
  description: z$1.string().optional(),
  keywords: z$1.array(z$1.string()).optional(),
  content: z$1.array(z$1.record(z$1.string(), z$1.unknown())).optional(),
  previewMediaId: z$1.string().nullish()
}).meta({ id: "UpdateSectionBody" });
const sectionSchema = z$1.object({
  id: z$1.string(),
  slug: z$1.string(),
  title: z$1.string(),
  description: z$1.string().nullable(),
  keywords: z$1.array(z$1.string()).nullable(),
  content: z$1.array(z$1.record(z$1.string(), z$1.unknown())),
  previewMediaId: z$1.string().nullable(),
  source: z$1.string(),
  themeId: z$1.string().nullable(),
  createdAt: z$1.string(),
  updatedAt: z$1.string()
}).meta({ id: "Section" });
z$1.object({
  items: z$1.array(sectionSchema),
  nextCursor: z$1.string().optional()
}).meta({ id: "SectionListResponse" });
const mediaReferenceInput = z$1.object({
  mediaId: z$1.string(),
  alt: z$1.string().optional()
});
const socialSettings = z$1.object({
  twitter: z$1.string().optional(),
  github: z$1.string().optional(),
  facebook: z$1.string().optional(),
  instagram: z$1.string().optional(),
  linkedin: z$1.string().optional(),
  youtube: z$1.string().optional()
});
const seoSettingsInput = z$1.object({
  titleSeparator: z$1.string().max(10).optional(),
  defaultOgImage: mediaReferenceInput.optional(),
  robotsTxt: z$1.string().max(5e3).optional(),
  googleVerification: z$1.string().max(100).optional(),
  bingVerification: z$1.string().max(100).optional()
});
z$1.object({
  title: z$1.string().optional(),
  tagline: z$1.string().optional(),
  logo: mediaReferenceInput.optional(),
  favicon: mediaReferenceInput.optional(),
  url: z$1.union([httpUrl, z$1.literal("")]).optional(),
  postsPerPage: z$1.number().int().min(1).max(100).optional(),
  dateFormat: z$1.string().optional(),
  timezone: z$1.string().optional(),
  social: socialSettings.optional(),
  seo: seoSettingsInput.optional()
}).meta({ id: "SettingsUpdateBody" });
const mediaReferenceResponse = z$1.object({
  mediaId: z$1.string(),
  alt: z$1.string().optional(),
  url: z$1.string().optional(),
  contentType: z$1.string().optional(),
  width: z$1.number().int().optional(),
  height: z$1.number().int().optional()
});
const seoSettingsResponse = z$1.object({
  titleSeparator: z$1.string().max(10).optional(),
  defaultOgImage: mediaReferenceResponse.optional(),
  robotsTxt: z$1.string().max(5e3).optional(),
  googleVerification: z$1.string().max(100).optional(),
  bingVerification: z$1.string().max(100).optional()
});
z$1.object({
  title: z$1.string().optional(),
  tagline: z$1.string().optional(),
  logo: mediaReferenceResponse.optional(),
  favicon: mediaReferenceResponse.optional(),
  url: z$1.string().optional(),
  postsPerPage: z$1.number().int().optional(),
  dateFormat: z$1.string().optional(),
  timezone: z$1.string().optional(),
  social: socialSettings.optional(),
  seo: seoSettingsResponse.optional()
}).meta({ id: "SiteSettings" });
z$1.object({
  q: z$1.string().min(1),
  collections: z$1.string().optional(),
  status: z$1.string().optional(),
  locale: localeCode.optional(),
  limit: z$1.coerce.number().int().min(1).max(100).optional()
}).meta({ id: "SearchQuery" });
z$1.object({
  q: z$1.string().min(1),
  collections: z$1.string().optional(),
  locale: localeCode.optional(),
  limit: z$1.coerce.number().int().min(1).max(20).optional()
}).meta({ id: "SearchSuggestQuery" });
z$1.object({ collection: z$1.string().min(1) }).meta({ id: "SearchRebuildBody" });
z$1.object({
  collection: z$1.string().min(1),
  enabled: z$1.boolean(),
  weights: z$1.record(z$1.string(), z$1.number()).optional()
}).meta({ id: "SearchEnableBody" });
const searchResultSchema = z$1.object({
  collection: z$1.string(),
  id: z$1.string(),
  slug: z$1.string().nullable(),
  locale: z$1.string(),
  title: z$1.string().optional(),
  snippet: z$1.string().optional(),
  score: z$1.number()
}).meta({ id: "SearchResult" });
z$1.object({
  items: z$1.array(searchResultSchema),
  nextCursor: z$1.string().optional()
}).meta({ id: "SearchResponse" });
z$1.object({ url: httpUrl });
z$1.object({
  url: httpUrl,
  token: z$1.string().min(1)
});
z$1.object({
  url: httpUrl,
  token: z$1.string().min(1),
  config: z$1.record(z$1.string(), z$1.unknown())
});
z$1.object({ postTypes: z$1.array(z$1.object({
  name: z$1.string().min(1),
  collection: z$1.string().min(1),
  fields: z$1.array(z$1.object({
    slug: z$1.string().min(1),
    label: z$1.string().min(1),
    type: z$1.string().min(1),
    required: z$1.boolean(),
    searchable: z$1.boolean().optional()
  })).optional()
})) });
z$1.object({
  attachments: z$1.array(z$1.record(z$1.string(), z$1.unknown())),
  stream: z$1.boolean().optional()
});
z$1.object({
  urlMap: z$1.record(z$1.string(), z$1.string()),
  collections: z$1.array(z$1.string()).optional()
});
const authenticatorTransport = z$1.enum([
  "usb",
  "nfc",
  "ble",
  "internal",
  "hybrid"
]);
const registrationCredential = z$1.object({
  id: z$1.string(),
  rawId: z$1.string(),
  type: z$1.literal("public-key"),
  response: z$1.object({
    clientDataJSON: z$1.string(),
    attestationObject: z$1.string(),
    transports: z$1.array(authenticatorTransport).optional()
  }),
  authenticatorAttachment: z$1.enum(["platform", "cross-platform"]).optional()
});
z$1.object({
  title: z$1.string().min(1),
  tagline: z$1.string().optional(),
  includeContent: z$1.boolean()
});
z$1.object({
  email: z$1.string().email(),
  name: z$1.string().optional()
});
z$1.object({ credential: registrationCredential });
z$1.object({ handle: z$1.string().trim().min(1) });
z$1.object({ handle: z$1.string().trim().min(1) });
z$1.object({
  search: z$1.string().optional(),
  role: z$1.string().optional(),
  cursor: z$1.string().max(2048).optional(),
  limit: z$1.coerce.number().int().min(1).max(100).optional().default(50)
}).meta({ id: "UsersListQuery" });
z$1.object({
  name: z$1.string().optional(),
  email: z$1.string().email().optional(),
  role: roleLevel.optional()
}).meta({ id: "UserUpdateBody" });
z$1.object({
  domain: z$1.string().min(1),
  defaultRole: roleLevel
}).meta({ id: "AllowedDomainCreateBody" });
z$1.object({
  enabled: z$1.boolean().optional(),
  defaultRole: roleLevel.optional()
}).meta({ id: "AllowedDomainUpdateBody" });
const userSchema = z$1.object({
  id: z$1.string(),
  email: z$1.string(),
  name: z$1.string().nullable(),
  avatarUrl: z$1.string().nullable(),
  role: z$1.number().int(),
  emailVerified: z$1.boolean(),
  disabled: z$1.boolean(),
  createdAt: z$1.string(),
  updatedAt: z$1.string(),
  lastLogin: z$1.string().nullable(),
  credentialCount: z$1.number().int().optional(),
  oauthProviders: z$1.array(z$1.string()).optional()
}).meta({ id: "User" });
z$1.object({
  items: z$1.array(userSchema),
  nextCursor: z$1.string().optional()
}).meta({ id: "UserListResponse" });
z$1.object({
  id: z$1.string(),
  email: z$1.string(),
  name: z$1.string().nullable(),
  avatarUrl: z$1.string().nullable(),
  role: z$1.number().int(),
  emailVerified: z$1.boolean(),
  disabled: z$1.boolean(),
  createdAt: z$1.string(),
  updatedAt: z$1.string(),
  lastLogin: z$1.string().nullable(),
  credentials: z$1.array(z$1.object({
    id: z$1.string(),
    name: z$1.string().nullable(),
    deviceType: z$1.string().nullable(),
    createdAt: z$1.string(),
    lastUsedAt: z$1.string()
  })),
  oauthAccounts: z$1.array(z$1.object({
    provider: z$1.string(),
    createdAt: z$1.string()
  }))
}).meta({ id: "UserDetail" });
const widgetType = z$1.enum([
  "content",
  "menu",
  "component"
]);
z$1.object({
  name: z$1.string().min(1),
  label: z$1.string().min(1),
  description: z$1.string().optional()
}).meta({ id: "CreateWidgetAreaBody" });
z$1.object({
  type: widgetType,
  title: z$1.string().optional(),
  content: z$1.array(z$1.record(z$1.string(), z$1.unknown())).optional(),
  menuName: z$1.string().optional(),
  componentId: z$1.string().optional(),
  componentProps: z$1.record(z$1.string(), z$1.unknown()).optional()
}).meta({ id: "CreateWidgetBody" });
z$1.object({
  type: widgetType.optional(),
  title: z$1.string().optional(),
  content: z$1.array(z$1.record(z$1.string(), z$1.unknown())).optional(),
  menuName: z$1.string().optional(),
  componentId: z$1.string().optional(),
  componentProps: z$1.record(z$1.string(), z$1.unknown()).optional()
}).meta({ id: "UpdateWidgetBody" });
z$1.object({ widgetIds: z$1.array(z$1.string().min(1)) }).meta({ id: "ReorderWidgetsBody" });
const widgetAreaSchema = z$1.object({
  id: z$1.string(),
  name: z$1.string(),
  label: z$1.string(),
  description: z$1.string().nullable(),
  created_at: z$1.string(),
  updated_at: z$1.string()
}).meta({ id: "WidgetArea" });
const widgetSchema = z$1.object({
  id: z$1.string(),
  type: widgetType,
  title: z$1.string().optional(),
  content: z$1.array(z$1.record(z$1.string(), z$1.unknown())).optional(),
  menuName: z$1.string().optional(),
  componentId: z$1.string().optional(),
  componentProps: z$1.record(z$1.string(), z$1.unknown()).optional()
}).meta({ id: "Widget" });
const widgetAreaWithWidgetsSchema = widgetAreaSchema.extend({ widgets: z$1.array(widgetSchema) }).meta({ id: "WidgetAreaWithWidgets" });
widgetAreaWithWidgetsSchema.extend({ widgetCount: z$1.number().int() }).meta({ id: "WidgetAreaWithWidgetsAndCount" });
const redirectType = z$1.coerce.number().int().refine((n) => [
  301,
  302,
  307,
  308
].includes(n), { message: "Redirect type must be 301, 302, 307, or 308" });
const CRLF = /[\r\n]/;
const urlPath = z$1.string().min(1).refine((s) => s.startsWith("/") && !s.startsWith("//"), { message: "Must be a path starting with / (no protocol-relative URLs)" }).refine((s) => !CRLF.test(s), { message: "URL must not contain newline characters" }).refine((s) => {
  try {
    return !decodeURIComponent(s).split("/").includes("..");
  } catch {
    return false;
  }
}, { message: "URL must not contain path traversal segments" });
z$1.object({
  source: urlPath,
  destination: urlPath,
  type: redirectType.optional().default(301),
  enabled: z$1.boolean().optional().default(true),
  groupName: z$1.string().nullish()
}).meta({ id: "CreateRedirectBody" });
z$1.object({
  source: urlPath.optional(),
  destination: urlPath.optional(),
  type: redirectType.optional(),
  enabled: z$1.boolean().optional(),
  groupName: z$1.string().nullish()
}).refine((o) => Object.values(o).some((v) => v !== void 0), { message: "At least one field must be provided" }).meta({ id: "UpdateRedirectBody" });
cursorPaginationQuery.extend({
  search: z$1.string().optional(),
  group: z$1.string().optional(),
  enabled: z$1.enum(["true", "false"]).transform((v) => v === "true").optional(),
  auto: z$1.enum(["true", "false"]).transform((v) => v === "true").optional()
}).meta({ id: "RedirectsListQuery" });
cursorPaginationQuery.extend({ search: z$1.string().optional() }).meta({ id: "NotFoundListQuery" });
z$1.object({ limit: z$1.coerce.number().int().min(1).max(100).optional().default(50) });
z$1.object({ olderThan: z$1.string().datetime({ message: "olderThan must be an ISO 8601 datetime" }) }).meta({ id: "NotFoundPruneBody" });
const redirectSchema = z$1.object({
  id: z$1.string(),
  source: z$1.string(),
  destination: z$1.string(),
  type: z$1.number().int(),
  isPattern: z$1.boolean(),
  enabled: z$1.boolean(),
  hits: z$1.number().int(),
  lastHitAt: z$1.string().nullable(),
  groupName: z$1.string().nullable(),
  auto: z$1.boolean(),
  createdAt: z$1.string(),
  updatedAt: z$1.string()
}).meta({ id: "Redirect" });
z$1.object({
  items: z$1.array(redirectSchema),
  nextCursor: z$1.string().optional(),
  loopRedirectIds: z$1.array(z$1.string()).optional()
}).meta({ id: "RedirectListResponse" });
const notFoundEntrySchema = z$1.object({
  id: z$1.string(),
  path: z$1.string(),
  referrer: z$1.string().nullable(),
  userAgent: z$1.string().nullable(),
  ip: z$1.string().nullable(),
  createdAt: z$1.string()
}).meta({ id: "NotFoundEntry" });
z$1.object({
  items: z$1.array(notFoundEntrySchema),
  nextCursor: z$1.string().optional()
}).meta({ id: "NotFoundListResponse" });
const notFoundSummarySchema = z$1.object({
  path: z$1.string(),
  count: z$1.number().int(),
  lastSeen: z$1.string(),
  topReferrer: z$1.string().nullable()
}).meta({ id: "NotFoundSummary" });
z$1.object({ items: z$1.array(notFoundSummarySchema) }).meta({ id: "NotFoundSummaryResponse" });
const waitUntilReady = (async () => {
  try {
    return (await import('./wait-until_C0sBMZKz.mjs')).waitUntil ?? null;
  } catch {
    return null;
  }
})();
waitUntilReady.catch(() => {
});
function after(fn) {
  const promise = Promise.resolve().then(fn).catch((error) => {
    console.error("[emdash] deferred task failed:", error);
  });
  waitUntilReady.then((waitUntil) => {
    if (waitUntil) waitUntil(promise);
    return null;
  });
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
    const parser = sax.parser(true, {
      trim: false,
      normalize: false
    });
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
      if (tag === "item") currentItem = {
        categories: [],
        tags: [],
        customTaxonomies: /* @__PURE__ */ new Map(),
        meta: /* @__PURE__ */ new Map()
      };
      else if (tag === "wp:category") currentCategory = {};
      else if (tag === "wp:tag") currentTag = {};
      else if (tag === "wp:author") currentAuthor = {};
      else if (tag === "wp:term") currentTerm = {};
      if (tag === "category" && currentItem && node.attributes) {
        const domain = attrStr(node.attributes.domain);
        const nicename = attrStr(node.attributes.nicename);
        if (domain === "category" && nicename) currentItem.categories.push(nicename);
        else if (domain === "post_tag" && nicename) currentItem.tags.push(nicename);
        else if (domain && nicename && domain !== "category" && domain !== "post_tag") {
          if (!currentItem.customTaxonomies) currentItem.customTaxonomies = /* @__PURE__ */ new Map();
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
      if (currentPath.length === 2 && currentPath[0] === "rss") switch (tag) {
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
      if (currentItem) switch (tag) {
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
          if (text === "attachment") currentAttachment = {
            id: currentItem.id,
            title: currentItem.title,
            url: currentItem.link,
            postDate: currentItem.postDate,
            meta: /* @__PURE__ */ new Map()
          };
          break;
        case "wp:post_password":
          currentItem.postPassword = text || void 0;
          break;
        case "wp:is_sticky":
          currentItem.isSticky = text === "1";
          break;
        case "wp:attachment_url":
          if (currentAttachment) currentAttachment.url = text;
          break;
        case "wp:meta_key":
          currentMetaKey = text;
          break;
        case "wp:meta_value":
          if (currentMetaKey && currentItem.meta) currentItem.meta.set(currentMetaKey, text);
          break;
        case "item":
          if (currentAttachment) {
            data.attachments.push(currentAttachment);
            currentAttachment = null;
          } else if (currentItem.postType === "nav_menu_item") {
            navMenuItemPosts.push(currentItem);
            data.posts.push(currentItem);
          } else if (currentItem.postType !== "attachment") data.posts.push(currentItem);
          currentItem = null;
          break;
      }
      if (currentCategory) switch (tag) {
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
          if (currentCategory.name) data.categories.push(currentCategory);
          currentCategory = null;
          break;
      }
      if (currentTag) switch (tag) {
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
          if (currentTag.name) data.tags.push(currentTag);
          currentTag = null;
          break;
      }
      if (currentAuthor) switch (tag) {
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
          if (currentAuthor.login) data.authors.push(currentAuthor);
          currentAuthor = null;
          break;
      }
      if (currentTerm) switch (tag) {
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
            if (currentTerm.taxonomy === "nav_menu") menuTermsBySlug.set(currentTerm.slug, currentTerm.id);
          }
          currentTerm = null;
          break;
      }
      currentPath.pop();
      currentText = "";
    };
    parser.onerror = (err) => {
      reject(/* @__PURE__ */ new Error(`XML parsing error: ${err.message}`));
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
      const menuItemType2 = menuItemTypeRaw === "post_type" || menuItemTypeRaw === "taxonomy" ? menuItemTypeRaw : "custom";
      const objectType = meta.get("_menu_item_object");
      const objectIdStr = meta.get("_menu_item_object_id");
      const url = meta.get("_menu_item_url");
      const parentIdStr = meta.get("_menu_item_menu_item_parent");
      const target = meta.get("_menu_item_target");
      const classesStr = meta.get("_menu_item_classes");
      let classes;
      if (classesStr) {
        const matches = classesStr.match(PHP_SERIALIZED_STRING_PATTERN);
        if (matches) classes = matches.map((m) => m.match(PHP_SERIALIZED_STRING_MATCH_PATTERN)?.[1]).filter(Boolean).join(" ");
      }
      return {
        id: post.id || 0,
        menuId,
        parentId: parentIdStr ? parseInt(parentIdStr, 10) || void 0 : void 0,
        sortOrder: post.menuOrder || 0,
        type: menuItemType2,
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
      items
    });
  }
  return menus;
}
const SIMPLE_ID = /^[a-z0-9-]+$/;
const SCOPED_ID = /^@[a-z0-9-]+\/[a-z0-9-]+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+/;
function definePlugin(definition) {
  if (!("id" in definition) || !("version" in definition)) {
    if (!("hooks" in definition) && !("routes" in definition)) throw new Error("Standard plugin format requires at least `hooks` or `routes`. For native format, provide `id` and `version`.");
    return definition;
  }
  return defineNativePlugin(definition);
}
function defineNativePlugin(definition) {
  const { id, version, capabilities = [], allowedHosts = [], hooks = {}, routes = {}, admin = {} } = definition;
  const storage = definition.storage ?? {};
  if (!SIMPLE_ID.test(id) && !SCOPED_ID.test(id)) throw new Error(`Invalid plugin id "${id}". Must be lowercase alphanumeric with dashes (e.g., "my-plugin" or "@scope/my-plugin").`);
  if (!SEMVER_PATTERN.test(version)) throw new Error(`Invalid plugin version "${version}". Must be semver format (e.g., "1.0.0").`);
  const validCapabilities = /* @__PURE__ */ new Set([
    "network:request",
    "network:request:unrestricted",
    "content:read",
    "content:write",
    "media:read",
    "media:write",
    "users:read",
    "email:send",
    "hooks.email-transport:register",
    "hooks.email-events:register",
    "hooks.page-fragments:register",
    "network:fetch",
    "network:fetch:any",
    "read:content",
    "write:content",
    "read:media",
    "write:media",
    "read:users",
    "email:provide",
    "email:intercept",
    "page:inject"
  ]);
  for (const cap of capabilities) if (!validCapabilities.has(cap)) throw new Error(`Invalid capability "${cap}" in plugin "${id}".`);
  const canonical = normalizeCapabilities(capabilities);
  const normalizedCapabilities = [...canonical];
  if (canonical.includes("content:write") && !canonical.includes("content:read")) normalizedCapabilities.push("content:read");
  if (canonical.includes("media:write") && !canonical.includes("media:read")) normalizedCapabilities.push("media:read");
  if (canonical.includes("network:request:unrestricted") && !canonical.includes("network:request")) normalizedCapabilities.push("network:request");
  return {
    id,
    version,
    capabilities: normalizedCapabilities,
    allowedHosts,
    storage,
    hooks: resolveHooks(hooks, id),
    routes,
    admin
  };
}
function resolveHooks(hooks, pluginId) {
  const resolved = {};
  for (const key of Object.keys(hooks)) {
    const hook = hooks[key];
    if (hook) resolved[key] = resolveHook(hook, pluginId);
  }
  return resolved;
}
function isHookConfig(hook) {
  return typeof hook === "object" && hook !== null && "handler" in hook;
}
function resolveHook(hook, pluginId) {
  if (isHookConfig(hook)) {
    if (hook.exclusive !== void 0 && typeof hook.exclusive !== "boolean") throw new Error(`Invalid "exclusive" value in hook config for plugin "${pluginId}". Must be boolean.`);
    return {
      priority: hook.priority ?? 100,
      timeout: hook.timeout ?? 5e3,
      dependencies: hook.dependencies ?? [],
      errorPolicy: hook.errorPolicy ?? "abort",
      exclusive: hook.exclusive ?? false,
      handler: hook.handler,
      pluginId
    };
  }
  return {
    priority: 100,
    timeout: 5e3,
    dependencies: [],
    errorPolicy: "abort",
    exclusive: false,
    handler: hook,
    pluginId
  };
}
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/;
function normalizeTrustedHeaders(names) {
  return names.map((h) => h.trim().toLowerCase()).filter((h) => h.length > 0 && HEADER_NAME_PATTERN.test(h));
}
function isValidHeaderName(name) {
  return HEADER_NAME_PATTERN.test(name);
}
let _envCache = null;
function getEnvTrustedHeaders() {
  if (_envCache !== null) return _envCache;
  let raw;
  try {
    const importMetaEnv = Object.assign(__vite_import_meta_env__, { OS: "Windows_NT", Path: "C:\\Users\\sabido\\my_portfolio\\node_modules\\.bin;C:\\Users\\sabido\\node_modules\\.bin;C:\\Users\\node_modules\\.bin;C:\\node_modules\\.bin;C:\\Users\\sabido\\scoop\\persist\\nvs\\nodejs\\node\\22.22.1\\x64\\node_modules\\npm\\node_modules\\@npmcli\\run-script\\lib\\node-gyp-bin;C:\\WINDOWS\\system32;C:\\WINDOWS;C:\\WINDOWS\\System32\\Wbem;C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\;C:\\WINDOWS\\System32\\OpenSSH\\;C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\NvDLISR;C:\\Program Files (x86)\\NVIDIA Corporation\\PhysX\\Common;c:\\Users\\sabido\\AppData\\Local\\Programs\\cursor\\resources\\app\\codeBin;C:\\Users\\sabido\\scoop\\apps\\nvs\\current;C:\\Users\\sabido\\scoop\\apps\\git\\current\\cmd;C:\\Users\\sabido\\scoop\\shims;C:\\Users\\sabido\\AppData\\Local\\Microsoft\\WindowsApps;C:\\Users\\sabido\\AppData\\Local\\Programs\\Microsoft VS Code\\bin;C:\\Users\\sabido\\AppData\\Local\\Programs\\Kiro\\bin;C:\\Users\\sabido\\scoop\\apps\\nvs\\current\\nodejs\\default;C:\\Users\\sabido\\.bun\\bin;C:\\Users\\sabido\\AppData\\Local\\PowerToys\\DSCModules\\;C:\\Users\\sabido\\AppData\\Local\\Programs\\Antigravity\\bin;C:\\Users\\sabido\\AppData\\Local\\Programs\\cursor\\resources\\app\\bin" });
    raw = (typeof process !== "undefined" ? process.env?.EMDASH_TRUSTED_PROXY_HEADERS : void 0) || importMetaEnv?.EMDASH_TRUSTED_PROXY_HEADERS;
  } catch {
    raw = void 0;
  }
  if (!raw) {
    _envCache = [];
    return _envCache;
  }
  _envCache = raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0 && isValidHeaderName(s));
  return _envCache;
}
function getTrustedProxyHeaders(config) {
  if (config && config.trustedProxyHeaders !== void 0) return config.trustedProxyHeaders.map((h) => h.trim().toLowerCase()).filter((h) => h.length > 0 && isValidHeaderName(h));
  return getEnvTrustedHeaders();
}
const IP_PATTERN = /^[\da-fA-F.:]+$/;
function parseFirstForwardedIp(header) {
  const trimmed = header.split(",")[0]?.trim();
  if (!trimmed) return null;
  return IP_PATTERN.test(trimmed) ? trimmed : null;
}
function readIpFromHeader(headers, name) {
  const value = headers.get(name);
  if (!value) return null;
  if (name.endsWith("forwarded-for")) return parseFirstForwardedIp(value);
  const trimmed = value.trim();
  if (!trimmed) return null;
  return IP_PATTERN.test(trimmed) ? trimmed : null;
}
function getCfObject(request) {
  return request.cf;
}
function extractGeo(cf) {
  if (!cf) return null;
  const country = cf.country ?? null;
  const region = cf.region ?? null;
  const city = cf.city ?? null;
  if (country === null && region === null && city === null) return null;
  return {
    country,
    region,
    city
  };
}
function extractRequestMeta(request, configOrTrustedHeaders) {
  const headers = request.headers;
  const cf = getCfObject(request);
  const trusted = resolveTrustedHeaders(configOrTrustedHeaders);
  let ip = null;
  if (cf) {
    const cfIp = headers.get("cf-connecting-ip")?.trim();
    if (cfIp && IP_PATTERN.test(cfIp)) ip = cfIp;
    if (!ip) {
      const xff = headers.get("x-forwarded-for");
      ip = xff ? parseFirstForwardedIp(xff) : null;
    }
  }
  if (!ip) for (const name of trusted) {
    const value = readIpFromHeader(headers, name);
    if (value) {
      ip = value;
      break;
    }
  }
  const userAgent = headers.get("user-agent")?.trim() || null;
  const referer = headers.get("referer")?.trim() || null;
  const geo = extractGeo(cf);
  return {
    ip,
    userAgent,
    referer,
    geo
  };
}
function resolveTrustedHeaders(value) {
  if (Array.isArray(value)) return normalizeTrustedHeaders(value);
  return getTrustedProxyHeaders(value);
}
const SANDBOX_STRIPPED_HEADERS = /* @__PURE__ */ new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "cf-access-jwt-assertion",
  "cf-access-client-id",
  "cf-access-client-secret",
  "x-emdash-request"
]);
function sanitizeHeadersForSandbox(headers) {
  const safe = {};
  headers.forEach((value, key) => {
    if (!SANDBOX_STRIPPED_HEADERS.has(key)) safe[key] = value;
  });
  return safe;
}
const STALE_LOCK_MINUTES = 10;
var CronExecutor = class {
  constructor(db, invokeCronHook) {
    this.db = db;
    this.invokeCronHook = invokeCronHook;
  }
  /**
  * Process all overdue tasks.
  *
  * 1. Atomically claim tasks whose next_run_at <= now, status = idle, enabled = 1.
  * 2. For each claimed task, invoke the plugin's cron hook.
  * 3. On success: compute next_run_at and reset to idle, or delete one-shots.
  * 4. On failure: reset to idle (retry on next tick).
  */
  async tick() {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let processed = 0;
    const claimed = await sql`
			UPDATE _emdash_cron_tasks
			SET status = 'running', locked_at = ${now}
			WHERE id IN (
				SELECT id FROM _emdash_cron_tasks
				WHERE next_run_at <= ${now}
				  AND status = 'idle'
				  AND enabled = 1
				ORDER BY next_run_at ASC
				LIMIT 10
			)
			RETURNING id, plugin_id, task_name, schedule, is_oneshot, data, next_run_at
		`.execute(this.db);
    for (const task of claimed.rows) {
      let parsedData;
      if (task.data) try {
        parsedData = JSON.parse(task.data);
      } catch {
        console.error(`[cron] Invalid JSON data for ${task.plugin_id}:${task.task_name}, skipping`);
        await sql`
						UPDATE _emdash_cron_tasks
						SET status = 'idle', locked_at = NULL
						WHERE id = ${task.id}
					`.execute(this.db);
        continue;
      }
      const event = {
        name: task.task_name,
        data: parsedData,
        scheduledAt: task.next_run_at
      };
      let hookFailed = false;
      try {
        await this.invokeCronHook(task.plugin_id, event);
      } catch (error) {
        hookFailed = true;
        console.error(`[cron] Hook failed for ${task.plugin_id}:${task.task_name}:`, error);
      }
      if (task.is_oneshot) if (hookFailed) {
        const meta = parsedData?.__emdash != null && typeof parsedData.__emdash === "object" ? parsedData.__emdash : void 0;
        const raw = meta?.retryCount;
        const retryCount = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
        const MAX_ONESHOT_RETRIES = 5;
        if (retryCount >= MAX_ONESHOT_RETRIES) {
          console.error(`[cron] One-shot task ${task.plugin_id}:${task.task_name} exceeded ${MAX_ONESHOT_RETRIES} retries, removing`);
          await sql`
						DELETE FROM _emdash_cron_tasks WHERE id = ${task.id}
					`.execute(this.db);
        } else {
          const backoffMs = 6e4 * Math.pow(2, retryCount);
          await sql`
						UPDATE _emdash_cron_tasks
						SET status = 'idle', locked_at = NULL, next_run_at = ${new Date(Date.now() + backoffMs).toISOString()}, data = ${JSON.stringify({
            ...parsedData,
            __emdash: {
              ...meta,
              retryCount: retryCount + 1
            }
          })}
						WHERE id = ${task.id}
					`.execute(this.db);
        }
      } else await sql`
						DELETE FROM _emdash_cron_tasks WHERE id = ${task.id}
					`.execute(this.db);
      else await sql`
					UPDATE _emdash_cron_tasks
					SET status = 'idle',
						locked_at = NULL,
						last_run_at = ${now},
						next_run_at = ${nextCronTime(task.schedule)}
					WHERE id = ${task.id}
				`.execute(this.db);
      processed++;
    }
    return processed;
  }
  /**
  * Recover tasks stuck in 'running' for more than STALE_LOCK_MINUTES.
  * These likely crashed mid-execution.
  */
  async recoverStaleLocks() {
    const result = await sql`
			UPDATE _emdash_cron_tasks
			SET status = 'idle', locked_at = NULL
			WHERE status = 'running'
			  AND locked_at < ${(/* @__PURE__ */ new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1e3)).toISOString()}
		`.execute(this.db);
    return Number(result.numAffectedRows ?? 0);
  }
  /**
  * Get the next due time across all enabled tasks.
  * Returns null if no tasks are scheduled.
  */
  async getNextDueTime() {
    return (await sql`
			SELECT MIN(next_run_at) as next
			FROM _emdash_cron_tasks
			WHERE status = 'idle' AND enabled = 1
		`.execute(this.db)).rows[0]?.next ?? null;
  }
};
var CronAccessImpl = class {
  constructor(db, pluginId, reschedule) {
    this.db = db;
    this.pluginId = pluginId;
    this.reschedule = reschedule;
  }
  async schedule(name, opts) {
    validateTaskName(name);
    validateSchedule(opts.schedule);
    const oneshot = isOneShot(opts.schedule);
    const nextRun = oneshot ? opts.schedule : nextCronTime(opts.schedule);
    const dataJson = opts.data ? JSON.stringify(opts.data) : null;
    await sql`
			INSERT INTO _emdash_cron_tasks (id, plugin_id, task_name, schedule, is_oneshot, data, next_run_at, status, enabled)
			VALUES (${ulid()}, ${this.pluginId}, ${name}, ${opts.schedule}, ${oneshot ? 1 : 0}, ${dataJson}, ${nextRun}, 'idle', 1)
			ON CONFLICT (plugin_id, task_name) DO UPDATE SET
				schedule = ${opts.schedule},
				is_oneshot = ${oneshot ? 1 : 0},
				data = ${dataJson},
				next_run_at = ${nextRun},
				status = CASE WHEN _emdash_cron_tasks.status = 'running' THEN 'running' ELSE 'idle' END,
				locked_at = CASE WHEN _emdash_cron_tasks.status = 'running' THEN _emdash_cron_tasks.locked_at ELSE NULL END,
				enabled = 1
		`.execute(this.db);
    this.reschedule();
  }
  async cancel(name) {
    await sql`
			DELETE FROM _emdash_cron_tasks
			WHERE plugin_id = ${this.pluginId} AND task_name = ${name}
		`.execute(this.db);
    this.reschedule();
  }
  async list() {
    return (await sql`
			SELECT task_name, schedule, next_run_at, last_run_at
			FROM _emdash_cron_tasks
			WHERE plugin_id = ${this.pluginId} AND enabled = 1
			ORDER BY next_run_at ASC
		`.execute(this.db)).rows.map((row) => ({
      name: row.task_name,
      schedule: row.schedule,
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at
    }));
  }
};
function nextCronTime(expression) {
  const next = new Cron(expression).nextRun();
  if (!next) throw new Error(`Invalid cron expression or no future run: "${expression}"`);
  return next.toISOString();
}
function isCronExpression(schedule) {
  try {
    new Cron(schedule);
    return true;
  } catch {
    return false;
  }
}
function isOneShot(schedule) {
  if (schedule.startsWith("@")) return false;
  if (isCronExpression(schedule)) return false;
  return !isNaN(Date.parse(schedule));
}
const MAX_TASK_NAME_LENGTH = 128;
const TASK_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
function validateTaskName(name) {
  if (!name || name.length > MAX_TASK_NAME_LENGTH) throw new Error(`Invalid task name: must be 1-${MAX_TASK_NAME_LENGTH} characters, got ${name.length}`);
  if (!TASK_NAME_RE.test(name)) throw new Error(`Invalid task name "${name}": must start with a letter and contain only letters, numbers, dashes, or underscores`);
}
function validateSchedule(schedule) {
  if (!schedule || schedule.length > 256) throw new Error(`Invalid schedule: must be 1-256 characters, got ${schedule.length}`);
  if (isCronExpression(schedule)) return;
  const parsed = Date.parse(schedule);
  if (isNaN(parsed)) throw new Error(`Invalid schedule "${schedule}": must be a valid cron expression or ISO 8601 datetime`);
}
function createKVAccess(optionsRepo, pluginId) {
  const prefix = `plugin:${pluginId}:`;
  return {
    async get(key) {
      return optionsRepo.get(`${prefix}${key}`);
    },
    async set(key, value) {
      await optionsRepo.set(`${prefix}${key}`, value);
    },
    async delete(key) {
      return optionsRepo.delete(`${prefix}${key}`);
    },
    async list(keyPrefix) {
      const fullPrefix = `${prefix}${keyPrefix ?? ""}`;
      const entriesMap = await optionsRepo.getByPrefix(fullPrefix);
      const result = [];
      for (const [fullKey, value] of entriesMap) result.push({
        key: fullKey.slice(prefix.length),
        value
      });
      return result;
    }
  };
}
function createStorageCollection(db, pluginId, collectionName, indexes) {
  const repo = new PluginStorageRepository(db, pluginId, collectionName, indexes);
  return {
    get: (id) => repo.get(id),
    put: (id, data) => repo.put(id, data),
    delete: (id) => repo.delete(id),
    exists: (id) => repo.exists(id),
    getMany: (ids) => repo.getMany(ids),
    putMany: (items) => repo.putMany(items),
    deleteMany: (ids) => repo.deleteMany(ids),
    count: (where) => repo.count(where),
    async query(options) {
      const result = await repo.query({
        where: options?.where,
        orderBy: options?.orderBy,
        limit: options?.limit,
        cursor: options?.cursor
      });
      return {
        items: result.items,
        cursor: result.cursor,
        hasMore: result.hasMore
      };
    }
  };
}
function createStorageAccess(db, pluginId, storageConfig) {
  const storage = {};
  for (const [collectionName, config] of Object.entries(storageConfig)) storage[collectionName] = createStorageCollection(db, pluginId, collectionName, [...config.indexes, ...config.uniqueIndexes ?? []]);
  return storage;
}
function splitSeoFromInput(input) {
  const { seo, ...fields } = input;
  if (seo !== void 0 && (seo === null || typeof seo !== "object" || Array.isArray(seo))) throw new Error("content.seo must be an object");
  return {
    fields,
    seo
  };
}
async function assertSeoEnabled(seoRepo, collection, seo) {
  const hasSeo = await seoRepo.isEnabled(collection);
  if (seo !== void 0 && !hasSeo) throw new Error(`Collection "${collection}" does not have SEO enabled. Remove the seo field or enable SEO on this collection.`);
  return hasSeo;
}
function createContentAccess(db) {
  const contentRepo = new ContentRepository(db);
  const seoRepo = new SeoRepository(db);
  return {
    async get(collection, id) {
      const item = await contentRepo.findById(collection, id);
      if (!item) return null;
      const result = {
        id: item.id,
        type: item.type,
        slug: item.slug,
        status: item.status,
        data: item.data,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        locale: item.locale,
        publishedAt: item.publishedAt
      };
      if (await seoRepo.isEnabled(collection)) result.seo = await seoRepo.get(collection, item.id);
      return result;
    },
    async list(collection, options) {
      let orderBy;
      if (options?.orderBy) {
        const first = Object.entries(options.orderBy)[0];
        if (first) orderBy = {
          field: first[0],
          direction: first[1]
        };
      }
      const result = await contentRepo.findMany(collection, {
        limit: options?.limit ?? 50,
        cursor: options?.cursor,
        orderBy,
        where: options?.where
      });
      const items = result.items.map((item) => ({
        id: item.id,
        type: item.type,
        slug: item.slug,
        status: item.status,
        data: item.data,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        locale: item.locale,
        publishedAt: item.publishedAt
      }));
      if (items.length > 0 && await seoRepo.isEnabled(collection)) {
        const seoMap = await seoRepo.getMany(collection, items.map((i) => i.id));
        for (const item of items) {
          const seo = seoMap.get(item.id);
          if (seo) item.seo = seo;
        }
      }
      return {
        items,
        cursor: result.nextCursor,
        hasMore: !!result.nextCursor
      };
    }
  };
}
function createContentAccessWithWrite(db) {
  return {
    ...createContentAccess(db),
    async create(collection, data) {
      const { fields, seo } = splitSeoFromInput(data);
      return withTransaction(db, async (trx) => {
        const trxContentRepo = new ContentRepository(trx);
        const trxSeoRepo = new SeoRepository(trx);
        const hasSeo = await assertSeoEnabled(trxSeoRepo, collection, seo);
        const item = await trxContentRepo.create({
          type: collection,
          data: fields
        });
        const result = {
          id: item.id,
          type: item.type,
          slug: item.slug,
          status: item.status,
          data: item.data,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          locale: item.locale,
          publishedAt: item.publishedAt
        };
        if (hasSeo) result.seo = seo !== void 0 ? await trxSeoRepo.upsert(collection, item.id, seo) : await trxSeoRepo.get(collection, item.id);
        return result;
      });
    },
    async update(collection, id, data) {
      const { fields, seo } = splitSeoFromInput(data);
      return withTransaction(db, async (trx) => {
        const trxContentRepo = new ContentRepository(trx);
        const trxSeoRepo = new SeoRepository(trx);
        const hasSeo = await assertSeoEnabled(trxSeoRepo, collection, seo);
        const item = Object.keys(fields).length > 0 ? await trxContentRepo.update(collection, id, { data: fields }) : await (async () => {
          const existing = await trxContentRepo.findById(collection, id);
          if (!existing) throw new Error("Content not found");
          return existing;
        })();
        const result = {
          id: item.id,
          type: item.type,
          slug: item.slug,
          status: item.status,
          data: item.data,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          locale: item.locale,
          publishedAt: item.publishedAt
        };
        if (hasSeo) result.seo = seo !== void 0 ? await trxSeoRepo.upsert(collection, item.id, seo) : await trxSeoRepo.get(collection, item.id);
        return result;
      });
    },
    async delete(collection, id) {
      return new ContentRepository(db).delete(collection, id);
    }
  };
}
function createMediaAccess(db) {
  const mediaRepo = new MediaRepository(db);
  return {
    async get(id) {
      const item = await mediaRepo.findById(id);
      if (!item) return null;
      return {
        id: item.id,
        filename: item.filename,
        mimeType: item.mimeType,
        size: item.size,
        url: `/media/${item.id}/${item.filename}`,
        createdAt: item.createdAt
      };
    },
    async list(options) {
      const result = await mediaRepo.findMany({
        limit: options?.limit ?? 50,
        cursor: options?.cursor,
        mimeType: options?.mimeType
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          filename: item.filename,
          mimeType: item.mimeType,
          size: item.size,
          url: `/media/${item.id}/${item.filename}`,
          createdAt: item.createdAt
        })),
        cursor: result.nextCursor,
        hasMore: !!result.nextCursor
      };
    }
  };
}
function createMediaAccessWithWrite(db, getUploadUrlFn, storage) {
  const mediaRepo = new MediaRepository(db);
  return {
    ...createMediaAccess(db),
    getUploadUrl: getUploadUrlFn,
    async upload(filename, contentType, bytes) {
      if (!storage) throw new Error("Media upload() requires a storage backend. Configure storage in PluginContextFactoryOptions.");
      const keyPrefix = ulid();
      const basename = filename.split("/").pop() ?? filename;
      const dotIdx = basename.lastIndexOf(".");
      const storageKey = `${keyPrefix}${dotIdx > 0 ? basename.slice(dotIdx).toLowerCase() : ""}`;
      await storage.upload({
        key: storageKey,
        body: new Uint8Array(bytes),
        contentType
      });
      let media;
      try {
        media = await mediaRepo.create({
          filename: basename,
          mimeType: contentType,
          size: bytes.byteLength,
          storageKey,
          status: "ready"
        });
      } catch (error) {
        try {
          await storage.delete(storageKey);
        } catch {
        }
        throw error;
      }
      return {
        mediaId: media.id,
        storageKey,
        url: `/_emdash/api/media/file/${storageKey}`
      };
    },
    async delete(id) {
      const deleted = await mediaRepo.delete(id);
      if (deleted) invalidateSiteSettingsCache();
      return deleted;
    }
  };
}
const MAX_PLUGIN_REDIRECTS = 5;
function isHostAllowed(host, allowedHosts) {
  return allowedHosts.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return host.endsWith(suffix) || host === pattern.slice(2);
    }
    return host === pattern;
  });
}
function createHttpAccess(pluginId, allowedHosts) {
  return { async fetch(url, init) {
    if (allowedHosts.length === 0) throw new Error(`Plugin "${pluginId}" has no allowed hosts configured. Add hosts to the plugin's allowedHosts array to enable HTTP requests.`);
    let currentUrl = url;
    let currentInit = init;
    for (let i = 0; i <= MAX_PLUGIN_REDIRECTS; i++) {
      const hostname = new URL(currentUrl).hostname;
      if (!isHostAllowed(hostname, allowedHosts)) throw new Error(`Plugin "${pluginId}" is not allowed to fetch from host "${hostname}". Allowed hosts: ${allowedHosts.join(", ")}`);
      const response = await globalThis.fetch(currentUrl, {
        ...currentInit,
        redirect: "manual"
      });
      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get("Location");
      if (!location) return response;
      const previousOrigin = new URL(currentUrl).origin;
      currentUrl = new URL(location, currentUrl).href;
      if (previousOrigin !== new URL(currentUrl).origin && currentInit) currentInit = stripCredentialHeaders(currentInit);
    }
    throw new Error(`Plugin "${pluginId}": too many redirects (max ${MAX_PLUGIN_REDIRECTS})`);
  } };
}
function createUnrestrictedHttpAccess(pluginId) {
  return { async fetch(url, init) {
    let currentUrl = url;
    let currentInit = init;
    for (let i = 0; i <= MAX_PLUGIN_REDIRECTS; i++) {
      try {
        await resolveAndValidateExternalUrl(currentUrl);
      } catch (e) {
        const msg = e instanceof SsrfError ? e.message : "SSRF validation failed";
        throw new Error(`Plugin "${pluginId}": blocked fetch to "${new URL(currentUrl).hostname}": ${msg}`, { cause: e });
      }
      const response = await globalThis.fetch(currentUrl, {
        ...currentInit,
        redirect: "manual"
      });
      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get("Location");
      if (!location) return response;
      const previousOrigin = new URL(currentUrl).origin;
      currentUrl = new URL(location, currentUrl).href;
      if (previousOrigin !== new URL(currentUrl).origin && currentInit) currentInit = stripCredentialHeaders(currentInit);
    }
    throw new Error(`Plugin "${pluginId}": too many redirects (max ${MAX_PLUGIN_REDIRECTS})`);
  } };
}
function createLogAccess(pluginId) {
  const prefix = `[plugin:${pluginId}]`;
  return {
    debug(message, data) {
      if (data !== void 0) console.debug(prefix, message, data);
      else console.debug(prefix, message);
    },
    info(message, data) {
      if (data !== void 0) console.info(prefix, message, data);
      else console.info(prefix, message);
    },
    warn(message, data) {
      if (data !== void 0) console.warn(prefix, message, data);
      else console.warn(prefix, message);
    },
    error(message, data) {
      if (data !== void 0) console.error(prefix, message, data);
      else console.error(prefix, message);
    }
  };
}
const TRAILING_SLASH_RE = /\/$/;
function createSiteInfo(options) {
  return {
    name: options.siteName ?? "",
    url: (options.siteUrl ?? "").replace(TRAILING_SLASH_RE, ""),
    locale: options.locale ?? "en"
  };
}
function createUrlHelper(siteUrl) {
  const base = siteUrl.replace(TRAILING_SLASH_RE, "");
  return (path) => {
    if (!path.startsWith("/")) throw new Error(`URL path must start with "/", got: "${path}"`);
    if (path.startsWith("//")) throw new Error(`URL path must not be protocol-relative, got: "${path}"`);
    return `${base}${path}`;
  };
}
function toUserInfo(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt
  };
}
function createUserAccess(db) {
  const userRepo = new UserRepository(db);
  return {
    async get(id) {
      const user = await userRepo.findById(id);
      if (!user) return null;
      return toUserInfo(user);
    },
    async getByEmail(email) {
      const user = await userRepo.findByEmail(email);
      if (!user) return null;
      return toUserInfo(user);
    },
    async list(opts) {
      const result = await userRepo.findMany({
        role: opts?.role,
        cursor: opts?.cursor,
        limit: opts?.limit
      });
      return {
        items: result.items.map(toUserInfo),
        nextCursor: result.nextCursor
      };
    }
  };
}
var PluginContextFactory = class {
  optionsRepo;
  db;
  storage;
  getUploadUrl;
  site;
  urlHelper;
  cronReschedule;
  emailPipeline;
  constructor(options) {
    this.db = options.db;
    this.optionsRepo = new OptionsRepository(options.db);
    this.storage = options.storage;
    this.getUploadUrl = options.getUploadUrl;
    this.site = createSiteInfo(options.siteInfo ?? {});
    this.urlHelper = createUrlHelper(this.site.url);
    this.cronReschedule = options.cronReschedule;
    this.emailPipeline = options.emailPipeline;
  }
  /**
  * Create the unified plugin context
  */
  createContext(plugin) {
    const capabilities = new Set(plugin.capabilities);
    const kv = createKVAccess(this.optionsRepo, plugin.id);
    const log = createLogAccess(plugin.id);
    const storage = createStorageAccess(this.db, plugin.id, plugin.storage);
    let content;
    if (capabilities.has("content:write")) content = createContentAccessWithWrite(this.db);
    else if (capabilities.has("content:read")) content = createContentAccess(this.db);
    let media;
    if (capabilities.has("media:write") && this.getUploadUrl) media = createMediaAccessWithWrite(this.db, this.getUploadUrl, this.storage);
    else if (capabilities.has("media:read")) media = createMediaAccess(this.db);
    let http;
    if (capabilities.has("network:request:unrestricted")) http = createUnrestrictedHttpAccess(plugin.id);
    else if (capabilities.has("network:request")) http = createHttpAccess(plugin.id, plugin.allowedHosts);
    let users;
    if (capabilities.has("users:read")) users = createUserAccess(this.db);
    let cron;
    if (this.cronReschedule) cron = new CronAccessImpl(this.db, plugin.id, this.cronReschedule);
    let email;
    if (capabilities.has("email:send") && this.emailPipeline?.isAvailable()) {
      const pipeline = this.emailPipeline;
      const pluginId = plugin.id;
      email = { send: (message) => pipeline.send(message, pluginId) };
    }
    return {
      plugin: {
        id: plugin.id,
        version: plugin.version
      },
      storage,
      kv,
      content,
      media,
      http,
      log,
      site: this.site,
      url: this.urlHelper,
      users,
      cron,
      email
    };
  }
};
var HookPipeline = class HookPipeline2 {
  hooks = /* @__PURE__ */ new Map();
  pluginMap = /* @__PURE__ */ new Map();
  contextFactory = null;
  /** Stored so setContextFactory can merge incrementally. */
  contextFactoryOptions = {};
  /** Hook names where at least one handler declared exclusive: true */
  exclusiveHookNames = /* @__PURE__ */ new Set();
  /**
  * Selected provider plugin ID for each exclusive hook.
  * Set by the PluginManager after resolution.
  */
  exclusiveSelections = /* @__PURE__ */ new Map();
  constructor(plugins, factoryOptions) {
    if (factoryOptions) {
      this.contextFactory = new PluginContextFactory(factoryOptions);
      this.contextFactoryOptions = { ...factoryOptions };
    }
    for (const plugin of plugins) this.pluginMap.set(plugin.id, plugin);
    this.registerPlugins(plugins);
  }
  /**
  * Set or update the context factory options.
  *
  * When called on a pipeline that already has a factory, the new options
  * are merged on top of the existing ones so that callers don't need to
  * repeat every field (e.g. adding `cronReschedule` without losing
  * `storage` / `getUploadUrl`).
  */
  setContextFactory(options) {
    const merged = {
      ...this.contextFactoryOptions,
      ...options
    };
    this.contextFactory = new PluginContextFactory(merged);
    this.contextFactoryOptions = merged;
  }
  /**
  * Get context for a plugin
  */
  getContext(pluginId) {
    const plugin = this.pluginMap.get(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);
    if (!this.contextFactory) throw new Error("Context factory not initialized - call setContextFactory first");
    return this.contextFactory.createContext(plugin);
  }
  /**
  * Get typed hooks for a specific hook name.
  * The internal map stores ResolvedHook<unknown>, but we know each name
  * maps to a specific handler type via HookHandlerMap.
  *
  * Exclusive hooks that have a selected provider are filtered out — they
  * should only run via invokeExclusiveHook(), not in the regular pipeline.
  */
  getTypedHooks(name) {
    const all = this.hooks.get(name) ?? [];
    if (this.exclusiveSelections.has(name)) return all.filter((h) => !h.exclusive);
    return all;
  }
  /**
  * Register all hooks from plugins.
  *
  * Registers each hook name individually to preserve type safety. The
  * internal map stores ResolvedHook<unknown> since it's keyed by string,
  * but getTypedHooks() restores the correct handler type on retrieval.
  */
  registerPlugins(plugins) {
    for (const plugin of plugins) {
      this.registerPluginHook(plugin, "plugin:install");
      this.registerPluginHook(plugin, "plugin:activate");
      this.registerPluginHook(plugin, "plugin:deactivate");
      this.registerPluginHook(plugin, "plugin:uninstall");
      this.registerPluginHook(plugin, "content:beforeSave");
      this.registerPluginHook(plugin, "content:afterSave");
      this.registerPluginHook(plugin, "content:beforeDelete");
      this.registerPluginHook(plugin, "content:afterDelete");
      this.registerPluginHook(plugin, "content:afterPublish");
      this.registerPluginHook(plugin, "content:afterUnpublish");
      this.registerPluginHook(plugin, "media:beforeUpload");
      this.registerPluginHook(plugin, "media:afterUpload");
      this.registerPluginHook(plugin, "cron");
      this.registerPluginHook(plugin, "email:beforeSend");
      this.registerPluginHook(plugin, "email:deliver");
      this.registerPluginHook(plugin, "email:afterSend");
      this.registerPluginHook(plugin, "comment:beforeCreate");
      this.registerPluginHook(plugin, "comment:moderate");
      this.registerPluginHook(plugin, "comment:afterCreate");
      this.registerPluginHook(plugin, "comment:afterModerate");
      this.registerPluginHook(plugin, "page:metadata");
      this.registerPluginHook(plugin, "page:fragments");
    }
    for (const [hookName, hooks] of this.hooks) this.hooks.set(hookName, this.sortHooks(hooks));
  }
  /**
  * Maps hook names to the capability required to register them.
  *
  * Hooks not listed here have no capability requirement (e.g. lifecycle
  * hooks, cron). Any plugin declaring a listed hook without the required
  * capability will have that hook silently skipped at registration time.
  */
  static HOOK_REQUIRED_CAPABILITY = /* @__PURE__ */ new Map([
    ["email:beforeSend", "hooks.email-events:register"],
    ["email:afterSend", "hooks.email-events:register"],
    ["email:deliver", "hooks.email-transport:register"],
    ["content:beforeSave", "content:write"],
    ["content:afterSave", "content:read"],
    ["content:beforeDelete", "content:read"],
    ["content:afterDelete", "content:read"],
    ["content:afterPublish", "content:read"],
    ["content:afterUnpublish", "content:read"],
    ["media:beforeUpload", "media:write"],
    ["media:afterUpload", "media:read"],
    ["comment:beforeCreate", "users:read"],
    ["comment:moderate", "users:read"],
    ["comment:afterCreate", "users:read"],
    ["comment:afterModerate", "users:read"],
    ["page:fragments", "hooks.page-fragments:register"]
  ]);
  /**
  * Register a single plugin's hook by name
  */
  registerPluginHook(plugin, name) {
    const hook = plugin.hooks[name];
    if (!hook) return;
    const requiredCapability = HookPipeline2.HOOK_REQUIRED_CAPABILITY.get(name);
    if (requiredCapability && !plugin.capabilities.includes(requiredCapability)) {
      console.warn(`[hooks] Plugin "${plugin.id}" declares ${name} hook without ${requiredCapability} capability — skipping`);
      return;
    }
    if (hook.exclusive) this.exclusiveHookNames.add(name);
    this.registerHook(name, hook);
  }
  /**
  * Register a single hook
  */
  registerHook(name, hook) {
    const existing = this.hooks.get(name) || [];
    existing.push(hook);
    this.hooks.set(name, existing);
  }
  /**
  * Sort hooks by priority and dependencies
  */
  sortHooks(hooks) {
    const sorted = [];
    const remaining = [...hooks];
    while (remaining.length > 0) {
      const ready = remaining.filter((hook) => hook.dependencies.every((dep) => sorted.some((s) => s.pluginId === dep)));
      if (ready.length === 0) {
        const pluginIds = remaining.map((h) => h.pluginId).join(", ");
        console.warn(`[hooks] Hook dependency cycle or missing dependency detected among plugins: ${pluginIds}. Falling back to priority order.`);
        remaining.sort((a, b) => a.priority - b.priority);
        sorted.push(...remaining);
        break;
      }
      ready.sort((a, b) => a.priority - b.priority);
      const next = ready[0];
      sorted.push(next);
      remaining.splice(remaining.indexOf(next), 1);
    }
    return sorted;
  }
  /**
  * Execute a hook with timeout
  */
  async executeWithTimeout(fn, timeout) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => timer = setTimeout(() => reject(/* @__PURE__ */ new Error(`Hook timeout after ${timeout}ms`)), timeout));
    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }
  /**
  * Run plugin:install hooks
  */
  async runPluginInstall(pluginId) {
    return this.runLifecycleHook("plugin:install", pluginId);
  }
  /**
  * Run plugin:activate hooks
  */
  async runPluginActivate(pluginId) {
    return this.runLifecycleHook("plugin:activate", pluginId);
  }
  /**
  * Run plugin:deactivate hooks
  */
  async runPluginDeactivate(pluginId) {
    return this.runLifecycleHook("plugin:deactivate", pluginId);
  }
  /**
  * Run plugin:uninstall hooks
  */
  async runPluginUninstall(pluginId, deleteData) {
    const hooks = this.getTypedHooks("plugin:uninstall");
    const results = [];
    const hook = hooks.find((h) => h.pluginId === pluginId);
    if (!hook) return results;
    const { handler } = hook;
    const event = { deleteData };
    const ctx = this.getContext(pluginId);
    const start = Date.now();
    try {
      await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
      results.push({
        success: true,
        pluginId: hook.pluginId,
        duration: Date.now() - start
      });
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        pluginId: hook.pluginId,
        duration: Date.now() - start
      });
    }
    return results;
  }
  async runLifecycleHook(hookName, pluginId) {
    const hooks = this.getTypedHooks(hookName);
    const results = [];
    const hook = hooks.find((h) => h.pluginId === pluginId);
    if (!hook) return results;
    const { handler } = hook;
    const event = {};
    const ctx = this.getContext(pluginId);
    const start = Date.now();
    try {
      await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
      results.push({
        success: true,
        pluginId: hook.pluginId,
        duration: Date.now() - start
      });
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        pluginId: hook.pluginId,
        duration: Date.now() - start
      });
    }
    return results;
  }
  /**
  * Run content:beforeSave hooks
  * Returns modified content from the pipeline
  */
  async runContentBeforeSave(content, collection, isNew) {
    const hooks = this.getTypedHooks("content:beforeSave");
    const results = [];
    let currentContent = content;
    for (const hook of hooks) {
      const { handler } = hook;
      const event = {
        content: currentContent,
        collection,
        isNew
      };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        const result = await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        if (result !== void 0) currentContent = result;
        results.push({
          success: true,
          value: currentContent,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return {
      content: currentContent,
      results
    };
  }
  /**
  * Run content:afterSave hooks
  */
  async runContentAfterSave(content, collection, isNew) {
    const hooks = this.getTypedHooks("content:afterSave");
    const results = [];
    for (const hook of hooks) {
      const { handler } = hook;
      const event = {
        content,
        collection,
        isNew
      };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        results.push({
          success: true,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return results;
  }
  /**
  * Run content:beforeDelete hooks
  * Returns whether deletion is allowed
  */
  async runContentBeforeDelete(id, collection) {
    const hooks = this.getTypedHooks("content:beforeDelete");
    const results = [];
    let allowed = true;
    for (const hook of hooks) {
      const { handler } = hook;
      const event = {
        id,
        collection,
        permanent: false
      };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        const result = await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        if (result === false) allowed = false;
        results.push({
          success: true,
          value: result !== false,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return {
      allowed,
      results
    };
  }
  /**
  * Run content:afterDelete hooks
  */
  async runContentAfterDelete(id, collection, permanent) {
    const hooks = this.getTypedHooks("content:afterDelete");
    const results = [];
    for (const hook of hooks) {
      const { handler } = hook;
      const event = {
        id,
        collection,
        permanent
      };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        results.push({
          success: true,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return results;
  }
  /**
  * Run content:afterPublish hooks (fire-and-forget).
  */
  async runContentAfterPublish(content, collection) {
    const hooks = this.getTypedHooks("content:afterPublish");
    const results = [];
    for (const hook of hooks) {
      const { handler } = hook;
      const event = {
        content,
        collection
      };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        results.push({
          success: true,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return results;
  }
  /**
  * Run content:afterUnpublish hooks (fire-and-forget).
  */
  async runContentAfterUnpublish(content, collection) {
    const hooks = this.getTypedHooks("content:afterUnpublish");
    const results = [];
    for (const hook of hooks) {
      const { handler } = hook;
      const event = {
        content,
        collection
      };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        results.push({
          success: true,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return results;
  }
  /**
  * Run media:beforeUpload hooks
  */
  async runMediaBeforeUpload(file2) {
    const hooks = this.getTypedHooks("media:beforeUpload");
    const results = [];
    let currentFile = file2;
    for (const hook of hooks) {
      const { handler } = hook;
      const event = { file: currentFile };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        const result = await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        if (result !== void 0) currentFile = result;
        results.push({
          success: true,
          value: currentFile,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return {
      file: currentFile,
      results
    };
  }
  /**
  * Run media:afterUpload hooks
  */
  async runMediaAfterUpload(media) {
    const hooks = this.getTypedHooks("media:afterUpload");
    const results = [];
    for (const hook of hooks) {
      const { handler } = hook;
      const event = { media };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        results.push({
          success: true,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return results;
  }
  /**
  * Invoke the cron hook for a specific plugin.
  *
  * Unlike other hooks which broadcast to all plugins, the cron hook is
  * dispatched only to the target plugin — the one that owns the task.
  */
  async invokeCronHook(pluginId, event) {
    const hook = this.getTypedHooks("cron").find((h) => h.pluginId === pluginId);
    if (!hook) return {
      success: false,
      error: /* @__PURE__ */ new Error(`Plugin "${pluginId}" has no cron hook registered`),
      pluginId,
      duration: 0
    };
    const { handler } = hook;
    const ctx = this.getContext(pluginId);
    const start = Date.now();
    try {
      await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
      return {
        success: true,
        pluginId,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        pluginId,
        duration: Date.now() - start
      };
    }
  }
  /**
  * Run email:beforeSend hooks (middleware pipeline).
  *
  * Each handler receives the message and returns a modified message or
  * `false` to cancel delivery. The pipeline chains message transformations —
  * each handler receives the output of the previous one.
  */
  async runEmailBeforeSend(message, source) {
    const hooks = this.getTypedHooks("email:beforeSend");
    const results = [];
    let currentMessage = message;
    for (const hook of hooks) {
      const { handler } = hook;
      const event = {
        message: { ...currentMessage },
        source
      };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        const result = await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        if (result === false) {
          results.push({
            success: true,
            value: false,
            pluginId: hook.pluginId,
            duration: Date.now() - start
          });
          return {
            message: false,
            results
          };
        }
        if (result && typeof result === "object") currentMessage = result;
        results.push({
          success: true,
          value: currentMessage,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return {
      message: currentMessage,
      results
    };
  }
  /**
  * Run email:afterSend hooks (fire-and-forget).
  *
  * Errors are logged but don't propagate — they don't affect the caller.
  */
  async runEmailAfterSend(message, source) {
    const hooks = this.getTypedHooks("email:afterSend");
    const results = [];
    for (const hook of hooks) {
      const { handler } = hook;
      const event = {
        message,
        source
      };
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
        results.push({
          success: true,
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      } catch (error) {
        console.error(`[email:afterSend] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          pluginId: hook.pluginId,
          duration: Date.now() - start
        });
      }
    }
    return results;
  }
  /**
  * Run comment:beforeCreate hooks (middleware pipeline).
  *
  * Each handler receives the event and returns a modified event or
  * `false` to reject the comment. The pipeline chains transformations —
  * each handler receives the output of the previous one.
  */
  async runCommentBeforeCreate(event) {
    const hooks = this.getTypedHooks("comment:beforeCreate");
    let currentEvent = event;
    for (const hook of hooks) {
      const { handler } = hook;
      const ctx = this.getContext(hook.pluginId);
      const start = Date.now();
      try {
        const result = await this.executeWithTimeout(() => handler({ ...currentEvent }, ctx), hook.timeout);
        if (result === false) return false;
        if (result && typeof result === "object") currentEvent = result;
      } catch (error) {
        console.error(`[comment:beforeCreate] Plugin "${hook.pluginId}" error (${Date.now() - start}ms):`, error instanceof Error ? error.message : error);
        if (hook.errorPolicy === "abort") throw error;
      }
    }
    return currentEvent;
  }
  /**
  * Run comment:afterCreate hooks (fire-and-forget).
  *
  * Errors are logged but don't propagate — they don't affect the caller.
  */
  async runCommentAfterCreate(event) {
    const hooks = this.getTypedHooks("comment:afterCreate");
    for (const hook of hooks) {
      const { handler } = hook;
      const ctx = this.getContext(hook.pluginId);
      try {
        await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
      } catch (error) {
        console.error(`[comment:afterCreate] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
      }
    }
  }
  /**
  * Run comment:afterModerate hooks (fire-and-forget).
  *
  * Errors are logged but don't propagate — they don't affect the caller.
  */
  async runCommentAfterModerate(event) {
    const hooks = this.getTypedHooks("comment:afterModerate");
    for (const hook of hooks) {
      const { handler } = hook;
      const ctx = this.getContext(hook.pluginId);
      try {
        await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
      } catch (error) {
        console.error(`[comment:afterModerate] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
      }
    }
  }
  /**
  * Run page:metadata hooks. Each handler returns contributions that are
  * merged by the metadata collector. Errors are logged but don't propagate.
  */
  async runPageMetadata(event) {
    const hooks = this.getTypedHooks("page:metadata");
    const results = [];
    for (const hook of hooks) {
      const { handler } = hook;
      const ctx = this.getContext(hook.pluginId);
      try {
        const result = await this.executeWithTimeout(() => Promise.resolve(handler(event, ctx)), hook.timeout);
        if (result != null) {
          const contributions = Array.isArray(result) ? result : [result];
          results.push({
            pluginId: hook.pluginId,
            contributions
          });
        }
      } catch (error) {
        console.error(`[page:metadata] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
      }
    }
    return results;
  }
  /**
  * Run page:fragments hooks. Only trusted plugins should be registered
  * for this hook. Errors are logged but don't propagate.
  */
  async runPageFragments(event) {
    const hooks = this.getTypedHooks("page:fragments");
    const results = [];
    for (const hook of hooks) {
      const { handler } = hook;
      const ctx = this.getContext(hook.pluginId);
      try {
        const result = await this.executeWithTimeout(() => Promise.resolve(handler(event, ctx)), hook.timeout);
        if (result != null) {
          const contributions = Array.isArray(result) ? result : [result];
          results.push({
            pluginId: hook.pluginId,
            contributions
          });
        }
      } catch (error) {
        console.error(`[page:fragments] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
      }
    }
    return results;
  }
  /**
  * Check if any hooks are registered for a given name
  */
  hasHooks(name) {
    const hooks = this.hooks.get(name);
    return hooks !== void 0 && hooks.length > 0;
  }
  /**
  * Get hook count for debugging
  */
  getHookCount(name) {
    return this.hooks.get(name)?.length || 0;
  }
  /**
  * Get all registered hook names
  */
  getRegisteredHooks() {
    return [...this.hooks.keys()];
  }
  /**
  * Returns hook names where at least one handler declared exclusive: true
  */
  getRegisteredExclusiveHooks() {
    return [...this.exclusiveHookNames];
  }
  /**
  * Check if a hook is exclusive
  */
  isExclusiveHook(name) {
    return this.exclusiveHookNames.has(name);
  }
  /**
  * Set the selected provider for an exclusive hook.
  * Called by PluginManager after resolution.
  */
  setExclusiveSelection(hookName, pluginId) {
    this.exclusiveSelections.set(hookName, pluginId);
  }
  /**
  * Clear the selected provider for an exclusive hook.
  */
  clearExclusiveSelection(hookName) {
    this.exclusiveSelections.delete(hookName);
  }
  /**
  * Get the selected provider for an exclusive hook (if any).
  */
  getExclusiveSelection(hookName) {
    return this.exclusiveSelections.get(hookName);
  }
  /**
  * Get all plugins that registered a handler for a given exclusive hook.
  */
  getExclusiveHookProviders(hookName) {
    return (this.hooks.get(hookName) ?? []).filter((h) => h.exclusive).map((h) => ({ pluginId: h.pluginId }));
  }
  /**
  * Get all plugins that registered a non-exclusive handler for a given
  * hook (e.g. `email:beforeSend`, `email:afterSend`), preserving priority
  * order. Partitions with `getExclusiveHookProviders()`, which returns
  * plugins whose registration is marked `exclusive: true`.
  */
  getHookProviders(hookName) {
    return (this.hooks.get(hookName) ?? []).filter((h) => !h.exclusive).map((h) => ({ pluginId: h.pluginId }));
  }
  /**
  * Invoke an exclusive hook — dispatch only to the selected provider.
  * Returns null if no provider is selected or if the selected hook
  * is not found in the pipeline.
  *
  * This is a generic dispatch used by the email pipeline and other
  * exclusive hook consumers. The handler type is unknown — callers
  * must know the expected signature.
  *
  * Errors are isolated: a failing handler returns an error result
  * instead of propagating the exception to the caller.
  */
  async invokeExclusiveHook(hookName, event) {
    const selectedPluginId = this.exclusiveSelections.get(hookName);
    if (!selectedPluginId) return null;
    const hook = (this.hooks.get(hookName) ?? []).find((h) => h.pluginId === selectedPluginId && h.exclusive);
    if (!hook) return null;
    const start = Date.now();
    try {
      const ctx = this.getContext(selectedPluginId);
      const handler = hook.handler;
      return {
        result: await this.executeWithTimeout(() => handler(event, ctx), hook.timeout),
        pluginId: selectedPluginId,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        result: void 0,
        pluginId: selectedPluginId,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start
      };
    }
  }
};
function createHookPipeline(plugins, factoryOptions) {
  return new HookPipeline(plugins, factoryOptions);
}
const EXCLUSIVE_HOOK_KEY_PREFIX$1 = "emdash:exclusive_hook:";
async function resolveExclusiveHooks(opts) {
  const { pipeline, isActive, getOption, setOption, deleteOption, preferredHints } = opts;
  const exclusiveHookNames = pipeline.getRegisteredExclusiveHooks();
  for (const hookName of exclusiveHookNames) {
    const providers = pipeline.getExclusiveHookProviders(hookName);
    const activeProviderIds = new Set(providers.map((p) => p.pluginId).filter((id) => isActive(id)));
    const key = `${EXCLUSIVE_HOOK_KEY_PREFIX$1}${hookName}`;
    let currentSelection = null;
    try {
      currentSelection = await getOption(key);
    } catch {
      continue;
    }
    if (currentSelection && activeProviderIds.has(currentSelection)) {
      pipeline.setExclusiveSelection(hookName, currentSelection);
      continue;
    }
    if (currentSelection) try {
      await deleteOption(key);
    } catch {
    }
    if (activeProviderIds.size === 1) {
      const [onlyProvider] = activeProviderIds;
      try {
        await setOption(key, onlyProvider);
      } catch {
      }
      pipeline.setExclusiveSelection(hookName, onlyProvider);
      continue;
    }
    if (preferredHints) {
      let found = false;
      for (const [pluginId, hooks] of preferredHints) if (hooks.includes(hookName) && activeProviderIds.has(pluginId)) {
        try {
          await setOption(key, pluginId);
        } catch {
        }
        pipeline.setExclusiveSelection(hookName, pluginId);
        found = true;
        break;
      }
      if (found) continue;
    }
    pipeline.clearExclusiveSelection(hookName);
  }
}
const EMAIL_DELIVER_HOOK = "email:deliver";
const SYSTEM_SOURCE = "system";
var EmailNotConfiguredError = class extends Error {
  constructor() {
    super("No email provider is configured. Install and activate an email provider plugin, then select it in Settings > Email.");
    this.name = "EmailNotConfiguredError";
  }
};
var EmailRecursionError = class extends Error {
  constructor() {
    super("Recursive email send detected. A plugin hook attempted to send an email from within the email pipeline, which would cause infinite recursion.");
    this.name = "EmailRecursionError";
  }
};
const emailSendALS = new AsyncLocalStorage();
var EmailPipeline = class {
  pipeline;
  constructor(pipeline) {
    this.pipeline = pipeline;
  }
  /**
  * Replace the underlying hook pipeline.
  *
  * Called by the runtime when rebuilding the hook pipeline after a
  * plugin is enabled or disabled, so the email pipeline dispatches
  * to the current set of active hooks.
  */
  setPipeline(pipeline) {
    this.pipeline = pipeline;
  }
  /**
  * Send an email through the full pipeline.
  *
  * @param message - The email to send
  * @param source - Where the email originated ("system" for auth, plugin ID for plugins)
  * @throws EmailNotConfiguredError if no provider is selected
  * @throws EmailRecursionError if called re-entrantly from within a hook
  * @throws Error if the provider handler throws
  */
  async send(message, source) {
    const store = emailSendALS.getStore();
    if (store && store.depth > 0) throw new EmailRecursionError();
    const run = () => this.sendInner(message, source);
    if (store) {
      store.depth++;
      try {
        await run();
      } finally {
        store.depth--;
      }
    } else await emailSendALS.run({ depth: 1 }, run);
  }
  /**
  * Inner send implementation, separated from the recursion guard.
  */
  async sendInner(message, source) {
    if (!message || typeof message !== "object") throw new Error("Invalid email message: message must be an object");
    if (!message.to || typeof message.to !== "string") throw new Error("Invalid email message: 'to' is required and must be a string");
    if (!message.subject || typeof message.subject !== "string") throw new Error("Invalid email message: 'subject' is required and must be a string");
    if (!message.text || typeof message.text !== "string") throw new Error("Invalid email message: 'text' is required and must be a string");
    const isSystemEmail = source === SYSTEM_SOURCE;
    let finalMessage;
    if (isSystemEmail) finalMessage = message;
    else {
      const beforeResult = await this.pipeline.runEmailBeforeSend(message, source);
      if (beforeResult.message === false) {
        const cancelledBy = beforeResult.results.find((r) => r.value === false)?.pluginId ?? "unknown";
        console.info(`[email] Email to "${message.to}" cancelled by plugin "${cancelledBy}"`);
        return;
      }
      finalMessage = beforeResult.message;
    }
    const deliverEvent = {
      message: finalMessage,
      source
    };
    const deliverResult = await this.pipeline.invokeExclusiveHook(EMAIL_DELIVER_HOOK, deliverEvent);
    if (!deliverResult) throw new EmailNotConfiguredError();
    if (deliverResult.error) throw deliverResult.error;
    if (!isSystemEmail) this.pipeline.runEmailAfterSend(finalMessage, source).catch((err) => console.error("[email] afterSend pipeline error:", err instanceof Error ? err.message : err));
  }
  /**
  * Check if an email provider is configured and available.
  *
  * Returns true if an email:deliver provider is selected in the exclusive
  * hook system. Plugins and auth code use this to decide whether to show
  * "send invite" vs "copy invite link" UI.
  */
  isAvailable() {
    return this.pipeline.getExclusiveSelection(EMAIL_DELIVER_HOOK) !== void 0;
  }
};
const GLOBAL_KEY = /* @__PURE__ */ Symbol.for("emdash:dev-emails");
const g = globalThis;
(() => {
  const existing = g[GLOBAL_KEY];
  if (existing) return existing;
  const fresh = [];
  g[GLOBAL_KEY] = fresh;
  return fresh;
})();
var PluginRouteHandler = class {
  contextFactory;
  plugin;
  trustedProxyHeaders;
  constructor(plugin, factoryOptions) {
    this.plugin = plugin;
    this.contextFactory = new PluginContextFactory(factoryOptions);
    this.trustedProxyHeaders = factoryOptions.trustedProxyHeaders ?? [];
  }
  /**
  * Invoke a route by name
  */
  async invoke(routeName, options) {
    const route = this.plugin.routes[routeName];
    if (!route) return {
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Route "${routeName}" not found in plugin "${this.plugin.id}"`
      },
      status: 404
    };
    let validatedInput;
    if (route.input) {
      const parseResult = route.input.safeParse(options.body);
      if (!parseResult.success) return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parseResult.error.format()
        },
        status: 400
      };
      validatedInput = parseResult.data;
    } else validatedInput = options.body;
    const routeContext = {
      ...this.contextFactory.createContext(this.plugin),
      input: validatedInput,
      request: options.request,
      requestMeta: extractRequestMeta(options.request, this.trustedProxyHeaders)
    };
    try {
      return {
        success: true,
        data: await route.handler(routeContext),
        status: 200
      };
    } catch (error) {
      if (error instanceof PluginRouteError) return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        },
        status: error.status
      };
      console.error(`[plugin:${this.plugin.id}] Route handler failed:`, error);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An internal error occurred"
        },
        status: 500
      };
    }
  }
  /**
  * Get all route names
  */
  getRouteNames() {
    return Object.keys(this.plugin.routes);
  }
  /**
  * Check if a route exists
  */
  hasRoute(name) {
    return name in this.plugin.routes;
  }
  /**
  * Get route metadata without invoking the handler.
  * Returns null if the route doesn't exist.
  */
  getRouteMeta(name) {
    const route = this.plugin.routes[name];
    if (!route) return null;
    return { public: route.public === true };
  }
};
var PluginRouteError = class PluginRouteError2 extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = "PluginRouteError";
  }
  /**
  * Create a bad request error (400)
  */
  static badRequest(message, details) {
    return new PluginRouteError2("BAD_REQUEST", message, 400, details);
  }
  /**
  * Create an unauthorized error (401)
  */
  static unauthorized(message = "Unauthorized") {
    return new PluginRouteError2("UNAUTHORIZED", message, 401);
  }
  /**
  * Create a forbidden error (403)
  */
  static forbidden(message = "Forbidden") {
    return new PluginRouteError2("FORBIDDEN", message, 403);
  }
  /**
  * Create a not found error (404)
  */
  static notFound(message = "Not found") {
    return new PluginRouteError2("NOT_FOUND", message, 404);
  }
  /**
  * Create a conflict error (409)
  */
  static conflict(message, details) {
    return new PluginRouteError2("CONFLICT", message, 409, details);
  }
  /**
  * Create an internal error (500)
  */
  static internal(message = "Internal error") {
    return new PluginRouteError2("INTERNAL_ERROR", message, 500);
  }
};
var PluginRouteRegistry = class {
  handlers = /* @__PURE__ */ new Map();
  constructor(factoryOptions) {
    this.factoryOptions = factoryOptions;
  }
  /**
  * Register a plugin's routes
  */
  register(plugin) {
    const handler = new PluginRouteHandler(plugin, this.factoryOptions);
    this.handlers.set(plugin.id, handler);
  }
  /**
  * Unregister a plugin's routes
  */
  unregister(pluginId) {
    this.handlers.delete(pluginId);
  }
  /**
  * Invoke a plugin route
  */
  async invoke(pluginId, routeName, options) {
    const handler = this.handlers.get(pluginId);
    if (!handler) return {
      success: false,
      error: {
        code: "PLUGIN_NOT_FOUND",
        message: `Plugin "${pluginId}" not found`
      },
      status: 404
    };
    return handler.invoke(routeName, options);
  }
  /**
  * Get all registered plugin IDs
  */
  getPluginIds() {
    return [...this.handlers.keys()];
  }
  /**
  * Get routes for a plugin
  */
  getRoutes(pluginId) {
    return this.handlers.get(pluginId)?.getRouteNames() ?? [];
  }
  /**
  * Get route metadata for a specific plugin route.
  * Returns null if the plugin or route doesn't exist.
  */
  getRouteMeta(pluginId, routeName) {
    const handler = this.handlers.get(pluginId);
    if (!handler) return null;
    return handler.getRouteMeta(routeName);
  }
};
var SandboxNotAvailableError = class extends Error {
  constructor() {
    super("Plugin sandboxing is not available on this platform. Sandboxed plugins require Cloudflare Workers with Worker Loader. Use trusted plugins (from config) instead, or deploy to Cloudflare.");
    this.name = "SandboxNotAvailableError";
  }
};
var NoopSandboxRunner = class {
  /**
  * Always returns false - sandboxing is not available.
  */
  isAvailable() {
    return false;
  }
  /**
  * Always throws - can't load sandboxed plugins without isolation.
  */
  async load(_manifest, _code) {
    throw new SandboxNotAvailableError();
  }
  /**
  * No-op - sandboxing not available, email callback is irrelevant.
  */
  setEmailSend() {
  }
  /**
  * No-op - nothing to terminate.
  */
  async terminateAll() {
  }
};
function createNoopSandboxRunner(_options) {
  return new NoopSandboxRunner();
}
async function importReusableBlocksAsSections(posts, db) {
  const result = {
    sectionsCreated: 0,
    sectionsSkipped: 0,
    errors: []
  };
  const reusableBlocks = posts.filter((post) => post.postType === "wp_block");
  if (reusableBlocks.length === 0) return result;
  for (const block of reusableBlocks) try {
    const slug = block.postName || slugify(block.title || `block-${block.id || Date.now()}`);
    if (await db.selectFrom("_emdash_sections").select("id").where("slug", "=", slug).executeTakeFirst()) {
      result.sectionsSkipped++;
      continue;
    }
    const content = block.content ? gutenbergToPortableText(block.content) : [];
    const id = ulid();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.insertInto("_emdash_sections").values({
      id,
      slug,
      title: block.title || "Untitled Block",
      description: null,
      keywords: null,
      content: JSON.stringify(content),
      preview_media_id: null,
      source: "import",
      theme_id: null,
      created_at: now,
      updated_at: now
    }).execute();
    result.sectionsCreated++;
  } catch (error) {
    result.errors.push({
      title: block.title || "Untitled Block",
      error: error instanceof Error ? error.message : String(error)
    });
  }
  return result;
}
const sources = /* @__PURE__ */ new Map();
function registerSource(source) {
  sources.set(source.id, source);
}
const INTERNAL_POST_TYPES = [
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
  "wp_block"
];
const INTERNAL_META_PREFIXES = ["_edit_", "_wp_"];
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;
const TRAILING_SLASHES$1 = /\/+$/;
const WP_JSON_SUFFIX$1 = /\/wp-json\/?.*$/;
const INTERNAL_META_KEYS = [
  "_edit_last",
  "_edit_lock",
  "_pingme",
  "_encloseme"
];
const BASE_REQUIRED_FIELDS = [
  {
    slug: "title",
    label: "Title",
    type: "string",
    required: true,
    searchable: true
  },
  {
    slug: "content",
    label: "Content",
    type: "portableText",
    required: false,
    searchable: true
  },
  {
    slug: "excerpt",
    label: "Excerpt",
    type: "text",
    required: false
  }
];
const FEATURED_IMAGE_FIELD = {
  slug: "featured_image",
  label: "Featured Image",
  type: "image",
  required: false
};
function isInternalPostType(type) {
  return INTERNAL_POST_TYPES.includes(type);
}
function isInternalMetaKey(key) {
  if (INTERNAL_META_KEYS.includes(key)) return true;
  for (const prefix of INTERNAL_META_PREFIXES) if (key.startsWith(prefix)) return true;
  if (key === "_thumbnail_id") return false;
  if (key.startsWith("_yoast_")) return false;
  if (key.startsWith("_rank_math_")) return false;
  if (key.startsWith("_")) return true;
  return false;
}
function mapWpStatus(status) {
  switch (status) {
    case "publish":
      return "publish";
    case "draft":
      return "draft";
    case "pending":
      return "pending";
    case "private":
      return "private";
    case "future":
      return "future";
    default:
      return "draft";
  }
}
const POST_TYPE_TO_COLLECTION = {
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
function mapPostTypeToCollection(postType) {
  return POST_TYPE_TO_COLLECTION[postType] || postType;
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
  if ([
    "0",
    "1",
    "true",
    "false"
  ].includes(value)) return "boolean";
  return "string";
}
function normalizeUrl$1(url) {
  let normalized = url.trim();
  if (!normalized.startsWith("http")) normalized = `https://${normalized}`;
  normalized = normalized.replace(TRAILING_SLASHES$1, "");
  normalized = normalized.replace(WP_JSON_SUFFIX$1, "");
  return normalized;
}
function getFilenameFromUrl(url) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop();
  } catch {
    return;
  }
}
function guessMimeType(filename) {
  return mime.getType(filename) ?? void 0;
}
function buildAttachmentMap(attachments) {
  const map = /* @__PURE__ */ new Map();
  for (const att of attachments) if (att.id && att.url) map.set(String(att.id), att.url);
  return map;
}
function isTypeCompatible(requiredType, existingType) {
  if (requiredType === existingType) return true;
  return {
    string: [
      "string",
      "text",
      "slug"
    ],
    text: ["string", "text"],
    portableText: ["portableText", "json"],
    number: ["number", "integer"],
    integer: ["number", "integer"]
  }[requiredType]?.includes(existingType) ?? false;
}
function checkSchemaCompatibility(requiredFields, existingCollection) {
  if (!existingCollection) {
    const fieldStatus2 = {};
    for (const field of requiredFields) fieldStatus2[field.slug] = {
      status: "missing",
      requiredType: field.type
    };
    return {
      exists: false,
      fieldStatus: fieldStatus2,
      canImport: true
    };
  }
  const fieldStatus = {};
  const incompatibleFields = [];
  for (const field of requiredFields) {
    const existingField = existingCollection.fields.get(field.slug);
    if (!existingField) fieldStatus[field.slug] = {
      status: "missing",
      requiredType: field.type
    };
    else if (isTypeCompatible(field.type, existingField.type)) fieldStatus[field.slug] = {
      status: "compatible",
      existingType: existingField.type,
      requiredType: field.type
    };
    else {
      fieldStatus[field.slug] = {
        status: "type_mismatch",
        existingType: existingField.type,
        requiredType: field.type
      };
      incompatibleFields.push(field.slug);
    }
  }
  const canImport = incompatibleFields.length === 0;
  return {
    exists: true,
    fieldStatus,
    canImport,
    reason: canImport ? void 0 : `Incompatible field types: ${incompatibleFields.join(", ")}`
  };
}
const wxrSource = {
  id: "wxr",
  name: "WordPress Export File",
  description: "Upload a WordPress export file (.xml)",
  icon: "upload",
  requiresFile: true,
  canProbe: false,
  async analyze(input, context) {
    if (input.type !== "file") throw new Error("WXR source requires a file input");
    return analyzeWxrData(await parseWxrString(await input.file.text()), context.getExistingCollections ? await context.getExistingCollections() : /* @__PURE__ */ new Map());
  },
  async *fetchContent(input, options) {
    if (input.type !== "file") throw new Error("WXR source requires a file input");
    const wxr = await parseWxrString(await input.file.text());
    const attachmentMap = buildAttachmentMap(wxr.attachments);
    let count = 0;
    for (const post of wxr.posts) {
      const postType = post.postType || "post";
      if (!options.postTypes.includes(postType)) continue;
      if (isInternalPostType(postType)) continue;
      if (!options.includeDrafts && post.status !== "publish") continue;
      yield wxrPostToNormalizedItem(post, attachmentMap);
      count++;
      if (options.limit && count >= options.limit) break;
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
    if (post.creator) authorPostCounts.set(post.creator, (authorPostCounts.get(post.creator) || 0) + 1);
    if (post.meta.has("_thumbnail_id")) postTypesWithThumbnails.add(type);
    for (const [key, value] of post.meta) {
      const existing = metaKeys.get(key);
      if (existing) {
        existing.count++;
        if (existing.samples.length < 3 && value) existing.samples.push(value.slice(0, 100));
      } else metaKeys.set(key, {
        count: 1,
        samples: value ? [value.slice(0, 100)] : [],
        isInternal: isInternalMetaKey(key)
      });
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
    if (postTypesWithThumbnails.has(name)) requiredFields.push(FEATURED_IMAGE_FIELD);
    return {
      name,
      count,
      suggestedCollection,
      requiredFields,
      schemaStatus: checkSchemaCompatibility(requiredFields, existingCollection)
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
    if (term.taxonomy === "category" || term.taxonomy === "post_tag" || term.taxonomy === "nav_menu") continue;
    const existing = taxonomyMap.get(term.taxonomy);
    if (existing) {
      existing.count++;
      if (existing.samples.length < 3) existing.samples.push(term.name);
    } else taxonomyMap.set(term.taxonomy, {
      count: 1,
      samples: [term.name]
    });
  }
  const customTaxonomies = Array.from(taxonomyMap.entries(), ([slug, info]) => ({
    slug,
    termCount: info.count,
    sampleTerms: info.samples
  })).toSorted((a, b) => b.termCount - a.termCount);
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
  if (post.customTaxonomies && post.customTaxonomies.size > 0) customTaxonomies = Object.fromEntries(post.customTaxonomies);
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
    parentId: post.postParent && post.postParent !== 0 ? post.postParent : void 0,
    menuOrder: post.menuOrder,
    customTaxonomies
  };
}
const WXR_ZERO_DATE = "0000-00-00 00:00:00";
function parseWxrDate(gmtDate, pubDate, localDate) {
  if (gmtDate && gmtDate !== WXR_ZERO_DATE) return /* @__PURE__ */ new Date(gmtDate.replace(" ", "T") + "Z");
  if (pubDate) {
    const d = new Date(pubDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (localDate) {
    const d = new Date(localDate.replace(" ", "T"));
    if (!isNaN(d.getTime())) return d;
  }
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
      const response = await ssrfSafeFetch(`${siteUrl}/wp-json/`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(1e4)
      });
      if (!response.ok) {
        if (!(await ssrfSafeFetch(`${siteUrl}/?rest_route=/`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(1e4)
        })).ok) return null;
      }
      const data = await response.json();
      if (!data.namespaces?.includes("wp/v2")) return null;
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
          customPostTypes: false,
          allMeta: false,
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
  async *fetchContent(_input, _options) {
    throw new Error("Direct REST API import not implemented. Please upload a WXR export file.");
  }
};
function normalizeUrl(url) {
  let normalized = url.trim();
  if (!normalized.startsWith("http")) normalized = `https://${normalized}`;
  normalized = normalized.replace(TRAILING_SLASHES, "");
  normalized = normalized.replace(WP_JSON_SUFFIX, "");
  return normalized;
}
async function getPublicContentCounts(siteUrl) {
  const result = {};
  try {
    const [postsRes, pagesRes, mediaRes] = await Promise.allSettled([
      ssrfSafeFetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, { signal: AbortSignal.timeout(5e3) }),
      ssrfSafeFetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=1`, { signal: AbortSignal.timeout(5e3) }),
      ssrfSafeFetch(`${siteUrl}/wp-json/wp/v2/media?per_page=1`, { signal: AbortSignal.timeout(5e3) })
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
      const response = await ssrfSafeFetch(`${siteUrl}/wp-json/emdash/v1/probe`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(1e4)
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.emdash_exporter) return null;
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
        suggestedAction: { type: "proceed" },
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
      const requiredFields = pt.supports && "thumbnail" in pt.supports ? [...BASE_REQUIRED_FIELDS, FEATURED_IMAGE_FIELD] : [...BASE_REQUIRED_FIELDS];
      return {
        name: pt.name,
        count: pt.total,
        suggestedCollection,
        requiredFields,
        schemaStatus: checkSchemaCompatibility(requiredFields, existingCollection)
      };
    });
    const attachments = [];
    if (data.attachments.count > 0) try {
      const mediaResponse = await ssrfSafeFetch(`${siteUrl}/wp-json/emdash/v1/media?per_page=500`, {
        headers,
        signal: AbortSignal.timeout(3e4)
      });
      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        for (const item of mediaData.items) attachments.push({
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
    } catch (e) {
      console.warn("Failed to fetch media list:", e);
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
        const response = await ssrfSafeFetch(`${siteUrl}/wp-json/emdash/v1/content?post_type=${postType}&status=${options.includeDrafts ? "any" : "publish"}&per_page=100&page=${page}`, {
          headers,
          signal: AbortSignal.timeout(6e4)
        });
        if (!response.ok) throw new Error(`Failed to fetch ${postType}: ${response.statusText}`);
        const data = await response.json();
        totalPages = data.pages;
        for (const post of data.items) {
          yield pluginPostToNormalizedItem(post);
          yielded++;
          if (options.limit && yielded >= options.limit) return;
        }
        page++;
      }
    }
  },
  async fetchMedia(url, _input) {
    validateExternalUrl(url);
    const response = await ssrfSafeFetch(url);
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.statusText}`);
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
    const headers = { Accept: "application/json" };
    if (input.token) headers["Authorization"] = `Basic ${input.token}`;
    return {
      siteUrl,
      headers
    };
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
  if (post.acf) meta._acf = post.acf;
  if (post.yoast) meta._yoast = post.yoast;
  if (post.rankmath) meta._rankmath = post.rankmath;
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

new Set(PLUGIN_CAPABILITIES);
new Set(HOOK_NAMES);

export { getTrustedProxyHeaders as $, handleContentPermanentDelete as A, handleContentCountTrashed as B, handleContentDuplicate as C, handleContentPublish as D, EmailPipeline as E, FTSManager as F, handleContentUnpublish as G, handleContentSchedule as H, handleContentUnschedule as I, handleContentCountScheduled as J, handleContentDiscardDraft as K, handleContentCompare as L, MediaRepository as M, handleContentTranslations as N, OptionsRepository as O, PluginStateRepository as P, handleMediaList as Q, RevisionRepository as R, SchemaRegistry as S, handleMediaGet as T, handleMediaCreate as U, handleMediaUpdate as V, handleMediaDelete as W, handleRevisionList as X, handleRevisionGet as Y, handleRevisionRestore as Z, PluginRouteRegistry as _, createRequestMetrics as a, after as a0, sanitizeHeadersForSandbox as a1, extractRequestMeta as a2, CronExecutor as a3, RedirectRepository as a4, getCachedRedirects as a5, setCachedRedirects as a6, matchCachedPatterns as a7, __exportAll as a8, isMissingTableError as a9, encodeCursor as aa, decodeCursor as ab, isPostgres as ac, currentTimestampValue as ad, isI18nEnabled as ae, getFallbackChain as af, getI18nConfig as ag, parseWxrString as ah, importReusableBlocksAsSections as ai, ContentRepository as aj, parseWxrDate as ak, chunks as al, SQL_BATCH_SIZE as am, BylineRepository as an, peekRequestCache as ao, setRequestCacheEntry as ap, contentCERxPUN0 as aq, registryDo34mz_P as ar, validateUK4Ja1uo as as, applyC1ZORgcy as at, createHookPipeline as b, createNoopSandboxRunner as c, decodeBase64url as d, encodeBase64url as e, definePlugin as f, getRequestContext as g, runMigrations as h, invalidateSiteSettingsCache as i, resolveExclusiveHooks as j, requestCached as k, loadBundleFromR2 as l, isSqlite as m, normalizeManifestRoute as n, handleContentList as o, handleContentGet as p, handleContentGetIncludingTrashed as q, runWithContext as r, setI18nConfig as s, handleContentCreate as t, validateIdentifier as u, validateRev as v, handleContentUpdate as w, handleContentDelete as x, handleContentListTrashed as y, handleContentRestore as z };
