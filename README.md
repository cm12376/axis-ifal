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
   Isso cria as tabelas `profiles` (contas de login), `sessions`, `tasks`, `events`, `materials`, `notifications` e `academic_grades`.

### 3. Login e Registo
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
