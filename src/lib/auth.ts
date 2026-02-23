const COOKIE_NAME = 'crm_session';
const COOKIE_VALUE = 'authenticated';

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(value: string): Promise<string> {
  const key = await getKey();
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  const b64 = Buffer.from(sig).toString('base64url');
  return `${value}.${b64}`;
}

async function verify(token: string): Promise<boolean> {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const value = token.slice(0, dotIndex);
  const sig = Buffer.from(token.slice(dotIndex + 1), 'base64url');
  const key = await getKey();
  const enc = new TextEncoder();
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(value));
}

export async function checkCredentials(username: string, password: string): Promise<boolean> {
  return (
    username === process.env.AUTH_USERNAME &&
    password === process.env.AUTH_PASSWORD
  );
}

export async function createSessionCookie(): Promise<string> {
  return sign(COOKIE_VALUE);
}

export async function verifySessionCookie(token: string): Promise<boolean> {
  return verify(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};
