// API de Autenticação: registo, login, logout e utilizador atual
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';
import { hashPassword, verifyPassword, createSession, destroySession, getSessionUser, sanitizeUser } from './_auth.js';

export default async function handler(req, res) {
    const { method } = req;
    const segments = (req.url?.split('?')[0] || '').split('/').filter(Boolean);
    const action = segments[segments.length - 1];

    try {
        if (method === 'POST' && action === 'register') {
            const body = await getBody(req);
            const email = (body.email || '').trim().toLowerCase();
            const { password, full_name, course, campus } = body;

            if (!email || !password) return fail(res, 'E-mail e senha são obrigatórios', 400);
            if (password.length < 6) return fail(res, 'A senha deve ter pelo menos 6 caracteres', 400);

            const existing = await pool.query('SELECT id FROM public.profiles WHERE email = $1', [email]);
            if (existing.rows.length) return fail(res, 'Este e-mail já está cadastrado', 409);

            const passwordHash = hashPassword(password);
            const result = await pool.query(
                `INSERT INTO public.profiles (email, password_hash, full_name, course, campus)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [email, passwordHash, full_name || 'Estudante Novato', course || 'Técnico em Informática', campus || 'Campus Maceió']
            );
            await createSession(res, result.rows[0].id);
            return ok(res, sanitizeUser(result.rows[0]), 201);
        }

        if (method === 'POST' && action === 'login') {
            const body = await getBody(req);
            const email = (body.email || '').trim().toLowerCase();
            const { password } = body;
            if (!email || !password) return fail(res, 'E-mail e senha são obrigatórios', 400);

            const result = await pool.query('SELECT * FROM public.profiles WHERE email = $1', [email]);
            const user = result.rows[0];
            if (!user || !verifyPassword(password, user.password_hash)) {
                return fail(res, 'E-mail ou senha inválidos', 401);
            }
            await createSession(res, user.id);
            return ok(res, sanitizeUser(user));
        }

        if (method === 'POST' && action === 'logout') {
            await destroySession(req, res);
            return ok(res, { success: true });
        }

        if (method === 'GET' && action === 'me') {
            const user = await getSessionUser(req);
            if (!user) return fail(res, 'Não autenticado', 401);
            return ok(res, sanitizeUser(user));
        }

        return fail(res, 'Rota não encontrada', 404);
    } catch (err) {
        console.error('auth error:', err);
        return fail(res, 'Erro ao processar autenticação', 500);
    }
}
