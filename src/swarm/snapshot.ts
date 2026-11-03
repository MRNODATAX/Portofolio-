import type { ItemKind, SwarmItem } from './types';

/**
 * "Pemindai" mini khusus Hero.
 *
 * Versi spike ini tidak memindai seluruh halaman seperti repo referensi —
 * cukup mengukur elemen hero yang sudah kita tentukan, lalu mengubahnya
 * menjadi blueprint kotak & teks yang bisa digambar ulang kursor.
 */

const TARGET: { sel: string; kind: ItemKind; ketik?: boolean }[] = [
  { sel: '.hero-eyebrow', kind: 'pill' },
  { sel: '.hero-copy h1', kind: 'text', ketik: true },
  { sel: '.hero-description', kind: 'text', ketik: true },
  { sel: '.hero-cta .button', kind: 'button' },
  { sel: '.hero-cta .text-link', kind: 'text' },
  { sel: '.hero-inventory a', kind: 'pill' },
  { sel: '.hero-identity', kind: 'text' },
  { sel: '.portrait-assembly', kind: 'box' },
  { sel: '.portrait-exploring', kind: 'pill', ketik: true },
  { sel: '.portrait-location', kind: 'pill' },
  { sel: '.stack-controls', kind: 'box' },
  { sel: '.hero-universe-note', kind: 'text' },
  { sel: '.scroll-note', kind: 'text' },
  { sel: '.hero-corner', kind: 'text' },
];

const MAKS_ITEM = 26;

function teksDari(el: Element): string {
  let hasil = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      hasil += node.textContent || '';
    } else if (node instanceof HTMLBRElement) {
      hasil += '\n';
    } else if (node instanceof HTMLElement) {
      if (node.classList.contains('sr-only')) return;
      hasil += teksDari(node);
    }
  });
  return hasil.replace(/[ \t]+/g, ' ').trim();
}

function angka(nilai: string, cadangan = 0): number {
  const n = Number.parseFloat(nilai);
  return Number.isFinite(n) ? n : cadangan;
}

function warnaEfektif(nilai: string): string {
  if (!nilai || nilai === 'transparent') return '';
  const rgba = nilai.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const bagian = rgba[1].split(',').map((s) => s.trim());
    if (bagian.length === 4 && Number.parseFloat(bagian[3]) === 0) return '';
  }
  return nilai;
}

/**
 * Mengukur hero menjadi blueprint. Mengembalikan daftar kosong bila hero
 * tidak ditemukan — pemanggil wajib menganggap itu sebagai "lewati efek".
 */
export function ukurHero(): SwarmItem[] {
  if (typeof window === 'undefined' || !document.querySelector('.hero')) return [];

  const items: SwarmItem[] = [];
  const dipakai: { x: number; y: number }[] = [];

  for (const { sel, kind, ketik } of TARGET) {
    const nodes = [...document.querySelectorAll(sel)];
    for (const node of nodes.slice(0, kind === 'pill' ? 4 : 1)) {
      const el = node as HTMLElement;
      const r = el.getBoundingClientRect();
      // Hanya yang terlihat di layar & cukup besar untuk digambar.
      if (r.width < 10 || r.height < 10) continue;
      if (r.bottom < 8 || r.top > window.innerHeight - 8) continue;
      // Hindari menggambar elemen yang menumpang persis di atas item lain.
      if (dipakai.some((p) => Math.abs(p.x - r.left) < 6 && Math.abs(p.y - r.top) < 6)) continue;

      const cs = getComputedStyle(el);
      const tebal = angka(cs.borderTopWidth);
      const warnaTepi = warnaEfektif(cs.borderTopColor);
      const isi = warnaEfektif(cs.backgroundColor);
      const teks = teksDari(el);

      // Kotak tanpa isi, tanpa tepi dan tanpa teks tidak ada gunanya digambar.
      if (!isi && !warnaTepi && !teks) continue;

      dipakai.push({ x: r.left, y: r.top });
      items.push({
        id: `${sel}-${items.length}`,
        kind,
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
        fill: isi,
        radius: Math.min(angka(cs.borderTopLeftRadius), 28),
        border: tebal > 0 && warnaTepi ? `${Math.min(tebal, 3)}px solid ${warnaTepi}` : '',
        text: kind === 'box' ? '' : teks.slice(0, 90),
        color: cs.color || '#e8ecf3',
        fontSize: angka(cs.fontSize, 14),
        fontWeight: angka(cs.fontWeight, 500),
        lineHeight: Math.max(angka(cs.lineHeight, 20), angka(cs.fontSize, 14) * 1.1),
        font: cs.fontFamily || 'Manrope, system-ui, sans-serif',
        align: (['left', 'center', 'right'].includes(cs.textAlign) ? cs.textAlign : 'left') as SwarmItem['align'],
        ketik: Boolean(ketik) && teks.length > 0,
      });
      if (items.length >= MAKS_ITEM) break;
    }
    if (items.length >= MAKS_ITEM) break;
  }

  // Urutkan atas → bawah, kiri → kanan supaya halaman "dibangun" rapi.
  return items.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y)).slice(0, MAKS_ITEM);
}

/** Warna latar halaman, dipakai sebagai warna kanvas kosong. */
export function warnaLatar(): string {
  if (typeof window === 'undefined') return '#080b10';
  const body = getComputedStyle(document.body).backgroundColor;
  return warnaEfektif(body) || '#080b10';
}

/**
 * Ukur hero berulang sampai posisinya stabil.
 * Perlu karena beberapa elemen baru mencapai posisi akhirnya belakangan:
 * font yang telat dimuat, teks yang datang dari /api/content, dan — yang paling
 * licik — `.portrait-assembly` yang memudar dari opacity 0 ke 1. Selama opacity
 * masih < 1, Chrome meratakan 3D-nya, jadi `translateZ(58px)` pada chip
 * CURRENTLY EXPLORING belum mengembang dan rect-nya meleset ~10px.
 */
export async function ukurHeroStabil(maks = 2200): Promise<SwarmItem[]> {
  const mulai = performance.now();
  let terakhir = ukurHero();
  while (performance.now() - mulai < maks) {
    await new Promise((r) => setTimeout(r, 150));
    const sekarang = ukurHero();
    if (sama(terakhir, sekarang)) return sekarang;
    terakhir = sekarang;
  }
  return ukurHero();
}

/** Bandingkan dua blueprint: sama jumlah item dan semua rect-nya ±1px. */
function sama(a: SwarmItem[], b: SwarmItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > 1) return false;
    if (Math.abs(a[i].y - b[i].y) > 1) return false;
    if (Math.abs(a[i].w - b[i].w) > 1) return false;
    if (Math.abs(a[i].h - b[i].h) > 1) return false;
  }
  return true;
}

// ── pemindai seluruh halaman (Fase 3B) ──────────────────────────────────────

/**
 * Elemen yang tidak boleh digambar ulang: skrip, elemen tersembunyi untuk
 * pembaca layar, widget mengambang (Relay AI, gelembung obrolan) dan layer
 * efek itu sendiri — semuanya bukan bagian dari isi halaman.
 */
const ABAIKAN =
  'script, style, noscript, template, .sr-only, [aria-hidden="true"], .swarm-host, .relay-bubble, .ai-sandbox, .skip-link, .swarm-skip';

/** Batas tinggi dunia (dokumen) yang mau digambar — sama seperti referensi. */
const MAKS_TINGGI_DUNIA = 40000;

/** Teks yang langsung dimiliki elemen (bukan teks anaknya). */
function teksLangsung(el: Element): string {
  let hasil = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) hasil += n.textContent || '';
    else if (n instanceof HTMLBRElement) hasil += ' ';
  });
  return hasil.replace(/\s+/g, ' ').trim();
}

/** Apakah elemen ini layak digambar (terlihat & punya ukuran)? */
function nampak(el: HTMLElement): boolean {
  if (el.closest(ABAIKAN)) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  if (Number(cs.opacity) === 0) return false;
  return true;
}

/** Apakah elemen punya latar/tepi/ bayangan yang terlihat? */
function berisi(cs: CSSStyleDeclaration): boolean {
  return Boolean(warnaEfektif(cs.backgroundColor) || (warnaEfektif(cs.borderTopColor) && angka(cs.borderTopWidth) > 0));
}

/**
 * Mengukur SELURUH halaman menjadi blueprint — bukan cuma hero.
 *
 * Koordinat yang dipakai adalah koordinat DOKUMEN (world):
 * `x = rect.left + scrollX`, `y = rect.top + scrollY`. Karena blueprint
 * digambar di atas layer yang ikut bergulir, posisi tetap akurat walau
 * halaman digeser saat efek berjalan (Fase 3B: Tour auto-scroll).
 *
 * Yang dikumpulkan:
 * - `box`   — kartu/panel/baris yang punya latar atau tepi terlihat;
 * - `image` — gambar (dan elemen ber-`background-image`);
 * - `text`  — elemen yang punya teks langsung (judul, paragraf, label);
 * - `pill`  — tombol/chip kecil dengan sudut membulat.
 */
export function ukurHalaman(maks = 700): SwarmItem[] {
  if (typeof window === 'undefined' || !document.body) return [];

  const gulirX = window.scrollX || 0;
  const gulirY = window.scrollY || 0;
  const mentah: { item: SwarmItem; skor: number }[] = [];
  const dipakai: { x: number; y: number }[] = [];

  for (const el of [...document.body.querySelectorAll<HTMLElement>('*')]) {
    if (!nampak(el)) continue;
    const r = el.getBoundingClientRect();
    const y = r.top + gulirY;
    const x = r.left + gulirX;
    if (y > MAKS_TINGGI_DUNIA) continue;
    if (r.width < 1 || r.height < 1) continue;

    const cs = getComputedStyle(el);
    const luas = r.width * r.height;
    const radius = Math.min(angka(cs.borderTopLeftRadius), 28);
    const tebal = angka(cs.borderTopWidth);
    const warnaTepi = warnaEfektif(cs.borderTopColor);
    const isi = warnaEfektif(cs.backgroundColor);
    const gambarLatar = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : '';
    const teks = teksLangsung(el);

    // Hindari menggambar dua kali di tempat yang sama.
    const titik = { x: Math.round(x), y: Math.round(y) };
    if (dipakai.some((p) => Math.abs(p.x - titik.x) < 6 && Math.abs(p.y - titik.y) < 6)) continue;

    const dasar: SwarmItem = {
      id: `h-${mentah.length}`,
      kind: 'box',
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      fill: isi,
      radius,
      border: tebal > 0 && warnaTepi ? `${Math.min(tebal, 3)}px solid ${warnaTepi}` : '',
      text: '',
      color: cs.color || '#e8ecf3',
      fontSize: angka(cs.fontSize, 14),
      fontWeight: angka(cs.fontWeight, 500),
      lineHeight: Math.max(angka(cs.lineHeight, 20), angka(cs.fontSize, 14) * 1.1),
      font: cs.fontFamily || 'Manrope, system-ui, sans-serif',
      align: (['left', 'center', 'right'].includes(cs.textAlign) ? cs.textAlign : 'left') as SwarmItem['align'],
      ketik: false,
    };

    if (el instanceof HTMLImageElement && luas >= 1600) {
      const src = el.currentSrc || el.src;
      if (src) {
        dipakai.push(titik);
        mentah.push({
          item: { ...dasar, kind: 'image', src, fill: isi || 'rgba(255,255,255,0.06)' },
          skor: luas + 6000,
        });
        continue;
      }
    }

    if (teks.length > 0 && luas >= 200) {
      const potong = teks.slice(0, 90);
      dipakai.push(titik);
      const judul = /^H[1-6]$/.test(el.tagName);
      mentah.push({
        item: {
          ...dasar,
          kind: 'text',
          fill: '',
          border: '',
          text: potong,
          ketik: potong.length > 0 && potong.length <= 90,
        },
        skor: luas + (judul ? 9000 : 1500),
      });
      continue;
    }

    if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || /button|chip|pill|badge|tag/i.test(el.className || '')) {
      if (luas >= 400) {
        dipakai.push(titik);
        mentah.push({ item: { ...dasar, kind: 'pill', text: teks.slice(0, 40) }, skor: luas + 3000 });
        continue;
      }
    }

    if (berisi(cs) || gambarLatar) {
      if (luas >= 2500 && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
        dipakai.push(titik);
        mentah.push({
          item: { ...dasar, kind: 'box', fill: isi || (gambarLatar ? 'rgba(255,255,255,0.05)' : '') },
          skor: luas + 500,
        });
      }
    }
  }

  // Prioritaskan yang besar & penting, lalu urutkan atas → bawah supaya
  // halaman "dibangun" berurutan dari atas (Tour yang enak dilihat).
  return mentah
    .sort((a, b) => b.skor - a.skor)
    .slice(0, maks)
    .map((m) => m.item)
    .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}
