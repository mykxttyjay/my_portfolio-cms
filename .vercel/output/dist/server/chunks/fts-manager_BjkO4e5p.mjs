import { sql } from 'kysely';
import { t as tableExists, i as isSqlite } from './dialect-helpers_CuVG6c2S.mjs';
import { v as validateIdentifier } from './validate_AseaonR5.mjs';

class FTSManager {
  constructor(db) {
    this.db = db;
  }
  /**
   * Validate a collection slug and its searchable field names.
   * Must be called before any raw SQL interpolation.
   */
  validateInputs(collectionSlug, searchableFields) {
    validateIdentifier(collectionSlug, "collection slug");
    if (searchableFields) {
      for (const field of searchableFields) {
        validateIdentifier(field, "searchable field name");
      }
    }
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
    const columns = ["id UNINDEXED", "locale UNINDEXED", ...searchableFields].join(", ");
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
    if (!result?.search_config) {
      return null;
    }
    try {
      const parsed = JSON.parse(result.search_config);
      if (typeof parsed !== "object" || parsed === null || !("enabled" in parsed) || typeof parsed.enabled !== "boolean") {
        return null;
      }
      const config = { enabled: parsed.enabled };
      if ("weights" in parsed && typeof parsed.weights === "object" && parsed.weights !== null) {
        const weights = {};
        for (const [k, v] of Object.entries(parsed.weights)) {
          if (typeof v === "number") {
            weights[k] = v;
          }
        }
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
    if (!collection) {
      return [];
    }
    const fields = await this.db.selectFrom("_emdash_fields").select("slug").where("collection_id", "=", collection.id).where("searchable", "=", 1).execute();
    return fields.map((f) => f.slug);
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
    if (!isSqlite(this.db)) {
      throw new Error("Full-text search is only available with SQLite databases");
    }
    const searchableFields = await this.getSearchableFields(collectionSlug);
    if (searchableFields.length === 0) {
      throw new Error(
        `No searchable fields defined for collection "${collectionSlug}". Mark at least one field as searchable before enabling search.`
      );
    }
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
    await this.setSearchConfig(collectionSlug, { enabled: false, weights: existing?.weights });
  }
  /**
   * Get index statistics for a collection
   */
  async getIndexStats(collectionSlug) {
    if (!isSqlite(this.db)) return null;
    this.validateInputs(collectionSlug);
    const ftsTable = this.getFtsTableName(collectionSlug);
    const ftsDocsizeTable = `${ftsTable}_docsize`;
    if (!await this.ftsTableExists(collectionSlug)) {
      return null;
    }
    const result = await sql`
			SELECT COUNT(*) as count FROM "${sql.raw(ftsDocsizeTable)}"
		`.execute(this.db);
    return {
      indexed: result.rows[0]?.count ?? 0
    };
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
    const ftsTable = this.getFtsTableName(collectionSlug);
    const ftsDocsizeTable = `${ftsTable}_docsize`;
    const contentTable = this.getContentTableName(collectionSlug);
    const fields = await this.getSearchableFields(collectionSlug);
    const config = await this.getSearchConfig(collectionSlug);
    if (!await this.ftsTableExists(collectionSlug)) {
      if (!config?.enabled || fields.length === 0) {
        return false;
      }
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
      console.warn(
        `FTS index for "${collectionSlug}" has ${ftsRows} rows but content table has ${contentRows}. Rebuilding.`
      );
      if (fields.length > 0) {
        await this.rebuildIndex(collectionSlug, fields, config?.weights);
      }
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
      const config = await this.getSearchConfig(slug);
      if (!config?.enabled) continue;
      try {
        const wasRepaired = await this.verifyAndRepairIndex(slug);
        if (wasRepaired) repaired++;
      } catch (error) {
        console.error(`Failed to verify/repair FTS index for "${slug}":`, error);
      }
    }
    return repaired;
  }
}

export { FTSManager };
