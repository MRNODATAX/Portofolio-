/**
 * Gaya untuk layer swarm. Disuntik ke dalam shadow root supaya benar-benar
 * terisolasi dari glass.css (dua arah tidak saling bocor).
 */
export const GAYA_SWARM = `
:host { all: initial; }

.stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: 'Space', system-ui, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  contain: strict;
}

.lapis { position: absolute; inset: 0; }
.kursor { position: absolute; inset: 0; pointer-events: none; }

.kerangka {
  position: absolute;
  box-sizing: border-box;
  width: 0;
  height: 0;
  border: 1px dashed currentColor;
  background: color-mix(in srgb, currentColor 8%, transparent);
  border-radius: 6px;
  opacity: 1;
  transition: opacity 0.22s ease;
}

.kotak {
  position: absolute;
  box-sizing: border-box;
  opacity: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  transition: opacity 0.22s ease, clip-path 0.6s cubic-bezier(0.2, 0.75, 0.2, 1);
}

/* Kotak yang sudah selesai ditarik kursor: muncul perlahan.
   Tanpa aturan ini kotak tak pernah terlihat (opacity tetap 0). */
.kotak.muncul { opacity: 1; }

/* Gambar: dibuka dengan sapuan dari atas ke bawah seperti referensi. */
.kotak.gambar {
  background-size: cover;
  background-position: center;
  clip-path: inset(0 0 100% 0);
}
.kotak.gambar.muncul { clip-path: inset(0); }

.teks {
  width: 100%;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.teks.mengetik::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 0.95em;
  margin-left: 2px;
  background: currentColor;
  vertical-align: -0.12em;
  animation: swarm-kedip 0.7s steps(1, end) infinite;
}

@keyframes swarm-kedip { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

.lencana {
  position: absolute;
  top: 0;
  left: 0;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(8, 11, 16, 0.82);
  color: currentColor;
  font-size: 9px;
  letter-spacing: 0.4px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.16s ease;
  pointer-events: none;
}

.agen {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: flex-start;
  gap: 3px;
  will-change: transform;
  transition: opacity 0.25s ease;
}

.agen svg { filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)); }

.agen .nama {
  margin-top: 13px;
  padding: 1px 5px;
  border-radius: 3px;
  background: currentColor;
  color: #080b10;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.agen.diam { opacity: 0.45; }

@media (prefers-reduced-motion: reduce) {
  .teks.mengetik::after { animation: none; }
}
`;
