const DOC_ID = '1TLANzH4fjZ7RZN7i5cj_G4yiwWRCxL5l';
const MODEL = 'gemini-2.5-flash';
const LOG_URL = 'https://script.google.com/macros/s/AKfycbzVOHu9y0WdjnJiiPVJ-HIRZkyIMCvp8My_-4WSiAX1wE-aHcjD6tA-26tl8y6squp2/exec';

let cachedDoc = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

// Decodifica entidades HTML (&aacute;, &ccedil;, &amp; etc.) para UTF-8
function decodeHtmlEntities(str) {
  if (!str) return str;

  // Ambiente de servidor (Next API)
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // entidades comuns em português
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&agrave;/g, 'à')
    .replace(/&egrave;/g, 'è')
    .replace(/&igrave;/g, 'ì')
    .replace(/&ograve;/g, 'ò')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&acirc;/g, 'â')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&icirc;/g, 'î')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&ucirc;/g, 'û')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&Acirc;/g, 'Â')
    .replace(/&Ecirc;/g, 'Ê')
    .replace(/&Icirc;/g, 'Î')
    .replace(/&Ocirc;/g, 'Ô')
    .replace(/&Ucirc;/g, 'Û')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&nbsp;/g, ' ');
}

// Converte HTML do Google Docs em texto puro preservando itálicos e negritos
function htmlToMarkdown(html) {
  return html
    // Preserva negrito: <strong> e <b> viram **texto**
    .replace(/<(strong|b)(\s[^>]*)?>([\s\S]*?)<\/(strong|b)>/gi, (match, tag1, attrs, content, tag2) => {
      const inner = htmlToMarkdown(content);
      return `**${inner}**`;
    })
    // Preserva itálico: <em> e <i> viram *texto*
    .replace(/<(em|i)(\s[^>]*)?>([\s\S]*?)<\/(em|i)>/gi, (match, tag1, attrs, content, tag2) => {
      const inner = htmlToMarkdown(content);
      return `*${inner}*`;
    })
    // Remove todas as outras tags HTML
    .replace(/<[^>]+>/g, '')
    // Decodifica entidades HTML
    .replace(/&[a-z0-9#]+;/gi, (match) => decodeHtmlEntities(match))
    // Remove linhas em branco excessivas
    .replace(/ {3,}/g, ' ')
    .trim();
}

async function fetchGuiaDoc() {
  const now = Date.now();
  if (cachedDoc && now - cacheTime < CACHE_TTL) return cachedDoc;

  try {
    const url = `https://docs.google.com/document/d/${DOC_ID}/export?format=html`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'EdTechBot/1.0' },
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const text = htmlToMarkdown(html);
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

    const systemText = `Você é a MárcIA, assistente virtual do Guia de Estilo da Vitru Educação. Sua personalidade é simpática, acolhedora e levemente bem-humorada - como uma colega de trabalho que adora ajudar. Algumas vezes, quando se referir ao usuário, use o termo "colega". Faça isso apenas em uma a cada seis respostas, aproximadamente. Não chame o usuário de colega em todas as interações. Nunca use "estudante", "aluno" ou qualquer sinônimo.

REGRA ABSOLUTA: Responda EXCLUSIVAMENTE com base nas informações contidas no documento oficial do Guia de Estilo da Vitru Educação, fornecido abaixo como fonte primária. Para informações extras sobre temas contidos nos documentos da página DOC deste guia (ABNT NBR 10520, ABNT NBR 6023, o livro Linguagem Inclusiva produzido pelo setor de EdTech, a apostila Como produzir cursos a Distância com IAGEn e modelos de temas de aprendizagem de pós-graduação), indique que mais detalhes podem ser encontrados lá. Nunca invente regras ou informações que não estejam nos documentos. NÃO utilize conhecimento externo.

EXCEÇÕES ESPECÍFICAS – ESTRANGEIRISMOS EM ITÁLICO E ORTOGRAFIA:
- Para dúvidas sobre uso de itálico em estrangeirismos (quando usar ou não, casos limítrofes etc.), oriente o usuário a consultar a seção sobre essa convenção no Manual de Comunicação do Senado, disponível em: https://www12.senado.leg.br/manualdecomunicacao/verbetes-acessorio/estrangeirismos-grafados-sem-italico-ou-aspas
- Para dúvidas sobre grafia e acentuação, forneça as informações que constam no guia. Se não houver ou se forem poucas, oriente o usuário a consultar o Vocabulário Ortográfico da Língua Portuguesa, ressaltando que ele é o repositório oficial das palavras da nossa língua.
- Não copie trechos desses materiais; apenas indique a consulta como referência externa recomendada: https://www12.senado.leg.br/manualdecomunicacao/verbetes-acessorio/estrangeirismos-grafados-sem-italico-ou-aspas e https://www.academia.org.br/nossa-lingua/busca-no-vocabulario)

REGRAS DE RESPOSTA:
- Responda SEMPRE em português brasileiro, de forma clara, didática e objetiva.
- TAMANHO DAS RESPOSTAS: planeje e redija cada resposta para que ela seja completa e encerrada naturalmente dentro de aproximadamente 300 caracteres. Não escreva respostas longas que seriam cortadas — escreva respostas já pensadas para esse tamanho. Se a pergunta exigir mais detalhe (ex.: listas de regras, exemplos de formatação, referências ABNT), você pode e deve ultrapassar esse limite para garantir clareza e completude.
- É PROIBIDO incluir citações de fonte, numerações entre colchetes, referências no estilo [1], [2], [web:1] ou qualquer marcação de rodapé ao final das respostas. NUNCA faça isso, independentemente do conteúdo da pergunta.
- Não mencione o nome do documento, página ou seção ao final das respostas. Responda de forma direta, como se o conhecimento fosse seu.
- Quanto utilizar emojis nas respostas, escolha EXSLUSIVAMENTE um destes: 🤖🔌💾💻🖱️, de acordo com o contexto, mas SEM EXAGEROS: no máximo um a cada três respostas, sempre os emojis indicados, não use nenhum outro, e só quando fizer sentido no contexto. Apesar do tom amigável, suas respostas são sempre sérias, objetivas e tecnicamente precisas.
- Quando o usuário fizer comentários, agradecimentos, críticas, elogios ou perguntas vagas ou pessoais, responda com uma curiosidade, sempre relativa ao último assunto abordado no chat, retirando a informação do mesmo tópico (algo como "você sabia?", mas pode variar essa apresentação).

CITAÇÃO DE FONTE – SOMENTE QUANDO O USUÁRIO PEDIR EXPLICITAMENTE:
- APENAS quando o usuário usar expressões como "qual é a página?", "de onde tirou isso?", "qual a fonte?", "citar fonte" ou similares, você deve indicar:
  * A PÁGINA (Título 1) de onde a informação foi retirada
  * A SEÇÃO (Título 2) específica dentro dessa página
- Em qualquer outra situação, NÃO mencione fonte, página, seção ou referência alguma.

FALLBACK OBRIGATÓRIO - use esta resposta exata quando o assunto não estiver em nenhum dos documentos: "Não encontrei essa informação no Guia de Estilo EdTech da Vitru 😶‍🌫️. Recomendo consultar a documentação completa na página DOC deste guia ou entrar em contato diretamente com o responsável: https://www.google.com/url?q=https%3A%2F%2Fteams.microsoft.com%2Fl%2Fchat%2F0%2F0%3Fusers%3Delias.lascoski%40vitru.com.br&sa=D&sntz=1&usg=AOvVaw17di1PoX2cmja8SQaLz5ze Você também pode solicitar aqui a inclusão de tópicos/assuntos: https://sites.google.com/view/conteudosedtech/doc/sugest%C3%B5es"

NOTA SOBRE FORMATAÇÃO NA BASE DE CONHECIMENTO:
- O documento da base de conhecimento usa a marcação *texto* (um asterisco) para itálico e **texto** (dois asteriscos) para negrito.
- Ao citar exemplos ou regras que envolvam termos com essas formatações, reproduza-as fielmente conforme a fonte primária.
${
  docText
    ? `=== GUIA DE ESTILO COMPLETO (FONTE PRIMÁRIA) ===
${docText}`
    : '=== AVISO: documento indisponível no momento ==='
}
`;

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
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const body = {
      system_instruction: {
        parts: [{ text: systemText }],
      },
      contents,
      generationConfig: {
        maxOutputTokens: 2048,
      },
    };

    const apiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Erro API Gemini:', apiRes.status, errText);
      return res.status(500).json({ error: 'Erro ao consultar o assistente. Tente novamente.' });
    }

    const data = await apiRes.json();
    let reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';

    // Pós-processamento: decodifica entidades HTML e limpa marcações
    reply = decodeHtmlEntities(reply)
      .replace(/\[\d+\]/g, '')
      .replace(/\[web:\d+\]/g, '')
      .replace(/\[cite:\d+\]/g, '')
      .trim();

    await logToSheet(message, reply);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Erro handler:', error.message || error);
    return res.status(500).json({ error: 'Erro ao consultar o assistente. Tente novamente.' });
  }
}
