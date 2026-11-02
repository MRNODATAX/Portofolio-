/**
 * Penanganan tautan yang diketik sendiri oleh admin di /admin.
 *
 * Masalah yang dipecahkan: bila admin mengetik `namadomain.com` (tanpa
 * `https://`), browser menganggapnya tautan relatif. Klik pada tautan itu
 * berujung ke `https://situs-anda/namadomain.com` → pengunjung dilempar
 * kembali ke halaman awal, bukan ke situs tujuan.
 *
 * Fungsi di bawah melengkapi skema yang hilang, menolak protokol berbahaya
 * (`javascript:`, `data:`, …), dan mengembalikan tautan yang sudah benar.
 */

const PROTOKOL_DIIZINKAN = new Set(['http:', 'https:', 'mailto:', 'tel:']);

// Pola domain: satu atau lebih label yang dipisah titik, bisa diikuti port/path/query.
const POLA_DOMAIN = /^(?:[\w-]+\.)+[a-z]{2,}(?:[:/?#]|$)/i;
const POLA_LOKAL = /^localhost(?::\d+)?(?:[/?#]|$)/i;
const POLA_SKEMA = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Menormalkan tautan. Mengembalikan '' bila nilai kosong atau tidak dikenali
 * sebagai tautan yang aman.
 */
export function normalizeUrl(nilai: unknown): string {
  if (typeof nilai !== 'string') return '';
  let teks = nilai.trim();
  if (!teks) return '';

  // Tautan internal (anchor & path) dipakai apa adanya.
  if (teks.startsWith('#')) return teks;
  if (teks.startsWith('/') && !teks.startsWith('//')) return teks;

  // Tautan protokol-relatif: //host/path → https://host/path
  if (teks.startsWith('//')) teks = `https:${teks}`;

  // Tidak punya skema: lengkapi otomatis bila bentuknya domain.
  if (!POLA_SKEMA.test(teks)) {
    if (!POLA_DOMAIN.test(teks) && !POLA_LOKAL.test(teks)) return '';
    teks = `https://${teks}`;
  }

  try {
    const url = new URL(teks);
    if (!PROTOKOL_DIIZINKAN.has(url.protocol.toLowerCase())) return '';
    return url.href;
  } catch {
    return '';
  }
}

/** Aman dipakai langsung sebagai `href`. Tidak pernah menghasilkan tautan relatif. */
export function safeHref(nilai: unknown, cadangan = '#'): string {
  return normalizeUrl(nilai) || cadangan;
}

/** Apakah nilai bisa dipakai sebagai tautan yang valid & aman. */
export function isValidUrl(nilai: unknown): boolean {
  return normalizeUrl(nilai) !== '';
}
