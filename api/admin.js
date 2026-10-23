import {
  authenticateAndIssueToken,
  checkLoginRateLimit,
  clearLoginFailures,
  isUsingDefaultPassword,
  recordLoginFailure,
  requireAdminAuth,
} from '../shared/auth.mjs';
import { applyApiSecurityHeaders, isCrossSiteRequest, parseJsonBody } from '../shared/security.mjs';
import {
  getStorageMode,
  getSupabaseConfig,
  getUpstashConfig,
  memoryRatingsStore,
  supabaseRemoveReview,
  upstashPipeline,
} from '../shared/store.mjs';

const RATINGS_PREFIX = 'nodata:{ratings}:v27:';

function clientIp(req) {
  return String(
    req.headers?.['x-vercel-forwarded-for'] ||
      req.headers?.['x-real-ip'] ||
      req.headers?.['x-forwarded-for'] ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown'
  )
    .split(',')[0]
    .trim()
    .slice(0, 128);
}

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method === 'GET') {
    const authenticated = requireAdminAuth(req);
    return res.status(200).json({
      ok: true,
      authenticated,
      usingDefaultPassword: isUsingDefaultPassword(),
      storageMode: getStorageMode(),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Metode tidak didukung.' });
  }

  if (isCrossSiteRequest(req)) {
    return res.status(403).json({ error: 'Permintaan lintas-situs (cross-site) ditolak.' });
  }

  const parsed = parseJsonBody(req, 16384);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }
  const body = parsed.data;
  const action = body.action || 'login';

  if (action === 'login') {
    const ip = clientIp(req);
    const rate = checkLoginRateLimit(ip);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({
        error: `Terlalu banyak percobaan login gagal. Coba lagi dalam ${Math.ceil(rate.retryAfterSec / 60)} menit.`,
      });
    }

    const session = authenticateAndIssueToken(body.password);
    if (!session) {
      recordLoginFailure(ip);
      return res.status(401).json({ error: 'Password admin salah.' });
    }

    clearLoginFailures(ip);
    return res.status(200).json({
      ok: true,
      ...session,
      storageMode: getStorageMode(),
      usingDefaultPassword: isUsingDefaultPassword(),
    });
  }

  if (!requireAdminAuth(req)) {
    return res.status(401).json({ error: 'Sesi admin tidak valid.' });
  }

  if (action === 'delete-review') {
    const reviewId = String(body.id || '').trim();
    if (!reviewId || reviewId.length > 80) {
      return res.status(400).json({ error: 'ID komentar tidak valid.' });
    }

    const sb = getSupabaseConfig();
    if (sb) {
      try {
        const stats = await supabaseRemoveReview(sb, reviewId);
        return res.status(200).json({ ok: true, ...stats });
      } catch {
        // Fallback below
      }
    }

    const upstash = getUpstashConfig();
    if (upstash) {
      try {
        const resList = await upstashPipeline(upstash, [['LRANGE', `${RATINGS_PREFIX}reviews`, '0', '99']]);
        const rawList = Array.isArray(resList?.[0]?.result) ? resList[0].result : [];
        const parsedList = rawList
          .map((r) => {
            try {
              return JSON.parse(r);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        const remaining = parsedList.filter((r) => r.id !== reviewId);
        const newSum = remaining.reduce((acc, r) => acc + (Number(r.stars) || 0), 0);
        const newCount = remaining.length;

        const cmds = [
          ['DEL', `${RATINGS_PREFIX}reviews`],
          ['HSET', `${RATINGS_PREFIX}summary`, 'sum', String(newSum), 'count', String(newCount)],
        ];
        if (remaining.length) {
          cmds.push(['RPUSH', `${RATINGS_PREFIX}reviews`, ...remaining.map((r) => JSON.stringify(r))]);
        }
        await upstashPipeline(upstash, cmds);
        return res.status(200).json({
          ok: true,
          reviews: remaining,
          count: newCount,
          average: newCount ? Math.round((newSum / newCount) * 10) / 10 : 0,
        });
      } catch {
        // Fallback below
      }
    }

    const idx = memoryRatingsStore.reviews.findIndex((r) => r.id === reviewId);
    if (idx !== -1) {
      const [removed] = memoryRatingsStore.reviews.splice(idx, 1);
      memoryRatingsStore.sum = Math.max(0, memoryRatingsStore.sum - (Number(removed.stars) || 0));
      memoryRatingsStore.count = Math.max(0, memoryRatingsStore.count - 1);
    }
    return res.status(200).json({
      ok: true,
      reviews: memoryRatingsStore.reviews,
      count: memoryRatingsStore.count,
      average: memoryRatingsStore.count ? Math.round((memoryRatingsStore.sum / memoryRatingsStore.count) * 10) / 10 : 0,
    });
  }

  return res.status(400).json({ error: 'Aksi admin tidak dikenali.' });
}
