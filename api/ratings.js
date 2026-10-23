import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { applyApiSecurityHeaders, isCrossSiteRequest, parseJsonBody } from '../shared/security.mjs';
import {
  getSupabaseConfig,
  getUpstashConfig,
  memoryRatingsStore,
  supabaseCreateReview,
  supabaseFetchReviews,
  upstashPipeline,
} from '../shared/store.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const PREFIX = 'nodata:{ratings}:v27:';

const hmac = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');

function getChallengeSecret(sb, upstash) {
  return (
    process.env.RATING_HASH_SALT ||
    process.env.ADMIN_SECRET ||
    sb?.key ||
    upstash?.token ||
    'nodata-ratings-challenge-secret-v27'
  );
}

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

export function signChallenge(secret, ip, client, now) {
  const data = `${now}.${randomUUID()}`;
  return `${data}.${hmac(secret, `${ip}|${client}|${data}`)}`;
}

export function validChallenge(token, secret, ip, client, now) {
  if (typeof token !== 'string' || token.length > 180) return false;
  const [timestamp, nonce, signature, ...extra] = token.split('.');
  const age = now - Number(timestamp);
  if (
    extra.length ||
    !UUID.test(nonce || '') ||
    !/^\d{13}$/.test(timestamp || '') ||
    !/^[0-9a-f]{64}$/.test(signature || '') ||
    age < -5000 ||
    age > 3600000
  ) {
    return false;
  }
  const expected = Buffer.from(hmac(secret, `${ip}|${client}|${timestamp}.${nonce}`), 'hex');
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export function validateRating(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const optionalComment = body.comment ?? '';
  if (
    typeof body.name !== 'string' ||
    typeof optionalComment !== 'string' ||
    !Number.isInteger(body.stars) ||
    body.stars < 1 ||
    body.stars > 5
  ) {
    return null;
  }
  const name = body.name.normalize('NFC').trim().replace(/\s+/g, ' ');
  const comment = optionalComment.normalize('NFC').trim();
  if (
    !name ||
    name.length > 50 ||
    comment.length > 600 ||
    CONTROL.test(name + comment) ||
    !UUID.test(body.client || '') ||
    !UUID.test(body.requestId || '') ||
    typeof body.challenge !== 'string'
  ) {
    return null;
  }
  // Honeypot anti-bot field
  if (typeof body.website === 'string' && body.website !== '') return null;
  return {
    name,
    comment,
    stars: body.stars,
    client: body.client.toLowerCase(),
    requestId: body.requestId.toLowerCase(),
    challenge: body.challenge,
  };
}

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Metode tidak didukung.' });
  }

  const sb = getSupabaseConfig();
  const upstash = getUpstashConfig();
  const secret = getChallengeSecret(sb, upstash);
  const ipHash = hmac(secret, clientIp(req));
  const now = Date.now();

  if (req.method === 'GET') {
    const query = new URL(req.url || '/api/ratings', 'http://localhost').searchParams;
    const client = String(req.query?.client || query.get('client') || '').toLowerCase();
    const challenge = UUID.test(client)
      ? signChallenge(secret, ipHash, client, now)
      : signChallenge(secret, ipHash, '00000000-0000-4000-8000-000000000000', now);

    if (sb) {
      try {
        const stats = await supabaseFetchReviews(sb);
        return res.status(200).json({
          configured: true,
          ...stats,
          challenge,
        });
      } catch {
        // Fallback below
      }
    }

    if (upstash) {
      try {
        const results = await upstashPipeline(upstash, [
          ['HGET', `${PREFIX}summary`, 'sum'],
          ['HGET', `${PREFIX}summary`, 'count'],
          ['LRANGE', `${PREFIX}reviews`, '0', '19'],
        ]);
        const sum = Number(results?.[0]?.result || 0);
        const count = Number(results?.[1]?.result || 0);
        const rawReviews = Array.isArray(results?.[2]?.result) ? results[2].result : [];
        const reviews = rawReviews
          .map((item) => {
            try {
              return JSON.parse(item);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        return res.status(200).json({
          configured: true,
          count,
          average: count ? Math.round((sum / count) * 10) / 10 : 0,
          reviews,
          challenge,
        });
      } catch {
        // Fallback below
      }
    }

    return res.status(200).json({
      configured: true,
      count: memoryRatingsStore.count,
      average: memoryRatingsStore.count ? Math.round((memoryRatingsStore.sum / memoryRatingsStore.count) * 10) / 10 : 0,
      reviews: memoryRatingsStore.reviews.slice(0, 20),
      challenge,
    });
  }

  if (isCrossSiteRequest(req)) {
    return res.status(403).json({ error: 'Permintaan tidak diizinkan.' });
  }

  const parsed = parseJsonBody(req, 8192);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const rating = validateRating(parsed.data);
  if (!rating) {
    return res.status(400).json({ error: 'Isi nama, pilih 1–5 bintang, dan batasi komentar hingga 600 karakter.' });
  }

  if (!validChallenge(rating.challenge, secret, ipHash, rating.client, now)) {
    return res.status(409).json({ code: 'REFRESH', error: 'Sesi rating berakhir. Muat ulang rating lalu kirim lagi.' });
  }

  const record = {
    id: rating.requestId,
    name: rating.name,
    stars: rating.stars,
    comment: rating.comment,
    createdAt: new Date(now).toISOString(),
  };
  const voterHash = hmac(secret, `${ipHash}:${rating.client}`);

  if (sb) {
    try {
      const outcome = await supabaseCreateReview(sb, record, voterHash);
      if (outcome.duplicate) {
        return res.status(429).json({ error: 'Perangkat ini sudah mengirim kesan hari ini.' });
      }
      return res.status(200).json({
        accepted: true,
        review: record,
        count: outcome.count,
        average: outcome.average,
      });
    } catch {
      // Fallback below
    }
  }

  if (upstash) {
    try {
      const voterKey = `${PREFIX}voter:${voterHash}`;
      const check = await upstashPipeline(upstash, [['SET', voterKey, '1', 'NX', 'EX', '86400']]);
      if (check?.[0]?.result !== 'OK') {
        return res.status(429).json({ error: 'Perangkat ini sudah mengirim kesan hari ini.' });
      }
      const results = await upstashPipeline(upstash, [
        ['HINCRBY', `${PREFIX}summary`, 'sum', String(rating.stars)],
        ['HINCRBY', `${PREFIX}summary`, 'count', '1'],
        ['LPUSH', `${PREFIX}reviews`, JSON.stringify(record)],
        ['LTRIM', `${PREFIX}reviews`, '0', '99'],
      ]);
      const sum = Number(results?.[0]?.result || rating.stars);
      const count = Number(results?.[1]?.result || 1);
      return res.status(200).json({
        accepted: true,
        review: record,
        count,
        average: Math.round((sum / count) * 10) / 10,
      });
    } catch {
      // Fallback below
    }
  }

  if (memoryRatingsStore.clients.has(rating.client)) {
    return res.status(429).json({ error: 'Perangkat ini sudah mengirim kesan baru-baru ini.' });
  }

  memoryRatingsStore.clients.add(rating.client);
  memoryRatingsStore.sum += rating.stars;
  memoryRatingsStore.count += 1;
  memoryRatingsStore.reviews.unshift(record);

  return res.status(200).json({
    accepted: true,
    review: record,
    count: memoryRatingsStore.count,
    average: Math.round((memoryRatingsStore.sum / memoryRatingsStore.count) * 10) / 10,
  });
}
