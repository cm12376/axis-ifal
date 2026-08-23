// API de Notas / Desempenho (isolada por usuário autenticado)
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
                    'SELECT * FROM public.academic_grades WHERE user_id = $1 ORDER BY subject ASC',
                    [user.id]
                );
                return ok(res, result.rows);
            }
            case 'POST': {
                const body = await getBody(req);
                const { subject, b1_grade = 0, b2_grade = 0 } = body;
                if (!subject) return fail(res, 'Disciplina é obrigatória', 400);
                const result = await pool.query(
                    `INSERT INTO public.academic_grades (user_id, subject, b1_grade, b2_grade)
                     VALUES ($1, $2, $3, $4) RETURNING *`,
                    [user.id, subject, b1_grade, b2_grade]
                );
                return ok(res, result.rows[0], 201);
            }
            case 'PUT': {
                if (!id) return fail(res, 'ID ausente', 400);
                const body = await getBody(req);
                const { subject, b1_grade, b2_grade } = body;
                const result = await pool.query(
                    `UPDATE public.academic_grades
                     SET subject = COALESCE($1, subject),
                         b1_grade = COALESCE($2, b1_grade),
                         b2_grade = COALESCE($3, b2_grade),
                         updated_at = NOW()
                     WHERE id = $4 AND user_id = $5 RETURNING *`,
                    [subject, b1_grade, b2_grade, id, user.id]
                );
                return result.rows.length ? ok(res, result.rows[0]) : fail(res, 'Não encontrado', 404);
            }
            case 'DELETE': {
                if (!id) return fail(res, 'ID ausente', 400);
                await pool.query('DELETE FROM public.academic_grades WHERE id = $1 AND user_id = $2', [id, user.id]);
                return ok(res, { success: true });
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        console.error('grades error:', err);
        return fail(res, 'Erro ao processar notas', 500);
    }
}
