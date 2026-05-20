import { sql } from 'kysely';
import { a as apiError } from './error_Da04EfM-.mjs';

const IP_PATTERN = /^[\da-fA-F.:]+$/;
async function checkRateLimit(db, ip, endpoint, maxRequests, windowSeconds) {
  if (!ip) {
    return { allowed: true, count: 0, limit: maxRequests };
  }
  const windowStart = new Date(
    Math.floor(Date.now() / (windowSeconds * 1e3)) * windowSeconds * 1e3
  ).toISOString();
  const key = `${ip}:${endpoint}`;
  const result = await sql`
		INSERT INTO _emdash_rate_limits (key, "window", count)
		VALUES (${key}, ${windowStart}, 1)
		ON CONFLICT (key, "window")
		DO UPDATE SET count = _emdash_rate_limits.count + 1
		RETURNING count
	`.execute(db);
  const count = result.rows[0]?.count ?? 1;
  if (Math.random() < 0.01) {
    cleanupExpiredRateLimits(db).catch(() => {
    });
  }
  return {
    allowed: count <= maxRequests,
    count,
    limit: maxRequests
  };
}
function rateLimitResponse(retryAfterSeconds) {
  const response = apiError("RATE_LIMITED", "Too many requests. Please try again later.", 429);
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}
function getClientIp(request, trustedHeaders = []) {
  const headers = request.headers;
  const cf = request.cf;
  if (cf) {
    const cfIp = headers.get("cf-connecting-ip")?.trim();
    if (cfIp && IP_PATTERN.test(cfIp)) {
      return cfIp;
    }
    const xff = headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first && IP_PATTERN.test(first)) {
        return first;
      }
    }
  }
  for (const name of trustedHeaders) {
    const value = readIpFromHeader(headers, name);
    if (value) return value;
  }
  return null;
}
function readIpFromHeader(headers, name) {
  const value = headers.get(name);
  if (!value) return null;
  if (name.toLowerCase().endsWith("forwarded-for")) {
    const first = value.split(",")[0]?.trim();
    if (!first) return null;
    return IP_PATTERN.test(first) ? first : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  return IP_PATTERN.test(trimmed) ? trimmed : null;
}
async function cleanupExpiredRateLimits(db, maxAgeSeconds = 3600) {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1e3).toISOString();
  const result = await sql`
		DELETE FROM _emdash_rate_limits WHERE "window" < ${cutoff}
	`.execute(db);
  return Number(result.numAffectedRows ?? 0);
}

export { checkRateLimit as c, getClientIp as g, rateLimitResponse as r };
