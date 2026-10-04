// API de Avisos da Turma (mural do aluno; edição marca "editado")
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth } from './_auth.js';

async function notificarTurma(turmaId, turmaNome, texto, exceto = null) {
    try {
        const { rows } = await pool.query(
            'SELECT user_id FROM public.turma_alunos WHERE turma_id = $1',
            [turmaId]
        );
        for (const r of rows) {
            if (exceto && r.user_id === exceto) continue;
            await pool.query(
                `INSERT INTO public.notifications (user_id, text, date_label) VALUES ($1, $2, 'Hoje')`,
                [r.user_id, `[${turmaNome}] ${texto}`]
            );
        }
    } catch (e) { console.error('notify turma error:', e); }
}

export default async function handler(req, res) {
    const { method } = req;
    const url = new URL(req.url || '/', 'http://localhost');
    const action = url.searchParams.get('action') || '';

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        // GET /api/avisos -> avisos das minhas turmas (aluno) + das que leciono (professor)
        if (method === 'GET' && !action) {
            const result = await pool.query(
                `SELECT a.*, t.nome AS turma_nome, p.full_name AS professor_nome
                 FROM public.avisos a
                 JOIN public.turmas t ON t.id = a.turma_id
                 LEFT JOIN public.profiles p ON p.id = a.teacher_id
                 WHERE a.turma_id IN (SELECT turma_id FROM public.turma_alunos WHERE user_id = $1)
                    OR a.teacher_id = $1
                 ORDER BY a.created_at DESC LIMIT 100`,
                [user.id]
            );
            return ok(res, result.rows);
        }

        // POST /api/avisos -> publicar (professor dono da turma)
        if (method === 'POST' && !action) {
            const body = await getBody(req);
            const { turma_id, titulo, texto = '' } = body;
            if (!turma_id || !titulo || !titulo.trim()) return fail(res, 'Turma e título são obrigatórios', 400);
            const t = await pool.query('SELECT * FROM public.turmas WHERE id = $1 AND teacher_id = $2', [turma_id, user.id]);
            if (!t.rows.length) return fail(res, 'Turma não encontrada', 404);
            const result = await pool.query(
                `INSERT INTO public.avisos (turma_id, teacher_id, titulo, texto)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [turma_id, user.id, titulo.trim(), texto]
            );
            await notificarTurma(turma_id, t.rows[0].nome, `Novo aviso: ${titulo.trim()}`);
            return ok(res, result.rows[0], 201);
        }

        // PUT /api/avisos -> editar (marca editado)
        if (method === 'PUT' && !action) {
            const body = await getBody(req);
            const { id, titulo, texto } = body;
            if (!id) return fail(res, 'ID ausente', 400);
            const result = await pool.query(
                `UPDATE public.avisos SET titulo = COALESCE($2, titulo), texto = COALESCE($3, texto),
                 editado = TRUE, updated_at = NOW()
                 WHERE id = $1 AND teacher_id = $4 RETURNING *`,
                [id, titulo ?? null, texto ?? null, user.id]
            );
            if (!result.rows.length) return fail(res, 'Aviso não encontrado', 404);
            return ok(res, result.rows[0]);
        }

        // DELETE /api/avisos?id=
        if (method === 'DELETE' && !action) {
            const id = url.searchParams.get('id');
            if (!id) return fail(res, 'ID ausente', 400);
            await pool.query('DELETE FROM public.avisos WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            return ok(res, { success: true });
        }

        return fail(res, 'Rota não encontrada', 404);
    } catch (err) {
        console.error('avisos error:', err);
        return fail(res, 'Erro ao processar aviso', 500);
    }
}

export { notificarTurma };
