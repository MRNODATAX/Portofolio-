import { applyApiSecurityHeaders } from '../shared/security.mjs';
import { getStorageMode } from '../shared/store.mjs';
import { isGeminiConfigured, sanitizeGeminiModel } from '../shared/gemini.mjs';

export function activeAiProvider(env = process.env) {
  if (isGeminiConfigured(env)) return { provider: 'gemini', model: sanitizeGeminiModel(env.GEMINI_MODEL) };
  if (env.CHAT_API_KEY) return { provider: 'upstream', model: env.CHAT_MODEL || '' };
  if (env.CHAT_API_URL) return { provider: 'webhook', model: '' };
  return { provider: 'local', model: '' };
}

export default async function handler(_req, res) {
  applyApiSecurityHeaders(res);
  const ai = activeAiProvider(process.env);
  return res.status(200).json({
    ok: true,
    chatConfigured: true,
    ratingsConfigured: true,
    mode: getStorageMode(),
    aiProvider: ai.provider,
    aiModel: ai.model,
  });
}
