// API de Sessões de Pomodoro / Métricas de Estudo (isolada por usuário autenticado)
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
                    'SELECT * FROM public.pomodoro_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500',
                    [user.id]
                );
                return ok(res, result.rows);
            }
            case 'POST': {
                const body = await getBody(req);
                const { category = 'geral', minutes = 25 } = body;
                const result = await pool.query(
                    `INSERT INTO public.pomodoro_sessions (user_id, category, minutes)
                     VALUES ($1, $2, $3) RETURNING *`,
                    [user.id, category, minutes]
                );
                return ok(res, result.rows[0], 201);
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        return fail(res, err.message);
    }
}
