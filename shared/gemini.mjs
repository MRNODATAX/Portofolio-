/**
 * Integrasi Google Gemini untuk Relay (Personal AI) — murni server-side.
 *
 * API key TIDAK pernah dikirim ke browser: helper ini hanya dipanggil dari
 * Vercel Serverless Function (/api/chat). Jangan pernah menambahkan prefix
 * `VITE_` pada variabel GEMINI_* karena itu akan membundel key ke dalam JS publik.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Model default & daftar cadangan bila nama model berubah / tidak tersedia di region.
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const FALLBACK_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest'];

const MODEL_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/** Sanitasi nama model supaya tidak bisa dipakai untuk menyusup ke path URL. */
export function sanitizeGeminiModel(raw) {
  const value = String(raw || '').trim();
  if (!value) return DEFAULT_GEMINI_MODEL;
  if (value.includes('/') || value.includes('..') || !MODEL_PATTERN.test(value)) return DEFAULT_GEMINI_MODEL;
  return value;
}

export function isGeminiConfigured(env = process.env) {
  return typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim().length > 0;
}

/** Daftar model yang dicoba berurutan: yang dikonfigurasi dulu, lalu cadangan. */
export function geminiModelCandidates(env = process.env) {
  const primary = sanitizeGeminiModel(env.GEMINI_MODEL);
  return [primary, ...FALLBACK_GEMINI_MODELS.filter((m) => m !== primary)];
}

export function geminiEndpoint(model) {
  return `${GEMINI_BASE}/${sanitizeGeminiModel(model)}:generateContent`;
}

/**
 * Menyusun request ke Gemini `generateContent`.
 * Riwayat percakapan dipetakan: `user` → `user`, `assistant` → `model`.
 */
export function buildGeminiRequest(systemPrompt, messages, { model = DEFAULT_GEMINI_MODEL, apiKey = '', signal } = {}) {
  const contents = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content.slice(0, 1200) }],
    }));

  return {
    url: geminiEndpoint(model),
    init: {
      method: 'POST',
      // Key dikirim lewat header, bukan query string, agar tidak ikut tercatat di log URL.
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: String(systemPrompt || '').slice(0, 20000) }] },
        contents,
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 700,
          topP: 0.9,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
      ...(signal ? { signal } : {}),
    },
  };
}

/** Mengambil teks jawaban dari berbagai bentuk respons Gemini. */
export function extractGeminiText(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;
    const text = parts
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim();
    if (text) return text;
  }

  if (typeof payload.text === 'string' && payload.text.trim()) return payload.text.trim();

  // Respons yang diblokir oleh safety filter tidak punya kandidat teks.
  const blockReason = candidates[0]?.finishReason || payload?.promptFeedback?.blockReason;
  if (blockReason && blockReason !== 'STOP') return '';
  return '';
}

/**
 * Menjalankan satu panggilan ke Gemini. Mengembalikan teks jawaban atau string kosong
 * bila gagal (supaya pemanggil bisa jatuh ke pengetahuan lokal).
 */
export async function askGemini(systemPrompt, messages, { env = process.env, timeoutMs = 18000, fetchImpl, apiKey } = {}) {
  const key = String(apiKey || '').trim() || (isGeminiConfigured(env) ? env.GEMINI_API_KEY.trim() : '');
  if (!key) return { text: '', model: '' };

  const doFetch = fetchImpl || globalThis.fetch;
  const models = geminiModelCandidates(env);

  for (const model of models) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const { url, init } = buildGeminiRequest(systemPrompt, messages, { model, apiKey: key, signal: abort.signal });
      const response = await doFetch(url, init);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Model tidak dikenal → coba nama model cadangan berikutnya.
        if (response.status === 404 || response.status === 400) continue;
        continue;
      }
      const text = extractGeminiText(payload);
      if (text) return { text, model };
    } catch {
      // Timeout / jaringan → coba model berikutnya, lalu fallback di pemanggil.
    } finally {
      clearTimeout(timer);
    }
  }

  return { text: '', model: '' };
}
