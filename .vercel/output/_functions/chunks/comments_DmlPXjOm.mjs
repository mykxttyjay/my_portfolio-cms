import { sql } from 'kysely';
import { ulid } from 'ulidx';
import { decodeCursor, encodeCursor, InvalidCursorError } from './types_D-lIeGNL.mjs';

const LIKE_ESCAPE_RE = /[%_\\]/g;
class CommentRepository {
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
    if (!comment) {
      throw new Error("Failed to create comment");
    }
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
    if (options.status) {
      query = query.where("status", "=", options.status);
    }
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      query = query.where(
        (eb) => eb.or([
          eb("created_at", ">", decoded.orderValue),
          eb.and([eb("created_at", "=", decoded.orderValue), eb("id", ">", decoded.id)])
        ])
      );
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
    if (options.collection) {
      query = query.where("collection", "=", options.collection);
    }
    if (options.search) {
      const escaped = options.search.replace(LIKE_ESCAPE_RE, (ch) => `\\${ch}`);
      const term = `%${escaped}%`;
      query = query.where(
        (eb) => eb.or([
          sql`author_name LIKE ${term} ESCAPE '\\'`,
          sql`author_email LIKE ${term} ESCAPE '\\'`,
          sql`body LIKE ${term} ESCAPE '\\'`
        ])
      );
    }
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      query = query.where(
        (eb) => eb.or([
          eb("created_at", "<", decoded.orderValue),
          eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)])
        ])
      );
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
    await this.db.updateTable("_emdash_comments").set({ status, updated_at: now }).where("id", "=", id).execute();
    return this.findById(id);
  }
  /**
   * Bulk update comment statuses
   */
  async bulkUpdateStatus(ids, status) {
    if (ids.length === 0) return 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = await this.db.updateTable("_emdash_comments").set({ status, updated_at: now }).where("id", "in", ids).executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0);
  }
  /**
   * Hard-delete a single comment. Replies cascade via FK.
   */
  async delete(id) {
    const result = await this.db.deleteFrom("_emdash_comments").where("id", "=", id).executeTakeFirst();
    return (result.numDeletedRows ?? 0) > 0;
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
    if (status) {
      query = query.where("status", "=", status);
    }
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
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  /**
   * Assemble a flat list of comments into a threaded structure (1-level nesting)
   */
  static assembleThreads(comments) {
    const roots = [];
    const childrenMap = /* @__PURE__ */ new Map();
    for (const comment of comments) {
      if (comment.parentId) {
        const siblings = childrenMap.get(comment.parentId) ?? [];
        siblings.push(comment);
        childrenMap.set(comment.parentId, siblings);
      } else {
        roots.push(comment);
      }
    }
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
    if (comment._replies && comment._replies.length > 0) {
      pub.replies = comment._replies.map((r) => CommentRepository.toPublicComment(r));
    }
    return pub;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- selectAll returns runtime row
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
}
function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function handleCommentList(db, collection, contentId, options = {}) {
  try {
    const repo = new CommentRepository(db);
    const total = await repo.countByContent(collection, contentId, "approved");
    let publicItems;
    let nextCursor;
    if (options.threaded) {
      const MAX_THREADED = 500;
      const result = await repo.findByContent(collection, contentId, {
        status: "approved",
        limit: MAX_THREADED
      });
      const threaded = CommentRepository.assembleThreads(result.items);
      publicItems = threaded.map((c) => CommentRepository.toPublicComment(c));
    } else {
      const result = await repo.findByContent(collection, contentId, {
        status: "approved",
        limit: options.limit,
        cursor: options.cursor
      });
      publicItems = result.items.map((c) => CommentRepository.toPublicComment(c));
      nextCursor = result.nextCursor;
    }
    return {
      success: true,
      data: {
        items: publicItems,
        nextCursor,
        total
      }
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return {
        success: false,
        error: { code: "INVALID_CURSOR", message: error.message }
      };
    }
    console.error("Comment list error:", error);
    return {
      success: false,
      error: {
        code: "COMMENT_LIST_ERROR",
        message: "Failed to list comments"
      }
    };
  }
}
async function handleCommentInbox(db, options = {}) {
  try {
    const repo = new CommentRepository(db);
    const status = options.status ?? "pending";
    const result = await repo.findByStatus(status, {
      collection: options.collection,
      search: options.search,
      limit: options.limit,
      cursor: options.cursor
    });
    return {
      success: true,
      data: {
        items: result.items,
        nextCursor: result.nextCursor
      }
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return {
        success: false,
        error: { code: "INVALID_CURSOR", message: error.message }
      };
    }
    console.error("Comment inbox error:", error);
    return {
      success: false,
      error: {
        code: "COMMENT_INBOX_ERROR",
        message: "Failed to list comments"
      }
    };
  }
}
async function handleCommentCounts(db) {
  try {
    const repo = new CommentRepository(db);
    const counts = await repo.countByStatus();
    return { success: true, data: counts };
  } catch (error) {
    console.error("Comment counts error:", error);
    return {
      success: false,
      error: {
        code: "COMMENT_COUNTS_ERROR",
        message: "Failed to get comment counts"
      }
    };
  }
}
async function handleCommentGet(db, id) {
  try {
    const repo = new CommentRepository(db);
    const comment = await repo.findById(id);
    if (!comment) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: `Comment not found: ${id}` }
      };
    }
    return { success: true, data: comment };
  } catch (error) {
    console.error("Comment get error:", error);
    return {
      success: false,
      error: {
        code: "COMMENT_GET_ERROR",
        message: "Failed to get comment"
      }
    };
  }
}
async function handleCommentDelete(db, id) {
  try {
    const repo = new CommentRepository(db);
    const deleted = await repo.delete(id);
    if (!deleted) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: `Comment not found: ${id}` }
      };
    }
    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error("Comment delete error:", error);
    return {
      success: false,
      error: {
        code: "COMMENT_DELETE_ERROR",
        message: "Failed to delete comment"
      }
    };
  }
}
async function handleCommentBulk(db, ids, action) {
  try {
    const repo = new CommentRepository(db);
    let affected;
    if (action === "delete") {
      affected = await repo.bulkDelete(ids);
    } else {
      const statusMap = {
        approve: "approved",
        spam: "spam",
        trash: "trash"
      };
      affected = await repo.bulkUpdateStatus(ids, statusMap[action]);
    }
    return { success: true, data: { affected } };
  } catch (error) {
    console.error("Comment bulk error:", error);
    return {
      success: false,
      error: {
        code: "COMMENT_BULK_ERROR",
        message: "Failed to perform bulk operation"
      }
    };
  }
}
async function checkRateLimit(db, ipHash, maxPerWindow = 5, windowMinutes = 10) {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1e3).toISOString();
  const result = await db.selectFrom("_emdash_comments").select((eb) => eb.fn.count("id").as("count")).where("ip_hash", "=", ipHash).where("created_at", ">", cutoff).executeTakeFirst();
  const count = Number(result?.count ?? 0);
  return count >= maxPerWindow;
}
async function hashIp(ip, salt) {
  const data = `ip:${salt}:${ip}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export { CommentRepository as C, handleCommentCounts as a, handleCommentGet as b, handleCommentDelete as c, handleCommentInbox as d, handleCommentList as e, hashIp as f, checkRateLimit as g, handleCommentBulk as h };
