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
    campus TEXT DEFAULT 'Campus Viçosa',
    avatar_url TEXT DEFAULT '',
    -- Chave da API Groq do estudante, cifrada com AES-256-GCM (nunca em texto puro)
    groq_api_key_enc TEXT,
    -- Últimos caracteres da chave, só para exibição no formulário (ex: gsk_...4f2a)
    groq_key_hint TEXT,
    groq_model TEXT DEFAULT 'auto',
    notif_sound TEXT DEFAULT 'default',
    notif_sound_custom TEXT,
    role TEXT DEFAULT 'aluno',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migração idempotente para bancos já existentes (criados antes do login)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS groq_api_key_enc TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS groq_key_hint TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS groq_model TEXT DEFAULT 'auto';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_sound TEXT DEFAULT 'default';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_sound_custom TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'aluno';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE;
ALTER TABLE public.avisos ADD COLUMN IF NOT EXISTS link_url TEXT DEFAULT '';

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

-- 7. CONVERSAS DO TUTOR IA (estilo ChatGPT: vários chats por usuário)
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nova conversa',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7B. MENSAGENS DO TUTOR IA (vinculadas a uma conversa)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL DEFAULT 'user',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE;

-- 8. SESSÕES DE POMODORO (métricas de estudo)
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'geral',
    minutes INTEGER NOT NULL DEFAULT 25,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. INSCRIÇÕES PUSH (PWA - alertas em segundo plano)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_endpoint ON public.push_subscriptions(endpoint);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_events_user ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_materials_user ON public.materials(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials(category);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_user ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_grades_user ON public.academic_grades(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_user ON public.pomodoro_sessions(user_id);
-- 10. TURMAS (painel do professor)
CREATE TABLE IF NOT EXISTS public.turmas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    disciplina TEXT NOT NULL DEFAULT '',
    semestre TEXT NOT NULL DEFAULT '',
    codigo_convite TEXT UNIQUE,
    convite_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10B. ALUNOS DA TURMA
CREATE TABLE IF NOT EXISTS public.turma_alunos (
    turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (turma_id, user_id)
);

-- 11. AVISOS DA TURMA (mural do aluno)
CREATE TABLE IF NOT EXISTS public.avisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    texto TEXT NOT NULL DEFAULT '',
    link_url TEXT DEFAULT '',
    editado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eventos de turma (caem no calendário dos alunos membros)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_turmas_teacher ON public.turmas(teacher_id);
CREATE INDEX IF NOT EXISTS idx_turmas_codigo ON public.turmas(codigo_convite);
CREATE INDEX IF NOT EXISTS idx_turma_alunos_turma ON public.turma_alunos(turma_id);
CREATE INDEX IF NOT EXISTS idx_turma_alunos_user ON public.turma_alunos(user_id);
CREATE INDEX IF NOT EXISTS idx_avisos_turma ON public.avisos(turma_id);
CREATE INDEX IF NOT EXISTS idx_events_turma ON public.events(turma_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_date ON public.pomodoro_sessions(session_date);
