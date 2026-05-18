const IPV4_MAPPED_IPV6_DOTTED_PATTERN = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
const IPV4_MAPPED_IPV6_HEX_PATTERN = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
const IPV4_TRANSLATED_HEX_PATTERN = /^::ffff:0:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
const IPV6_EXPANDED_MAPPED_PATTERN = /^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
const IPV4_COMPATIBLE_HEX_PATTERN = /^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
const NAT64_HEX_PATTERN = /^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;
const IPV6_BRACKET_PATTERN = /^\[|\]$/g;
const IPV6_ULA_FC_PATTERN = /^fc[0-9a-f]{2}:/;
const IPV6_ULA_FD_PATTERN = /^fd[0-9a-f]{2}:/;
const TRAILING_DOT_PATTERN = /\.+$/;
const BLOCKED_PATTERNS = [
  // 127.0.0.0/8 — loopback
  { start: ip4ToNum(127, 0, 0, 0), end: ip4ToNum(127, 255, 255, 255) },
  // 10.0.0.0/8 — private
  { start: ip4ToNum(10, 0, 0, 0), end: ip4ToNum(10, 255, 255, 255) },
  // 172.16.0.0/12 — private
  { start: ip4ToNum(172, 16, 0, 0), end: ip4ToNum(172, 31, 255, 255) },
  // 192.168.0.0/16 — private
  { start: ip4ToNum(192, 168, 0, 0), end: ip4ToNum(192, 168, 255, 255) },
  // 169.254.0.0/16 — link-local (includes cloud metadata endpoint)
  { start: ip4ToNum(169, 254, 0, 0), end: ip4ToNum(169, 254, 255, 255) },
  // 0.0.0.0/8 — current network
  { start: ip4ToNum(0, 0, 0, 0), end: ip4ToNum(0, 255, 255, 255) }
];
const BLOCKED_HOSTNAMES = /* @__PURE__ */ new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "::1"
]);
const BLOCKED_HOSTNAME_SUFFIXES = [
  "nip.io",
  "sslip.io",
  "xip.io",
  "traefik.me",
  "lvh.me",
  "localtest.me"
];
const ALLOWED_SCHEMES = /* @__PURE__ */ new Set(["http:", "https:"]);
function ip4ToNum(a, b, c, d) {
  return (a << 24 | b << 16 | c << 8 | d) >>> 0;
}
function parseIpv4(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ip4ToNum(nums[0], nums[1], nums[2], nums[3]);
}
function normalizeIPv6MappedToIPv4(ip) {
  let match = ip.match(IPV4_MAPPED_IPV6_HEX_PATTERN);
  if (!match) {
    match = ip.match(IPV4_TRANSLATED_HEX_PATTERN);
  }
  if (!match) {
    match = ip.match(IPV6_EXPANDED_MAPPED_PATTERN);
  }
  if (!match) {
    match = ip.match(IPV4_COMPATIBLE_HEX_PATTERN);
  }
  if (!match) {
    match = ip.match(NAT64_HEX_PATTERN);
  }
  if (match) {
    const high = parseInt(match[1] ?? "", 16);
    const low = parseInt(match[2] ?? "", 16);
    return `${high >> 8 & 255}.${high & 255}.${low >> 8 & 255}.${low & 255}`;
  }
  return null;
}
function isPrivateIp(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::ffff:127.0.0.1") return true;
  const hexIpv4 = normalizeIPv6MappedToIPv4(normalized);
  if (hexIpv4) return isPrivateIp(hexIpv4);
  const v4Match = normalized.match(IPV4_MAPPED_IPV6_DOTTED_PATTERN);
  const ipv4 = v4Match ? v4Match[1] : normalized;
  const num = parseIpv4(ipv4);
  if (num === null) {
    return normalized.startsWith("fe80:") || IPV6_ULA_FC_PATTERN.test(normalized) || IPV6_ULA_FD_PATTERN.test(normalized);
  }
  return BLOCKED_PATTERNS.some((range) => num >= range.start && num <= range.end);
}
class SsrfError extends Error {
  constructor(message) {
    super(message);
    this.code = "SSRF_BLOCKED";
    this.name = "SsrfError";
  }
}
const MAX_REDIRECTS = 5;
function validateExternalUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfError("Invalid URL");
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new SsrfError(`Scheme '${parsed.protocol}' is not allowed`);
  }
  const hostname = parsed.hostname.replace(IPV6_BRACKET_PATTERN, "");
  const normalizedHost = hostname.toLowerCase().replace(TRAILING_DOT_PATTERN, "");
  if (BLOCKED_HOSTNAMES.has(normalizedHost)) {
    throw new SsrfError("URLs targeting internal hosts are not allowed");
  }
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`)) {
      throw new SsrfError("URLs targeting wildcard DNS services are not allowed");
    }
  }
  if (isPrivateIp(normalizedHost)) {
    throw new SsrfError("URLs targeting private IP addresses are not allowed");
  }
  return parsed;
}
const DOH_TIMEOUT_MS = 3e3;
const DEFAULT_DOH_URL = "https://cloudflare-dns.com/dns-query";
function hasProperty(obj, key) {
  return typeof obj === "object" && obj !== null && key in obj;
}
function parseDohResponse(raw) {
  if (!hasProperty(raw, "Status") || typeof raw.Status !== "number") {
    throw new Error("DoH response missing Status field");
  }
  const answers = [];
  if (hasProperty(raw, "Answer") && Array.isArray(raw.Answer)) {
    for (const entry of raw.Answer) {
      if (hasProperty(entry, "data") && typeof entry.data === "string") {
        answers.push({ data: entry.data });
      }
    }
  }
  return { Status: raw.Status, Answer: answers };
}
const cloudflareDohResolver = async (hostname) => {
  async function query(type) {
    const params = new URLSearchParams({ name: hostname, type });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);
    try {
      const response = await globalThis.fetch(`${DEFAULT_DOH_URL}?${params.toString()}`, {
        headers: { Accept: "application/dns-json" },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`DoH lookup failed: ${response.status}`);
      }
      const raw = await response.json();
      const body = parseDohResponse(raw);
      if (body.Status === 3) return [];
      if (body.Status !== 0) {
        throw new Error(`DoH ${type} lookup failed: rcode=${body.Status}`);
      }
      return body.Answer.map((a2) => a2.data).filter(isIpLiteral);
    } finally {
      clearTimeout(timeout);
    }
  }
  const [a, aaaa] = await Promise.all([query("A"), query("AAAA")]);
  return [...a, ...aaaa];
};
async function resolveAndValidateExternalUrl(url, options) {
  const parsed = validateExternalUrl(url);
  const hostname = parsed.hostname.replace(IPV6_BRACKET_PATTERN, "");
  if (isIpLiteral(hostname)) {
    return parsed;
  }
  const resolver = cloudflareDohResolver;
  let addresses;
  try {
    addresses = await resolver(hostname);
  } catch (error) {
    throw new SsrfError(
      `Could not resolve hostname: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (addresses.length === 0) {
    throw new SsrfError("Hostname resolved to no addresses");
  }
  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      throw new SsrfError("Hostname resolves to a private IP address");
    }
  }
  return parsed;
}
function isIpLiteral(host) {
  if (parseIpv4(host) !== null) return true;
  return host.includes(":");
}
const CREDENTIAL_HEADERS = ["authorization", "cookie", "proxy-authorization"];
async function ssrfSafeFetch(url, init, options) {
  let currentUrl = url;
  let currentInit = init;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await resolveAndValidateExternalUrl(currentUrl);
    const response = await globalThis.fetch(currentUrl, {
      ...currentInit,
      redirect: "manual"
    });
    if (response.status < 300 || response.status >= 400) {
      return response;
    }
    const location = response.headers.get("Location");
    if (!location) {
      return response;
    }
    const previousOrigin = new URL(currentUrl).origin;
    currentUrl = new URL(location, currentUrl).href;
    const nextOrigin = new URL(currentUrl).origin;
    if (previousOrigin !== nextOrigin && currentInit) {
      currentInit = stripCredentialHeaders(currentInit);
    }
  }
  throw new SsrfError(`Too many redirects (max ${MAX_REDIRECTS})`);
}
function stripCredentialHeaders(init) {
  if (!init.headers) return init;
  const headers = new Headers(init.headers);
  for (const name of CREDENTIAL_HEADERS) {
    headers.delete(name);
  }
  return { ...init, headers };
}

export { SsrfError as S, resolveAndValidateExternalUrl as r, ssrfSafeFetch as s, validateExternalUrl as v };
