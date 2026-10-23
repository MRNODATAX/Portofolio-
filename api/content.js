import { requireAdminAuth } from '../shared/auth.mjs';
import { applyApiSecurityHeaders, isCrossSiteRequest, parseJsonBody } from '../shared/security.mjs';
import { getSiteData, getStorageMode, saveSiteData, saveUploadedAsset } from '../shared/store.mjs';

const MAX_CMS_BODY_BYTES = 56 * 1024 * 1024; // base64 payload: images + (locally) video uploads.
// Catatan: Vercel membatasi body serverless di ~4.5 MB, sehingga batas efektif di produksi
// dijaga ulang oleh saveUploadedAsset() di shared/store.mjs (video > 4 MB disarankan via URL).

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method === 'GET') {
    try {
      const data = await getSiteData();
      return res.status(200).json({ ok: true, data, storageMode: getStorageMode() });
    } catch {
      return res.status(500).json({ error: 'Gagal memuat konten situs.' });
    }
  }

  if (req.method !== 'POST' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Metode tidak didukung.' });
  }

  if (isCrossSiteRequest(req)) {
    return res.status(403).json({ error: 'Permintaan lintas-situs (cross-site) ditolak.' });
  }

  if (!requireAdminAuth(req)) {
    return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah berakhir. Silakan login kembali.' });
  }

  const parsed = parseJsonBody(req, MAX_CMS_BODY_BYTES);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  try {
    const body = parsed.data;
    const action = body.action || 'save';

    if (action === 'upload') {
      const uploaded = await saveUploadedAsset({
        filename: body.filename,
        mimeType: body.mimeType,
        dataUrl: body.dataUrl,
      });
      return res.status(200).json({ ok: true, ...uploaded });
    }

    if (action === 'save') {
      const result = await saveSiteData(body.data);
      return res.status(200).json({ ok: true, ...result });
    }

    return res.status(400).json({ error: 'Aksi tidak dikenali.' });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : 'Gagal menyimpan perubahan.',
    });
  }
}
