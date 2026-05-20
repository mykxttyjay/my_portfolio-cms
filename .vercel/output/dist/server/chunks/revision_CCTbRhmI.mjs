import { monotonicFactory } from 'ulidx';

const monotonic = monotonicFactory();
class RevisionRepository {
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
    if (!revision) {
      throw new Error("Failed to create revision");
    }
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
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const rows = await query.execute();
    return rows.map((row) => this.rowToRevision(row));
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
    const keep = await this.db.selectFrom("revisions").select("id").where("collection", "=", collection).where("entry_id", "=", entryId).orderBy("created_at", "desc").orderBy("id", "desc").limit(keepCount).execute();
    const keepIds = keep.map((r) => r.id);
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
}

export { RevisionRepository as R };
