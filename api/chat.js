import { createHash } from 'node:crypto';
import { buildPortfolioSystemPrompt, answerLocally } from '../shared/knowledge.mjs';
import { askGemini, isGeminiConfigured } from '../shared/gemini.mjs';
import {
  applyApiSecurityHeaders,
  isCrossSiteRequest,
  isSafeExternalUpstreamUrl,
  parseJsonBody,
} from '../shared/security.mjs';
import { getSiteData } from '../shared/store.mjs';

const buckets = new Map();
const MAX_MESSAGES = 8;
const MAX_MESSAGE = 1200;
const MAX_BODY = 20000;

export function validateMessages(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages) || !body.messages.length || body.messages.length > MAX_MESSAGES) {
    return null;
  }
  const cleaned = [];
  for (const message of body.messages) {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null;
    const text = message.content.trim();
    if (!text || text.length > MAX_MESSAGE) return null;
    if (cleaned.length && cleaned.at(-1).role === message.role) return null;
    cleaned.push({ role: message.role, content: text });
  }
  return cleaned.at(-1)?.role === 'user' ? cleaned : null;
}

export function extractAnswer(body) {
  if (!body || typeof body !== 'object' || body.error || body.success === false || body.status === false || (typeof body.status === 'number' && body.status >= 400)) {
    return '';
  }
  const paths = [
    body.text,
    body.response,
    body.result?.text,
    body.result?.response,
    body.result?.answer,
    body.result?.content,
    body.result,
    body.data?.text,
    body.data?.response,
    body.data?.answer,
    body.data?.result,
    body.data?.content,
    body.data,
    body.answer,
    body.content,
    body.choices?.[0]?.message?.content,
  ];
  const geminiText = Array.isArray(body.candidates)
    ? body.candidates
        .map((c) => (Array.isArray(c?.content?.parts) ? c.content.parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('') : ''))
        .join('')
        .trim()
    : '';

  const answer = paths.find((x) => typeof x === 'string' && x.trim()) || (geminiText ? geminiText : '');
  if (!answer || /<!doctype|<html[\s>]/i.test(answer)) return '';
  return answer.trim().slice(0, 12000);
}

function limited(ip, now) {
  if (buckets.size > 2000) {
    for (const [key, item] of buckets) if (item.until < now) buckets.delete(key);
    if (buckets.size > 2000) buckets.delete(buckets.keys().next().value);
  }
  const key = createHash('sha256').update(ip).digest('hex');
  const item = buckets.get(key);
  if (!item || item.until < now) {
    buckets.set(key, { count: 1, until: now + 60000 });
    return false;
  }
  item.count++;
  return item.count > 12;
}

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Gunakan POST untuk percakapan.' });
  }

  if (isCrossSiteRequest(req)) {
    return res.status(403).json({ error: 'Permintaan lintas-situs ditolak.' });
  }

  const parsed = parseJsonBody(req, MAX_BODY);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const messages = validateMessages(parsed.data);
  if (!messages) {
    return res.status(400).json({ error: 'Pesan tidak valid. Maksimum 1.200 karakter per pesan.' });
  }

  const ip = String(req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-real-ip'] || req.headers?.['x-forwarded-for']?.split(',')[0] || req.ip || 'anonymous');
  if (limited(ip, Date.now())) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Terlalu banyak pesan. Tunggu sekitar satu menit.' });
  }

  try {
    const siteData = await getSiteData();
    const systemPrompt = buildPortfolioSystemPrompt(siteData);
    const latestUserMessage = messages.at(-1).content;

    // 1) Google Gemini (native) — aktif cukup dengan mengisi GEMINI_API_KEY.
    if (isGeminiConfigured(process.env)) {
      const gemini = await askGemini(systemPrompt, messages);
      if (gemini.text) return res.status(200).json({ text: gemini.text, provider: 'gemini', model: gemini.model });
    }

    // 2) Provider OpenAI-compatible (OpenAI / Groq / OpenRouter / Ollama / Gemini compat layer).
    if (process.env.CHAT_API_KEY) {
      const apiUrl = process.env.CHAT_API_URL || 'https://api.openai.com/v1/chat/completions';
      if (isSafeExternalUpstreamUrl(apiUrl)) {
        const model = process.env.CHAT_MODEL || 'gpt-4o-mini';
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 18000);
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.CHAT_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              temperature: 0.45,
              max_tokens: 420,
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
              ],
            }),
            signal: abort.signal,
          });
          const data = await response.json().catch(() => ({}));
          const text = extractAnswer(data);
          if (response.ok && text) return res.status(200).json({ text, provider: 'upstream', model });
        } catch {
          // Fallback below
        } finally {
          clearTimeout(timer);
        }
      }
    }

    if (process.env.CHAT_API_URL && !process.env.CHAT_API_KEY && isSafeExternalUpstreamUrl(process.env.CHAT_API_URL)) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 14000);
      try {
        const upstream = new URL(process.env.CHAT_API_URL);
        const transcript = messages.map((m) => `${m.role === 'user' ? 'Pengunjung' : 'Relay'}: ${m.content}`).join('\n\n');
        upstream.searchParams.set('text', `${systemPrompt}\n\nRIWAYAT PERCAKAPAN:\n${transcript}\n\nRelay:`);
        const response = await fetch(upstream, { method: 'GET', headers: { Accept: 'application/json' }, signal: abort.signal });
        const data = await response.json().catch(() => ({}));
        const text = extractAnswer(data);
        if (response.ok && text) return res.status(200).json({ text, provider: 'webhook' });
      } catch {
        // Fallback below
      } finally {
        clearTimeout(timer);
      }
    }

    // 4) Tanpa API key apa pun → basis pengetahuan portofolio bawaan (tetap berjalan 100%).
    const fallbackText = answerLocally(latestUserMessage, siteData);
    return res.status(200).json({ text: fallbackText, provider: 'local' });
  } catch {
    return res.status(500).json({ error: 'Relay sedang tidak dapat merespons. Coba beberapa saat lagi.' });
  }
}
