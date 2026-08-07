# 🎓 AXIS IFAL Digital - Plataforma de Orientação & Gestão Estudantil

A **Plataforma Axis** é um sistema inteligente de apoio à orientação acadêmica, organização da vida estudantil, gerenciamento de estudos e acompanhamento educacional para estudantes do **Instituto Federal de Alagoas (IFAL)**.

---

## 🌟 Funcionalidades Integradas

- 📋 **Quadro Kanban de Tarefas**: Gestão ágil de estudos (Por Fazer, Em Progresso, Concluído) com níveis de urgência e prazos.
- 📅 **Calendário Acadêmico**: Agendamento e visualização de provas, exames bimestrais, entregas de trabalhos e reuniões PIBITI.
- 📁 **Pasta Digital de Materiais**: Armazenamento de links de apostilas, slides e materiais por disciplina com filtros rápidos.
- 📊 **Monitor & Simulador de Notas**: Cálculo da média mínima (6.0) do IFAL e gráficos visuais de evolução de notas bimestrais (Chart.js).
- ⏱️ **Timer Pomodoro Integrado**: Ciclos de 25 min de estudo com 5 min de descanso e sintetizador de som Web Audio API.
- 🤖 **Tutor Virtual Gemini**: Assistente de IA que responde a dúvidas didáticas sobre o SIGAA, segunda chamada, limites de falta (75%) e auxílios institucionais.
- ⚡ **Banco de Dados Supabase**: Persistência em nuvem com fallback automático para modo LocalStorage.

---

## 🗄️ Configuração do Banco de Dados no Supabase

### 1. Criar o Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie um projeto gratuito.
2. Acesse o **SQL Editor** no painel do Supabase.
3. Copie todo o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql) e execute a consulta.

### 2. Conectar a Aplicação ao Supabase
1. Abra a aplicação Axis no navegador.
2. Clique no botão de engrenagem **Configurações** (ou no selo **Modo Local**) no canto superior direito.
3. Preencha os campos:
   - **Supabase URL**: `https://<seu-projeto>.supabase.co`
   - **Supabase Anon Key**: Sua chave pública `anon` obtida em *Project Settings > API*.
4. Clique em **Salvar & Conectar**.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js instalado (v18+)

### Passos:
```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse a aplicação no seu navegador no endereço indicado (ex: `http://localhost:5173`).
