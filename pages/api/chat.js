const DOC_ID = '1TLANzH4fjZ7RZN7i5cj_G4yiwWRCxL5l';
const MODEL = 'gemini-2.5-flash';
const LOG_URL = 'https://script.google.com/macros/s/AKfycbzVOHu9y0WdjnJiiPVJ-HIRZkyIMCvp8My_-4WSiAX1wE-aHcjD6tA-26tl8y6squp2/exec';

let cachedDoc = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

async function fetchGuiaDoc() {
  const now = Date.now();
  if (cachedDoc && now - cacheTime < CACHE_TTL) return cachedDoc;
  try {
    const url = `https://docs.google.com/document/d/${DOC_ID}/export?format=txt`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'EdTechBot/1.0' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    cachedDoc = text;
    cacheTime = now;
    return cachedDoc;
  } catch (e) {
    console.error('Erro ao buscar Google Doc:', e.message);
    return null;
  }
}

async function logToSheet(pergunta, resposta) {
  try {
    await fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta, resposta }),
      redirect: 'follow',
    });
  } catch (e) {
    console.error('Erro ao registrar na planilha:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Mensagem ausente' });
  try {
    const docText = await fetchGuiaDoc();
    const systemText = `Voce e o Assistente EdTech do Guia de Estilo da Vitru Educacao.
REGRA ABSOLUTA: Responda EXCLUSIVAMENTE com base nas informacoes contidas no documento oficial do Guia de Estilo da Vitru Educacao, fornecido abaixo. NAO utilize conhecimento externo. Nunca invente regras que nao estejam escritas no documento.
OUTRAS REGRAS:
- Responda SEMPRE em portugues brasileiro, de forma clara, didatica e objetiva.
- Seja completo e detalhado: ate 600 palavras por resposta. Para perguntas sobre referencias, exemplos de formatacao ou listas de regras, use quantas palavras forem necessarias para dar uma resposta completa e nao truncada.
- Quando citar uma regra, indique de qual secao do guia ela vem, se possivel.
FALLBACK OBRIGATORIO - use esta resposta exata quando o assunto nao estiver no documento:
"Nao encontrei essa informacao no Guia de Estilo da Vitru Educacao. Recomendo consultar a documentacao completa na pagina DOC do Guia ou entrar em contato diretamente com o responsavel."
${docText ? `=== GUIA DE ESTILO COMPLETO ===\n${docText}` : '=== AVISO: documento indisponivel no momento ==='}` ;
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const rawHistory = (history || []).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));
    while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
      rawHistory.shift();
    }
    const contents = [
      ...rawHistory,
      { role: 'user', parts: [{ text: message }] },
    ];
    const body = {
      system_instruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: { maxOutputTokens: 2048 },
    };
    const apiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Erro API Gemini:', apiRes.status, errText);
      return res.status(500).json({ error: 'Erro ao consultar o assistente. Tente novamente.' });
    }
    const data = await apiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
    // Registrar na planilha (sem await para nao atrasar a resposta)
    logToSheet(message, reply);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Erro handler:', error.message || error);
    return res.status(500).json({ error: 'Erro ao consultar o assistente. Tente novamente.' });
  }
}
