import BetterSqlite3 from 'better-sqlite3';
import { SqliteDialect } from 'kysely';

//#region src/db/sqlite.ts
/**
* SQLite runtime adapter
*
* Creates a Kysely dialect for better-sqlite3.
* Loaded at runtime via virtual module.
*/
/**
* Create a SQLite dialect from config
*/
function createDialect$1(config) {
	const url = config.url;
	return new SqliteDialect({ database: new BetterSqlite3(url.startsWith("file:") ? url.slice(5) : url) });
}

const createDialect = createDialect$1;
const createRequestScopedDb = (_opts) => null;

export { createDialect, createRequestScopedDb };
