import { useEffect, useState } from 'react';

export const toolSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');
const monochrome = new Set(['ChatGPT', 'GitHub', 'Vercel', 'v0', 'Copilot', 'Google AI Studio', 'Railway']);

export default function ToolIcon({ name, iconUrl }: { name: string; iconUrl?: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [name, iconUrl]);

  if (!iconUrl && name === 'Kimi' && !failed) {
    return (
      <span className="brand-tool-icon tool-kimi">
        <img className="kimi-dark" src="/images/tools/kimi.svg" alt="" width="28" height="28" loading="lazy" onError={() => setFailed(true)} />
        <img className="kimi-light" src="/images/tools/kimi-light.svg" alt="" width="28" height="28" loading="lazy" onError={() => setFailed(true)} />
      </span>
    );
  }

  if (failed) {
    const initials = name
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() || '')
      .slice(0, 2)
      .join('') || 'TL';
    return (
      <span className="brand-tool-icon tool-fallback-badge" aria-hidden="true">
        {initials}
      </span>
    );
  }

  const src = iconUrl || `/images/tools/${toolSlug(name)}.svg`;
  return (
    <img
      className={`brand-tool-icon tool-${toolSlug(name)} ${!iconUrl && monochrome.has(name) ? 'tool-monochrome' : ''} ${
        !iconUrl && name === 'Codex' ? 'tool-reverse' : ''
      }`}
      src={src}
      alt=""
      width="28"
      height="28"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
