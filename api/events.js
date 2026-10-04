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
                    `SELECT e.*, t.nome AS turma_nome FROM public.events e
                     LEFT JOIN public.turmas t ON t.id = e.turma_id
                     WHERE e.user_id = $1
                        OR e.turma_id IN (SELECT turma_id FROM public.turma_alunos WHERE user_id = $1)
                     ORDER BY e.event_date ASC`,
                    [user.id]
                );
                return ok(res, result.rows);
            }
            case 'POST': {
                const body = await getBody(req);
                const { title, date, event_date, type, event_type = 'prova', description = '', turma_id = null } = body;
                if (!title || !(date || event_date)) {
                    return fail(res, 'Título e data são obrigatórios', 400);
                }
                // Evento de turma: só o professor dono pode publicar
                if (turma_id) {
                    const t = await pool.query(
                        'SELECT * FROM public.turmas WHERE id = $1 AND teacher_id = $2',
                        [turma_id, user.id]
                    );
                    if (!t.rows.length) return fail(res, 'Turma não encontrada', 404);
                    const result = await pool.query(
                        `INSERT INTO public.events (user_id, turma_id, title, event_date, event_type, description)
                         VALUES (NULL, $1, $2, $3, $4, $5) RETURNING *`,
                        [turma_id, title, date || event_date, type || event_type, description]
                    );
                    const { rows: membros } = await pool.query(
                        'SELECT user_id FROM public.turma_alunos WHERE turma_id = $1', [turma_id]
                    );
                    for (const m of membros) {
                        await pool.query(
                            `INSERT INTO public.notifications (user_id, text, date_label) VALUES ($1, $2, 'Hoje')`,
                            [m.user_id, `[${t.rows[0].nome}] Novo evento: ${title} (${date || event_date})`]
                        );
                    }
                    return ok(res, result.rows[0], 201);
                }
                const result = await pool.query(
                    `INSERT INTO public.events (user_id, title, event_date, event_type, description)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [user.id, title, date || event_date, type || event_type, description]
                );
                return ok(res, result.rows[0], 201);
            }
            case 'PUT': {
                const body = await getBody(req);
                const { id: bodyId, title, date, event_date, type, event_type, description } = body;
                const eid = bodyId || (id && id !== 'events' ? id : null);
                if (!eid) return fail(res, 'ID ausente', 400);
                const ev = await pool.query('SELECT * FROM public.events WHERE id = $1', [eid]);
                if (!ev.rows.length) return fail(res, 'Evento não encontrado', 404);
                const own = ev.rows[0].user_id === user.id;
                const ownTurma = ev.rows[0].turma_id
                    ? (await pool.query('SELECT 1 FROM public.turmas WHERE id = $1 AND teacher_id = $2', [ev.rows[0].turma_id, user.id])).rows.length > 0
                    : false;
                if (!own && !ownTurma) return fail(res, 'Sem permissão', 403);
                const result = await pool.query(
                    `UPDATE public.events SET title = COALESCE($2, title), event_date = COALESCE($3, event_date),
                     event_type = COALESCE($4, event_type), description = COALESCE($5, description)
                     WHERE id = $1 RETURNING *`,
                    [eid, title ?? null, date || event_date || null, type || event_type || null, description ?? null]
                );
                return ok(res, result.rows[0]);
            }
            case 'DELETE': {
                if (!id) return fail(res, 'ID ausente', 400);
                const ev = await pool.query('SELECT * FROM public.events WHERE id = $1', [id]);
                if (ev.rows.length && ev.rows[0].turma_id) {
                    const ownTurma = (await pool.query(
                        'SELECT 1 FROM public.turmas WHERE id = $1 AND teacher_id = $2',
                        [ev.rows[0].turma_id, user.id]
                    )).rows.length > 0;
                    if (!ownTurma) return fail(res, 'Sem permissão', 403);
                    await pool.query('DELETE FROM public.events WHERE id = $1', [id]);
                } else {
                    await pool.query('DELETE FROM public.events WHERE id = $1 AND user_id = $2', [id, user.id]);
                }
                return ok(res, { success: true });
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        console.error('events error:', err);
        return fail(res, 'Erro ao processar evento', 500);
    }
}
