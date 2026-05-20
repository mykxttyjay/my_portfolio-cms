import { a as apiError, b as apiSuccess } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { n as authMeActionBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ locals, session }) => {
  const { user } = locals;
  if (!user) {
    return apiError("NOT_AUTHENTICATED", "Not authenticated", 401);
  }
  const hasSeenWelcome = await session?.get("hasSeenWelcome");
  const isFirstLogin = !hasSeenWelcome;
  return apiSuccess({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isFirstLogin
  });
};
const POST = async ({ request, locals, session }) => {
  const { user } = locals;
  if (!user) {
    return apiError("NOT_AUTHENTICATED", "Not authenticated", 401);
  }
  const body = await parseBody(request, authMeActionBody);
  if (isParseError(body)) return body;
  if (body.action === "dismissWelcome") {
    session?.set("hasSeenWelcome", true);
    return apiSuccess({ success: true });
  }
  return apiError("UNKNOWN_ACTION", "Unknown action", 400);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
