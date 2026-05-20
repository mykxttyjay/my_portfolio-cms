import { d as verifyMagicLink, M as MagicLinkError } from './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { a as apiError } from './error_Da04EfM-.mjs';
import { i as isSafeRedirect } from './redirect_DhjM6iuL.mjs';

const prerender = false;
const GET = async ({ url, locals, session, redirect }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const token = url.searchParams.get("token");
  if (!token) {
    return redirect("/_emdash/admin/login?error=missing_token");
  }
  try {
    const adapter = createKyselyAdapter(emdash.db);
    const user = await verifyMagicLink(adapter, token);
    void adapter.deleteExpiredTokens().catch(() => {
    });
    if (session) {
      session.set("user", { id: user.id });
    }
    const rawRedirect = url.searchParams.get("redirect");
    const redirectUrl = isSafeRedirect(rawRedirect) ? rawRedirect : "/_emdash/admin";
    return redirect(redirectUrl);
  } catch (error) {
    console.error("Magic link verify error:", error);
    if (error instanceof MagicLinkError) {
      switch (error.code) {
        case "invalid_token":
          return redirect("/_emdash/admin/login?error=invalid_link");
        case "token_expired":
          return redirect("/_emdash/admin/login?error=link_expired");
        case "user_not_found":
          return redirect("/_emdash/admin/login?error=user_not_found");
      }
    }
    return redirect("/_emdash/admin/login?error=verification_failed");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
