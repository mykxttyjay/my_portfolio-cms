import { sql } from 'kysely';

function escapeLike(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
class OptionsRepository {
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
    const value = await this.get(name);
    return value ?? defaultValue;
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
    const result = await this.db.insertInto("options").values(row).onConflict((oc) => oc.column("name").doNothing()).executeTakeFirst();
    return (result.numInsertedOrUpdatedRows ?? 0n) > 0n;
  }
  /**
   * Delete an option
   */
  async delete(name) {
    const result = await this.db.deleteFrom("options").where("name", "=", name).executeTakeFirst();
    return (result.numDeletedRows ?? 0) > 0;
  }
  /**
   * Check if an option exists
   */
  async exists(name) {
    const row = await this.db.selectFrom("options").select("name").where("name", "=", name).executeTakeFirst();
    return !!row;
  }
  /**
   * Get multiple options at once
   */
  async getMany(names) {
    if (names.length === 0) return /* @__PURE__ */ new Map();
    const rows = await this.db.selectFrom("options").select(["name", "value"]).where("name", "in", names).execute();
    const result = /* @__PURE__ */ new Map();
    for (const row of rows) {
      result.set(row.name, JSON.parse(row.value));
    }
    return result;
  }
  /**
   * Set multiple options at once
   */
  async setMany(options) {
    const entries = Object.entries(options);
    if (entries.length === 0) return;
    for (const [name, value] of entries) {
      await this.set(name, value);
    }
  }
  /**
   * Get all options (use sparingly)
   */
  async getAll() {
    const rows = await this.db.selectFrom("options").select(["name", "value"]).execute();
    const result = /* @__PURE__ */ new Map();
    for (const row of rows) {
      result.set(row.name, JSON.parse(row.value));
    }
    return result;
  }
  /**
   * Get all options matching a prefix
   */
  async getByPrefix(prefix) {
    const pattern = `${escapeLike(prefix)}%`;
    const rows = await this.db.selectFrom("options").select(["name", "value"]).where(sql`name LIKE ${pattern} ESCAPE '\\'`).execute();
    const result = /* @__PURE__ */ new Map();
    for (const row of rows) {
      result.set(row.name, JSON.parse(row.value));
    }
    return result;
  }
  /**
   * Delete all options matching a prefix
   */
  async deleteByPrefix(prefix) {
    const pattern = `${escapeLike(prefix)}%`;
    const result = await this.db.deleteFrom("options").where(sql`name LIKE ${pattern} ESCAPE '\\'`).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
}

export { OptionsRepository as O };
