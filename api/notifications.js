// API de Notificações (isolada por usuário autenticado)
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
    const { method } = req;
    const segments = (req.url?.split('?')[0] || '').split('/').filter(Boolean);
    const id = segments[segments.length - 1];

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        switch (method) {
            case 'GET': {
                const result = await pool.query(
                    'SELECT * FROM public.notifications WHERE user_id = $1 ORDER BY created_at DESC',
                    [user.id]
                );
                return ok(res, result.rows);
            }
            case 'POST': {
                const body = await getBody(req);
                const { text, read = false, date_label = 'Agora' } = body;
                if (!text) return fail(res, 'Texto obrigatório', 400);
                const result = await pool.query(
                    `INSERT INTO public.notifications (user_id, text, read, date_label)
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [user.id, text, read, date_label]
                );
                return ok(res, result.rows[0], 201);
            }
            case 'PATCH': {
                if (!id) return fail(res, 'ID ausente', 400);
                const result = await pool.query(
                    'UPDATE public.notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
                    [id, user.id]
                );
                return result.rows.length ? ok(res, result.rows[0]) : fail(res, 'Não encontrado', 404);
            }
            case 'DELETE': {
                // DELETE /api/notifications  => limpa todas do usuário
                await pool.query('DELETE FROM public.notifications WHERE user_id = $1', [user.id]);
                return ok(res, { success: true });
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        return fail(res, err.message);
    }
}
