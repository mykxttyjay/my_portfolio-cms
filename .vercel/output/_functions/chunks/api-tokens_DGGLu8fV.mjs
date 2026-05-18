import { ulid } from 'ulidx';
import './index_Bxms_uoh.mjs';
import { g as generatePrefixedToken } from './authenticate-BiDGbUVY_CNGQ9xrZ.mjs';

async function handleApiTokenCreate(db, userId, input) {
  try {
    const id = ulid();
    const { raw, hash, prefix } = generatePrefixedToken("ec_pat_");
    await db.insertInto("_emdash_api_tokens").values({
      id,
      name: input.name,
      token_hash: hash,
      prefix,
      user_id: userId,
      scopes: JSON.stringify(input.scopes),
      expires_at: input.expiresAt ?? null
    }).execute();
    const info = {
      id,
      name: input.name,
      prefix,
      scopes: input.scopes,
      userId,
      expiresAt: input.expiresAt ?? null,
      lastUsedAt: null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return { success: true, data: { token: raw, info } };
  } catch {
    return {
      success: false,
      error: {
        code: "TOKEN_CREATE_ERROR",
        message: "Failed to create API token"
      }
    };
  }
}
async function handleApiTokenList(db, userId) {
  try {
    const rows = await db.selectFrom("_emdash_api_tokens").select([
      "id",
      "name",
      "prefix",
      "scopes",
      "user_id",
      "expires_at",
      "last_used_at",
      "created_at"
    ]).where("user_id", "=", userId).orderBy("created_at", "desc").execute();
    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: JSON.parse(row.scopes),
      userId: row.user_id,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at
    }));
    return { success: true, data: { items } };
  } catch {
    return {
      success: false,
      error: {
        code: "TOKEN_LIST_ERROR",
        message: "Failed to list API tokens"
      }
    };
  }
}
async function handleApiTokenRevoke(db, tokenId, userId) {
  try {
    const result = await db.deleteFrom("_emdash_api_tokens").where("id", "=", tokenId).where("user_id", "=", userId).executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Token not found" }
      };
    }
    return { success: true, data: { revoked: true } };
  } catch {
    return {
      success: false,
      error: {
        code: "TOKEN_REVOKE_ERROR",
        message: "Failed to revoke API token"
      }
    };
  }
}

export { handleApiTokenList as a, handleApiTokenCreate as b, handleApiTokenRevoke as h };
