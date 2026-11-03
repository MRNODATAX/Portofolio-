/**
 * Tipe untuk mesin "Swarm" — gerombolan kursor yang membangun ulang Hero.
 *
 * Fase 1 (spike): blueprint diukur langsung dari DOM hero yang sudah jadi,
 * lalu digambar ulang di atas layer tersendiri. Situs aslinya tidak disentuh
 * sama sekali — kalau apa pun gagal, layer cukup memudar dan halaman tampil
 * seperti biasa (fail-open).
 */

export type ItemKind = 'box' | 'text' | 'button' | 'pill';

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
}

export const NAMA_AGEN = [
  'Ada',
  'Linus',
  'Grace',
  'Alan',
  'Margaret',
  'Ken',
  'Barbara',
  'Radia',
];

export const WARNA_AGEN = [
  '#F24E1E',
  '#A259FF',
  '#1ABCFE',
  '#0ACF83',
  '#FF7262',
  '#FFC700',
  '#9747FF',
  '#00B5CE',
];
