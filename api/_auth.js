// Autenticação por login/senha com sessão guardada no Neon (cookie httpOnly)
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { pool } from './_db.js';

const SESSION_COOKIE = 'axis_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

export function hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
    if (!stored || !stored.includes(':')) return false;
    const [salt, hash] = stored.split(':');
    const hashBuffer = Buffer.from(hash, 'hex');
    const testBuffer = scryptSync(password, salt, 64);
    if (testBuffer.length !== hashBuffer.length) return false;
    return timingSafeEqual(testBuffer, hashBuffer);
}

function parseCookies(req) {
    const header = req.headers?.cookie;
    const cookies = {};
    if (!header) return cookies;
    header.split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;
        cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    });
    return cookies;
}

export async function createSession(res, userId) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await pool.query(
        'INSERT INTO public.sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userId, token, expiresAt]
    );
    const secure = process.env.VERCEL ? ' Secure;' : '';
    res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
    );
    return token;
}

export async function destroySession(req, res) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) {
        await pool.query('DELETE FROM public.sessions WHERE token = $1', [token]);
    }
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export async function getSessionUser(req) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;
    const result = await pool.query(
        `SELECT p.* FROM public.sessions s
         JOIN public.profiles p ON p.id = s.user_id
         WHERE s.token = $1 AND s.expires_at > NOW()`,
        [token]
    );
    return result.rows[0] || null;
}

export async function requireAuth(req, res) {
    const user = await getSessionUser(req);
    if (!user) {
        res.status(401).json({ error: 'Não autenticado' });
        return null;
    }
    return user;
}

export function sanitizeUser(user) {
    if (!user) return null;
    // A chave cifrada nunca sai do servidor; o cliente recebe apenas a dica e o estado.
    const { password_hash, groq_api_key_enc, ...rest } = user;
    return { ...rest, has_groq_key: Boolean(groq_api_key_enc) };
}
