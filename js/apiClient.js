// ==========================================
// AXIS IFAL - CAMADA DE DADOS (NEON via API Vercel)
// Cliente HTTP para a API serverless própria.
// Mantém fallback LocalStorage em caso de falha.
// ==========================================

const API_BASE = '/api'; // Mesma origem em produção (Vercel) e dev
const STORAGE_KEY_STATE = 'axis_local_fallback_state';

// --- MODO FALLBACK LOCALSTORAGE ---
function getLocalData() {
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    if (raw) {
        try {
            return JSON.parse(raw);
        } catch (e) {
            /* ignore */
        }
    }
    const defaultState = {
        user: { name: 'João Silva', course: 'Técnico em Informática', campus: 'Maceió' },
        tasks: [],
        events: [],
        materials: [],
        notifications: [],
        grades: [],
        pomodoroSessions: []
    };
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(defaultState));
    return defaultState;
}

function saveLocalData(data) {
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(data));
}

// --- CLIENTE HTTP DO FRONTEND ---
async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        ...options
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || `Erro ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.status === 204 ? null : res.json();
}

// === AUTENTICAÇÃO (login/senha via Neon) ===
export async function apiRegister(email, password, full_name) {
    return request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, full_name }) });
}

export async function apiLogin(email, password) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function apiLogout() {
    return request('/auth/logout', { method: 'POST' });
}

export async function apiGetCurrentUser() {
    return request('/auth/me');
}

// === TAREFAS (offline-first: cache + fila de sync) ===
const SYNC_QUEUE_KEY = 'axis_sync_queue';

function getSyncQueue() {
    try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]'); } catch { return []; }
}
function pushSyncQueue(op) {
    const q = getSyncQueue();
    q.push({ ...op, _ts: Date.now() });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q));
}
export async function syncPendingTasks() {
    const queue = getSyncQueue();
    if (!queue.length || !navigator.onLine) return 0;
    let synced = 0;
    const remaining = [];
    for (const op of queue) {
        try {
            if (op.type === 'create') {
                const created = await request('/tasks', { method: 'POST', body: JSON.stringify(op.data) });
                // Substitui o id temporário no cache local
                const local = getLocalData();
                const idx = local.tasks.findIndex(t => String(t.id) === String(op.tempId));
                if (idx !== -1) { local.tasks[idx] = created; saveLocalData(local); }
            } else if (op.type === 'update') {
                await request(`/tasks/${op.id}`, { method: 'PATCH', body: JSON.stringify({ status: op.status }) });
            } else if (op.type === 'delete') {
                await request(`/tasks/${op.id}`, { method: 'DELETE' });
            }
            synced++;
        } catch (e) {
            if (e.status === 401) throw e;
            remaining.push(op);
        }
    }
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
    if (synced) {
        try { const fresh = await request('/tasks'); const local = getLocalData(); local.tasks = fresh; saveLocalData(local); } catch {}
    }
    return synced;
}
if (typeof window !== 'undefined') window.addEventListener('online', () => syncPendingTasks().catch(()=>{}));

export async function apiFetchTasks() {
    try {
        const tasks = await request('/tasks');
        const local = getLocalData(); local.tasks = tasks; saveLocalData(local);
        return tasks;
    } catch (e) {
        if (e.status === 401) throw e;
        // Offline: retorna cache local (sempre disponível)
        return getLocalData().tasks;
    }
}

export async function apiCreateTask(taskData) {
    const payload = {
        title: taskData.title, category: taskData.category,
        date: taskData.date || taskData.due_date, priority: taskData.priority,
        status: taskData.status || 'todo'
    };
    try {
        const created = await request('/tasks', { method: 'POST', body: JSON.stringify(payload) });
        const local = getLocalData(); local.tasks.unshift(created); saveLocalData(local);
        return created;
    } catch (e) {
        if (e.status === 401) throw e;
        const local = getLocalData();
        const tempId = `local-${Date.now()}`;
        const newTask = { id: tempId, title: payload.title, category: payload.category, due_date: payload.date, priority: payload.priority, status: payload.status, _pendingSync: true };
        local.tasks.unshift(newTask);
        saveLocalData(local);
        pushSyncQueue({ type: 'create', data: payload, tempId });
        return newTask;
    }
}

export async function apiUpdateTaskStatus(id, newStatus) {
    try {
        await request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        const local = getLocalData(); const t = local.tasks.find(i => String(i.id) === String(id)); if (t) { t.status = newStatus; delete t._pendingSync; saveLocalData(local); }
    } catch (e) {
        if (e.status === 401) throw e;
        const local = getLocalData();
        const t = local.tasks.find(i => String(i.id) === String(id));
        if (t) { t.status = newStatus; t._pendingSync = true; saveLocalData(local); }
        // Se já existe um create pendente para este id, atualiza o status lá
        const q = getSyncQueue(); const c = q.find(o => o.type === 'create' && String(o.tempId) === String(id)); if (c) c.data.status = newStatus;
        else pushSyncQueue({ type: 'update', id, status: newStatus });
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(getSyncQueue()));
    }
    return true;
}

export async function apiDeleteTask(id) {
    try { await request(`/tasks/${id}`, { method: 'DELETE' }); const local = getLocalData(); local.tasks = local.tasks.filter(t => String(t.id) !== String(id)); saveLocalData(local); }
    catch (e) {
        if (e.status === 401) throw e;
        const local = getLocalData();
        local.tasks = local.tasks.filter(t => String(t.id) !== String(id));
        saveLocalData(local);
        // Cancela create pendente se existir, senão enfileira delete
        let q = getSyncQueue(); const idx = q.findIndex(o => o.type === 'create' && String(o.tempId) === String(id));
        if (idx !== -1) { q.splice(idx, 1); localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q)); }
        else { pushSyncQueue({ type: 'delete', id }); }
    }
    return true;
}

// --- EVENTOS ---
export async function apiFetchEvents() {
    try { return await request('/events'); }
    catch (e) { if (e.status === 401) throw e; return getLocalData().events; }
}

export async function apiCreateEvent(eventData) {
    try {
        return await request('/events', { method: 'POST', body: JSON.stringify({
            title: eventData.title, date: eventData.date || eventData.event_date,
            event_type: eventData.type || eventData.event_type
        }) });
    } catch (e) {
        const local = getLocalData();
        const newEvt = { id: String(Date.now()), title: eventData.title, event_date: eventData.date, event_type: eventData.type };
        local.events.push(newEvt);
        saveLocalData(local);
        return newEvt;
    }
}

export async function apiDeleteEvent(id) {
    try { await request(`/events/${id}`, { method: 'DELETE' }); }
    catch (e) {
        const local = getLocalData();
        local.events = local.events.filter(ev => String(ev.id) !== String(id));
        saveLocalData(local);
    }
    return true;
}

// --- MATERIAIS ---
export async function apiFetchMaterials() {
    try { return await request('/materials'); }
    catch (e) { if (e.status === 401) throw e; return getLocalData().materials; }
}

export async function apiCreateMaterial(matData) {
    try {
        return await request('/materials', { method: 'POST', body: JSON.stringify({
            title: matData.title, link_url: matData.link || matData.link_url, category: matData.category
        }) });
    } catch (e) {
        const local = getLocalData();
        const newMat = { id: String(Date.now()), title: matData.title, link_url: matData.link || matData.link_url, category: matData.category };
        local.materials.unshift(newMat);
        saveLocalData(local);
        return newMat;
    }
}

export async function apiDeleteMaterial(id) {
    try { await request(`/materials/${id}`, { method: 'DELETE' }); }
    catch (e) {
        const local = getLocalData();
        local.materials = local.materials.filter(m => String(m.id) !== String(id));
        saveLocalData(local);
    }
    return true;
}

// --- NOTIFICAÇÕES ---
export async function apiFetchNotifications() {
    try { return await request('/notifications'); }
    catch (e) { if (e.status === 401) throw e; return getLocalData().notifications; }
}

export async function apiAddNotification(text) {
    try {
        return await request('/notifications', { method: 'POST', body: JSON.stringify({ text }) });
    } catch (e) {
        const local = getLocalData();
        const n = { id: String(Date.now()), text, read: false, date_label: 'Agora' };
        local.notifications.unshift(n);
        saveLocalData(local);
        return n;
    }
}

export async function apiMarkNotificationRead(id) {
    try { await request(`/notifications/${id}`, { method: 'PATCH' }); }
    catch (e) {
        const local = getLocalData();
        const n = local.notifications.find(i => String(i.id) === String(id));
        if (n) n.read = true;
        saveLocalData(local);
    }
}

export async function apiClearNotifications() {
    try { await request('/notifications', { method: 'DELETE' }); }
    catch (e) {
        const local = getLocalData();
        local.notifications = [];
        saveLocalData(local);
    }
}

// --- NOTAS ---
export async function apiFetchGrades() {
    try { return await request('/grades'); }
    catch (e) { if (e.status === 401) throw e; return getLocalData().grades; }
}

export async function apiSaveGrade(gradeData) {
    try {
        return await request('/grades', { method: 'POST', body: JSON.stringify({
            subject: gradeData.subject, b1_grade: gradeData.b1_grade, b2_grade: gradeData.b2_grade
        }) });
    } catch (e) {
        const local = getLocalData();
        const g = { id: String(Date.now()), subject: gradeData.subject, b1_grade: gradeData.b1_grade, b2_grade: gradeData.b2_grade };
        local.grades = local.grades || [];
        local.grades.push(g);
        saveLocalData(local);
        return g;
    }
}

export async function apiUpdateGrade(id, gradeData) {
    try {
        return await request(`/grades/${id}`, { method: 'PUT', body: JSON.stringify({
            subject: gradeData.subject, b1_grade: gradeData.b1_grade, b2_grade: gradeData.b2_grade
        }) });
    } catch (e) {
        const local = getLocalData();
        const g = local.grades.find(i => String(i.id) === String(id));
        if (g) {
            g.subject = gradeData.subject ?? g.subject;
            g.b1_grade = gradeData.b1_grade ?? g.b1_grade;
            g.b2_grade = gradeData.b2_grade ?? g.b2_grade;
            saveLocalData(local);
        }
        return g;
    }
}

export async function apiDeleteGrade(id) {
    try { await request(`/grades/${id}`, { method: 'DELETE' }); }
    catch (e) {
        const local = getLocalData();
        local.grades = local.grades.filter(g => String(g.id) !== String(id));
        saveLocalData(local);
    }
    return true;
}

// --- CHAT DO TUTOR IA ---
export async function apiFetchChatHistory() {
    try { return await request('/chat'); }
    catch (e) { if (e.status === 401) throw e; return []; }
}

export async function apiSaveChatMessage(sender, message) {
    try {
        return await request('/chat', { method: 'POST', body: JSON.stringify({ sender, message }) });
    } catch (e) {
        if (e.status === 401) throw e;
        return null;
    }
}

export async function apiClearChatHistory() {
    try { await request('/chat', { method: 'DELETE' }); }
    catch (e) { if (e.status === 401) throw e; }
    return true;
}

// Informa se a chave da Groq está configurada no servidor (variável GROQ_API_KEY).
export async function apiFetchTutorStatus() {
    try { return await request('/tutor'); }
    catch (e) { if (e.status === 401) throw e; return { serverKey: false }; }
}

// --- MÉTRICAS DE ESTUDO (SESSÕES DE POMODORO) ---
export async function apiFetchPomodoroSessions() {
    try { return await request('/pomodoro'); }
    catch (e) { if (e.status === 401) throw e; return getLocalData().pomodoroSessions || []; }
}

export async function apiLogPomodoroSession(category, minutes) {
    try {
        return await request('/pomodoro', { method: 'POST', body: JSON.stringify({ category, minutes }) });
    } catch (e) {
        const local = getLocalData();
        const session = { id: String(Date.now()), category, minutes, session_date: new Date().toISOString().slice(0, 10) };
        local.pomodoroSessions = local.pomodoroSessions || [];
        local.pomodoroSessions.unshift(session);
        saveLocalData(local);
        return session;
    }
}

// --- PUSH NOTIFICATIONS (PWA) ---
export async function apiGetVapidKey() {
    const data = await request('/push?action=vapid');
    return data.publicKey;
}
export async function apiSubscribePush(subscription) {
    return request('/push?action=subscribe', { method: 'POST', body: JSON.stringify(subscription) });
}
export async function apiUnsubscribePush(endpoint) {
    return request('/push?action=unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
}
export async function apiSendTestPush(title, body) {
    return request('/push?action=send', { method: 'POST', body: JSON.stringify({ title, body }) });
}

// --- PERFIL ---
export async function apiFetchProfile() {
    return request('/profile');
}

export async function apiUpdateProfile(name, extras = {}) {
    return request('/profile', { method: 'PUT', body: JSON.stringify({ full_name: name, ...extras }) });
}

// Salva a chave da Groq do estudante. A chave viaja uma única vez até o servidor,
// que a guarda cifrada (AES-256-GCM) no banco. String vazia remove a chave.
export async function apiSaveGroqKey(name, apiKey, model) {
    const payload = { full_name: name, groq_model: model };
    if (typeof apiKey === 'string') payload.groq_api_key = apiKey;
    return request('/profile', { method: 'PUT', body: JSON.stringify(payload) });
}
