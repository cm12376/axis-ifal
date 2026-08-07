// API de Eventos / Calendário
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';

export default async function handler(req, res) {
    const { method } = req;
    const segments = (req.url?.split('?')[0] || '').split('/').filter(Boolean);
    const id = segments[segments.length - 1];

    try {
        switch (method) {
            case 'GET': {
                const result = await pool.query(
                    'SELECT * FROM public.events ORDER BY event_date ASC'
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
                    `INSERT INTO public.events (title, event_date, event_type, description)
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [title, date || event_date, type || event_type, description]
                );
                return ok(res, result.rows[0], 201);
            }
            case 'DELETE': {
                if (!id) return fail(res, 'ID ausente', 400);
                await pool.query('DELETE FROM public.events WHERE id = $1', [id]);
                return ok(res, { success: true });
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        return fail(res, err.message);
    }
}