// API de Eventos / Calendário (isolada por usuário autenticado)
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
                    'SELECT * FROM public.events WHERE user_id = $1 ORDER BY event_date ASC',
                    [user.id]
                );
                return ok(res, result.rows);
            }
            case 'POST': {
                const body = await getBody(req);
                const { title, date, event_date, type, event_type = 'prova', description = '' } = body;
                if (!title || !(date || event_date)) {
                    return fail(res, 'Título e data são obrigatórios', 400);
                }
                const result = await pool.query(
                    `INSERT INTO public.events (user_id, title, event_date, event_type, description)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [user.id, title, date || event_date, type || event_type, description]
                );
                return ok(res, result.rows[0], 201);
            }
            case 'DELETE': {
                if (!id) return fail(res, 'ID ausente', 400);
                await pool.query('DELETE FROM public.events WHERE id = $1 AND user_id = $2', [id, user.id]);
                return ok(res, { success: true });
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        return fail(res, err.message);
    }
}
