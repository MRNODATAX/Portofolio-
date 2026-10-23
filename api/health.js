import { applyApiSecurityHeaders } from '../shared/security.mjs';
import { getStorageMode } from '../shared/store.mjs';

export default async function handler(_req, res) {
  applyApiSecurityHeaders(res);
  return res.status(200).json({
    ok: true,
    chatConfigured: true,
    ratingsConfigured: true,
    mode: getStorageMode(),
  });
}
