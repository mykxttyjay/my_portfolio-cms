import { a as validatePluginIdentifier } from './validate_AseaonR5.mjs';
import { p as pluginManifestSchema, n as normalizeManifestRoute } from './manifest-schema_B5IPbR6v.mjs';
import { createGzipDecoder, unpackTar } from 'modern-tar';
import { P as PluginStateRepository } from './state_CGMr0gGd.mjs';
import { normalizeCapabilities } from '@emdash-cms/plugin-types';

const TRAILING_SLASHES = /\/+$/;
const LEADING_DOT_SLASH = /^\.\//;
class MarketplaceError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "MarketplaceError";
  }
}
class MarketplaceUnavailableError extends MarketplaceError {
  constructor(cause) {
    super("Plugin marketplace is unavailable", void 0, "MARKETPLACE_UNAVAILABLE");
    if (cause) this.cause = cause;
  }
}
class MarketplaceClientImpl {
  constructor(baseUrl, siteOrigin) {
    this.baseUrl = baseUrl.replace(TRAILING_SLASHES, "");
    this.siteOrigin = siteOrigin;
  }
  async search(query, opts) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (opts?.category) params.set("category", opts.category);
    if (opts?.capability) params.set("capability", opts.capability);
    if (opts?.sort) params.set("sort", opts.sort);
    if (opts?.cursor) params.set("cursor", opts.cursor);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    const url = `${this.baseUrl}/api/v1/plugins${qs ? `?${qs}` : ""}`;
    const data = await this.fetchJson(url);
    return data;
  }
  async getPlugin(id) {
    const url = `${this.baseUrl}/api/v1/plugins/${encodeURIComponent(id)}`;
    return this.fetchJson(url);
  }
  async getVersions(id) {
    const url = `${this.baseUrl}/api/v1/plugins/${encodeURIComponent(id)}/versions`;
    const data = await this.fetchJson(url);
    return data.items;
  }
  async downloadBundle(id, version) {
    const bundleUrl = `${this.baseUrl}/api/v1/plugins/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/bundle`;
    const marketplaceOrigin = new URL(this.baseUrl).origin;
    const MAX_REDIRECTS = 5;
    let response;
    try {
      let currentUrl = bundleUrl;
      response = await fetch(currentUrl, { redirect: "manual" });
      for (let i = 0; i < MAX_REDIRECTS; i++) {
        if (response.status < 300 || response.status >= 400) break;
        const location = response.headers.get("location");
        if (!location) break;
        const target = new URL(location, currentUrl);
        if (target.origin !== marketplaceOrigin) {
          throw new MarketplaceError(
            `Bundle download redirected to untrusted host: ${target.origin}`,
            response.status,
            "BUNDLE_REDIRECT_UNTRUSTED"
          );
        }
        currentUrl = target.href;
        response = await fetch(currentUrl, { redirect: "manual" });
      }
      if (response.status >= 300 && response.status < 400) {
        throw new MarketplaceError(
          `Bundle download exceeded maximum redirects (${MAX_REDIRECTS})`,
          response.status,
          "BUNDLE_TOO_MANY_REDIRECTS"
        );
      }
    } catch (err) {
      if (err instanceof MarketplaceError) throw err;
      throw new MarketplaceUnavailableError(err);
    }
    if (!response.ok) {
      throw new MarketplaceError(
        `Failed to download bundle: ${response.status} ${response.statusText}`,
        response.status,
        "BUNDLE_DOWNLOAD_FAILED"
      );
    }
    const tarballBytes = new Uint8Array(await response.arrayBuffer());
    try {
      return await extractBundle(tarballBytes);
    } catch (err) {
      if (err instanceof MarketplaceError) throw err;
      throw new MarketplaceError(
        "Failed to extract plugin bundle",
        void 0,
        "BUNDLE_EXTRACT_FAILED"
      );
    }
  }
  async reportInstall(id, version) {
    const siteHash = await generateSiteHash(this.siteOrigin);
    const url = `${this.baseUrl}/api/v1/plugins/${encodeURIComponent(id)}/installs`;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteHash, version })
      });
    } catch {
    }
  }
  async searchThemes(query, opts) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (opts?.keyword) params.set("keyword", opts.keyword);
    if (opts?.sort) params.set("sort", opts.sort);
    if (opts?.cursor) params.set("cursor", opts.cursor);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    const url = `${this.baseUrl}/api/v1/themes${qs ? `?${qs}` : ""}`;
    return this.fetchJson(url);
  }
  async getTheme(id) {
    const url = `${this.baseUrl}/api/v1/themes/${encodeURIComponent(id)}`;
    return this.fetchJson(url);
  }
  async fetchJson(url) {
    let response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" }
      });
    } catch (err) {
      throw new MarketplaceUnavailableError(err);
    }
    if (!response.ok) {
      let errorMessage = `Marketplace request failed: ${response.status}`;
      try {
        const body = await response.json();
        if (body.error) errorMessage = body.error;
      } catch {
      }
      throw new MarketplaceError(errorMessage, response.status);
    }
    const data = await response.json();
    return data;
  }
}
async function extractBundle(tarballBytes) {
  const decompressedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(tarballBytes);
      controller.close();
    }
  }).pipeThrough(createGzipDecoder());
  const decompressedBuf = await new Response(decompressedStream).arrayBuffer();
  const decompressedBytes = new Uint8Array(decompressedBuf);
  const decompressed = new ReadableStream({
    start(controller) {
      controller.enqueue(decompressedBytes);
      controller.close();
    }
  });
  const entries = await unpackTar(decompressed);
  const decoder = new TextDecoder();
  const files = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (entry.data && entry.header.type === "file") {
      const name = entry.header.name.replace(LEADING_DOT_SLASH, "");
      files.set(name, decoder.decode(entry.data));
    }
  }
  const manifestJson = files.get("manifest.json");
  const backendCode = files.get("backend.js");
  if (!manifestJson) {
    throw new MarketplaceError(
      "Invalid bundle: missing manifest.json",
      void 0,
      "INVALID_BUNDLE"
    );
  }
  if (!backendCode) {
    throw new MarketplaceError("Invalid bundle: missing backend.js", void 0, "INVALID_BUNDLE");
  }
  let manifest;
  try {
    const parsed = JSON.parse(manifestJson);
    const result = pluginManifestSchema.safeParse(parsed);
    if (!result.success) {
      throw new MarketplaceError(
        "Invalid bundle: manifest.json failed validation",
        void 0,
        "INVALID_BUNDLE"
      );
    }
    manifest = result.data;
  } catch (err) {
    if (err instanceof MarketplaceError) throw err;
    throw new MarketplaceError(
      "Invalid bundle: malformed manifest.json",
      void 0,
      "INVALID_BUNDLE"
    );
  }
  const hashBuffer = await crypto.subtle.digest("SHA-256", tarballBytes);
  const hashArray = new Uint8Array(hashBuffer);
  const checksum = Array.from(hashArray, (b) => b.toString(16).padStart(2, "0")).join("");
  return {
    manifest,
    backendCode,
    adminCode: files.get("admin.js"),
    checksum
  };
}
async function generateSiteHash(siteOrigin) {
  const seed = siteOrigin ? `emdash-site:${siteOrigin}` : `emdash-anonymous`;
  try {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
    const arr = new Uint8Array(hash);
    return Array.from(arr.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const h2 = h ^ h >>> 16;
    return (h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
  }
}
function createMarketplaceClient(baseUrl, siteOrigin) {
  return new MarketplaceClientImpl(baseUrl, siteOrigin);
}

class EmDashStorageError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
    this.name = "EmDashStorageError";
  }
}

const VERSION_PATTERN = /^[a-z0-9][a-z0-9._+-]*$/i;
function validateVersion(version) {
  if (version.includes("..")) throw new Error("Invalid version format");
  if (!VERSION_PATTERN.test(version)) {
    throw new Error("Invalid version format");
  }
}
function getClient(marketplaceUrl, siteOrigin) {
  if (!marketplaceUrl) return null;
  return createMarketplaceClient(marketplaceUrl, siteOrigin);
}
function diffCapabilities(oldCaps, newCaps) {
  const oldNorm = normalizeCapabilities(oldCaps);
  const newNorm = normalizeCapabilities(newCaps);
  const oldSet = new Set(oldNorm);
  const newSet = new Set(newNorm);
  return {
    added: newNorm.filter((c) => !oldSet.has(c)),
    removed: oldNorm.filter((c) => !newSet.has(c))
  };
}
function diffRouteVisibility(oldManifest, newManifest) {
  const oldPublicRoutes = /* @__PURE__ */ new Set();
  if (oldManifest) {
    for (const entry of oldManifest.routes) {
      const normalized = normalizeManifestRoute(entry);
      if (normalized.public === true) {
        oldPublicRoutes.add(normalized.name);
      }
    }
  }
  const newlyPublic = [];
  for (const entry of newManifest.routes) {
    const normalized = normalizeManifestRoute(entry);
    if (normalized.public === true && !oldPublicRoutes.has(normalized.name)) {
      newlyPublic.push(normalized.name);
    }
  }
  return { newlyPublic };
}
async function resolveVersionMetadata(client, pluginId, pluginDetail, version) {
  if (pluginDetail.latestVersion?.version === version) {
    return {
      version: pluginDetail.latestVersion.version,
      minEmDashVersion: pluginDetail.latestVersion.minEmDashVersion,
      bundleSize: pluginDetail.latestVersion.bundleSize,
      checksum: pluginDetail.latestVersion.checksum,
      changelog: pluginDetail.latestVersion.changelog,
      capabilities: pluginDetail.latestVersion.capabilities,
      status: pluginDetail.latestVersion.status,
      auditVerdict: pluginDetail.latestVersion.audit?.verdict ?? null,
      imageAuditVerdict: pluginDetail.latestVersion.imageAudit?.verdict ?? null,
      publishedAt: pluginDetail.latestVersion.publishedAt
    };
  }
  const versions = await client.getVersions(pluginId);
  return versions.find((v) => v.version === version) ?? null;
}
function validateBundleIdentity(bundle, pluginId, version) {
  if (bundle.manifest.id !== pluginId) {
    return {
      success: false,
      error: {
        code: "MANIFEST_MISMATCH",
        message: `Bundle manifest ID (${bundle.manifest.id}) does not match requested plugin (${pluginId})`
      }
    };
  }
  if (bundle.manifest.version !== version) {
    return {
      success: false,
      error: {
        code: "MANIFEST_VERSION_MISMATCH",
        message: `Bundle manifest version (${bundle.manifest.version}) does not match requested version (${version})`
      }
    };
  }
  return null;
}
async function storeBundleInR2(storage, pluginId, version, bundle) {
  validatePluginIdentifier(pluginId, "plugin ID");
  validateVersion(version);
  const prefix = `marketplace/${pluginId}/${version}`;
  await storage.upload({
    key: `${prefix}/manifest.json`,
    body: new TextEncoder().encode(JSON.stringify(bundle.manifest)),
    contentType: "application/json"
  });
  await storage.upload({
    key: `${prefix}/backend.js`,
    body: new TextEncoder().encode(bundle.backendCode),
    contentType: "application/javascript"
  });
  if (bundle.adminCode) {
    await storage.upload({
      key: `${prefix}/admin.js`,
      body: new TextEncoder().encode(bundle.adminCode),
      contentType: "application/javascript"
    });
  }
}
async function streamToText(stream) {
  return new Response(stream).text();
}
async function loadBundleFromR2(storage, pluginId, version) {
  validatePluginIdentifier(pluginId, "plugin ID");
  validateVersion(version);
  const prefix = `marketplace/${pluginId}/${version}`;
  try {
    const manifestResult = await storage.download(`${prefix}/manifest.json`);
    const backendResult = await storage.download(`${prefix}/backend.js`);
    const manifestText = await streamToText(manifestResult.body);
    const backendCode = await streamToText(backendResult.body);
    const parsed = JSON.parse(manifestText);
    const result = pluginManifestSchema.safeParse(parsed);
    if (!result.success) return null;
    const manifest = result.data;
    let adminCode;
    try {
      const adminResult = await storage.download(`${prefix}/admin.js`);
      adminCode = await streamToText(adminResult.body);
    } catch {
    }
    return { manifest, backendCode, adminCode };
  } catch {
    return null;
  }
}
async function deleteBundleFromR2(storage, pluginId, version) {
  validatePluginIdentifier(pluginId, "plugin ID");
  validateVersion(version);
  const prefix = `marketplace/${pluginId}/${version}`;
  const files = ["manifest.json", "backend.js", "admin.js"];
  for (const file of files) {
    try {
      await storage.delete(`${prefix}/${file}`);
    } catch {
    }
  }
}
async function handleMarketplaceInstall(db, storage, sandboxRunner, marketplaceUrl, pluginId, opts) {
  const client = getClient(marketplaceUrl, opts?.siteOrigin);
  if (!client) {
    return {
      success: false,
      error: {
        code: "MARKETPLACE_NOT_CONFIGURED",
        message: "Marketplace is not configured"
      }
    };
  }
  if (!storage) {
    return {
      success: false,
      error: {
        code: "STORAGE_NOT_CONFIGURED",
        message: "Storage is required for marketplace plugin installation"
      }
    };
  }
  if (!sandboxRunner || !sandboxRunner.isAvailable()) {
    return {
      success: false,
      error: {
        code: "SANDBOX_NOT_AVAILABLE",
        message: "Sandbox runner is required for marketplace plugins"
      }
    };
  }
  try {
    const stateRepo = new PluginStateRepository(db);
    const existing = await stateRepo.get(pluginId);
    if (existing && existing.source === "marketplace") {
      return {
        success: false,
        error: {
          code: "ALREADY_INSTALLED",
          message: `Plugin ${pluginId} is already installed`
        }
      };
    }
    if (opts?.configuredPluginIds?.has(pluginId)) {
      return {
        success: false,
        error: {
          code: "PLUGIN_ID_CONFLICT",
          message: `Cannot install marketplace plugin "${pluginId}" — a configured plugin with the same ID already exists`
        }
      };
    }
    const pluginDetail = await client.getPlugin(pluginId);
    const version = opts?.version ?? pluginDetail.latestVersion?.version;
    if (!version) {
      return {
        success: false,
        error: {
          code: "NO_VERSION",
          message: `No published versions found for plugin ${pluginId}`
        }
      };
    }
    const versionMetadata = await resolveVersionMetadata(client, pluginId, pluginDetail, version);
    if (!versionMetadata) {
      return {
        success: false,
        error: {
          code: "NO_VERSION",
          message: `Version ${version} was not found for plugin ${pluginId}`
        }
      };
    }
    if (versionMetadata.auditVerdict === "fail" || versionMetadata.auditVerdict === "warn") {
      return {
        success: false,
        error: {
          code: "AUDIT_FAILED",
          message: versionMetadata.auditVerdict === "fail" ? "Plugin failed security audit and cannot be installed" : "Plugin audit was inconclusive and cannot be installed until reviewed"
        }
      };
    }
    const bundle = await client.downloadBundle(pluginId, version);
    if (versionMetadata.checksum && bundle.checksum !== versionMetadata.checksum) {
      return {
        success: false,
        error: {
          code: "CHECKSUM_MISMATCH",
          message: "Bundle checksum does not match marketplace record. Download may be corrupted."
        }
      };
    }
    const bundleIdentityError = validateBundleIdentity(bundle, pluginId, version);
    if (bundleIdentityError) return bundleIdentityError;
    await storeBundleInR2(storage, pluginId, version, bundle);
    await stateRepo.upsert(pluginId, version, "active", {
      source: "marketplace",
      marketplaceVersion: version,
      displayName: pluginDetail.name,
      description: pluginDetail.description ?? void 0
    });
    client.reportInstall(pluginId, version).catch(() => {
    });
    return {
      success: true,
      data: {
        pluginId,
        version,
        capabilities: bundle.manifest.capabilities
      }
    };
  } catch (err) {
    if (err instanceof MarketplaceUnavailableError) {
      return {
        success: false,
        error: {
          code: "MARKETPLACE_UNAVAILABLE",
          message: "Plugin marketplace is currently unavailable"
        }
      };
    }
    if (err instanceof MarketplaceError) {
      return {
        success: false,
        error: {
          code: err.code ?? "MARKETPLACE_ERROR",
          message: err.message
        }
      };
    }
    if (err instanceof EmDashStorageError) {
      return {
        success: false,
        error: {
          code: err.code ?? "STORAGE_ERROR",
          message: "Storage error while installing plugin"
        }
      };
    }
    if (err && typeof err === "object" && "code" in err) {
      const code = err.code;
      if (typeof code === "string" && code.trim()) {
        return {
          success: false,
          error: {
            code,
            message: "Failed to install plugin from marketplace"
          }
        };
      }
    }
    console.error("Failed to install marketplace plugin:", err);
    return {
      success: false,
      error: {
        code: "INSTALL_FAILED",
        message: "Failed to install plugin from marketplace"
      }
    };
  }
}
async function handleMarketplaceUpdate(db, storage, sandboxRunner, marketplaceUrl, pluginId, opts) {
  const client = getClient(marketplaceUrl);
  if (!client) {
    return {
      success: false,
      error: { code: "MARKETPLACE_NOT_CONFIGURED", message: "Marketplace is not configured" }
    };
  }
  if (!storage) {
    return {
      success: false,
      error: { code: "STORAGE_NOT_CONFIGURED", message: "Storage is required" }
    };
  }
  if (!sandboxRunner || !sandboxRunner.isAvailable()) {
    return {
      success: false,
      error: { code: "SANDBOX_NOT_AVAILABLE", message: "Sandbox runner is required" }
    };
  }
  try {
    const stateRepo = new PluginStateRepository(db);
    const existing = await stateRepo.get(pluginId);
    if (!existing || existing.source !== "marketplace") {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `No marketplace plugin found: ${pluginId}`
        }
      };
    }
    const oldVersion = existing.marketplaceVersion ?? existing.version;
    const pluginDetail = await client.getPlugin(pluginId);
    const newVersion = opts?.version ?? pluginDetail.latestVersion?.version;
    if (!newVersion) {
      return {
        success: false,
        error: { code: "NO_VERSION", message: "No newer version available" }
      };
    }
    if (newVersion === oldVersion) {
      return {
        success: false,
        error: { code: "ALREADY_UP_TO_DATE", message: "Plugin is already up to date" }
      };
    }
    const versionMetadata = await resolveVersionMetadata(
      client,
      pluginId,
      pluginDetail,
      newVersion
    );
    if (!versionMetadata) {
      return {
        success: false,
        error: {
          code: "NO_VERSION",
          message: `Version ${newVersion} was not found for plugin ${pluginId}`
        }
      };
    }
    const bundle = await client.downloadBundle(pluginId, newVersion);
    if (versionMetadata.checksum && bundle.checksum !== versionMetadata.checksum) {
      return {
        success: false,
        error: {
          code: "CHECKSUM_MISMATCH",
          message: "Bundle checksum does not match marketplace record. Download may be corrupted."
        }
      };
    }
    const bundleIdentityError = validateBundleIdentity(bundle, pluginId, newVersion);
    if (bundleIdentityError) return bundleIdentityError;
    const oldBundle = await loadBundleFromR2(storage, pluginId, oldVersion);
    const oldCaps = oldBundle?.manifest.capabilities ?? [];
    const capabilityChanges = diffCapabilities(oldCaps, bundle.manifest.capabilities);
    const hasEscalation = capabilityChanges.added.length > 0;
    if (hasEscalation && !opts?.confirmCapabilityChanges) {
      return {
        success: false,
        error: {
          code: "CAPABILITY_ESCALATION",
          message: "Plugin update requires new capabilities",
          details: { capabilityChanges }
        }
      };
    }
    const routeVisibilityChanges = diffRouteVisibility(oldBundle?.manifest, bundle.manifest);
    const hasNewPublicRoutes = routeVisibilityChanges.newlyPublic.length > 0;
    if (hasNewPublicRoutes && !opts?.confirmRouteVisibilityChanges) {
      return {
        success: false,
        error: {
          code: "ROUTE_VISIBILITY_ESCALATION",
          message: "Plugin update exposes new public (unauthenticated) routes",
          details: { routeVisibilityChanges, capabilityChanges }
        }
      };
    }
    await storeBundleInR2(storage, pluginId, newVersion, bundle);
    await stateRepo.upsert(pluginId, newVersion, "active", {
      source: "marketplace",
      marketplaceVersion: newVersion,
      displayName: pluginDetail.name,
      description: pluginDetail.description ?? void 0
    });
    deleteBundleFromR2(storage, pluginId, oldVersion).catch(() => {
    });
    return {
      success: true,
      data: {
        pluginId,
        oldVersion,
        newVersion,
        capabilityChanges,
        routeVisibilityChanges: hasNewPublicRoutes ? routeVisibilityChanges : void 0
      }
    };
  } catch (err) {
    if (err instanceof MarketplaceUnavailableError) {
      return {
        success: false,
        error: { code: "MARKETPLACE_UNAVAILABLE", message: "Marketplace is unavailable" }
      };
    }
    if (err instanceof MarketplaceError) {
      return {
        success: false,
        error: { code: err.code ?? "MARKETPLACE_ERROR", message: err.message }
      };
    }
    console.error("Failed to update marketplace plugin:", err);
    return {
      success: false,
      error: { code: "UPDATE_FAILED", message: "Failed to update plugin" }
    };
  }
}
async function handleMarketplaceUninstall(db, storage, pluginId, opts) {
  try {
    const stateRepo = new PluginStateRepository(db);
    const existing = await stateRepo.get(pluginId);
    if (!existing || existing.source !== "marketplace") {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `No marketplace plugin found: ${pluginId}`
        }
      };
    }
    const version = existing.marketplaceVersion ?? existing.version;
    if (storage) {
      await deleteBundleFromR2(storage, pluginId, version);
    }
    let dataDeleted = false;
    if (opts?.deleteData) {
      try {
        await db.deleteFrom("_plugin_storage").where("plugin_id", "=", pluginId).execute();
        dataDeleted = true;
      } catch {
      }
    }
    await stateRepo.delete(pluginId);
    return {
      success: true,
      data: { pluginId, dataDeleted }
    };
  } catch (err) {
    console.error("Failed to uninstall marketplace plugin:", err);
    return {
      success: false,
      error: {
        code: "UNINSTALL_FAILED",
        message: "Failed to uninstall plugin"
      }
    };
  }
}
async function handleMarketplaceUpdateCheck(db, marketplaceUrl) {
  const client = getClient(marketplaceUrl);
  if (!client) {
    return {
      success: false,
      error: { code: "MARKETPLACE_NOT_CONFIGURED", message: "Marketplace is not configured" }
    };
  }
  try {
    const stateRepo = new PluginStateRepository(db);
    const marketplacePlugins = await stateRepo.getMarketplacePlugins();
    const items = [];
    for (const plugin of marketplacePlugins) {
      try {
        const detail = await client.getPlugin(plugin.pluginId);
        const latest = detail.latestVersion?.version;
        const installed = plugin.marketplaceVersion ?? plugin.version;
        if (!latest) continue;
        const hasUpdate = latest !== installed;
        let capabilityChanges;
        let hasCapabilityChanges = false;
        if (hasUpdate && detail.latestVersion) {
          const oldCaps = detail.capabilities ?? [];
          const newCaps = detail.latestVersion.capabilities ?? [];
          capabilityChanges = diffCapabilities(oldCaps, newCaps);
          hasCapabilityChanges = capabilityChanges.added.length > 0 || capabilityChanges.removed.length > 0;
        }
        items.push({
          pluginId: plugin.pluginId,
          installed,
          latest: latest ?? installed,
          hasUpdate,
          hasCapabilityChanges,
          capabilityChanges: hasCapabilityChanges ? capabilityChanges : void 0,
          // Route visibility changes require downloading both bundles to compare
          // manifests, which is too expensive for a preview check. The actual
          // enforcement happens at update time in handleMarketplaceUpdate.
          hasRouteVisibilityChanges: false
        });
      } catch (err) {
        console.warn(`Failed to check updates for ${plugin.pluginId}:`, err);
      }
    }
    return { success: true, data: { items } };
  } catch (err) {
    if (err instanceof MarketplaceUnavailableError) {
      return {
        success: false,
        error: { code: "MARKETPLACE_UNAVAILABLE", message: "Marketplace is unavailable" }
      };
    }
    console.error("Failed to check marketplace updates:", err);
    return {
      success: false,
      error: { code: "UPDATE_CHECK_FAILED", message: "Failed to check for updates" }
    };
  }
}
async function handleMarketplaceSearch(marketplaceUrl, query, opts) {
  const client = getClient(marketplaceUrl);
  if (!client) {
    return {
      success: false,
      error: { code: "MARKETPLACE_NOT_CONFIGURED", message: "Marketplace is not configured" }
    };
  }
  try {
    const result = await client.search(query, opts);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof MarketplaceUnavailableError) {
      return {
        success: false,
        error: { code: "MARKETPLACE_UNAVAILABLE", message: "Marketplace is unavailable" }
      };
    }
    console.error("Failed to search marketplace:", err);
    return {
      success: false,
      error: { code: "SEARCH_FAILED", message: "Failed to search marketplace" }
    };
  }
}
async function handleMarketplaceGetPlugin(marketplaceUrl, pluginId) {
  const client = getClient(marketplaceUrl);
  if (!client) {
    return {
      success: false,
      error: { code: "MARKETPLACE_NOT_CONFIGURED", message: "Marketplace is not configured" }
    };
  }
  try {
    const result = await client.getPlugin(pluginId);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof MarketplaceError && err.status === 404) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: `Plugin not found: ${pluginId}` }
      };
    }
    if (err instanceof MarketplaceUnavailableError) {
      return {
        success: false,
        error: { code: "MARKETPLACE_UNAVAILABLE", message: "Marketplace is unavailable" }
      };
    }
    console.error("Failed to get marketplace plugin:", err);
    return {
      success: false,
      error: { code: "GET_PLUGIN_FAILED", message: "Failed to get plugin details" }
    };
  }
}
async function handleThemeSearch(marketplaceUrl, query, opts) {
  const client = getClient(marketplaceUrl);
  if (!client) {
    return {
      success: false,
      error: { code: "MARKETPLACE_NOT_CONFIGURED", message: "Marketplace is not configured" }
    };
  }
  try {
    const result = await client.searchThemes(query, opts);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof MarketplaceUnavailableError) {
      return {
        success: false,
        error: { code: "MARKETPLACE_UNAVAILABLE", message: "Marketplace is unavailable" }
      };
    }
    console.error("Failed to search themes:", err);
    return {
      success: false,
      error: { code: "THEME_SEARCH_FAILED", message: "Failed to search themes" }
    };
  }
}
async function handleThemeGetDetail(marketplaceUrl, themeId) {
  const client = getClient(marketplaceUrl);
  if (!client) {
    return {
      success: false,
      error: { code: "MARKETPLACE_NOT_CONFIGURED", message: "Marketplace is not configured" }
    };
  }
  try {
    const result = await client.getTheme(themeId);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof MarketplaceError && err.status === 404) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: `Theme not found: ${themeId}` }
      };
    }
    if (err instanceof MarketplaceUnavailableError) {
      return {
        success: false,
        error: { code: "MARKETPLACE_UNAVAILABLE", message: "Marketplace is unavailable" }
      };
    }
    console.error("Failed to get marketplace theme:", err);
    return {
      success: false,
      error: { code: "GET_THEME_FAILED", message: "Failed to get theme details" }
    };
  }
}

export { handleMarketplaceGetPlugin as a, handleMarketplaceSearch as b, handleMarketplaceUpdateCheck as c, handleMarketplaceUninstall as d, handleMarketplaceUpdate as e, handleThemeGetDetail as f, handleThemeSearch as g, handleMarketplaceInstall as h };
