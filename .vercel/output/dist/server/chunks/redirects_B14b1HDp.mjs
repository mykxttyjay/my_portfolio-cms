import { O as OptionsRepository } from './options_DK6r2cuV.mjs';
import { c as compilePattern, m as matchPattern, i as interpolateDestination, R as RedirectRepository, a as isPattern, v as validatePattern, b as validateDestinationParams } from './redirect_CY-XSwpk.mjs';
import { InvalidCursorError } from './types_D-lIeGNL.mjs';

function compilePatterns(edges) {
  const result = [];
  for (const edge of edges) {
    if (edge.enabled && edge.isPattern) {
      result.push({
        id: edge.id,
        compiled: compilePattern(edge.source),
        destination: edge.destination
      });
    }
  }
  return result;
}
const DUMMY_SEGMENT = "__p__";
const SPLAT_RE = /\[\.\.\.(\w+)\]/g;
const PARAM_RE = /\[(\w+)\]/g;
function extractPatternSuffix(patternSource) {
  let result = patternSource.replace(SPLAT_RE, DUMMY_SEGMENT);
  SPLAT_RE.lastIndex = 0;
  result = result.replace(PARAM_RE, DUMMY_SEGMENT);
  const parts = result.split("/").filter(Boolean);
  return parts.slice(1).join("/");
}
function generateRepresentatives(template, existingEdges) {
  const hasSplat = SPLAT_RE.test(template);
  SPLAT_RE.lastIndex = 0;
  if (hasSplat) {
    const splatIndex = template.indexOf("[...");
    const prefix = template.slice(0, splatIndex);
    const reps = [
      template.replace(SPLAT_RE, DUMMY_SEGMENT).replace(PARAM_RE, DUMMY_SEGMENT),
      template.replace(SPLAT_RE, `${DUMMY_SEGMENT}/${DUMMY_SEGMENT}`).replace(PARAM_RE, DUMMY_SEGMENT),
      template.replace(SPLAT_RE, `${DUMMY_SEGMENT}/${DUMMY_SEGMENT}/${DUMMY_SEGMENT}`).replace(PARAM_RE, DUMMY_SEGMENT)
    ];
    if (existingEdges) {
      for (const edge of existingEdges) {
        if (edge.enabled && edge.isPattern && edge.source !== template) {
          const suffix = extractPatternSuffix(edge.source);
          if (suffix) {
            reps.push(`${prefix}${suffix}`);
          }
        }
      }
    }
    return reps;
  }
  return [template.replace(PARAM_RE, DUMMY_SEGMENT)];
}
function resolveNext(path, graph, patterns, edges) {
  const exact = graph.get(path);
  if (exact) return exact;
  if (!path.includes("[")) {
    for (const pr of patterns) {
      const params = matchPattern(pr.compiled, path);
      if (params) {
        const resolved = interpolateDestination(pr.destination, params);
        return { destination: resolved, id: pr.id };
      }
    }
  } else {
    const representatives = generateRepresentatives(path, edges);
    for (const pr of patterns) {
      for (const rep of representatives) {
        const params = matchPattern(pr.compiled, rep);
        if (params) {
          const resolved = interpolateDestination(pr.destination, params);
          return { destination: resolved, id: pr.id };
        }
      }
    }
  }
  return null;
}
function buildGraph(edges) {
  const graph = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    if (edge.enabled) {
      graph.set(edge.source, { destination: edge.destination, id: edge.id });
    }
  }
  return graph;
}
function detectLoops(edges) {
  const graph = buildGraph(edges);
  const patterns = compilePatterns(edges);
  const visited = /* @__PURE__ */ new Set();
  const loopRedirectIds = /* @__PURE__ */ new Set();
  for (const [startSource] of graph) {
    if (visited.has(startSource)) continue;
    const path = [];
    const pathSet = /* @__PURE__ */ new Set();
    const pathIds = [];
    let current = startSource;
    while (current) {
      if (pathSet.has(current)) {
        const loopStart = path.indexOf(current);
        for (const id of pathIds.slice(loopStart)) loopRedirectIds.add(id);
        break;
      }
      if (visited.has(current)) {
        break;
      }
      const next = resolveNext(current, graph, patterns, edges);
      if (!next) break;
      path.push(current);
      pathSet.add(current);
      pathIds.push(next.id);
      current = next.destination;
    }
    for (const node of path) visited.add(node);
  }
  return [...loopRedirectIds];
}
function findMatchingTemplate(resolvedPath, patterns) {
  for (const pr of patterns) {
    if (matchPattern(pr.compiled, resolvedPath) !== null) {
      return pr.compiled.source;
    }
  }
  return null;
}
function wouldCreateLoop(source, destination, existingEdges, excludeId) {
  const filtered = excludeId ? existingEdges.filter((e) => e.id !== excludeId) : existingEdges;
  const graph = buildGraph(filtered);
  const patterns = compilePatterns(filtered);
  const sourceIsPattern = source.includes("[");
  const compiledSource = sourceIsPattern ? compilePattern(source) : null;
  let startingPoints;
  if (destination.includes("[")) {
    const reps = generateRepresentatives(destination, filtered);
    const compiled = compilePattern(destination);
    for (const [key] of graph) {
      if (!key.includes("[") && matchPattern(compiled, key) !== null) {
        reps.push(key);
      }
    }
    reps.push(destination);
    startingPoints = reps;
  } else {
    startingPoints = [destination];
  }
  for (const start of startingPoints) {
    const path = [source, destination];
    let current = start;
    const seen = /* @__PURE__ */ new Set([source, destination, start]);
    while (true) {
      const next = resolveNext(current, graph, patterns, filtered);
      if (!next) break;
      const loopsBack = seen.has(next.destination) || compiledSource !== null && matchPattern(compiledSource, next.destination) !== null;
      if (loopsBack) {
        const displayPath = !seen.has(next.destination) && compiledSource !== null ? source : next.destination;
        path.push(displayPath);
        return path;
      }
      const cleanDest = next.destination.includes(DUMMY_SEGMENT) ? findMatchingTemplate(next.destination, patterns) ?? next.destination : next.destination;
      path.push(cleanDest);
      seen.add(next.destination);
      current = next.destination;
    }
  }
  return null;
}

async function handleRedirectList(db, params) {
  try {
    const repo = new RedirectRepository(db);
    const result = await repo.findMany(params);
    const loopRedirectIds = await getLoopRedirectIds(db);
    return {
      success: true,
      data: {
        ...result,
        ...loopRedirectIds.length > 0 ? { loopRedirectIds } : {}
      }
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return {
        success: false,
        error: { code: "INVALID_CURSOR", message: error.message }
      };
    }
    return {
      success: false,
      error: { code: "REDIRECT_LIST_ERROR", message: "Failed to fetch redirects" }
    };
  }
}
async function handleRedirectCreate(db, input) {
  try {
    const repo = new RedirectRepository(db);
    if (input.source === input.destination) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Source and destination must be different"
        }
      };
    }
    const sourceIsPattern = isPattern(input.source);
    if (sourceIsPattern) {
      const patternError = validatePattern(input.source);
      if (patternError) {
        return {
          success: false,
          error: { code: "VALIDATION_ERROR", message: `Invalid source pattern: ${patternError}` }
        };
      }
      const destError = validateDestinationParams(input.source, input.destination);
      if (destError) {
        return {
          success: false,
          error: { code: "VALIDATION_ERROR", message: destError }
        };
      }
    }
    const existing = await repo.findBySource(input.source);
    if (existing) {
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: `A redirect from "${input.source}" already exists`
        }
      };
    }
    if (input.enabled !== false) {
      const edges = toEdges(await repo.findAllEnabled());
      const loopPath = wouldCreateLoop(input.source, input.destination, edges);
      if (loopPath) return loopError(loopPath);
    }
    const redirect = await repo.create({
      source: input.source,
      destination: input.destination,
      type: input.type ?? 301,
      isPattern: sourceIsPattern,
      enabled: input.enabled ?? true,
      groupName: input.groupName ?? null
    });
    return { success: true, data: redirect };
  } catch {
    return {
      success: false,
      error: { code: "REDIRECT_CREATE_ERROR", message: "Failed to create redirect" }
    };
  }
}
async function handleRedirectGet(db, id) {
  try {
    const repo = new RedirectRepository(db);
    const redirect = await repo.findById(id);
    if (!redirect) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: `Redirect "${id}" not found` }
      };
    }
    return { success: true, data: redirect };
  } catch {
    return {
      success: false,
      error: { code: "REDIRECT_GET_ERROR", message: "Failed to fetch redirect" }
    };
  }
}
async function handleRedirectUpdate(db, id, input) {
  try {
    const repo = new RedirectRepository(db);
    const existing = await repo.findById(id);
    if (!existing) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: `Redirect "${id}" not found` }
      };
    }
    const newSource = input.source ?? existing.source;
    const newDest = input.destination ?? existing.destination;
    if (newSource === newDest) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Source and destination must be different"
        }
      };
    }
    if (input.source !== void 0) {
      const sourceIsPattern = isPattern(input.source);
      if (sourceIsPattern) {
        const patternError = validatePattern(input.source);
        if (patternError) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `Invalid source pattern: ${patternError}`
            }
          };
        }
      }
      const dup = await repo.findBySource(input.source);
      if (dup && dup.id !== id) {
        return {
          success: false,
          error: {
            code: "CONFLICT",
            message: `A redirect from "${input.source}" already exists`
          }
        };
      }
    }
    const newSourceIsPattern = isPattern(newSource);
    if (newSourceIsPattern) {
      const destError = validateDestinationParams(newSource, newDest);
      if (destError) {
        return {
          success: false,
          error: { code: "VALIDATION_ERROR", message: destError }
        };
      }
    }
    if (input.source !== void 0 || input.destination !== void 0) {
      const edges = toEdges(await repo.findAllEnabled());
      const loopPath = wouldCreateLoop(newSource, newDest, edges, id);
      if (loopPath) return loopError(loopPath);
    }
    const updated = await repo.update(id, {
      source: input.source,
      destination: input.destination,
      type: input.type,
      enabled: input.enabled,
      groupName: input.groupName
    });
    if (!updated) {
      return {
        success: false,
        error: { code: "REDIRECT_UPDATE_ERROR", message: "Failed to update redirect" }
      };
    }
    await updateLoopCache(db);
    return { success: true, data: updated };
  } catch {
    return {
      success: false,
      error: { code: "REDIRECT_UPDATE_ERROR", message: "Failed to update redirect" }
    };
  }
}
async function handleRedirectDelete(db, id) {
  try {
    const repo = new RedirectRepository(db);
    const deleted = await repo.delete(id);
    if (!deleted) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: `Redirect "${id}" not found` }
      };
    }
    await updateLoopCache(db);
    return { success: true, data: { deleted: true } };
  } catch {
    return {
      success: false,
      error: { code: "REDIRECT_DELETE_ERROR", message: "Failed to delete redirect" }
    };
  }
}
function loopError(loopPath) {
  const hops = loopPath.slice(0, -1).map((p, i) => `${p} → ${loopPath[i + 1]}`).join("\n");
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: `This redirect would create a loop:
${hops}`
    }
  };
}
function toEdges(redirects) {
  return redirects.map((r) => ({
    id: r.id,
    source: r.source,
    destination: r.destination,
    enabled: r.enabled,
    isPattern: r.isPattern
  }));
}
const LOOP_CACHE_KEY = "_redirect_loop_ids";
async function updateLoopCache(db) {
  try {
    const options = new OptionsRepository(db);
    const edges = toEdges(await new RedirectRepository(db).findAllEnabled());
    const loopRedirectIds = detectLoops(edges);
    await options.set(LOOP_CACHE_KEY, loopRedirectIds);
  } catch (error) {
    console.error("Failed to update redirect loop cache:", error);
  }
}
async function getLoopRedirectIds(db) {
  try {
    const options = new OptionsRepository(db);
    const cached = await options.get(LOOP_CACHE_KEY);
    if (cached !== null) return cached;
    await updateLoopCache(db);
    return await options.get(LOOP_CACHE_KEY) ?? [];
  } catch {
    return [];
  }
}
async function handleNotFoundList(db, params) {
  try {
    const repo = new RedirectRepository(db);
    const result = await repo.find404s(params);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return {
        success: false,
        error: { code: "INVALID_CURSOR", message: error.message }
      };
    }
    return {
      success: false,
      error: { code: "NOT_FOUND_LIST_ERROR", message: "Failed to fetch 404 log" }
    };
  }
}
async function handleNotFoundSummary(db, limit) {
  try {
    const repo = new RedirectRepository(db);
    const items = await repo.get404Summary(limit);
    return { success: true, data: { items } };
  } catch {
    return {
      success: false,
      error: { code: "NOT_FOUND_SUMMARY_ERROR", message: "Failed to fetch 404 summary" }
    };
  }
}
async function handleNotFoundClear(db) {
  try {
    const repo = new RedirectRepository(db);
    const deleted = await repo.clear404s();
    return { success: true, data: { deleted } };
  } catch {
    return {
      success: false,
      error: { code: "NOT_FOUND_CLEAR_ERROR", message: "Failed to clear 404 log" }
    };
  }
}
async function handleNotFoundPrune(db, olderThan) {
  try {
    const repo = new RedirectRepository(db);
    const deleted = await repo.prune404s(olderThan);
    return { success: true, data: { deleted } };
  } catch {
    return {
      success: false,
      error: { code: "NOT_FOUND_PRUNE_ERROR", message: "Failed to prune 404 log" }
    };
  }
}

export { handleNotFoundClear as a, handleNotFoundList as b, handleNotFoundPrune as c, handleRedirectDelete as d, handleRedirectGet as e, handleRedirectUpdate as f, handleRedirectList as g, handleNotFoundSummary as h, handleRedirectCreate as i };
