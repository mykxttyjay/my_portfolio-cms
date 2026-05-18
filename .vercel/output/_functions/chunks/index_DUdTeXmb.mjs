import { M as MediaRepository } from './media_CEdPKDLW.mjs';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';
import 'kysely';
import './request-context_Dj39IhTD.mjs';
import './request-cache_BRmSfhRF.mjs';

const SETTINGS_PREFIX = "site:";
const SITE_SETTINGS_CACHE_KEY = /* @__PURE__ */ Symbol.for("emdash:site-settings");
const g = globalThis;
const holder = (
  // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- globalThis singleton pattern (see request-context.ts)
  g[SITE_SETTINGS_CACHE_KEY] ?? (() => {
    const h = { version: 0, cached: null, cachedVersion: -1 };
    g[SITE_SETTINGS_CACHE_KEY] = h;
    return h;
  })()
);
function invalidateSiteSettingsCache() {
  holder.version++;
  holder.cached = null;
  holder.cachedVersion = -1;
}
async function resolveMediaReference(mediaRef, db, _storage) {
  if (!mediaRef?.mediaId) {
    return mediaRef;
  }
  try {
    const mediaRepo = new MediaRepository(db);
    const media = await mediaRepo.findById(mediaRef.mediaId);
    if (media) {
      return {
        ...mediaRef,
        url: `/_emdash/api/media/file/${media.storageKey}`,
        contentType: media.mimeType,
        ...media.width !== null ? { width: media.width } : {},
        ...media.height !== null ? { height: media.height } : {}
      };
    }
  } catch {
  }
  return mediaRef;
}
async function getSiteSettingsWithDb(db, storage = null) {
  const options = new OptionsRepository(db);
  const allOptions = await options.getByPrefix(SETTINGS_PREFIX);
  const settings = {};
  for (const [key, value] of allOptions) {
    const settingKey = key.replace(SETTINGS_PREFIX, "");
    settings[settingKey] = value;
  }
  const typedSettings = settings;
  if (typedSettings.logo) {
    typedSettings.logo = await resolveMediaReference(typedSettings.logo, db);
  }
  if (typedSettings.favicon) {
    typedSettings.favicon = await resolveMediaReference(typedSettings.favicon, db);
  }
  if (typedSettings.seo?.defaultOgImage) {
    typedSettings.seo = {
      ...typedSettings.seo,
      defaultOgImage: await resolveMediaReference(typedSettings.seo.defaultOgImage, db)
    };
  }
  return typedSettings;
}
async function setSiteSettings(settings, db) {
  const options = new OptionsRepository(db);
  const updates = {};
  for (const [key, value] of Object.entries(settings)) {
    if (value !== void 0) {
      updates[`${SETTINGS_PREFIX}${key}`] = value;
    }
  }
  try {
    await options.setMany(updates);
  } finally {
    invalidateSiteSettingsCache();
  }
}

export { getSiteSettingsWithDb as g, setSiteSettings as s };
