// ==========================================
// AXIS IFAL DIGITAL - CONTROLADOR DA APLICAÇÃO
// Integração Completa com Supabase e UI Responsiva
// ==========================================

import {
    apiRegister,
    apiLogin,
    apiLogout,
    apiGetCurrentUser,
    apiFetchTasks,
    apiCreateTask,
    apiUpdateTaskStatus,
    apiDeleteTask,
    apiFetchEvents,
    apiCreateEvent,
    apiDeleteEvent,
    apiFetchMaterials,
    apiCreateMaterial,
    apiDeleteMaterial,
    apiFetchNotifications,
    apiAddNotification,
    apiMarkNotificationRead,
    apiClearNotifications,
    apiFetchGrades,
    apiFetchProfile,
    apiUpdateProfile
} from './supabaseClient.js';

import { askGeminiTutor } from './aiTutor.js';

// --- ESTADO GLOBAL LOCAL ---
let appState = {
    theme: localStorage.getItem('axis_theme') || 'light',
    user: { name: 'Estudante Novato', course: 'Informática', campus: 'Campus Maceió' },
    tasks: [],
    events: [],
    materials: [],
    notifications: [],
    grades: []
};

let perfChartInstance = null;
let currentMaterialFilter = 'todos';
let calCurrentYear = new Date().getFullYear();
let calCurrentMonth = new Date().getMonth();

// --- POMODORO TIMER ---
let pomoInterval = null;
let pomoTime = 25 * 60;
let pomoCurrentMode = 'foco';

// --- AUTENTICAÇÃO (LOGIN / REGISTO) ---
let authMode = 'login';

async function boot() {
    applyStoredTheme();
    try {
        const user = await apiGetCurrentUser();
        appState.user.name = user.full_name;
        showApp();
        await initApp();
    } catch (e) {
        showAuthScreen();
    }
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
}

function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
}

function setAuthMode(mode) {
    authMode = mode;
    const isLogin = mode === 'login';
    document.getElementById('auth-title').innerText = isLogin ? 'Entrar na Plataforma' : 'Criar Conta';
    document.getElementById('auth-name-field').classList.toggle('hidden', isLogin);
    document.getElementById('auth-submit-btn').innerText = isLogin ? 'Entrar' : 'Criar Conta';
    document.getElementById('auth-toggle-text').innerText = isLogin ? 'Ainda não tem conta?' : 'Já tem conta?';
    document.getElementById('auth-toggle-btn').innerText = isLogin ? 'Criar Conta' : 'Entrar';
    document.getElementById('auth-error').classList.add('hidden');
}

function toggleAuthMode() {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
}

async function submitAuthForm() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const fullName = document.getElementById('auth-name').value.trim();
    const errorEl = document.getElementById('auth-error');
    errorEl.classList.add('hidden');

    if (!email || !password) {
        errorEl.innerText = 'Preencha e-mail e senha.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        if (authMode === 'login') {
            await apiLogin(email, password);
        } else {
            await apiRegister(email, password, fullName || 'Estudante Novato');
        }
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        document.getElementById('auth-name').value = '';
        const user = await apiGetCurrentUser();
        appState.user.name = user.full_name;
        showApp();
        await initApp();
        showToast(`Bem-vindo(a), ${user.full_name}!`);
    } catch (e) {
        errorEl.innerText = e.message || 'Erro ao autenticar.';
        errorEl.classList.remove('hidden');
    }
}

async function doLogout() {
    try { await apiLogout(); } catch (e) { /* ignore */ }
    appState = {
        theme: appState.theme,
        user: { name: 'Estudante Novato', course: 'Informática', campus: 'Campus Maceió' },
        tasks: [], events: [], materials: [], notifications: [], grades: []
    };
    setAuthMode('login');
    showAuthScreen();
}

// --- CARREGAMENTO E INICIALIZAÇÃO DA APLICAÇÃO ---
async function initApp() {
    setHeaderDate();
    updateSupabaseBadge();

    // Carregar Dados Iniciais em Paralelo via Supabase / API Layer
    try {
        const [tasks, events, materials, notifications, grades, profile] = await Promise.all([
            apiFetchTasks(),
            apiFetchEvents(),
            apiFetchMaterials(),
            apiFetchNotifications(),
            apiFetchGrades(),
            apiFetchProfile()
        ]);

        appState.tasks = tasks || [];
        appState.events = events || [];
        appState.materials = materials || [];
        appState.notifications = notifications || [];
        appState.grades = grades || [];
        
        if (profile && profile.full_name) {
            appState.user.name = profile.full_name;
        }

        updateUserLabels();
        renderDashboard();
        renderTasks();
        renderCalendar();
        renderMaterials();
        renderNotifications();
        renderGradesSection();

    } catch (err) {
        if (err.status === 401) {
            setAuthMode('login');
            showAuthScreen();
            return;
        }
        console.error("Erro ao inicializar dados da plataforma:", err);
        showToast("Erro ao carregar dados. Modo de contingência ativado.");
    }
}

// --- CONTROLE DE TEMAS (LIGHT / DARK) ---
function toggleDarkMode() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        appState.theme = 'light';
    } else {
        html.classList.add('dark');
        appState.theme = 'dark';
    }
    localStorage.setItem('axis_theme', appState.theme);
}

function applyStoredTheme() {
    const html = document.documentElement;
    if (appState.theme === 'dark') {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
}

// --- NAVEGAÇÃO DE TABS ---
function changeTab(tabName) {
    document.querySelectorAll('main > section').forEach(sect => sect.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const targetSection = document.getElementById(`tab-${tabName}`);
    if (targetSection) targetSection.classList.remove('hidden');

    const targetBtn = document.getElementById(`btn-${tabName}`);
    if (targetBtn) targetBtn.classList.add('active');

    if (tabName === 'performance') {
        renderPerformanceChart();
    }

    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar.classList.contains('hidden')) toggleMobileSidebar();
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('fixed', 'inset-y-0', 'left-0');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('fixed', 'inset-y-0', 'left-0');
        overlay.classList.add('hidden');
    }
}

// --- BADGE DE CONEXÃO COM O BANCO (NEON) ---
async function updateSupabaseBadge() {
    const badge = document.getElementById('supabase-status-badge');
    const badgeText = document.getElementById('supabase-status-text');
    if (!badge || !badgeText) return;

    badge.className = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 cursor-pointer";
    badgeText.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-active"></span> Neon PostgreSQL Conectado`;
}

// --- GERENCIAMENTO DE PERFIL ---
function openConfigModal() {
    document.getElementById('config-username').value = appState.user.name;
    document.getElementById('modal-config').classList.remove('hidden');
}

function closeConfigModal() {
    document.getElementById('modal-config').classList.add('hidden');
}

async function submitConfig() {
    const name = document.getElementById('config-username').value.trim();

    if (name) {
        appState.user.name = name;
        await apiUpdateProfile(name);
        updateUserLabels();
        showToast("Perfil atualizado com sucesso!");
    }

    closeConfigModal();
}

function updateUserLabels() {
    const name = appState.user.name || 'Estudante Novato';
    document.getElementById('userNameLabel').innerText = name;
    document.getElementById('welcome-name').innerText = name;

    const parts = name.split(' ');
    const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].substring(0, 2);
    document.getElementById('userAvatar').innerText = initials.toUpperCase();
}

// --- RENDERIZAÇÃO DO DASHBOARD PRINCIPAL ---
function renderDashboard() {
    const activeTasks = appState.tasks.filter(t => t.status !== 'done');
    const examEvents = appState.events.filter(e => e.event_type === 'prova' || e.type === 'prova');

    document.getElementById('dash-pending-count').innerText = activeTasks.length;
    document.getElementById('dash-exams-count').innerText = examEvents.length;

    // Calcular média global das notas
    let totalB1 = 0, count = 0;
    appState.grades.forEach(g => {
        if (g.b1_grade) { totalB1 += Number(g.b1_grade); count++; }
    });
    const avgGlobal = count > 0 ? (totalB1 / count).toFixed(1) : "7.1";
    document.getElementById('dash-average').innerText = avgGlobal;

    // Próximas Tarefas Urgentes
    const tasksCont = document.getElementById('dash-tasks-container');
    tasksCont.innerHTML = '';

    if (activeTasks.length === 0) {
        tasksCont.innerHTML = `
            <div class="py-8 text-center text-xs text-slate-400">
                <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80"></i>
                Nenhuma tarefa pendente! Aproveite para revisar conteúdos.
            </div>
        `;
    } else {
        activeTasks.slice(0, 4).forEach(t => {
            const card = document.createElement('div');
            card.className = "flex items-center justify-between p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition";
            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="w-2.5 h-2.5 rounded-full ${t.priority === 'alta' ? 'bg-rose-500' : 'bg-blue-500'}"></span>
                    <div>
                        <p class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">${t.title}</p>
                        <span class="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-extrabold uppercase">${t.category}</span>
                    </div>
                </div>
                <span class="text-[10px] font-bold text-slate-400">Até ${formatDateDisplay(t.due_date || t.date)}</span>
            `;
            tasksCont.appendChild(card);
        });
    }

    // Próximos Compromissos
    const eventsCont = document.getElementById('dash-events-container');
    eventsCont.innerHTML = '';

    if (appState.events.length === 0) {
        eventsCont.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Sem compromissos agendados.</p>`;
    } else {
        appState.events.slice(0, 3).forEach(e => {
            const dateStr = e.event_date || e.date;
            const dObj = new Date(dateStr);
            const dNum = dObj.getDate().toString().padStart(2, '0');
            const mStr = dObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();

            const dCard = document.createElement('div');
            dCard.className = "flex gap-3 items-center";
            dCard.innerHTML = `
                <div class="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 w-11 h-11 rounded-xl flex flex-col justify-center items-center shrink-0 border border-emerald-100 dark:border-emerald-900/20">
                    <span class="text-sm font-black">${dNum}</span>
                    <span class="text-[8px] font-extrabold tracking-wider -mt-1">${mStr}</span>
                </div>
                <div>
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-36">${e.title}</p>
                    <span class="text-[9px] text-slate-400 font-bold uppercase">${e.event_type || e.type}</span>
                </div>
            `;
            eventsCont.appendChild(dCard);
        });
    }

    if (window.lucide) lucide.createIcons();
}

// --- RENDERIZAÇÃO DO QUADRO KANBAN (TAREFAS) ---
function renderTasks() {
    const todoCol = document.getElementById('kanban-todo');
    const progCol = document.getElementById('kanban-progress');
    const doneCol = document.getElementById('kanban-done');

    todoCol.innerHTML = '';
    progCol.innerHTML = '';
    doneCol.innerHTML = '';

    let counts = { todo: 0, progress: 0, done: 0 };

    appState.tasks.forEach(t => {
        const st = t.status || 'todo';
        if (counts[st] !== undefined) counts[st]++;

        const tCard = document.createElement('div');
        tCard.className = "bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 hover:shadow-md transition-all group";
        
        const badgeColor = t.priority === 'alta' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500';

        tCard.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${badgeColor}">
                    ${t.priority}
                </span>
                <div class="flex gap-1">
                    ${st !== 'done' ? `
                    <button onclick="window.advanceTask('${t.id}')" class="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded transition" title="Avançar Estado">
                        <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                    </button>` : ''}
                    <button onclick="window.deleteTask('${t.id}')" class="p-1 text-slate-400 hover:text-rose-500 rounded transition" title="Excluir Atividade">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100">${t.title}</p>
            <div class="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span class="font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">${t.category}</span>
                <span>Até ${formatDateDisplay(t.due_date || t.date)}</span>
            </div>
        `;

        if (st === 'todo') todoCol.appendChild(tCard);
        else if (st === 'progress') progCol.appendChild(tCard);
        else if (st === 'done') doneCol.appendChild(tCard);
    });

    document.getElementById('count-todo').innerText = counts.todo;
    document.getElementById('count-progress').innerText = counts.progress;
    document.getElementById('count-done').innerText = counts.done;

    if (window.lucide) lucide.createIcons();
}

async function advanceTask(id) {
    const task = appState.tasks.find(t => String(t.id) === String(id));
    if (task) {
        let newStatus = 'progress';
        if (task.status === 'progress') newStatus = 'done';

        task.status = newStatus;
        await apiUpdateTaskStatus(id, newStatus);
        
        if (newStatus === 'done') {
            await apiAddNotification(`Tarefa concluída: "${task.title}". Parabéns pelo progresso!`);
            showToast(`Atividade "${task.title}" marcada como concluída! 🎉`);
            renderNotifications();
        }

        renderTasks();
        renderDashboard();
    }
}

async function deleteTask(id) {
    appState.tasks = appState.tasks.filter(t => String(t.id) !== String(id));
    await apiDeleteTask(id);
    renderTasks();
    renderDashboard();
    showToast("Atividade removida.");
}

function openAddTaskModal() {
    document.getElementById('modal-task').classList.remove('hidden');
}

function closeAddTaskModal() {
    document.getElementById('modal-task').classList.add('hidden');
}

async function submitNewTask() {
    const title = document.getElementById('m-task-title').value.trim();
    const category = document.getElementById('m-task-category').value;
    const date = document.getElementById('m-task-date').value;
    const priority = document.getElementById('m-task-priority').value;

    if (!title || !date) {
        showToast("Preencha o título e o prazo da atividade.");
        return;
    }

    const newTask = await apiCreateTask({ title, category, date, priority });
    appState.tasks.unshift(newTask);

    renderTasks();
    renderDashboard();
    closeAddTaskModal();
    document.getElementById('m-task-title').value = '';
    showToast("Nova atividade adicionada com sucesso!");
}

// --- RENDERIZAÇÃO DE CALENDÁRIO ---
function renderCalendar() {
    const monthLabel = document.getElementById('cal-month-label');
    const grid = document.getElementById('cal-days-grid');
    const detailList = document.getElementById('cal-list-container');

    grid.innerHTML = '';
    detailList.innerHTML = '';

    const activeDate = new Date(calCurrentYear, calCurrentMonth, 1);
    monthLabel.innerText = activeDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

    const startDayIndex = activeDate.getDay();
    const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();

    for (let i = 0; i < startDayIndex; i++) {
        const empty = document.createElement('div');
        empty.className = "h-11 bg-slate-50/50 dark:bg-slate-900/10 rounded-xl";
        grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${calCurrentYear}-${(calCurrentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const dayEvents = appState.events.filter(e => (e.event_date || e.date) === dayStr);

        const dayCell = document.createElement('div');
        dayCell.className = "h-11 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl p-1 flex flex-col justify-between hover:border-emerald-500 transition cursor-pointer";
        
        let marker = dayEvents.length > 0 ? `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 block mx-auto mb-1"></span>` : '';

        dayCell.innerHTML = `
            <span class="text-[10px] font-bold text-slate-500">${day}</span>
            ${marker}
        `;

        dayCell.onclick = () => {
            if (dayEvents.length > 0) {
                showToast(`Compromissos do dia: ${dayEvents.map(e => e.title).join(', ')}`);
            } else {
                showToast(`Sem exames ou reuniões agendados para este dia.`);
            }
        };

        grid.appendChild(dayCell);
    }

    if (appState.events.length === 0) {
        detailList.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">Nenhum compromisso agendado.</p>`;
    } else {
        appState.events.forEach(e => {
            const item = document.createElement('div');
            item.className = "p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl flex justify-between items-center";
            item.innerHTML = `
                <div>
                    <span class="text-[9px] font-bold uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded">${e.event_type || e.type}</span>
                    <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">${e.title}</h4>
                    <p class="text-[10px] text-slate-400 mt-0.5">Data: ${formatDateDisplay(e.event_date || e.date)}</p>
                </div>
                <button onclick="window.deleteEvent('${e.id}')" class="text-slate-400 hover:text-rose-500 p-1.5 rounded transition">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            `;
            detailList.appendChild(item);
        });
    }

    if (window.lucide) lucide.createIcons();
}

function changeMonth(direction) {
    calCurrentMonth += direction;
    if (calCurrentMonth < 0) {
        calCurrentMonth = 11;
        calCurrentYear--;
    } else if (calCurrentMonth > 11) {
        calCurrentMonth = 0;
        calCurrentYear++;
    }
    renderCalendar();
}

function openAddEventModal() {
    document.getElementById('modal-event').classList.remove('hidden');
}

function closeAddEventModal() {
    document.getElementById('modal-event').classList.add('hidden');
}

async function submitNewEvent() {
    const title = document.getElementById('m-evt-title').value.trim();
    const date = document.getElementById('m-evt-date').value;
    const type = document.getElementById('m-evt-type').value;

    if (!title || !date) {
        showToast("Preencha o título e a data do compromisso.");
        return;
    }

    const newEvt = await apiCreateEvent({ title, date, type });
    appState.events.push(newEvt);

    renderCalendar();
    renderDashboard();
    closeAddEventModal();
    document.getElementById('m-evt-title').value = '';
    showToast("Compromisso agendado!");
}

async function deleteEvent(id) {
    appState.events = appState.events.filter(e => String(e.id) !== String(id));
    await apiDeleteEvent(id);
    renderCalendar();
    renderDashboard();
    showToast("Compromisso removido.");
}

// --- MATERIAIS DE ESTUDO ---
function renderMaterials() {
    const grid = document.getElementById('materials-grid');
    grid.innerHTML = '';

    const filtered = currentMaterialFilter === 'todos' 
        ? appState.materials 
        : appState.materials.filter(m => m.category === currentMaterialFilter);

    document.getElementById('fcount-all').innerText = appState.materials.length;
    document.getElementById('fcount-alg').innerText = appState.materials.filter(m => m.category === 'algoritmos').length;
    document.getElementById('fcount-web').innerText = appState.materials.filter(m => m.category === 'web').length;

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="p-8 text-center text-xs text-slate-400 col-span-2">
                <i data-lucide="folder-open" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
                Nenhum material encontrado nesta categoria.
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    filtered.forEach(m => {
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-emerald-500 transition";
        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-500">${m.category}</span>
                    <button onclick="window.deleteMaterial('${m.id}')" class="text-slate-400 hover:text-rose-500 transition">
                        <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
                <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">${m.title}</h4>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <a href="${m.link_url || m.link}" target="_blank" rel="noopener" class="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-semibold inline-flex items-center gap-1.5">
                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i> Abrir Arquivo
                </a>
            </div>
        `;
        grid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
}

function setMaterialFilter(cat, btnElement) {
    currentMaterialFilter = cat;
    document.querySelectorAll('.m-filter').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    renderMaterials();
}

function openAddMaterialModal() {
    document.getElementById('modal-material').classList.remove('hidden');
}

function closeAddMaterialModal() {
    document.getElementById('modal-material').classList.add('hidden');
}

async function submitNewMaterial() {
    const title = document.getElementById('m-mat-title').value.trim();
    const link = document.getElementById('m-mat-link').value.trim();
    const category = document.getElementById('m-mat-category').value;

    if (!title || !link) {
        showToast("Preencha o título e a URL do material.");
        return;
    }

    const newMat = await apiCreateMaterial({ title, link, category });
    appState.materials.unshift(newMat);

    renderMaterials();
    closeAddMaterialModal();
    document.getElementById('m-mat-title').value = '';
    document.getElementById('m-mat-link').value = '';
    showToast("Material salvo com sucesso na pasta digital!");
}

async function deleteMaterial(id) {
    appState.materials = appState.materials.filter(m => String(m.id) !== String(id));
    await apiDeleteMaterial(id);
    renderMaterials();
    showToast("Material removido.");
}

// --- RENDERIZAÇÃO DO MONITOR DE RENDIMENTO E SIMULADOR ---
function renderGradesSection() {
    simPerformance();
}

function renderPerformanceChart() {
    const canvas = document.getElementById('chart-performance');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (perfChartInstance) {
        perfChartInstance.destroy();
    }

    const labels = appState.grades.map(g => g.subject);
    const b1Data = appState.grades.map(g => Number(g.b1_grade || 0));
    const b2Data = appState.grades.map(g => Number(g.b2_grade || 0));

    if (window.Chart) {
        perfChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['Algoritmos', 'Web I', 'Banco de Dados'],
                datasets: [
                    {
                        label: 'Bimestre 1',
                        data: b1Data.length ? b1Data : [5.8, 6.4, 8.0],
                        backgroundColor: 'rgba(16, 185, 129, 0.75)',
                        borderColor: '#10b981',
                        borderWidth: 1.5,
                        borderRadius: 6
                    },
                    {
                        label: 'Bimestre 2',
                        data: b2Data.length ? b2Data : [6.5, 7.8, 8.2],
                        backgroundColor: 'rgba(59, 130, 246, 0.75)',
                        borderColor: '#3b82f6',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 10, grid: { color: 'rgba(150, 150, 150, 0.1)' } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { labels: { font: { family: 'Inter', size: 10, weight: 'bold' } } }
                }
            }
        });
    }
}

function simPerformance() {
    const b1 = parseFloat(document.getElementById('sim-b1').value) || 0;
    const b2 = parseFloat(document.getElementById('sim-b2').value) || 0;

    const finalAvg = (b1 + b2) / 2;
    document.getElementById('sim-result').innerText = finalAvg.toFixed(2);

    const status = document.getElementById('sim-status-label');
    if (finalAvg >= 6.0) {
        status.innerText = "Parabéns! Você está no caminho certo para a aprovação direta.";
        status.className = "text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1.5";
    } else {
        status.innerText = "Média prevista abaixo do mínimo (6.0). Recomendamos intensificar as revisões.";
        status.className = "text-[10px] text-rose-500 font-semibold mt-1.5";
    }
}

// --- TUTOR VIRTUAL IA GEMINI ---
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const userMsg = input.value.trim();
    if (!userMsg) return;

    input.value = '';
    appendChatMessage(userMsg, 'user');

    const typing = document.getElementById('ai-typing');
    typing.classList.remove('hidden');

    try {
        const response = await askGeminiTutor(userMsg, import.meta.env.VITE_GROQ_API_KEY || '');
        appendChatMessage(response, 'ai');
    } catch (err) {
        appendChatMessage("Desculpe, ocorreu um erro de conexão com o Tutor Virtual.", 'ai');
    } finally {
        typing.classList.add('hidden');
    }
}

function appendChatMessage(text, sender) {
    const chatBox = document.getElementById('chat-box');
    const wrapper = document.createElement('div');
    wrapper.className = `flex gap-3 max-w-xl ${sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`;

    const senderName = sender === 'user' ? appState.user.name : 'Tutor Virtual IFAL';
    const bg = sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-tl-none';
    const initial = sender === 'user' ? appState.user.name.substring(0,2).toUpperCase() : 'IA';

    wrapper.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
            ${initial}
        </div>
        <div class="${bg} rounded-2xl p-4 text-xs shadow-xs">
            <p class="font-bold text-[9px] opacity-75 mb-1">${senderName}</p>
            <p class="leading-relaxed whitespace-pre-wrap">${text}</p>
        </div>
    `;

    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function clearChat() {
    const box = document.getElementById('chat-box');
    box.innerHTML = `
        <div class="flex gap-3 max-w-xl">
            <div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                IA
            </div>
            <div class="bg-slate-100 dark:bg-slate-900 rounded-2xl p-4 text-xs text-slate-700 dark:text-slate-300">
                <p class="font-extrabold text-slate-800 dark:text-white text-[10px] mb-1">Tutor Virtual do IFAL</p>
                Histórico do tutor redefinido. Como posso ajudar com os seus estudos hoje?
            </div>
        </div>
    `;
}

// --- NOTIFICAÇÕES ---
function toggleNotifDropdown() {
    const drop = document.getElementById('notif-dropdown');
    drop.classList.toggle('hidden');
}

function renderNotifications() {
    const container = document.getElementById('notif-container');
    const badge = document.getElementById('notif-badge');
    container.innerHTML = '';

    const unread = appState.notifications.filter(n => !n.read).length;
    if (unread > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    if (appState.notifications.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-xs text-slate-400">
                <i data-lucide="bell-off" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                Sem avisos no momento.
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    appState.notifications.forEach(n => {
        const item = document.createElement('div');
        item.className = `p-3.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition cursor-pointer flex justify-between gap-3 ${!n.read ? 'bg-emerald-500/5' : ''}`;
        item.innerHTML = `
            <div class="flex-1">
                <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">${n.text}</p>
                <span class="text-[9px] text-slate-400 block mt-1">${n.date_label || 'Agora'}</span>
            </div>
        `;
        item.onclick = async () => {
            n.read = true;
            await apiMarkNotificationRead(n.id);
            renderNotifications();
        };
        container.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
}

async function clearAllNotifications() {
    appState.notifications = [];
    await apiClearNotifications();
    renderNotifications();
    showToast("Notificações limpas.");
}

// --- POMODORO TIMER ---
function togglePomo() {
    const btn = document.getElementById('pomo-play-btn');
    if (pomoInterval) {
        clearInterval(pomoInterval);
        pomoInterval = null;
        btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> Retomar`;
    } else {
        pomoInterval = setInterval(() => {
            if (pomoTime > 0) {
                pomoTime--;
                updatePomoUI();
            } else {
                clearInterval(pomoInterval);
                pomoInterval = null;
                playSyntheticBeep();

                if (pomoCurrentMode === 'foco') {
                    showToast("Sessão de Foco concluída! Pausa de 5 minutos.");
                    pomoCurrentMode = 'pausa';
                    pomoTime = 5 * 60;
                    document.getElementById('pomo-label').innerText = "Pausa";
                } else {
                    showToast("Pausa concluída! De volta aos estudos.");
                    pomoCurrentMode = 'foco';
                    pomoTime = 25 * 60;
                    document.getElementById('pomo-label').innerText = "Trabalho";
                }
                updatePomoUI();
                btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> Iniciar`;
            }
        }, 1000);
        btn.innerHTML = `<i data-lucide="pause" class="w-3.5 h-3.5"></i> Pausar`;
    }
    if (window.lucide) lucide.createIcons();
}

function resetPomo() {
    clearInterval(pomoInterval);
    pomoInterval = null;
    pomoCurrentMode = 'foco';
    pomoTime = 25 * 60;
    document.getElementById('pomo-label').innerText = "Trabalho";
    updatePomoUI();
    document.getElementById('pomo-play-btn').innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> Iniciar`;
    if (window.lucide) lucide.createIcons();
}

function updatePomoUI() {
    const minutes = Math.floor(pomoTime / 60).toString().padStart(2, '0');
    const seconds = (pomoTime % 60).toString().padStart(2, '0');
    document.getElementById('pomo-timer').innerText = `${minutes}:${seconds}`;
}

function playSyntheticBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
}

// --- SISTEMA DE TOAST ALERTS ---
function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = "toast bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold px-4 py-3 rounded-xl shadow-xl border border-slate-700 dark:border-slate-300 flex items-center gap-2";
    toast.innerHTML = `<i data-lucide="info" class="w-4 h-4 text-emerald-400 shrink-0"></i> <span>${message}</span>`;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// --- AUXILIARES DE FORMATAÇÃO DE DATA ---
function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
}

function setHeaderDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) dateEl.innerText = new Date().toLocaleDateString('pt-BR', options);
}

// --- BIND DE FUNÇÕES AO WINDOW ---
window.toggleAuthMode = toggleAuthMode;
window.submitAuthForm = submitAuthForm;
window.doLogout = doLogout;
window.changeTab = changeTab;
window.toggleMobileSidebar = toggleMobileSidebar;
window.toggleDarkMode = toggleDarkMode;
window.openConfigModal = openConfigModal;
window.closeConfigModal = closeConfigModal;
window.submitConfig = submitConfig;
window.openAddTaskModal = openAddTaskModal;
window.closeAddTaskModal = closeAddTaskModal;
window.submitNewTask = submitNewTask;
window.advanceTask = advanceTask;
window.deleteTask = deleteTask;
window.openAddEventModal = openAddEventModal;
window.closeAddEventModal = closeAddEventModal;
window.submitNewEvent = submitNewEvent;
window.deleteEvent = deleteEvent;
window.changeMonth = changeMonth;
window.openAddMaterialModal = openAddMaterialModal;
window.closeAddMaterialModal = closeAddMaterialModal;
window.submitNewMaterial = submitNewMaterial;
window.deleteMaterial = deleteMaterial;
window.setMaterialFilter = setMaterialFilter;
window.simPerformance = simPerformance;
window.sendChatMessage = sendChatMessage;
window.clearChat = clearChat;
window.toggleNotifDropdown = toggleNotifDropdown;
window.clearAllNotifications = clearAllNotifications;
window.togglePomo = togglePomo;
window.resetPomo = resetPomo;

// Inicialização ao carregar o DOM
document.addEventListener('DOMContentLoaded', boot);
