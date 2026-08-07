// API de Notas / Desempenho
import { pool } from './_db.js';
import { ok, fail } from './_helpers.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return fail(res, 'Método não suportado', 405);
    try {
        const result = await pool.query(
            'SELECT * FROM public.academic_grades ORDER BY subject ASC'
        );
        return ok(res, result.rows);
    } catch (err) {
        return fail(res, err.message);
    }
}