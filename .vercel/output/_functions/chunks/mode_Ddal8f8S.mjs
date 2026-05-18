import { g as getAuthMode } from './mode_CNhffo5w.mjs';

const prerender = false;
const GET = async ({ locals }) => {
  const { emdash } = locals;
  const authMode = getAuthMode(emdash?.config);
  let signupEnabled = false;
  if (emdash?.db && authMode.type === "passkey") {
    try {
      const { sql } = await import('kysely');
      const result = await sql`
				SELECT COUNT(*) as cnt FROM allowed_domains WHERE enabled = 1
			`.execute(emdash.db);
      signupEnabled = Number(result.rows[0]?.cnt ?? 0) > 0;
    } catch {
    }
  }
  const providers = (emdash?.config?.authProviders ?? []).map((p) => ({
    id: p.id,
    label: p.label
  }));
  return Response.json(
    {
      data: {
        authMode: authMode.type === "external" ? authMode.providerType : "passkey",
        signupEnabled,
        providers
      }
    },
    {
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
