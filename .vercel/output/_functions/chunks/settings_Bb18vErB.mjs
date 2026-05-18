import { g as getSiteSettingsWithDb, s as setSiteSettings } from './index_DUdTeXmb.mjs';

async function handleSettingsGet(db, storage) {
  try {
    const settings = await getSiteSettingsWithDb(db, storage);
    return { success: true, data: settings };
  } catch {
    return {
      success: false,
      error: { code: "SETTINGS_READ_ERROR", message: "Failed to get settings" }
    };
  }
}
async function handleSettingsUpdate(db, storage, input) {
  try {
    await setSiteSettings(input, db);
    const updatedSettings = await getSiteSettingsWithDb(db, storage);
    return { success: true, data: updatedSettings };
  } catch {
    return {
      success: false,
      error: { code: "SETTINGS_UPDATE_ERROR", message: "Failed to update settings" }
    };
  }
}

export { handleSettingsGet, handleSettingsUpdate };
