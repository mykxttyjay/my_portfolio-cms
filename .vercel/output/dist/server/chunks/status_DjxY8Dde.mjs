import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { g as getAuthMode } from './mode_CNhffo5w.mjs';
import { l as loadUserSeed } from './load_BbhXrqPv.mjs';

const prerender = false;
const GET = async ({ locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  try {
    const setupComplete = await emdash.db.selectFrom("options").select("value").where("name", "=", "emdash:setup_complete").executeTakeFirst();
    const isComplete = setupComplete && (() => {
      try {
        const parsed = JSON.parse(setupComplete.value);
        return parsed === true || parsed === "true";
      } catch {
        return false;
      }
    })();
    let hasUsers = false;
    try {
      const userCount = await emdash.db.selectFrom("users").select((eb) => eb.fn.countAll().as("count")).executeTakeFirstOrThrow();
      hasUsers = userCount.count > 0;
    } catch {
    }
    if (isComplete && hasUsers) {
      return apiSuccess({
        needsSetup: false
      });
    }
    let step = "start";
    const setupState = await emdash.db.selectFrom("options").select("value").where("name", "=", "emdash:setup_state").executeTakeFirst();
    if (setupState) {
      try {
        const state = JSON.parse(setupState.value);
        if (state.step === "admin") {
          step = "admin";
        } else if (state.step === "site") {
          step = "site";
        }
      } catch {
      }
    }
    if (isComplete && !hasUsers) {
      step = "admin";
    }
    const authMode = getAuthMode(emdash.config);
    const useExternalAuth = authMode.type === "external";
    if (useExternalAuth && isComplete) {
      return apiSuccess({
        needsSetup: false
      });
    }
    const seed = await loadUserSeed();
    const seedInfo = seed ? {
      name: seed.meta?.name || "Unknown Template",
      description: seed.meta?.description || "",
      collections: seed.collections?.length || 0,
      hasContent: !!(seed.content && Object.keys(seed.content).length > 0),
      title: seed.settings?.title,
      tagline: seed.settings?.tagline
    } : null;
    return apiSuccess({
      needsSetup: true,
      step,
      seedInfo,
      // Tell the wizard which auth mode is active
      authMode: useExternalAuth ? authMode.providerType : "passkey"
    });
  } catch (error) {
    return handleError(error, "Failed to check setup status", "SETUP_STATUS_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
