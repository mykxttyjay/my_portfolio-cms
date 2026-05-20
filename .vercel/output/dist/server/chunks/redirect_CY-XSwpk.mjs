import { sql } from 'kysely';
import { ulid } from 'ulidx';
import { a as currentTimestampValue } from './dialect-helpers_CuVG6c2S.mjs';
import { decodeCursor, encodeCursor } from './types_D-lIeGNL.mjs';

const PARAM_PATTERN = /\[(\w+)\]/g;
const SPLAT_PATTERN = /\[\.\.\.(\w+)\]/g;
const ANY_PLACEHOLDER = /\[(?:\.\.\.)?(\w+)\]/g;
const NESTED_BRACKETS = /\[[^\]]*\[/;
const EMPTY_BRACKETS = /\[\]/;
const OPEN_BRACKET = /\[/g;
const CLOSE_BRACKET = /\]/g;
const CAPTURE_GROUP_SPLIT = /(\([^)]+\))/;
const REGEX_SPECIAL_CHARS = /[.*+?^${}|\\]/g;
function isPattern(source) {
  return source.match(ANY_PLACEHOLDER) !== null;
}
function validatePattern(source) {
  if (!source.startsWith("/")) {
    return "Pattern must start with /";
  }
  if (NESTED_BRACKETS.test(source)) {
    return "Nested brackets are not allowed";
  }
  if (EMPTY_BRACKETS.test(source)) {
    return "Empty brackets are not allowed";
  }
  const openCount = (source.match(OPEN_BRACKET) ?? []).length;
  const closeCount = (source.match(CLOSE_BRACKET) ?? []).length;
  if (openCount !== closeCount) {
    return "Unmatched brackets";
  }
  const segments = source.split("/").filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (SPLAT_PATTERN.test(segment) && i !== segments.length - 1) {
      SPLAT_PATTERN.lastIndex = 0;
      return "Catch-all [...param] must be in the last segment";
    }
    SPLAT_PATTERN.lastIndex = 0;
  }
  for (const segment of segments) {
    const placeholders = segment.match(ANY_PLACEHOLDER);
    if (placeholders && placeholders.length > 1) {
      return "Each segment can contain at most one placeholder";
    }
    if (placeholders && placeholders[0] !== segment) {
      return "A placeholder must be the entire segment, not mixed with literal text";
    }
  }
  const names = [];
  for (const m of source.matchAll(ANY_PLACEHOLDER)) {
    const name = m[1];
    if (names.includes(name)) {
      return `Duplicate parameter name: ${name}`;
    }
    names.push(name);
  }
  return null;
}
function validateDestinationParams(source, destination) {
  const sourceNames = /* @__PURE__ */ new Set();
  for (const m of source.matchAll(ANY_PLACEHOLDER)) {
    sourceNames.add(m[1]);
  }
  for (const m of destination.matchAll(ANY_PLACEHOLDER)) {
    const name = m[1];
    if (!sourceNames.has(name)) {
      return `Destination references [${name}] which is not captured in the source pattern`;
    }
  }
  return null;
}
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
  const parts = regexStr.split(CAPTURE_GROUP_SPLIT);
  const escaped = parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return part.replace(REGEX_SPECIAL_CHARS, "\\$&");
  }).join("");
  return {
    regex: new RegExp(`^${escaped}$`),
    paramNames,
    source
  };
}
function matchPattern(compiled, path) {
  const match = path.match(compiled.regex);
  if (!match) return null;
  const params = {};
  for (let i = 0; i < compiled.paramNames.length; i++) {
    const value = match[i + 1];
    if (value !== void 0) {
      params[compiled.paramNames[i]] = value;
    }
  }
  return params;
}
function interpolateDestination(destination, params) {
  let result = destination.replace(SPLAT_PATTERN, (_match, name) => {
    return params[name] ?? "";
  });
  result = result.replace(PARAM_PATTERN, (_match, name) => {
    return params[name] ?? "";
  });
  return result;
}

const MAX_404_LOG_ROWS = 1e4;
const REFERRER_MAX_LENGTH = 512;
const USER_AGENT_MAX_LENGTH = 256;
const LIKE_ESCAPE_RE = /[\\%_]/g;
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
class RedirectRepository {
  constructor(db) {
    this.db = db;
  }
  // --- CRUD ---------------------------------------------------------------
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
      const escaped = opts.search.replace(LIKE_ESCAPE_RE, (c) => `\\${c}`);
      const term = `%${escaped}%`;
      query = query.where(
        (eb) => eb.or([
          sql`source LIKE ${term} ESCAPE '\\'`,
          sql`destination LIKE ${term} ESCAPE '\\'`
        ])
      );
    }
    if (opts.group !== void 0) {
      query = query.where("group_name", "=", opts.group);
    }
    if (opts.enabled !== void 0) {
      query = query.where("enabled", "=", opts.enabled ? 1 : 0);
    }
    if (opts.auto !== void 0) {
      query = query.where("auto", "=", opts.auto ? 1 : 0);
    }
    if (opts.cursor) {
      const decoded = decodeCursor(opts.cursor);
      query = query.where(
        (eb) => eb.or([
          eb("created_at", "<", decoded.orderValue),
          eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)])
        ])
      );
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
    const existing = await this.findById(id);
    if (!existing) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const values = { updated_at: now };
    if (input.source !== void 0) {
      values.source = input.source;
      values.is_pattern = input.isPattern !== void 0 ? input.isPattern ? 1 : 0 : isPattern(input.source) ? 1 : 0;
    } else if (input.isPattern !== void 0) {
      values.is_pattern = input.isPattern ? 1 : 0;
    }
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
    const rows = await this.db.selectFrom("_emdash_redirects").selectAll().where("enabled", "=", 1).execute();
    return rows.map(rowToRedirect);
  }
  // --- Matching -----------------------------------------------------------
  async findExactMatch(path) {
    const row = await this.db.selectFrom("_emdash_redirects").selectAll().where("source", "=", path).where("enabled", "=", 1).where("is_pattern", "=", 0).executeTakeFirst();
    return row ? rowToRedirect(row) : null;
  }
  async findEnabledPatternRules() {
    const rows = await this.db.selectFrom("_emdash_redirects").selectAll().where("enabled", "=", 1).where("is_pattern", "=", 1).execute();
    return rows.map(rowToRedirect);
  }
  /**
   * Match a request path against all enabled redirect rules.
   * Checks exact matches first (indexed), then pattern rules.
   * Returns the matched redirect and the resolved destination URL.
   */
  async matchPath(path) {
    const exact = await this.findExactMatch(path);
    if (exact) {
      return { redirect: exact, resolvedDestination: exact.destination };
    }
    const patterns = await this.findEnabledPatternRules();
    for (const redirect of patterns) {
      const compiled = compilePattern(redirect.source);
      const params = matchPattern(compiled, path);
      if (params) {
        const resolved = interpolateDestination(redirect.destination, params);
        return { redirect, resolvedDestination: resolved };
      }
    }
    return null;
  }
  // --- Hit tracking -------------------------------------------------------
  async recordHit(id) {
    await sql`
			UPDATE _emdash_redirects
			SET hits = hits + 1, last_hit_at = ${currentTimestampValue(this.db)}, updated_at = ${currentTimestampValue(this.db)}
			WHERE id = ${id}
		`.execute(this.db);
  }
  // --- Auto-redirects (slug change) ---------------------------------------
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
    if (existing) {
      return await this.update(existing.id, { destination: newUrl });
    }
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
  // --- 404 log ------------------------------------------------------------
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
    }).onConflict(
      (oc) => oc.column("path").doUpdateSet({
        hits: sql`hits + 1`,
        last_seen_at: now,
        referrer,
        user_agent: userAgent,
        ip
      })
    ).execute();
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
    await this.db.deleteFrom("_emdash_404_log").where(
      "id",
      "in",
      this.db.selectFrom("_emdash_404_log").select("id").orderBy("last_seen_at", "asc").orderBy("id", "asc").limit(excess)
    ).execute();
  }
  async find404s(opts) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    let query = this.db.selectFrom("_emdash_404_log").selectAll().orderBy("created_at", "desc").orderBy("id", "desc").limit(limit + 1);
    if (opts.search) {
      const escaped = opts.search.replace(LIKE_ESCAPE_RE, (c) => `\\${c}`);
      const term = `%${escaped}%`;
      query = query.where(sql`path LIKE ${term} ESCAPE '\\'`);
    }
    if (opts.cursor) {
      const decoded = decodeCursor(opts.cursor);
      query = query.where(
        (eb) => eb.or([
          eb("created_at", "<", decoded.orderValue),
          eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)])
        ])
      );
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
    const rows = await sql`
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
		`.execute(this.db);
    return rows.rows.map((row) => ({
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
}

export { RedirectRepository as R, isPattern as a, validateDestinationParams as b, compilePattern as c, interpolateDestination as i, matchPattern as m, validatePattern as v };
