import { sql } from 'kysely';

function detectDialect(db) {
  const name = db.getExecutor().adapter.constructor.name;
  if (name === "PostgresAdapter") return "postgres";
  return "sqlite";
}
function isSqlite(db) {
  return detectDialect(db) === "sqlite";
}
function isPostgres(db) {
  return detectDialect(db) === "postgres";
}
function currentTimestamp(db) {
  if (isPostgres(db)) {
    return sql`CURRENT_TIMESTAMP`;
  }
  return sql`(datetime('now'))`;
}
function currentTimestampValue(db) {
  if (isPostgres(db)) {
    return sql`CURRENT_TIMESTAMP`;
  }
  return sql`datetime('now')`;
}
async function tableExists(db, tableName) {
  if (isPostgres(db)) {
    const result2 = await sql`
			SELECT EXISTS(
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = ${tableName}
			) as exists
		`.execute(db);
    return result2.rows[0]?.exists === true;
  }
  const result = await sql`
		SELECT name FROM sqlite_master
		WHERE type = 'table' AND name = ${tableName}
	`.execute(db);
  return result.rows.length > 0;
}
async function columnExists(db, tableName, columnName) {
  if (isPostgres(db)) {
    const result2 = await sql`
			SELECT EXISTS(
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = current_schema()
					AND table_name = ${tableName}
					AND column_name = ${columnName}
			) as exists
		`.execute(db);
    return result2.rows[0]?.exists === true;
  }
  const result = await sql`
		SELECT name FROM pragma_table_info(${tableName})
		WHERE name = ${columnName}
	`.execute(db);
  return result.rows.length > 0;
}
async function listTablesLike(db, pattern) {
  if (isPostgres(db)) {
    const result2 = await sql`
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name LIKE ${pattern}
		`.execute(db);
    return result2.rows.map((r) => r.table_name);
  }
  const result = await sql`
		SELECT name FROM sqlite_master
		WHERE type = 'table' AND name LIKE ${pattern}
	`.execute(db);
  return result.rows.map((r) => r.name);
}
function binaryType(db) {
  if (isPostgres(db)) {
    return "bytea";
  }
  return "blob";
}

export { currentTimestampValue as a, binaryType as b, currentTimestamp as c, columnExists as d, isSqlite as i, listTablesLike as l, tableExists as t };
