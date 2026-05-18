import { e as encodeBase64 } from './base64_CEvRaSBc.mjs';

const prerender = false;
const GET = async ({ url, cookies, redirect }) => {
  const siteUrl = url.searchParams.get("site_url");
  const userLogin = url.searchParams.get("user_login");
  const password = url.searchParams.get("password");
  if (!siteUrl || !userLogin || !password) {
    return redirect("/_emdash/admin/import/wordpress?error=auth_rejected");
  }
  const token = encodeBase64(`${userLogin}:${password}`);
  const authData = JSON.stringify({
    siteUrl,
    userLogin,
    token,
    timestamp: Date.now()
  });
  const encodedAuth = encodeBase64(authData);
  cookies.set("emdash_wp_auth", encodedAuth, {
    path: "/_emdash/",
    maxAge: 300,
    // 5 minutes
    httpOnly: false,
    // Needs to be readable by JS
    secure: url.protocol === "https:",
    sameSite: "lax"
  });
  return redirect("/_emdash/admin/import/wordpress?auth=success");
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
