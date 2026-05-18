import { Kysely } from 'kysely';
import { g as getRequestContext } from './request-context_Dj39IhTD.mjs';

function recordEvent(rec, sql, params, durationMs) {
  rec.events.push({
    sql,
    params,
    durationMs,
    route: rec.route,
    method: rec.method,
    phase: rec.phase
  });
}
function kyselyLog(event) {
  if (event.level !== "query") return;
  const ctx = getRequestContext();
  if (!ctx) return;
  const dur = event.queryDurationMillis;
  if (ctx.metrics) {
    const m = ctx.metrics;
    m.dbCount += 1;
    m.dbTotalMs += dur;
    const finishedAt = performance.now() - m.start;
    const startedAt = finishedAt - dur;
    if (m.dbFirstOffset === null) m.dbFirstOffset = startedAt;
    m.dbLastOffset = finishedAt;
  }
  if (ctx.queryRecorder) {
    recordEvent(ctx.queryRecorder, event.query.sql, event.query.parameters, dur);
  }
}
function kyselyLogOption() {
  return kyselyLog;
}

let virtualConfig;
let virtualCreateDialect;
async function loadVirtualModules() {
  if (virtualConfig === void 0) {
    const configModule = await import('./config_B3pgddBv.mjs');
    virtualConfig = configModule.default;
  }
  if (virtualCreateDialect === void 0) {
    const dialectModule = await import('./dialect_5VqW4Yvc.mjs');
    virtualCreateDialect = dialectModule.createDialect;
  }
}
let dbInstance = null;
async function getDb() {
  const ctx = getRequestContext();
  if (ctx?.db) {
    return ctx.db;
  }
  if (!dbInstance) {
    await loadVirtualModules();
    if (!virtualConfig?.database || typeof virtualCreateDialect !== "function") {
      throw new Error(
        "EmDash database not configured. Add database config to emdash() in astro.config.mjs"
      );
    }
    const dialect = virtualCreateDialect(virtualConfig.database.config);
    dbInstance = new Kysely({ dialect, log: kyselyLogOption() });
  }
  return dbInstance;
}

export { getDb as g };
