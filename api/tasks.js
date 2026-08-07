// API de Tarefas Kanban
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';

export default async function handler(req, res) {
    const { method } = req;
    const segments = (req.url?.split('?')[0] || '').split('/').filter(Boolean);
    const id = segments[segments.length - 1]; // id presente se for /api/tasks/<id>

    try {
        switch (method) {
            case 'GET': {
                const result = await pool.query(
                    'SELECT * FROM public.tasks ORDER BY created_at DESC'
                );
                return ok(res, result.rows);
            }
            case 'POST': {
                const body = await getBody(req);
                const { title, category = 'geral', date, due_date, priority = 'media', status = 'todo' } = body;
                if (!title || !(date || due_date)) {
                    return fail(res, 'Título e data são obrigatórios', 400);
                }
                const result = await pool.query(
                    `INSERT INTO public.tasks (title, category, due_date, priority, status)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [title, category, date || due_date, priority, status]
                );
                return ok(res, result.rows[0], 201);
            }
            case 'PATCH': {
                if (!id) return fail(res, 'ID ausente', 400);
                const body = await getBody(req);
                const { status: newStatus } = body;
                const result = await pool.query(
                    'UPDATE public.tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                    [newStatus, id]
                );
                return result.rows.length ? ok(res, result.rows[0]) : fail(res, 'Não encontrado', 404);
            }
            case 'DELETE': {
                if (!id) return fail(res, 'ID ausente', 400);
                await pool.query('DELETE FROM public.tasks WHERE id = $1', [id]);
                return ok(res, { success: true });
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        return fail(res, err.message);
    }
}