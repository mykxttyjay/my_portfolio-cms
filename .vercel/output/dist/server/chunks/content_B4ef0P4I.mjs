import { sql } from 'kysely';
import { ulid } from 'ulidx';
import { s as slugify } from './slugify_CsLGd2A7.mjs';
import { v as validateIdentifier } from './validate_AseaonR5.mjs';
import { R as RevisionRepository } from './revision_CCTbRhmI.mjs';
import { EmDashValidationError, decodeCursor, encodeCursor } from './types_D-lIeGNL.mjs';

const ULID_PATTERN = /^[0-9A-Z]{26}$/;
const SYSTEM_COLUMNS = /* @__PURE__ */ new Set([
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
function getTableName(type) {
  validateIdentifier(type, "collection type");
  return `ec_${type}`;
}
function serializeValue(value) {
  if (value === null || value === void 0) {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}
function deserializeValue(value) {
  if (typeof value === "string") {
    if (value.startsWith("{") || value.startsWith("[")) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  }
  return value;
}
const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;
function escapeRegExp(s) {
  return s.replace(REGEX_ESCAPE_PATTERN, "\\$&");
}
class ContentRepository {
  constructor(db) {
    this.db = db;
  }
  /**
   * Create a new content item
   */
  async create(input) {
    const id = ulid();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const {
      type,
      slug,
      data,
      status = "draft",
      authorId,
      primaryBylineId,
      locale,
      translationOf,
      publishedAt,
      createdAt
    } = input;
    if (!type) {
      throw new EmDashValidationError("Content type is required");
    }
    const tableName = getTableName(type);
    let translationGroup = id;
    if (translationOf) {
      const source = await this.findById(type, translationOf);
      if (!source) {
        throw new EmDashValidationError("Translation source content not found");
      }
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
      for (const [key, value] of Object.entries(data)) {
        if (!SYSTEM_COLUMNS.has(key)) {
          validateIdentifier(key, "content field name");
          columns.push(key);
          values.push(serializeValue(value));
        }
      }
    }
    const columnRefs = columns.map((c) => sql.ref(c));
    const valuePlaceholders = values.map((v) => v === null ? sql`NULL` : sql`${v}`);
    await sql`
			INSERT INTO ${sql.ref(tableName)} (${sql.join(columnRefs, sql`, `)})
			VALUES (${sql.join(valuePlaceholders, sql`, `)})
		`.execute(this.db);
    const item = await this.findById(type, id);
    if (!item) {
      throw new Error("Failed to create content");
    }
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
    const existing = locale ? await sql`
					SELECT slug FROM ${sql.ref(tableName)}
					WHERE slug = ${baseSlug}
					AND locale = ${locale}
					LIMIT 1
				`.execute(this.db) : await sql`
					SELECT slug FROM ${sql.ref(tableName)}
					WHERE slug = ${baseSlug}
					LIMIT 1
				`.execute(this.db);
    if (existing.rows.length === 0) {
      return baseSlug;
    }
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
    if (!original) {
      throw new EmDashValidationError("Content item not found");
    }
    const newData = { ...original.data };
    if (typeof newData.title === "string") {
      newData.title = `${newData.title} (Copy)`;
    } else if (typeof newData.name === "string") {
      newData.name = `${newData.name} (Copy)`;
    }
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
    const result = await sql`
			SELECT * FROM ${sql.ref(tableName)}
			WHERE id = ${id}
			AND deleted_at IS NULL
		`.execute(this.db);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.mapRow(type, row);
  }
  /**
   * Find content by id, including trashed (soft-deleted) items.
   * Used by restore endpoint for ownership checks.
   */
  async findByIdIncludingTrashed(type, id) {
    const tableName = getTableName(type);
    const result = await sql`
			SELECT * FROM ${sql.ref(tableName)}
			WHERE id = ${id}
		`.execute(this.db);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
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
    const result = locale ? await sql`
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
				`.execute(this.db);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.mapRow(type, row);
  }
  /**
   * Find content by slug, including trashed (soft-deleted) items.
   * Used by restore/permanent-delete endpoints.
   */
  async findBySlugIncludingTrashed(type, slug, locale) {
    const tableName = getTableName(type);
    const result = locale ? await sql`
					SELECT * FROM ${sql.ref(tableName)}
					WHERE slug = ${slug}
					AND locale = ${locale}
				`.execute(this.db) : await sql`
					SELECT * FROM ${sql.ref(tableName)}
					WHERE slug = ${slug}
					ORDER BY locale ASC
					LIMIT 1
				`.execute(this.db);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
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
    if (options.where?.status) {
      query = query.where("status", "=", options.where.status);
    }
    if (options.where?.authorId) {
      query = query.where("author_id", "=", options.where.authorId);
    }
    if (options.where?.locale) {
      query = query.where("locale", "=", options.where.locale);
    }
    if (options.cursor) {
      const { orderValue, id: cursorId } = decodeCursor(options.cursor);
      if (safeOrderDirection === "DESC") {
        query = query.where(
          (eb) => eb.or([
            eb(dbField, "<", orderValue),
            eb.and([eb(dbField, "=", orderValue), eb("id", "<", cursorId)])
          ])
        );
      } else {
        query = query.where(
          (eb) => eb.or([
            eb(dbField, ">", orderValue),
            eb.and([eb(dbField, "=", orderValue), eb("id", ">", cursorId)])
          ])
        );
      }
    }
    query = query.orderBy(dbField, safeOrderDirection === "ASC" ? "asc" : "desc").orderBy("id", safeOrderDirection === "ASC" ? "asc" : "desc").limit(limit + 1);
    const rows = await query.execute();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const mappedResult = {
      items: items.map((row) => this.mapRow(type, row))
    };
    if (hasMore && items.length > 0) {
      const lastRow = items.at(-1);
      const lastOrderValue = lastRow[dbField];
      const orderStr = typeof lastOrderValue === "string" || typeof lastOrderValue === "number" ? String(lastOrderValue) : "";
      mappedResult.nextCursor = encodeCursor(orderStr, String(lastRow.id));
    }
    return mappedResult;
  }
  /**
   * Update content
   */
  async update(type, id, input) {
    const tableName = getTableName(type);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updates = {
      updated_at: now,
      version: sql`version + 1`
    };
    if (input.status !== void 0) {
      updates.status = input.status;
    }
    if (input.slug !== void 0) {
      updates.slug = input.slug;
    }
    if (input.publishedAt !== void 0) {
      updates.published_at = input.publishedAt;
    }
    if (input.scheduledAt !== void 0) {
      updates.scheduled_at = input.scheduledAt;
    }
    if (input.authorId !== void 0) {
      updates.author_id = input.authorId;
    }
    if (input.primaryBylineId !== void 0) {
      updates.primary_byline_id = input.primaryBylineId;
    }
    if (input.data !== void 0 && typeof input.data === "object") {
      for (const [key, value] of Object.entries(input.data)) {
        if (!SYSTEM_COLUMNS.has(key)) {
          validateIdentifier(key, "content field name");
          updates[key] = serializeValue(value);
        }
      }
    }
    await this.db.updateTable(tableName).set(updates).where("id", "=", id).where("deleted_at", "is", null).execute();
    const updated = await this.findById(type, id);
    if (!updated) {
      throw new Error("Content not found");
    }
    return updated;
  }
  /**
   * Delete content (soft delete - moves to trash)
   */
  async delete(type, id) {
    const tableName = getTableName(type);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = await sql`
			UPDATE ${sql.ref(tableName)}
			SET deleted_at = ${now}
			WHERE id = ${id}
			AND deleted_at IS NULL
		`.execute(this.db);
    return (result.numAffectedRows ?? 0n) > 0n;
  }
  /**
   * Restore content from trash
   */
  async restore(type, id) {
    const tableName = getTableName(type);
    const result = await sql`
			UPDATE ${sql.ref(tableName)}
			SET deleted_at = NULL
			WHERE id = ${id}
			AND deleted_at IS NOT NULL
		`.execute(this.db);
    return (result.numAffectedRows ?? 0n) > 0n;
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
    const result = await sql`
			DELETE FROM ${sql.ref(tableName)}
			WHERE id = ${id}
			AND deleted_at IS NOT NULL
		`.execute(this.db);
    return (result.numAffectedRows ?? 0n) > 0n;
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
      if (safeOrderDirection === "DESC") {
        query = query.where(
          (eb) => eb.or([
            eb(dbField, "<", orderValue),
            eb.and([eb(dbField, "=", orderValue), eb("id", "<", cursorId)])
          ])
        );
      } else {
        query = query.where(
          (eb) => eb.or([
            eb(dbField, ">", orderValue),
            eb.and([eb(dbField, "=", orderValue), eb("id", ">", cursorId)])
          ])
        );
      }
    }
    query = query.orderBy(dbField, safeOrderDirection === "ASC" ? "asc" : "desc").orderBy("id", safeOrderDirection === "ASC" ? "asc" : "desc").limit(limit + 1);
    const rows = await query.execute();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const mappedResult = {
      items: items.map((row) => {
        const record = row;
        return {
          ...this.mapRow(type, record),
          deletedAt: typeof record.deleted_at === "string" ? record.deleted_at : ""
        };
      })
    };
    if (hasMore && items.length > 0) {
      const lastRow = items.at(-1);
      const lastOrderValue = lastRow[dbField];
      const orderStr = typeof lastOrderValue === "string" || typeof lastOrderValue === "number" ? String(lastOrderValue) : "";
      mappedResult.nextCursor = encodeCursor(orderStr, String(lastRow.id));
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
    if (where?.status) {
      query = query.where("status", "=", where.status);
    }
    if (where?.authorId) {
      query = query.where("author_id", "=", where.authorId);
    }
    if (where?.locale) {
      query = query.where("locale", "=", where.locale);
    }
    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }
  // get overall statistics (total, published, draft) for a content type in a single query
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
    if (isNaN(scheduledDate.getTime())) {
      throw new EmDashValidationError("Invalid scheduled date");
    }
    if (scheduledDate <= /* @__PURE__ */ new Date()) {
      throw new EmDashValidationError("Scheduled date must be in the future");
    }
    const existing = await this.findById(type, id);
    if (!existing) {
      throw new EmDashValidationError("Content item not found");
    }
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
    if (!updated) {
      throw new Error("Content not found");
    }
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
    if (!existing) {
      throw new EmDashValidationError("Content item not found");
    }
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
    if (!updated) {
      throw new Error("Content not found");
    }
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
    const result = await sql`
			SELECT * FROM ${sql.ref(tableName)}
			WHERE scheduled_at IS NOT NULL
			AND scheduled_at <= ${now}
			AND deleted_at IS NULL
			ORDER BY scheduled_at ASC
		`.execute(this.db);
    return result.rows.map((row) => this.mapRow(type, row));
  }
  /**
   * Find all translations in a translation group
   */
  async findTranslations(type, translationGroup) {
    const tableName = getTableName(type);
    const result = await sql`
			SELECT * FROM ${sql.ref(tableName)}
			WHERE translation_group = ${translationGroup}
			AND deleted_at IS NULL
			ORDER BY locale ASC
		`.execute(this.db);
    return result.rows.map((row) => this.mapRow(type, row));
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
    if (!existing) {
      throw new EmDashValidationError("Content item not found");
    }
    const revisionRepo = new RevisionRepository(this.db);
    let revisionToPublish = existing.draftRevisionId || existing.liveRevisionId;
    if (!revisionToPublish) {
      const revision2 = await revisionRepo.create({
        collection: type,
        entryId: id,
        data: existing.data
      });
      revisionToPublish = revision2.id;
    }
    const revision = await revisionRepo.findById(revisionToPublish);
    if (revision) {
      await this.syncDataColumns(type, id, revision.data);
      if (typeof revision.data._slug === "string") {
        await sql`
					UPDATE ${sql.ref(tableName)}
					SET slug = ${revision.data._slug}
					WHERE id = ${id}
				`.execute(this.db);
      }
    }
    if (publishedAt !== void 0) {
      await sql`
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
    } else {
      await sql`
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
    }
    const updated = await this.findById(type, id);
    if (!updated) {
      throw new Error("Content not found");
    }
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
    if (!existing) {
      throw new EmDashValidationError("Content item not found");
    }
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
    if (!updated) {
      throw new Error("Content not found");
    }
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
    const existing = await this.findById(type, id);
    if (!existing) {
      throw new EmDashValidationError("Content item not found");
    }
    const revisionRepo = new RevisionRepository(this.db);
    const revision = await revisionRepo.findById(revisionId);
    if (!revision) {
      throw new EmDashValidationError("Revision not found");
    }
    if (revision.collection !== type || revision.entryId !== id) {
      throw new EmDashValidationError("Revision does not belong to the specified content item");
    }
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
    if (!existing) {
      throw new EmDashValidationError("Content item not found");
    }
    if (!existing.draftRevisionId) {
      return existing;
    }
    await sql`
			UPDATE ${sql.ref(tableName)}
			SET draft_revision_id = NULL,
				updated_at = ${now}
			WHERE id = ${id}
			AND deleted_at IS NULL
		`.execute(this.db);
    const updated = await this.findById(type, id);
    if (!updated) {
      throw new Error("Content not found");
    }
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
    for (const [key, value] of Object.entries(row)) {
      if (!SYSTEM_COLUMNS.has(key) && value !== null) {
        data[key] = deserializeValue(value);
      }
    }
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
    const mapping = {
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
    };
    const mapped = mapping[field];
    if (!mapped) {
      throw new EmDashValidationError(`Invalid order field: ${field}`);
    }
    return mapped;
  }
}

export { ContentRepository as C };
