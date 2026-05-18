import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { sql } from 'kysely';
import { C as ContentRepository } from './content_B4ef0P4I.mjs';
import { M as MediaRepository } from './media_CEdPKDLW.mjs';
import { U as UserRepository } from './user_C8998lto.mjs';
import { v as validateIdentifier } from './validate_AseaonR5.mjs';

async function handleDashboardStats(db) {
  try {
    const collections = await db.selectFrom("_emdash_collections").select(["slug", "label"]).orderBy("slug", "asc").execute();
    const contentRepo = new ContentRepository(db);
    const collectionStats = await Promise.all(
      collections.map(async (col) => {
        const stats = await contentRepo.getStats(col.slug);
        return {
          slug: col.slug,
          label: col.label,
          total: stats.total,
          published: stats.published,
          draft: stats.draft
        };
      })
    );
    const mediaRepo = new MediaRepository(db);
    const userRepo = new UserRepository(db);
    const [mediaCount, userCount] = await Promise.all([mediaRepo.count(), userRepo.count()]);
    const recentItems = await fetchRecentItems(db, collections);
    return {
      success: true,
      data: {
        collections: collectionStats,
        mediaCount,
        userCount,
        recentItems
      }
    };
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return {
      success: false,
      error: {
        code: "DASHBOARD_STATS_ERROR",
        message: "Failed to load dashboard statistics"
      }
    };
  }
}
async function fetchRecentItems(db, collections) {
  if (collections.length === 0) return [];
  const titleFields = await db.selectFrom("_emdash_fields as f").innerJoin("_emdash_collections as c", "c.id", "f.collection_id").select(["c.slug as collection_slug"]).where("f.slug", "=", "title").execute();
  const collectionsWithTitle = new Set(titleFields.map((r) => r.collection_slug));
  const perCollection = await Promise.all(
    collections.map(async (col) => {
      validateIdentifier(col.slug);
      const table = `ec_${col.slug}`;
      const hasTitle = collectionsWithTitle.has(col.slug);
      const titleExpr = hasTitle ? sql`COALESCE(title, slug, id)` : sql`COALESCE(slug, id)`;
      const result = await sql`
				SELECT
					id,
					${sql.lit(col.slug)} AS collection,
					${sql.lit(col.label)} AS collection_label,
					${titleExpr} AS title,
					slug,
					status,
					updated_at,
					author_id
				FROM ${sql.ref(table)}
				WHERE deleted_at IS NULL
				ORDER BY updated_at DESC
				LIMIT 10
			`.execute(db);
      return result.rows;
    })
  );
  const merged = perCollection.flat().toSorted((a, b) => a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0).slice(0, 10);
  return merged.map((row) => ({
    id: row.id,
    collection: row.collection,
    collectionLabel: row.collection_label,
    title: row.title,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updated_at,
    authorId: row.author_id
  }));
}

const prerender = false;
const GET = async ({ locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "content:read");
  if (denied) return denied;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const result = await handleDashboardStats(emdash.db);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to load dashboard", "DASHBOARD_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
