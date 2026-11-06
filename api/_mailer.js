// Envio de e-mail transacional via Brevo (API HTTP, sem dependências externas).
// Configure no Vercel:
//   BREVO_API_KEY       -> chave da API (Brevo > SMTP & API > API Keys)
//   BREVO_SENDER_EMAIL  -> remetente verificado no Brevo (Senders & IP)
//   BREVO_SENDER_NAME   -> nome exibido (opcional)
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export function mailConfigured() {
    return Boolean(
        (process.env.BREVO_API_KEY || '').trim() &&
        (process.env.BREVO_SENDER_EMAIL || '').trim()
    );
}

export async function sendMail({ to, toName, subject, html, text }) {
    const apiKey = (process.env.BREVO_API_KEY || '').trim();
    const senderEmail = (process.env.BREVO_SENDER_EMAIL || '').trim();
    if (!apiKey || !senderEmail) {
        throw new Error('Serviço de e-mail não configurado (BREVO_API_KEY/BREVO_SENDER_EMAIL)');
    }

    const senderName = (process.env.BREVO_SENDER_NAME || 'AXIS IFAL').trim();
    const res = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            accept: 'application/json'
        },
        body: JSON.stringify({
            sender: { email: senderEmail, name: senderName },
            to: [{ email: to, name: toName || to }],
            subject,
            htmlContent: html,
            textContent: text
        })
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Brevo ${res.status}: ${detail.slice(0, 300)}`);
    }
    return true;
}
