// Criptografia simétrica para segredos do usuário (chave da API Groq).
// AES-256-GCM: confidencialidade + autenticação (detecta adulteração no banco).
// A chave-mestra vem da variável de ambiente AXIS_ENCRYPTION_KEY e NUNCA é
// guardada no banco — quem tiver só o dump do Postgres não consegue decifrar.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_SALT = 'axis-ifal-user-secrets-v1';

let cachedKey = null;

function getSecret() {
    return (process.env.AXIS_ENCRYPTION_KEY || '').trim();
}

// Só permitimos guardar segredos se houver uma chave-mestra minimamente forte.
export function encryptionAvailable() {
    return getSecret().length >= 32;
}

function getKey() {
    if (cachedKey) return cachedKey;
    const secret = getSecret();
    if (!secret) throw new Error('AXIS_ENCRYPTION_KEY não configurada');
    // 64 caracteres hex = 32 bytes exatos; qualquer outro formato vira chave via scrypt.
    cachedKey = /^[0-9a-fA-F]{64}$/.test(secret)
        ? Buffer.from(secret, 'hex')
        : scryptSync(secret, KEY_SALT, 32);
    return cachedKey;
}

// Formato guardado: v1:<iv>:<authTag>:<ciphertext>, tudo em base64.
export function encryptSecret(plainText) {
    if (!plainText) return null;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(payload) {
    if (!payload || typeof payload !== 'string') return null;
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') return null;
    try {
        const [, ivB64, tagB64, dataB64] = parts;
        const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(dataB64, 'base64')),
            decipher.final()
        ]);
        return decrypted.toString('utf8');
    } catch (err) {
        // Chave-mestra trocada ou registro adulterado: trata como "sem chave".
        console.error('Falha ao decifrar segredo do usuário:', err.message);
        return null;
    }
}

// Dica exibida no formulário. Nunca revela a chave inteira.
export function maskSecret(plainText) {
    const value = String(plainText || '').trim();
    if (value.length < 8) return '••••';
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
