const { GoogleGenerativeAI } = require('@google/generative-ai');

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
- Titulos em negrito, hierarquia visual definida (H1 > H2 > H3)
- Siglas: escritas por extenso na primeira ocorrencia, seguidas da sigla entre parenteses
- Listas: marcadores para itens nao ordenados; numeracao para sequencias e passos
- Negrito para termos tecnicos; italico para estrangeirismos e nomes de softwares/apps
- Nomes de softwares e aplicativos sempre em italico (ex: Word, Google Drive)

REVISAO (REV):
- Verificar ortografia, gramatica, coerencia, coesao, clareza
- Frases curtas (maximo 25 palavras recomendado)
- Evitar voz passiva excessiva, jargoes sem explicacao
- Checklist: concordancia verbal e nominal, pontuacao, virgulas

NORMATIZACAO (NOR) - ABNT:
- Citacoes diretas curtas (ate 3 linhas): entre aspas duplas no corpo do texto
- Citacoes diretas longas (4+ linhas): recuo de 4 cm, fonte menor (10pt), sem aspas, espacamento simples
- Referencias: SOBRENOME, Nome. Titulo em negrito. Edicao. Local: Editora, Ano.
- NBR 10520:2023 - Citacoes em documentos
- NBR 14724:2024 - Trabalhos academicos (apresentacao)
- NBR 6023:2025 - Referencias bibliograficas
- Apud: citacao de citacao (usar com moderacao)

HUMANIZACAO (HUM):
- Textos educacionais: empaticos, acolhedores, em segunda pessoa (voce)
- Evitar linguagem robotica e termos excessivamente tecnicos sem contextualizacao
- Usar storytelling, exemplos praticos, tom conversacional
- Humanizacao de textos gerados por IA: remover cliches, variar estrutura de frases

ELABORACAO DE QUESTOES (GER):
- Tipos: multipla escolha, verdadeiro/falso, dissertativa, estudo de caso
- Multipla escolha: 5 opcoes (A-E), apenas uma correta, distratores plausíveis
- Enunciado claro, objetivo, sem ambiguidade
- Taxonomia de Bloom: lembrar, compreender, aplicar, analisar, avaliar, criar

LINGUAGEM INCLUSIVA (LIN):
- Linguagem neutra de genero quando possivel
- Evitar: etarismo, capacitismo, racismo, sexismo
- Preferir: "pessoa com deficiencia" a "deficiente"
- Flexao de genero dupla (o/a) ou formas neutras aceitas pelo guia

DOCUMENTACAO (DOC):
- Margem: 3cm (superior e esquerda), 2cm (inferior e direita)
- Fonte: Times New Roman 12 ou Arial 11
- Espacamento: 1,5 entrelinhas no corpo; simples em citacoes longas e referencias
`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Mensagem ausente' });

  try {
    const siteContext = await getSiteContext();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `Voce e o Assistente EdTech do Guia de Estilo da Vitru Educacao.
Responda SEMPRE em portugues brasileiro, de forma clara, didatica e objetiva.
Use as fontes de conhecimento abaixo para responder com precisao.
Se a pergunta for sobre ABNT, cite a norma especifica (NBR 10520:2023, NBR 14724:2024 ou NBR 6023:2025).
Se nao souber, oriente o usuario a consultar o guia ou contactar Elias Lascoski.
Seja conciso: ate 300 palavras por resposta.
Nunca invente regras ou normas.

${STATIC_KNOWLEDGE}

=== CONTEUDO DO SITE (via crawler) ===
${siteContext}`,
    });

    const geminiHistory = (history || []).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Erro Gemini:', error.message || error);
    return res.status(500).json({ error: 'Erro ao consultar o assistente. Tente novamente.' });
  }
};
