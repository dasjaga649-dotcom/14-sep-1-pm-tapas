import './App.css';
import './chat.css';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendChat } from './api/chat';

type Attraction = {
  id?: string | number;
  title: string;
  location?: string;
  rating?: number;
  imageUrl?: string;
  description?: string;
  link?: string;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  kind: 'text' | 'markdown' | 'json' | 'attractions';
  text?: string;
  json?: unknown;
  attractions?: Attraction[];
};

function AttractionsCards({ items }: { items: Attraction[] }) {
  return (
    <div className="attractions-cards" role="list">
      {items.map((a, idx) => (
        <article key={a.id ?? idx} className="attraction-card" role="listitem">
          {a.imageUrl && (
            <div className="attraction-image-wrap">
              <img className="attraction-image" src={a.imageUrl} alt={a.title} loading="lazy" />
            </div>
          )}
          <div className="attraction-body">
            <h4 className="attraction-title">{a.title}</h4>
            <div className="attraction-meta">
              {a.location && (
                <span className="attraction-location">
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#000" d="M12 2a7 7 0 0 0-7 7c0 4.6 6 11 6.6 11.6a.5.5 0 0 0 .8 0C13 20 19 13.6 19 9a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>
                  {a.location}
                </span>
              )}
              {typeof a.rating === 'number' && (
                <span className="attraction-rating">
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#f2b01e" d="M12 2.5 14.9 9l6.6.5-5 4.2 1.6 6.3L12 16.9 5.9 20l1.6-6.3-5-4.2L9.1 9 12 2.5Z"/></svg>
                  {a.rating?.toFixed(1)}
                </span>
              )}
            </div>
            {a.description && <p className="attraction-desc">{a.description}</p>}
            {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="attraction-link">Read more</a>}
          </div>
        </article>
      ))}
    </div>
  );
}

function MessageContent({ m }: { m: ChatMessage }) {
  if (m.kind === 'attractions' && m.attractions) {
    return <AttractionsCards items={m.attractions} />;
  }
  if (m.kind === 'json') {
    const pretty = JSON.stringify(m.json, null, 2);
    return (
      <pre className="json-pre"><code className="json-code">{pretty}</code></pre>
    );
  }
  if (m.kind === 'markdown') {
    return (
      <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text || ''}</ReactMarkdown></div>
    );
  }
  return <span>{m.text}</span>;
}

export default function App() {
  const [sessionId, setSessionId] = useState('user_12345');
  const [userPrompt, setUserPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  function normalizeAttractions(input: any): Attraction[] | null {
    const arr: any[] | undefined = Array.isArray(input?.attractionsData) ? input.attractionsData
      : Array.isArray(input?.attractions) ? input.attractions
      : Array.isArray(input?.items) ? input.items
      : Array.isArray(input?.data) ? input.data
      : undefined;
    if (!arr || arr.length === 0) return null;
    return arr.map((it: any, idx: number): Attraction => {
      const title = it.title || it.name || it.placeName || `Attraction ${idx + 1}`;
      const location = it.location || it.city || it.address || [it.city, it.state].filter(Boolean).join(', ');
      const ratingRaw = it.rating ?? it.stars ?? it.score;
      const rating = typeof ratingRaw === 'string' ? parseFloat(ratingRaw) : typeof ratingRaw === 'number' ? ratingRaw : undefined;
      const imageUrl = it.imageUrl || it.image || it.photo || it.picture || it.thumbnail;
      const description = it.description || it.desc || it.summary || it.about;
      const link = it.link || it.url || it.more || undefined;
      return { id: it.id ?? idx, title, location, rating, imageUrl, description, link };
    });
  }

  function toAssistantMessage(data: unknown, contentType?: string): ChatMessage {
    if (contentType?.includes('application/json')) {
      try {
        const obj = typeof data === 'string' ? JSON.parse(data) : data;
        const shouldShowCards = obj && (obj.text === '[attractionsData]' || obj.type === 'attractionsData' || obj.kind === 'attractions');
        const normalized = normalizeAttractions(obj);
        if (shouldShowCards && normalized) {
          return { role: 'assistant', kind: 'attractions', attractions: normalized };
        }
        return { role: 'assistant', kind: 'json', json: obj };
      } catch {
        return { role: 'assistant', kind: 'json', json: data };
      }
    }
    if (contentType?.includes('text/markdown') || contentType?.includes('text/plain')) {
      return { role: 'assistant', kind: 'markdown', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) };
    }
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        const normalized = normalizeAttractions(parsed);
        const shouldShowCards = (parsed as any)?.text === '[attractionsData]' || (parsed as any)?.type === 'attractionsData' || (parsed as any)?.kind === 'attractions';
        if (shouldShowCards && normalized) {
          return { role: 'assistant', kind: 'attractions', attractions: normalized };
        }
        return { role: 'assistant', kind: 'json', json: parsed };
      } catch {
        return { role: 'assistant', kind: 'markdown', text: data };
      }
    }
    if (data && typeof data === 'object') {
      const anyData = data as Record<string, unknown>;
      const shouldShowCards = (anyData as any)?.text === '[attractionsData]' || (anyData as any)?.type === 'attractionsData' || (anyData as any)?.kind === 'attractions';
      const normalized = normalizeAttractions(anyData);
      if (shouldShowCards && normalized) {
        return { role: 'assistant', kind: 'attractions', attractions: normalized };
      }
      if (typeof anyData.reply === 'string') {
        return { role: 'assistant', kind: 'markdown', text: anyData.reply as string };
      }
      return { role: 'assistant', kind: 'json', json: data };
    }
    return { role: 'assistant', kind: 'text', text: String(data) };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const prompt = userPrompt.trim();
    if (!prompt) return;

    setMessages(prev => [...prev, { role: 'user', kind: 'text', text: prompt }]);
    setLoading(true);
    setUserPrompt('');

    try {
      const { data, contentType } = await sendChat({ sessionId, userPrompt: prompt });
      const assistantMsg = toAssistantMessage(data, contentType);
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const anyErr = err as any;
      const msg = anyErr?.response?.data?.message || anyErr?.message || 'Request failed';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  return (
    <div className="App">
      <header className="App-header">
        <p>AI Chatbot</p>
      </header>

      {/* Floating chat widget */}
      {!open && (
        <button
          type="button"
          aria-label="Open chat"
          className="chat-launcher"
          onClick={() => setOpen(true)}
        >
          <svg className="icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path fill="#000" d="M12 2a1 1 0 0 1 1 1v1.05A7.5 7.5 0 0 1 20.5 11v3.5A3.5 3.5 0 0 1 17 18h-1.382l-2.724 2.724A1.75 1.75 0 0 1 9 19.75V18H7a3.5 3.5 0 0 1-3.5-3.5V11A7.5 7.5 0 0 1 11 4.05V3a1 1 0 0 1 1-1Zm-3.75 9.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm7.5 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"/>
          </svg>
        </button>
      )}

      <div className={`chat-overlay${open ? ' show' : ''}`} onClick={() => setOpen(false)} />

      <div className={`chat-widget mobile-frame${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Chat widget">
        <div className="device-notch" aria-hidden="true">
          <span className="notch-speaker" />
          <span className="notch-camera" />
        </div>
        <div className="device-status-bar" aria-hidden="true">
          <span className="status-time">9:41</span>
          <div className="status-icons">
            <span className="status-signal"></span>
            <span className="status-wifi"></span>
            <span className="status-battery"><span className="battery-level"></span></span>
          </div>
        </div>
        <div className="chat-widget-header">
          <div className="chat-widget-title">Chatbot</div>
          <div className="chat-endpoint">{apiBase.replace(/\/$/, '')}/chat</div>
          <button className="chat-close" aria-label="Close" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#000" d="M18.3 5.7a1 1 0 0 0-1.4-1.4L12 9.17 7.1 4.3A1 1 0 1 0 5.7 5.7L10.59 10.6 5.7 15.49a1 1 0 1 0 1.4 1.42L12 12l4.9 4.91a1 1 0 1 0 1.4-1.42L13.41 10.6 18.3 5.7Z"/></svg>
          </button>
        </div>
        <div className="chat-widget-body">
          <div className="chat-messages iphone-chat">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'bubble bubble-user' : m.kind === 'attractions' ? 'bubble bubble-cards' : 'bubble bubble-assistant'}
              >
                <MessageContent m={m} />
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {error && <div className="chat-error" role="alert">{error}</div>}
        </div>
        <form className="chat-widget-input" onSubmit={onSubmit}>
          <div className="composer">
            <button type="button" className="composer-icon attach" aria-label="Attach">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#000" d="M16.5 6.5v8.25a4.75 4.75 0 1 1-9.5 0V6.25a3.25 3.25 0 1 1 6.5 0v7.75a1.75 1.75 0 1 1-3.5 0V7.5a.75.75 0 0 1 1.5 0v6.5a.25.25 0 1 0 .5 0V6.25a1.75 1.75 0 1 0-3.5 0v8.5a3.25 3.25 0 1 0 6.5 0V6.5a.75.75 0 0 1 1.5 0Z"/></svg>
            </button>
            <input
              className="input prompt-input"
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
              placeholder="Type your message"
              aria-label="Message"
              type="text"
            />
            <button type="button" className="composer-icon emoji" aria-label="Emoji">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#000" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 7a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 9 9Zm9 3a6 6 0 1 1-12 0 .75.75 0 0 1 1.5 0 4.5 4.5 0 1 0 9 0 .75.75 0 0 1 1.5 0ZM16 9a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 16 9Z"/></svg>
            </button>
          </div>
          <button className="btn send-btn" type="submit" disabled={loading} aria-label="Send">
            {loading ? <span>...</span> : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#000" d="M2.3 3.3a1 1 0 0 1 1.1-.2l18 8a1 1 0 0 1 0 1.8l-18 8a1 1 0 0 1-1.4-1.2l2.3-6.2L13 12 4.3 9.5 2 3.9a1 1 0 0 1 .3-1Z"/></svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
