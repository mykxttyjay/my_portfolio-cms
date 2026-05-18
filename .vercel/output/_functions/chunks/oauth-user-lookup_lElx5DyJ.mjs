import './index_Bxms_uoh.mjs';
import { t as toRoleLevel } from './types-ndj-bYfi_CoL8kXti.mjs';

async function lookupUserRoleAndStatus(db, userId) {
  const row = await db.selectFrom("users").select(["role", "disabled"]).where("id", "=", userId).executeTakeFirst();
  if (!row) return null;
  return {
    role: toRoleLevel(row.role),
    disabled: row.disabled === 1
  };
}

export { lookupUserRoleAndStatus as l };
