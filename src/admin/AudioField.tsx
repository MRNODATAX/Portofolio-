import { useRef, useState, type ChangeEvent } from 'react';
import { LoaderCircle, Music4, Play, Square, Upload } from 'lucide-react';

const ACCEPTED = /^audio\/(mpeg|mp3|mp4|m4a|x-m4a|aac|ogg|wav|x-wav|flac)$/i;
const MAX_BYTES = 3 * 1024 * 1024; // batas aman unggahan serverless (base64 membengkak ~33%)

interface AudioFieldProps {
  url: string;
  token: string;
  onChange: (url: string) => void;
}

export default function AudioField({ url, token, onChange }: AudioFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLAudioElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState(false);

  function stopPreview() {
    preview.current?.pause();
    if (preview.current) preview.current.currentTime = 0;
    setPreviewing(false);
  }

  function togglePreview() {
    if (previewing) {
      stopPreview();
      return;
    }
    if (!url) {
      setError('Unggah audio dulu (atau tempel URL) sebelum pradengar.');
      return;
    }
    setError('');
    if (!preview.current) preview.current = new Audio();
    preview.current.src = url;
    preview.current.volume = 0.6;
    preview.current
      .play()
      .then(() => setPreviewing(true))
      .catch(() => setError('Browser memblokir pradengar otomatis. Coba klik lagi.'));
    preview.current.onended = () => setPreviewing(false);
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED.test(file.type)) {
      setError('Format harus MP3, M4A, OGG, WAV, atau FLAC.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `Ukuran ${(file.size / 1024 / 1024).toFixed(1)} MB melebihi batas 3 MB. Kompres dulu (mis. 128 kbps) atau potong bagian yang dipakai.`
      );
      return;
    }

    stopPreview();
    setUploading(true);
    setError('');
    setProgress('Membaca file…');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Gagal membaca file audio.'));
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
        throw new Error(body.error || 'Gagal mengunggah audio.');
      }
      onChange(body.url);
      setProgress(
        body.mode === 'supabase'
          ? 'Berhasil diunggah ke Supabase Storage (permanen).'
          : body.mode === 'filesystem'
            ? 'Berhasil diunggah ke folder public/images/uploads.'
            : 'Berhasil diunggah.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah audio.');
      setProgress('');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="admin-audio-field">
      <div className="admin-field">
        <label>URL Audio Backsound</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={url}
            placeholder="/audio/backsound.mp3 atau https://...supabase.co/storage/v1/object/public/..."
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="admin-btn"
            onClick={togglePreview}
            title={previewing ? 'Hentikan pradengar' : 'Pradengar audio'}
            disabled={!url}
          >
            {previewing ? <Square size={14} /> : <Play size={14} />}
            {previewing ? 'Stop' : 'Coba'}
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/aac,audio/ogg,audio/wav,audio/flac"
        hidden
        onChange={handleFile}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="admin-btn"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}
          {uploading ? 'Mengunggah…' : 'Upload MP3 dari Perangkat'}
        </button>
        <span className="admin-hint">
          <Music4 size={12} /> MP3 / M4A / OGG / WAV / FLAC · maksimal 3 MB · tersimpan permanen di Supabase Storage
        </span>
      </div>

      {progress && <p className="admin-hint admin-hint-ok">{progress}</p>}
      {error && <p className="admin-hint admin-hint-error">{error}</p>}
    </div>
  );
}
