import './App.css';
import './chat.css';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendChat } from './api/chat';

type ChatMessage = {
  role: 'user' | 'assistant';
  kind: 'text' | 'markdown' | 'json';
  text?: string;
  json?: unknown;
};

function MessageContent({ m }: { m: ChatMessage }) {
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
  const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  function toAssistantMessage(data: unknown, contentType?: string): ChatMessage {
    if (contentType?.includes('application/json')) {
      try {
        return { role: 'assistant', kind: 'json', json: typeof data === 'string' ? JSON.parse(data) : data };
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
        return { role: 'assistant', kind: 'json', json: parsed };
      } catch {
        return { role: 'assistant', kind: 'markdown', text: data };
      }
    }
    if (data && typeof data === 'object') {
      const anyData = data as Record<string, unknown>;
      if (typeof anyData.reply === 'string') {
        return { role: 'assistant', kind: 'markdown', text: anyData.reply };
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

  return (
    <div className="App">
      <header className="App-header">
        <p>AI Chatbot</p>
      </header>

      {/* Floating chat widget */}
      <button
        type="button"
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="chat-launcher"
        onClick={() => setOpen(o => !o)}
      >
        {/* Modern chat/robot icon */}
        <svg className="icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path fill="#000" d="M12 2a1 1 0 0 1 1 1v1.05A7.5 7.5 0 0 1 20.5 11v3.5A3.5 3.5 0 0 1 17 18h-1.382l-2.724 2.724A1.75 1.75 0 0 1 9 19.75V18H7a3.5 3.5 0 0 1-3.5-3.5V11A7.5 7.5 0 0 1 11 4.05V3a1 1 0 0 1 1-1Zm-3.75 9.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm7.5 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"/>
        </svg>
      </button>

      <div className={`chat-overlay${open ? ' show' : ''}`} onClick={() => setOpen(false)} />

      <div className={`chat-widget mobile-frame${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Chat widget">
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
              <div key={i} className={m.role === 'user' ? 'bubble bubble-user' : 'bubble bubble-assistant'}>
                <MessageContent m={m} />
              </div>
            ))}
          </div>
          {error && <div className="chat-error" role="alert">{error}</div>}
        </div>
        <form className="chat-widget-input" onSubmit={onSubmit}>
          <input
            className="input prompt-input"
            value={userPrompt}
            onChange={e => setUserPrompt(e.target.value)}
            placeholder="Type your message..."
            aria-label="Message"
          />
          <button className="btn send-btn" type="submit" disabled={loading}>{loading ? '...' : 'Send'}</button>
        </form>
      </div>
    </div>
  );
}
