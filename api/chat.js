// API de Chats do Tutor IA — estilo ChatGPT (várias conversas por usuário)
// Tabelas: chat_conversations (id, user_id, title) + chat_messages (conversation_id, sender, message)
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth } from './_auth.js';

function makeTitle(text) {
    const t = String(text || '').replace(/\n/g, ' ').trim().slice(0, 45);
    return t.length ? t + (String(text).length > 45 ? '…' : '') : 'Nova conversa';
}

export default async function handler(req, res) {
    const { method } = req;

    try {
        const user = await requireAuth(req, res);
        if (!user) return;
        const url = new URL(req.url || '/api/chat', 'http://localhost');
        const action = url.searchParams.get('action');
        const queryConvId = url.searchParams.get('conversation_id');

        // Garante tabelas (idempotente, para bancos criados antes desta feature)
        await pool.query(`CREATE TABLE IF NOT EXISTS public.chat_conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT 'Nova conversa',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )`);
        await pool.query(`ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE`);

        switch (method) {
            case 'GET': {
                // Lista de conversas (para a sidebar estilo ChatGPT)
                if (action === 'conversations') {
                    const result = await pool.query(
                        `SELECT c.id, c.title, c.created_at, c.updated_at,
                                (SELECT COUNT(*)::int FROM public.chat_messages m WHERE m.conversation_id = c.id) AS message_count
                         FROM public.chat_conversations c
                         WHERE c.user_id = $1 ORDER BY c.updated_at DESC LIMIT 50`,
                        [user.id]
                    );
                    return ok(res, result.rows);
                }
                // Mensagens de uma conversa específica
                if (queryConvId) {
                    const conv = await pool.query(
                        'SELECT id FROM public.chat_conversations WHERE id = $1 AND user_id = $2',
                        [queryConvId, user.id]
                    );
                    if (!conv.rows.length) return fail(res, 'Conversa não encontrada', 404);
                    const result = await pool.query(
                        'SELECT id, sender, message, created_at FROM public.chat_messages WHERE user_id = $1 AND conversation_id = $2 ORDER BY created_at ASC LIMIT 200',
                        [user.id, queryConvId]
                    );
                    return ok(res, result.rows);
                }
                // Compat: sem conversation_id, retorna mensagens legadas (sem conversa) — usado só na migração
                const legacy = await pool.query(
                    'SELECT id, sender, message, created_at FROM public.chat_messages WHERE user_id = $1 AND conversation_id IS NULL ORDER BY created_at ASC LIMIT 100',
                    [user.id]
                );
                return ok(res, legacy.rows);
            }
            case 'POST': {
                const body = await getBody(req);
                // Criar nova conversa
                if (action === 'conversations' || body.create_conversation) {
                    const title = (body.title || 'Nova conversa').slice(0, 80);
                    const result = await pool.query(
                        'INSERT INTO public.chat_conversations (user_id, title) VALUES ($1, $2) RETURNING *',
                        [user.id, title]
                    );
                    return ok(res, result.rows[0], 201);
                }
                // Renomear conversa
                if (action === 'rename') {
                    const { conversation_id, title } = body;
                    if (!conversation_id || !title) return fail(res, 'Parâmetros obrigatórios', 400);
                    const result = await pool.query(
                        'UPDATE public.chat_conversations SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
                        [String(title).slice(0, 80), conversation_id, user.id]
                    );
                    if (!result.rows.length) return fail(res, 'Conversa não encontrada', 404);
                    return ok(res, result.rows[0]);
                }
                // Salvar mensagem (cria conversa automaticamente se não informar)
                const { sender = 'user', message, conversation_id } = body;
                if (!message) return fail(res, 'Mensagem obrigatória', 400);
                let convId = conversation_id || null;
                if (!convId) {
                    const created = await pool.query(
                        'INSERT INTO public.chat_conversations (user_id, title) VALUES ($1, $2) RETURNING *',
                        [user.id, makeTitle(message)]
                    );
                    convId = created.rows[0].id;
                } else {
                    const conv = await pool.query(
                        'SELECT id, title FROM public.chat_conversations WHERE id = $1 AND user_id = $2',
                        [convId, user.id]
                    );
                    if (!conv.rows.length) return fail(res, 'Conversa não encontrada', 404);
                    // Auto-titula "Nova conversa" com a primeira mensagem do usuário
                    if (conv.rows[0].title === 'Nova conversa' && sender === 'user') {
                        await pool.query('UPDATE public.chat_conversations SET title = $1 WHERE id = $2', [makeTitle(message), convId]);
                    }
                }
                const result = await pool.query(
                    `INSERT INTO public.chat_messages (user_id, conversation_id, sender, message)
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [user.id, convId, sender, message]
                );
                await pool.query('UPDATE public.chat_conversations SET updated_at = NOW() WHERE id = $1', [convId]);
                return ok(res, { ...result.rows[0], conversation_id: convId }, 201);
            }
            case 'DELETE': {
                const body = await getBody(req).catch(() => ({}));
                const convId = queryConvId || body.conversation_id;
                // Apagar UMA conversa (e suas mensagens via CASCADE)
                if (convId) {
                    await pool.query('DELETE FROM public.chat_messages WHERE user_id = $1 AND conversation_id = $2', [user.id, convId]);
                    await pool.query('DELETE FROM public.chat_conversations WHERE id = $1 AND user_id = $2', [convId, user.id]);
                    return ok(res, { success: true });
                }
                // Apagar TUDO (legado)
                await pool.query('DELETE FROM public.chat_messages WHERE user_id = $1', [user.id]);
                await pool.query('DELETE FROM public.chat_conversations WHERE user_id = $1', [user.id]);
                return ok(res, { success: true });
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        console.error('chat error:', err);
        return fail(res, 'Erro ao processar conversas do tutor', 500);
    }
}
