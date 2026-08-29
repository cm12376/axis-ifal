# 🎓 AXIS IFAL Digital - Plataforma de Orientação & Gestão Estudantil

A **Plataforma Axis** é um sistema inteligente de apoio à orientação acadêmica, organização da vida estudantil, gerenciamento de estudos e acompanhamento educacional para estudantes do **Instituto Federal de Alagoas (IFAL)**.

---

## 🌟 Funcionalidades Integradas

- 📋 **Quadro Kanban de Tarefas**: Gestão ágil de estudos (Por Fazer, Em Progresso, Concluído) com níveis de urgência e prazos.
- 📅 **Calendário Acadêmico**: Agendamento e visualização de provas, exames bimestrais, entregas de trabalhos e reuniões PIBITI.
- 📁 **Pasta Digital de Materiais**: Armazenamento de links de apostilas, slides e materiais por disciplina com filtros rápidos.
- 📊 **Monitor & Simulador de Notas**: Cálculo da média mínima (6.0) do IFAL e gráficos visuais de evolução de notas bimestrais (Chart.js).
- ⏱️ **Timer Pomodoro Integrado**: Ciclos de 25 min de estudo com 5 min de descanso e sintetizador de som Web Audio API.
- 📈 **Métricas de Estudo**: Tempo total em Pomodoro por disciplina, streak de dias consecutivos estudando e gráficos de produtividade (por disciplina e últimos 7 dias).
- 🤖 **Tutor Virtual com IA (Groq)**: Assistente inteligente com configuração personalizada de chave de API Groq e seleção de modelos LLM (Llama 3.3, Llama 3.1, DeepSeek R1, GPT-OSS, Qwen, etc.), além de fallback com orientações do regulamento do IFAL.
- 🔐 **Login e Senha**: Cada estudante cria a própria conta; tarefas, eventos, materiais, notas e notificações ficam isolados por usuário.
- ⚡ **Banco de Dados Neon PostgreSQL**: Persistência em nuvem via funções serverless da Vercel, com fallback automático para modo LocalStorage quando offline.

---

## 🗄️ Configuração do Banco de Dados Neon

### 1. Criar o Projeto no Neon
1. Acesse [neon.tech](https://neon.tech) e crie um projeto gratuito de PostgreSQL.
2. Copie a *connection string* do banco.

### 2. Aplicar o Esquema
1. Defina a variável de ambiente `NEON_DATABASE_URL` (ou `DATABASE_URL` na Vercel) com a connection string.
2. Execute o script de migração:
   ```bash
   node scripts/applySchema.mjs
   ```
   Isso cria as tabelas `profiles` (contas de login), `sessions`, `tasks`, `events`, `materials`, `notifications`, `academic_grades` e `pomodoro_sessions`.

### 3. Chave de criptografia dos segredos

Cada estudante cadastra a própria chave da API Groq pela tela **Configurar IA**. A chave é gravada
**cifrada com AES-256-GCM** na coluna `profiles.groq_api_key_enc` — nunca em texto puro e nunca
devolvida ao navegador. Para isso, defina a chave-mestra no ambiente:

```bash
# gere uma chave de 32 bytes
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde o valor em `AXIS_ENCRYPTION_KEY` (local e na Vercel). Se essa variável mudar, as chaves já
salvas deixam de ser legíveis e os alunos precisarão cadastrá-las de novo.

`GROQ_API_KEY` continua opcional: quando definida, funciona como chave de fallback da instituição
para quem ainda não cadastrou a sua.

### 4. Login e Registro
1. Abra a aplicação Axis no navegador.
2. Na tela inicial, clique em **Criar Conta**, informe nome, e-mail e senha.
3. As sessões são mantidas por cookie `httpOnly` por 7 dias; use o botão **Sair** no cabeçalho para encerrar.

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
