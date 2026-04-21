import {
  AUTH_ENDPOINT,
  CLIENT_ID,
  CLIENT_SECRET,
  REVOKE_ENDPOINT,
  SCOPES,
  TOKEN_ENDPOINT,
  USERINFO_ENDPOINT,
} from '../shared/constants.js';

const api = typeof browser !== 'undefined' ? browser : globalThis.chrome;

// RFC 7636 unreserved characters
const URL_SAFE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function randomString(length = 64) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) {
    out += URL_SAFE_CHARS[byte % URL_SAFE_CHARS.length];
  }
  return out;
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) {
    str += String.fromCharCode(b);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generatePkcePair() {
  const verifier = randomString(96);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(digest);
  return { verifier, challenge };
}

export function getRedirectUri() {
  // browser.identity.getRedirectURL() returns a URL of the form
  // https://<extension-id>.extensions.allizom.org/ in Firefox.
  return api.identity.getRedirectURL();
}

export function buildAuthUrl({ clientId, redirectUri, codeChallenge, state, loginHint }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  if (loginHint) {
    params.set('login_hint', loginHint);
  }
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export function extractAuthResult(redirectUrl) {
  const url = new URL(redirectUrl);
  const params = url.searchParams.size ? url.searchParams : new URLSearchParams(url.hash.slice(1));
  const error = params.get('error');
  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }
  return {
    code: params.get('code'),
    state: params.get('state'),
  };
}

export async function exchangeCodeForTokens({
  code,
  codeVerifier,
  redirectUri,
  clientId,
  clientSecret = CLIENT_SECRET,
}) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  return normalizeTokens(data);
}

export async function refreshAccessToken({ refreshToken, clientId, clientSecret = CLIENT_SECRET }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  return normalizeTokens({ refresh_token: refreshToken, ...data });
}

export async function revokeToken(token) {
  if (!token) {
    return;
  }
  const body = new URLSearchParams({ token });
  await fetch(REVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch(() => {
    // Best-effort revocation — offline or already revoked are non-fatal.
  });
}

export async function fetchUserInfo(accessToken) {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`User info fetch failed: ${response.status}`);
  }
  return response.json();
}

function normalizeTokens(data) {
  const expiresInSec = Number(data.expires_in) || 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope || SCOPES.join(' '),
    expiresAt: Date.now() + expiresInSec * 1000,
  };
}

export async function launchOAuth({
  loginHint,
  clientId = CLIENT_ID,
  clientSecret = CLIENT_SECRET,
} = {}) {
  if (!clientId || clientId.startsWith('YOUR_GOOGLE_OAUTH_CLIENT_ID')) {
    throw new Error(
      'Google OAuth client ID is not configured. See README.md for setup instructions.',
    );
  }
  const { verifier, challenge } = await generatePkcePair();
  const state = randomString(32);
  const redirectUri = getRedirectUri();
  const authUrl = buildAuthUrl({
    clientId,
    redirectUri,
    codeChallenge: challenge,
    state,
    loginHint,
  });

  const redirectUrl = await api.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  const { code, state: returnedState } = extractAuthResult(redirectUrl);
  if (returnedState !== state) {
    throw new Error('OAuth state mismatch — possible CSRF.');
  }
  if (!code) {
    throw new Error('No authorization code returned.');
  }

  const tokens = await exchangeCodeForTokens({
    code,
    codeVerifier: verifier,
    redirectUri,
    clientId,
    clientSecret,
  });
  const userInfo = await fetchUserInfo(tokens.accessToken);
  return { tokens, userInfo };
}
