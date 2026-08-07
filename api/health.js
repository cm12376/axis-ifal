// API de saúde - verifica conexão com o banco
import { pool } from './_db.js';
import { ok, fail } from './_helpers.js';

export default async function handler(req, res) {
    try {
        const r = await pool.query('SELECT 1 AS ok');
        return ok(res, { status: 'ok', db: r.rows[0].ok === 1 });
    } catch (err) {
        return fail(res, 'Banco indisponível: ' + err.message);
    }
}