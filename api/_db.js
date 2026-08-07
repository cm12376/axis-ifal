// Banco de dados central - conexão Neon (pool compartilhado)
import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL não configurada');
}

export const pool = new Pool({ connectionString });
export { neon } from '@neondatabase/serverless';