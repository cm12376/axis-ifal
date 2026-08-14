// API de Materiais de Estudo (isolada por usuário autenticado)
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
                    'SELECT * FROM public.materials WHERE user_id = $1 ORDER BY created_at DESC',
                    [user.id]
                );
                return ok(res, result.rows);
            }
            case 'POST': {
                const body = await getBody(req);
                const { title, link, link_url, category = 'geral', description = '' } = body;
                if (!title || !(link || link_url)) {
                    return fail(res, 'Título e URL são obrigatórios', 400);
                }
                const result = await pool.query(
                    `INSERT INTO public.materials (user_id, title, link_url, category, description)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [user.id, title, link || link_url, category, description]
                );
                return ok(res, result.rows[0], 201);
            }
            case 'DELETE': {
                if (!id) return fail(res, 'ID ausente', 400);
                await pool.query('DELETE FROM public.materials WHERE id = $1 AND user_id = $2', [id, user.id]);
                return ok(res, { success: true });
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        return fail(res, err.message);
    }
}
