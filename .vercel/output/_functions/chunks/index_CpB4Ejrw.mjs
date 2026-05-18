export { FTSManager } from './fts-manager_BjkO4e5p.mjs';
import { s as searchWithDb } from './query_noBLK03F.mjs';
export { g as getSearchStats, a as getSuggestions, b as search, c as searchCollection } from './query_noBLK03F.mjs';
import { toPlainText } from '@portabletext/toolkit';

function isPortableTextArray(value) {
  return value.every(
    (item) => typeof item === "object" && item !== null && "_type" in item && typeof item._type === "string"
  );
}
function extractCustomBlockText(block) {
  if (block._type === "code" && "code" in block && typeof block.code === "string") {
    return block.code;
  }
  if (block._type === "image") {
    const parts = [];
    if ("alt" in block && typeof block.alt === "string" && block.alt) {
      parts.push(block.alt);
    }
    if ("caption" in block && typeof block.caption === "string" && block.caption) {
      parts.push(block.caption);
    }
    return parts.join(" ");
  }
  return "";
}
function extractPlainText(blocks) {
  if (!blocks) {
    return "";
  }
  let parsedBlocks;
  if (typeof blocks === "string") {
    try {
      parsedBlocks = JSON.parse(blocks);
    } catch {
      return blocks;
    }
  } else {
    parsedBlocks = blocks;
  }
  if (!Array.isArray(parsedBlocks)) {
    return "";
  }
  const toolkitBlocks = parsedBlocks.map((b) => {
    const obj = { _type: b._type };
    for (const [key, val] of Object.entries(b)) {
      obj[key] = val;
    }
    return obj;
  });
  const standardText = toPlainText(toolkitBlocks);
  const customTexts = parsedBlocks.map(extractCustomBlockText).filter((text) => text.length > 0);
  const allTexts = [standardText, ...customTexts].filter((t) => t.length > 0);
  return allTexts.join("\n");
}
function extractSearchableFields(entry, fields) {
  const result = {};
  for (const field of fields) {
    const value = entry[field];
    if (value === null || value === void 0) {
      result[field] = "";
      continue;
    }
    if (typeof value === "string") {
      if (value.startsWith("[")) {
        result[field] = extractPlainText(value);
      } else {
        result[field] = value;
      }
    } else if (Array.isArray(value)) {
      if (isPortableTextArray(value)) {
        result[field] = extractPlainText(value);
      } else {
        result[field] = JSON.stringify(value);
      }
    } else if (typeof value === "object") {
      result[field] = JSON.stringify(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      result[field] = `${value}`;
    } else {
      result[field] = "";
    }
  }
  return result;
}

export { extractPlainText, extractSearchableFields, searchWithDb };
