import { sql, Migrator } from 'kysely';
import { c as currentTimestamp, a as currentTimestampValue, b as binaryType, l as listTablesLike, i as isSqlite, d as columnExists } from './dialect-helpers_CuVG6c2S.mjs';
import { v as validateIdentifier } from './validate_AseaonR5.mjs';

async function up$z(db) {
  await db.schema.createTable("revisions").ifNotExists().addColumn("id", "text", (col) => col.primaryKey()).addColumn("collection", "text", (col) => col.notNull()).addColumn("entry_id", "text", (col) => col.notNull()).addColumn("data", "text", (col) => col.notNull()).addColumn("author_id", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
  await db.schema.createIndex("idx_revisions_entry").ifNotExists().on("revisions").columns(["collection", "entry_id"]).execute();
  await db.schema.createTable("taxonomies").ifNotExists().addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull()).addColumn("slug", "text", (col) => col.notNull()).addColumn("label", "text", (col) => col.notNull()).addColumn("parent_id", "text").addColumn("data", "text").addUniqueConstraint("taxonomies_name_slug_unique", ["name", "slug"]).addForeignKeyConstraint(
    "taxonomies_parent_fk",
    ["parent_id"],
    "taxonomies",
    ["id"],
    (cb) => cb.onDelete("set null")
  ).execute();
  await db.schema.createIndex("idx_taxonomies_name").ifNotExists().on("taxonomies").column("name").execute();
  await db.schema.createTable("content_taxonomies").ifNotExists().addColumn("collection", "text", (col) => col.notNull()).addColumn("entry_id", "text", (col) => col.notNull()).addColumn("taxonomy_id", "text", (col) => col.notNull()).addPrimaryKeyConstraint("content_taxonomies_pk", ["collection", "entry_id", "taxonomy_id"]).addForeignKeyConstraint(
    "content_taxonomies_taxonomy_fk",
    ["taxonomy_id"],
    "taxonomies",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).execute();
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
async function down$z(db) {
  await db.schema.dropTable("audit_logs").execute();
  await db.schema.dropTable("options").execute();
  await db.schema.dropTable("users").execute();
  await db.schema.dropTable("media").execute();
  await db.schema.dropTable("content_taxonomies").execute();
  await db.schema.dropTable("taxonomies").execute();
  await db.schema.dropTable("revisions").execute();
}

const m001 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$z,
	up: up$z
}, Symbol.toStringTag, { value: 'Module' }));

async function up$y(db) {
  await db.schema.alterTable("media").addColumn("status", "text", (col) => col.notNull().defaultTo("ready")).execute();
  await db.schema.createIndex("idx_media_status").on("media").column("status").execute();
}
async function down$y(db) {
  await db.schema.dropIndex("idx_media_status").execute();
}

const m002 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$y,
	up: up$y
}, Symbol.toStringTag, { value: 'Module' }));

async function up$x(db) {
  await db.schema.createTable("_emdash_collections").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("label_singular", "text").addColumn("description", "text").addColumn("icon", "text").addColumn("supports", "text").addColumn("source", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
  await db.schema.createTable("_emdash_fields").addColumn("id", "text", (col) => col.primaryKey()).addColumn("collection_id", "text", (col) => col.notNull()).addColumn("slug", "text", (col) => col.notNull()).addColumn("label", "text", (col) => col.notNull()).addColumn("type", "text", (col) => col.notNull()).addColumn("column_type", "text", (col) => col.notNull()).addColumn("required", "integer", (col) => col.defaultTo(0)).addColumn("unique", "integer", (col) => col.defaultTo(0)).addColumn("default_value", "text").addColumn("validation", "text").addColumn("widget", "text").addColumn("options", "text").addColumn("sort_order", "integer", (col) => col.defaultTo(0)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint(
    "fields_collection_fk",
    ["collection_id"],
    "_emdash_collections",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).execute();
  await db.schema.createIndex("idx_fields_collection_slug").on("_emdash_fields").columns(["collection_id", "slug"]).unique().execute();
  await db.schema.createIndex("idx_fields_collection").on("_emdash_fields").column("collection_id").execute();
  await db.schema.createIndex("idx_fields_sort").on("_emdash_fields").columns(["collection_id", "sort_order"]).execute();
}
async function down$x(db) {
  await db.schema.dropTable("_emdash_fields").execute();
  await db.schema.dropTable("_emdash_collections").execute();
}

const m003 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$x,
	up: up$x
}, Symbol.toStringTag, { value: 'Module' }));

async function up$w(db) {
  await db.schema.createTable("_plugin_storage").addColumn("plugin_id", "text", (col) => col.notNull()).addColumn("collection", "text", (col) => col.notNull()).addColumn("id", "text", (col) => col.notNull()).addColumn("data", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addPrimaryKeyConstraint("pk_plugin_storage", ["plugin_id", "collection", "id"]).execute();
  await db.schema.createIndex("idx_plugin_storage_list").on("_plugin_storage").columns(["plugin_id", "collection", "created_at"]).execute();
  await db.schema.createTable("_plugin_state").addColumn("plugin_id", "text", (col) => col.primaryKey()).addColumn("version", "text", (col) => col.notNull()).addColumn("status", "text", (col) => col.notNull().defaultTo("installed")).addColumn("installed_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("activated_at", "text").addColumn("deactivated_at", "text").addColumn("data", "text").execute();
  await db.schema.createTable("_plugin_indexes").addColumn("plugin_id", "text", (col) => col.notNull()).addColumn("collection", "text", (col) => col.notNull()).addColumn("index_name", "text", (col) => col.notNull()).addColumn("fields", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addPrimaryKeyConstraint("pk_plugin_indexes", ["plugin_id", "collection", "index_name"]).execute();
}
async function down$w(db) {
  await db.schema.dropTable("_plugin_indexes").execute();
  await db.schema.dropTable("_plugin_state").execute();
  await db.schema.dropTable("_plugin_storage").execute();
}

const m004 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$w,
	up: up$w
}, Symbol.toStringTag, { value: 'Module' }));

async function up$v(db) {
  await db.schema.createTable("_emdash_menus").addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
  await db.schema.createTable("_emdash_menu_items").addColumn("id", "text", (col) => col.primaryKey()).addColumn("menu_id", "text", (col) => col.notNull()).addColumn("parent_id", "text").addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0)).addColumn("type", "text", (col) => col.notNull()).addColumn("reference_collection", "text").addColumn("reference_id", "text").addColumn("custom_url", "text").addColumn("label", "text", (col) => col.notNull()).addColumn("title_attr", "text").addColumn("target", "text").addColumn("css_classes", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint(
    "menu_items_menu_fk",
    ["menu_id"],
    "_emdash_menus",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).addForeignKeyConstraint(
    "menu_items_parent_fk",
    ["parent_id"],
    "_emdash_menu_items",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).execute();
  await db.schema.createIndex("idx_menu_items_menu").on("_emdash_menu_items").columns(["menu_id", "sort_order"]).execute();
  await db.schema.createIndex("idx_menu_items_parent").on("_emdash_menu_items").column("parent_id").execute();
}
async function down$v(db) {
  await db.schema.dropTable("_emdash_menu_items").execute();
  await db.schema.dropTable("_emdash_menus").execute();
}

const m005 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$v,
	up: up$v
}, Symbol.toStringTag, { value: 'Module' }));

async function up$u(db) {
  await db.schema.createTable("_emdash_taxonomy_defs").addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("label_singular", "text").addColumn("hierarchical", "integer", (col) => col.defaultTo(0)).addColumn("collections", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
  await db.insertInto("_emdash_taxonomy_defs").values([
    {
      id: "taxdef_category",
      name: "category",
      label: "Categories",
      label_singular: "Category",
      hierarchical: 1,
      collections: JSON.stringify(["posts"])
    },
    {
      id: "taxdef_tag",
      name: "tag",
      label: "Tags",
      label_singular: "Tag",
      hierarchical: 0,
      collections: JSON.stringify(["posts"])
    }
  ]).execute();
}
async function down$u(db) {
  await db.schema.dropTable("_emdash_taxonomy_defs").execute();
}

const m006 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$u,
	up: up$u
}, Symbol.toStringTag, { value: 'Module' }));

async function up$t(db) {
  await db.schema.createTable("_emdash_widget_areas").addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("description", "text").addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
  await db.schema.createTable("_emdash_widgets").addColumn("id", "text", (col) => col.primaryKey()).addColumn(
    "area_id",
    "text",
    (col) => col.notNull().references("_emdash_widget_areas.id").onDelete("cascade")
  ).addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0)).addColumn("type", "text", (col) => col.notNull()).addColumn("title", "text").addColumn("content", "text").addColumn("menu_name", "text").addColumn("component_id", "text").addColumn("component_props", "text").addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
  await db.schema.createIndex("idx_widgets_area").on("_emdash_widgets").columns(["area_id", "sort_order"]).execute();
}
async function down$t(db) {
  await db.schema.dropTable("_emdash_widgets").execute();
  await db.schema.dropTable("_emdash_widget_areas").execute();
}

const m007 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$t,
	up: up$t
}, Symbol.toStringTag, { value: 'Module' }));

async function up$s(db) {
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
  await db.schema.createTable("credentials").addColumn("id", "text", (col) => col.primaryKey()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("public_key", binaryType(db), (col) => col.notNull()).addColumn("counter", "integer", (col) => col.notNull().defaultTo(0)).addColumn("device_type", "text", (col) => col.notNull()).addColumn("backed_up", "integer", (col) => col.notNull().defaultTo(0)).addColumn("transports", "text").addColumn("name", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("last_used_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint(
    "credentials_user_fk",
    ["user_id"],
    "users",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).execute();
  await db.schema.createIndex("idx_credentials_user").on("credentials").column("user_id").execute();
  await db.schema.createTable("auth_tokens").addColumn("hash", "text", (col) => col.primaryKey()).addColumn("user_id", "text").addColumn("email", "text").addColumn("type", "text", (col) => col.notNull()).addColumn("role", "integer").addColumn("invited_by", "text").addColumn("expires_at", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint(
    "auth_tokens_user_fk",
    ["user_id"],
    "users",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).addForeignKeyConstraint(
    "auth_tokens_invited_by_fk",
    ["invited_by"],
    "users",
    ["id"],
    (cb) => cb.onDelete("set null")
  ).execute();
  await db.schema.createIndex("idx_auth_tokens_email").on("auth_tokens").column("email").execute();
  await db.schema.createTable("oauth_accounts").addColumn("provider", "text", (col) => col.notNull()).addColumn("provider_account_id", "text", (col) => col.notNull()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addPrimaryKeyConstraint("oauth_accounts_pk", ["provider", "provider_account_id"]).addForeignKeyConstraint(
    "oauth_accounts_user_fk",
    ["user_id"],
    "users",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).execute();
  await db.schema.createIndex("idx_oauth_accounts_user").on("oauth_accounts").column("user_id").execute();
  await db.schema.createTable("allowed_domains").addColumn("domain", "text", (col) => col.primaryKey()).addColumn("default_role", "integer", (col) => col.notNull().defaultTo(20)).addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
  await db.schema.createTable("auth_challenges").addColumn("challenge", "text", (col) => col.primaryKey()).addColumn("type", "text", (col) => col.notNull()).addColumn("user_id", "text").addColumn("data", "text").addColumn("expires_at", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
  await db.schema.createIndex("idx_auth_challenges_expires").on("auth_challenges").column("expires_at").execute();
}
async function down$s(db) {
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

const m008 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$s,
	up: up$s
}, Symbol.toStringTag, { value: 'Module' }));

async function up$r(db) {
  await sql`ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0`.execute(db);
  await db.schema.createIndex("idx_users_disabled").on("users").column("disabled").execute();
}
async function down$r(db) {
  await db.schema.dropIndex("idx_users_disabled").execute();
}

const m009 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$r,
	up: up$r
}, Symbol.toStringTag, { value: 'Module' }));

async function up$q(db) {
  await db.schema.createTable("_emdash_section_categories").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("sort_order", "integer", (col) => col.defaultTo(0)).addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
  await db.schema.createTable("_emdash_sections").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("title", "text", (col) => col.notNull()).addColumn("description", "text").addColumn(
    "category_id",
    "text",
    (col) => col.references("_emdash_section_categories.id").onDelete("set null")
  ).addColumn("keywords", "text").addColumn("content", "text", (col) => col.notNull()).addColumn("preview_media_id", "text").addColumn("source", "text", (col) => col.notNull().defaultTo("user")).addColumn("theme_id", "text").addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).addColumn("updated_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
  await db.schema.createIndex("idx_sections_category").on("_emdash_sections").columns(["category_id"]).execute();
  await db.schema.createIndex("idx_sections_source").on("_emdash_sections").columns(["source"]).execute();
}
async function down$q(db) {
  await db.schema.dropIndex("idx_sections_source").execute();
  await db.schema.dropIndex("idx_sections_category").execute();
  await db.schema.dropTable("_emdash_sections").execute();
  await db.schema.dropTable("_emdash_section_categories").execute();
}

const m011 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$q,
	up: up$q
}, Symbol.toStringTag, { value: 'Module' }));

async function up$p(db) {
  await db.schema.alterTable("_emdash_collections").addColumn("search_config", "text").execute();
  await db.schema.alterTable("_emdash_fields").addColumn("searchable", "integer", (col) => col.defaultTo(0)).execute();
}
async function down$p(db) {
  await db.schema.alterTable("_emdash_fields").dropColumn("searchable").execute();
  await db.schema.alterTable("_emdash_collections").dropColumn("search_config").execute();
}

const m012 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$p,
	up: up$p
}, Symbol.toStringTag, { value: 'Module' }));

async function up$o(db) {
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
async function down$o(db) {
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

const m013 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$o,
	up: up$o
}, Symbol.toStringTag, { value: 'Module' }));

async function up$n(db) {
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
async function down$n(db) {
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

const m014 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$n,
	up: up$n
}, Symbol.toStringTag, { value: 'Module' }));

async function up$m(db) {
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
async function down$m(db) {
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

const m015 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$m,
	up: up$m
}, Symbol.toStringTag, { value: 'Module' }));

async function up$l(db) {
  await db.schema.createTable("_emdash_api_tokens").ifNotExists().addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull()).addColumn("token_hash", "text", (col) => col.notNull().unique()).addColumn("prefix", "text", (col) => col.notNull()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("scopes", "text", (col) => col.notNull()).addColumn("expires_at", "text").addColumn("last_used_at", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint(
    "api_tokens_user_fk",
    ["user_id"],
    "users",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).execute();
  await db.schema.createIndex("idx_api_tokens_token_hash").ifNotExists().on("_emdash_api_tokens").column("token_hash").execute();
  await db.schema.createIndex("idx_api_tokens_user_id").ifNotExists().on("_emdash_api_tokens").column("user_id").execute();
  await db.schema.createTable("_emdash_oauth_tokens").ifNotExists().addColumn("token_hash", "text", (col) => col.primaryKey()).addColumn("token_type", "text", (col) => col.notNull()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("scopes", "text", (col) => col.notNull()).addColumn("client_type", "text", (col) => col.notNull().defaultTo("cli")).addColumn("expires_at", "text", (col) => col.notNull()).addColumn("refresh_token_hash", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint(
    "oauth_tokens_user_fk",
    ["user_id"],
    "users",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).execute();
  await db.schema.createIndex("idx_oauth_tokens_user_id").ifNotExists().on("_emdash_oauth_tokens").column("user_id").execute();
  await db.schema.createIndex("idx_oauth_tokens_expires").ifNotExists().on("_emdash_oauth_tokens").column("expires_at").execute();
  await db.schema.createTable("_emdash_device_codes").ifNotExists().addColumn("device_code", "text", (col) => col.primaryKey()).addColumn("user_code", "text", (col) => col.notNull().unique()).addColumn("scopes", "text", (col) => col.notNull()).addColumn("user_id", "text").addColumn("status", "text", (col) => col.notNull().defaultTo("pending")).addColumn("expires_at", "text", (col) => col.notNull()).addColumn("interval", "integer", (col) => col.notNull().defaultTo(5)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
}
async function down$l(db) {
  await db.schema.dropTable("_emdash_device_codes").ifExists().execute();
  await db.schema.dropTable("_emdash_oauth_tokens").ifExists().execute();
  await db.schema.dropTable("_emdash_api_tokens").ifExists().execute();
}

const m016 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$l,
	up: up$l
}, Symbol.toStringTag, { value: 'Module' }));

async function up$k(db) {
  await db.schema.createTable("_emdash_authorization_codes").addColumn("code_hash", "text", (col) => col.primaryKey()).addColumn("client_id", "text", (col) => col.notNull()).addColumn("redirect_uri", "text", (col) => col.notNull()).addColumn("user_id", "text", (col) => col.notNull()).addColumn("scopes", "text", (col) => col.notNull()).addColumn("code_challenge", "text", (col) => col.notNull()).addColumn("code_challenge_method", "text", (col) => col.notNull().defaultTo("S256")).addColumn("resource", "text").addColumn("expires_at", "text", (col) => col.notNull()).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addForeignKeyConstraint(
    "auth_codes_user_fk",
    ["user_id"],
    "users",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).execute();
  await db.schema.createIndex("idx_auth_codes_expires").on("_emdash_authorization_codes").column("expires_at").execute();
  await sql`ALTER TABLE _emdash_oauth_tokens ADD COLUMN client_id TEXT`.execute(db);
}
async function down$k(db) {
  await db.schema.dropTable("_emdash_authorization_codes").execute();
}

const m017 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$k,
	up: up$k
}, Symbol.toStringTag, { value: 'Module' }));

async function up$j(db) {
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
async function down$j(db) {
  await sql`DROP TABLE IF EXISTS _emdash_seo`.execute(db);
  await sql`
		ALTER TABLE _emdash_collections
		DROP COLUMN has_seo
	`.execute(db);
}

const m018 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$j,
	up: up$j
}, Symbol.toStringTag, { value: 'Module' }));

const DOUBLE_QUOTE_RE = /"/g;
function quoteIdent(name) {
  return `"${name.replace(DOUBLE_QUOTE_RE, '""')}"`;
}
const I18N_TMP_SUFFIX = /_i18n_tmp$/;
const TABLE_NAME_PATTERN = /^ec_[a-z][a-z0-9_]*$/;
function validateTableName(name) {
  if (!TABLE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid content table name: "${name}"`);
  }
}
const ALLOWED_COLUMN_TYPES = /* @__PURE__ */ new Set(["TEXT", "INTEGER", "REAL", "BLOB", "JSON", "NUMERIC", ""]);
function validateColumnType(type, colName) {
  if (!ALLOWED_COLUMN_TYPES.has(type.toUpperCase())) {
    throw new Error(`Unexpected column type "${type}" for column "${colName}"`);
  }
}
const SAFE_DEFAULT_PATTERN = /^(?:'[^']*'|NULL|-?\d+(?:\.\d+)?|\(?datetime\('now'\)\)?|\(?json\('[^']*'\)\)?|0|1)$/i;
function validateDefaultValue(value, colName) {
  if (!SAFE_DEFAULT_PATTERN.test(value)) {
    throw new Error(`Unexpected default value "${value}" for column "${colName}"`);
  }
}
const FUNCTION_DEFAULT_PATTERN = /^(?:datetime|json)\(/i;
function normalizeDdlDefault(value) {
  if (value.startsWith("(")) return value;
  if (FUNCTION_DEFAULT_PATTERN.test(value)) return `(${value})`;
  return value;
}
const CREATE_INDEX_PATTERN = /^CREATE\s+(UNIQUE\s+)?INDEX\s+/i;
function validateCreateIndexSql(sqlStr, idxName) {
  if (!CREATE_INDEX_PATTERN.test(sqlStr)) {
    throw new Error(`Unexpected index SQL for "${idxName}": does not match CREATE INDEX pattern`);
  }
  if (sqlStr.includes(";")) {
    throw new Error(`Unexpected index SQL for "${idxName}": contains semicolon`);
  }
}
async function upPostgres(db) {
  const tableNames = await listTablesLike(db, "ec_%");
  for (const t of tableNames) {
    validateTableName(t);
    const hasLocale = await sql`
			SELECT EXISTS(
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = ${t} AND column_name = 'locale'
			) as exists
		`.execute(db);
    if (hasLocale.rows[0]?.exists === true) continue;
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
    for (const c of constraints.rows) {
      await sql`ALTER TABLE ${sql.ref(t)} DROP CONSTRAINT ${sql.ref(c.conname)}`.execute(db);
    }
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
  const hasTranslatable = await sql`
		SELECT EXISTS(
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = '_emdash_fields' AND column_name = 'translatable'
		) as exists
	`.execute(db);
  if (hasTranslatable.rows[0]?.exists !== true) {
    await sql`
			ALTER TABLE _emdash_fields
			ADD COLUMN translatable INTEGER NOT NULL DEFAULT 1
		`.execute(db);
  }
}
async function up$i(db) {
  if (!isSqlite(db)) {
    return upPostgres(db);
  }
  const orphanedTmps = await listTablesLike(db, "ec_%_i18n_tmp");
  for (const tmpName of orphanedTmps) {
    validateTableName(tmpName.replace(I18N_TMP_SUFFIX, ""));
    await sql`DROP TABLE IF EXISTS ${sql.ref(tmpName)}`.execute(db);
  }
  const tableNames = await listTablesLike(db, "ec_%");
  const tables = { rows: tableNames.map((name) => ({ name })) };
  for (const table of tables.rows) {
    const t = table.name;
    validateTableName(t);
    const tmp = `${t}_i18n_tmp`;
    {
      const trx = db;
      const colResult = await sql`
				PRAGMA table_info(${sql.ref(t)})
			`.execute(trx);
      const columns = colResult.rows;
      if (columns.some((col) => col.name === "locale")) {
        continue;
      }
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
      for (const idx of indexDefs) {
        if (idx.partial) {
          const createResult = await sql`
						SELECT sql FROM sqlite_master 
						WHERE type = 'index' AND name = ${idx.name}
					`.execute(trx);
          if (createResult.rows[0]?.sql) {
            partialSqls.set(idx.name, createResult.rows[0].sql);
          }
        }
      }
      for (const col of columns) {
        validateIdentifier(col.name, "column name");
      }
      const colDefs = [];
      const colNames = [];
      for (const col of columns) {
        validateColumnType(col.type || "TEXT", col.name);
        colNames.push(quoteIdent(col.name));
        let def = `${quoteIdent(col.name)} ${col.type || "TEXT"}`;
        if (col.pk) {
          def += " PRIMARY KEY";
        } else if (col.name === "slug") ; else {
          if (col.notnull) def += " NOT NULL";
        }
        if (col.dflt_value !== null) {
          validateDefaultValue(col.dflt_value, col.name);
          def += ` DEFAULT ${normalizeDdlDefault(col.dflt_value)}`;
        }
        colDefs.push(def);
      }
      colDefs.push(`"locale" TEXT NOT NULL DEFAULT 'en'`);
      colDefs.push('"translation_group" TEXT');
      colDefs.push('UNIQUE("slug", "locale")');
      const createColsSql = colDefs.join(",\n				");
      const selectColsSql = colNames.join(", ");
      for (const idx of indexDefs) {
        await sql`DROP INDEX IF EXISTS ${sql.ref(idx.name)}`.execute(trx);
      }
      await sql.raw(`CREATE TABLE ${quoteIdent(tmp)} (
				${createColsSql}
			)`).execute(trx);
      await sql.raw(
        `INSERT INTO ${quoteIdent(tmp)} (${selectColsSql}, "locale", "translation_group")
			 SELECT ${selectColsSql}, 'en', "id" FROM ${quoteIdent(t)}`
      ).execute(trx);
      await sql`DROP TABLE ${sql.ref(t)}`.execute(trx);
      await sql.raw(`ALTER TABLE ${quoteIdent(tmp)} RENAME TO ${quoteIdent(t)}`).execute(trx);
      for (const idx of indexDefs) {
        if (idx.name === `idx_${t}_slug`) continue;
        if (idx.partial && partialSqls.has(idx.name)) {
          const idxSql = partialSqls.get(idx.name);
          validateCreateIndexSql(idxSql, idx.name);
          await sql.raw(idxSql).execute(trx);
        } else {
          for (const c of idx.columns) {
            validateIdentifier(c, "index column name");
          }
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
  const fieldCols = await sql`
		PRAGMA table_info(_emdash_fields)
	`.execute(db);
  if (!fieldCols.rows.some((col) => col.name === "translatable")) {
    await sql`
			ALTER TABLE _emdash_fields 
			ADD COLUMN translatable INTEGER NOT NULL DEFAULT 1
		`.execute(db);
  }
}
async function downPostgres(db) {
  await sql`ALTER TABLE _emdash_fields DROP COLUMN translatable`.execute(db);
  const tableNames = await listTablesLike(db, "ec_%");
  for (const t of tableNames) {
    validateTableName(t);
    await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${t}_locale`)}`.execute(db);
    await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${t}_translation_group`)}`.execute(db);
    await sql`ALTER TABLE ${sql.ref(t)} DROP CONSTRAINT IF EXISTS ${sql.ref(`${t}_slug_locale_unique`)}`.execute(
      db
    );
    await sql`ALTER TABLE ${sql.ref(t)} ADD CONSTRAINT ${sql.ref(`${t}_slug_unique`)} UNIQUE (slug)`.execute(
      db
    );
    await sql`ALTER TABLE ${sql.ref(t)} DROP COLUMN locale`.execute(db);
    await sql`ALTER TABLE ${sql.ref(t)} DROP COLUMN translation_group`.execute(db);
  }
}
async function down$i(db) {
  if (!isSqlite(db)) {
    return downPostgres(db);
  }
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
      const colResult = await sql`
				PRAGMA table_info(${sql.ref(t)})
			`.execute(trx);
      const columns = colResult.rows;
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
      for (const idx of indexDefs) {
        if (idx.partial) {
          const createResult = await sql`
						SELECT sql FROM sqlite_master 
						WHERE type = 'index' AND name = ${idx.name}
					`.execute(trx);
          if (createResult.rows[0]?.sql) {
            partialSqls.set(idx.name, createResult.rows[0].sql);
          }
        }
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
        if (col.pk) {
          def += " PRIMARY KEY";
        } else if (col.name === "slug") {
          def += " UNIQUE";
        } else {
          if (col.notnull) def += " NOT NULL";
        }
        if (col.dflt_value !== null) {
          validateDefaultValue(col.dflt_value, col.name);
          def += ` DEFAULT ${normalizeDdlDefault(col.dflt_value)}`;
        }
        colDefs.push(def);
      }
      const createColsSql = colDefs.join(",\n				");
      const selectColsSql = colNames.join(", ");
      for (const idx of indexDefs) {
        await sql`DROP INDEX IF EXISTS ${sql.ref(idx.name)}`.execute(trx);
      }
      await sql.raw(`CREATE TABLE ${quoteIdent(tmp)} (
				${createColsSql}
			)`).execute(trx);
      await sql.raw(
        `INSERT OR IGNORE INTO ${quoteIdent(tmp)} (${selectColsSql})
			 SELECT ${selectColsSql} FROM ${quoteIdent(t)}
			 WHERE "locale" = 'en'`
      ).execute(trx);
      await sql.raw(
        `INSERT OR IGNORE INTO ${quoteIdent(tmp)} (${selectColsSql})
			 SELECT ${selectColsSql} FROM ${quoteIdent(t)}
			 WHERE "id" NOT IN (SELECT "id" FROM ${quoteIdent(tmp)})
			 AND "id" IN (
				SELECT "id" FROM ${quoteIdent(t)} AS t2
				WHERE t2."translation_group" IS NOT NULL
				AND t2."locale" = (
					SELECT MIN(t3."locale") FROM ${quoteIdent(t)} AS t3
					WHERE t3."translation_group" = t2."translation_group"
				)
			 )`
      ).execute(trx);
      await sql.raw(
        `INSERT OR IGNORE INTO ${quoteIdent(tmp)} (${selectColsSql})
			 SELECT ${selectColsSql} FROM ${quoteIdent(t)}
			 WHERE "id" NOT IN (SELECT "id" FROM ${quoteIdent(tmp)})
			 AND "translation_group" IS NULL`
      ).execute(trx);
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
          for (const c of cols) {
            validateIdentifier(c, "index column name");
          }
          const colsSql = cols.map((c) => quoteIdent(c)).join(", ");
          const unique = idx.unique ? "UNIQUE " : "";
          await sql.raw(`CREATE ${unique}INDEX ${quoteIdent(idx.name)} ON ${quoteIdent(t)} (${colsSql})`).execute(trx);
        }
      }
    }
  }
}

const m019 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$i,
	up: up$i
}, Symbol.toStringTag, { value: 'Module' }));

async function up$h(db) {
  await sql`
		ALTER TABLE _emdash_collections
		ADD COLUMN url_pattern TEXT
	`.execute(db);
}
async function down$h(db) {
  await sql`
		ALTER TABLE _emdash_collections
		DROP COLUMN url_pattern
	`.execute(db);
}

const m020 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$h,
	up: up$h
}, Symbol.toStringTag, { value: 'Module' }));

async function up$g(db) {
  await db.schema.dropIndex("idx_sections_category").ifExists().execute();
  await db.schema.alterTable("_emdash_sections").dropColumn("category_id").execute();
  await db.schema.dropTable("_emdash_section_categories").execute();
}
async function down$g(db) {
  await db.schema.createTable("_emdash_section_categories").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("label", "text", (col) => col.notNull()).addColumn("sort_order", "integer", (col) => col.defaultTo(0)).addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)).execute();
  await db.schema.alterTable("_emdash_sections").addColumn(
    "category_id",
    "text",
    (col) => col.references("_emdash_section_categories.id").onDelete("set null")
  ).execute();
  await db.schema.createIndex("idx_sections_category").on("_emdash_sections").columns(["category_id"]).execute();
}

const m021 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$g,
	up: up$g
}, Symbol.toStringTag, { value: 'Module' }));

async function up$f(db) {
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
async function down$f(db) {
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

const m022 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$f,
	up: up$f
}, Symbol.toStringTag, { value: 'Module' }));

async function up$e(db) {
  await sql`
		ALTER TABLE _plugin_state
		ADD COLUMN display_name TEXT
	`.execute(db);
  await sql`
		ALTER TABLE _plugin_state
		ADD COLUMN description TEXT
	`.execute(db);
}
async function down$e(db) {
  await sql`
		ALTER TABLE _plugin_state
		DROP COLUMN description
	`.execute(db);
  await sql`
		ALTER TABLE _plugin_state
		DROP COLUMN display_name
	`.execute(db);
}

const m023 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$e,
	up: up$e
}, Symbol.toStringTag, { value: 'Module' }));

async function up$d(db) {
  await sql`
		ALTER TABLE media
		ADD COLUMN blurhash TEXT
	`.execute(db);
  await sql`
		ALTER TABLE media
		ADD COLUMN dominant_color TEXT
	`.execute(db);
}
async function down$d(db) {
  await sql`
		ALTER TABLE media
		DROP COLUMN dominant_color
	`.execute(db);
  await sql`
		ALTER TABLE media
		DROP COLUMN blurhash
	`.execute(db);
}

const m024 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$d,
	up: up$d
}, Symbol.toStringTag, { value: 'Module' }));

async function up$c(db) {
  await db.schema.createTable("_emdash_oauth_clients").addColumn("id", "text", (col) => col.primaryKey()).addColumn("name", "text", (col) => col.notNull()).addColumn("redirect_uris", "text", (col) => col.notNull()).addColumn("scopes", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
}
async function down$c(db) {
  await db.schema.dropTable("_emdash_oauth_clients").execute();
}

const m025 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$c,
	up: up$c
}, Symbol.toStringTag, { value: 'Module' }));

async function up$b(db) {
  await db.schema.createTable("_emdash_cron_tasks").addColumn("id", "text", (col) => col.primaryKey()).addColumn("plugin_id", "text", (col) => col.notNull()).addColumn("task_name", "text", (col) => col.notNull()).addColumn("schedule", "text", (col) => col.notNull()).addColumn("is_oneshot", "integer", (col) => col.notNull().defaultTo(0)).addColumn("data", "text").addColumn("next_run_at", "text", (col) => col.notNull()).addColumn("last_run_at", "text").addColumn("status", "text", (col) => col.notNull().defaultTo("idle")).addColumn("locked_at", "text").addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addUniqueConstraint("uq_cron_tasks_plugin_task", ["plugin_id", "task_name"]).execute();
  await db.schema.createIndex("idx_cron_tasks_due").on("_emdash_cron_tasks").columns(["enabled", "status", "next_run_at"]).execute();
  await db.schema.createIndex("idx_cron_tasks_plugin").on("_emdash_cron_tasks").column("plugin_id").execute();
}
async function down$b(db) {
  await db.schema.dropTable("_emdash_cron_tasks").execute();
}

const m026 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$b,
	up: up$b
}, Symbol.toStringTag, { value: 'Module' }));

async function up$a(db) {
  await db.schema.createTable("_emdash_comments").addColumn("id", "text", (col) => col.primaryKey()).addColumn("collection", "text", (col) => col.notNull()).addColumn("content_id", "text", (col) => col.notNull()).addColumn(
    "parent_id",
    "text",
    (col) => col.references("_emdash_comments.id").onDelete("cascade")
  ).addColumn("author_name", "text", (col) => col.notNull()).addColumn("author_email", "text", (col) => col.notNull()).addColumn("author_url", "text").addColumn("author_user_id", "text", (col) => col.references("users.id").onDelete("set null")).addColumn("body", "text", (col) => col.notNull()).addColumn("status", "text", (col) => col.notNull().defaultTo("pending")).addColumn("ip_hash", "text").addColumn("user_agent", "text").addColumn("moderation_metadata", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
  await db.schema.createIndex("idx_comments_content").on("_emdash_comments").columns(["collection", "content_id", "status"]).execute();
  await db.schema.createIndex("idx_comments_parent").on("_emdash_comments").column("parent_id").execute();
  await db.schema.createIndex("idx_comments_status").on("_emdash_comments").columns(["status", "created_at"]).execute();
  await db.schema.createIndex("idx_comments_author_email").on("_emdash_comments").column("author_email").execute();
  await db.schema.createIndex("idx_comments_author_user").on("_emdash_comments").column("author_user_id").execute();
  await db.schema.alterTable("_emdash_collections").addColumn("comments_enabled", "integer", (col) => col.defaultTo(0)).execute();
  await db.schema.alterTable("_emdash_collections").addColumn("comments_moderation", "text", (col) => col.defaultTo("first_time")).execute();
  await db.schema.alterTable("_emdash_collections").addColumn("comments_closed_after_days", "integer", (col) => col.defaultTo(90)).execute();
  await db.schema.alterTable("_emdash_collections").addColumn("comments_auto_approve_users", "integer", (col) => col.defaultTo(1)).execute();
}
async function down$a(db) {
  await db.schema.dropTable("_emdash_comments").execute();
}

const m027 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$a,
	up: up$a
}, Symbol.toStringTag, { value: 'Module' }));

async function up$9(db) {
  await sql`ALTER TABLE _emdash_comments DROP COLUMN author_url`.execute(db);
}
async function down$9(db) {
  await db.schema.alterTable("_emdash_comments").addColumn("author_url", "text").execute();
}

const m028 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$9,
	up: up$9
}, Symbol.toStringTag, { value: 'Module' }));

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

const m029 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$8,
	up: up$8
}, Symbol.toStringTag, { value: 'Module' }));

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

const m030 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$7,
	up: up$7
}, Symbol.toStringTag, { value: 'Module' }));

async function up$6(db) {
  await db.schema.createTable("_emdash_bylines").addColumn("id", "text", (col) => col.primaryKey()).addColumn("slug", "text", (col) => col.notNull().unique()).addColumn("display_name", "text", (col) => col.notNull()).addColumn("bio", "text").addColumn("avatar_media_id", "text", (col) => col.references("media.id").onDelete("set null")).addColumn("website_url", "text").addColumn("user_id", "text", (col) => col.references("users.id").onDelete("set null")).addColumn("is_guest", "integer", (col) => col.notNull().defaultTo(0)).addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(db))).execute();
  await sql`
		CREATE UNIQUE INDEX ${sql.ref("idx_bylines_user_id_unique")}
		ON ${sql.ref("_emdash_bylines")} (user_id)
		WHERE user_id IS NOT NULL
	`.execute(db);
  await db.schema.createIndex("idx_bylines_slug").on("_emdash_bylines").column("slug").execute();
  await db.schema.createIndex("idx_bylines_display_name").on("_emdash_bylines").column("display_name").execute();
  await db.schema.createTable("_emdash_content_bylines").addColumn("id", "text", (col) => col.primaryKey()).addColumn("collection_slug", "text", (col) => col.notNull()).addColumn("content_id", "text", (col) => col.notNull()).addColumn(
    "byline_id",
    "text",
    (col) => col.notNull().references("_emdash_bylines.id").onDelete("cascade")
  ).addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0)).addColumn("role_label", "text").addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(db))).addUniqueConstraint("content_bylines_unique", ["collection_slug", "content_id", "byline_id"]).execute();
  await db.schema.createIndex("idx_content_bylines_content").on("_emdash_content_bylines").columns(["collection_slug", "content_id", "sort_order"]).execute();
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

const m031 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$6,
	up: up$6
}, Symbol.toStringTag, { value: 'Module' }));

async function up$5(db) {
  await db.schema.createTable("_emdash_rate_limits").addColumn("key", "text", (col) => col.notNull()).addColumn("window", "text", (col) => col.notNull()).addColumn("count", "integer", (col) => col.notNull().defaultTo(1)).addPrimaryKeyConstraint("pk_rate_limits", ["key", "window"]).execute();
  await db.schema.createIndex("idx_rate_limits_window").on("_emdash_rate_limits").column("window").execute();
  await db.schema.alterTable("_emdash_device_codes").addColumn("last_polled_at", "text").execute();
}
async function down$5(db) {
  await db.schema.dropTable("_emdash_rate_limits").execute();
  await db.schema.alterTable("_emdash_device_codes").dropColumn("last_polled_at").execute();
}

const m032 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$5,
	up: up$5
}, Symbol.toStringTag, { value: 'Module' }));

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

const m033 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$4,
	up: up$4
}, Symbol.toStringTag, { value: 'Module' }));

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
    await sql`DROP INDEX IF EXISTS ${sql.ref(`idx_${table.name}_deleted_published_id`)}`.execute(
      db
    );
  }
}

const m034 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$3,
	up: up$3
}, Symbol.toStringTag, { value: 'Module' }));

async function up$2(db) {
  const hitsExists = await columnExists(db, "_emdash_404_log", "hits");
  if (!hitsExists) {
    await db.schema.alterTable("_emdash_404_log").addColumn("hits", "integer", (col) => col.notNull().defaultTo(1)).execute();
  }
  if (!await columnExists(db, "_emdash_404_log", "last_seen_at")) {
    await db.schema.alterTable("_emdash_404_log").addColumn("last_seen_at", "text").execute();
  }
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

const m035 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$2,
	up: up$2
}, Symbol.toStringTag, { value: 'Module' }));

function getDefaultLocale() {
  return "en";
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
  await pgWiden(db, "taxonomies", ["name", "slug"], ["name", "slug", "locale"], defaultLocale);
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
  await db.schema.createTable("taxonomies_new").addColumn("id", "text", (c) => c.primaryKey()).addColumn("name", "text", (c) => c.notNull()).addColumn("slug", "text", (c) => c.notNull()).addColumn("label", "text", (c) => c.notNull()).addColumn("parent_id", "text").addColumn("data", "text").addColumn("locale", "text", (c) => c.notNull().defaultTo(defaultLocale)).addColumn("translation_group", "text").addUniqueConstraint("taxonomies_name_slug_locale_unique", ["name", "slug", "locale"]).addForeignKeyConstraint(
    "taxonomies_parent_fk",
    ["parent_id"],
    "taxonomies",
    ["id"],
    (cb) => cb.onDelete("set null")
  ).execute();
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
  const fks = await sql`PRAGMA foreign_key_list(content_taxonomies)`.execute(db);
  if (fks.rows.length === 0) return;
  await sql.raw(`DROP TABLE IF EXISTS "content_taxonomies_new"`).execute(db);
  await db.schema.createTable("content_taxonomies_new").addColumn("collection", "text", (c) => c.notNull()).addColumn("entry_id", "text", (c) => c.notNull()).addColumn("taxonomy_id", "text", (c) => c.notNull()).addPrimaryKeyConstraint("content_taxonomies_pk", ["collection", "entry_id", "taxonomy_id"]).execute();
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
  await sql`ALTER TABLE ${ref} ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT ${sql.lit(defaultLocale)}`.execute(
    db
  );
  await sql`ALTER TABLE ${ref} ADD COLUMN IF NOT EXISTS translation_group TEXT`.execute(db);
  await sql`UPDATE ${ref} SET translation_group = id WHERE translation_group IS NULL`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS ${sql.ref(`idx_${table}_locale`)} ON ${ref} (locale)`.execute(
    db
  );
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
  for (const c of cons.rows) {
    await sql`ALTER TABLE ${ref} DROP CONSTRAINT ${sql.ref(c.conname)}`.execute(db);
  }
  const cols = sql.join(
    newCols.map((c) => sql.ref(c)),
    sql`, `
  );
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
  for (const c of fks.rows) {
    await sql`ALTER TABLE content_taxonomies DROP CONSTRAINT ${sql.ref(c.conname)}`.execute(db);
  }
  await sql`
		UPDATE content_taxonomies SET taxonomy_id = t.translation_group
		FROM taxonomies t WHERE t.id = content_taxonomies.taxonomy_id
	`.execute(db);
}
async function hasColumn(db, table, column) {
  const rows = await sql`PRAGMA table_info(${sql.ref(table)})`.execute(db);
  return rows.rows.some((r) => r.name === column);
}
const SYSTEM_IDENT = /^[_a-z][a-z0-9_]*$/;
function validateSystemIdent(name) {
  if (!SYSTEM_IDENT.test(name)) throw new Error(`Invalid identifier: "${name}"`);
}
async function assertSingleLocale(db, defaultLocale) {
  const tables = ["_emdash_menus", "_emdash_menu_items", "taxonomies", "_emdash_taxonomy_defs"];
  for (const table of tables) {
    validateSystemIdent(table);
    const result = await sql`
			SELECT COUNT(*) AS count FROM ${sql.ref(table)} WHERE locale != ${defaultLocale}
		`.execute(db);
    const count = Number(result.rows[0]?.count ?? 0);
    if (count > 0) {
      throw new Error(
        `Cannot revert migration 036_i18n_menus_and_taxonomies: ${count} row(s) in "${table}" use a non-default locale (defaultLocale="${defaultLocale}"). Reverting would drop them silently. Export translations first (or delete them) and re-run the rollback. See packages/core/src/database/migrations/036_i18n_menus_and_taxonomies.ts.`
      );
    }
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
  await db.schema.createTable("content_taxonomies_new").addColumn("collection", "text", (c) => c.notNull()).addColumn("entry_id", "text", (c) => c.notNull()).addColumn("taxonomy_id", "text", (c) => c.notNull()).addPrimaryKeyConstraint("content_taxonomies_pk", ["collection", "entry_id", "taxonomy_id"]).addForeignKeyConstraint(
    "content_taxonomies_taxonomy_fk",
    ["taxonomy_id"],
    "taxonomies",
    ["id"],
    (cb) => cb.onDelete("cascade")
  ).execute();
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
  await db.schema.createTable("taxonomies_old").addColumn("id", "text", (c) => c.primaryKey()).addColumn("name", "text", (c) => c.notNull()).addColumn("slug", "text", (c) => c.notNull()).addColumn("label", "text", (c) => c.notNull()).addColumn("parent_id", "text").addColumn("data", "text").addUniqueConstraint("taxonomies_name_slug_unique", ["name", "slug"]).addForeignKeyConstraint(
    "taxonomies_parent_fk",
    ["parent_id"],
    "taxonomies_old",
    ["id"],
    (cb) => cb.onDelete("set null")
  ).execute();
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

const m036 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down: down$1,
	up: up$1
}, Symbol.toStringTag, { value: 'Module' }));

async function up(db) {
  if (!await columnExists(db, "credentials", "algorithm")) {
    await db.schema.alterTable("credentials").addColumn("algorithm", "integer", (col) => col.notNull().defaultTo(-7)).execute();
  }
}
async function down(db) {
  if (await columnExists(db, "credentials", "algorithm")) {
    await db.schema.alterTable("credentials").dropColumn("algorithm").execute();
  }
}

const m037 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	down,
	up
}, Symbol.toStringTag, { value: 'Module' }));

const MIGRATIONS = Object.freeze({
  "001_initial": m001,
  "002_media_status": m002,
  "003_schema_registry": m003,
  "004_plugins": m004,
  "005_menus": m005,
  "006_taxonomy_defs": m006,
  "007_widgets": m007,
  "008_auth": m008,
  "009_user_disabled": m009,
  "011_sections": m011,
  "012_search": m012,
  "013_scheduled_publishing": m013,
  "014_draft_revisions": m014,
  "015_indexes": m015,
  "016_api_tokens": m016,
  "017_authorization_codes": m017,
  "018_seo": m018,
  "019_i18n": m019,
  "020_collection_url_pattern": m020,
  "021_remove_section_categories": m021,
  "022_marketplace_plugin_state": m022,
  "023_plugin_metadata": m023,
  "024_media_placeholders": m024,
  "025_oauth_clients": m025,
  "026_cron_tasks": m026,
  "027_comments": m027,
  "028_drop_author_url": m028,
  "029_redirects": m029,
  "030_widen_scheduled_index": m030,
  "031_bylines": m031,
  "032_rate_limits": m032,
  "033_optimize_content_indexes": m033,
  "034_published_at_index": m034,
  "035_bounded_404_log": m035,
  "036_i18n_menus_and_taxonomies": m036,
  "037_credential_algorithm": m037
});
const MIGRATION_COUNT = Object.keys(MIGRATIONS).length;
class StaticMigrationProvider {
  async getMigrations() {
    return MIGRATIONS;
  }
}
const MIGRATION_TABLE = "_emdash_migrations";
const MIGRATION_LOCK_TABLE = "_emdash_migrations_lock";
const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;
function escapeRegExp(value) {
  return value.replace(REGEX_ESCAPE_PATTERN, "\\$&");
}
const MIGRATION_RACE_PATTERN = new RegExp(
  `UNIQUE constraint failed: ${escapeRegExp(MIGRATION_TABLE)}\\.name`,
  "i"
);
const MIGRATION_RACE_WAIT_MS = 1e4;
const MIGRATION_RACE_POLL_MS = 100;
const MIGRATION_TABLE_MISSING_PATTERN = new RegExp(
  `(?:no such table:\\s*${escapeRegExp(MIGRATION_TABLE)}\\b|(?:relation|table)\\s+"?${escapeRegExp(MIGRATION_TABLE)}"?\\s+does(?:n't| not) exist\\b)`,
  "i"
);
async function getAppliedMigrationCount(db) {
  try {
    const result = await sql`
			SELECT COUNT(*) as count FROM ${sql.ref(MIGRATION_TABLE)}
		`.execute(db);
    return Number(result.rows[0]?.count ?? 0);
  } catch (error) {
    if (MIGRATION_TABLE_MISSING_PATTERN.test(deepErrorMessage(error))) {
      return null;
    }
    throw error;
  }
}
async function waitForConcurrentMigrator(db) {
  const deadline = Date.now() + MIGRATION_RACE_WAIT_MS;
  while (Date.now() < deadline) {
    const count = await getAppliedMigrationCount(db);
    if (count !== null && count >= MIGRATION_COUNT) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, MIGRATION_RACE_POLL_MS));
  }
  const finalCount = await getAppliedMigrationCount(db);
  return finalCount !== null && finalCount >= MIGRATION_COUNT;
}
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
async function runMigrations(db) {
  const initialCount = await getAppliedMigrationCount(db);
  if (initialCount !== null && initialCount >= MIGRATION_COUNT) {
    return { applied: [] };
  }
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
    migrationTableName: MIGRATION_TABLE,
    migrationLockTableName: MIGRATION_LOCK_TABLE
  });
  const { error, results } = await migrator.migrateToLatest();
  const applied = results?.filter((r) => r.status === "Success").map((r) => r.migrationName) ?? [];
  if (error) {
    const msg = deepErrorMessage(error);
    const failedMigration = results?.find((r) => r.status === "Error");
    if (MIGRATION_RACE_PATTERN.test(msg)) {
      const settled = await waitForConcurrentMigrator(db);
      if (settled) {
        return { applied };
      }
    }
    const failedSuffix = failedMigration ? ` (migration: ${failedMigration.migrationName})` : "";
    throw new Error(`Migration failed: ${msg || "unknown error"}${failedSuffix}`);
  }
  return { applied };
}

export { runMigrations as r };
