import { useRef, useState, type ChangeEvent } from 'react';
import { LoaderCircle, RotateCcw, Upload, Wand2 } from 'lucide-react';

/** Banner selalu berbentuk jendela lanskap 16:9 — sama persis dengan komponen VideoPlayer. */
const FRAME_RATIO = 16 / 9;

export const VIDEO_ROTATION_OPTIONS = [
  { value: 0, label: '0° — Normal (lanskap)' },
  { value: -90, label: '-90° — Putar kiri (video vertikal)' },
  { value: 90, label: '+90° — Putar kanan (video vertikal)' },
  { value: 180, label: '180° — Terbalik' },
];

export function normalizeVideoRotation(raw: unknown) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360;
}

export function isQuarterTurn(rotation: number) {
  const normalized = normalizeVideoRotation(rotation);
  return normalized === 90 || normalized === 270;
}

/** 270° ditampilkan sebagai -90° supaya nilainya cocok dengan opsi di dropdown. */
export function signedRotation(rotation: number) {
  const normalized = normalizeVideoRotation(rotation);
  return normalized === 270 ? -90 : normalized;
}

export function videoTransformStyle(rotation: number, fit: 'cover' | 'contain') {
  const normalized = normalizeVideoRotation(rotation);
  const quarter = normalized === 90 || normalized === 270;
  return {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    width: quarter ? `${100 / FRAME_RATIO}%` : '100%',
    height: quarter ? `${FRAME_RATIO * 100}%` : '100%',
    maxWidth: 'none',
    maxHeight: 'none',
    objectFit: fit,
    transform: `translate(-50%, -50%) rotate(${normalized}deg)`,
    transformOrigin: '50% 50%',
  };
}

interface VideoFieldProps {
  url: string;
  poster: string;
  rotation: number;
  fit: 'cover' | 'contain';
  token: string;
  onChange: (patch: { url?: string; poster?: string; rotation?: number; fit?: 'cover' | 'contain' }) => void;
}

export default function VideoField({ url, poster, rotation, fit, token, onChange }: VideoFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [detecting, setDetecting] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!/^video\/(mp4|webm)$/i.test(file.type)) {
      setError('Format harus MP4 (.mp4) atau WebM (.webm).');
      return;
    }

    setUploading(true);
    setError('');
    setProgress('Membaca file…');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Gagal membaca file video.'));
        reader.readAsDataURL(file);
      });

      setProgress('Mengunggah…');
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'upload',
          filename: file.name,
          mimeType: file.type,
          dataUrl,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error || 'Gagal mengunggah video.');
      }
      onChange({ url: body.url });
      setProgress(
        body.mode === 'supabase'
          ? 'Berhasil diunggah ke Supabase Storage.'
          : body.mode === 'filesystem'
            ? 'Berhasil diunggah ke folder public/images/uploads.'
            : 'Berhasil — video disimpan sebagai data URL.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah video.');
      setProgress('');
    } finally {
      setUploading(false);
    }
  }

  /** Baca metadata video lalu tebak orientasi yang benar (lanskap = 0°, vertikal = ±90°). */
  function autoDetectOrientation() {
    if (!url) {
      setError('Isi URL video (atau upload dulu) sebelum mendeteksi orientasi.');
      return;
    }
    setDetecting(true);
    setError('');
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.muted = true;
    probe.crossOrigin = 'anonymous';

    const done = (w: number, h: number) => {
      setDetecting(false);
      if (!w || !h) {
        setError('Metadata video tidak terbaca. Atur rotasi secara manual.');
        return;
      }
      const current = normalizeVideoRotation(rotation);
      if (h > w) {
        // Sumber vertikal: butuh putaran seperempat. Pertahankan arah putaran yang sudah dipilih.
        const next = current === 90 || current === 270 ? current : -90;
        onChange({ rotation: next });
        setProgress(`Terdeteksi vertikal ${w}×${h} → rotasi ${next}° diterapkan.`);
      } else {
        onChange({ rotation: 0 });
        setProgress(`Terdeteksi lanskap ${w}×${h} → rotasi 0° diterapkan.`);
      }
    };

    probe.onerror = () => {
      setDetecting(false);
      setError('Video tidak bisa dimuat (URL salah, CORS, atau format tidak didukung). Atur rotasi secara manual.');
    };
    probe.onloadedmetadata = () => done(probe.videoWidth, probe.videoHeight);
    // Beberapa browser baru mengisi dimensi setelah satu frame tersedia.
    probe.onloadeddata = () => {
      if (!probe.videoWidth || !probe.videoHeight) return;
      done(probe.videoWidth, probe.videoHeight);
    };
    probe.src = url;
  }

  return (
    <div className="admin-field">
      <label>Video Banner (MP4 / WebM)</label>

      <div className="admin-image-field">
        <div className="admin-image-row">
          <div
            className="admin-image-preview"
            style={{ position: 'relative', height: 148, overflow: 'hidden', background: '#0d1118' }}
          >
            {poster && !url ? (
              <img src={poster} alt="Poster" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : url ? (
              <video
                key={url}
                src={url}
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
                style={videoTransformStyle(rotation, fit)}
              />
            ) : (
              <span>Belum ada video</span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="admin-image-actions">
              <input ref={fileRef} type="file" accept="video/mp4,video/webm" hidden onChange={handleFile} />
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}
                {uploading ? 'Mengunggah…' : 'Upload Video dari Perangkat'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                disabled={detecting}
                onClick={autoDetectOrientation}
              >
                {detecting ? <LoaderCircle size={14} className="spin" /> : <Wand2 size={14} />}
                Deteksi Orientasi Otomatis
              </button>
              {rotation !== 0 && (
                <button type="button" className="admin-btn admin-btn-sm" onClick={() => onChange({ rotation: 0 })}>
                  <RotateCcw size={13} />
                  Luruskan (0°)
                </button>
              )}
            </div>

            <input
              type="text"
              value={url}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="/images/uploads/video.mp4 atau https://.../video.mp4"
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <select
                value={signedRotation(rotation)}
                onChange={(e) => onChange({ rotation: Number(e.target.value) })}
                style={{ maxWidth: 260 }}
              >
                {VIDEO_ROTATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Rotasi: {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={fit}
                onChange={(e) => onChange({ fit: e.target.value === 'contain' ? 'contain' : 'cover' })}
                style={{ maxWidth: 220 }}
              >
                <option value="cover">Isi penuh (cover — crop pinggiran)</option>
                <option value="contain">Muat utuh (contain — ada letterbox)</option>
              </select>
            </div>

            <p style={{ color: 'var(--quiet)', fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
              Jika video tampil miring/terbalik, pilih sudut rotasi di atas lalu <strong>Simpan Perubahan</strong>.
              Untuk video vertikal (dari kamera/HP) gunakan <strong>-90°</strong> atau <strong>+90°</strong>.
              Upload langsung dibatasi ±4 MB di Vercel — untuk file lebih besar, unggah ke Supabase Storage /
              Cloudinary lalu tempel URL-nya di kolom ini.
            </p>

            {progress && (
              <p style={{ color: '#8fd694', fontSize: 11.5, marginTop: 6 }}>{progress}</p>
            )}
            {error && <p style={{ color: '#f28b82', fontSize: 11.5, marginTop: 6 }}>{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
