let transactionsSupported = null;
const TRANSACTIONS_NOT_SUPPORTED_RE = /transactions are not supported/i;
async function withTransaction(db, fn) {
  if (transactionsSupported === true) {
    return db.transaction().execute(fn);
  }
  if (transactionsSupported === false) {
    return fn(db);
  }
  try {
    const result = await db.transaction().execute(fn);
    transactionsSupported = true;
    return result;
  } catch (error) {
    if (error instanceof Error && TRANSACTIONS_NOT_SUPPORTED_RE.test(error.message)) {
      transactionsSupported = false;
      return fn(db);
    }
    throw error;
  }
}

export { withTransaction as w };
