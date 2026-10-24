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
