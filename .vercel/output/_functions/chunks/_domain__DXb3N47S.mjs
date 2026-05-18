import './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { a as allowedDomainUpdateBody } from './redirects_jp1t_nEU.mjs';
import { R as Role, r as roleFromLevel } from './types-ndj-bYfi_CoL8kXti.mjs';

const prerender = false;
const PATCH = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { domain } = params;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "Database not configured", 500);
  }
  if (!domain) {
    return apiError("VALIDATION_ERROR", "Domain is required", 400);
  }
  if (!user || user.role < Role.ADMIN) {
    return apiError("FORBIDDEN", "Admin privileges required", 403);
  }
  const adapter = createKyselyAdapter(emdash.db);
  try {
    const body = await parseBody(request, allowedDomainUpdateBody);
    if (isParseError(body)) return body;
    const existing = await adapter.getAllowedDomain(domain);
    if (!existing) {
      return apiError("NOT_FOUND", "Domain not found", 404);
    }
    const defaultRole = body.defaultRole;
    const enabled = body.enabled ?? existing.enabled;
    await adapter.updateAllowedDomain(domain, enabled, defaultRole);
    const updated = await adapter.getAllowedDomain(domain);
    return apiSuccess({
      success: true,
      domain: updated ? {
        domain: updated.domain,
        defaultRole: updated.defaultRole,
        roleName: roleFromLevel(updated.defaultRole),
        enabled: updated.enabled,
        createdAt: updated.createdAt.toISOString()
      } : null
    });
  } catch (error) {
    return handleError(error, "Failed to update allowed domain", "DOMAIN_UPDATE_ERROR");
  }
};
const DELETE = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const { domain } = params;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "Database not configured", 500);
  }
  if (!domain) {
    return apiError("VALIDATION_ERROR", "Domain is required", 400);
  }
  if (!user || user.role < Role.ADMIN) {
    return apiError("FORBIDDEN", "Admin privileges required", 403);
  }
  const adapter = createKyselyAdapter(emdash.db);
  try {
    const existing = await adapter.getAllowedDomain(domain);
    if (!existing) {
      return apiError("NOT_FOUND", "Domain not found", 404);
    }
    await adapter.deleteAllowedDomain(domain);
    return apiSuccess({ success: true });
  } catch (error) {
    return handleError(error, "Failed to delete allowed domain", "DOMAIN_DELETE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	DELETE,
	PATCH,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
