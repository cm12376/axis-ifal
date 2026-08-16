// Aplica o schema.sql ao banco Neon via pooler
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!DATABASE_URL) {
    console.error('Defina DATABASE_URL ou NEON_DATABASE_URL');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

try {
    const client = await pool.connect();
    await client.query(schema);
    console.log('✅ Schema aplicado com sucesso!');
    await client.release();
    await pool.end();
} catch (e) {
    console.error('Erro ao aplicar schema:', e.message);
    try { await pool.end(); } catch {}
    process.exit(1);
}