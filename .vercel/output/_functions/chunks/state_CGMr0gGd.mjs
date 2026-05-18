function toPluginStatus(value) {
  if (value === "active") return "active";
  return "inactive";
}
function toPluginSource(value) {
  if (value === "marketplace") return "marketplace";
  return "config";
}
class PluginStateRepository {
  constructor(db) {
    this.db = db;
  }
  /**
   * Get state for a specific plugin
   */
  async get(pluginId) {
    const row = await this.db.selectFrom("_plugin_state").selectAll().where("plugin_id", "=", pluginId).executeTakeFirst();
    if (!row) return null;
    return {
      pluginId: row.plugin_id,
      status: toPluginStatus(row.status),
      version: row.version,
      installedAt: new Date(row.installed_at),
      activatedAt: row.activated_at ? new Date(row.activated_at) : null,
      deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
      source: toPluginSource(row.source),
      marketplaceVersion: row.marketplace_version ?? null,
      displayName: row.display_name ?? null,
      description: row.description ?? null
    };
  }
  /**
   * Get all plugin states
   */
  async getAll() {
    const rows = await this.db.selectFrom("_plugin_state").selectAll().execute();
    return rows.map((row) => ({
      pluginId: row.plugin_id,
      status: toPluginStatus(row.status),
      version: row.version,
      installedAt: new Date(row.installed_at),
      activatedAt: row.activated_at ? new Date(row.activated_at) : null,
      deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
      source: toPluginSource(row.source),
      marketplaceVersion: row.marketplace_version ?? null,
      displayName: row.display_name ?? null,
      description: row.description ?? null
    }));
  }
  /**
   * Get all marketplace-installed plugin states
   */
  async getMarketplacePlugins() {
    const rows = await this.db.selectFrom("_plugin_state").selectAll().where("source", "=", "marketplace").execute();
    return rows.map((row) => ({
      pluginId: row.plugin_id,
      status: toPluginStatus(row.status),
      version: row.version,
      installedAt: new Date(row.installed_at),
      activatedAt: row.activated_at ? new Date(row.activated_at) : null,
      deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
      source: toPluginSource(row.source),
      marketplaceVersion: row.marketplace_version ?? null,
      displayName: row.display_name ?? null,
      description: row.description ?? null
    }));
  }
  /**
   * Create or update plugin state
   */
  async upsert(pluginId, version, status, opts) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await this.get(pluginId);
    if (existing) {
      const updates = {
        status,
        version
      };
      if (status === "active" && existing.status !== "active") {
        updates.activated_at = now;
      } else if (status === "inactive" && existing.status !== "inactive") {
        updates.deactivated_at = now;
      }
      if (opts?.source) updates.source = opts.source;
      if (opts?.marketplaceVersion !== void 0) {
        updates.marketplace_version = opts.marketplaceVersion;
      }
      if (opts?.displayName !== void 0) {
        updates.display_name = opts.displayName;
      }
      if (opts?.description !== void 0) {
        updates.description = opts.description;
      }
      await this.db.updateTable("_plugin_state").set(updates).where("plugin_id", "=", pluginId).execute();
    } else {
      await this.db.insertInto("_plugin_state").values({
        plugin_id: pluginId,
        status,
        version,
        installed_at: now,
        activated_at: status === "active" ? now : null,
        deactivated_at: null,
        data: null,
        source: opts?.source ?? "config",
        marketplace_version: opts?.marketplaceVersion ?? null,
        display_name: opts?.displayName ?? null,
        description: opts?.description ?? null
      }).execute();
    }
    return await this.get(pluginId);
  }
  /**
   * Enable a plugin
   */
  async enable(pluginId, version) {
    return this.upsert(pluginId, version, "active");
  }
  /**
   * Disable a plugin
   */
  async disable(pluginId, version) {
    return this.upsert(pluginId, version, "inactive");
  }
  /**
   * Delete plugin state
   */
  async delete(pluginId) {
    const result = await this.db.deleteFrom("_plugin_state").where("plugin_id", "=", pluginId).executeTakeFirst();
    return (result.numDeletedRows ?? 0) > 0;
  }
}

export { PluginStateRepository as P };
