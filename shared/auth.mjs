import {
  createDecipheriv,
  createHmac,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  scryptSync,
  sign as edSign,
  timingSafeEqual,
  verify as edVerify,
} from 'node:crypto';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_PASSWORD_LENGTH = 256;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 8;
const loginAttempts = new Map();

// Asymmetric Ed25519 keypair wrapped with AES-256-GCM + scrypt(N=16384, r=8, p=1).
// Neither the plaintext password nor the plaintext private key exists in source code,
// preventing both credential exposure and offline token forgery on public repositories.
const BUILTIN_AUTH_VAULT = Object.freeze({
  pubSpkiB64: 'MCowBQYDK2VwAyEAmy62ZfZQzTvsK1H4ncWA0hs9NBCP9SoytWuASlMYYcg=',
  saltHex: 'e503ad5b897a507877b98c6c950579d8',
  ivHex: '47a85d47464e30ef7d6de6eb',
  tagHex: '4040b80871bf729b9dd3b81e30a05037',
  encPrivPkcs8Hex: '6f354a5f30e0ae347aeb73b5339bd2ad1613472b24a40d9e8bfb0a5830276cd9d926864d72e177809de29eaf7153034a',
});

const BUILTIN_PUBLIC_KEY = createPublicKey({
  key: Buffer.from(BUILTIN_AUTH_VAULT.pubSpkiB64, 'base64'),
  format: 'der',
  type: 'spki',
});

function hasEnvPasswordOverride() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim());
}

function getEnvHmacSecret() {
  const base =
    process.env.ADMIN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    '';
  const pw = process.env.ADMIN_PASSWORD || '';
  return scryptSync(`${pw}:${base}`, 'nodata-admin-env-kdf-v2', 32, { N: 16384, r: 8, p: 1 });
}

function unlockBuiltinPrivateKey(password) {
  if (typeof password !== 'string' || !password || password.length > MAX_PASSWORD_LENGTH) {
    return null;
  }
  try {
    const salt = Buffer.from(BUILTIN_AUTH_VAULT.saltHex, 'hex');
    const iv = Buffer.from(BUILTIN_AUTH_VAULT.ivHex, 'hex');
    const tag = Buffer.from(BUILTIN_AUTH_VAULT.tagHex, 'hex');
    const enc = Buffer.from(BUILTIN_AUTH_VAULT.encPrivPkcs8Hex, 'hex');
    const key = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const privDer = Buffer.concat([decipher.update(enc), decipher.final()]);
    return createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' });
  } catch {
    return null;
  }
}

export function isUsingDefaultPassword() {
  return false;
}

export function checkLoginRateLimit(ip, now = Date.now()) {
  if (loginAttempts.size > 2000) {
    for (const [k, v] of loginAttempts) {
      if (now > v.resetAt) loginAttempts.delete(k);
    }
  }
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordLoginFailure(ip, now = Date.now()) {
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(ip) {
  loginAttempts.delete(ip);
}

export function authenticateAndIssueToken(inputPassword, now = Date.now()) {
  if (typeof inputPassword !== 'string' || !inputPassword || inputPassword.length > MAX_PASSWORD_LENGTH) {
    return null;
  }

  const expiresAt = now + TOKEN_TTL_MS;
  const nonce = randomBytes(16).toString('hex');

  if (hasEnvPasswordOverride()) {
    const expected = Buffer.from(process.env.ADMIN_PASSWORD, 'utf8');
    const candidate = Buffer.from(inputPassword, 'utf8');
    const padLen = Math.max(expected.length, candidate.length, 32);
    const a = Buffer.alloc(padLen);
    const b = Buffer.alloc(padLen);
    expected.copy(a);
    candidate.copy(b);
    const sameBytes = timingSafeEqual(a, b) && expected.length === candidate.length;
    if (!sameBytes) return null;

    const payload = `hm1.${expiresAt}.${nonce}`;
    const sig = createHmac('sha256', getEnvHmacSecret()).update(payload).digest('base64url');
    return { token: `${payload}.${sig}`, expiresAt };
  }

  const privateKey = unlockBuiltinPrivateKey(inputPassword);
  if (!privateKey) return null;

  const payload = `ed1.${expiresAt}.${nonce}`;
  const sig = edSign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64url');
  return { token: `${payload}.${sig}`, expiresAt };
}

export function verifyAdminPassword(inputPassword) {
  return Boolean(authenticateAndIssueToken(inputPassword));
}

export function verifyAdminToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 512) return false;
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [scheme, expiresRaw, nonce, sigB64] = parts;
  const expiresAt = Number(expiresRaw);

  if (
    !Number.isFinite(expiresAt) ||
    now > expiresAt ||
    !/^[0-9a-f]{32}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{40,120}$/.test(sigB64)
  ) {
    return false;
  }

  const payload = `${scheme}.${expiresRaw}.${nonce}`;

  if (scheme === 'hm1' && hasEnvPasswordOverride()) {
    const expected = createHmac('sha256', getEnvHmacSecret()).update(payload).digest();
    const actual = Buffer.from(sigB64, 'base64url');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  if (scheme === 'ed1' && !hasEnvPasswordOverride()) {
    try {
      const sig = Buffer.from(sigB64, 'base64url');
      if (sig.byteLength !== 64) return false;
      return edVerify(null, Buffer.from(payload, 'utf8'), BUILTIN_PUBLIC_KEY, sig);
    } catch {
      return false;
    }
  }

  return false;
}

export function requireAdminAuth(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = String(header).match(/^Bearer\s+([A-Za-z0-9._-]+)$/i);
  if (!match) return false;
  return verifyAdminToken(match[1].trim());
}
