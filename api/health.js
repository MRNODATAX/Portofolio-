import { applyApiSecurityHeaders } from '../shared/security.mjs';
import { getStorageMode, supabaseDiagnostics } from '../shared/store.mjs';
import { isGeminiConfigured, sanitizeGeminiModel } from '../shared/gemini.mjs';
import { getSecretStatus } from '../shared/secrets.mjs';

export function activeAiProvider(env = process.env) {
  if (isGeminiConfigured(env)) return { provider: 'gemini', model: sanitizeGeminiModel(env.GEMINI_MODEL), source: 'env' };
  if (env.CHAT_API_KEY) return { provider: 'upstream', model: env.CHAT_MODEL || '', source: 'env' };
  if (env.CHAT_API_URL) return { provider: 'webhook', model: '', source: 'env' };
  return { provider: 'local', model: '', source: 'none' };
}

export default async function handler(_req, res) {
  applyApiSecurityHeaders(res);
  const ai = activeAiProvider(process.env);
  const db = await supabaseDiagnostics();

  // Bila belum ada key di env, cek brankas yang diisi admin (hanya status, bukan isinya).
  let provider = ai.provider;
  let source = ai.source;
  let configured = ai.provider !== 'local';
  if (ai.provider === 'local') {
    try {
      const status = await getSecretStatus('geminiApiKey');
      if (status.configured) {
        provider = 'gemini';
        source = status.source || 'admin';
        configured = true;
      }
    } catch {
      // Biarkan tetap lokal bila brankas gagal dibaca.
    }
  }

  return res.status(200).json({
    ok: true,
    chatConfigured: true,
    ratingsConfigured: true,
    mode: db.mode || getStorageMode(),
    db,
    aiProvider: provider,
    aiModel: ai.model,
    aiSource: source,
    aiKeyConfigured: configured,
  });
}
