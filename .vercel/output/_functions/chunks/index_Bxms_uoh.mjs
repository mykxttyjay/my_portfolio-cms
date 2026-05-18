import { R as Role } from './types-ndj-bYfi_CoL8kXti.mjs';
import { b as generateTokenWithHash, c as hashToken } from './authenticate-BiDGbUVY_CNGQ9xrZ.mjs';
import { z } from 'zod';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';

//#region src/oauth/providers/github.ts
/**
* GitHub OAuth provider
*/
const gitHubUserSchema = z.object({
	id: z.number(),
	login: z.string(),
	name: z.string().nullable(),
	email: z.string().nullable(),
	avatar_url: z.string()
});
const gitHubEmailSchema = z.object({
	email: z.string(),
	primary: z.boolean(),
	verified: z.boolean()
});
const github = {
	name: "github",
	authorizeUrl: "https://github.com/login/oauth/authorize",
	tokenUrl: "https://github.com/login/oauth/access_token",
	userInfoUrl: "https://api.github.com/user",
	scopes: ["read:user", "user:email"],
	parseProfile(data) {
		const user = gitHubUserSchema.parse(data);
		return {
			id: String(user.id),
			email: user.email || "",
			name: user.name,
			avatarUrl: user.avatar_url,
			emailVerified: true
		};
	}
};
/**
* Fetch the user's primary email from GitHub
* (needed because email may not be returned in the basic user endpoint)
*/
async function fetchGitHubEmail(accessToken) {
	const response = await fetch("https://api.github.com/user/emails", { headers: {
		Authorization: `Bearer ${accessToken}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "emdash-cms"
	} });
	if (!response.ok) throw new Error(`Failed to fetch GitHub emails: ${response.status}`);
	const json = await response.json();
	const primary = z.array(gitHubEmailSchema).parse(json).find((e) => e.primary && e.verified);
	if (!primary) throw new Error("No verified primary email found on GitHub account");
	return primary.email;
}

//#region src/oauth/providers/google.ts
/**
* Google OAuth provider (using OIDC)
*/
const googleUserSchema = z.object({
	sub: z.string(),
	email: z.string(),
	email_verified: z.boolean(),
	name: z.string(),
	picture: z.string()
});
const google = {
	name: "google",
	authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
	tokenUrl: "https://oauth2.googleapis.com/token",
	userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
	scopes: [
		"openid",
		"email",
		"profile"
	],
	parseProfile(data) {
		const user = googleUserSchema.parse(data);
		return {
			id: user.sub,
			email: user.email,
			name: user.name,
			avatarUrl: user.picture,
			emailVerified: user.email_verified
		};
	}
};

//#region src/config.ts
/**
* Configuration schema for @emdash-cms/auth
*/
/** Matches http(s) scheme at start of URL */
const HTTP_SCHEME_RE = /^https?:\/\//i;
/** Validates that a URL string uses http or https scheme. Rejects javascript:/data: URI XSS vectors. */
const httpUrl = z.string().url().refine((url) => HTTP_SCHEME_RE.test(url), "URL must use http or https");
/**
* OAuth provider configuration
*/
const oauthProviderSchema = z.object({
	clientId: z.string(),
	clientSecret: z.string()
});
/**
* Full auth configuration schema
*/
z.object({
	secret: z.string().min(32, "Auth secret must be at least 32 characters"),
	passkeys: z.object({
		rpName: z.string(),
		rpId: z.string().optional()
	}).optional(),
	selfSignup: z.object({
		domains: z.array(z.string()),
		defaultRole: z.enum([
			"subscriber",
			"contributor",
			"author"
		]).default("contributor")
	}).optional(),
	oauth: z.object({
		github: oauthProviderSchema.optional(),
		google: oauthProviderSchema.optional()
	}).optional(),
	provider: z.object({
		enabled: z.boolean(),
		issuer: httpUrl.optional()
	}).optional(),
	sso: z.object({ enabled: z.boolean() }).optional(),
	session: z.object({
		maxAge: z.number().default(720 * 60 * 60),
		sliding: z.boolean().default(true)
	}).optional()
});

//#endregion
//#region src/rbac.ts
/**
* Permission definitions with minimum role required
*/
const Permissions = {
	"content:read": Role.SUBSCRIBER,
	"content:read_drafts": Role.CONTRIBUTOR,
	"content:create": Role.CONTRIBUTOR,
	"content:edit_own": Role.AUTHOR,
	"content:edit_any": Role.EDITOR,
	"content:delete_own": Role.AUTHOR,
	"content:delete_any": Role.EDITOR,
	"content:delete_permanent": Role.ADMIN,
	"content:publish_own": Role.AUTHOR,
	"content:publish_any": Role.EDITOR,
	"media:read": Role.SUBSCRIBER,
	"media:upload": Role.CONTRIBUTOR,
	"media:edit_own": Role.AUTHOR,
	"media:edit_any": Role.EDITOR,
	"media:delete_own": Role.AUTHOR,
	"media:delete_any": Role.EDITOR,
	"taxonomies:read": Role.SUBSCRIBER,
	"taxonomies:manage": Role.EDITOR,
	"comments:read": Role.SUBSCRIBER,
	"comments:moderate": Role.EDITOR,
	"comments:delete": Role.ADMIN,
	"comments:settings": Role.ADMIN,
	"menus:read": Role.SUBSCRIBER,
	"menus:manage": Role.EDITOR,
	"widgets:read": Role.SUBSCRIBER,
	"widgets:manage": Role.EDITOR,
	"sections:read": Role.SUBSCRIBER,
	"sections:manage": Role.EDITOR,
	"redirects:read": Role.EDITOR,
	"redirects:manage": Role.ADMIN,
	"users:read": Role.ADMIN,
	"users:invite": Role.ADMIN,
	"users:manage": Role.ADMIN,
	"settings:read": Role.EDITOR,
	"settings:manage": Role.ADMIN,
	"schema:read": Role.EDITOR,
	"schema:manage": Role.ADMIN,
	"plugins:read": Role.EDITOR,
	"plugins:manage": Role.ADMIN,
	"import:execute": Role.ADMIN,
	"search:read": Role.SUBSCRIBER,
	"search:manage": Role.ADMIN,
	"auth:manage_own_credentials": Role.SUBSCRIBER,
	"auth:manage_connections": Role.ADMIN
};
/**
* Check if a user has a specific permission
*/
function hasPermission(user, permission) {
	if (!user) return false;
	return user.role >= Permissions[permission];
}
/**
* Check if user can perform action on a resource they own
*/
function canActOnOwn(user, ownerId, ownPermission, anyPermission) {
	if (!user) return false;
	if (ownerId !== "" && user.id === ownerId) return hasPermission(user, ownPermission);
	return hasPermission(user, anyPermission);
}
/**
* Minimum role required for each API token scope.
*
* This is the authoritative mapping between the two authorization systems
* (RBAC roles and API token scopes). When issuing a token, the granted
* scopes must be intersected with the scopes allowed by the user's role.
*/
const SCOPE_MIN_ROLE = {
	"content:read": Role.SUBSCRIBER,
	"content:write": Role.CONTRIBUTOR,
	"media:read": Role.SUBSCRIBER,
	"media:write": Role.CONTRIBUTOR,
	"schema:read": Role.EDITOR,
	"schema:write": Role.ADMIN,
	"taxonomies:manage": Role.EDITOR,
	"menus:manage": Role.EDITOR,
	"settings:read": Role.EDITOR,
	"settings:manage": Role.ADMIN,
	admin: Role.ADMIN
};
/**
* Return the maximum set of API token scopes a given role level may hold.
*
* Used at token issuance time (device flow, authorization code exchange)
* to enforce: effective_scopes = requested_scopes ∩ scopesForRole(role).
*/
function scopesForRole(role) {
	return Object.entries(SCOPE_MIN_ROLE).reduce((acc, [scope, minRole]) => {
		if (role >= minRole) acc.push(scope);
		return acc;
	}, []);
}
/**
* Clamp a set of requested scopes to those permitted by a user's role.
*
* Returns the intersection of `requested` and the scopes the role allows.
* This is the central policy enforcement point: effective permissions =
* role permissions ∩ token scopes.
*/
function clampScopes(requested, role) {
	const allowed = new Set(scopesForRole(role));
	return requested.filter((s) => allowed.has(s));
}

//#endregion
//#region src/invite.ts
/**
* Invite system for new users
*/
/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(s) {
	return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}
const TOKEN_EXPIRY_MS$2 = 10080 * 60 * 1e3;
/**
* Create an invite token and URL without sending email.
*
* Validates the user doesn't already exist, generates a token, stores it,
* and returns the invite URL. Callers decide whether to send email or
* display the URL as a copy-link fallback.
*/
async function createInviteToken(config, adapter, email, role, invitedBy) {
	if (await adapter.getUserByEmail(email)) throw new InviteError("user_exists", "A user with this email already exists");
	const { token, hash } = generateTokenWithHash();
	await adapter.createToken({
		hash,
		email,
		type: "invite",
		role,
		invitedBy,
		expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS$2)
	});
	const url = new URL(`${config.baseUrl}/admin/invite/accept`);
	url.searchParams.set("token", token);
	return {
		url: url.toString(),
		email
	};
}
/**
* Build the invite email message.
*/
function buildInviteEmail(inviteUrl, email, siteName) {
	const safeName = escapeHtml(siteName);
	return {
		to: email,
		subject: `You've been invited to ${siteName}`,
		text: `You've been invited to join ${siteName}.\n\nClick this link to create your account:\n${inviteUrl}\n\nThis link expires in 7 days.`,
		html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 24px; margin-bottom: 20px;">You've been invited to ${safeName}</h1>
  <p>Click the button below to create your account:</p>
  <p style="margin: 30px 0;">
    <a href="${inviteUrl}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invite</a>
  </p>
  <p style="color: #666; font-size: 14px;">This link expires in 7 days.</p>
</body>
</html>`
	};
}
/**
* Create and send an invite to a new user.
*
* When `config.email` is provided, sends the invite email.
* When omitted, creates the token and returns the invite URL
* without sending (for the copy-link fallback).
*/
async function createInvite(config, adapter, email, role, invitedBy) {
	const result = await createInviteToken(config, adapter, email, role, invitedBy);
	if (config.email) {
		const message = buildInviteEmail(result.url, email, config.siteName);
		await config.email(message);
	}
	return result;
}
/**
* Validate an invite token and return the invite data
*/
async function validateInvite(adapter, token) {
	const hash = hashToken(token);
	const authToken = await adapter.getToken(hash, "invite");
	if (!authToken) throw new InviteError("invalid_token", "Invalid or expired invite link");
	if (authToken.expiresAt < /* @__PURE__ */ new Date()) {
		await adapter.deleteToken(hash);
		throw new InviteError("token_expired", "This invite has expired");
	}
	if (!authToken.email || authToken.role === null) throw new InviteError("invalid_token", "Invalid invite data");
	return {
		email: authToken.email,
		role: authToken.role
	};
}
/**
* Complete the invite process (after passkey registration)
*/
async function completeInvite(adapter, token, userData) {
	const hash = hashToken(token);
	const authToken = await adapter.getToken(hash, "invite");
	if (!authToken || authToken.expiresAt < /* @__PURE__ */ new Date()) throw new InviteError("invalid_token", "Invalid or expired invite");
	if (!authToken.email || authToken.role === null) throw new InviteError("invalid_token", "Invalid invite data");
	await adapter.deleteToken(hash);
	return await adapter.createUser({
		email: authToken.email,
		name: userData.name,
		avatarUrl: userData.avatarUrl,
		role: authToken.role,
		emailVerified: true
	});
}
var InviteError = class extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "InviteError";
	}
};

//#endregion
//#region src/magic-link/index.ts
/**
* Magic link authentication
*/
const TOKEN_EXPIRY_MS$1 = 900 * 1e3;
/**
* Add artificial delay with jitter to prevent timing attacks.
* Range approximates the time for token creation + email send.
*/
async function timingDelay$1() {
	const delay = 100 + Math.random() * 150;
	await new Promise((resolve) => setTimeout(resolve, delay));
}
/**
* Send a magic link to a user's email.
*
* Requires `config.email` to be set. Throws if no email sender is configured.
*/
async function sendMagicLink(config, adapter, email, type = "magic_link") {
	if (!config.email) throw new MagicLinkError("email_not_configured", "Email is not configured");
	const user = await adapter.getUserByEmail(email);
	if (!user) {
		await timingDelay$1();
		return;
	}
	const { token, hash } = generateTokenWithHash();
	await adapter.createToken({
		hash,
		userId: user.id,
		email: user.email,
		type,
		expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS$1)
	});
	const url = new URL("/_emdash/api/auth/magic-link/verify", config.baseUrl);
	url.searchParams.set("token", token);
	const safeName = escapeHtml(config.siteName);
	await config.email({
		to: user.email,
		subject: `Sign in to ${config.siteName}`,
		text: `Click this link to sign in to ${config.siteName}:\n\n${url.toString()}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
		html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 24px; margin-bottom: 20px;">Sign in to ${safeName}</h1>
  <p>Click the button below to sign in:</p>
  <p style="margin: 30px 0;">
    <a href="${url.toString()}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign in</a>
  </p>
  <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
  <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`
	});
}
/**
* Verify a magic link token and return the user
*/
async function verifyMagicLink(adapter, token) {
	const hash = hashToken(token);
	const authToken = await adapter.getToken(hash, "magic_link");
	if (!authToken) {
		const recoveryToken = await adapter.getToken(hash, "recovery");
		if (!recoveryToken) throw new MagicLinkError("invalid_token", "Invalid or expired link");
		return verifyTokenAndGetUser(adapter, recoveryToken, hash);
	}
	return verifyTokenAndGetUser(adapter, authToken, hash);
}
async function verifyTokenAndGetUser(adapter, authToken, hash) {
	if (authToken.expiresAt < /* @__PURE__ */ new Date()) {
		await adapter.deleteToken(hash);
		throw new MagicLinkError("token_expired", "This link has expired");
	}
	await adapter.deleteToken(hash);
	if (!authToken.userId) throw new MagicLinkError("invalid_token", "Invalid token");
	const user = await adapter.getUserById(authToken.userId);
	if (!user) throw new MagicLinkError("user_not_found", "User not found");
	return user;
}
var MagicLinkError = class extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "MagicLinkError";
	}
};

//#endregion
//#region src/signup.ts
/**
* Self-signup for allowed email domains
*/
const TOKEN_EXPIRY_MS = 900 * 1e3;
/**
* Add artificial delay with jitter to prevent timing attacks.
* Range approximates the time for token creation + email send.
*/
async function timingDelay() {
	const delay = 100 + Math.random() * 150;
	await new Promise((resolve) => setTimeout(resolve, delay));
}
/**
* Check if an email domain is allowed for self-signup
*/
async function canSignup(adapter, email) {
	const domain = email.split("@")[1]?.toLowerCase();
	if (!domain) return null;
	const allowedDomain = await adapter.getAllowedDomain(domain);
	if (!allowedDomain || !allowedDomain.enabled) return null;
	return {
		allowed: true,
		role: allowedDomain.defaultRole
	};
}
/**
* Request self-signup (sends verification email).
*
* Requires `config.email` to be set. Throws if no email sender is configured.
*/
async function requestSignup(config, adapter, email) {
	if (!config.email) throw new SignupError("email_not_configured", "Email is not configured");
	if (await adapter.getUserByEmail(email)) {
		await timingDelay();
		return;
	}
	const signup = await canSignup(adapter, email);
	if (!signup) {
		await timingDelay();
		return;
	}
	const { token, hash } = generateTokenWithHash();
	await adapter.createToken({
		hash,
		email,
		type: "email_verify",
		role: signup.role,
		expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS)
	});
	const url = new URL("/_emdash/api/auth/signup/verify", config.baseUrl);
	url.searchParams.set("token", token);
	const safeName = escapeHtml(config.siteName);
	await config.email({
		to: email,
		subject: `Verify your email for ${config.siteName}`,
		text: `Click this link to verify your email and create your account:\n\n${url.toString()}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
		html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 24px; margin-bottom: 20px;">Verify your email</h1>
  <p>Click the button below to verify your email and create your ${safeName} account:</p>
  <p style="margin: 30px 0;">
    <a href="${url.toString()}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a>
  </p>
  <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
  <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`
	});
}
/**
* Validate a signup verification token
*/
async function validateSignupToken(adapter, token) {
	const hash = hashToken(token);
	const authToken = await adapter.getToken(hash, "email_verify");
	if (!authToken) throw new SignupError("invalid_token", "Invalid or expired verification link");
	if (authToken.expiresAt < /* @__PURE__ */ new Date()) {
		await adapter.deleteToken(hash);
		throw new SignupError("token_expired", "This link has expired");
	}
	if (!authToken.email || authToken.role === null) throw new SignupError("invalid_token", "Invalid token data");
	return {
		email: authToken.email,
		role: authToken.role
	};
}
/**
* Complete signup process (after passkey registration)
*/
async function completeSignup(adapter, token, userData) {
	const hash = hashToken(token);
	const authToken = await adapter.getToken(hash, "email_verify");
	if (!authToken || authToken.expiresAt < /* @__PURE__ */ new Date()) throw new SignupError("invalid_token", "Invalid or expired verification");
	if (!authToken.email || authToken.role === null) throw new SignupError("invalid_token", "Invalid token data");
	if (await adapter.getUserByEmail(authToken.email)) {
		await adapter.deleteToken(hash);
		throw new SignupError("user_exists", "An account with this email already exists");
	}
	await adapter.deleteToken(hash);
	return await adapter.createUser({
		email: authToken.email,
		name: userData.name,
		avatarUrl: userData.avatarUrl,
		role: authToken.role,
		emailVerified: true
	});
}
var SignupError = class extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "SignupError";
	}
};

//#endregion
//#region src/oauth/consumer.ts
/**
* OAuth consumer - "Login with X" functionality
*/
/**
* Generate an OAuth authorization URL
*/
async function createAuthorizationUrl(config, providerName, stateStore) {
	const providerConfig = config.providers[providerName];
	if (!providerConfig) throw new Error(`OAuth provider ${providerName} not configured`);
	const provider = getProvider(providerName);
	const state = generateState();
	const redirectUri = new URL(`/_emdash/api/auth/oauth/${providerName}/callback`, config.baseUrl).toString();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = await generateCodeChallenge(codeVerifier);
	await stateStore.set(state, {
		provider: providerName,
		redirectUri,
		codeVerifier
	});
	const url = new URL(provider.authorizeUrl);
	url.searchParams.set("client_id", providerConfig.clientId);
	url.searchParams.set("redirect_uri", redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", provider.scopes.join(" "));
	url.searchParams.set("state", state);
	url.searchParams.set("code_challenge", codeChallenge);
	url.searchParams.set("code_challenge_method", "S256");
	return {
		url: url.toString(),
		state
	};
}
/**
* Handle OAuth callback
*/
async function handleOAuthCallback(config, adapter, providerName, code, state, stateStore) {
	const providerConfig = config.providers[providerName];
	if (!providerConfig) throw new Error(`OAuth provider ${providerName} not configured`);
	const storedState = await stateStore.get(state);
	if (!storedState || storedState.provider !== providerName) throw new OAuthError("invalid_state", "Invalid OAuth state");
	await stateStore.delete(state);
	const provider = getProvider(providerName);
	return findOrCreateOAuthUser(adapter, providerName, await fetchProfile(provider, (await exchangeCode(provider, providerConfig, code, storedState.redirectUri, storedState.codeVerifier)).accessToken, providerName), config.canSelfSignup);
}
/**
* Exchange authorization code for tokens
*/
async function exchangeCode(provider, config, code, redirectUri, codeVerifier) {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri,
		client_id: config.clientId,
		client_secret: config.clientSecret
	});
	if (codeVerifier) body.set("code_verifier", codeVerifier);
	const response = await fetch(provider.tokenUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json"
		},
		body
	});
	if (!response.ok) throw new OAuthError("token_exchange_failed", `Token exchange failed: ${await response.text()}`);
	const json = await response.json();
	const data = z.object({
		access_token: z.string(),
		id_token: z.string().optional()
	}).parse(json);
	return {
		accessToken: data.access_token,
		idToken: data.id_token
	};
}
/**
* Fetch user profile from OAuth provider
*/
async function fetchProfile(provider, accessToken, providerName) {
	if (!provider.userInfoUrl) throw new Error("Provider does not have userinfo URL");
	const response = await fetch(provider.userInfoUrl, { headers: {
		Authorization: `Bearer ${accessToken}`,
		Accept: "application/json",
		"User-Agent": "emdash-cms"
	} });
	if (!response.ok) throw new OAuthError("profile_fetch_failed", `Failed to fetch profile: ${response.status}`);
	const data = await response.json();
	const profile = provider.parseProfile(data);
	if (providerName === "github" && !profile.email) profile.email = await fetchGitHubEmail(accessToken);
	return profile;
}
/**
* Find existing user or create new one (with auto-linking).
*
* Shared across all OAuth providers (GitHub, Google, AT Protocol, etc.).
* The provider-specific token exchange happens before this function is called;
* this function only deals with the EmDash user record.
*/
async function findOrCreateOAuthUser(adapter, providerName, profile, canSelfSignup) {
	const existingAccount = await adapter.getOAuthAccount(providerName, profile.id);
	if (existingAccount) {
		const user = await adapter.getUserById(existingAccount.userId);
		if (!user) throw new OAuthError("user_not_found", "Linked user not found");
		return user;
	}
	const existingUser = await adapter.getUserByEmail(profile.email);
	if (existingUser) {
		if (!profile.emailVerified) throw new OAuthError("signup_not_allowed", "Cannot link account: email not verified by provider");
		await adapter.createOAuthAccount({
			provider: providerName,
			providerAccountId: profile.id,
			userId: existingUser.id
		});
		return existingUser;
	}
	if (canSelfSignup) {
		const signup = await canSelfSignup(profile.email);
		if (signup?.allowed) {
			const user = await adapter.createUser({
				email: profile.email,
				name: profile.name,
				avatarUrl: profile.avatarUrl,
				role: signup.role,
				emailVerified: profile.emailVerified
			});
			await adapter.createOAuthAccount({
				provider: providerName,
				providerAccountId: profile.id,
				userId: user.id
			});
			return user;
		}
	}
	throw new OAuthError("signup_not_allowed", "Self-signup not allowed for this email domain");
}
function getProvider(name) {
	switch (name) {
		case "github": return github;
		case "google": return google;
	}
}
/**
* Generate a random state string for OAuth CSRF protection
*/
function generateState() {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return encodeBase64urlNoPadding(bytes);
}
function generateCodeVerifier() {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return encodeBase64urlNoPadding(bytes);
}
async function generateCodeChallenge(verifier) {
	return encodeBase64urlNoPadding(sha256(new TextEncoder().encode(verifier)));
}
var OAuthError = class extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "OAuthError";
	}
};

export { InviteError as I, MagicLinkError as M, OAuthError as O, SignupError as S, completeInvite as a, createInvite as b, canActOnOwn as c, verifyMagicLink as d, handleOAuthCallback as e, createAuthorizationUrl as f, completeSignup as g, hasPermission as h, validateSignupToken as i, clampScopes as j, escapeHtml as k, requestSignup as r, sendMagicLink as s, validateInvite as v };
