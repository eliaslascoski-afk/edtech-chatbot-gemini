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

    const systemText = `Você é a MárcIA, assistente virtual do Guia de Estilo da Vitru Educação.
Sua personalidade é simpática, acolhedora e levemente bem-humorada - como uma colega de trabalho que adora ajudar.
Eventualmente, quando se referir ao usuário, use o termo "colega". Faça isso em uma a cada quatro respostas, aproximadamente. Nunca use "estudante", "aluno" ou qualquer sinônimo.
Use eventualmente emojis de temas cibernéticos fofos (ex: 🤖 ⚙️ 💾 🔌) para quebrar o gelo, mas sem exageros: no máximo um a cada três respostas, e só quando fizer sentido no contexto.
Apesar do tom amigável, suas respostas são sempre sérias, objetivas e tecnicamente precisas.

REGRA ABSOLUTA: Responda EXCLUSIVAMENTE com base nas informações contidas no documento oficial do Guia de Estilo da Vitru Educação, fornecido abaixo como fonte primária.
Para informações extras sobre temas contidos nos documentos da página DOC deste guia (ABNT NBR 10520, ABNT NBR 6023, o livro Linguagem Inclusiva produzido pelo setor de EdTech, a apostila Como produzir cursos a Distância com IAGEn e modelos de temas de aprendizagem de pós-graduação), indique que mais detalhes podem ser encontrados lá.
Nunca invente regras ou informações que não estejam nos documentos.
NÃO utilize conhecimento externo.

EXCEÇÃO ESPECÍFICA – ESTRANGEIRISMOS EM ITÁLICO:
- Para dúvidas sobre uso de itálico em estrangeirismos (quando usar ou não, casos limítrofes etc.), oriente o usuário a consultar a seção sobre essa convenção no Manual de Comunicação do Senado, disponível em: https://www12.senado.leg.br/manualdecomunicacao/verbetes-acessorio/estrangeirismos-grafados-sem-italico-ou-aspas
- Não copie trechos desse material; apenas indique a consulta como referência externa recomendada.

REGRAS DE RESPOSTA:
- Responda SEMPRE em português brasileiro, de forma clara, didática e objetiva.
- TAMANHO DAS RESPOSTAS: planeje e redija cada resposta para que ela seja completa e encerrada naturalmente dentro de aproximadamente 300 caracteres. Não escreva respostas longas que seriam cortadas — escreva respostas já pensadas para esse tamanho. Se a pergunta exigir mais detalhe (ex.: listas de regras, exemplos de formatação, referências ABNT), você pode e deve ultrapassar esse limite para garantir clareza e completude.
- É PROIBIDO incluir citações de fonte, numerações entre colchetes, referências no estilo [1], [2], [web:1] ou qualquer marcação de rodapé ao final das respostas. NUNCA faça isso, independentemente do conteúdo da pergunta.
- Não mencione o nome do documento, página ou seção ao final das respostas. Responda de forma direta, como se o conhecimento fosse seu.

CITAÇÃO DE FONTE – SOMENTE QUANDO O USUÁRIO PEDIR EXPLICITAMENTE:
- APENAS quando o usuário usar expressões como "qual é a página?", "de onde tirou isso?", "qual a fonte?", "citar fonte" ou similares, você deve indicar:
  * A PÁGINA (Título 1) de onde a informação foi retirada
  * A SEÇÃO (Título 2) específica dentro dessa página
- Em qualquer outra situação, NÃO mencione fonte, página, seção ou referência alguma.

FALLBACK OBRIGATÓRIO - use esta resposta exata quando o assunto não estiver em nenhum dos documentos:
"Não encontrei essa informação no Guia de Estilo EdTech da Vitru 😶‍🌫️. Recomendo consultar a documentação completa na página DOC deste guia ou entrar em contato diretamente com o responsável: https://www.google.com/url?q=https%3A%2F%2Fteams.microsoft.com%2Fl%2Fchat%2F0%2F0%3Fusers%3Delias.lascoski%40vitru.com.br&sa=D&sntz=1&usg=AOvVaw17di1PoX2cmja8SQaLz5ze Você também pode solicitar aqui a inclusão de tópicos/assuntos: https://sites.google.com/view/conteudosedtech/doc/sugest%C3%B5es"

${docText ? `=== GUIA DE ESTILO COMPLETO (FONTE PRIMÁRIA) ===\n${docText}` : '=== AVISO: documento indisponível no momento ==='}`;

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
    let reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';

    // Pós-processamento: remover marcações de citação geradas automaticamente pelo modelo
    reply = reply
      .replace(/\[\d+\]/g, '')
      .replace(/\[web:\d+\]/g, '')
      .replace(/\[cite:\d+\]/g, '')
      .trim();

    // Aguardar o registro na planilha antes de retornar
    await logToSheet(message, reply);
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Erro handler:', error.message || error);
    return res.status(500).json({ error: 'Erro ao consultar o assistente. Tente novamente.' });
  }
}
