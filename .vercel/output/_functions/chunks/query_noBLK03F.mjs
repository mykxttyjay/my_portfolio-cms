import { sql } from 'kysely';
import { v as validateIdentifier } from './validate_AseaonR5.mjs';
import { g as getDb } from './loader_DjfVmeQr.mjs';
import { FTSManager } from './fts-manager_BjkO4e5p.mjs';

const WHITESPACE_SPLIT_PATTERN = /\s+/;
const FTS_OPERATORS_PATTERN = /\b(AND|OR|NOT|NEAR)\b/i;
const DOUBLE_QUOTE_PATTERN = /"/g;
function isFts5SyntaxError(error) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("fts5: syntax error") || message.includes("unknown special query");
}
async function search(query, options = {}) {
  const db = await getDb();
  return searchWithDb(db, query, options);
}
async function searchWithDb(db, query, options = {}) {
  const ftsManager = new FTSManager(db);
  const limit = options.limit ?? 20;
  const status = options.status ?? "published";
  let collections = options.collections;
  if (!collections || collections.length === 0) {
    collections = await getSearchableCollections(db);
  }
  if (collections.length === 0) {
    return { items: [] };
  }
  const allResults = [];
  for (const collection of collections) {
    const config = await ftsManager.getSearchConfig(collection);
    if (!config?.enabled) {
      continue;
    }
    const collectionResults = await searchSingleCollection(
      db,
      collection,
      query,
      {
        status,
        locale: options.locale,
        limit: limit * 2
        // Get extra for merging
      },
      config.weights
    );
    allResults.push(...collectionResults);
  }
  allResults.sort((a, b) => b.score - a.score);
  const items = allResults.slice(0, limit);
  return { items };
}
async function searchCollection(db, collection, query, options = {}) {
  const ftsManager = new FTSManager(db);
  const config = await ftsManager.getSearchConfig(collection);
  if (!config?.enabled) {
    return { items: [] };
  }
  const items = await searchSingleCollection(db, collection, query, options, config.weights);
  return { items };
}
async function searchSingleCollection(db, collection, query, options, weights) {
  validateIdentifier(collection, "collection slug");
  const ftsManager = new FTSManager(db);
  const ftsTable = ftsManager.getFtsTableName(collection);
  const contentTable = ftsManager.getContentTableName(collection);
  const limit = options.limit ?? 20;
  const status = options.status ?? "published";
  const locale = options.locale;
  if (!await ftsManager.ftsTableExists(collection)) {
    return [];
  }
  const escapedQuery = escapeQuery(query);
  if (!escapedQuery) {
    return [];
  }
  const searchableFields = await ftsManager.getSearchableFields(collection);
  let bm25Args = "";
  if (weights && searchableFields.length > 0) {
    const weightValues = ["0", "0"];
    for (const field of searchableFields) {
      weightValues.push(String(weights[field] ?? 1));
    }
    bm25Args = weightValues.join(", ");
  }
  const bm25Expr = bm25Args ? `bm25("${ftsTable}", ${bm25Args})` : `bm25("${ftsTable}")`;
  let results;
  try {
    results = await sql`
		SELECT 
			c.id,
			c.slug,
			c.locale,
			c.title,
			snippet("${sql.raw(ftsTable)}", 2, '<mark>', '</mark>', '...', 32) as snippet,
			${sql.raw(bm25Expr)} as score
		FROM "${sql.raw(ftsTable)}" f
		JOIN "${sql.raw(contentTable)}" c ON f.id = c.id
		WHERE "${sql.raw(ftsTable)}" MATCH ${escapedQuery}
		AND c.status = ${status}
		AND c.deleted_at IS NULL
		${locale ? sql`AND c.locale = ${locale}` : sql``}
		ORDER BY score
		LIMIT ${limit}
	`.execute(db);
  } catch (error) {
    if (isFts5SyntaxError(error)) {
      return [];
    }
    throw error;
  }
  return results.rows.map((row) => ({
    collection,
    id: row.id,
    slug: row.slug,
    locale: row.locale,
    title: row.title ?? void 0,
    // SQLite's snippet() returns NULL when the targeted column is
    // NULL for that row — even if the row matched via a different
    // searchable column. Skip sanitization in that case so we don't
    // throw on `null.replace`. The SearchResult.snippet field is
    // already optional, so omitting it is the documented contract.
    snippet: row.snippet === null ? void 0 : sanitizeSnippet(row.snippet),
    score: Math.abs(row.score)
    // bm25 returns negative scores
  }));
}
const SNIPPET_AMP_RE = /&/g;
const SNIPPET_LT_RE = /</g;
const SNIPPET_GT_RE = />/g;
const SNIPPET_QUOT_RE = /"/g;
const SNIPPET_APOS_RE = /'/g;
function sanitizeSnippet(snippet) {
  return snippet.replace(SNIPPET_AMP_RE, "&amp;").replace(SNIPPET_LT_RE, "&lt;").replace(SNIPPET_GT_RE, "&gt;").replace(SNIPPET_QUOT_RE, "&quot;").replace(SNIPPET_APOS_RE, "&#39;").replaceAll("&lt;mark&gt;", "<mark>").replaceAll("&lt;/mark&gt;", "</mark>");
}
async function getSuggestions(db, query, options = {}) {
  const limit = options.limit ?? 5;
  const locale = options.locale;
  let collections = options.collections;
  if (!collections || collections.length === 0) {
    collections = await getSearchableCollections(db);
  }
  if (collections.length === 0) {
    return [];
  }
  const suggestions = [];
  for (const collection of collections) {
    const ftsManager = new FTSManager(db);
    const config = await ftsManager.getSearchConfig(collection);
    if (!config?.enabled) {
      continue;
    }
    validateIdentifier(collection, "collection slug");
    const ftsTable = ftsManager.getFtsTableName(collection);
    const contentTable = ftsManager.getContentTableName(collection);
    const prefixQuery = escapeQuery(query);
    if (!prefixQuery) {
      continue;
    }
    let results;
    try {
      results = await sql`
				SELECT 
					c.id,
					c.title
				FROM "${sql.raw(ftsTable)}" f
				JOIN "${sql.raw(contentTable)}" c ON f.id = c.id
				WHERE "${sql.raw(ftsTable)}" MATCH ${prefixQuery}
				AND c.status = 'published'
				AND c.deleted_at IS NULL
				AND c.title IS NOT NULL
				${locale ? sql`AND c.locale = ${locale}` : sql``}
				ORDER BY bm25("${sql.raw(ftsTable)}")
				LIMIT ${limit}
			`.execute(db);
    } catch (error) {
      if (isFts5SyntaxError(error)) {
        continue;
      }
      throw error;
    }
    for (const row of results.rows) {
      suggestions.push({
        collection,
        id: row.id,
        title: row.title
      });
    }
  }
  return suggestions.slice(0, limit);
}
async function getSearchStats(db) {
  const ftsManager = new FTSManager(db);
  const collections = await getSearchableCollections(db);
  const stats = { collections: {} };
  for (const collection of collections) {
    const collectionStats = await ftsManager.getIndexStats(collection);
    if (collectionStats) {
      stats.collections[collection] = collectionStats;
    }
  }
  return stats;
}
async function getSearchableCollections(db) {
  const results = await db.selectFrom("_emdash_collections").select(["slug", "search_config"]).execute();
  return results.filter((r) => {
    if (!r.search_config) return false;
    try {
      const config = JSON.parse(r.search_config);
      return config.enabled === true;
    } catch {
      return false;
    }
  }).map((r) => r.slug);
}
function escapeQuery(query) {
  if (!query || typeof query !== "string") {
    return "";
  }
  query = query.trim();
  if (query.length === 0) {
    return "";
  }
  if (query.startsWith('"') && query.endsWith('"') && query.length >= 2) {
    const inner = query.slice(1, -1);
    return `"${inner.replace(DOUBLE_QUOTE_PATTERN, '""')}"`;
  }
  const escaped = query.replace(DOUBLE_QUOTE_PATTERN, '""');
  if (FTS_OPERATORS_PATTERN.test(query)) {
    return escaped;
  }
  const terms = escaped.split(WHITESPACE_SPLIT_PATTERN).filter((t) => t.length > 0);
  if (terms.length === 0) {
    return "";
  }
  return terms.map((t) => `"${t}"*`).join(" ");
}

export { getSuggestions as a, search as b, searchCollection as c, getSearchStats as g, searchWithDb as s };
