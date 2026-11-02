import { requireAdminAuth } from '../shared/auth.mjs';
import { applyApiSecurityHeaders, isCrossSiteRequest, parseJsonBody } from '../shared/security.mjs';
import {
  auditUploadedAssets,
  deleteUploadedAssets,
  getStorageMode,
} from '../shared/store.mjs';

/**
 * Inventaris & pembersihan berkas unggahan (bucket `portfolio-assets`).
 *
 * POST /api/assets  (butuh sesi admin)
 *   { action: 'report' }               → laporan saja, tidak menghapus apa pun
 *   { action: 'sweep' }                → hapus berkas yang tidak direferensikan lagi
 *   { action: 'delete', urls: [...] }  → hapus berkas tertentu
 */
export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak didukung.' });
  }

  if (isCrossSiteRequest(req)) {
    return res.status(403).json({ error: 'Permintaan lintas-situs (cross-site) ditolak.' });
  }

  if (!requireAdminAuth(req)) {
    return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir. Silakan login kembali.' });
  }

  const parsed = parseJsonBody(req, 16384);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const body = parsed.data || {};
  const aksi = body.action || 'report';

  try {
    if (aksi === 'delete') {
      const urls = Array.isArray(body.urls) ? body.urls : [];
      if (!urls.length) return res.status(400).json({ error: 'Daftar berkas kosong.' });
      const hasil = await deleteUploadedAssets(urls);
      return res.status(200).json({ ok: true, storageMode: getStorageMode(), ...hasil });
    }

    if (aksi === 'sweep' || aksi === 'report') {
      const hasil = await auditUploadedAssets({ dryRun: aksi === 'report' });
      return res.status(200).json({ ok: true, storageMode: getStorageMode(), ...hasil });
    }

    return res.status(400).json({ error: 'Aksi tidak dikenali.' });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal memeriksa penyimpanan berkas.',
    });
  }
}
