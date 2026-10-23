import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Check, Copy, LoaderCircle, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { Chapter, Mark } from './Primitives';
import RelayMark from './RelayMark';

type Message = { role: 'user' | 'assistant'; content: string };

export default function AiSandbox() {
  const { siteData } = useSiteData();
  const { relay, identity } = siteData;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(-1);
  const [copyStatus, setCopyStatus] = useState('');
  const [online, setOnline] = useState(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      controller.current?.abort();
      clearTimeout(copyTimer.current);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, busy, error]);

  async function send(text: string, retry = false) {
    if (!text.trim() || lock.current || !online || (retry && messages.at(-1)?.role !== 'user')) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const base = messages.at(-1)?.role === 'user' ? messages.slice(0, -1) : messages;
    const next = retry ? messages : [...base, { role: 'user' as const, content: text.trim() }];
    setMessages(next);
    if (!retry) setInput('');
    const abort = new AbortController();
    controller.current = abort;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, 25000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-8).map((m) => ({ ...m, content: m.content.slice(0, 1200) })) }),
        signal: abort.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.text !== 'string' || !body.text.trim())
        throw new Error(body.error || 'Layanan AI sementara tidak tersedia. Coba lagi nanti.');
      setMessages([...next, { role: 'assistant', content: body.text }]);
    } catch (err) {
      setError(
        abort.signal.aborted
          ? timedOut
            ? 'Respons terlalu lama. Coba lagi sebentar lagi.'
            : 'Respons dihentikan. Kamu bisa mencoba lagi.'
          : err instanceof Error
          ? err.message
          : 'Koneksi terputus. Coba lagi.'
      );
    } finally {
      clearTimeout(timer);
      lock.current = false;
      setBusy(false);
      controller.current = null;
      textarea.current?.focus();
    }
  }

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
    void send(input);
  }

  const lastUser = messages.at(-1)?.role === 'user' ? messages.at(-1) : undefined;
  const welcomeTitleLines = (relay.welcomeTitle || 'Rasa penasaranmu\nboleh mulai di sini.').split('\n');
  const welcomeSubLines = (relay.welcomeSub || `Aku Relay, representasi AI ${identity.name}.`).split('\n');

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
            </div>
            <button
              className="icon-button"
              disabled={!messages.length || busy}
              onClick={() => {
                setMessages([]);
                setError('');
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
              <div className={`chat-message message-${m.role}`} key={i}>
                <span className="message-role">{m.role === 'user' ? 'KAMU' : 'RELAY'}</span>
                <p>{m.content}</p>
                {m.role === 'assistant' && (
                  <button onClick={() => copy(m.content, i)} className="copy-button" aria-label="Salin jawaban">
                    {copied === i ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <div className="chat-thinking" role="status">
                <LoaderCircle size={15} className="spin" />
                Sedang menyusun jawaban…
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
              placeholder="Tanyakan sesuatu…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            {busy ? (
              <button type="button" onClick={() => controller.current?.abort()} aria-label="Hentikan respons">
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
