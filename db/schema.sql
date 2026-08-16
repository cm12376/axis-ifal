-- ==========================================
-- PLATAFORMA AXIS IFAL - ESQUEMA NEON (PostgreSQL)
-- ==========================================

-- 1. TABELA DE PERFIS DE USUÁRIOS (também serve como conta de login)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    password_hash TEXT,
    full_name TEXT NOT NULL DEFAULT 'Estudante Novato',
    course TEXT DEFAULT 'Técnico em Informática',
    campus TEXT DEFAULT 'Campus Maceió',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migração idempotente para bancos já existentes (criados antes do login)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 1B. SESSÕES DE LOGIN (token guardado em cookie httpOnly)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);

-- 2. TAREFAS KANBAN
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'geral',
    due_date DATE NOT NULL,
    priority TEXT NOT NULL DEFAULT 'media',
    status TEXT NOT NULL DEFAULT 'todo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EVENTOS E CALENDÁRIO
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'prova',
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MATERIAIS DE ESTUDO
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    link_url TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'geral',
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    date_label TEXT DEFAULT 'Hoje',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. NOTAS / RENDIMENTO ACADÊMICO
CREATE TABLE IF NOT EXISTS public.academic_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    b1_grade NUMERIC(4, 2) DEFAULT 0.0,
    b2_grade NUMERIC(4, 2) DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MENSAGENS DO TUTOR IA
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender TEXT NOT NULL DEFAULT 'user',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_events_user ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_materials_user ON public.materials(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials(category);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_grades_user ON public.academic_grades(user_id);

-- ===========================================
-- DADOS INICIAIS DE DEMONSTRAÇÃO (SEED)
-- ===========================================
INSERT INTO public.profiles (full_name, course, campus) VALUES
('João Silva', 'Técnico em Informática', 'Campus Maceió')
ON CONFLICT DO NOTHING;

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
