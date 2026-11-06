// API de Autenticação: registo, login, logout, utilizador atual e recuperação de senha
import { createHash, randomBytes } from 'node:crypto';
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';
import { hashPassword, verifyPassword, createSession, destroySession, getSessionUser, sanitizeUser } from './_auth.js';
import { sendMail, mailConfigured } from './_mailer.js';

const RESET_TTL_MINUTES = 60;

function sha256(value) {
    return createHash('sha256').update(String(value)).digest('hex');
}

// URL pública do site, usada para montar o link do e-mail.
function getOrigin(req) {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'axis-ifal-tawny.vercel.app').split(',')[0].trim();
    return `${proto}://${host}`;
}

function resetEmailHtml({ name, link }) {
    const safeName = String(name || 'estudante').replace(/[<>&"]/g, '');
    return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111c33;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 28px 8px;">
          <div style="font-size:20px;font-weight:900;color:#34d399;letter-spacing:1px;">AXIS IFAL</div>
        </td></tr>
        <tr><td style="padding:8px 28px 0;">
          <h1 style="margin:0;font-size:20px;color:#f8fafc;">Redefinir sua senha</h1>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#94a3b8;">
            Olá, ${safeName}! Recebemos um pedido para redefinir a senha da sua conta na Plataforma AXIS.
            Clique no botão abaixo para criar uma nova senha.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:24px 28px;">
          <a href="${link}" style="display:inline-block;background:#10b981;color:#052e22;text-decoration:none;font-weight:800;font-size:14px;padding:14px 28px;border-radius:12px;">
            Criar nova senha
          </a>
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
            Este link expira em ${RESET_TTL_MINUTES} minutos e só pode ser usado uma vez.
            Se você não solicitou a troca, ignore este e-mail — sua senha continua a mesma.
          </p>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#475569;word-break:break-all;">
            Se o botão não funcionar, copie e cole este endereço no navegador:<br>
            <a href="${link}" style="color:#34d399;">${link}</a>
          </p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#475569;">Plataforma AXIS IFAL — organize seus estudos em um só lugar.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
    const { method } = req;
    const segments = (req.url?.split('?')[0] || '').split('/').filter(Boolean);
    const action = segments[segments.length - 1];

    try {
        if (method === 'POST' && action === 'register') {
            const body = await getBody(req);
            const email = (body.email || '').trim().toLowerCase();
            const { password, full_name, course, campus } = body;
            const role = body.role === 'professor' ? 'professor' : 'aluno';

            if (!email || !password) return fail(res, 'E-mail e senha são obrigatórios', 400);
            if (password.length < 6) return fail(res, 'A senha deve ter pelo menos 6 caracteres', 400);

            const existing = await pool.query('SELECT id FROM public.profiles WHERE email = $1', [email]);
            if (existing.rows.length) return fail(res, 'Este e-mail já está cadastrado', 409);

            const passwordHash = hashPassword(password);
            const result = await pool.query(
                `INSERT INTO public.profiles (email, password_hash, full_name, course, campus, role)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [email, passwordHash, full_name || (role === 'professor' ? 'Professor(a)' : 'Estudante Novato'), course || 'Técnico em Informática', campus || 'Campus Viçosa', role]
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

        // POST /api/auth/forgot-password -> envia link de redefinição por e-mail
        if (method === 'POST' && (action === 'forgot-password' || action === 'forgot')) {
            const body = await getBody(req);
            const email = (body.email || '').trim().toLowerCase();
            if (!email) return fail(res, 'Informe seu e-mail', 400);
            if (!mailConfigured()) {
                return fail(res, 'Recuperação por e-mail indisponível no momento. Fale com o suporte.', 503);
            }

            // Resposta idêntica exista ou não a conta: não revela e-mails cadastrados.
            const generic = {
                success: true,
                message: 'Se este e-mail estiver cadastrado, enviaremos um link de recuperação em instantes.'
            };

            const result = await pool.query(
                'SELECT id, full_name, email FROM public.profiles WHERE email = $1',
                [email]
            );
            if (!result.rows.length) return ok(res, generic);
            const user = result.rows[0];

            // Evita disparos repetidos (mínimo de 45s entre pedidos do mesmo usuário).
            const recent = await pool.query(
                `SELECT id FROM public.password_resets
                 WHERE user_id = $1 AND created_at > NOW() - INTERVAL '45 seconds'`,
                [user.id]
            );
            if (recent.rows.length) return ok(res, generic);

            // Invalida links anteriores ainda não usados.
            await pool.query(
                'UPDATE public.password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
                [user.id]
            );

            const token = randomBytes(32).toString('hex');
            const tokenHash = sha256(token);
            const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

            await pool.query(
                'INSERT INTO public.password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
                [user.id, tokenHash, expiresAt]
            );

            const link = `${getOrigin(req)}/?reset_token=${token}`;
            try {
                await sendMail({
                    to: user.email,
                    toName: user.full_name,
                    subject: 'Redefinir sua senha — AXIS IFAL',
                    html: resetEmailHtml({ name: user.full_name, link }),
                    text: `Olá, ${user.full_name || 'estudante'}!\n\nPara redefinir sua senha na Plataforma AXIS, acesse:\n${link}\n\nEste link expira em ${RESET_TTL_MINUTES} minutos e só pode ser usado uma vez.\nSe você não solicitou a troca, ignore este e-mail.`
                });
            } catch (err) {
                console.error('password reset email error:', err);
                await pool.query('DELETE FROM public.password_resets WHERE token_hash = $1', [tokenHash]);
                return fail(res, 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.', 502);
            }

            return ok(res, generic);
        }

        // GET /api/auth/verify-reset?token=... -> confere se o link ainda vale
        if (method === 'GET' && action === 'verify-reset') {
            const token = String(req.query?.token || '');
            if (!token) return ok(res, { valid: false });
            const result = await pool.query(
                `SELECT id FROM public.password_resets
                 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
                [sha256(token)]
            );
            return ok(res, { valid: result.rows.length > 0 });
        }

        // POST /api/auth/reset-password -> grava a nova senha
        if (method === 'POST' && (action === 'reset-password' || action === 'reset')) {
            const body = await getBody(req);
            const token = String(body.token || '').trim();
            const password = String(body.password || '');
            if (!token) return fail(res, 'Link inválido ou expirado. Solicite um novo.', 400);
            if (password.length < 6) return fail(res, 'A senha deve ter pelo menos 6 caracteres', 400);

            const tokenHash = sha256(token);
            const result = await pool.query(
                `SELECT id, user_id FROM public.password_resets
                 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
                [tokenHash]
            );
            if (!result.rows.length) {
                return fail(res, 'Link inválido ou expirado. Solicite um novo.', 400);
            }

            const reset = result.rows[0];
            await pool.query(
                'UPDATE public.profiles SET password_hash = $1, updated_at = NOW() WHERE id = $2',
                [hashPassword(password), reset.user_id]
            );
            await pool.query('UPDATE public.password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);
            // Derruba sessões antigas: quem tinha o cookie precisa entrar com a nova senha.
            await pool.query('DELETE FROM public.sessions WHERE user_id = $1', [reset.user_id]);

            return ok(res, { success: true, message: 'Senha redefinida! Entre com a nova senha.' });
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
