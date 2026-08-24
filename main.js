/* =========================================
   CONSTANTS & CONFIG
========================================= */
const STORAGE_KEY = 'blair_data';
const PIN_CODE = '1607';

const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    pending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 0 0-5 5v10a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"></path><line x1="7" y1="12" x2="17" y2="12"></line></svg>',
    food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14a8 8 0 0 0 16 0H4z"></path><path d="M12 10V3"></path><path d="M8 10V6"></path><path d="M16 10V6"></path></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
};

/* =========================================
   STATE & STORAGE
========================================= */
let state = { events: [] };

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.events)) {
                state.events = parsed.events;
                return;
            }
        }
    } catch (e) {
        console.error("Corrupted JSON in localStorage", e);
    }
    // Fallback if empty or corrupt
    state = { events: [] };
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearAllData() {
    state.events = [];
    saveData();
}

/* =========================================
   DATE & SESSION LOGIC
========================================= */
function getCurrentDateFormatted() {
    const opts = { weekday: 'long', day: 'numeric', month: 'short' };
    let dateStr = new Date().toLocaleDateString('es-ES', opts);
    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

function padZero(num) {
    return String(num).padStart(2, '0');
}

/**
 * Devuelve el estado lógico de la sesión actual gestionando el cruce de medianoche.
 * Morning: 06:00 a 15:00
 * Night: 19:30 a 03:00 (lógicamente pertenece al día que empezó).
 */
function getCurrentSessionInfo(date = new Date()) {
    const h = date.getHours();
    const m = date.getMinutes();
    const timeFloat = h + m / 60; 
    
    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1);
    const day = padZero(date.getDate());
    
    let logicalDate = `${year}-${month}-${day}`;
    let sessionType = 'none';
    let nextSession = null;

    if (timeFloat >= 6 && timeFloat < 15) {
        sessionType = 'morning';
    } else if (timeFloat >= 19.5 || timeFloat < 3) {
        sessionType = 'night';
        // Si estamos entre 00:00 y 03:00, la fecha lógica de la sesión es la del día anterior
        if (timeFloat < 3) {
            const prev = new Date(date);
            prev.setDate(prev.getDate() - 1);
            logicalDate = `${prev.getFullYear()}-${padZero(prev.getMonth()+1)}-${padZero(prev.getDate())}`;
        }
    }

    // Calcular siguiente sesión si estamos fuera de horario
    if (sessionType === 'none') {
        if (timeFloat >= 3 && timeFloat < 6) {
            nextSession = { name: 'Mañana', time: '06:00' };
        } else if (timeFloat >= 15 && timeFloat < 19.5) {
            nextSession = { name: 'Noche', time: '19:30' };
        }
    }

    return { sessionType, logicalDate, nextSession };
}

function formatRelativeTime(timestamp) {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `Hace ${h} h ${m > 0 ? m + ' min' : ''}`;
}

function formatLocalTime(timestamp) {
    const d = new Date(timestamp);
    return `${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
}

/* =========================================
   DATA QUERIES
========================================= */
function getEvent(logicalDate, sessionType, eventType) {
    return state.events.find(e => 
        e.logicalDate === logicalDate && 
        e.session === sessionType && 
        e.type === eventType
    ) || null;
}

function registerAction(eventType) {
    const { sessionType, logicalDate } = getCurrentSessionInfo();
    if (sessionType === 'none') return false; // Fail safe
    
    // Evitar duplicados
    if (getEvent(logicalDate, sessionType, eventType)) return false;

    const event = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: eventType,
        session: sessionType,
        logicalDate: logicalDate,
        timestamp: Date.now(),
        localTime: formatLocalTime(Date.now())
    };

    state.events.push(event);
    saveData();
    return true;
}

/* =========================================
   RENDERING VIEWS
========================================= */

function updateRelativeTimes() {
    const els = document.querySelectorAll('.dynamic-time');
    els.forEach(el => {
        const ts = parseInt(el.getAttribute('data-timestamp'));
        if (ts) el.textContent = formatRelativeTime(ts);
    });
}

function renderPillView() {
    const container = document.getElementById('pill-card');
    const { sessionType, logicalDate, nextSession } = getCurrentSessionInfo();

    if (sessionType === 'none') {
        container.innerHTML = `
            <div class="status-icon warning">${ICONS.warning}</div>
            <h2 class="action-title">Fuera del horario</h2>
            <p class="text-secondary">Siguiente sesión: ${nextSession.name} · ${nextSession.time}</p>
        `;
        return;
    }

    const sessionName = sessionType === 'morning' ? 'Mañana' : 'Noche';
    const pillEvent = getEvent(logicalDate, sessionType, 'pill');

    if (pillEvent) {
        container.innerHTML = `
            <div class="status-icon success">${ICONS.check}</div>
            <h2 class="action-title">Pastilla registrada</h2>
            <p class="text-secondary">${sessionName}</p>
            <div class="mt-4">
                <p class="dynamic-time" data-timestamp="${pillEvent.timestamp}">${formatRelativeTime(pillEvent.timestamp)}</p>
                <p class="text-secondary mt-1">Dada a las ${pillEvent.localTime}</p>
            </div>
            <button class="btn-primary" disabled>Pastilla registrada</button>
        `;
    } else {
        container.innerHTML = `
            <div class="status-icon">${ICONS.pill}</div>
            <h2 class="action-title">Pastilla</h2>
            <p class="text-secondary">${sessionName} · PENDIENTE</p>
            <p class="text-secondary mt-4">Esta sesión todavía no tiene registrada la pastilla.</p>
            <button class="btn-primary" id="btn-register-pill">Dar pastilla</button>
        `;
        document.getElementById('btn-register-pill').addEventListener('click', () => {
            registerAction('pill');
            showToast('Pastilla registrada');
            renderPillView();
        });
    }
}

function renderFoodView() {
    const container = document.getElementById('food-card');
    const { sessionType, logicalDate, nextSession } = getCurrentSessionInfo();

    if (sessionType === 'none') {
        container.innerHTML = `
            <div class="status-icon warning">${ICONS.warning}</div>
            <h2 class="action-title">Fuera de horario de comida</h2>
            <p class="text-secondary">Siguiente comida: ${nextSession.name} · ${nextSession.time}</p>
        `;
        return;
    }

    const sessionName = sessionType === 'morning' ? 'Mañana' : 'Noche';
    const pillEvent = getEvent(logicalDate, sessionType, 'pill');
    const foodEvent = getEvent(logicalDate, sessionType, 'food');

    if (foodEvent) {
        container.innerHTML = `
            <div class="status-icon success">${ICONS.check}</div>
            <h2 class="action-title">Comida registrada</h2>
            <p class="text-secondary">${sessionName}</p>
            <div class="mt-4">
                <p class="dynamic-time" data-timestamp="${foodEvent.timestamp}">${formatRelativeTime(foodEvent.timestamp)}</p>
                <p class="text-secondary mt-1">Registrada a las ${foodEvent.localTime}</p>
            </div>
            <button class="btn-primary" disabled>Comida registrada</button>
        `;
    } else if (!pillEvent) {
        container.innerHTML = `
            <div class="status-icon warning">${ICONS.warning}</div>
            <h2 class="action-title">Pastilla pendiente</h2>
            <p class="text-secondary">${sessionName}</p>
            <p class="text-secondary mt-4">Registra primero la pastilla de esta sesión.</p>
            <button class="btn-primary" disabled>Registrar comida</button>
        `;
    } else {
        container.innerHTML = `
            <div class="status-icon">${ICONS.food}</div>
            <h2 class="action-title">Comida</h2>
            <p class="text-secondary">${sessionName}</p>
            <div class="status-label mt-4 justify-center">
                ${ICONS.check} <span class="text-secondary">Pastilla dada a las ${pillEvent.localTime}</span>
            </div>
            <button class="btn-primary" id="btn-register-food">Registrar comida</button>
        `;
        document.getElementById('btn-register-food').addEventListener('click', () => {
            registerAction('food');
            showToast('Comida registrada');
            renderFoodView();
        });
    }
}

function renderHomeView() {
    const { logicalDate } = getCurrentSessionInfo();
    
    const mPill = getEvent(logicalDate, 'morning', 'pill');
    const mFood = getEvent(logicalDate, 'morning', 'food');
    const nPill = getEvent(logicalDate, 'night', 'pill');
    const nFood = getEvent(logicalDate, 'night', 'food');

    const createRow = (name, event) => `
        <div class="status-row">
            <span>${name}</span>
            <div class="status-label">
                ${event ? ICONS.check + `<span class="text-secondary">${event.localTime}</span>` : ICONS.pending + `<span class="text-secondary">Pendiente</span>`}
            </div>
        </div>
    `;

    document.getElementById('home-morning-status').innerHTML = createRow('Pastilla', mPill) + createRow('Comida', mFood);
    document.getElementById('home-night-status').innerHTML = createRow('Pastilla', nPill) + createRow('Comida', nFood);
}

function renderHistoryView() {
    const list = document.getElementById('history-list');
    if (state.events.length === 0) {
        list.innerHTML = `<p class="text-secondary" style="text-align:center; padding: 24px;">No hay registros.</p>`;
        return;
    }

    // Ordenar de más reciente a más antiguo
    const sorted = [...state.events].sort((a, b) => b.timestamp - a.timestamp);
    
    // Solo mostrar los últimos 20 para mantener rendimiento
    const limited = sorted.slice(0, 20);

    list.innerHTML = limited.map(e => `
        <div class="history-item">
            <div class="history-meta">
                <span>${e.type === 'pill' ? 'Pastilla' : 'Comida'} · ${e.session === 'morning' ? 'Mañana' : 'Noche'}</span>
                <span class="text-secondary">${e.logicalDate}</span>
            </div>
            <div class="history-time">${e.localTime}</div>
        </div>
    `).join('');
}

/* =========================================
   STATISTICS & CHART
========================================= */
function minsToTimeStr(mins) {
    if (isNaN(mins)) return '--:--';
    const h = Math.floor(mins / 60) % 24;
    const m = Math.floor(mins % 60);
    return `${padZero(h)}:${padZero(m)}`;
}

function renderStatsView() {
    const foods = state.events.filter(e => e.type === 'food');
    
    let mCount = 0, nCount = 0;
    let mMinsSum = 0, nMinsSum = 0;
    
    // Listas para calcular max/min
    let mTimes = [], nTimes = [];

    foods.forEach(f => {
        const d = new Date(f.timestamp);
        let h = d.getHours();
        let m = d.getMinutes();
        
        if (f.session === 'morning') {
            mCount++;
            const totalMins = h * 60 + m;
            mMinsSum += totalMins;
            mTimes.push(totalMins);
        } else {
            nCount++;
            // Ajuste para sesión nocturna: considerar que la madrugada (+24h) pertenece al periodo lógico continuo
            if (h < 12) h += 24;
            const totalMins = h * 60 + m;
            nMinsSum += totalMins;
            nTimes.push(totalMins);
        }
    });

    const mAvg = mCount > 0 ? mMinsSum / mCount : NaN;
    const nAvg = nCount > 0 ? nMinsSum / nCount : NaN;
    
    const allTimesConvertedToStandard = foods.map(f => {
        const d = new Date(f.timestamp);
        let h = d.getHours();
        if (f.session === 'night' && h < 12) h += 24;
        return h * 60 + d.getMinutes();
    });

    const earliest = allTimesConvertedToStandard.length > 0 ? Math.min(...allTimesConvertedToStandard) : NaN;
    const latest = allTimesConvertedToStandard.length > 0 ? Math.max(...allTimesConvertedToStandard) : NaN;

    document.getElementById('stats-grid').innerHTML = `
        <div class="stat-box">
            <span class="text-secondary">Comidas totales</span>
            <span class="stat-value">${foods.length}</span>
        </div>
        <div class="stat-box">
            <span class="text-secondary">Media mañana</span>
            <span class="stat-value">${minsToTimeStr(mAvg)}</span>
        </div>
        <div class="stat-box">
            <span class="text-secondary">Media noche</span>
            <span class="stat-value">${minsToTimeStr(nAvg)}</span>
        </div>
        <div class="stat-box">
            <span class="text-secondary">Rango horario</span>
            <span class="stat-value" style="font-size: 1rem;">${minsToTimeStr(earliest)} - ${minsToTimeStr(latest)}</span>
        </div>
    `;

    renderChart(foods);
}

function renderChart(foods) {
    const wrapper = document.getElementById('svg-chart-wrapper');
    if (foods.length === 0) {
        wrapper.innerHTML = '<p class="text-secondary" style="font-size:0.8rem; text-align:center;">No hay suficientes datos</p>';
        return;
    }

    // Filtrar comidas de los últimos 7 días lógicos
    // Usamos un mapa simplificado (SVG estático sin librería)
    
    const width = wrapper.clientWidth || 300;
    const height = 120;
    
    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">`;
    
    // Líneas base
    const yMorning = 40;
    const yNight = 90;
    
    svg += `<text x="0" y="${yMorning + 4}" class="chart-label">Mañana</text>`;
    svg += `<line x1="45" y1="${yMorning}" x2="${width}" y2="${yMorning}" class="chart-line"/>`;
    
    svg += `<text x="0" y="${yNight + 4}" class="chart-label">Noche</text>`;
    svg += `<line x1="45" y1="${yNight}" x2="${width}" y2="${yNight}" class="chart-line"/>`;

    // Solo coger un máximo de 7 días recientes
    const recentFoods = [...foods].sort((a,b)=>a.timestamp - b.timestamp).slice(-14); // up to 14 points
    
    if (recentFoods.length > 0) {
        const stepX = (width - 60) / Math.max(recentFoods.length - 1, 1);
        
        recentFoods.forEach((f, i) => {
            const x = 50 + (i * stepX);
            const isMorning = f.session === 'morning';
            const cy = isMorning ? yMorning : yNight;
            const cssClass = isMorning ? 'chart-dot-morning' : 'chart-dot-night';
            
            // Añadir ligera variación vertical basada en la hora para que los puntos no pisen la línea
            const d = new Date(f.timestamp);
            let offset = 0;
            if (isMorning) {
                // rango 6 a 15, mapeado suavemente
                offset = ((d.getHours() - 10) * 2); 
            } else {
                let h = d.getHours();
                if (h<12) h+=24;
                offset = ((h - 22) * 2);
            }
            // limit offset
            offset = Math.max(-10, Math.min(10, offset));

            svg += `<circle cx="${x}" cy="${cy + offset}" r="4" class="${cssClass}" />`;
        });
    }

    svg += `</svg>`;
    wrapper.innerHTML = svg;
}


/* =========================================
   NAVIGATION & UI HANDLERS
========================================= */
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(viewId).classList.add('active');
    
    const navBtn = document.querySelector(`[data-target="${viewId}"]`);
    if(navBtn) navBtn.classList.add('active');

    // Render specifics
    if (viewId === 'view-home') renderHomeView();
    if (viewId === 'view-history') renderHistoryView();
    if (viewId === 'view-stats') renderStatsView();
}

function initRouter() {
    const params = new URLSearchParams(window.location.search);
    const tag = params.get('tag');

    // Ocultar nav inferior si es un escaneo directo de NFC para limpiar la interfaz,
    // (Opcional, en este caso lo mantenemos para que puedan navegar, pero priorizamos la vista)
    
    if (tag === 'pill') {
        switchView('view-pill');
        renderPillView();
    } else if (tag === 'food') {
        switchView('view-food');
        renderFoodView();
    } else {
        switchView('view-home');
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

/* =========================================
   MODAL LOGIC (RESET DATA)
========================================= */
const modal = document.getElementById('modal');
const modalInput = document.getElementById('modal-input');
const modalError = document.getElementById('modal-error');

document.getElementById('btn-show-reset').addEventListener('click', () => {
    modalInput.value = '';
    modalError.textContent = '';
    modal.classList.add('active');
    modalInput.focus();
});

document.getElementById('modal-cancel').addEventListener('click', () => {
    modal.classList.remove('active');
});

document.getElementById('modal-confirm').addEventListener('click', () => {
    if (modalInput.value === PIN_CODE) {
        clearAllData();
        modal.classList.remove('active');
        showToast('Datos reiniciados');
        initRouter(); // re-render view
    } else {
        modalError.textContent = 'Contraseña incorrecta';
    }
});

/* =========================================
   APP INIT
========================================= */
function init() {
    loadData();
    document.getElementById('header-date').textContent = getCurrentDateFormatted();
    initRouter();
    
    // Configurar Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            // Remove NFC tags from URL visually without reload
            window.history.replaceState({}, document.title, window.location.pathname);
            switchView(target);
        });
    });

    // Auto-update times every 30s
    setInterval(updateRelativeTimes, 30000);
}

// Start
document.addEventListener('DOMContentLoaded', init);