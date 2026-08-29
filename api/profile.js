// API de Perfil do Usuário Autenticado
import { pool } from './_db.js';
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth, sanitizeUser } from './_auth.js';
import { encryptSecret, maskSecret, encryptionAvailable } from './_crypto.js';

const VALID_MODELS = [
    'auto', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b',
    'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound', 'gemma2-9b-it', 'qwen/qwen3.6-27b'
];

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

                // Chave da API Groq do estudante:
                //   undefined/null -> mantém a chave atual
                //   ''             -> remove a chave salva
                //   'gsk_...'      -> cifra e substitui
                let keyEnc;          // undefined = não mexer
                let keyHint;
                if (typeof body.groq_api_key === 'string') {
                    const rawKey = body.groq_api_key.trim();
                    if (!rawKey) {
                        keyEnc = null;
                        keyHint = null;
                    } else {
                        if (!encryptionAvailable()) {
                            return fail(res, 'O servidor não está preparado para guardar chaves com segurança (AXIS_ENCRYPTION_KEY ausente). Contate o administrador.', 503);
                        }
                        if (rawKey.length < 20) {
                            return fail(res, 'Chave de API inválida.', 400);
                        }
                        keyEnc = encryptSecret(rawKey);
                        keyHint = maskSecret(rawKey);
                    }
                }

                const model = typeof body.groq_model === 'string' && VALID_MODELS.includes(body.groq_model)
                    ? body.groq_model
                    : null;

                const result = await pool.query(
                    `UPDATE public.profiles
                     SET full_name = $1,
                         course = COALESCE($2, course),
                         campus = COALESCE($3, campus),
                         groq_api_key_enc = CASE WHEN $4::boolean THEN $5 ELSE groq_api_key_enc END,
                         groq_key_hint    = CASE WHEN $4::boolean THEN $6 ELSE groq_key_hint END,
                         groq_model = COALESCE($7, groq_model),
                         updated_at = NOW()
                     WHERE id = $8 RETURNING *`,
                    [
                        body.full_name || body.name || user.full_name,
                        body.course,
                        body.campus,
                        keyEnc !== undefined,
                        keyEnc ?? null,
                        keyHint ?? null,
                        model,
                        user.id
                    ]
                );
                return ok(res, sanitizeUser(result.rows[0]));
            }
            default:
                return fail(res, 'Método não suportado', 405);
        }
    } catch (err) {
        console.error('profile error:', err);
        return fail(res, 'Erro ao processar perfil', 500);
    }
}
