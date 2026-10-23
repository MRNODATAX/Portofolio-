import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Copy, LoaderCircle, MessageCircle, Minus, RotateCcw, Square, Trash2, X } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { useRelayChat } from '../hooks/useRelayChat';
import RelayMark from './RelayMark';

function engineLabel(provider: string, model: string) {
  if (provider === 'gemini') return model ? `Gemini · ${model}` : 'Gemini';
  if (provider === 'upstream') return model ? `LLM · ${model}` : 'LLM';
  if (provider === 'webhook') return 'Webhook AI';
  return 'Pengetahuan lokal';
}

function clock(at?: number) {
  if (!at) return '';
  try {
    return new Date(at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function RelayBubble() {
  const { siteData } = useSiteData();
  const { relay, identity } = siteData;
  const cfg = relay.bubble;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(-1);
  const [unseen, setUnseen] = useState(0);
  const { messages, busy, error, online, provider, model, send, reset, stop } = useRelayChat({ persist: true });
  const logRef = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const enabled = cfg?.enabled !== false;
  const position = cfg?.position === 'left' ? 'left' : 'right';
  const launcherLabel = cfg?.launcherLabel || 'Tanya Relay AI';
  const greeting = cfg?.greeting || `Halo! Aku Relay, representasi AI ${identity.name}. Ada yang mau kamu tahu?`;
  const delay = Number(cfg?.autoOpenDelayMs || 0);

  useEffect(() => {
    if (!enabled) return;
    setUnseen((n) => (open ? 0 : n));
  }, [open, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (delay > 0) {
      const timer = setTimeout(() => setOpen(true), Math.min(60000, delay));
      return () => clearTimeout(timer);
    }
  }, [delay, enabled]);

  // Tandai pesan baru yang belum dibaca saat panel tertutup.
  useEffect(() => {
    if (open) {
      setUnseen(0);
      return;
    }
    setUnseen((n) => (messages.at(-1)?.role === 'assistant' ? n + 1 : n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, busy, error, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const focusTimer = setTimeout(() => textarea.current?.focus(), 260);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(focusTimer);
    };
  }, [open]);

  if (!enabled) return null;

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void send(text);
  }

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(-1), 1800);
    } catch {
      // Penyalinan tidak tersedia — pengguna bisa memilih teks manual.
    }
  }

  return (
    <div className={`relay-bubble relay-bubble-${position} ${open ? 'bubble-open' : ''}`}>
      {open && (
        <div className="bubble-panel" ref={panel} role="dialog" aria-label="Percakapan dengan Relay AI" aria-modal="false">
          <header className="bubble-head">
            <span className="bubble-avatar">
              <RelayMark />
            </span>
            <div className="bubble-title">
              <strong>Relay AI</strong>
              <small>
                <i className={`dot ${provider === 'local' ? 'dot-local' : 'dot-live'}`} aria-hidden="true" />
                {engineLabel(provider, model)}
              </small>
            </div>
            <div className="bubble-actions">
              <button type="button" onClick={reset} disabled={!messages.length || busy} aria-label="Hapus percakapan">
                <Trash2 size={15} />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup chat">
                <Minus size={16} />
              </button>
            </div>
          </header>

          <div className="bubble-log" ref={logRef} role="log" aria-live="polite">
            <div className="bubble-greeting">
              <span className="bubble-emblem">
                <RelayMark />
              </span>
              <p>{greeting}</p>
            </div>

            {messages.map((m, i) => (
              <div className={`bubble-row bubble-row-${m.role}`} key={`${m.at}-${i}`}>
                {m.role === 'assistant' && (
                  <span className="bubble-avatar small" aria-hidden="true">
                    <RelayMark />
                  </span>
                )}
                <div className="bubble-message">
                  <p>{m.content}</p>
                  <footer>
                    <span>{clock(m.at)}</span>
                    {m.role === 'assistant' && (
                      <button type="button" onClick={() => copy(m.content, i)} aria-label="Salin jawaban">
                        {copied === i ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    )}
                  </footer>
                </div>
              </div>
            ))}

            {busy && (
              <div className="bubble-row bubble-row-assistant">
                <span className="bubble-avatar small" aria-hidden="true">
                  <RelayMark />
                </span>
                <div className="bubble-message bubble-typing" role="status">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            {error && (
              <div className="bubble-error" role="alert">
                <p>{error}</p>
                {messages.at(-1)?.role === 'user' && (
                  <button type="button" onClick={() => void send(messages.at(-1)!.content, true)} disabled={busy}>
                    <RotateCcw size={13} />
                    Coba lagi
                  </button>
                )}
              </div>
            )}
          </div>

          {!messages.length && relay.prompts?.length > 0 && (
            <div className="bubble-chips">
              {relay.prompts.slice(0, 3).map((p) => (
                <button key={p} type="button" onClick={() => void send(p)} disabled={busy || !online}>
                  {p}
                </button>
              ))}
            </div>
          )}

          <form
            className="bubble-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="sr-only" htmlFor="relay-bubble-input">
              Tulis pesan untuk Relay
            </label>
            <textarea
              id="relay-bubble-input"
              ref={textarea}
              rows={1}
              value={input}
              maxLength={1200}
              placeholder={online ? 'Tanyakan sesuatu…' : 'Kamu sedang offline'}
              disabled={!online}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {busy ? (
              <button type="button" onClick={stop} aria-label="Hentikan respons" className="bubble-stop">
                <Square size={14} />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim() || !online} aria-label="Kirim pesan">
                <ArrowUp size={18} />
              </button>
            )}
          </form>

          <p className="bubble-foot">
            AI bisa keliru · jawaban disusun dari profil publik {identity.name}. Hindari mengirim data pribadi.
          </p>
        </div>
      )}

      <button
        type="button"
        className="bubble-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Tutup chat Relay AI' : `Buka chat Relay AI — ${launcherLabel}`}
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
        {!open && unseen > 0 && (
          <span className="bubble-unseen" aria-hidden="true">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
        {!open && <span className="bubble-launcher-label">{launcherLabel}</span>}
      </button>
    </div>
  );
}
