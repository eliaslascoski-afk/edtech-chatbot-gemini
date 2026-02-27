import { GoogleGenerativeAI } from '@google/generative-ai';

const SITE_PAGES = [
  'https://sites.google.com/view/conteudosedtech/guia',
  'https://sites.google.com/view/conteudosedtech/pad',
  'https://sites.google.com/view/conteudosedtech/rev',
  'https://sites.google.com/view/conteudosedtech/nor',
  'https://sites.google.com/view/conteudosedtech/hum',
  'https://sites.google.com/view/conteudosedtech/ger',
  'https://sites.google.com/view/conteudosedtech/lin',
  'https://sites.google.com/view/conteudosedtech/doc',
];

let cachedContext = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function fetchPageText(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'EdTechBot/1.0' } });
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return `[${url}]\n${text.substring(0, 2000)}`;
  } catch (e) {
    return `[${url}] Erro ao acessar.`;
  }
}

async function getSiteContext() {
  const now = Date.now();
  if (cachedContext && now - cacheTime < CACHE_TTL) return cachedContext;
  const results = await Promise.all(SITE_PAGES.map(fetchPageText));
  cachedContext = results.join('\n\n---\n\n');
  cacheTime = now;
  return cachedContext;
}

const STATIC_KNOWLEDGE = `
=== GUIA DE ESTILO EDTECH - VITRU EDUCACAO ===
PADRONIZACAO (PAD):
- Titulos sem ponto final
- Sem recuo nem linha em branco entre paragrafos
- Retirar flexoes entre parenteses: professor(a) -> professor
- Leitor: "estudante", sempre singular
- Autor: primeira pessoa do singular
- Uma citacao longa obrigatoria
- Evitar UNIASSELVI/UniCesumar
- Marcador de texto: ate 2 por pagina
- Negrito para destaques, italico para softwares
- Numeros ate 10 por extenso
- Crase antes de pronome possessivo
- "onde" -> "em que"
- "atraves" -> "por meio de"
- "junto com" -> "com"
- Hifen para intervalos: p. 22-23
REVISAO (REV):
- Ortografia, gramatica, coerencia, coesao, clareza
- Frases curtas (max 25 palavras)
- Evitar voz passiva excessiva
- Checklist: concordancia, pontuacao, virgulas
NORMATIZACAO (NOR) - ABNT:
- Citacoes curtas (<= 3 linhas): aspas duplas no texto
- Citacoes longas (4+ linhas): recuo 4cm, fonte 10pt, sem aspas
- NBR 10520:2023 - Citacoes
- NBR 14724:2024 - Trabalhos academicos
- NBR 6023:2025 - Referencias
- Referencias: SOBRENOME, Nome. Titulo. Edicao. Local: Editora, Ano.
HUMANIZACAO (HUM):
- Textos empaticos, acolhedores, segunda pessoa (voce)
- Evitar linguagem robotica
- Storytelling, exemplos praticos, tom conversacional
- Remover cliches de IA, variar estrutura de frases
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Mensagem ausente' });
  try {
    const siteContext = await getSiteContext();
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: `Voce e o Assistente EdTech do Guia de Estilo da Vitru Educacao. Responda SEMPRE em portugues brasileiro, de forma clara, didatica e objetiva. Use as fontes de conhecimento abaixo para responder com precisao. Se a pergunta for sobre ABNT, cite a norma especifica (NBR 10520:2023, NBR 14724:2024 ou NBR 6023:2025). Seja conciso: ate 300 palavras por resposta. Nunca invente regras ou normas.

Se nao encontrar a resposta ou nao tiver certeza sobre o assunto perguntado, responda exatamente assim: "Nao encontrei uma resposta precisa para essa pergunta no meu conhecimento atual. Recomendo consultar a documentacao completa na pagina DOC do Guia (https://sites.google.com/view/conteudosedtech/doc) ou entrar em contato diretamente com o responsavel pelo botao CHAT no rodape da pagina do Guia."

${STATIC_KNOWLEDGE}
=== CONTEUDO DO SITE (via crawler) ===
${siteContext}`,
    });
    const rawHistory = (history || []).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));
    while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
      rawHistory.shift();
    }
    const chat = model.startChat({ history: rawHistory });
    const result = await chat.sendMessage(message);
    const reply = result.response.text();
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Erro Gemini:', error.message || error);
    return res.status(500).json({ error: 'Erro ao consultar o assistente. Tente novamente.' });
  }
}
