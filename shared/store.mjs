import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeUrl, verifyImageMagicBytes } from './security.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_DATA_PATH = join(__dirname, 'site-data.json');
const PROFILE_PATH = join(__dirname, 'profile.json');
const CONTENT_PATH = join(__dirname, 'content.json');
const UPLOADS_DIR = join(__dirname, '..', 'public', 'images', 'uploads');
const CMS_REDIS_KEY = 'nodata:{cms}:site-data:v1';
const SUPABASE_BUCKET = 'portfolio-assets';

const INITIAL_SEED = JSON.parse(readFileSync(SITE_DATA_PATH, 'utf8'));
let memorySiteData = structuredClone(INITIAL_SEED);

export const memoryRatingsStore = {
  sum: 15,
  count: 3,
  clients: new Set(),
  reviews: [
    {
      id: '11111111-1111-4111-8111-111111111101',
      name: 'Rizky Pratama',
      stars: 5,
      comment: 'Desain glass & orbit 3D-nya rapi banget, transisi antar bab halus.',
      createdAt: '2026-10-18T09:15:00.000Z',
    },
    {
      id: '11111111-1111-4111-8111-111111111102',
      name: 'Nadia S.',
      stars: 5,
      comment: 'Cerita transisi pasca-pondok ke eksplorasi sistem & AI Agent keren!',
      createdAt: '2026-10-20T14:22:00.000Z',
    },
    {
      id: '11111111-1111-4111-8111-111111111103',
      name: 'Fajar Dev',
      stars: 5,
      comment: 'Bagian Under the Glass & arsip proyeknya solid. Sukses terus No_Data!',
      createdAt: '2026-10-22T18:40:00.000Z',
    },
  ],
};

export function getSupabaseConfig() {
  try {
    const rawUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!rawUrl || !key) return null;
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    return {
      url: parsed.origin,
      key: key.trim(),
    };
  } catch {
    return null;
  }
}

function supabaseHeaders(sb, extra = {}) {
  return {
    apikey: sb.key,
    Authorization: `Bearer ${sb.key}`,
    ...extra,
  };
}

export function getUpstashConfig() {
  try {
    const url = new URL(process.env.UPSTASH_REDIS_REST_URL || '');
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
    if (url.protocol === 'https:' && token) {
      return { url: url.href.replace(/\/$/, ''), token };
    }
  } catch {
    // Not configured
  }
  return null;
}

export async function upstashPipeline(config, commands) {
  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error('UPSTASH_ERROR');
  return response.json();
}

export function isFilesystemWritable() {
  try {
    if (process.env.VERCEL) return false;
    return existsSync(SITE_DATA_PATH);
  } catch {
    return false;
  }
}

export function getStorageMode() {
  if (getSupabaseConfig()) return 'supabase';
  if (getUpstashConfig()) return 'upstash';
  if (isFilesystemWritable()) return 'filesystem';
  return 'memory';
}

function syncLegacyFiles(data) {
  try {
    const profileOut = {
      name: data.identity.name,
      fullName: data.identity.fullName,
      brand: data.identity.brand,
      role: data.identity.role,
      location: data.identity.location,
      education: data.identity.education,
      device: data.journey?.deviceNote || 'Laptop Mandiri & Linux / OS',
      tagline: data.identity.heroDescription,
      about: data.about.lead,
      motivation: data.about.motivation,
      approach: data.about.approach,
      ethos: data.ethos.body,
      socials: data.footer.socials,
      anime: data.personal.anime,
      video: data.personal.video,
    };
    const contentOut = {
      COMMUNITIES: [],
      PEOPLE: [],
      ECOSYSTEM: data.ecosystem.groups,
      JOURNEY_STEPS: data.journey.steps,
      PROJECTS: data.archive.projects,
    };
    writeFileSync(PROFILE_PATH, JSON.stringify(profileOut, null, 2) + '\n');
    writeFileSync(CONTENT_PATH, JSON.stringify(contentOut, null, 2) + '\n');
  } catch {
    // Ignore on read-only serverless environments
  }
}

export function sanitizeSiteDataUrls(candidate) {
  if (!candidate || typeof candidate !== 'object') return candidate;

  if (candidate.identity) {
    if (candidate.identity.markImage) {
      candidate.identity.markImage = sanitizeUrl(candidate.identity.markImage, { allowDataImage: true });
    }
    if (candidate.identity.portraitImage) {
      candidate.identity.portraitImage = sanitizeUrl(candidate.identity.portraitImage, { allowDataImage: true });
    }
    if (candidate.identity.heroStack?.workImage) {
      candidate.identity.heroStack.workImage = sanitizeUrl(candidate.identity.heroStack.workImage, { allowDataImage: true });
    }
  }

  if (Array.isArray(candidate.archive?.projects)) {
    for (const p of candidate.archive.projects) {
      if (p.image) p.image = sanitizeUrl(p.image, { allowDataImage: true });
      if (p.link) p.link = sanitizeUrl(p.link);
    }
  }

  if (Array.isArray(candidate.personal?.anime)) {
    for (const a of candidate.personal.anime) {
      if (a.image) a.image = sanitizeUrl(a.image, { allowDataImage: true });
    }
  }
  if (candidate.personal?.royal?.image) {
    candidate.personal.royal.image = sanitizeUrl(candidate.personal.royal.image, { allowDataImage: true });
  }
  if (candidate.personal?.video) {
    if (candidate.personal.video.poster) {
      candidate.personal.video.poster = sanitizeUrl(candidate.personal.video.poster, { allowDataImage: true });
    }
    if (candidate.personal.video.src) {
      candidate.personal.video.src = sanitizeUrl(candidate.personal.video.src);
    }
  }

  if (Array.isArray(candidate.certificates?.items)) {
    for (const c of candidate.certificates.items) {
      if (c.image) c.image = sanitizeUrl(c.image, { allowDataImage: true });
      if (c.fallbackImage) c.fallbackImage = sanitizeUrl(c.fallbackImage, { allowDataImage: true });
      if (c.link) c.link = sanitizeUrl(c.link);
    }
  }

  if (Array.isArray(candidate.footer?.socials)) {
    for (const s of candidate.footer.socials) {
      if (s.url) s.url = sanitizeUrl(s.url);
    }
  }
  if (candidate.footer?.primaryContactUrl) {
    candidate.footer.primaryContactUrl = sanitizeUrl(candidate.footer.primaryContactUrl);
  }

  return candidate;
}

export function normalizeSiteData(candidate) {
  if (!candidate || typeof candidate !== 'object') return candidate;
  if (!candidate.certificates || !Array.isArray(candidate.certificates.items)) {
    candidate.certificates = structuredClone(INITIAL_SEED.certificates);
  }
  return sanitizeSiteDataUrls(candidate);
}

export function validateSiteData(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  if (!candidate.identity || typeof candidate.identity.name !== 'string') return false;
  if (!candidate.archive || !Array.isArray(candidate.archive.projects)) return false;
  if (!candidate.journey || !Array.isArray(candidate.journey.steps)) return false;
  if (!candidate.ecosystem || !Array.isArray(candidate.ecosystem.groups)) return false;
  if (!candidate.personal || !Array.isArray(candidate.personal.anime)) return false;
  if (candidate.certificates && !Array.isArray(candidate.certificates.items)) return false;
  if (!candidate.footer || !Array.isArray(candidate.footer.socials)) return false;
  return true;
}

export async function getSiteData() {
  const sb = getSupabaseConfig();
  if (sb) {
    try {
      const res = await fetch(`${sb.url}/rest/v1/site_cms?id=eq.main&select=data`, {
        headers: supabaseHeaders(sb, { Accept: 'application/json' }),
      });
      if (res.ok) {
        const rows = await res.json();
        const stored = rows?.[0]?.data;
        if (stored && typeof stored === 'object') {
          const normalized = normalizeSiteData(stored);
          if (validateSiteData(normalized)) {
            memorySiteData = normalized;
            return normalized;
          }
        } else if (Array.isArray(rows) && rows.length === 0) {
          // Seed initial data into Supabase automatically on first read
          await fetch(`${sb.url}/rest/v1/site_cms`, {
            method: 'POST',
            headers: supabaseHeaders(sb, {
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            }),
            body: JSON.stringify({ id: 'main', data: INITIAL_SEED, updated_at: new Date().toISOString() }),
          }).catch(() => {});
        }
      }
    } catch {
      // Fallback below
    }
  }

  const upstash = getUpstashConfig();
  if (upstash) {
    try {
      const res = await upstashPipeline(upstash, [['GET', CMS_REDIS_KEY]]);
      const raw = res?.[0]?.result;
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = normalizeSiteData(JSON.parse(raw));
        if (validateSiteData(parsed)) {
          memorySiteData = parsed;
          return parsed;
        }
      }
    } catch {
      // Fallback below
    }
  }

  if (isFilesystemWritable()) {
    try {
      const disk = normalizeSiteData(JSON.parse(readFileSync(SITE_DATA_PATH, 'utf8')));
      if (validateSiteData(disk)) {
        memorySiteData = disk;
        return disk;
      }
    } catch {
      // Fallback to memory
    }
  }

  return normalizeSiteData(memorySiteData);
}

export async function saveSiteData(nextData) {
  if (!validateSiteData(nextData)) {
    throw new Error('Struktur data situs tidak valid.');
  }
  const sanitized = normalizeSiteData(structuredClone(nextData));
  memorySiteData = sanitized;

  let persistedTo = 'memory';

  const sb = getSupabaseConfig();
  if (sb) {
    const res = await fetch(`${sb.url}/rest/v1/site_cms`, {
      method: 'POST',
      headers: supabaseHeaders(sb, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      }),
      body: JSON.stringify({
        id: 'main',
        data: sanitized,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      throw new Error('Gagal menyimpan ke Supabase Database. Pastikan tabel site_cms sudah dibuat.');
    }
    persistedTo = 'supabase';
  } else {
    const upstash = getUpstashConfig();
    if (upstash) {
      await upstashPipeline(upstash, [['SET', CMS_REDIS_KEY, JSON.stringify(sanitized)]]);
      persistedTo = 'upstash';
    }
  }

  if (isFilesystemWritable()) {
    try {
      writeFileSync(SITE_DATA_PATH, JSON.stringify(sanitized, null, 2) + '\n');
      syncLegacyFiles(sanitized);
      if (persistedTo === 'memory') persistedTo = 'filesystem';
    } catch {
      // Ignore if read-only
    }
  }

  return { data: memorySiteData, persistedTo };
}

export async function saveUploadedAsset({ filename = 'image.webp', dataUrl = '' }) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    throw new Error('Format gambar tidak valid.');
  }
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Data gambar base64 tidak valid.');
  }
  const declaredMime = match[1].toLowerCase();
  if (declaredMime === 'image/svg+xml' || declaredMime.includes('svg')) {
    throw new Error('Demi keamanan (anti-XSS), unggahan file SVG tidak diizinkan. Gunakan PNG, JPG, atau WebP.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > 4.5 * 1024 * 1024) {
    throw new Error('Ukuran gambar maksimal 4.5 MB.');
  }

  const verified = verifyImageMagicBytes(buffer);
  if (!verified) {
    throw new Error('Header biner gambar tidak valid. Gunakan file PNG, JPG, WebP, atau GIF asli.');
  }

  const safeSlug =
    String(filename)
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'asset';
  const finalName = `${Date.now()}-${safeSlug}.${verified.ext}`;

  const sb = getSupabaseConfig();
  if (sb) {
    try {
      // Ensure public bucket exists (idempotent if already created)
      await fetch(`${sb.url}/storage/v1/bucket`, {
        method: 'POST',
        headers: supabaseHeaders(sb, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: SUPABASE_BUCKET, name: SUPABASE_BUCKET, public: true }),
      }).catch(() => {});

      const upRes = await fetch(`${sb.url}/storage/v1/object/${SUPABASE_BUCKET}/${finalName}`, {
        method: 'POST',
        headers: supabaseHeaders(sb, {
          'Content-Type': verified.mime,
          'x-upsert': 'true',
        }),
        body: buffer,
      });
      if (upRes.ok) {
        return {
          url: `${sb.url}/storage/v1/object/public/${SUPABASE_BUCKET}/${finalName}`,
          mode: 'supabase',
        };
      }
    } catch {
      // Fallback below
    }
  }

  if (isFilesystemWritable()) {
    try {
      mkdirSync(UPLOADS_DIR, { recursive: true });
      writeFileSync(join(UPLOADS_DIR, finalName), buffer);
      return { url: `/images/uploads/${finalName}`, mode: 'filesystem' };
    } catch {
      // Fallback to inline dataUrl on read-only disk
    }
  }

  return {
    url: `data:${verified.mime};base64,${buffer.toString('base64')}`,
    mode: 'inline',
  };
}

export async function supabaseFetchReviews(sb) {
  const res = await fetch(
    `${sb.url}/rest/v1/visitor_reviews?select=id,name,stars,comment,created_at&order=created_at.desc&limit=50`,
    { headers: supabaseHeaders(sb, { Accept: 'application/json' }) }
  );
  if (!res.ok) throw new Error('SUPABASE_REVIEWS_READ_FAILED');
  const rows = await res.json();
  const reviews = (Array.isArray(rows) ? rows : []).map((r) => ({
    id: r.id,
    name: r.name,
    stars: Number(r.stars) || 5,
    comment: r.comment || '',
    createdAt: r.created_at,
  }));
  const count = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.stars, 0);
  return {
    reviews: reviews.slice(0, 20),
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
  };
}

export async function supabaseCreateReview(sb, record, voterHash) {
  // Prevent duplicate submission within 24 hours per client hash
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const dupCheck = await fetch(
    `${sb.url}/rest/v1/visitor_reviews?voter_hash=eq.${encodeURIComponent(voterHash)}&created_at=gte.${encodeURIComponent(sinceIso)}&select=id&limit=1`,
    { headers: supabaseHeaders(sb, { Accept: 'application/json' }) }
  );
  if (dupCheck.ok) {
    const existing = await dupCheck.json();
    if (Array.isArray(existing) && existing.length > 0) {
      return { duplicate: true };
    }
  }

  const ins = await fetch(`${sb.url}/rest/v1/visitor_reviews`, {
    method: 'POST',
    headers: supabaseHeaders(sb, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({
      id: record.id,
      name: record.name,
      stars: record.stars,
      comment: record.comment,
      voter_hash: voterHash,
      created_at: record.createdAt,
    }),
  });
  if (!ins.ok) throw new Error('SUPABASE_REVIEW_INSERT_FAILED');
  const stats = await supabaseFetchReviews(sb);
  return { duplicate: false, ...stats };
}

export async function supabaseRemoveReview(sb, reviewId) {
  const del = await fetch(`${sb.url}/rest/v1/visitor_reviews?id=eq.${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
    headers: supabaseHeaders(sb),
  });
  if (!del.ok) throw new Error('SUPABASE_REVIEW_DELETE_FAILED');
  return supabaseFetchReviews(sb);
}
