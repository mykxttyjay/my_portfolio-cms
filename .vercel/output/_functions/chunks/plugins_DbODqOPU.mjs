import { P as PluginStateRepository } from './state_CGMr0gGd.mjs';

function marketplaceIconUrl(marketplaceUrl, pluginId) {
  return `${marketplaceUrl}/api/v1/plugins/${encodeURIComponent(pluginId)}/icon`;
}
function buildPluginInfo(plugin, state, marketplaceUrl) {
  const status = state?.status ?? "active";
  const enabled = status === "active";
  const isMarketplace = (state?.source ?? "config") === "marketplace";
  return {
    id: plugin.id,
    name: state?.displayName || plugin.id,
    version: plugin.version,
    package: void 0,
    // v2 doesn't have package field
    enabled,
    status,
    source: state?.source ?? "config",
    marketplaceVersion: state?.marketplaceVersion ?? void 0,
    capabilities: plugin.capabilities,
    hasAdminPages: (plugin.admin.pages?.length ?? 0) > 0,
    hasDashboardWidgets: (plugin.admin.widgets?.length ?? 0) > 0,
    hasHooks: Object.keys(plugin.hooks ?? {}).length > 0,
    installedAt: state?.installedAt?.toISOString(),
    activatedAt: state?.activatedAt?.toISOString() ?? void 0,
    deactivatedAt: state?.deactivatedAt?.toISOString() ?? void 0,
    description: state?.description ?? void 0,
    iconUrl: isMarketplace && marketplaceUrl ? marketplaceIconUrl(marketplaceUrl, plugin.id) : void 0
  };
}
async function handlePluginList(db, configuredPlugins, marketplaceUrl) {
  try {
    const stateRepo = new PluginStateRepository(db);
    const allStates = await stateRepo.getAll();
    const stateMap = new Map(allStates.map((s) => [s.pluginId, s]));
    const configuredIds = new Set(configuredPlugins.map((p) => p.id));
    const items = configuredPlugins.map((plugin) => {
      const state = stateMap.get(plugin.id) ?? null;
      return buildPluginInfo(plugin, state, marketplaceUrl);
    });
    for (const state of allStates) {
      if (state.source !== "marketplace") continue;
      if (configuredIds.has(state.pluginId)) continue;
      items.push({
        id: state.pluginId,
        name: state.displayName || state.pluginId,
        version: state.marketplaceVersion ?? state.version,
        enabled: state.status === "active",
        status: state.status,
        source: "marketplace",
        marketplaceVersion: state.marketplaceVersion ?? void 0,
        capabilities: [],
        hasAdminPages: false,
        hasDashboardWidgets: false,
        hasHooks: false,
        installedAt: state.installedAt?.toISOString(),
        activatedAt: state.activatedAt?.toISOString() ?? void 0,
        deactivatedAt: state.deactivatedAt?.toISOString() ?? void 0,
        description: state.description ?? void 0,
        iconUrl: marketplaceUrl ? marketplaceIconUrl(marketplaceUrl, state.pluginId) : void 0
      });
    }
    return {
      success: true,
      data: { items }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "PLUGIN_LIST_ERROR",
        message: "Failed to list plugins"
      }
    };
  }
}
async function handlePluginGet(db, configuredPlugins, pluginId, marketplaceUrl) {
  try {
    const plugin = configuredPlugins.find((p) => p.id === pluginId);
    if (!plugin) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Plugin not found: ${pluginId}`
        }
      };
    }
    const stateRepo = new PluginStateRepository(db);
    const state = await stateRepo.get(pluginId);
    return {
      success: true,
      data: { item: buildPluginInfo(plugin, state, marketplaceUrl) }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "PLUGIN_GET_ERROR",
        message: "Failed to get plugin"
      }
    };
  }
}
async function handlePluginEnable(db, configuredPlugins, pluginId) {
  try {
    const plugin = configuredPlugins.find((p) => p.id === pluginId);
    if (!plugin) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Plugin not found: ${pluginId}`
        }
      };
    }
    const stateRepo = new PluginStateRepository(db);
    const state = await stateRepo.enable(pluginId, plugin.version);
    return {
      success: true,
      data: { item: buildPluginInfo(plugin, state) }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "PLUGIN_ENABLE_ERROR",
        message: "Failed to enable plugin"
      }
    };
  }
}
async function handlePluginDisable(db, configuredPlugins, pluginId) {
  try {
    const plugin = configuredPlugins.find((p) => p.id === pluginId);
    if (!plugin) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Plugin not found: ${pluginId}`
        }
      };
    }
    const stateRepo = new PluginStateRepository(db);
    const state = await stateRepo.disable(pluginId, plugin.version);
    return {
      success: true,
      data: { item: buildPluginInfo(plugin, state) }
    };
  } catch {
    return {
      success: false,
      error: {
        code: "PLUGIN_DISABLE_ERROR",
        message: "Failed to disable plugin"
      }
    };
  }
}

export { handlePluginEnable as a, handlePluginGet as b, handlePluginList as c, handlePluginDisable as h };
