import { a as apiError } from './error_Da04EfM-.mjs';
import './runner_B0zqy-AO.mjs';

const prerender = false;
async function handleDevBypass(context) {
  {
    return apiError("FORBIDDEN", "Dev bypass is only available in development mode", 403);
  }
}
const GET = handleDevBypass;
const POST = handleDevBypass;

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
