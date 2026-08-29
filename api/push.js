// API Push Notifications - VAPID + Web Push
import { ok, fail, getBody } from './_helpers.js';
import { requireAuth } from './_auth.js';
import { pool } from './_db.js';
import webpush from 'web-push';

function getVapidKeys() {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subj = process.env.VAPID_SUBJECT?.trim() || 'mailto:contato@axis-ifal.local';
  if (!pub || !priv) return null;
  return { pub, priv, subj };
}

function initWebPush() {
  const k = getVapidKeys();
  if (!k) return false;
  webpush.setVapidDetails(k.subj, k.pub, k.priv);
  return true;
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action') || '';

  // GET /api/push?action=vapid -> retorna chave pública (sem auth para o SW pegar antes do login)
  if (req.method === 'GET' && action === 'vapid') {
    const k = getVapidKeys();
    if (!k) return fail(res, 'VAPID não configurado', 500);
    return ok(res, { publicKey: k.pub });
  }

  // Todas as outras rotas exigem auth
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'POST' && action === 'subscribe') {
    const body = await getBody(req);
    const { endpoint, keys } = body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return fail(res, 'Subscription inválida', 400);
    await pool.query(
      `INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh=$3, auth=$4`,
      [user.id, endpoint, keys.p256dh, keys.auth]
    );
    return ok(res, { ok: true });
  }

  if (req.method === 'POST' && action === 'unsubscribe') {
    const body = await getBody(req);
    const { endpoint } = body;
    if (!endpoint) return fail(res, 'endpoint obrigatório', 400);
    await pool.query(`DELETE FROM public.push_subscriptions WHERE user_id=$1 AND endpoint=$2`, [user.id, endpoint]);
    return ok(res, { ok: true });
  }

  // POST /api/push?action=send -> envia push para o próprio usuário (usado no Pomodoro e testes)
  if (req.method === 'POST' && action === 'send') {
    const body = await getBody(req);
    const { title, body: msg, url: clickUrl } = body;
    if (!initWebPush()) return fail(res, 'VAPID não configurado', 500);
    const { rows } = await pool.query(`SELECT endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id=$1`, [user.id]);
    if (!rows.length) return fail(res, 'Nenhuma inscrição encontrada', 404);
    const payload = JSON.stringify({ title: title || 'AXIS IFAL', body: msg || '', url: clickUrl || '/', icon: '/icons/icon-192.png' });
    let sent = 0;
    for (const r of rows) {
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload);
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await pool.query(`DELETE FROM public.push_subscriptions WHERE endpoint=$1`, [r.endpoint]);
        }
      }
    }
    return ok(res, { sent, total: rows.length });
  }

  // GET /api/push?action=cron -> cron server-side para alertas de provas no dia seguinte
  // Chamado via Vercel Cron (header x-vercel-cron) ou com ?secret=CRON_SECRET
  if (req.method === 'GET' && action === 'cron') {
    const secret = url.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET?.trim();
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const isCron = isVercelCron || (cronSecret && secret === cronSecret);
    if (!isCron) {
      return fail(res, 'Acesso negado ao cron', 403);
    }
    if (!initWebPush()) return fail(res, 'VAPID não configurado', 500);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = tomorrow.toISOString().slice(0, 10);
    const { rows: events } = await pool.query(
      `SELECT user_id, title, event_type FROM public.events WHERE event_date=$1`, [iso]
    );
    if (!events.length) return ok(res, { sent: 0, msg: 'Nenhuma prova amanhã' });
    // Agrupa por usuário
    const byUser = new Map();
    for (const ev of events) {
      if (!byUser.has(ev.user_id)) byUser.set(ev.user_id, []);
      byUser.get(ev.user_id).push(ev);
    }
    let totalSent = 0;
    for (const [userId, evs] of byUser) {
      const { rows: subs } = await pool.query(`SELECT endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id=$1`, [userId]);
      if (!subs.length) continue;
      const titles = evs.map(e => e.title).join(', ');
      const payload = JSON.stringify({
        title: `📚 Prova amanhã: ${evs[0].title}`,
        body: evs.length > 1 ? `${evs.length} compromissos amanhã: ${titles}` : `Não esqueça: ${evs[0].title} é amanhã!`,
        url: '/',
        icon: '/icons/icon-192.png'
      });
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          totalSent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) await pool.query(`DELETE FROM public.push_subscriptions WHERE endpoint=$1`, [s.endpoint]);
        }
      }
    }
    return ok(res, { sent: totalSent, users: byUser.size, date: iso });
  }

  return fail(res, 'Rota não encontrada', 404);
}
