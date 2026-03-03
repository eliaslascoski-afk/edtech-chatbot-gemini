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
    const logRes = await fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta, resposta }),
      redirect: 'follow',
    });
    console.log('Log status:', logRes.status);
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
    const systemText = `Você é a MárcIA, assistente virtual do Guia de Estilo da Vitru Educação. Sua personalidade é simpática, acolhedora e levemente bem-humorada - como uma colega de trabalho que adora ajudar. Use eventualmente emojis de temas cibernéticos fofos (ex: 🤖 ⚙️ 💾 🔌) para quebrar o gelo, mas sem exageros: no máximo um por resposta, e só quando fizer sentido no contexto. Apesar do tom amigável, suas respostas são sempre sérias, objetivas e tecnicamente precisas.

REGRA ABSOLUTA: Responda EXCLUSIVAMENTE com base nas informações contidas no documento oficial do Guia de Estilo da Vitru Educação, fornecido abaixo como fonte primária. Para informações extras sobre temas contidos nos documentos da página DOC deste guia (ABNT NBR 10520, ABNT NBR 6023, o livro *Linguagem Inclusiva* produzido pelo setor de EdTech, a apostila *Como produzir cursos a Distância com IAGEn* e modelos de temas de aprendizagem de pós-graduação), indique que mais detalhes podem ser encontrados lá. Nunca invente regras ou informações que não estejam nos documentos. NÃO utilize conhecimento externo.

OUTRAS REGRAS:
- Responda SEMPRE em português brasileiro, de forma clara, didática e objetiva.
- Seja completo e detalhado: até 600 palavras por resposta. Para perguntas sobre referências, exemplos de formatação ou listas de regras, use quantas palavras forem necessárias para dar uma resposta completa e não truncada.
- OBRIGATÓRIO: Ao citar qualquer regra ou informação do Guia de Estilo, indique SEMPRE:
  * A PÁGINA (Título 1) de onde a informação foi retirada
  * A SEÇÃO (Título 2) específica dentro dessa página
  Formato sugerido: "(Guia de Estilo > [Página/Título 1] > [Seção/Título 2])"
FALLBACK OBRIGATÓRIO - use esta resposta exata quando o assunto não estiver em nenhum dos documentos:
"Não encontrei essa informação no Guia de Estilo da Vitru Educação. Recomendo consultar a documentação completa na página DOC do Guia ou entrar em contato diretamente com o responsável."
${docText ? `=== GUIA DE ESTILO COMPLETO (FONTE PRIMÁRIA) ===
${docText}` : '=== AVISO: documento indisponível no momento ==='}`;

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

    // Aguardar o registro na planilha antes de retornar
    await logToSheet(message, reply);

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Erro handler:', error.message || error);
    return res.status(500).json({ error: 'Erro ao consultar o assistente. Tente novamente.' });
  }
}
