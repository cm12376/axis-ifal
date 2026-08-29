// API do Tutor Virtual IA (proxy server-side para Groq)
// Mantém a chave de API segura no servidor, sem expô-la no navegador.
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth } from './_auth.js';
import { decryptSecret, encryptionAvailable } from './_crypto.js';

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
O estudante fala em linguagem natural, sem comandos especiais. Você deve IDENTIFICAR a intenção automaticamente e executá-la.

## REGRAS DE RESPOSTA
- Adapte o nível da linguagem ao estudante.
- Use Markdown (negrito, listas, blocos de código).
- Use tabelas SOMENTE no formato Markdown válido com pipes |.
- Para fórmulas matemáticas: SEMPRE use delimitadores $$...$$ (em bloco) ou $...$ (em linha).
`;

const DEFAULT_TEXT_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound'];
const DEFAULT_PDF_MODELS = ['groq/compound', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const VISION_MODELS = ['qwen/qwen3.6-27b', 'groq/compound'];

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
        const { messages = [], attachment = null, stream = false } = body;
        const selectedModel = body.selectedModel || user.groq_model || 'auto';
        const wantsStream = stream === true || req.headers.accept?.includes('text/event-stream');

        const isImage = attachment?.type === 'image';
        const hasPdf = attachment?.type === 'pdf';

        let models;
        if (isImage) {
            if (selectedModel && selectedModel !== 'auto' && (selectedModel === 'qwen/qwen3.6-27b' || selectedModel === 'groq/compound')) {
                models = [selectedModel, ...VISION_MODELS.filter(m => m !== selectedModel)];
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

        const systemMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.slice(0, -1),
            { role: 'user', content: userContent }
        ];

        let lastError = null;

        // Se o cliente pediu stream, tenta streaming no primeiro modelo viável e faz proxy SSE
        if (wantsStream) {
            for (const model of models) {
                try {
                    const payload = { model, messages: systemMessages, stream: true };
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
                        messages: systemMessages
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
