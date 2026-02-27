import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesRef = useRef(null);

  // Remove scroll externo do iframe
  useEffect(() => {
    const els = [document.documentElement, document.body];
    els.forEach((el) => {
      el.style.height = '100%';
      el.style.width = '100%';
      el.style.margin = '0';
      el.style.padding = '0';
      el.style.overflow = 'hidden';
    });
  }, []);

  // Scroll interno: rola para a ultima mensagem
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Auto-resize da textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.reply ?? data.error ?? 'Erro.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Erro de conexao. Tente novamente.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div style={s.container}>
      {/* Area de mensagens — scroll INTERNO quando o conteudo exceder */}
      <div ref={messagesRef} style={s.messages}>
        {messages.length === 0 && !loading && (
          <div style={s.empty}>Assistente de estilo EdTech</div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...s.bubble,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? '#804090' : '#ede9f0',
              color: msg.role === 'user' ? '#fff' : '#1e293b',
            }}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div style={{ ...s.bubble, alignSelf: 'flex-start', background: '#ede9f0', color: '#7a6080' }}>
            Consultando o guia...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Linha de input */}
      <div style={s.inputRow}>
        <textarea
          ref={textareaRef}
          style={s.textarea}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Digite sua dúvida sobre o Guia EdTech..."
          disabled={loading}
        />
        <button style={loading ? { ...s.button, opacity: 0.6 } : s.button} onClick={sendMessage} disabled={loading}>
          {loading ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    margin: '0',
    padding: '0',
    fontFamily: "'PT Sans', sans-serif",
    background: '#fff',
    boxSizing: 'border-box',
    overflow: 'hidden',
    border: '1px solid #d8c8e0',
    borderRadius: '12px',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '14px 14px 8px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minHeight: 0,
  },
  empty: {
    textAlign: 'center',
    color: '#b09ac0',
    fontSize: '13px',
    marginTop: 'auto',
    marginBottom: 'auto',
    padding: '20px',
    fontStyle: 'italic',
  },
  bubble: {
    maxWidth: '88%',
    padding: '9px 13px',
    borderRadius: '14px',
    lineHeight: 1.5,
    fontSize: '14px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: "'PT Sans', sans-serif",
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    padding: '10px 12px',
    borderTop: '1px solid #e8dff0',
    background: '#faf8fc',
    flexShrink: 0,
    alignItems: 'flex-end',
    borderRadius: '0 0 12px 12px',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    overflow: 'hidden',
    minHeight: '38px',
    maxHeight: '120px',
    padding: '8px 11px',
    borderRadius: '8px',
    border: '1px solid #c9b8d8',
    fontSize: '14px',
    outline: 'none',
    fontFamily: "'PT Sans', sans-serif",
    lineHeight: '1.45',
    boxSizing: 'border-box',
    background: '#fff',
    color: '#2d1a3a',
  },
  button: {
    background: '#804090',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    fontFamily: "'PT Sans', sans-serif",
    flexShrink: 0,
    alignSelf: 'flex-end',
    minHeight: '38px',
  },
};
