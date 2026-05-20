import { c as createComponent } from './astro-component_wp9zoKZU.mjs';
import 'piccolore';
import { a3 as addAttribute, Q as renderTemplate, b0 as renderHead } from './params-and-props_DwyEVPUa.mjs';
import { r as renderComponent } from './entrypoint_D95vxwaV.mjs';
import { $ as $$Font } from './_astro_assets_ClT9GV-2.mjs';
import 'react';
import 'react/jsx-runtime';

const LOCALES = [
  {
    code: "en",
    label: "English",
    enabled: true
  },
  {
    code: "ar",
    label: "العربية",
    enabled: true,
    dir: "rtl"
  },
  {
    code: "eu",
    label: "Euskara",
    enabled: true
  },
  {
    code: "zh-CN",
    label: "简体中文",
    enabled: true
  },
  {
    code: "zh-TW",
    label: "繁體中文",
    enabled: true
  },
  {
    code: "fa",
    label: "فارسی",
    enabled: true,
    dir: "rtl"
  },
  {
    code: "fr",
    label: "Français",
    enabled: true
  },
  {
    code: "de",
    label: "Deutsch",
    enabled: true
  },
  {
    code: "id",
    label: "Bahasa Indonesia",
    enabled: true
  },
  {
    code: "ja",
    label: "日本語",
    enabled: true
  },
  {
    code: "ko",
    label: "한국어",
    enabled: false
  },
  {
    code: "pl",
    label: "Polski",
    enabled: true
  },
  {
    code: "pt-BR",
    label: "Português (Brasil)",
    enabled: true
  },
  {
    code: "es-419",
    label: "Español (Latinoamérica)",
    enabled: true
  },
  {
    code: "es-ES",
    label: "Español (España)",
    enabled: true
  },
  {
    code: "pseudo",
    label: "Pseudo",
    enabled: false
  }
];
const SOURCE_LOCALE = LOCALES[0];
LOCALES.map((l) => l.code);
const ENABLED_LOCALES = LOCALES.filter((l) => l.enabled);
function isValidLocale(code) {
  try {
    return new Intl.Locale(code).baseName !== "";
  } catch {
    return false;
  }
}
const SUPPORTED_LOCALES = [...ENABLED_LOCALES.filter((l) => isValidLocale(l.code)), ...[]];
const SUPPORTED_LOCALE_CODES = new Set(SUPPORTED_LOCALES.map((l) => l.code));
const DEFAULT_LOCALE = SOURCE_LOCALE.code;
const BASE_LANGUAGE_MAP = /* @__PURE__ */ new Map();
const SCRIPT_LANGUAGE_MAP = /* @__PURE__ */ new Map();
for (const l of SUPPORTED_LOCALES) {
  const base = l.code.split("-")[0].toLowerCase();
  if (!BASE_LANGUAGE_MAP.has(base)) BASE_LANGUAGE_MAP.set(base, l.code);
  const maximized = new Intl.Locale(l.code).maximize();
  if (maximized.script) {
    const scriptKey = `${maximized.language}-${maximized.script}`.toLowerCase();
    if (!SCRIPT_LANGUAGE_MAP.has(scriptKey)) SCRIPT_LANGUAGE_MAP.set(scriptKey, l.code);
  }
}
function matchLocale(tag) {
  const trimmed = tag.trim();
  if (!trimmed) return void 0;
  let canonical;
  try {
    canonical = new Intl.Locale(trimmed).baseName;
  } catch {
    return;
  }
  if (SUPPORTED_LOCALE_CODES.has(canonical)) return canonical;
  const locale = new Intl.Locale(trimmed);
  if (locale.script) {
    const scriptKey = `${locale.language}-${locale.script}`.toLowerCase();
    const scriptMatch = SCRIPT_LANGUAGE_MAP.get(scriptKey);
    if (scriptMatch) return scriptMatch;
  }
  const base = canonical.split("-")[0].toLowerCase();
  return BASE_LANGUAGE_MAP.get(base);
}
new Map(SUPPORTED_LOCALES.map((l) => [l.code, l.label]));
const LOCALE_DIRS = new Map(SUPPORTED_LOCALES.map((l) => [l.code, l.dir]));
function getLocaleDir(code) {
  return LOCALE_DIRS.get(code) ?? "ltr";
}
const LOCALE_COOKIE_RE = /(?:^|;\s*)emdash-locale=([^;]+)/;
function resolveLocale(request) {
  const cookieLocale = (request.headers.get("cookie") ?? "").match(LOCALE_COOKIE_RE)?.[1]?.trim() ?? "";
  if (SUPPORTED_LOCALE_CODES.has(cookieLocale)) return cookieLocale;
  const acceptLang = request.headers.get("accept-language") ?? "";
  for (const entry of acceptLang.split(",")) {
    const matched = matchLocale(entry.split(";")[0].trim());
    if (matched) return matched;
  }
  return DEFAULT_LOCALE;
}
const LOCALE_LOADERS = /* @__PURE__ */ Object.assign({
  "./ar/messages.mjs": () => import('./messages-9_R3aCM9__0D7U89J.mjs'),
  "./de/messages.mjs": () => import('./messages-DQTZQuDt_F7kL_lHL.mjs'),
  "./en/messages.mjs": () => import('./messages-BHndsjBE_CYzIgzB7.mjs'),
  "./es-419/messages.mjs": () => import('./messages-B3-g6YaO_DMBm_BFw.mjs'),
  "./es-ES/messages.mjs": () => import('./messages-BieStAB8_C2D4epDF.mjs'),
  "./eu/messages.mjs": () => import('./messages-Dzvc57yv_Doorgn2e.mjs'),
  "./fa/messages.mjs": () => import('./messages-CgTwIPDv_B3gEorNn.mjs'),
  "./fr/messages.mjs": () => import('./messages-DES9CrLv_WigdeNRT.mjs'),
  "./id/messages.mjs": () => import('./messages-CXVvqhvr_DnfmoHgG.mjs'),
  "./ja/messages.mjs": () => import('./messages-A-cROb0f_KXRjlBag.mjs'),
  "./ko/messages.mjs": () => import('./messages-COU-tgjA_DlL8OmUY.mjs'),
  "./pl/messages.mjs": () => import('./messages-CtPGWm7g_DOBZivGw.mjs'),
  "./pseudo/messages.mjs": () => import('./messages-Dw1e-SNm_Cu-jONrX.mjs'),
  "./pt-BR/messages.mjs": () => import('./messages-BAEa2eLw_BpXDmDAU.mjs'),
  "./zh-CN/messages.mjs": () => import('./messages-B5UEpxLj_CMMEWA4R.mjs'),
  "./zh-TW/messages.mjs": () => import('./messages-BNPbaoQs_q8g-UNgI.mjs')
});
async function loadMessages(locale) {
  const key = `./${locale}/messages.mjs`;
  const fallbackKey = `./${DEFAULT_LOCALE}/messages.mjs`;
  const loader = LOCALE_LOADERS[key] ?? LOCALE_LOADERS[fallbackKey];
  if (!loader) throw new Error(`No locale catalog found for "${locale}" or "${DEFAULT_LOCALE}". Run \`pnpm locale:compile\` to generate catalogs.`);
  const { messages } = await loader();
  return messages;
}

const prerender = false;
const $$Admin = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Admin;
  const resolvedLocale = resolveLocale(Astro2.request);
  const resolvedDir = getLocaleDir(resolvedLocale);
  const messages = await loadMessages(resolvedLocale);
  const adminConfig = Astro2.locals.emdash?.config?.admin;
  const pageTitle = adminConfig?.siteName ? `${adminConfig.siteName} Admin` : "EmDash Admin";
  return renderTemplate`<html${addAttribute(resolvedLocale, "lang")}${addAttribute(resolvedDir, "dir")} data-astro-cid-txnlu7dk> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${renderComponent($$result, "Font", $$Font, { "cssVariable": "--font-emdash", "data-astro-cid-txnlu7dk": true })}${adminConfig?.favicon ? renderTemplate`<link rel="icon"${addAttribute(adminConfig.favicon, "href")}>` : renderTemplate`<link rel="icon" href="data:image/svg+xml,<svg width='75' height='75' viewBox='0 0 75 75' fill='none' xmlns='http://www.w3.org/2000/svg'> <g clip-path='url(%23clip0_50_99)'> <rect x='3' y='3' width='69' height='69' rx='10.518' stroke='url(%23paint0_linear_50_99)' stroke-width='6'/> <rect x='18' y='34' width='39.3661' height='6.56101' fill='url(%23paint1_linear_50_99)'/> </g> <defs> <linearGradient id='paint0_linear_50_99' x1='-42.9996' y1='124' x2='92.4233' y2='-41.7456' gradientUnits='userSpaceOnUse'> <stop stop-color='%230F006B'/> <stop offset='0.0833333' stop-color='%23281A81'/> <stop offset='0.166667' stop-color='%235D0C83'/> <stop offset='0.25' stop-color='%23911475'/> <stop offset='0.333333' stop-color='%23CE2F55'/> <stop offset='0.416667' stop-color='%23FF6633'/> <stop offset='0.5' stop-color='%23F6821F'/> <stop offset='0.583333' stop-color='%23FBAD41'/> <stop offset='0.666667' stop-color='%23FFCD89'/> <stop offset='0.75' stop-color='%23FFE9CB'/> <stop offset='0.833333' stop-color='%23FFF7EC'/> <stop offset='0.916667' stop-color='%23FFF8EE'/> <stop offset='1' stop-color='white'/> </linearGradient> <linearGradient id='paint1_linear_50_99' x1='91.4992' y1='27.4982' x2='28.1217' y2='54.1775' gradientUnits='userSpaceOnUse'> <stop stop-color='white'/> <stop offset='0.129253' stop-color='%23FFF8EE'/> <stop offset='0.617058' stop-color='%23FBAD41'/> <stop offset='0.848019' stop-color='%23F6821F'/> <stop offset='1' stop-color='%23FF6633'/> </linearGradient> <clipPath id='clip0_50_99'> <rect width='75' height='75' fill='white'/> </clipPath> </defs> </svg>">`}<title>${pageTitle}</title>${renderHead()}</head> <body class="isolate" data-astro-cid-txnlu7dk> <div id="admin-root" class="min-h-screen" data-astro-cid-txnlu7dk> <div id="emdash-boot-loader" data-astro-cid-txnlu7dk>  <div class="loader-inner" data-astro-cid-txnlu7dk> <div class="spinner" data-astro-cid-txnlu7dk></div> <p data-astro-cid-txnlu7dk>${adminConfig?.siteName ? `Loading ${adminConfig.siteName}...` : "Loading EmDash..."}</p> </div> </div> ${renderComponent($$result, "AdminWrapper", null, { "client:only": "react", "locale": resolvedLocale, "messages": messages, "client:component-hydration": "only", "data-astro-cid-txnlu7dk": true, "client:component-path": "emdash/routes/PluginRegistry", "client:component-export": "default" })} </div> </body></html>`;
}, "C:/Users/sabido/my_portfolio/node_modules/emdash/src/astro/routes/admin.astro", void 0);

const $$file = "C:/Users/sabido/my_portfolio/node_modules/emdash/src/astro/routes/admin.astro";
const $$url = undefined;

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	default: $$Admin,
	file: $$file,
	prerender,
	url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
