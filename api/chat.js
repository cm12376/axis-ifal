// API de Mensagens do Tutor IA (isolada por usuário autenticado)
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
    const { method } = req;

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        switch (method) {
            case 'GET': {
                const result = await pool.query(
                    'SELECT id, sender, message, created_at FROM public.chat_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT 100',
                    [user.id]
                );
                return ok(res, result.rows);
            }
            case 'POST': {
                const body = await getBody(req);
                const { sender = 'user', message } = body;
                if (!message) return fail(res, 'Mensagem obrigatória', 400);
                const result = await pool.query(
                    `INSERT INTO public.chat_messages (user_id, sender, message)
                     VALUES ($1, $2, $3) RETURNING *`,
                    [user.id, sender, message]
                );
                return ok(res, result.rows[0], 201);
            }
            case 'DELETE': {
                await pool.query('DELETE FROM public.chat_messages WHERE user_id = $1', [user.id]);
                return ok(res, { success: true });
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        console.error('chat error:', err);
        return fail(res, 'Erro ao processar mensagens do tutor', 500);
    }
}
