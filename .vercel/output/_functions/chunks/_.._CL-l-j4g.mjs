import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess } from './error_Da04EfM-.mjs';
import './index_Bxms_uoh.mjs';
import { h as hasScope } from './authenticate-BiDGbUVY_CNGQ9xrZ.mjs';

function requireScope(locals, scope) {
  if (!locals.tokenScopes) return null;
  if (hasScope(locals.tokenScopes, scope)) return null;
  return new Response(
    JSON.stringify({
      error: {
        code: "INSUFFICIENT_SCOPE",
        message: `Token lacks required scope: ${scope}`
      }
    }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

const prerender = false;
const handleRequest = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const pluginId = params.pluginId;
  const path = params.path || "";
  const method = request.method.toUpperCase();
  if (!emdash?.handlePluginApiRoute) {
    return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
  }
  const routeMeta = emdash.getPluginRouteMeta(pluginId, `/${path}`);
  if (!routeMeta) {
    return apiError("NOT_FOUND", "Plugin route not found", 404);
  }
  if (!routeMeta.public) {
    const permission = ["GET", "HEAD", "OPTIONS"].includes(method) ? "plugins:read" : "plugins:manage";
    const denied = requirePerm(user, permission);
    if (denied) return denied;
    const scopeError = requireScope(locals, "admin");
    if (scopeError) return scopeError;
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && !locals.tokenScopes && request.headers.get("X-EmDash-Request") !== "1") {
      return apiError("CSRF_REJECTED", "Missing required header", 403);
    }
  }
  const result = await emdash.handlePluginApiRoute(pluginId, method, `/${path}`, request);
  if (!result.success) {
    const code = result.error?.code ?? "PLUGIN_ERROR";
    const message = code === "INTERNAL_ERROR" ? "Plugin route error" : result.error?.message ?? "Plugin route error";
    const status = result.status ?? (code === "NOT_FOUND" ? 404 : 400);
    return apiError(code, message, status);
  }
  return apiSuccess(result.data);
};
const GET = handleRequest;
const POST = handleRequest;
const PUT = handleRequest;
const PATCH = handleRequest;
const DELETE = handleRequest;

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	DELETE,
	GET,
	PATCH,
	POST,
	PUT,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
