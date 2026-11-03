/**
 * Koordinator audio sederhana berbasis CustomEvent.
 *
 * Tujuannya: backsound (musik latar) dan video "The Inspiration Film" tidak boleh
 * mengeluarkan suara bersamaan. Keduanya hidup di komponen berbeda, jadi mereka
 * berkomunikasi lewat event di `window` — tanpa context provider dan tanpa
 * memicu render ulang React setiap kali status berubah.
 */

export const MUSIC_START = 'nodata:music-start';
export const MUSIC_STOP = 'nodata:music-stop';
/** Dipancarkan VideoPlayer saat pengunjung menyalakan audio video → musik harus berhenti. */
export const VIDEO_AUDIO_ON = 'nodata:video-audio-on';
/** Dipancarkan layer Swarm: efek bersuara mulai → backsound diredam sementara. */
export const SWARM_DUCK_ON = 'nodata:swarm-duck-on';
/** Dipancarkan layer Swarm: efek bersuara selesai → backsound dikembalikan. */
export const SWARM_DUCK_OFF = 'nodata:swarm-duck-off';

/**
 * Apakah backsound sedang menyala?
 *
 * Dipakai layer Swarm untuk menegakkan aturan PR #7: efek hanya boleh bersuara
 * kalau pengunjung **sudah** menyalakan backsound sendiri — jadi tidak ada
 * autoplay dalam bentuk apa pun.
 */
let musikMenyala = false;

if (typeof window !== 'undefined') {
  window.addEventListener(MUSIC_START, () => { musikMenyala = true; });
  window.addEventListener(MUSIC_STOP, () => { musikMenyala = false; });
  // Audio video menyala → musik berhenti (aturan saling eksklusif PR #7).
  window.addEventListener(VIDEO_AUDIO_ON, () => { musikMenyala = false; });
}

export function musikSedangMenyala(): boolean {
  return musikMenyala;
}

export function announceMusicStart() {
  window.dispatchEvent(new CustomEvent(MUSIC_START));
}

export function announceMusicStop() {
  window.dispatchEvent(new CustomEvent(MUSIC_STOP));
}

export function announceVideoAudioOn() {
  window.dispatchEvent(new CustomEvent(VIDEO_AUDIO_ON));
}

export function onMusicStart(handler: () => void) {
  window.addEventListener(MUSIC_START, handler);
  return () => window.removeEventListener(MUSIC_START, handler);
}

export function onMusicStop(handler: () => void) {
  window.addEventListener(MUSIC_STOP, handler);
  return () => window.removeEventListener(MUSIC_STOP, handler);
}

export function onVideoAudioOn(handler: () => void) {
  window.addEventListener(VIDEO_AUDIO_ON, handler);
  return () => window.removeEventListener(VIDEO_AUDIO_ON, handler);
}

export function announceSwarmDuck(aktif: boolean) {
  window.dispatchEvent(new CustomEvent(aktif ? SWARM_DUCK_ON : SWARM_DUCK_OFF));
}

/**
 * Dengarkan permintaan Swarm untuk meredam / mengembalikan backsound.
 * `handler(true)` = redam, `handler(false)` = kembalikan.
 */
export function onSwarmDuck(handler: (aktif: boolean) => void) {
  const redam = () => handler(true);
  const pulih = () => handler(false);
  window.addEventListener(SWARM_DUCK_ON, redam);
  window.addEventListener(SWARM_DUCK_OFF, pulih);
  return () => {
    window.removeEventListener(SWARM_DUCK_ON, redam);
    window.removeEventListener(SWARM_DUCK_OFF, pulih);
  };
}
