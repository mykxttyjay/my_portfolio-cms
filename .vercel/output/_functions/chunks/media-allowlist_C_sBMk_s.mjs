function normalizeMime(mime) {
  return mime.split(";")[0].trim().toLowerCase();
}
function matchesMimeAllowlist(mime, allowList) {
  const normalized = normalizeMime(mime);
  for (const entry of allowList) {
    if (!entry || !entry.includes("/")) continue;
    const normalizedEntry = normalizeMime(entry);
    if (normalizedEntry.endsWith("/")) {
      if (normalized.startsWith(normalizedEntry)) return true;
    } else if (normalized === normalizedEntry) {
      return true;
    }
  }
  return false;
}
function parseAllowedMimeTypes(rawValidation) {
  if (!rawValidation) return null;
  try {
    const parsed = JSON.parse(rawValidation);
    if (typeof parsed !== "object" || parsed === null) return null;
    const list = parsed.allowedMimeTypes;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.filter((entry) => typeof entry === "string");
  } catch {
    return null;
  }
}

const GLOBAL_UPLOAD_ALLOWLIST = [
  "image/",
  "video/",
  "audio/",
  "application/pdf"
];
async function resolveFieldAllowlist(db, fieldId) {
  const row = await db.selectFrom("_emdash_fields").select(["type", "validation"]).where("id", "=", fieldId).where("type", "in", ["file", "image"]).executeTakeFirst();
  return row ? parseAllowedMimeTypes(row.validation) : null;
}

export { GLOBAL_UPLOAD_ALLOWLIST as G, matchesMimeAllowlist as m, normalizeMime as n, resolveFieldAllowlist as r };
