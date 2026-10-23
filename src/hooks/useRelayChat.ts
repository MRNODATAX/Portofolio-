import { useCallback, useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  at?: number;
}

const STORAGE_KEY = 'nodata-relay-thread-v1';
const MAX_HISTORY = 10;

function restore(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content, at: typeof m.at === 'number' ? m.at : Date.now() }));
  } catch {
    return [];
  }
}

/**
 * Logika percakapan Relay yang dipakai bersama oleh panel Bab 06 (AiSandbox)
 * dan gelembung chat melayang (RelayBubble) supaya keduanya konsisten.
 */
export function useRelayChat({ persist = false } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => (persist ? restore() : []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(true);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (!persist) return;
    try {
      if (messages.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Abaikan bila sessionStorage tidak tersedia.
    }
  }, [messages, persist]);

  useEffect(() => {
    let active = true;
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!active || !body) return;
        if (typeof body.aiProvider === 'string') setProvider(body.aiProvider);
        if (typeof body.aiModel === 'string') setModel(body.aiModel);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const stop = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setError('');
  }, []);

  const send = useCallback(
    async (text: string, retry = false) => {
      if (!text.trim() || lock.current || !online) return;
      if (retry && messages.at(-1)?.role !== 'user') return;
      lock.current = true;
      setBusy(true);
      setError('');
      const base = messages.at(-1)?.role === 'user' ? messages.slice(0, -1) : messages;
      const next: ChatMessage[] = retry ? messages : [...base, { role: 'user', content: text.trim(), at: Date.now() }];
      setMessages(next);

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
          body: JSON.stringify({
            messages: next.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 1200) })),
          }),
          signal: abort.signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || typeof body.text !== 'string' || !body.text.trim()) {
          throw new Error(body.error || 'Layanan AI sementara tidak tersedia. Coba lagi nanti.');
        }
        if (typeof body.provider === 'string') setProvider(body.provider);
        setMessages([...next, { role: 'assistant', content: body.text, at: Date.now() }]);
      } catch (err) {
        setError(
          abort.signal.aborted && !timedOut
            ? 'Respons dihentikan. Kamu bisa mencoba lagi.'
            : timedOut
              ? 'Respons terlalu lama. Coba lagi sebentar lagi.'
              : err instanceof Error
                ? err.message
                : 'Koneksi terputus. Coba lagi.'
        );
      } finally {
        clearTimeout(timer);
        lock.current = false;
        setBusy(false);
        controller.current = null;
      }
    },
    [messages, online]
  );

  return { messages, busy, error, online, provider, model, send, reset, stop };
}
