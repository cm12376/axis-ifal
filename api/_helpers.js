// Helper para respostas JSON
export function ok(res, data, status = 200) {
    res.status(status).json(data);
}

export function fail(res, message, status = 500) {
    console.error('API error:', message);
    res.status(status).json({ error: message });
}

export async function getBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length === 0) return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        return {};
    }
}