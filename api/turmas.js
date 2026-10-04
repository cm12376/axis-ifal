// API de Turmas (painel do professor + matrícula do aluno via código)
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth } from './_auth.js';
import { randomBytes } from 'node:crypto';

function novoCodigo() {
    return randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

async function gerarCodigoUnico() {
    for (let i = 0; i < 10; i++) {
        const cod = novoCodigo();
        const { rows } = await pool.query('SELECT id FROM public.turmas WHERE codigo_convite = $1', [cod]);
        if (!rows.length) return cod;
    }
    return randomBytes(6).toString('hex').toUpperCase().slice(0, 8);
}

export default async function handler(req, res) {
    const { method } = req;
    const url = new URL(req.url || '/', 'http://localhost');
    const action = url.searchParams.get('action') || '';

    try {
        const user = await requireAuth(req, res);
        if (!user) return;
        const isProf = user.role === 'professor';

        // GET /api/turmas -> minhas turmas (como professor + como aluno)
        if (method === 'GET' && !action) {
            const como_prof = await pool.query(
                `SELECT t.*, (SELECT COUNT(*)::int FROM public.turma_alunos ta WHERE ta.turma_id = t.id) AS alunos
                 FROM public.turmas t WHERE t.teacher_id = $1 ORDER BY t.created_at DESC`,
                [user.id]
            );
            const como_aluno = await pool.query(
                `SELECT t.*, p.full_name AS professor_nome
                 FROM public.turmas t
                 JOIN public.turma_alunos ta ON ta.turma_id = t.id
                 LEFT JOIN public.profiles p ON p.id = t.teacher_id
                 WHERE ta.user_id = $1 ORDER BY t.created_at DESC`,
                [user.id]
            );
            return ok(res, { como_professor: como_prof.rows, como_aluno: como_aluno.rows });
        }

        // POST /api/turmas -> criar (só professor)
        if (method === 'POST' && !action) {
            if (!isProf) return fail(res, 'Apenas professores podem criar turmas', 403);
            const body = await getBody(req);
            const { nome, disciplina = '', semestre = '' } = body;
            if (!nome || !nome.trim()) return fail(res, 'Nome da turma é obrigatório', 400);
            const codigo = await gerarCodigoUnico();
            const result = await pool.query(
                `INSERT INTO public.turmas (teacher_id, nome, disciplina, semestre, codigo_convite)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [user.id, nome.trim(), disciplina.trim(), semestre.trim(), codigo]
            );
            return ok(res, result.rows[0], 201);
        }

        // PATCH /api/turmas?action=update -> editar dados (dono)
        if (method === 'PATCH' && action === 'update') {
            const body = await getBody(req);
            const { id, nome, disciplina, semestre } = body;
            if (!id) return fail(res, 'ID ausente', 400);
            const result = await pool.query(
                `UPDATE public.turmas SET nome = COALESCE($2, nome), disciplina = COALESCE($3, disciplina),
                 semestre = COALESCE($4, semestre), updated_at = NOW()
                 WHERE id = $1 AND teacher_id = $5 RETURNING *`,
                [id, nome || null, disciplina ?? null, semestre ?? null, user.id]
            );
            if (!result.rows.length) return fail(res, 'Turma não encontrada', 404);
            return ok(res, result.rows[0]);
        }

        // POST /api/turmas?action=renew -> renovar código (dono)
        if (method === 'POST' && action === 'renew') {
            const body = await getBody(req);
            const { id } = body;
            if (!id) return fail(res, 'ID ausente', 400);
            const codigo = await gerarCodigoUnico();
            const result = await pool.query(
                `UPDATE public.turmas SET codigo_convite = $2, convite_ativo = TRUE, updated_at = NOW()
                 WHERE id = $1 AND teacher_id = $3 RETURNING *`,
                [id, codigo, user.id]
            );
            if (!result.rows.length) return fail(res, 'Turma não encontrada', 404);
            return ok(res, result.rows[0]);
        }

        // POST /api/turmas?action=toggle -> ativar/desativar convite (dono)
        if (method === 'POST' && action === 'toggle') {
            const body = await getBody(req);
            const { id } = body;
            if (!id) return fail(res, 'ID ausente', 400);
            const result = await pool.query(
                `UPDATE public.turmas SET convite_ativo = NOT convite_ativo, updated_at = NOW()
                 WHERE id = $1 AND teacher_id = $2 RETURNING *`,
                [id, user.id]
            );
            if (!result.rows.length) return fail(res, 'Turma não encontrada', 404);
            return ok(res, result.rows[0]);
        }

        // DELETE /api/turmas?id= -> apagar turma (dono)
        if (method === 'DELETE' && !action) {
            const id = url.searchParams.get('id');
            if (!id) return fail(res, 'ID ausente', 400);
            await pool.query('DELETE FROM public.turmas WHERE id = $1 AND teacher_id = $2', [id, user.id]);
            return ok(res, { success: true });
        }

        // GET /api/turmas?action=members&id= -> lista de alunos (só nome e e-mail)
        if (method === 'GET' && action === 'members') {
            const id = url.searchParams.get('id');
            if (!id) return fail(res, 'ID ausente', 400);
            const t = await pool.query('SELECT teacher_id FROM public.turmas WHERE id = $1', [id]);
            if (!t.rows.length) return fail(res, 'Turma não encontrada', 404);
            const isMember = await pool.query(
                'SELECT 1 FROM public.turma_alunos WHERE turma_id = $1 AND user_id = $2', [id, user.id]
            );
            if (t.rows[0].teacher_id !== user.id && !isMember.rows.length) {
                return fail(res, 'Sem acesso a esta turma', 403);
            }
            const result = await pool.query(
                `SELECT p.id, p.full_name AS nome, p.email, ta.created_at AS desde
                 FROM public.turma_alunos ta JOIN public.profiles p ON p.id = ta.user_id
                 WHERE ta.turma_id = $1 ORDER BY p.full_name ASC`,
                [id]
            );
            return ok(res, result.rows);
        }

        // POST /api/turmas?action=join {codigo} -> aluno entra na turma
        if (method === 'POST' && action === 'join') {
            const body = await getBody(req);
            const codigo = (body.codigo || '').trim().toUpperCase();
            if (!codigo) return fail(res, 'Código obrigatório', 400);
            const t = await pool.query('SELECT * FROM public.turmas WHERE codigo_convite = $1', [codigo]);
            if (!t.rows.length) return fail(res, 'Código inválido', 404);
            if (!t.rows[0].convite_ativo) return fail(res, 'Convite desativado pelo professor', 403);
            if (t.rows[0].teacher_id === user.id) return fail(res, 'Você é o professor desta turma', 400);
            await pool.query(
                `INSERT INTO public.turma_alunos (turma_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [t.rows[0].id, user.id]
            );
            return ok(res, t.rows[0]);
        }

        // DELETE /api/turmas?action=remove&id=&user_id= -> dono remove aluno; aluno sai sozinho (user_id próprio)
        if (method === 'DELETE' && action === 'remove') {
            const id = url.searchParams.get('id');
            const alvo = url.searchParams.get('user_id') || user.id;
            if (!id) return fail(res, 'ID ausente', 400);
            const t = await pool.query('SELECT teacher_id FROM public.turmas WHERE id = $1', [id]);
            if (!t.rows.length) return fail(res, 'Turma não encontrada', 404);
            if (t.rows[0].teacher_id !== user.id && alvo !== user.id) {
                return fail(res, 'Sem permissão', 403);
            }
            await pool.query('DELETE FROM public.turma_alunos WHERE turma_id = $1 AND user_id = $2', [id, alvo]);
            return ok(res, { success: true });
        }

        return fail(res, 'Rota não encontrada', 404);
    } catch (err) {
        console.error('turmas error:', err);
        return fail(res, 'Erro ao processar turma', 500);
    }
}
