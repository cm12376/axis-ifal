// API do Tutor Virtual IA (proxy server-side para Groq)
// Mantém a chave de API segura no servidor, sem expô-la no navegador.
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth } from './_auth.js';
import { decryptSecret, encryptionAvailable } from './_crypto.js';

const SYSTEM_PROMPT_TUTOR = `
Você é o Tutor Virtual do IFAL (Instituto Federal de Alagoas - Campus Viçosa).
Seu papel é orientar os estudantes com empatia, clareza e autoridade institucional.
Use linguagem pedagógica, acessível e sempre em Português do Brasil (PT-BR).

Conhecimento institucional essencial:
1. Frequência Letiva: mínimo obrigatório de 75% de presença por disciplina — abaixo disso é reprovação por falta (RFI).
2. 2ª Chamada: requerimento na CRA (Coordenação de Registro Acadêmico) em até 3 dias úteis após a prova, com atestado/comprovante.
3. SIGAA: acesso em sigaa.ifal.edu.br — histórico, notas, declarações e entrega de tarefas.
4. Assistência Estudantil: auxílio alimentação/refeitório, bolsa permanência e bolsas de iniciação científica PIBITI/LIAV.
5. Pomodoro: técnica de 25 min de foco + 5 min de pausa (4 ciclos = pausa longa).

## INTERPRETAÇÃO AUTOMÁTICA DE INTENÇÃO
O estudante fala em linguagem natural. Identifique a intenção e execute: explicar conceito, resumir, criar quiz, revisar, resolver exercício passo a passo, etc.

## REGRAS DE RESPOSTA
- Adapte o nível ao estudante (técnico em Informática, ensino médio integrado).
- Use Markdown (negrito, listas, blocos de código). Código com syntax highlight quando houver.
- Tabelas SOMENTE em Markdown válido com pipes |.
- Fórmulas matemáticas: SEMPRE use $$...$$ (bloco) ou $...$ (linha) para KaTeX.
- Quando receber imagem ou PDF, analise o conteúdo e responda com base nele.
- Se não souber, diga com honestidade e sugira onde buscar (SIGAA, coordenação, professor).
`;

const SYSTEM_PROMPT_SIMULADO = `
Você é um Gerador de Simulados Acadêmicos para o IFAL (Instituto Federal de Alagoas).
Sua missão é criar provas/simulados completos em Português do Brasil (PT-BR).
REGRA DE OURO: TODA resposta DEVE conter as DUAS partes — QUESTÕES e GABARITO COMENTADO. Nunca entregue só as questões.

## REGRAS OBRIGATÓRIAS
1. Siga FIELMENTE a quantidade, o tipo e os assuntos pedidos.
2. Tipos:
   - múltipla escolha: 4 alternativas (A, B, C, D), apenas 1 correta. Distribua o gabarito entre A-D.
   - discursiva: enunciado aberto que exige desenvolvimento.
   - mista: metade múltipla escolha e metade discursiva (se ímpar, arredonde a múltipla para cima).
3. ESTRUTURA EXATA (use estes títulos, nesta ordem):
   # Simulado — [temas]
   ## Parte 1 — Questões
   ### Questão 1 — [assunto]
   [enunciado completo]
   A) ...
   B) ...
   C) ...
   D) ...
   (repetir para todas as questões, numeradas de 1 até N sem pular)
   ---
   ## Parte 2 — Gabarito Comentado
   ### Questão 1 — Resposta: [letra ou resposta modelo]
   **Comentário:** explique passo a passo o raciocínio, o conceito envolvido, por que a correta está certa e por que cada distrator está errado.
   **Conceito-chave:** [nome do conceito]
   (repetir para TODAS as N questões — é proibido resumir ou omitir qualquer questão no gabarito)
4. Nível: ensino médio técnico (IFAL). Se o assunto for vago, cubra fundamentos.
5. Fórmulas com LaTeX $...$ ou $$...$$, código em blocos markdown.
6. Não fale de regras do IFAL (75%, CRA, SIGAA) salvo se for o tema do simulado.
7. Se o espaço for curto, priorize completar o gabarito de forma objetiva a omiti-lo. O gabarito é obrigatório.
`;

const DEFAULT_TEXT_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'deepseek-r1-distill-llama-70b', 'groq/compound', 'groq/compound-mini', 'openai/gpt-oss-20b'];
const DEFAULT_PDF_MODELS = ['groq/compound', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const VISION_MODELS = ['groq/compound', 'groq/compound-mini', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile'];

function getServerKey() {
    const apiKey = (process.env.GROQ_API_KEY || '').trim();
    return apiKey.length >= 10 ? apiKey : null;
}

// A chave do estudante (salva cifrada no banco) tem prioridade sobre a do servidor.
function getUserKey(user) {
    if (!user?.groq_api_key_enc) return null;
    const key = decryptSecret(user.groq_api_key_enc);
    return key && key.trim().length >= 10 ? key.trim() : null;
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return fail(res, 'Método não suportado', 405);
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        // Consulta de status: diz de onde vem a chave, sem nunca revelá-la.
        if (req.method === 'GET') {
            return ok(res, {
                userKey: Boolean(getUserKey(user)),
                serverKey: Boolean(getServerKey()),
                keyHint: user.groq_key_hint || null,
                model: user.groq_model || 'auto',
                canStoreKey: encryptionAvailable()
            });
        }

        const apiKey = getUserKey(user) || getServerKey();
        if (!apiKey) {
            return ok(res, { needsUserKey: true });
        }

        const body = await getBody(req);
        const { messages = [], attachment = null, stream = false, mode = 'tutor' } = body;
        const selectedModel = body.selectedModel || user.groq_model || 'auto';
        const wantsStream = stream === true || req.headers.accept?.includes('text/event-stream');
        const isSimuladoMode = mode === 'simulado';

        const isImage = attachment?.type === 'image';
        const hasPdf = attachment?.type === 'pdf';

        let models;
        if (isImage) {
            const visionSet = new Set(VISION_MODELS);
            if (selectedModel && selectedModel !== 'auto' && visionSet.has(selectedModel)) {
                models = [selectedModel, ...VISION_MODELS.filter(m => m !== selectedModel)];
            } else if (selectedModel && selectedModel !== 'auto') {
                // modelo escolhido não tem visão: força fallback de visão mas tenta o escolhido primeiro se for texto
                models = [selectedModel, ...VISION_MODELS];
            } else {
                models = VISION_MODELS;
            }
        } else if (selectedModel && selectedModel !== 'auto') {
            const fallbackList = hasPdf ? DEFAULT_PDF_MODELS : DEFAULT_TEXT_MODELS;
            models = [selectedModel, ...fallbackList.filter(m => m !== selectedModel)];
        } else {
            models = hasPdf ? DEFAULT_PDF_MODELS : DEFAULT_TEXT_MODELS;
        }

        let userContent;
        if (isImage) {
            userContent = [
                { type: 'text', text: messages[messages.length - 1]?.content || 'Analise esta imagem.' },
                { type: 'image_url', image_url: { url: attachment.data } }
            ];
        } else if (hasPdf) {
            userContent = `${messages[messages.length - 1]?.content || ''}\n\n[Conteúdo extraído do documento anexado]:\n${attachment.text}`;
        } else {
            userContent = messages[messages.length - 1]?.content || '';
        }

        const systemPrompt = isSimuladoMode ? SYSTEM_PROMPT_SIMULADO : SYSTEM_PROMPT_TUTOR;
        const systemMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(0, -1),
            { role: 'user', content: userContent }
        ];

        let lastError = null;

        const generationParams = isSimuladoMode
            ? { temperature: 0.5, max_tokens: 8000, top_p: 0.95 }
            : { temperature: 0.6, max_tokens: 2500, top_p: 0.9 };

        // Se o cliente pediu stream, tenta streaming no primeiro modelo viável e faz proxy SSE
        if (wantsStream) {
            for (const model of models) {
                try {
                    const payload = { model, messages: systemMessages, stream: true, ...generationParams };
                    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` },
                        body: JSON.stringify(payload)
                    });
                    if (!groqRes.ok) {
                        const errBody = await groqRes.json().catch(() => ({}));
                        lastError = `${model}: HTTP ${groqRes.status} - ${(errBody?.error?.message || '').slice(0, 120)}`;
                        if (groqRes.status === 429 || groqRes.status === 500 || groqRes.status === 503) continue;
                        break;
                    }
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache, no-transform',
                        'Connection': 'keep-alive',
                        'X-Accel-Buffering': 'no'
                    });
                    const reader = groqRes.body.getReader();
                    const decoder = new TextDecoder();
                    let buf = '';
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            buf += decoder.decode(value, { stream: true });
                            const parts = buf.split('\n\n');
                            buf = parts.pop() || '';
                            for (const part of parts) {
                                const line = part.trim();
                                if (!line.startsWith('data:')) continue;
                                const data = line.slice(5).trim();
                                if (data === '[DONE]') { res.write(`data: [DONE]\n\n`); res.end(); return; }
                                try {
                                    const json = JSON.parse(data);
                                    const delta = json.choices?.[0]?.delta?.content || '';
                                    if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
                                } catch {}
                            }
                        }
                    } catch (e) { /* groq stream interrompido */ }
                    res.write(`data: [DONE]\n\n`);
                    res.end();
                    return;
                } catch (err) {
                    lastError = `${model}: ${err.message}`;
                    continue;
                }
            }
            return fail(res, lastError || 'Falha no streaming', 500);
        }

        for (const model of models) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const payload = {
                        model,
                        messages: systemMessages,
                        ...generationParams
                    };

                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const text = data.choices?.[0]?.message?.content;
                        if (text) return ok(res, { text });
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
                    lastError = `${model}: ${err.message}`;
                    break;
                }
            }
        }

        return ok(res, { text: null, error: lastError });
    } catch (err) {
        console.error('tutor error:', err);
        return fail(res, 'Erro ao processar consulta do tutor', 500);
    }
}
