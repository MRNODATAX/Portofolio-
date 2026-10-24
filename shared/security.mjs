const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function stripPrototypePollution(value, depth = 0) {
  if (depth > 16 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripPrototypePollution(item, depth + 1));
  }
  const clean = {};
  for (const [key, val] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    clean[key] = stripPrototypePollution(val, depth + 1);
  }
  return clean;
}

export function parseJsonBody(req, maxBytes = 65536) {
  const raw = req?.body;
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, data: {} };
  }
  if (typeof raw === 'string' || Buffer.isBuffer(raw)) {
    const byteLen = Buffer.isBuffer(raw) ? raw.byteLength : Buffer.byteLength(raw, 'utf8');
    if (byteLen > maxBytes) {
      return { ok: false, status: 413, error: 'Ukuran payload melebihi batas maksimum.' };
    }
    try {
      const parsed = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, status: 400, error: 'Payload JSON harus berupa objek.' };
      }
      return { ok: true, data: stripPrototypePollution(parsed) };
    } catch {
      return { ok: false, status: 400, error: 'Format JSON tidak valid.' };
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const serialized = JSON.stringify(raw);
    if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
      return { ok: false, status: 413, error: 'Ukuran payload melebihi batas maksimum.' };
    }
    return { ok: true, data: stripPrototypePollution(raw) };
  }
  return { ok: false, status: 400, error: 'Format permintaan tidak dikenali.' };
}

export function applyApiSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

export function isCrossSiteRequest(req) {
  const secFetchSite = String(req.headers?.['sec-fetch-site'] || '').toLowerCase();
  if (secFetchSite === 'cross-site') return true;

  const origin = req.headers?.origin;
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (origin && host) {
    try {
      const originHost = new URL(String(origin)).host.toLowerCase();
      const targetHost = String(host).split(',')[0].trim().toLowerCase();
      if (originHost && targetHost && originHost !== targetHost) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

export function sanitizeUrl(raw, { allowDataImage = false, allowDataVideo = false } = {}) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (CONTROL_CHARS.test(trimmed)) return '';

  if (allowDataImage && /^data:image\/(webp|png|jpeg|jpg|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  if (allowDataVideo && /^data:video\/(mp4|webm);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const proto = parsed.protocol.toLowerCase();
    if (proto === 'https:' || proto === 'http:' || proto === 'mailto:' || proto === 'tel:') {
      return trimmed;
    }
  } catch {
    return '';
  }
  return '';
}

export function verifyImageMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  // GIF87a / GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { mime: 'image/gif', ext: 'gif' };
  }

  return null;
}

export function verifyVideoMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength < 12) return null;

  // MP4 / ISO Base Media File Format: bytes 4..7 === 'ftyp' (66 74 79 70)
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return { mime: 'video/mp4', ext: 'mp4' };
  }

  // WebM / Matroska EBML header: 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { mime: 'video/webm', ext: 'webm' };
  }

  return null;
}

/**
 * Memverifikasi bahwa buffer benar-benar berkas audio (bukan file lain yang
 * diganti ekstensinya). Dipakai sebelum berkas backsound disimpan ke Storage.
 */
export function verifyAudioMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength < 12) return null;

  // MP3 dengan tag ID3v2: "ID3" (49 44 33)
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return { mime: 'audio/mpeg', ext: 'mp3' };
  }

  // MP3 tanpa tag: frame sync 11 bit (FF Ex/E6/E8/EA/F2/F6/F8/FA/FB/…)
  if (
    buffer[0] === 0xff &&
    (buffer[1] === 0xfb || buffer[1] === 0xf3 || buffer[1] === 0xf2 || buffer[1] === 0xfa || buffer[1] === 0xe3)
  ) {
    return { mime: 'audio/mpeg', ext: 'mp3' };
  }

  // MP4 / M4A: bytes 4..7 === 'ftyp' (66 74 79 70)
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return { mime: 'audio/mp4', ext: 'm4a' };
  }

  // Ogg (OggS): 4F 67 67 53
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return { mime: 'audio/ogg', ext: 'ogg' };
  }

  // WAV: RIFF....WAVE
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x41 &&
    buffer[10] === 0x56 &&
    buffer[11] === 0x45
  ) {
    return { mime: 'audio/wav', ext: 'wav' };
  }

  // FLAC: "fLaC" (66 4C 61 43)
  if (buffer[0] === 0x66 && buffer[1] === 0x4c && buffer[2] === 0x61 && buffer[3] === 0x43) {
    return { mime: 'audio/flac', ext: 'flac' };
  }

  return null;
}

export function isSafeExternalUpstreamUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl));
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
