// API de Perfil do Usuário
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';

export default async function handler(req, res) {
    const { method } = req;
    const segments = (req.url?.split('?')[0] || '').split('/').filter(Boolean);
    const id = segments[segments.length - 1];
    try {
        switch (method) {
            case 'GET': {
                const result = await pool.query('SELECT * FROM public.profiles ORDER BY created_at ASC LIMIT 1');
                return ok(res, result.rows[0] || null);
            }
            case 'PUT': {
                if (!id) return fail(res, 'ID ausente', 400);
                const body = await getBody(req);
                const result = await pool.query(
                    'UPDATE public.profiles SET full_name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                    [body.full_name || body.name, id]
                );
                return result.rows.length ? ok(res, result.rows[0]) : fail(res, 'Não encontrado', 404);
            }
            case 'POST': {
                const body = await getBody(req);
                const { full_name, name, course, campus } = body;
                const fullName = full_name || name || 'Estudante Novato';
                const result = await pool.query(
                    `INSERT INTO public.profiles (full_name, course, campus)
                     VALUES ($1, $2, $3) RETURNING *`,
                    [fullName, course || 'Técnico em Informática', campus || 'Campus Maceió']
                );
                return ok(res, result.rows[0], 201);
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        return fail(res, err.message);
    }
}