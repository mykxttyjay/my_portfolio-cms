import { a as apiError } from './error_Da04EfM-.mjs';
import 'kysely';

const prerender = false;
const POST = async ({ locals }) => {
  {
    return apiError("FORBIDDEN", "Dev reset is only available in development mode", 403);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
