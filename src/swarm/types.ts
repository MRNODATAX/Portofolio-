import type { BunyiSwarm } from './suara';

/**
 * Tipe untuk mesin "Swarm" — gerombolan kursor yang membangun ulang Hero.
 *
 * Fase 1 (spike): blueprint diukur langsung dari DOM hero yang sudah jadi,
 * lalu digambar ulang di atas layer tersendiri. Situs aslinya tidak disentuh
 * sama sekali — kalau apa pun gagal, layer cukup memudar dan halaman tampil
 * seperti biasa (fail-open).
 */

export type ItemKind = 'box' | 'text' | 'button' | 'pill' | 'image';

export interface SwarmItem {
  id: string;
  kind: ItemKind;
  /** Posisi & ukuran dalam koordinat viewport (CSS px) saat diukur. */
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  radius: number;
  border: string;
  text: string;
  color: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  font: string;
  align: 'left' | 'center' | 'right';
  /** Beri jeda "ketikan" sebelum item berikutnya (dipakai untuk blok teks panjang). */
  ketik: boolean;
  /** Alamat gambar — hanya terisi untuk `kind: 'image'` (Fase 3B). */
  src?: string;
}

export interface SwarmAgent {
  nama: string;
  warna: string;
  x: number;
  y: number;
}

export interface SwarmHandle {
  cancel: () => void;
}

export interface SwarmOptions {
  /** Elemen di dalam shadow root tempat semua gambar ditaruh. */
  host: HTMLElement;
  items: SwarmItem[];
  agents: number;
  speed: number;
  background: string;
  onDone: () => void;
  /** Bunyi sintetis opsional (null / tidak diisi = efek bisu). */
  bunyi?: BunyiSwarm | null;
}

/** 32 nama agen — jumlah & urutannya mengikuti spesifikasi referensi. */
export const NAMA_AGEN = [
  'Ada', 'Linus', 'Grace', 'Alan', 'Margaret', 'Ken', 'Barbara', 'Dennis',
  'Radia', 'Guido', 'Frances', 'Bjarne', 'Hedy', 'Tim', 'Katherine', 'Edsger',
  'Joan', 'Donald', 'Sophie', 'Niklaus', 'Anita', 'Brian', 'Mary', 'Rob',
  'Ida', 'Yukihiro', 'Shafi', 'Leslie', 'Jean', 'Vint', 'Lynn', 'Bram',
];

/** 12 warna kursor — paletnya mengikuti spesifikasi referensi. */
export const WARNA_AGEN = [
  '#F24E1E', '#A259FF', '#1ABCFE', '#0ACF83', '#FF7262', '#FFC700',
  '#9747FF', '#E8467C', '#14AE5C', '#0D99FF', '#FF8A00', '#00B5CE',
];
