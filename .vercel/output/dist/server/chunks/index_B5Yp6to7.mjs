import './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { b as allowedDomainCreateBody } from './redirects_jp1t_nEU.mjs';
import { R as Role, r as roleFromLevel } from './types-ndj-bYfi_CoL8kXti.mjs';

const prerender = false;
const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)+$/;
const GET = async ({ locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "Database not configured", 500);
  }
  if (!user || user.role < Role.ADMIN) {
    return apiError("FORBIDDEN", "Admin privileges required", 403);
  }
  const adapter = createKyselyAdapter(emdash.db);
  try {
    const domains = await adapter.getAllowedDomains();
    return apiSuccess({
      domains: domains.map((d) => ({
        domain: d.domain,
        defaultRole: d.defaultRole,
        roleName: roleFromLevel(d.defaultRole),
        enabled: d.enabled,
        createdAt: d.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return handleError(error, "Failed to list allowed domains", "DOMAIN_LIST_ERROR");
  }
};
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "Database not configured", 500);
  }
  if (!user || user.role < Role.ADMIN) {
    return apiError("FORBIDDEN", "Admin privileges required", 403);
  }
  const adapter = createKyselyAdapter(emdash.db);
  try {
    const body = await parseBody(request, allowedDomainCreateBody);
    if (isParseError(body)) return body;
    const defaultRole = body.defaultRole;
    const cleanDomain = body.domain.toLowerCase().trim();
    if (!DOMAIN_REGEX.test(cleanDomain)) {
      return apiError("VALIDATION_ERROR", "Invalid domain format", 400);
    }
    const existing = await adapter.getAllowedDomain(cleanDomain);
    if (existing) {
      return apiError("CONFLICT", "Domain already exists", 409);
    }
    const domain = await adapter.createAllowedDomain(cleanDomain, defaultRole);
    return apiSuccess(
      {
        success: true,
        domain: {
          domain: domain.domain,
          defaultRole: domain.defaultRole,
          roleName: roleFromLevel(domain.defaultRole),
          enabled: domain.enabled,
          createdAt: domain.createdAt.toISOString()
        }
      },
      201
    );
  } catch (error) {
    return handleError(error, "Failed to create allowed domain", "DOMAIN_CREATE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
