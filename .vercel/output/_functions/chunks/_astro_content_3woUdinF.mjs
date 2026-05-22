import 'html-escaper';
import 'neotraverse/modern';
import * as z from 'zod/v4';
export { z };
import './entrypoint_BN1Kgsk1.mjs';
import 'piccolore';
import 'clsx';

function formatZodError(error) {
  return error.issues.map((issue) => `  **${issue.path.join(".")}**: ${issue.message}`);
}
class LiveCollectionError extends Error {
  collection;
  message;
  cause;
  constructor(collection, message, cause) {
    super(message);
    this.collection = collection;
    this.message = message;
    this.cause = cause;
    this.name = "LiveCollectionError";
    if (cause?.stack) {
      this.stack = cause.stack;
    }
  }
  static is(error) {
    return error instanceof LiveCollectionError;
  }
}
class LiveEntryNotFoundError extends LiveCollectionError {
  constructor(collection, entryFilter) {
    super(
      collection,
      `Entry ${collection} \u2192 ${typeof entryFilter === "string" ? entryFilter : JSON.stringify(entryFilter)} was not found.`
    );
    this.name = "LiveEntryNotFoundError";
  }
  static is(error) {
    return error?.name === "LiveEntryNotFoundError";
  }
}
class LiveCollectionValidationError extends LiveCollectionError {
  constructor(collection, entryId, error) {
    super(
      collection,
      [
        `**${collection} \u2192 ${entryId}** data does not match the collection schema.
`,
        ...formatZodError(error),
        ""
      ].join("\n")
    );
    this.name = "LiveCollectionValidationError";
  }
  static is(error) {
    return error?.name === "LiveCollectionValidationError";
  }
}
class LiveCollectionCacheHintError extends LiveCollectionError {
  constructor(collection, entryId, error) {
    super(
      collection,
      [
        `**${String(collection)}${entryId ? ` \u2192 ${String(entryId)}` : ""}** returned an invalid cache hint.
`,
        ...formatZodError(error),
        ""
      ].join("\n")
    );
    this.name = "LiveCollectionCacheHintError";
  }
  static is(error) {
    return error?.name === "LiveCollectionCacheHintError";
  }
}

const cacheHintSchema = z.object({
  tags: z.array(z.string()).optional(),
  lastModified: z.date().optional()
});
async function parseLiveEntry(entry, schema, collection) {
  try {
    const parsed = await z.safeParseAsync(schema, entry.data);
    if (!parsed.success) {
      return {
        error: new LiveCollectionValidationError(collection, entry.id, parsed.error)
      };
    }
    if (entry.cacheHint) {
      const cacheHint = cacheHintSchema.safeParse(entry.cacheHint);
      if (!cacheHint.success) {
        return {
          error: new LiveCollectionCacheHintError(collection, entry.id, cacheHint.error)
        };
      }
      entry.cacheHint = cacheHint.data;
    }
    return {
      entry: {
        ...entry,
        data: parsed.data
      }
    };
  } catch (error) {
    return {
      error: new LiveCollectionError(
        collection,
        `Unexpected error parsing entry ${entry.id} in collection ${collection}`,
        error
      )
    };
  }
}
function createGetLiveCollection({
  liveCollections
}) {
  return async function getLiveCollection(collection, filter) {
    if (!(collection in liveCollections)) {
      return {
        error: new LiveCollectionError(
          collection,
          `Collection "${collection}" is not a live collection. Use getCollection() instead of getLiveCollection() to load regular content collections.`
        )
      };
    }
    try {
      const context = {
        filter,
        collection
      };
      const response = await liveCollections[collection].loader?.loadCollection?.(context);
      if (response && "error" in response) {
        return { error: response.error };
      }
      const { schema } = liveCollections[collection];
      let processedEntries = response.entries;
      if (schema) {
        const entryResults = await Promise.all(
          response.entries.map((entry) => parseLiveEntry(entry, schema, collection))
        );
        for (const result of entryResults) {
          if (result.error) {
            return { error: result.error };
          }
        }
        processedEntries = entryResults.map((result) => result.entry);
      }
      let cacheHint = response.cacheHint;
      if (cacheHint) {
        const cacheHintResult = cacheHintSchema.safeParse(cacheHint);
        if (!cacheHintResult.success) {
          return {
            error: new LiveCollectionCacheHintError(collection, void 0, cacheHintResult.error)
          };
        }
        cacheHint = cacheHintResult.data;
      }
      if (processedEntries.length > 0) {
        const entryTags = /* @__PURE__ */ new Set();
        let latestModified;
        for (const entry of processedEntries) {
          if (entry.cacheHint) {
            if (entry.cacheHint.tags) {
              entry.cacheHint.tags.forEach((tag) => entryTags.add(tag));
            }
            if (entry.cacheHint.lastModified instanceof Date) {
              if (latestModified === void 0 || entry.cacheHint.lastModified > latestModified) {
                latestModified = entry.cacheHint.lastModified;
              }
            }
          }
        }
        if (entryTags.size > 0 || latestModified || cacheHint) {
          const mergedCacheHint = {};
          if (cacheHint?.tags || entryTags.size > 0) {
            mergedCacheHint.tags = [.../* @__PURE__ */ new Set([...cacheHint?.tags || [], ...entryTags])];
          }
          if (cacheHint?.lastModified && latestModified) {
            mergedCacheHint.lastModified = cacheHint.lastModified > latestModified ? cacheHint.lastModified : latestModified;
          } else if (cacheHint?.lastModified || latestModified) {
            mergedCacheHint.lastModified = cacheHint?.lastModified ?? latestModified;
          }
          cacheHint = mergedCacheHint;
        }
      }
      return {
        entries: processedEntries,
        cacheHint
      };
    } catch (error) {
      return {
        error: new LiveCollectionError(
          collection,
          `Unexpected error loading collection ${collection}${error instanceof Error ? `: ${error.message}` : ""}`,
          error
        )
      };
    }
  };
}
function createGetLiveEntry({
  liveCollections
}) {
  return async function getLiveEntry(collection, lookup) {
    if (!(collection in liveCollections)) {
      return {
        error: new LiveCollectionError(
          collection,
          `Collection "${collection}" is not a live collection. Use getCollection() instead of getLiveEntry() to load regular content collections.`
        )
      };
    }
    try {
      const lookupObject = {
        filter: typeof lookup === "string" ? { id: lookup } : lookup,
        collection
      };
      let entry = await liveCollections[collection].loader?.loadEntry?.(lookupObject);
      if (entry && "error" in entry) {
        return { error: entry.error };
      }
      if (!entry) {
        return {
          error: new LiveEntryNotFoundError(collection, lookup)
        };
      }
      const { schema } = liveCollections[collection];
      if (schema) {
        const result = await parseLiveEntry(entry, schema, collection);
        if (result.error) {
          return { error: result.error };
        }
        entry = result.entry;
      }
      return {
        entry,
        cacheHint: entry.cacheHint
      };
    } catch (error) {
      return {
        error: new LiveCollectionError(
          collection,
          `Unexpected error loading entry ${collection} → ${typeof lookup === "string" ? lookup : JSON.stringify(lookup)}`,
          error
        )
      };
    }
  };
}

// astro-head-inject

const liveCollections = (await import('./live.config_DZhlgl5p.mjs')).collections;

const getLiveCollection = createGetLiveCollection({
	liveCollections,
});

const getLiveEntry = createGetLiveEntry({
	liveCollections,
});

export { getLiveCollection, getLiveEntry };
