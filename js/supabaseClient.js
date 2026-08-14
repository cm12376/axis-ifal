// ==========================================
// AXIS IFAL - CAMADA DE DADOS (NEON via API Vercel)
// Substitui o Supabase por chamadas à nossa API serverless.
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
        grades: []
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

// === TAREFAS ===
export async function apiFetchTasks() {
    try { return await request('/tasks'); }
    catch (e) { if (e.status === 401) throw e; console.warn('fallback', e); return getLocalData().tasks; }
}

export async function apiCreateTask(taskData) {
    try {
        return await request('/tasks', { method: 'POST', body: JSON.stringify({
            title: taskData.title, category: taskData.category,
            date: taskData.date || taskData.due_date, priority: taskData.priority,
            status: taskData.status || 'todo'
        }) });
    } catch (e) {
        const local = getLocalData();
        const newTask = { id: String(Date.now()), title: taskData.title, category: taskData.category, due_date: taskData.date || taskData.due_date, priority: taskData.priority, status: taskData.status || 'todo' };
        local.tasks.unshift(newTask);
        saveLocalData(local);
        return newTask;
    }
}

export async function apiUpdateTaskStatus(id, newStatus) {
    try {
        await request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    } catch (e) {
        const local = getLocalData();
        const t = local.tasks.find(i => String(i.id) === String(id));
        if (t) t.status = newStatus;
        saveLocalData(local);
    }
    return true;
}

export async function apiDeleteTask(id) {
    try { await request(`/tasks/${id}`, { method: 'DELETE' }); }
    catch (e) {
        const local = getLocalData();
        local.tasks = local.tasks.filter(t => String(t.id) !== String(id));
        saveLocalData(local);
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

// --- PERFIL ---
export async function apiFetchProfile() {
    return request('/profile');
}

export async function apiUpdateProfile(name) {
    return request('/profile', { method: 'PUT', body: JSON.stringify({ full_name: name }) });
}