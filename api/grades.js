// API de Notas / Desempenho (isolada por usuário autenticado)
import { pool } from './_db.js';
import { ok, fail } from './_helpers.js';
import { requireAuth } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return fail(res, 'Método não suportado', 405);
    try {
        const user = await requireAuth(req, res);
        if (!user) return;
        const result = await pool.query(
            'SELECT * FROM public.academic_grades WHERE user_id = $1 ORDER BY subject ASC',
            [user.id]
        );
        return ok(res, result.rows);
    } catch (err) {
        return fail(res, err.message);
    }
}
