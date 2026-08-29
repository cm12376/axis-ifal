// ==========================================
// AXIS IFAL - TUTOR VIRTUAL
// O SYSTEM_PROMPT do tutor vive no servidor, em api/tutor.js.
// ==========================================

// A chave da API nunca passa pelo navegador: quem fala com a Groq é /api/tutor,
// usando a chave do estudante (cifrada no banco) ou a do servidor.
export async function askGeminiTutor(query, attachment = null, signal = null, history = [], selectedModel = 'auto', onDelta = null) {
    if (!query && !attachment) return '';

    const hasOnDelta = typeof onDelta === 'function';
    try {
        const payload = {
            messages: [
                ...history,
                { role: 'user', content: query }
            ],
            attachment,
            selectedModel,
            stream: hasOnDelta
        };

        const res = await fetch('/api/tutor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(hasOnDelta ? { 'Accept': 'text/event-stream' } : {}) },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
            signal
        });

        if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (hasOnDelta && ct.includes('text/event-stream')) {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let full = '';
                let buf = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const parts = buf.split('\n\n');
                    buf = parts.pop() || '';
                    for (const part of parts) {
                        const t = part.trim();
                        if (!t.startsWith('data:')) continue;
                        const d = t.slice(5).trim();
                        if (d === '[DONE]') break;
                        try { const j = JSON.parse(d); const delta = j.delta || ''; if (delta) { full += delta; onDelta(delta, full); } } catch {}
                    }
                }
                if (full) return full;
            } else {
                const data = await res.json();
                if (data.text) {
                    if (hasOnDelta) onDelta(data.text, data.text);
                    return data.text;
                }
                if (data.needsUserKey) {
                    return NO_KEY_MESSAGE;
                }
                if (data.error) {
                    if (attachment?.type === 'pdf') return getLocalPdfResponse(query, attachment.text, data.error);
                    return getLocalTutorResponse(query, data.error);
                }
            }
        }
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        // Sem rede ou API indisponível: cai nas respostas locais.
    }

    if (attachment?.type === 'pdf') {
        return getLocalPdfResponse(query, attachment.text);
    }

    return getLocalTutorResponse(query);
}

const NO_KEY_MESSAGE = `🔑 **A IA ainda não está configurada.**

Para conversar com o tutor inteligente, cadastre a sua chave da API Groq em **Configurar IA** (o botão no topo desta tela).

1. Crie uma chave gratuita em [console.groq.com/keys](https://console.groq.com/keys)
2. Cole a chave em **Configurar IA** e salve.

Sua chave é guardada **criptografada** no banco de dados e nunca é exibida novamente.`;

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
