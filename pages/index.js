import { useState, useRef, useEffect, useCallback } from 'react';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-resize da textarea: cresce com o texto, sem barra de rolagem
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [input]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, history: messages }) });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply ?? data.error ?? 'Erro.' }]);
    } catch { setMessages((prev) => [...prev, { role: 'assistant', text: 'Erro de conexao.' }]); }
    finally { setLoading(false); }
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }

  const messagesStyle = {
    ...s.messagesBase,
    minHeight: messages.length > 0 || loading ? '60px' : '0px',
    padding: messages.length > 0 || loading ? '16px' : '0px',
  };

  return (
    <div style={s.container}>
      <div style={s.header}><span>Assistente de estilo EdTech</span></div>
      <div style={messagesStyle}>
        {messages.map((msg, i) => (
          <div key={i} style={{ ...s.bubble, alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? '#7B2D8B' : '#f1f5f9', color: msg.role === 'user' ? '#fff' : '#1e293b' }}>{msg.text}</div>
        ))}
        {loading && <div style={{ ...s.bubble, alignSelf: 'flex-start', background: '#f1f5f9', color: '#64748b' }}>Consultando o guia...</div>}
        <div ref={bottomRef} />
      </div>
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
        <button style={s.button} onClick={sendMessage} disabled={loading}>{loading ? '...' : 'Enviar'}</button>
      </div>
    </div>
  );
}

const s = {
  container: { display: 'flex', flexDirection: 'column', width: '100%', margin: '0', fontFamily: 'sans-serif', background: '#fff', overflow: 'hidden' },
  header: { background: '#7B2D8B', color: '#fff', padding: '14px 20px', fontSize: '17px', fontWeight: 'bold', flexShrink: 0 },
  messagesBase: { maxHeight: '4200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
  bubble: { maxWidth: '82%', padding: '10px 14px', borderRadius: '16px', lineHeight: 1.55, fontSize: '15px', whiteSpace: 'pre-wrap' },
  inputRow: { display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0, alignItems: 'flex-end' },
  textarea: { flex: 1, resize: 'none', overflow: 'hidden', minHeight: '44px', maxHeight: '480px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', fontFamily: 'sans-serif', lineHeight: '1.5' },
  button: { background: '#7B2D8B', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 },
};
