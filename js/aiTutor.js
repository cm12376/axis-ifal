// ==========================================
// AXIS IFAL - TUTOR VIRTUAL GEMINI AI
// Módulo de Orientação Inteligente ao Estudante
// ==========================================

const SYSTEM_PROMPT = `
És o Tutor Virtual do IFAL (Instituto Federal de Alagoas - Campus Maceió). 
Teu papel é orientar os estudantes novatos com empatia, clareza e autoridade institucional.
Usa linguagem pedagógica, acessível e em Português (PT-BR ou PT-PT adaptado ao ambiente acadêmico).
Regras didáticas principais:
1. Frequência Letiva: Lembrar que no IFAL o mínimo obrigatório de presença é 75%.
2. 2ª Chamada: Explicar que o requerimento deve ser protocolado na CRA (Secretaria) em até 3 dias úteis.
3. SIGAA: Orientar como acessar histórico, notas e submeter trabalhos em sigaa.ifal.edu.br.
4. Assistência Estudantil: Explicar auxílio alimentação, bolsa permanência e iniciação tecnológica (PIBITI).
5. Pomodoro: Incentivar 25 min de estudo com 5 min de pausa.
`;

export async function askGeminiTutor(query, apiKey = '') {
    if (!query || query.trim() === '') return '';

    // Se houver chave API fornecida, tenta chamar diretamente o endpoint Gemini
    if (apiKey && apiKey.trim().length > 10) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;
            const payload = {
                contents: [{ parts: [{ text: query }] }],
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) return text;
            }
        } catch (err) {
            console.warn('Falha na resposta da API Gemini, recorrendo à inteligência local:', err);
        }
    }

    // Resposta Baseada em Conhecimento Acadêmico do IFAL (Inteligência Embutida)
    return getLocalTutorResponse(query);
}

function getLocalTutorResponse(query) {
    const q = query.toLowerCase();

    if (q.includes("sigaa") || q.includes("sistema") || q.includes("nota") || q.includes("histórico")) {
        return "📱 **Guia Rápido do SIGAA IFAL**:\n\n1. Acesse [sigaa.ifal.edu.br](https://sigaa.ifal.edu.br)\n2. Clique em **Cadastro de Discente** se for seu primeiro acesso.\n3. Digite sua Matrícula de Ingressante, CPF e Ano de Ingresso.\n4. No portal, você pode consultar o Histórico Acadêmico, emitir Declaração de Matrícula e submeter tarefas enviadas pelos professores.";
    }

    if (q.includes("pomodoro") || q.includes("foco") || q.includes("estudo") || q.includes("tempo") || q.includes("rotina")) {
        return "⏱️ **Técnica de Foco Pomodoro**:\n\nUtilize o nosso temporizador integrado no painel lateral!\n• **25 Minutos**: Foco total sem distrações de telemóvel ou redes sociais.\n• **5 Minutos**: Pausa curta para esticar as pernas e hidratar.\n• Repita 4 vezes para completar um ciclo de alto rendimento no IFAL!";
    }

    if (q.includes("prova") || q.includes("exame") || q.includes("média") || q.includes("aprovado") || q.includes("recurso")) {
        return "📊 **Regras de Aprovação no IFAL**:\n\n• **Média Mínima**: Precisas de média **6.0** nos bimestres para aprovação direta.\n• **Simulador**: Usa a aba 'Simulador & Notas' para calcular quanto precisas tirar na N2 para garantir a aprovação sem final.";
    }

    if (q.includes("falta") || q.includes("presença") || q.includes("frequência") || q.includes("75%")) {
        return "⚠️ **Limite Legal de Assiduidade**:\n\nA Organização Didática do IFAL estabelece que o estudante deve manter pelo menos **75% de presença** em cada disciplina.\nFaltar mais de 25% das aulas resulta em reprovação direta por infrequência (RFI), independentemente das tuas notas.";
    }

    if (q.includes("segunda chamada") || q.includes("2ª chamada") || q.includes("perdi prova") || q.includes("doente")) {
        return "📋 **Procedimento para Segunda Chamada**:\n\nSe perdeste uma avaliação por doença ou motivo justificado:\n1. Tens o prazo limite de **3 dias úteis** após a prova.\n2. Abre um requerimento formal na **CRA (Coordenação de Registro Acadêmico)** anexando o atestado médico ou comprovativo oficial.";
    }

    if (q.includes("bolsa") || q.includes("auxilio") || q.includes("pibiti") || q.includes("pesquisa") || q.includes("refeitório")) {
        return "🎓 **Assistência Estudantil & Oportunidades PIBITI**:\n\nO IFAL oferece:\n• **Auxílio Alimentação / Refeitório**: Apoio pecuniário ou refeição no campus.\n• **Bolsas PIBITI**: Oportunidade de iniciação científica e desenvolvimento de plataformas tecnológicas com orientação de professores!";
    }

    return "👋 **Olá, novato do IFAL!**\n\nSou o teu Tutor Académico Inteligente. Posso ajudar-te com:\n• Como funciona o SIGAA e as matrículas\n• Limite de faltas e requerimento de 2ª chamada\n• Bolsas de estudo e projetos PIBITI\n• Organização do teu tempo com o método Pomodoro!\n\nEm que posso esclarecer-te hoje?";
}
