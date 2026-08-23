// ==========================================
// AXIS IFAL - TUTOR VIRTUAL GEMINI AI
// Módulo de Orientação Inteligente ao Estudante
// ==========================================

const SYSTEM_PROMPT = `
Você é o Tutor Virtual do IFAL (Instituto Federal de Alagoas - Campus Maceió). 
Seu papel é orientar os estudantes novatos com empatia, clareza e autoridade institucional.
Use linguagem pedagógica, acessível e sempre em Português do Brasil (PT-BR).
Regras didáticas principais:
1. Frequência Letiva: Lembrar que no IFAL o mínimo obrigatório de presença é 75%.
2. 2ª Chamada: Explicar que o requerimento deve ser protocolado na CRA (Secretaria) em até 3 dias úteis.
3. SIGAA: Orientar como acessar histórico, notas e submeter trabalhos em sigaa.ifal.edu.br.
4. Assistência Estudantil: Explicar auxílio alimentação, bolsa permanência e iniciação tecnológica (PIBITI).
5. Pomodoro: Incentivar 25 min de estudo com 5 min de pausa.

## INTERPRETAÇÃO AUTOMÁTICA DE INTENÇÃO
O estudante fala em linguagem natural, sem comandos especiais. Você deve IDENTIFICAR a intenção automaticamente e executá-la. A lista de intenções é flexível — reconheça pedidos semelhantes mesmo com palavras diferentes:

- Explicação: "explica", "não entendi", "como funciona", "me ajuda a entender", "me explica como se eu nunca tivesse estudado".
- Resumo: "resumo", "resuma", "resume isso".
- Quiz/Exercícios: "quiz", "perguntas pra treinar", "exercícios", "questões", "me faz umas perguntas".
- Correção de resposta: "pode corrigir minha resposta?", "está certo?", "corrija".
- Revisão: "revisão rápida", "revisar", "estudar para a prova".
- Prova/Simulado: "prova", "simulado", "teste".
- Plano de estudos: "monte um plano", "plano de estudo", "tenho prova de X".
- Código: "corrija meu código", "explica esse código", "ache o erro".
- Flashcards: "flashcards", "cartões de estudo".
- Orientação acadêmica: dúvidas sobre IFAL, CRA, bolsas, SIGAA, frequência.

## EXTRAÇÃO DE INFORMAÇÕES
Extraia da mensagem: assunto/tema, quantidade (ex: "10 perguntas"), prazo (ex: "prova sexta-feira"), matéria, linguagem de programação, preferência de linguagem (simples, intermediário, avançado), e o contexto da conversa anterior.

## USO DO CONTEXTO DA CONVERSA
Mantenha o contexto: se o estudante pedir "agora faça 5 questões" logo após você explicar "função afim", entenda que as questões são sobre função afim sem pedir para repetir o assunto. Use as mensagens anteriores fornecidas na conversa como referência.

## REGRAS DE RESPOSTA
- Adapte o nível da linguagem ao estudante (iniciante: simples, com analogias; avançado: técnico).
- Para explicações: passo a passo, com exemplos.
- Para quiz/exercícios: apresente um por vez (ou conforme pedido), aguarde a resposta, e ao corrigir explique cada erro.
- Para resumo: organize com títulos, tópicos e pontos-chave.
- Para código: mostre sempre o código corrigido completo e explique o porquê de cada correção.
- Quando faltar informação essencial (ex: não deu a questão de Física), peça educadamente.
- Use Markdown (negrito, listas, blocos de código) para organização.
- Use tabelas SOMENTE no formato Markdown válido: cada linha com pipes \`|\` (ex: \`| Cabeçalho | Valor |\`), seguida de uma linha separadora \`|---|---|\`. NUNCA use tabs ou espaços para alinhar colunas.
- Para fórmulas matemáticas: SEMPRE use delimitadores \`$$...$$\` (em bloco) ou \`$...$\` (em linha). NUNCA use colchetes \`[ ... ]\` ou \`\\[ ... \\]\` para equações — elas não são reconhecidas.
- Na resposta, NÃO repita o assunto acima das seções: comece direto pelo conteúdo solicitado.

## EXPLICAÇÃO ADAPTATIVA
Quando o estudante pedir uma explicação, siga este fluxo:
1. Identifique o assunto exato que ele quer aprender.
2. Explique de forma SIMPLES, adaptando a complexidade ao nível dele. Se ele disse "como se eu estivesse começando" ou algo parecido, seja extremamente básico, evitando termos técnicos sem antes defini-los.
3. Forneça pelo menos um exemplo prático concreto.
4. Use analogias do dia a dia sempre que ajudarem a fixar o conceito.
5. Quando houver fórmula, apresente-a em LaTeX dentro de blocos $...$ ou $$...$$.
6. No final, verifique se o conceito foi compreendido: faça 1 pergunta curta de verificação (ex: "Pode me explicar com suas palavras...?" ou "Se eu te der um exemplo, consegue resolver?") e aguarde a resposta antes de continuar.

Exemplo: "Explique fotossíntese como se eu estivesse começando a estudar." → resposta muito mais simples que uma explicação universitária, com analogia (ex: fábrica de comida da planta), exemplo, e verificação no final.

## RESUMO INTELIGENTE
Quando o estudante pedir um resumo, siga estas diretrizes:
1. Identifique o assunto exato a ser resumido.
2. Produza um resumo ORGANIZADO, usando títulos e subtítulos para separar as partes.
3. Destaque os conceitos importantes com negrito e listas.
4. Apresente fórmulas em LaTeX ($...$ ou $$...$$) quando o conteúdo tiver equações.
5. Evite informações desnecessárias: mantenha apenas o essencial para revisão.
6. Finalize com uma seção curta de "pontos-chave" para revisão rápida.

## PROGRAMAÇÃO
Quando o assunto for programação:
- Identifique automaticamente a linguagem pelo código ou pelo texto (Python, JavaScript, C, SQL, etc.).
- Destaque o código em blocos formatados com a linguagem indicada (ex: \`\`\`python).
- Explique o que o código faz, linha por linha quando necessário.
- Aponte os erros com clareza (ex: "falta : depois de range(10)").
- MOSTRE a versão corrigida completa do código.
- Explique o PORQUÊ de cada correção, ensinando o conceito — NUNCA corrija apenas, sem ensinar.
- Quando a correção envolver um conceito importante, explique o conceito brevemente.

Exemplo: dado o código Python \`for i in range(10): print(i)\` sem os dois pontos, explique que falta o sinal de dois pontos após range(10), mostre o código corrigido e explique a regra da sintaxe de blocos em Python.
`;

export async function askGeminiTutor(query, apiKey = '', attachment = null, signal = null, history = [], selectedModel = 'auto') {
    if (!query && !attachment) return '';
    const hasApi = apiKey && apiKey.trim().length > 10;

    if (hasApi) {
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        const isImage = attachment?.type === 'image';
        const hasPdf = attachment?.type === 'pdf';

        const defaultTextModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound'];
        const defaultPdfModels = ['groq/compound', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
        const visionModels = ['qwen/qwen3.6-27b', 'groq/compound'];

        let models;
        if (isImage) {
            if (selectedModel && selectedModel !== 'auto' && (selectedModel === 'qwen/qwen3.6-27b' || selectedModel === 'groq/compound')) {
                models = [selectedModel, ...visionModels.filter(m => m !== selectedModel)];
            } else {
                models = visionModels;
            }
        } else if (selectedModel && selectedModel !== 'auto') {
            const fallbackList = hasPdf ? defaultPdfModels : defaultTextModels;
            models = [selectedModel, ...fallbackList.filter(m => m !== selectedModel)];
        } else {
            models = hasPdf ? defaultPdfModels : defaultTextModels;
        }

        let lastError = null;

        let userContent;
        if (isImage) {
            userContent = [
                { type: 'text', text: query || 'Analise esta imagem e responda sobre o que ela contém.' },
                { type: 'image_url', image_url: { url: attachment.data } }
            ];
        } else if (hasPdf) {
            userContent = `${query}\n\n[Conteúdo extraído do documento anexado]:\n${attachment.text}`;
        } else {
            userContent = query;
        }

        for (const model of models) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const payload = {
                        model,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            ...history,
                            { role: 'user', content: userContent }
                        ]
                    };

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey.trim()}`
                        },
                        body: JSON.stringify(payload),
                        signal
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const text = data.choices?.[0]?.message?.content;
                        if (text) return text;
                        lastError = `${model}: resposta vazia`;
                        break;
                    }

                    const status = response.status;
                    let detail = '';
                    try {
                        const errBody = await response.json();
                        detail = errBody?.error?.message || errBody?.error?.code || '';
                    } catch (_) {}
                    lastError = `${model}: HTTP ${status}${detail ? ' - ' + detail.slice(0, 120) : ''}`;
                    if (status === 429 || status === 500 || status === 503) {
                        const reset = parseFloat(response.headers.get('x-ratelimit-reset-tokens') || '0');
                        const wait = Math.min(reset > 0 ? reset * 1000 : 2500, 10000);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }
                    break;
                } catch (err) {
                    if (err.name === 'AbortError') throw err;
                    lastError = `${model}: ${err.message}`;
                    console.warn(`Falha com modelo ${model}, tentando próximo:`, err);
                    break;
                }
            }
        }

        if (attachment?.type === 'pdf') {
            return getLocalPdfResponse(query, attachment.text, lastError);
        }

        return getLocalTutorResponse(query, lastError);
    }

    if (attachment?.type === 'pdf') {
        return getLocalPdfResponse(query, attachment.text);
    }

    return getLocalTutorResponse(query);
}

function getLocalPdfResponse(query, pdfText, lastError = null) {
    if (lastError) {
        return `⚠️ **Não consegui acessar a IA agora** (erro: ${lastError}).\n\nEnvie sua pergunta novamente em alguns instantes.`;
    }
    return "⚠️ **Não consegui acessar a IA agora** (a API de IA está sobrecarregada no momento).\n\nEnvie sua pergunta novamente em alguns instantes — tentarei automaticamente outros modelos de IA para analisar seu documento.";
}

function getLocalTutorResponse(query, lastError = null) {
    const q = query.toLowerCase();

    if (lastError) {
        return `⚠️ **Não consegui acessar a IA agora** (erro: ${lastError}).\n\nEnvie sua pergunta novamente em alguns instantes.`;
    }

    if (q.includes("sigaa") || q.includes("sistema") || q.includes("nota") || q.includes("histórico")) {
        return "📱 **Guia Rápido do SIGAA IFAL**:\n\n1. Acesse [sigaa.ifal.edu.br](https://sigaa.ifal.edu.br)\n2. Clique em **Cadastro de Discente** se for seu primeiro acesso.\n3. Digite sua Matrícula de Ingressante, CPF e Ano de Ingresso.\n4. No portal, você pode consultar o Histórico Acadêmico, emitir Declaração de Matrícula e submeter tarefas enviadas pelos professores.";
    }

    if (q.includes("pomodoro") || q.includes("foco") || q.includes("estudo") || q.includes("tempo") || q.includes("rotina")) {
        return "⏱️ **Técnica de Foco Pomodoro**:\n\nUtilize o nosso temporizador integrado no painel lateral!\n• **25 Minutos**: Foco total sem distrações de celular ou redes sociais.\n• **5 Minutos**: Pausa curta para esticar as pernas e hidratar.\n• Repita 4 vezes para completar um ciclo de alto rendimento no IFAL!";
    }

    if (q.includes("prova") || q.includes("exame") || q.includes("média") || q.includes("aprovado") || q.includes("recurso")) {
        return "📊 **Regras de Aprovação no IFAL**:\n\n• **Média Mínima**: Você precisa de média **6.0** nos bimestres para aprovação direta.\n• **Simulador**: Use a aba 'Simulador & Notas' para calcular quanto você precisa tirar na N2 para garantir a aprovação sem final.";
    }

    if (q.includes("falta") || q.includes("presença") || q.includes("frequência") || q.includes("75%")) {
        return "⚠️ **Limite Legal de Assiduidade**:\n\nA Organização Didática do IFAL estabelece que o estudante deve manter pelo menos **75% de presença** em cada disciplina.\nFaltar mais de 25% das aulas resulta em reprovação direta por infrequência (RFI), independentemente das suas notas.";
    }

    if (q.includes("segunda chamada") || q.includes("2ª chamada") || q.includes("perdi prova") || q.includes("doente")) {
        return "📋 **Procedimento para Segunda Chamada**:\n\nSe você perdeu uma avaliação por doença ou motivo justificado:\n1. Você tem o prazo limite de **3 dias úteis** após a prova.\n2. Abra um requerimento formal na **CRA (Coordenação de Registro Acadêmico)** anexando o atestado médico ou comprovante oficial.";
    }

    if (q.includes("bolsa") || q.includes("auxilio") || q.includes("pibiti") || q.includes("pesquisa") || q.includes("refeitório")) {
        return "🎓 **Assistência Estudantil & Oportunidades PIBITI**:\n\nO IFAL oferece:\n• **Auxílio Alimentação / Refeitório**: Apoio pecuniário ou refeição no campus.\n• **Bolsas PIBITI**: Oportunidade de iniciação científica e desenvolvimento de plataformas tecnológicas com orientação de professores!";
    }

    return "👋 **Olá, novato do IFAL!**\n\nSou o seu Tutor Acadêmico Inteligente. Posso ajudar você com:\n• Como funciona o SIGAA e as matrículas\n• Limite de faltas e requerimento de 2ª chamada\n• Bolsas de estudo e projetos PIBITI\n• Organização do seu tempo com o método Pomodoro!\n\nEm que posso esclarecer você hoje?";
}
