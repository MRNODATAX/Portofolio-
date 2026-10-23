/**
 * Brankas rahasia terpisah untuk integrasi pihak ketiga (mis. Google Gemini API key)
 * yang diisi admin lewat halaman /admin.
 *
 * Kenapa dipisah dari `shared/site-data.json`?
 * Karena seluruh isi site data bisa dibaca publik lewat `GET /api/content`.
 * Rahasia karena itu disimpan di berkas/ tabel tersendiri dan SELALU terenkripsi
 * (AES-256-GCM + scrypt) saat disimpan (at-rest), serta tidak pernah dikembalikan
 * ke browser — UI hanya menerima versi tersensor (AIza••••7f3a).
 *
 * Catatan jujur tentang threat model: kunci enkripsi diturunkan dari environment
 * server (ADMIN_SECRET / SUPABASE_SERVICE_ROLE_KEY / UPSTASH_REDIS_REST_TOKEN).
 * Ini melindungi rahasia dari kebocoran tak sengaja (dump database, file ikut
 * ter-commit, respons API publik), bukan dari kompromi server secara penuh.
 * Untuk keamanan maksimal, tetap utamakan Environment Variable di Vercel.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseConfig, supabaseHeaders } from './store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SECRETS_PATH = join(__dirname, 'secrets.json');
const SECRETS_TABLE = 'site_secrets';
const SECRETS_ROW_ID = 'main';
const CACHE_TTL_MS = 60_000;

/** Nama rahasia yang dikenali sistem. */
export const SECRET_NAMES = Object.freeze(['geminiApiKey']);

const NAME_PATTERN = /^[a-z][a-zA-Z0-9]{2,40}$/;

function masterMaterial() {
  return (
    process.env.ADMIN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    'nodata-builtin-secret-v1'
  );
}

function deriveKey(salt) {
  return scryptSync(masterMaterial(), salt, 32, { N: 16384, r: 8, p: 1 });
}

export function sealSecret(plaintext) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(salt), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return {
    v: 1,
    alg: 'aes-256-gcm+scrypt',
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: enc.toString('hex'),
  };
}

export function openSecret(record) {
  if (!record || typeof record !== 'object' || record.alg !== 'aes-256-gcm+scrypt') return '';
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(Buffer.from(String(record.salt), 'hex')), Buffer.from(String(record.iv), 'hex'));
    decipher.setAuthTag(Buffer.from(String(record.tag), 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(String(record.data), 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

/** Menyensor nilai rahasia supaya aman ditampilkan di UI: AIza••••••••7f3a */
export function maskSecret(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 8) return '••••••••';
  return `${text.slice(0, 4)}${'•'.repeat(Math.min(12, Math.max(6, text.length - 8)))}${text.slice(-4)}`;
}

export function isValidSecretName(name) {
  return typeof name === 'string' && SECRET_NAMES.includes(name);
}

/** Validasi ringan bentuk API key Google (AIza + 20-80 karakter base64url). */
export function looksLikeGeminiKey(value) {
  const text = String(value || '').trim();
  return /^AIza[0-9A-Za-z_-]{20,120}$/.test(text);
}

function blankStore() {
  return { version: 1, updatedAt: '', secrets: {} };
}

function readLocalStore() {
  try {
    if (!existsSync(SECRETS_PATH)) return blankStore();
    const parsed = JSON.parse(readFileSync(SECRETS_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.secrets !== 'object' || parsed.secrets === null) return blankStore();
    return { version: 1, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '', secrets: parsed.secrets };
  } catch {
    return blankStore();
  }
}

async function readSupabaseStore(sb) {
  const res = await fetch(`${sb.url}/rest/v1/${SECRETS_TABLE}?id=eq.${SECRETS_ROW_ID}&select=data,updated_at`, {
    headers: supabaseHeaders(sb, { Accept: 'application/json' }),
  });
  if (!res.ok) throw new Error('SUPABASE_SECRETS_READ_FAILED');
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !row.data) return blankStore();
  return {
    version: 1,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    secrets: row.data && typeof row.data === 'object' ? row.data : {},
  };
}

async function writeSupabaseStore(sb, store) {
  const res = await fetch(`${sb.url}/rest/v1/${SECRETS_TABLE}`, {
    method: 'POST',
    headers: supabaseHeaders(sb, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify({ id: SECRETS_ROW_ID, data: store.secrets, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error('SUPABASE_SECRETS_WRITE_FAILED');
}

// Cache singkat supaya setiap permintaan chat tidak selalu memukul Supabase.
let cache = { at: 0, store: null, mode: 'memory' };

function invalidateCache() {
  cache = { at: 0, store: null, mode: cache.mode };
}

export async function loadSecretStore() {
  const now = Date.now();
  if (cache.store && now - cache.at < CACHE_TTL_MS) return { store: cache.store, mode: cache.mode };

  const sb = getSupabaseConfig();
  if (sb) {
    try {
      const store = await readSupabaseStore(sb);
      cache = { at: now, store, mode: 'supabase' };
      return { store, mode: 'supabase' };
    } catch {
      // Fallback below
    }
  }

  const store = readLocalStore();
  cache = { at: now, store, mode: 'filesystem' };
  return { store, mode: 'filesystem' };
}

async function persistSecretStore(store) {
  const payload = { version: 1, updatedAt: new Date().toISOString(), secrets: store.secrets };
  const sb = getSupabaseConfig();
  if (sb) {
    try {
      await writeSupabaseStore(sb, payload);
      cache = { at: Date.now(), store: payload, mode: 'supabase' };
      return 'supabase';
    } catch {
      // Fallback below
    }
  }
  try {
    mkdirSync(dirname(SECRETS_PATH), { recursive: true });
    writeFileSync(SECRETS_PATH, JSON.stringify(payload, null, 2) + '\n');
    cache = { at: Date.now(), store: payload, mode: 'filesystem' };
    return 'filesystem';
  } catch {
    cache = { at: Date.now(), store: payload, mode: 'memory' };
    return 'memory';
  }
}

/** Nilai rahasia yang dipakai server (env lebih diutamakan daripada yang tersimpan). */
export async function resolveSecret(name) {
  if (!isValidSecretName(name)) return { value: '', source: 'none' };
  if (name === 'geminiApiKey' && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return { value: process.env.GEMINI_API_KEY.trim(), source: 'env' };
  }
  const { store } = await loadSecretStore();
  const record = store.secrets?.[name];
  const value = openSecret(record);
  return value ? { value, source: 'admin' } : { value: '', source: 'none' };
}

export async function getSecretStatus(name) {
  const { value, source } = await resolveSecret(name);
  const { store } = await loadSecretStore();
  return {
    name,
    configured: Boolean(value),
    source,
    masked: maskSecret(value),
    updatedAt: store?.updatedAt || '',
  };
}

export async function putSecret(name, value) {
  if (!isValidSecretName(name)) throw new Error('Nama rahasia tidak dikenali.');
  const text = String(value || '').trim();
  if (!text) throw new Error('Nilai rahasia tidak boleh kosong.');
  if (text.length > 300) throw new Error('Nilai rahasia terlalu panjang (maksimal 300 karakter).');
  if (name === 'geminiApiKey' && !looksLikeGeminiKey(text)) {
    throw new Error('Format API key Gemini tidak dikenali. Key yang valid diawali "AIza".');
  }

  const { store } = await loadSecretStore();
  const next = { version: 1, updatedAt: '', secrets: { ...(store.secrets || {}) } };
  next.secrets[name] = sealSecret(text);
  const mode = await persistSecretStore(next);
  return { ...(await getSecretStatus(name)), persistedTo: mode };
}

export async function deleteSecret(name) {
  if (!isValidSecretName(name)) throw new Error('Nama rahasia tidak dikenali.');
  const { store } = await loadSecretStore();
  const next = { version: 1, updatedAt: '', secrets: { ...(store.secrets || {}) } };
  delete next.secrets[name];
  const mode = await persistSecretStore(next);
  invalidateCache();
  return { name, configured: false, source: 'none', masked: '', persistedTo: mode };
}

/** Menjalankan tes koneksi ringan ke Google Gemini tanpa membocorkan key ke klien. */
export async function testGeminiConnection() {
  const { value, source } = await resolveSecret('geminiApiKey');
  if (!value) return { ok: false, error: 'Belum ada API key yang tersimpan.', source };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 12000);
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=20', {
      headers: { 'x-goog-api-key': value },
      signal: abort.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = body?.error?.message || `Gemini menolak permintaan (HTTP ${res.status}).`;
      return { ok: false, error: message.slice(0, 300), source };
    }
    const models = Array.isArray(body.models)
      ? body.models
          .map((m) => String(m.name || '').replace(/^models\//, ''))
          .filter((m) => m.includes('gemini'))
          .slice(0, 12)
      : [];
    return { ok: true, source, models };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'Gagal menghubungi Gemini.', source };
  } finally {
    clearTimeout(timer);
  }
}

/** Hapus field rahasia bila suatu saat terselip ke dalam data CMS publik. */
export function stripSecretsFromSiteData(data) {
  if (!data || typeof data !== 'object') return data;
  delete data.secrets;
  if (data.relay && typeof data.relay === 'object') {
    delete data.relay.geminiApiKey;
    delete data.relay.aiApiKey;
    delete data.relay.apiKey;
  }
  return data;
}
