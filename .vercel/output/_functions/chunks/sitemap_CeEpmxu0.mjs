import { h as handleSitemapData } from './seo_DD_fm75J.mjs';
import { g as getPublicOrigin } from './public-url_B8zVhtAZ.mjs';
import { g as getSiteSettingsWithDb } from './index_DUdTeXmb.mjs';

const prerender = false;
const TRAILING_SLASH_RE = /\/$/;
const AMP_RE = /&/g;
const LT_RE = /</g;
const GT_RE = />/g;
const QUOT_RE = /"/g;
const APOS_RE = /'/g;
const GET = async ({ locals, url }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return new Response("<!-- EmDash not configured -->", {
      status: 500,
      headers: { "Content-Type": "application/xml" }
    });
  }
  try {
    const settings = await getSiteSettingsWithDb(emdash.db);
    const siteUrl = (settings.url || getPublicOrigin(url, emdash?.config)).replace(
      TRAILING_SLASH_RE,
      ""
    );
    const result = await handleSitemapData(emdash.db);
    if (!result.success || !result.data) {
      return new Response("<!-- Failed to generate sitemap -->", {
        status: 500,
        headers: { "Content-Type": "application/xml" }
      });
    }
    const { collections } = result.data;
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ];
    for (const col of collections) {
      const loc = `${siteUrl}/sitemap-${encodeURIComponent(col.collection)}.xml`;
      lines.push("  <sitemap>");
      lines.push(`    <loc>${escapeXml(loc)}</loc>`);
      lines.push(`    <lastmod>${escapeXml(col.lastmod)}</lastmod>`);
      lines.push("  </sitemap>");
    }
    lines.push("</sitemapindex>");
    return new Response(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    return new Response("<!-- Internal error generating sitemap -->", {
      status: 500,
      headers: { "Content-Type": "application/xml" }
    });
  }
};
function escapeXml(str) {
  return str.replace(AMP_RE, "&amp;").replace(LT_RE, "&lt;").replace(GT_RE, "&gt;").replace(QUOT_RE, "&quot;").replace(APOS_RE, "&apos;");
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
