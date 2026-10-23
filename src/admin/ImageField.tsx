import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { PRESET_WORK_COVERS } from '../data';

async function compressImageToDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string; filename: string }> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: String(reader.result), mimeType: file.type, filename: file.name });
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.readAsDataURL(file);
    });
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('File bukan gambar yang valid.'));
      el.src = bitmapUrl;
    });

    const maxDim = 1280;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas tidak tersedia.');
    ctx.drawImage(img, 0, 0, width, height);

    const webp = canvas.toDataURL('image/webp', 0.86);
    const useWebp = webp.startsWith('data:image/webp');
    const finalDataUrl = useWebp ? webp : canvas.toDataURL('image/jpeg', 0.86);
    return {
      dataUrl: finalDataUrl,
      mimeType: useWebp ? 'image/webp' : 'image/jpeg',
      filename: file.name.replace(/\.[^.]+$/, useWebp ? '.webp' : '.jpg'),
    };
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (nextUrl: string) => void;
  token: string;
  focal?: string;
  onFocalChange?: (nextFocal: string) => void;
  showWorkPresets?: boolean;
  previewAspect?: 'portrait' | 'landscape' | 'square';
  fallbackSrc?: string;
}

export default function ImageField({
  label,
  value,
  onChange,
  token,
  focal,
  onFocalChange,
  showWorkPresets = false,
  previewAspect = 'landscape',
  fallbackSrc,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const prepared = await compressImageToDataUrl(file);
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'upload',
          filename: prepared.filename,
          mimeType: prepared.mimeType,
          dataUrl: prepared.dataUrl,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error || 'Gagal mengunggah gambar.');
      }
      onChange(body.url);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Gagal memproses gambar.');
    } finally {
      setUploading(false);
    }
  }

  const previewHeight = previewAspect === 'portrait' ? 148 : previewAspect === 'square' ? 110 : 88;

  return (
    <div className="admin-field">
      <label>{label}</label>
      <div className="admin-image-field">
        <div className="admin-image-row">
          <div className="admin-image-preview" style={{ height: previewHeight }}>
            {value ? (
              <img
                src={value}
                alt="Preview"
                style={{ objectPosition: focal || '50% 50%' }}
                onError={(e) => {
                  if (fallbackSrc && e.currentTarget.src !== new URL(fallbackSrc, window.location.origin).href) {
                    e.currentTarget.src = fallbackSrc;
                  }
                }}
              />
            ) : (
              <span>Belum ada gambar</span>
            )}
          </div>
          <div>
            <div className="admin-image-actions">
              <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />}
                {uploading ? 'Mengunggah…' : 'Upload dari Perangkat'}
              </button>
              {value && (
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-danger"
                  onClick={() => onChange('')}
                >
                  <Trash2 size={13} />
                  Kosongkan
                </button>
              )}
            </div>

            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="/images/... atau https://..."
            />

            {showWorkPresets && (
              <div style={{ marginTop: 8 }}>
                <select
                  value={PRESET_WORK_COVERS.some((slug) => value === `/components/works/${slug}.svg`) ? value : ''}
                  onChange={(e) => {
                    if (e.target.value) onChange(e.target.value);
                  }}
                >
                  <option value="">— Atau pilih cover ilustrasi SVG bawaan —</option>
                  {PRESET_WORK_COVERS.map((slug) => (
                    <option key={slug} value={`/components/works/${slug}.svg`}>
                      Ilustrasi SVG: {slug}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onFocalChange && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <small style={{ color: 'var(--quiet)', fontSize: 11 }}>Titik Fokus Crop:</small>
                {[
                  { label: 'Wajah Atas (50% 18%)', val: '50% 18%' },
                  { label: 'Agak Atas (center 42%)', val: 'center 42%' },
                  { label: 'Tengah (50% 50%)', val: '50% 50%' },
                  { label: 'Bawah (50% 80%)', val: '50% 80%' },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    className="admin-btn admin-btn-sm"
                    style={focal === preset.val ? { borderColor: 'var(--ink)' } : undefined}
                    onClick={() => onFocalChange(preset.val)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            {err && <p style={{ color: '#f28b82', fontSize: 11.5, marginTop: 6 }}>{err}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
