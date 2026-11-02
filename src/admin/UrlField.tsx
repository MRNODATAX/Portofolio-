import { useId, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { isValidUrl, normalizeUrl } from '../lib/url';

type Props = {
  label: string;
  value: string;
  onChange: (nilai: string) => void;
  placeholder?: string;
  hint?: string;
  /** Tautan internal seperti "/admin" atau "#home" juga diterima. */
  allowInternal?: boolean;
};

/**
 * Kotak isian tautan yang memaafkan kebiasaan mengetik domain tanpa skema.
 *
 * - `namadomain.com` otomatis menjadi `https://namadomain.com`
 * - `//namadomain.com` otomatis menjadi `https://namadomain.com`
 * - `javascript:...` dan protokol berbahaya lain ditolak
 *
 * Tidak memakai `type="url"` karena browser menandai domain tanpa skema
 * sebagai tidak valid dan memunculkan peringatan yang membingungkan.
 */
export default function UrlField({ label, value, onChange, placeholder = 'https://...', hint, allowInternal = false }: Props) {
  const id = useId();
  const [disentuh, setDisentuh] = useState(false);
  const teks = (value || '').trim();

  const internal = allowInternal && (teks.startsWith('#') || (teks.startsWith('/') && !teks.startsWith('//')));
  const valid = !teks || internal || isValidUrl(teks);
  const akanDilengkapi = !!teks && !teks.includes('://') && isValidUrl(teks) && !internal;

  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => {
          setDisentuh(false);
          onChange(e.target.value);
        }}
        onBlur={(e) => {
          setDisentuh(true);
          const bersih = normalizeUrl(e.target.value);
          if (bersih && bersih !== e.target.value.trim()) onChange(bersih);
        }}
      />
      {hint && !teks && <small className="admin-hint">{hint}</small>}
      {teks && !valid && (
        <small className="admin-hint admin-hint-error">
          <AlertTriangle size={12} /> Tautan belum dikenali. Contoh benar: <b>https://namadomain.com</b> atau{' '}
          <b>namadomain.com</b>
        </small>
      )}
      {teks && valid && akanDilengkapi && (
        <small className="admin-hint">
          Akan disimpan sebagai <b>{normalizeUrl(teks)}</b>
        </small>
      )}
      {teks && valid && !akanDilengkapi && disentuh && (
        <small className="admin-hint admin-hint-ok">
          <CheckCircle2 size={12} /> Tautan valid
        </small>
      )}
    </div>
  );
}
