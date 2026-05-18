import { sql } from 'kysely';
import { v as validateIdentifier } from './validate_AseaonR5.mjs';

const SITEMAP_MAX_ENTRIES = 5e4;
async function handleSitemapData(db, collectionSlug) {
  try {
    let query = db.selectFrom("_emdash_collections").select(["slug", "url_pattern"]).where("has_seo", "=", 1);
    if (collectionSlug) {
      query = query.where("slug", "=", collectionSlug);
    }
    const collections = await query.execute();
    const result = [];
    for (const col of collections) {
      try {
        validateIdentifier(col.slug, "collection slug");
      } catch {
        console.warn(`[SITEMAP] Skipping collection with invalid slug: ${col.slug}`);
        continue;
      }
      const tableName = `ec_${col.slug}`;
      try {
        const rows = await sql`
					SELECT c.slug, c.id, c.updated_at
					FROM ${sql.ref(tableName)} c
					LEFT JOIN _emdash_seo s
						ON s.collection = ${col.slug}
						AND s.content_id = c.id
					WHERE c.status = 'published'
					AND c.deleted_at IS NULL
					AND (s.seo_no_index IS NULL OR s.seo_no_index = 0)
					ORDER BY c.updated_at DESC
					LIMIT ${SITEMAP_MAX_ENTRIES}
				`.execute(db);
        if (rows.rows.length === 0) continue;
        const entries = [];
        for (const row of rows.rows) {
          entries.push({
            id: row.id,
            slug: row.slug,
            updatedAt: row.updated_at
          });
        }
        result.push({
          collection: col.slug,
          urlPattern: col.url_pattern,
          // Rows are ordered by updated_at DESC, so first row is the latest
          lastmod: rows.rows[0].updated_at,
          entries
        });
      } catch (err) {
        console.warn(`[SITEMAP] Failed to query collection "${col.slug}":`, err);
        continue;
      }
    }
    return { success: true, data: { collections: result } };
  } catch (error) {
    console.error("[SITEMAP_ERROR]", error);
    return {
      success: false,
      error: { code: "SITEMAP_ERROR", message: "Failed to generate sitemap data" }
    };
  }
}

export { handleSitemapData as h };
