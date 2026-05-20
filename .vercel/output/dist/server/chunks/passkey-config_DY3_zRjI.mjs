function createChallengeStore(db) {
  return {
    async set(challenge, data) {
      const expiresAt = new Date(data.expiresAt).toISOString();
      await db.insertInto("auth_challenges").values({
        challenge,
        type: data.type,
        user_id: data.userId ?? null,
        data: null,
        // Could store additional context if needed
        expires_at: expiresAt
      }).onConflict(
        (oc) => oc.column("challenge").doUpdateSet({
          type: data.type,
          user_id: data.userId ?? null,
          expires_at: expiresAt
        })
      ).execute();
    },
    async get(challenge) {
      const row = await db.selectFrom("auth_challenges").selectAll().where("challenge", "=", challenge).executeTakeFirst();
      if (!row) return null;
      const expiresAt = new Date(row.expires_at).getTime();
      if (expiresAt < Date.now()) {
        await this.delete(challenge);
        return null;
      }
      return {
        type: row.type === "registration" ? "registration" : "authentication",
        userId: row.user_id ?? void 0,
        expiresAt
      };
    },
    async delete(challenge) {
      await db.deleteFrom("auth_challenges").where("challenge", "=", challenge).execute();
    }
  };
}
async function cleanupExpiredChallenges(db) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await db.deleteFrom("auth_challenges").where("expires_at", "<", now).executeTakeFirst();
  return Number(result.numDeletedRows ?? 0);
}

function getPasskeyConfig(url, siteName, siteUrl, allowedOrigins) {
  let rpName;
  let rpId;
  let canonicalOrigin;
  if (siteUrl) {
    let publicUrl;
    try {
      publicUrl = new URL(siteUrl);
    } catch (e) {
      throw new Error(`Invalid siteUrl: "${siteUrl}"`, { cause: e });
    }
    rpName = siteName || publicUrl.hostname;
    rpId = publicUrl.hostname;
    canonicalOrigin = publicUrl.origin;
  } else {
    rpName = siteName || url.hostname;
    rpId = url.hostname;
    canonicalOrigin = url.origin;
  }
  const origins = [canonicalOrigin];
  if (allowedOrigins) {
    for (const extra of allowedOrigins) {
      if (extra && !origins.includes(extra)) origins.push(extra);
    }
  }
  return { rpName, rpId, origins };
}

export { cleanupExpiredChallenges as a, createChallengeStore as c, getPasskeyConfig as g };
