-- ==========================================
-- PLATAFORMA AXIS IFAL - ESQUEMA SUPABASE SQL
-- Banco de Dados PostgreSQL para o IFAL Digital
-- ==========================================

-- Habilitar extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE PERFIS DE USUÁRIOS (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    full_name TEXT NOT NULL DEFAULT 'Estudante Novato',
    course TEXT DEFAULT 'Técnico em Informática',
    campus TEXT DEFAULT 'Campus Maceió',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE TAREFAS KANBAN (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'geral', -- 'algoritmos', 'web', 'bd', etc.
    due_date DATE NOT NULL,
    priority TEXT NOT NULL DEFAULT 'media', -- 'alta', 'media', 'baixa'
    status TEXT NOT NULL DEFAULT 'todo',    -- 'todo', 'progress', 'done'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE EVENTOS E CALENDÁRIO (events)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'prova', -- 'prova', 'trabalho', 'reuniao'
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA DE MATERIAIS DE ESTUDO (materials)
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    link_url TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'geral', -- 'algoritmos', 'web', 'bd'
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA DE NOTIFICAÇÕES (notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    date_label TEXT DEFAULT 'Hoje',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABELA DE RENDIMENTO ACADÊMICO / NOTAS (academic_grades)
CREATE TABLE IF NOT EXISTS public.academic_grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    b1_grade NUMERIC(4, 2) DEFAULT 0.0,
    b2_grade NUMERIC(4, 2) DEFAULT 0.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABELA DE MENSAGENS DO TUTOR IA (chat_messages)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender TEXT NOT NULL DEFAULT 'user', -- 'user' ou 'ai'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ÍNDICES PARA ALTA PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials(category);

-- ==========================================
-- CONFIGURAÇÃO DE SEGURANÇA (RLS - Row Level Security)
-- Permite leitura e gravação anônima/autenticada para fácil visualização
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público Permissivas (Ideal para protótipo & dev)
CREATE POLICY "Permitir acesso total a perfis" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso total a tarefas" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso total a eventos" ON public.events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso total a materiais" ON public.materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso total a notificacoes" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso total a notas" ON public.academic_grades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acesso total a chats" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Public API Realtime (para sincronização em tempo real se ativado)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.tasks, 
    public.events, 
    public.materials, 
    public.notifications,
    public.academic_grades;
COMMIT;

-- ==========================================
-- DADOS INICIAIS DE DEMONSTRAÇÃO (SEED DATA)
-- ==========================================
INSERT INTO public.tasks (title, category, due_date, priority, status) VALUES
('Desenvolver protótipo de CSS Flexbox', 'web', CURRENT_DATE + INTERVAL '5 days', 'alta', 'todo'),
('Resolver lista de condicionais estruturais', 'algoritmos', CURRENT_DATE + INTERVAL '9 days', 'media', 'progress'),
('Implementar integridade referencial no SQL', 'bd', CURRENT_DATE - INTERVAL '2 days', 'baixa', 'done')
ON CONFLICT DO NOTHING;

INSERT INTO public.events (title, event_date, event_type, description) VALUES
('Prova Teórica I: Algoritmos', CURRENT_DATE + INTERVAL '7 days', 'prova', 'Avaliação sobre vetores e matrizes'),
('Submissão de Projeto Web', CURRENT_DATE + INTERVAL '10 days', 'trabalho', 'Entrega final no SIGAA'),
('Reunião PIBITI / Grupo de Inovação', CURRENT_DATE + INTERVAL '3 days', 'reuniao', 'Apresentação do progresso semanal')
ON CONFLICT DO NOTHING;

INSERT INTO public.materials (title, link_url, category, description) VALUES
('Documentação de Apoio SQL Workbench', 'https://dev.mysql.com/doc/', 'bd', 'Guia prático para comandos DDL e DML'),
('Sintaxe Básica de Algoritmos (PDF)', 'https://sigaa.ifal.edu.br', 'algoritmos', 'Apostila oficial do IFAL Maceió'),
('Guia Flexbox e Grid CSS Moderno', 'https://developer.mozilla.org', 'web', 'Referência para layouts responsivos')
ON CONFLICT DO NOTHING;

INSERT INTO public.notifications (text, read, date_label) VALUES
('Lembre-se: O prazo do projeto de Inovação PIBITI expira esta semana.', false, 'Hoje'),
('A sua assiduidade atual na disciplina de Algoritmos está em 88%. Você está seguro!', false, 'Ontem')
ON CONFLICT DO NOTHING;

INSERT INTO public.academic_grades (subject, b1_grade, b2_grade) VALUES
('Introdução a Algoritmos', 5.8, 6.5),
('Desenvolvimento Web I', 6.4, 7.8),
('Banco de Dados', 8.0, 8.2)
ON CONFLICT DO NOTHING;
