import { describe, expect, it } from 'vitest';
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  extractAuthResult,
  generatePkcePair,
  refreshAccessToken,
} from '../../src/background/auth.js';

describe('auth / PKCE', () => {
  it('generates a verifier of allowed length and a base64url challenge', async () => {
    const { verifier, challenge } = await generatePkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    // base64url: no +, /, =
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.includes('=')).toBe(false);
  });

  it('produces different verifiers on each call', async () => {
    const a = await generatePkcePair();
    const b = await generatePkcePair();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });
});

describe('auth / buildAuthUrl', () => {
  it('includes PKCE, scope, state, and login_hint when provided', () => {
    const url = buildAuthUrl({
      clientId: 'abc.apps.googleusercontent.com',
      redirectUri: 'https://ext.example/',
      codeChallenge: 'challenge123',
      state: 'state-xyz',
      loginHint: 'alice@example.com',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe('abc.apps.googleusercontent.com');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge123');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('state')).toBe('state-xyz');
    expect(parsed.searchParams.get('login_hint')).toBe('alice@example.com');
    expect(parsed.searchParams.get('scope')).toContain('gmail.modify');
  });

  it('omits login_hint when not provided', () => {
    const url = buildAuthUrl({
      clientId: 'abc',
      redirectUri: 'https://ext.example/',
      codeChallenge: 'cc',
      state: 's',
    });
    expect(new URL(url).searchParams.get('login_hint')).toBeNull();
  });
});

describe('auth / extractAuthResult', () => {
  it('extracts code and state from query params', () => {
    const result = extractAuthResult('https://ext.example/?code=AUTHCODE&state=XYZ');
    expect(result).toEqual({ code: 'AUTHCODE', state: 'XYZ' });
  });

  it('throws when error param is present', () => {
    expect(() => extractAuthResult('https://ext.example/?error=access_denied')).toThrow(
      /access_denied/,
    );
  });
});

describe('auth / exchangeCodeForTokens', () => {
  it('POSTs to token endpoint and normalizes the response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    const tokens = await exchangeCodeForTokens({
      code: 'c',
      codeVerifier: 'v',
      redirectUri: 'https://r/',
      clientId: 'cid',
    });

    expect(tokens.accessToken).toBe('at');
    expect(tokens.refreshToken).toBe('rt');
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect(init.body).toContain('code=c');
    expect(init.body).toContain('code_verifier=v');
    expect(init.body).toContain('grant_type=authorization_code');
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad',
    });
    await expect(
      exchangeCodeForTokens({ code: 'c', codeVerifier: 'v', redirectUri: 'r', clientId: 'x' }),
    ).rejects.toThrow(/400/);
  });
});

describe('auth / refreshAccessToken', () => {
  it('sends refresh_token grant and preserves existing refresh token when server omits it', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new', expires_in: 1800 }),
    });

    const tokens = await refreshAccessToken({ refreshToken: 'existing', clientId: 'c' });
    expect(tokens.accessToken).toBe('new');
    expect(tokens.refreshToken).toBe('existing');
    expect(globalThis.fetch.mock.calls[0][1].body).toContain('grant_type=refresh_token');
  });
});
