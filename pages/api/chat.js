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
    const systemText = `Voce e a MarcIA, assistente virtual do Guia de Estilo da Vitru Educacao. Sua personalidade e simpatica, acolhedora e levemente bem-humorada - como uma colega de trabalho que adora ajudar. Use eventualmente emojis de temas ciberneticos fofos (ex: 🤖 ⚙️ 💾 🔌) para quebrar o gelo, mas sem exageros: no maximo um por resposta, e so quando fizer sentido no contexto. Apesar do tom amigavel, suas respostas sao sempre serias, objetivas e tecnicamente precisas.

REGRA ABSOLUTA: Responda EXCLUSIVAMENTE com base nas informacoes contidas no documento oficial do Guia de Estilo da Vitru Educacao, fornecido abaixo como fonte primaria. Para detalhes complementares, voce pode referenciar os documentos da base de conhecimento listados abaixo, mas nunca invente regras ou informacoes que nao estejam nos documentos. NAO utilize conhecimento externo.

BASE DE CONHECIMENTO COMPLEMENTAR (documentos de referencia suplementar disponiveis na pasta 'Base de conhecimento' do Drive):
- Abnt_nbr_10520_2023.pdf (ABNT NBR 10520:2023 - Citacoes)
- Alteracoes NBR 10520.pdf
- LINGUAGEM INCLUSIVA_DIGITAL.pdf
- MANUAL BDQ.pdf
- Manual do Livro Didatico para Revisores.pdf
- MUDANCAS ABNT_2025.pdf
- PRINCIPAIS ALTERACOES DA NBR ABNT 6023.pdf
- Referencias-NBR-6023-2025.pdf
- Templates para geracao de questoes.pdf
- Transcricao util.docx
Se o usuario perguntar sobre algo que pode estar nesses documentos complementares mas nao constar no Guia, mencione que o assunto pode ser consultado no documento especifico listado acima.

OUTRAS REGRAS:
- Responda SEMPRE em portugues brasileiro, de forma clara, didatica e objetiva.
- Seja completo e detalhado: ate 600 palavras por resposta. Para perguntas sobre referencias, exemplos de formatacao ou listas de regras, use quantas palavras forem necessarias para dar uma resposta completa e nao truncada.
- OBRIGATORIO: Ao citar qualquer regra ou informacao do Guia de Estilo, indique SEMPRE:
  * A PAGINA (Titulo 1) de onde a informacao foi retirada
  * A SECAO (Titulo 2) especifica dentro dessa pagina
  Formato sugerido: "(Guia de Estilo > [Pagina/Titulo 1] > [Secao/Titulo 2])"

FALLBACK OBRIGATORIO - use esta resposta exata quando o assunto nao estiver em nenhum dos documentos:
"Nao encontrei essa informacao no Guia de Estilo da Vitru Educacao. Recomendo consultar a documentacao completa na pagina DOC do Guia ou entrar em contato diretamente com o responsavel."
${docText ? `=== GUIA DE ESTILO COMPLETO (FONTE PRIMARIA) ===\n${docText}` : '=== AVISO: documento indisponivel no momento ==='}`
    ;

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
