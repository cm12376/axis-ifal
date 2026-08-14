// API de Perfil do Usuário Autenticado
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth, sanitizeUser } from './_auth.js';

export default async function handler(req, res) {
    const { method } = req;
    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        switch (method) {
            case 'GET': {
                return ok(res, sanitizeUser(user));
            }
            case 'PUT': {
                const body = await getBody(req);
                const result = await pool.query(
                    `UPDATE public.profiles
                     SET full_name = $1, course = COALESCE($2, course), campus = COALESCE($3, campus), updated_at = NOW()
                     WHERE id = $4 RETURNING *`,
                    [body.full_name || body.name || user.full_name, body.course, body.campus, user.id]
                );
                return ok(res, sanitizeUser(result.rows[0]));
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        return fail(res, err.message);
    }
}
