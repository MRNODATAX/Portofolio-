import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Check, Copy, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { Chapter, Mark } from './Primitives';
import RelayMark from './RelayMark';
import { useRelayChat } from '../hooks/useRelayChat';

export default function AiSandbox() {
  const { siteData } = useSiteData();
  const { relay, identity } = siteData;

  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(-1);
  const [copyStatus, setCopyStatus] = useState('');
  const { messages, busy, error, online, provider, model, send, reset, stop } = useRelayChat();
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const end = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, busy, error]);

  async function copy(text: string, i: number) {
    clearTimeout(copyTimer.current);
    setCopyStatus('');
    setCopied(-1);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      copyTimer.current = setTimeout(() => setCopied(-1), 1800);
    } catch {
      setCopyStatus('Penyalinan tidak tersedia. Pilih teks untuk menyalinnya.');
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void send(text);
    textarea.current?.focus();
  }

  const lastUser = messages.at(-1)?.role === 'user' ? messages.at(-1) : undefined;
  const welcomeTitleLines = (relay.welcomeTitle || 'Rasa penasaranmu\nboleh mulai di sini.').split('\n');
  const welcomeSubLines = (relay.welcomeSub || `Aku Relay, representasi AI ${identity.name}.`).split('\n');
  const engine = provider === 'gemini' ? `Gemini${model ? ` · ${model}` : ''}` : provider === 'upstream' ? `LLM${model ? ` · ${model}` : ''}` : provider === 'webhook' ? 'Webhook AI' : 'Pengetahuan lokal';

  return (
    <section className="lab section-pad" id="lab" aria-labelledby="lab-title">
      <div className="wrap lab-layout">
        <div className="lab-intro">
          <Chapter number="06">{relay.chapterTitle}</Chapter>
          <h2 id="lab-title">
            {relay.headingLine1}
            <br />
            to <em>{relay.headingItalic}</em>
          </h2>
          <p>{relay.intro}</p>
          <div className="lab-signature">
            <Mark />
            <div>
              <strong>{identity.name}, in conversation.</strong>
              <span>Representasi AI · bukan orang asli</span>
            </div>
          </div>
          <p className="lab-note">
            AI bisa keliru. Respons disusun berdasarkan profil publik {identity.fullName} ({identity.name}). Hindari mengirim data pribadi atau rahasia; riwayat hanya tersimpan selama halaman ini terbuka.
          </p>
        </div>
        <div className="chat-panel">
          <div className="chat-header">
            <div>
              <RelayMark />
              <span>Relay</span>
              <small>Personal AI</small>
              {provider && (
                <small className="chat-engine" title={model ? `Model: ${model}` : undefined}>
                  {engine}
                </small>
              )}
            </div>
            <button
              className="icon-button"
              disabled={!messages.length || busy}
              onClick={() => {
                reset();
                textarea.current?.focus();
              }}
              aria-label="Hapus percakapan"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="chat-log" ref={log} role="log" aria-live="polite" aria-label="Percakapan dengan Relay">
            {!messages.length && (
              <div className="chat-welcome">
                <span className="chat-emblem">
                  <RelayMark />
                </span>
                <h3>
                  {welcomeTitleLines.map((l, idx) => (
                    <span key={idx}>
                      {idx > 0 && <br />}
                      {l}
                    </span>
                  ))}
                </h3>
                <p>
                  {welcomeSubLines.map((l, idx) => (
                    <span key={idx}>
                      {idx > 0 && <br />}
                      {l}
                    </span>
                  ))}
                </p>
                <div className="chat-prompts">
                  {relay.prompts.map((p) => (
                    <button key={p} onClick={() => send(p)} disabled={busy || !online}>
                      {p}
                      <ArrowUp size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div className={`bubble-row bubble-row-${m.role}`} key={i}>
                {m.role === 'assistant' && (
                  <span className="bubble-avatar small" aria-hidden="true">
                    <RelayMark />
                  </span>
                )}
                <div className="bubble-message">
                  <p>{m.content}</p>
                  {m.role === 'assistant' && (
                    <footer>
                      <button onClick={() => copy(m.content, i)} aria-label="Salin jawaban">
                        {copied === i ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </footer>
                  )}
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
              <div className="chat-error" role="alert">
                <p>{error}</p>
                {lastUser && (
                  <button onClick={() => send(lastUser.content, true)} disabled={busy || !online}>
                    <RotateCcw size={14} />
                    Coba lagi
                  </button>
                )}
              </div>
            )}
            <div ref={end} />
          </div>
          {!online && (
            <p className="offline-note" role="status">
              Kamu sedang offline. Percakapan dapat dilanjutkan setelah tersambung.
            </p>
          )}
          {copyStatus && (
            <p className="offline-note" role="status">
              {copyStatus}
            </p>
          )}
          <form className="chat-form" onSubmit={submit}>
            <label className="sr-only" htmlFor="chat-input">
              Tulis pesan untuk Relay
            </label>
            <textarea
              id="chat-input"
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
                  const text = input.trim();
                  if (!text || busy) return;
                  setInput('');
                  void send(text);
                }
              }}
            />
            {busy ? (
              <button type="button" onClick={stop} aria-label="Hentikan respons">
                <Square size={15} />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim() || !online} aria-label="Kirim pesan">
                <ArrowUp size={19} />
              </button>
            )}
          </form>
          <div className="chat-footer">
            <span>Enter untuk kirim · Shift + Enter untuk baris baru</span>
            <span>{input.length}/1200</span>
          </div>
        </div>
      </div>
    </section>
  );
}
