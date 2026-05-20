const hasNative = typeof Uint8Array.prototype.toBase64 === "function" && typeof Uint8Array.fromBase64 === "function";
const BASE64_PLUS_PATTERN = /\+/g;
const BASE64_SLASH_PATTERN = /\//g;
const BASE64_PADDING_PATTERN = /=+$/;
function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  if (hasNative) return bytes.toBase64();
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function decodeBase64(base64) {
  if (hasNative) return new TextDecoder().decode(Uint8Array.fromBase64(base64));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function encodeBase64url(bytes) {
  if (hasNative) return bytes.toBase64({ alphabet: "base64url", omitPadding: true });
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(BASE64_PLUS_PATTERN, "-").replace(BASE64_SLASH_PATTERN, "_").replace(BASE64_PADDING_PATTERN, "");
}

export { encodeBase64url as a, decodeBase64 as d, encodeBase64 as e };
