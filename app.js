// --- 安全读取 localStorage ---
function openDemoMode() {
    if (window.__timebookDemo) {
        window.parent.postMessage({ type: 'timebook-close-demo' }, '*');
        return;
    }
    document.getElementById('demo-mode-frame').src = location.pathname + '?demo=october2026';
    document.getElementById('demo-mode-layer').classList.remove('hidden');
}
function closeDemoMode() {
    document.getElementById('demo-mode-layer').classList.add('hidden');
    document.getElementById('demo-mode-frame').removeAttribute('src');
}
window.addEventListener('message', event => {
    const frame = document.getElementById('demo-mode-frame');
    if (event.source === frame?.contentWindow && event.data?.type === 'timebook-close-demo') closeDemoMode();
});
function safeJSON(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
    } catch(e) { return fallback; }
}
function escHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeColor(val, fallback) {
    if (typeof val !== 'string') return fallback || '#94a3b8';
    const v = val.trim();
    if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return v;
    if (/^(rgb|rgba|hsl|hsla)\([\d\s.,%]+\)$/.test(v)) return v;
    if (v === 'transparent') return v;
    return fallback || '#94a3b8';
}
let _idCounter = 0;
function genId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now() * 1000 + (++_idCounter % 1000);
}
// --- 数据模型（仅首次无 v9_cats 时注入）---
const DEFAULT_CATS = [
    { id: 1, name: "工作", icon: "💼", color: "#3b82f6", subs: ["办公", "开会", "沟通", "见客户", "上班"] },
    { id: 2, name: "学习", icon: "📘", color: "#6366f1", subs: ["学习", "阅读", "上课", "备考"] },
    { id: 3, name: "生活", icon: "🏠", color: "#f59e0b", subs: ["睡觉", "起床", "洗漱", "家务", "做饭", "餐饮"], systemSleep: true },
    { id: 4, name: "出行", icon: "🧭", color: "#ef4444", subs: ["开车", "网约车", "公交", "地铁", "高铁", "飞机", "步行", "骑行"] },
    { id: 5, name: "休闲", icon: "🎧", color: "#a855f7", subs: ["游戏", "刷手机", "娱乐", "社交", "购物", "休息"] },
    { id: 6, name: "锻炼", icon: "🏅", color: "#14b8a6", subs: ["运动", "健身", "跑步", "散步", "瑜伽", "冥想"] }
];
const DEFAULT_SHORTCUTS = [
    { l1: "生活", l2: "睡觉", icon: "😴" },
    { l1: "工作", l2: "办公", icon: "📝" },
    { l1: "生活", l2: "餐饮", icon: "🍽️" },
    { l1: "出行", l2: "开车", icon: "🚗" },
    { l1: "学习", l2: "学习", icon: "📖" },
    { l1: "锻炼", l2: "运动", icon: "🏋️" }
];
/** 并行高发：上班、开会、见客户等叠加在主线上 */
const DEFAULT_PARALLEL_SHORTCUTS = [
    { l1: "工作", l2: "上班", icon: "👔" },
    { l1: "工作", l2: "开会", icon: "📋" },
    { l1: "工作", l2: "见客户", icon: "🤝" },
    { l1: "生活", l2: "餐饮", icon: "🍽️" },
    { l1: "休闲", l2: "刷手机", icon: "📱" },
    { l1: "锻炼", l2: "瑜伽", icon: "🧘" }
];
const DEFAULT_INPUT_ALIASES = {
    火锅: { l1: "生活", l2: "餐饮" },
    外卖: { l1: "生活", l2: "餐饮" },
    聚餐: { l1: "生活", l2: "餐饮" },
    跑步: { l1: "锻炼", l2: "跑步" },
    瑜伽课: { l1: "锻炼", l2: "瑜伽" }
};
let cats = safeJSON('v9_cats');
if (!cats || !Array.isArray(cats) || !cats.length) {
    cats = JSON.parse(JSON.stringify(DEFAULT_CATS));
    localStorage.setItem('v9_cats', JSON.stringify(cats));
}
if (!cats.some((cat) => cat.name === '场景')) {
    cats.push({ id: genId(), name: '场景', icon: '🧳', color: '#0f9f8c', subs: ['出差', '旅行', '聚会'] });
    localStorage.setItem('v9_cats', JSON.stringify(cats));
}

function ensureSystemSleepCategory() {
    let changed = false;
    let cat = cats.find((item) => item.systemSleep)
        || cats.find((item) => item.name === '生活' && Array.isArray(item.subs) && item.subs.includes('睡觉'));
    if (!cat) {
        cat = { id: genId(), name: '生活', icon: '🏠', color: '#f59e0b', subs: ['睡觉'], systemSleep: true };
        cats.push(cat);
        changed = true;
    }
    if (!Array.isArray(cat.subs)) {
        cat.subs = [];
        changed = true;
    }
    if (!cat.subs.includes('睡觉')) {
        cat.subs.unshift('睡觉');
        changed = true;
    }
    if (!cat.systemSleep) {
        cat.systemSleep = true;
        changed = true;
    }
    if (changed) localStorage.setItem('v9_cats', JSON.stringify(cats));
    return cat;
}

function isSystemSleep(cat, name) {
    return !!cat?.systemSleep && name === '睡觉';
}

function isSystemSleepSelection(l1, l2) {
    return isSystemSleep(getCat(l1), l2);
}

ensureSystemSleepCategory();
if (!localStorage.getItem('v9_sleep_rest_category_created')) {
    if (!cats.some((cat) => cat.name === '休息')) {
        cats.push({ id: genId(), name: '休息', icon: '😴', color: '#8b9bb4', subs: [] });
        localStorage.setItem('v9_cats', JSON.stringify(cats));
    }
    localStorage.setItem('v9_sleep_rest_category_created', '1');
}
const SCENE_COLOR_PALETTE = ['#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#f59e0b', '#6366f1', '#22c55e'];
const DEFAULT_SCENE_COLORS = { '出差': '#0ea5e9', '旅行': '#8b5cf6', '聚会': '#ec4899' };
let sceneSettings = safeJSON('v9_scene_settings', {}) || {};
sceneSettings = {
    homeLabel: typeof sceneSettings.homeLabel === 'string' && sceneSettings.homeLabel.trim() ? sceneSettings.homeLabel.trim() : '生活区',
    homeColor: safeColor(sceneSettings.homeColor, '#f59e0b'),
    colors: sceneSettings.colors && typeof sceneSettings.colors === 'object' ? sceneSettings.colors : {},
    showSceneColor: sceneSettings.showSceneColor !== false
};
function saveSceneSettings() {
    localStorage.setItem('v9_scene_settings', JSON.stringify(sceneSettings));
}
function getSceneColor(name) {
    const key = String(name || '').trim();
    if (!key) return '#0f9f8c';
    const saved = sceneSettings.colors[key];
    if (typeof saved === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(saved.trim())) return saved.trim();
    const sceneNames = getCat('场景')?.subs || [];
    return DEFAULT_SCENE_COLORS[key] || SCENE_COLOR_PALETTE[Math.max(0, sceneNames.indexOf(key)) % SCENE_COLOR_PALETTE.length];
}
function ensureSceneColor(name) {
    const key = String(name || '').trim();
    if (!key || sceneSettings.colors[key]) return;
    sceneSettings.colors[key] = getSceneColor(key);
    saveSceneSettings();
}
(getCat('场景')?.subs || []).forEach(ensureSceneColor);
saveSceneSettings();
let shortcuts = safeJSON('v9_shorts');
if (!Array.isArray(shortcuts)) {
    shortcuts = [...DEFAULT_SHORTCUTS];
    localStorage.setItem('v9_shorts', JSON.stringify(shortcuts));
}
let parallelShortcuts = safeJSON('v9_parallel_shorts');
if (!Array.isArray(parallelShortcuts)) {
    parallelShortcuts = [...DEFAULT_PARALLEL_SHORTCUTS];
    localStorage.setItem('v9_parallel_shorts', JSON.stringify(parallelShortcuts));
}
// 旧版本没有记录“快捷入口图标是否由用户指定”，用已有非占位图标兼容迁移。
shortcuts = shortcuts.map(s => ({ ...s, customIcon: s.customIcon ?? (s.icon && s.icon !== '📌') }));
parallelShortcuts = parallelShortcuts.map(s => ({ ...s, customIcon: s.customIcon ?? (s.icon && s.icon !== '📌') }));
let logs = safeJSON('v9_logs') || [];
let current = safeJSON('v9_current') || null;
let recordMode = localStorage.getItem('v9_record_mode') === 'journal' ? 'journal' : 'continuous';
let showUnassignedMain = localStorage.getItem('v9_show_unassigned_main') !== 'false';
const savedUnlocatedLogs = safeJSON('v9_unlocated_logs', []);
let unlocatedLogs = (Array.isArray(savedUnlocatedLogs) ? savedUnlocatedLogs : [])
    .filter((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(item.durationMs) && item.durationMs > 0);
function toSecondMs(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.floor(n / 1000) * 1000 : n;
}
function nowSecondMs() {
    return Math.floor(Date.now() / 1000) * 1000;
}
function normalizeTimeRecord(record) {
    if (!record || typeof record !== 'object') return record;
    if (record.startTime != null) record.startTime = toSecondMs(record.startTime);
    if (record.endTime != null) record.endTime = toSecondMs(record.endTime);
    return record;
}
logs = logs.map(normalizeTimeRecord);
if (logs.length) localStorage.setItem('v9_logs', JSON.stringify(logs));
function normalizeCurrentTimestamps() {
    if (!current) return;
    current.startTime = toSecondMs(current.startTime);
    if (!Number.isFinite(current.startTime)) {
        current = null;
        localStorage.removeItem('v9_current');
        return;
    }
    if (current.l1 == null) current.l1 = '';
    if (current.l2 == null) current.l2 = '';
}
normalizeCurrentTimestamps();
let parallelCurrent = safeJSON('v9_parallel') || null;
let parallelHistory = safeJSON('v9_parallel_history') || [];
parallelCurrent = normalizeTimeRecord(parallelCurrent);
parallelHistory = parallelHistory.map(normalizeTimeRecord);
let eventTypes = safeJSON('v9_event_types', []) || [];
let eventRecords = safeJSON('v9_event_records', []) || [];
const EVENT_RESERVED_NAMES = new Set(['睡觉']);
const EVENT_COLORS = ['#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#22c55e', '#64748b'];

eventTypes = eventTypes
    .filter((item) => item && typeof item.name === 'string' && item.name.trim())
    .map((item, index) => ({
        id: item.id || genId(),
        name: item.name.trim(),
        icon: item.icon || '•',
        disabled: !!item.disabled,
        group: typeof item.group === 'string' ? item.group.trim() : '',
        quick: item.quick === true,
        color: safeColor(item.color, EVENT_COLORS[index % EVENT_COLORS.length]),
    }));
eventRecords = eventRecords
    .filter((item) => item && item.typeId && Number.isFinite(Number(item.occurredAt)))
    .map((item) => ({ ...item, occurredAt: Number(item.occurredAt), parentId: item.parentId || null, count: Number.isInteger(item.count) && item.count > 0 ? item.count : 1 }));
if (eventTypes.length) localStorage.setItem('v9_event_types', JSON.stringify(eventTypes));
if (eventRecords.length) localStorage.setItem('v9_event_records', JSON.stringify(eventRecords));
if (current) localStorage.setItem('v9_current', JSON.stringify(current));
if (parallelCurrent) localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
if (parallelHistory.length) localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));

// 旧版本曾用时间戳作为主线 ID；极端情况下场景和生活主线会共用一个 ID，
// 令同一条并行同时挂到两边。先保证每个已结束主线都有唯一 ID，再修复子级归属。
function repairDuplicateMainLogIds() {
    const seen = new Set();
    let changed = false;
    logs.forEach((item) => {
        if (item.parallel) return;
        const idKey = item.id == null ? '' : String(item.id);
        if (!idKey || seen.has(idKey)) {
            item.id = genId();
            changed = true;
        }
        seen.add(String(item.id));
    });
    if (changed) localStorage.setItem('v9_logs', JSON.stringify(logs));
}
repairDuplicateMainLogIds();

function repairActiveMainId() {
    if (!current) return;
    const occupied = new Set(logs.filter((item) => !item.parallel).map((item) => String(item.id)));
    if (!current.id || occupied.has(String(current.id))) {
        const oldId = current.id;
        current.id = genId();
        if (parallelCurrent && String(parallelCurrent.parentId) === String(oldId)) {
            parallelCurrent.parentId = current.id;
            localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
        }
        localStorage.setItem('v9_current', JSON.stringify(current));
    }
}
repairActiveMainId();

function repairOrphanedParallelParents() {
    const mainLogs = logs.filter((item) => !item.parallel);
    const findParent = (parallelLog) => {
        const start = parallelLog.startTime;
        const end = logEndMs(parallelLog);
        return mainLogs
            .map((main) => ({
                main,
                overlap: Math.max(0, Math.min(logEndMs(main), end) - Math.max(main.startTime, start)),
            }))
            .filter((item) => item.overlap > 0)
            .sort((a, b) => b.overlap - a.overlap)[0]?.main;
    };
    let changed = false;
    logs.forEach((item) => {
        if (!item.parallel) return;
        const linkedParent = mainLogs.find((main) => String(main.id) === String(item.parentId));
        const linkedOverlap = linkedParent
            ? Math.max(0, Math.min(logEndMs(linkedParent), logEndMs(item)) - Math.max(linkedParent.startTime, item.startTime))
            : 0;
        const sceneParent = item.sceneName
            ? mainLogs.filter((main) => main.scene && main.l2 === item.sceneName)
                .map((main) => ({ main, overlap: Math.max(0, Math.min(logEndMs(main), logEndMs(item)) - Math.max(main.startTime, item.startTime)) }))
                .filter((candidate) => candidate.overlap > 0)
                .sort((a, b) => b.overlap - a.overlap)[0]?.main
            : null;
        // 父级存在但和并行时段完全不重叠，仍是错挂；按真实重叠时间修复。
        const parent = sceneParent || (!linkedParent || linkedOverlap <= 0 ? findParent(item) : null);
        if (parent && item.parentId !== parent.id) {
            item.parentId = parent.id;
            changed = true;
        }
        if (parent?.scene && item.sceneName !== parent.l2) {
            item.sceneName = parent.l2;
            changed = true;
        }
    });
    parallelHistory.forEach((item) => {
        if (!item.parentId || mainLogs.some((main) => main.id === item.parentId)) return;
        const parent = findParent(item);
        if (parent) {
            item.parentId = parent.id;
            changed = true;
        }
    });
    // 旧错挂数据会留下两条内容完全相同、只差父级的并行记录；修复父级后合并为一条。
    const seenParallelIds = new Set();
    const seenParallel = new Set();
    const beforeDedup = logs.length;
    logs = logs.filter((item) => {
        if (!item.parallel) return true;
        const idKey = item.id == null ? '' : String(item.id);
        if (idKey && seenParallelIds.has(idKey)) return false;
        if (idKey) seenParallelIds.add(idKey);
        const key = [item.parentId, item.startTime, logEndMs(item), item.l1 || '', item.l2 || '', item.icon || ''].join('|');
        if (seenParallel.has(key)) return false;
        seenParallel.add(key);
        return true;
    });
    if (logs.length !== beforeDedup) changed = true;
    if (changed) {
        localStorage.setItem('v9_logs', JSON.stringify(logs));
        localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
    }
}
repairOrphanedParallelParents();

// 场景容器可跨天拆成多条显示记录；活动关联的是稳定的容器 ID，而不是某一天的记录 ID。
function getSceneContainerId(sceneLog) {
    return String(sceneLog?.sceneRootId || sceneLog?.id || '');
}

function ensureSceneContainerIds() {
    let logsChanged = false;
    logs.forEach((item) => {
        if (item.scene && !item.sceneRootId) {
            item.sceneRootId = item.id || genId();
            logsChanged = true;
        }
    });
    if (current?.scene && !current.sceneRootId) {
        current.sceneRootId = current.id || genId();
        localStorage.setItem('v9_current', JSON.stringify(current));
    }
    if (logsChanged) localStorage.setItem('v9_logs', JSON.stringify(logs));
}
ensureSceneContainerIds();

// v5.03 前，场景内的零散主线借用了“并行”数据结构。迁移后它们成为场景容器下的主线，
// 保留原 ID、时间和分类；只有挂在这些记录下面的活动才继续使用 parallel=true。
function migrateLegacySceneActivities() {
    if (localStorage.getItem('v9_scene_activity_migration_v2') === 'done') return;
    const sceneParents = logs.filter((item) => !item.parallel && item.scene);
    if (current?.scene) sceneParents.push(current);
    const findSceneParent = (item) => {
        const direct = sceneParents.find((parent) => String(parent.id) === String(item.parentId));
        if (direct) return direct;
        if (!item.sceneName) return null;
        return sceneParents
            .filter((parent) => parent.l2 === item.sceneName)
            .map((parent) => ({
                parent,
                overlap: Math.max(0, Math.min(logEndMs(parent), logEndMs(item)) - Math.max(parent.startTime, item.startTime)),
            }))
            .filter((candidate) => candidate.overlap > 0)
            .sort((a, b) => b.overlap - a.overlap)[0]?.parent || null;
    };
    let changed = false;
    const migrate = (item) => {
        const parent = findSceneParent(item);
        if (!parent) return false;
        item.parallel = false;
        item.sceneActivity = true;
        item.sceneParentId = getSceneContainerId(parent);
        item.sceneName = parent.l2 || item.sceneName || '';
        changed = true;
        return true;
    };

    logs.forEach((item) => {
        if (item.parallel && (item.sceneName || findSceneParent(item))) migrate(item);
    });
    // 升级瞬间仍在运行的旧场景并行不能留在旧通道里：收口成一条已结束的场景活动，避免丢失。
    if (parallelCurrent && (parallelCurrent.sceneName || findSceneParent(parallelCurrent))) {
        const endTime = nowSecondMs();
        const activeLegacy = {
            ...parallelCurrent,
            endTime,
            duration: Math.max(1, Math.round((endTime - parallelCurrent.startTime) / 60000))
        };
        if (migrate(activeLegacy)) {
            logs.push(activeLegacy);
            parallelCurrent = null;
            localStorage.removeItem('v9_parallel');
        }
    }
    const existingIds = new Set(logs.map((item) => String(item.id)));
    const retainedParallelHistory = [];
    parallelHistory.forEach((item) => {
        if (item.sceneName || findSceneParent(item)) {
            if (migrate(item)) {
                // 某些旧版本会同时把同一条记录写入 logs 和并行历史，只保留一份。
                if (!existingIds.has(String(item.id))) {
                    logs.push(item);
                    existingIds.add(String(item.id));
                }
            }
            else retainedParallelHistory.push(item);
        } else {
            retainedParallelHistory.push(item);
        }
    });
    parallelHistory = retainedParallelHistory;
    if (changed) {
        logs.sort((a, b) => b.startTime - a.startTime);
        localStorage.setItem('v9_logs', JSON.stringify(logs));
        localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
    }
    localStorage.setItem('v9_scene_activity_migration_v2', 'done');
}
migrateLegacySceneActivities();
settleCompletedParallelHistory();

function isSceneActive() {
    return !!current?.scene;
}

function colorWithAlpha(color, alpha) {
    const hex = safeColor(color, '#f59e0b');
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#fff7ed';
    const value = parseInt(hex.slice(1), 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function colorOnWhite(color, strength) {
    const hex = safeColor(color, '#f59e0b');
    const value = parseInt(hex.slice(1), 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    const mix = (channel) => Math.round(255 + (channel - 255) * strength);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function getActiveZone() {
    if (isSceneActive()) {
        return { label: current.l2 || current.l1 || '场景', color: getSceneColor(current.l2) };
    }
    return { label: sceneSettings.homeLabel, color: sceneSettings.homeColor };
}

function applyZoneTheme() {
    const zone = getActiveZone();
    const frame = document.getElementById('zone-frame');
    const showColor = isSceneActive() && sceneSettings.showSceneColor;
    if (frame) {
        frame.style.borderColor = showColor ? zone.color : 'transparent';
        frame.style.borderWidth = showColor ? '3px' : '0';
    }
    document.documentElement.style.setProperty('--zone-color', zone.color);
    document.documentElement.style.setProperty('--zone-soft', colorWithAlpha(zone.color, .12));
    document.getElementById('scene-entry-btn')?.classList.toggle('is-colored', showColor);
}

function updateSceneEntryButton() {
    const btn = document.getElementById('scene-entry-btn');
    if (!btn) return;
    const label = document.getElementById('scene-entry-label');
    const zone = getActiveZone();
    if (label) label.innerText = zone.label;
    btn.title = isSceneActive() ? `当前场景：${zone.label}` : `当前区域：${zone.label}`;
    applyZoneTheme();
}

function closeScenePopover() {
    const popover = document.getElementById('scene-popover');
    if (!popover) return;
    popover.classList.add('hidden');
    popover.setAttribute('aria-hidden', 'true');
}

function scenePopoverButton(label, className, handler) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.innerText = label;
    btn.addEventListener('click', handler);
    return btn;
}

function renderSceneChoiceGrid(mode) {
    const title = document.getElementById('scene-popover-title');
    const content = document.getElementById('scene-popover-content');
    const sceneCat = getCat('场景');
    if (!title || !content) return;
    document.getElementById('scene-popover').dataset.devAddressBlock = mode === 'switch' ? 'B73' : 'B21';
    title.innerText = mode === 'switch' ? '切换场景' : '选择场景';
    content.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'scene-choice-grid';
    (sceneCat?.subs || []).forEach((sceneName) => {
        ensureSceneColor(sceneName);
        const sceneColor = getSceneColor(sceneName);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'scene-choice-item';
        btn.style.borderColor = colorWithAlpha(sceneColor, .36);
        btn.style.backgroundColor = colorWithAlpha(sceneColor, .08);
        btn.style.color = sceneColor;
        const label = document.createElement('span');
        label.innerText = sceneName;
        btn.append(label);
        btn.addEventListener('click', () => {
            closeScenePopover();
            startScene(sceneName, { askParallel: mode === 'switch' });
        });
        grid.appendChild(btn);
    });
    if (!sceneCat?.subs?.length) {
        const hint = document.createElement('div');
        hint.className = 'scene-popover-hint';
        hint.innerText = '请先在类别管理的“场景”下面添加子类。';
        content.appendChild(hint);
    } else {
        content.appendChild(grid);
    }
}

function renderLifeMainGrid() {
    const title = document.getElementById('scene-popover-title');
    const content = document.getElementById('scene-popover-content');
    if (!title || !content) return;
    document.getElementById('scene-popover').dataset.devAddressBlock = 'B74';
    title.innerText = `选择${sceneSettings.homeLabel}主线`;
    content.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'scene-choice-grid';
    cats.filter((cat) => cat.name !== '场景').forEach((cat) => {
        const entries = cat.subs?.length ? cat.subs : [''];
        entries.forEach((sub) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'scene-choice-item';
            const label = document.createElement('span');
            label.innerText = sub || cat.name;
            btn.append(label);
            btn.addEventListener('click', () => {
                closeScenePopover();
                transitionSceneToMain(cat.name, sub);
            });
            grid.appendChild(btn);
        });
    });
    content.appendChild(grid);
}

function renderSceneActions() {
    const title = document.getElementById('scene-popover-title');
    const content = document.getElementById('scene-popover-content');
    if (!title || !content || !current) return;
    document.getElementById('scene-popover').dataset.devAddressBlock = 'B72';
    title.innerText = `场景：${current.l2 || current.l1}`;
    content.innerHTML = '';
    content.append(
        scenePopoverButton('切换场景', 'scene-action-btn scene-action-btn--switch', () => renderSceneChoiceGrid('switch')),
        scenePopoverButton('结束场景', 'scene-action-btn scene-action-btn--end', renderLifeMainGrid)
    );
}

function openScenePopover(mode) {
    const popover = document.getElementById('scene-popover');
    if (!popover) return;
    popover.classList.remove('hidden');
    popover.setAttribute('aria-hidden', 'false');
    if (mode === 'actions') renderSceneActions();
    else renderSceneChoiceGrid('start');
}

function enterScene() {
    openScenePopover(isSceneActive() ? 'actions' : 'start');
}

function transitionCurrentTo(next, askParallel) {
    const apply = (endParallel) => {
        const now = nowSecondMs();
        ensureDayRolloversBefore(now);
        const nextId = genId();
        if (current) commitCurrentSlice(now, false, { endParallel: !!endParallel, rollover: !endParallel });
        current = {
            id: nextId,
            startTime: now,
            ...next,
            ...(!next.scene && recordMode === 'journal' ? { journal: true } : {}),
            ...(next.scene ? { sceneRootId: next.sceneRootId || genId() } : {})
        };
        if (parallelCurrent && !endParallel) {
            parallelCurrent.parentId = nextId;
            parallelCurrent.sceneName = current.scene ? current.l2 : '';
            localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
        }
        localStorage.setItem('v9_current', JSON.stringify(current));
        renderAll();
    };
    if (parallelCurrent && askParallel) {
        showConfirm('并行仍在运行', `「${displayName(parallelCurrent)}」要结束，还是结转到下一条主线？`, '一起结束', (endParallel) => apply(endParallel), '结转');
        return;
    }
    apply(true);
}

function startScene(sceneName, options) {
    const name = String(sceneName || '').trim();
    if (!name) return;
    transitionCurrentTo({
        l1: '场景',
        l2: name,
        tag: '',
        note: '',
        color: getSceneColor(name),
        scene: true
    }, !!options?.askParallel);
}

function transitionSceneToMain(l1, l2) {
    if (!isSceneActive()) return;
    const cat = getCat(l1);
    transitionCurrentTo({
        l1,
        l2: l2 || '',
        tag: '',
        note: '',
        color: cat?.color || '#cbd5e1',
        scene: false
    }, true);
}
let labelFontSize = safeJSON('v9_labelFontSize') || 13;
/** 自由输入短语 → 分类，如「火锅」→ 餐饮（由编辑流水或历史记录学习） */
let inputAliases = safeJSON('v9_input_aliases') || {};
if (!localStorage.getItem('v9_input_aliases')) {
    inputAliases = { ...DEFAULT_INPUT_ALIASES };
    localStorage.setItem('v9_input_aliases', JSON.stringify(inputAliases));
}
let pendingClassifyLogIds = [];
let _classifyPromptOpen = false;
let _classifyTargetLogId = null;
/** 默认子类图标：互不重复（一级类图标另用 cat.icon，不与子类抢同一个） */
const SUB_ICON_MAP = {
    '办公': '📝', '开会': '📋', '沟通': '💬', '见客户': '🤝', '上班': '👔',
    '学习': '📖', '阅读': '📚', '上课': '🎓', '备考': '✏️',
    '睡觉': '😴', '起床': '⏰', '洗漱': '🧴', '家务': '🧹', '做饭': '🍳', '餐饮': '🍽️',
    '开车': '🚗', '网约车': '🚕', '公交': '🚌', '地铁': '🚇', '高铁': '🚄', '飞机': '✈️', '步行': '🚶', '骑行': '🚴',
    '游戏': '🎮', '刷手机': '📱', '娱乐': '📺', '社交': '👥', '购物': '🛒', '休息': '☕',
    '运动': '🏋️', '健身': '💪', '跑步': '🏃', '散步': '🦶', '瑜伽': '🧘', '冥想': '🕯️',
    '开网约车': '🚕', '写代码': '💻', '早午晚餐': '🍽️'
};
function getSubIcon(name, parentIcon, cat) {
    return cat?.subIcons?.[name] || SUB_ICON_MAP[name] || parentIcon;
}

function setSubIcon(cat, name, icon) {
    if (!cat || !name) return;
    cat.subIcons = cat.subIcons || {};
    cat.subIcons[name] = icon || '📌';
}

function moveSubIcon(cat, oldName, newName) {
    if (!cat?.subIcons || oldName === newName) return;
    if (Object.prototype.hasOwnProperty.call(cat.subIcons, oldName)) {
        cat.subIcons[newName] = cat.subIcons[oldName];
        delete cat.subIcons[oldName];
    }
}

const EMOJI_CATS = {
    '所有': ['😊','😀','🥰','😎','😴','🥱','🤗','😅','😂','😁','🤣','😍','😘','😏','😜','🤔','😤','🥺','🤩','🥳','💤','😰','🤒','💼','📝','💻','📱','📖','✏️','🎓','💡','🔧','📊','📈','📋','📁','✉️','📞','🔍','⚙️','🛠️','🧰','📐','💊','🩺','🚗','🚌','🏃','🧘','✈️','🏖️','🚕','🚙','🚲','🛵','🚇','🚆','🚢','🚶','🧎','⛰️','🌊','🌅','🏕️','🚴','🎵','🎮','🎬','🎧','🎤','🎸','🎹','🎨','📸','🎭','🎯','🏆','🥇','🎽','🎿','🛹','📺','📚','🍳','☕','🍵','🍽️','🥗','🍜','🍎','🍊','🍇','🍓','🍑','🥝','🥑','🥦','🥕','🌽','🍞','🧀','🥛','🍺','🍷','🥤','🍰','🍪','🍩','🍿','🍔','🌭','🥟','🍣','🍛','🍝','🧁','🍦','🥘','🛒','🏠','🐱','🐶','❤️','🔥','🛌','🚿','🪥','🧹','🧴','🧤','🧣','👕','👖','👟','👓','💤','🎁','💰','🔑','📦','🧧','💊','🩹','🧽','🧺','🪣','🧵','✂️','📿','🔒','📌','📍'],
    '表情': ['😊','😀','🥰','😎','😴','🥱','🤗','😅','😂','😁','🤣','😍','😘','😏','😜','🤔','😤','🥺','🤩','🥳','💤','😰','🤒','😈','💀'],
    '工作': ['💼','📝','💻','📱','📖','✏️','🎓','💡','🔧','📊','📈','📉','📋','📁','🗂️','✉️','📞','📠','🔍','🔬','⚙️','🛠️','🧰','📐','💊','🩺','🧪','🔗'],
    '出行': ['🚗','🚌','🏃','🧘','✈️','🏖️','🚕','🚙','🚲','🛵','🏍️','🚇','🚆','🚢','🛴','🚶','🧎','⛰️','🌊','🌅','🏕️','🚴','🏄'],
    '娱乐': ['🎵','🎮','🎬','🎧','🎤','🎸','🎹','🎺','🎨','📸','🎭','🎪','🎯','🏆','🥇','🥈','🥉','🎽','🎿','🛹','🎳','📺','📚','🎰','🃏'],
    '饮食': ['🍳','☕','🍵','🍽️','🥗','🍜','🍎','🍊','🍋','🍇','🍓','🍑','🍒','🥝','🥑','🥦','🥕','🌽','🍞','🧀','🥛','🍺','🍷','🥤','🧊','🍰','🍪','🍩','🍿','🍔','🌭','🥟','🍣','🍛','🍝','🧁','🍦','🥘','🍖','🥩'],
    '生活': ['🛒','🏠','❤️','🔥','🛌','🚿','🪥','🧹','🧴','🧤','🧣','👕','👖','👟','👓','💤','🎁','💰','🔑','📦','🧧','💊','🩹','🧽','🧺','🪣','🧵','✂️','📿','🔒','📌','📍','🐱','🐶']
};
const EMOJI_CAT_ORDER = ['所有', '表情', '工作', '出行', '娱乐', '饮食', '生活'];
let selL1 = cats[0]?.name || "";
let pickerMode = 'record';
const CLOCK_SPAN_OPTIONS = [1, 3, 6, 9, 12, 24];
let viewDate = '';
let calendarViewYear = 0;
let calendarViewMonth = 0;
let editIndex = null;
let editingShortcutIndex = null;
let configEditMode = false;
let configSectionOpen = null;
let expandedCategoryId = -1;
let categoryConfigTab = 'categories';
let drawerViewMode = 'columns';
document.addEventListener('DOMContentLoaded', () => {
    if (window.TimeBookAndroid && typeof window.TimeBookAndroid.openWidgetSettings === 'function') {
        document.getElementById('widget-settings-entry')?.classList.remove('hidden');
    }
});
let editDrawerPreviousViewMode = null;
const BJ_OFFSET = 8 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CLOCK_PREFS_DEFAULT = { layout: 'dual', singleAxis: '60m', spanHoursA: 1, spanHoursB: 24 };
let clockPrefs = { ...CLOCK_PREFS_DEFAULT, ...safeJSON('v9_clock_prefs') };

function clampClockSpanHours(n) {
    const v = parseInt(n, 10);
    if (!Number.isFinite(v)) return CLOCK_SPAN_OPTIONS[0];
    let best = CLOCK_SPAN_OPTIONS[0];
    CLOCK_SPAN_OPTIONS.forEach((o) => {
        if (Math.abs(o - v) < Math.abs(best - v)) best = o;
    });
    return best;
}

function getClockPrefs() {
    const raw = { ...CLOCK_PREFS_DEFAULT, ...clockPrefs };
    raw.spanHoursA = clampClockSpanHours(raw.spanHoursA);
    raw.spanHoursB = clampClockSpanHours(raw.spanHoursB);
    return raw;
}

/** 查看日 N 小时：不跨查看日 0 点；N≥24=查看日全天；历史日按结转闭合 */
function getTodayDateStr() {
    return formatBeijingDate(nowSecondMs());
}

function isDateToday(dateStr) {
    return dateStr === getTodayDateStr();
}

function getClockWindow(which, dateStr) {
    const d = dateStr || getTodayDateStr();
    const p = getClockPrefs();
    const anchor = getViewAnchorMs(d);
    const dayStart = beijingDateStrToDayStart(d);
    const dayEnd = dayStart + DAY_MS;
    const hours = which === 'b' ? p.spanHoursB : p.spanHoursA;

    if (hours >= 24) {
        return { rangeStart: dayStart, rangeEnd: dayEnd };
    }

    if (!isDateToday(d)) {
        const rangeEnd = dayEnd;
        const rangeStart = Math.max(dayStart, dayEnd - hours * HOUR_MS);
        return { rangeStart, rangeEnd };
    }

    const hourEnd = beijingPeriodStart(anchor, HOUR_MS) + HOUR_MS;
    const rangeEnd = Math.min(hourEnd, dayEnd);
    const rangeStart = Math.max(dayStart, rangeEnd - hours * HOUR_MS);
    return { rangeStart, rangeEnd };
}

function formatClockRemain(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h > 0) return `${h}h${m > 0 ? m + 'm' : ''}`;
    return String(Math.max(1, Math.ceil(ms / 60000)));
}

function formatClockCenterRemain(remainMs, spanHours) {
    const ms = Math.max(0, remainMs);
    if (spanHours <= 1) return String(Math.max(1, Math.ceil(ms / 60000)));
    return formatClockRemain(ms);
}

function updateClockCenterLabels(anchorMs) {
    const now = anchorMs;
    const p = getClockPrefs();
    const show60 = p.layout === 'dual' || p.singleAxis === '60m';
    const show24 = p.layout === 'dual' || p.singleAxis === '24h';
    if (show60) {
        const wA = getClockWindow('a', getTodayDateStr());
        setText('label-60m-remain', formatClockCenterRemain(wA.rangeEnd - now, p.spanHoursA));
    }
    if (show24) {
        const wB = getClockWindow('b', getTodayDateStr());
        if (p.spanHoursB >= 24) {
            const dayRemainMs = Math.max(0, wB.rangeEnd - now);
            const dayRemainH = Math.floor(dayRemainMs / HOUR_MS);
            const dayRemainM = Math.floor((dayRemainMs % HOUR_MS) / 60000);
            setText('label-24h-remain', `${String(dayRemainH).padStart(2, '0')}:${String(dayRemainM).padStart(2, '0')}`);
        } else {
            setText('label-24h-remain', formatClockCenterRemain(wB.rangeEnd - now, p.spanHoursB));
        }
    }
}

function saveClockPrefs() {
    localStorage.setItem('v9_clock_prefs', JSON.stringify(clockPrefs));
}

function setClockPref(key, value) {
    if (key === 'spanHoursA' || key === 'spanHoursB') {
        clockPrefs[key] = clampClockSpanHours(value);
    } else {
        clockPrefs[key] = value;
    }
    saveClockPrefs();
    applyClockLayout();
    lastSecondTs = 0;
    renderFlow();
    renderClockSettings();
    if (document.getElementById('page-record')?.classList.contains('active')) renderRecordPage();
}

const COMPACT_WHEEL_ITEM_H = 28;
const COMPACT_WHEEL_PAD = 2;

let compactWheelScrollTimer = null;
let compactWheelOnSelect = null;

function closeCompactWheel(applySelection) {
    const overlay = document.getElementById('compact-wheel-overlay');
    const listEl = document.getElementById('compact-wheel-list');
    if (applySelection && compactWheelOnSelect && listEl) {
        const active = listEl.querySelector('.compact-wheel-item.is-active');
        if (active?.dataset?.value !== undefined) compactWheelOnSelect(active.dataset.value);
    }
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('compact-wheel-open');
    const viewport = document.getElementById('compact-wheel-viewport');
    if (viewport) viewport.onscroll = null;
    compactWheelOnSelect = null;
}

function highlightCompactWheelItem(listEl, index) {
    listEl.querySelectorAll('.compact-wheel-item:not(.compact-wheel-pad)').forEach((el, i) => {
        el.classList.toggle('is-active', i === index);
    });
}

function scrollCompactWheelToIndex(viewport, listEl, index) {
    const items = listEl.querySelectorAll('.compact-wheel-item:not(.compact-wheel-pad)');
    if (!items.length) return;
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    viewport.scrollTop = (clamped + COMPACT_WHEEL_PAD) * COMPACT_WHEEL_ITEM_H;
    highlightCompactWheelItem(listEl, clamped);
    return clamped;
}

function openCompactWheel({ title, items, value, onSelect }) {
    const overlay = document.getElementById('compact-wheel-overlay');
    const titleEl = document.getElementById('compact-wheel-title');
    const viewport = document.getElementById('compact-wheel-viewport');
    const listEl = document.getElementById('compact-wheel-list');
    if (!overlay || !viewport || !listEl) return;

    closeCompactWheel();
    compactWheelOnSelect = onSelect;
    if (titleEl) titleEl.textContent = title || '';

    listEl.innerHTML = '';
    for (let i = 0; i < COMPACT_WHEEL_PAD; i++) {
        const pad = document.createElement('li');
        pad.className = 'compact-wheel-item compact-wheel-pad';
        pad.setAttribute('aria-hidden', 'true');
        listEl.appendChild(pad);
    }
    items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'compact-wheel-item';
        li.dataset.value = String(item.value);
        li.textContent = item.label;
        li.addEventListener('click', () => {
            if (compactWheelOnSelect) compactWheelOnSelect(item.value);
            closeCompactWheel(false);
        });
        listEl.appendChild(li);
    });
    for (let i = 0; i < COMPACT_WHEEL_PAD; i++) {
        const pad = document.createElement('li');
        pad.className = 'compact-wheel-item compact-wheel-pad';
        pad.setAttribute('aria-hidden', 'true');
        listEl.appendChild(pad);
    }

    const startIdx = Math.max(0, items.findIndex((it) => it.value === value));
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('compact-wheel-open');

    requestAnimationFrame(() => {
        scrollCompactWheelToIndex(viewport, listEl, startIdx);
    });

    viewport.onscroll = () => {
        clearTimeout(compactWheelScrollTimer);
        compactWheelScrollTimer = setTimeout(() => {
            const idx = Math.round(viewport.scrollTop / COMPACT_WHEEL_ITEM_H) - COMPACT_WHEEL_PAD;
            scrollCompactWheelToIndex(viewport, listEl, idx);
        }, 90);
    };
}

function createPickerTrigger(displayText, onOpen) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-trigger btn-active';
    const text = document.createElement('span');
    text.className = 'picker-trigger-text';
    text.textContent = displayText;
    const chev = document.createElement('span');
    chev.className = 'picker-trigger-chevron';
    chev.textContent = '▾';
    btn.append(text, chev);
    btn.addEventListener('click', onOpen);
    return btn;
}

(function initCompactWheelOverlay() {
    const overlay = document.getElementById('compact-wheel-overlay');
    if (!overlay) return;
    overlay.querySelector('[data-wheel-dismiss]')?.addEventListener('click', () => closeCompactWheel(true));
})();

window.onload = () => {
    try {
        initViewDateState();
        try { rebuildInputAliasesFromLogs(); } catch (e) { console.warn('rebuildInputAliases', e); }
        normalizeCurrentTimestamps();
        lastBeijingDateStr = getTodayDateStr();
        ensureDayRolloversBefore(nowSecondMs());
        applyClockLayout();
        renderAll();
        tickLoop();
    } catch(e) {
        document.body.innerHTML = '<div style="padding:40px;font-size:14px;color:red;"><h2>⚠️ 初始化失败</h2><pre style="margin-top:16px;background:#fee;padding:16px;border-radius:12px;font-size:12px;white-space:pre-wrap;">' + escHtml(e.stack) + '</pre></div>';
    }
};

let tickRAF = null;
function tickLoop() {
    try { tick(); } catch(e) { console.error('tick error', e); }
    tickRAF = requestAnimationFrame(tickLoop);
}

function renderAll() {
    renderShortcuts();
    renderParallelShortcuts();
    updateSceneEntryButton();
    renderHomeHistory();
    renderCalendarPage();
    renderConfig();
    renderReport();
    if (document.getElementById('page-events')?.classList.contains('active')) renderEventCenter();
    if (document.getElementById('page-event-home')?.classList.contains('active')) renderEventHome();
    updateUI();
}

function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    if (h > 0) return `${h}:${mm}:${ss}`;
    return `${mm}:${ss}`;
}

/** 优先用 endTime-startTime 的整秒差，避免 duration(分钟) 丢秒 */
function logDurationMs(log, liveEndMs) {
    if (!log) return 0;
    const end = liveEndMs != null ? liveEndMs : (log.endTime || (log.live ? nowSecondMs() : null));
    if (end != null && log.startTime != null) return Math.max(0, end - log.startTime);
    if (log.duration != null) return Math.max(1000, Math.round(log.duration * 60000));
    return 0;
}

/** main-live | main-log | parallel-live=并行进行中 | parallel-log=主线下并行(灰) */
function logFlowCardClass(kind) {
    return 'swipe-card log-flow-card log-flow-card--' + kind;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function beijingPeriodStart(ms, periodMs) {
    return Math.floor((ms + BJ_OFFSET) / periodMs) * periodMs - BJ_OFFSET;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatBeijingClockSec(ms) {
    const d = new Date(ms + BJ_OFFSET);
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

function formatBeijingDate(ms) {
    const d = new Date(ms + BJ_OFFSET);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];

function beijingDateStrToDayStart(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d) - BJ_OFFSET;
}

function beijingDateStrToDayEnd(dateStr) {
    return beijingDateStrToDayStart(dateStr) + DAY_MS;
}

function nextBeijingDateStr(dateStr) {
    return formatBeijingDate(beijingDateStrToDayStart(dateStr) + DAY_MS);
}

function nextBeijingMonthStart(ms) {
    const d = new Date(ms + BJ_OFFSET);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - BJ_OFFSET;
}

function logEndMs(log, liveEndMs) {
    if (!log) return 0;
    if (liveEndMs != null) return liveEndMs;
    if (log.endTime != null) return log.endTime;
    if (log.duration != null) return log.startTime + Math.round(log.duration * 60000);
    return log.startTime;
}

/** 记录是否与某日 00:00–24:00（北京）有重叠 */
function logTouchesDate(log, dateStr) {
    const dayStart = beijingDateStrToDayStart(dateStr);
    const dayEnd = dayStart + DAY_MS;
    const end = logEndMs(log, log.live ? nowSecondMs() : null);
    return log.startTime < dayEnd && end > dayStart;
}

function collectLogCalendarDays() {
    const days = new Set();
    const addLogDays = (l) => {
        let d = formatBeijingDate(l.startTime);
        const endDay = formatBeijingDate(logEndMs(l) - 1);
        while (d <= endDay) {
            days.add(d);
            if (d === endDay) break;
            d = nextBeijingDateStr(d);
        }
    };
    logs.forEach(addLogDays);
    unlocatedLogs.forEach((item) => days.add(item.date));
    eventRecords.forEach((item) => days.add(formatBeijingDate(item.occurredAt)));
    if (current) {
        let d = formatBeijingDate(current.startTime);
        const today = getTodayDateStr();
        while (d <= today) {
            days.add(d);
            if (d === today) break;
            d = nextBeijingDateStr(d);
        }
    }
    return days;
}

let lastBeijingDateStr = '';

/** 已结束并行：只把落在 [segStart, segEnd) 内的部分挂到本日主线上，其余留待后续日界 */
function flushParallelHistoryForSlice(mainLogId, segStart, segEnd) {
    const keep = [];
    parallelHistory.forEach((p) => {
        const pEnd = logEndMs(p);
        if (pEnd <= segStart || p.startTime >= segEnd) {
            keep.push(p);
            return;
        }
        const clipStart = Math.max(p.startTime, segStart);
        const clipEnd = Math.min(pEnd, segEnd);
        if (clipEnd > clipStart) {
            logs.unshift({
                ...p,
                startTime: clipStart,
                endTime: clipEnd,
                duration: Math.max(1, Math.round((clipEnd - clipStart) / 60000)),
                parallel: true,
                parentId: mainLogId,
                note: p.note || ''
            });
        }
        if (p.startTime < segStart) {
            keep.push({
                ...p,
                endTime: segStart,
                duration: Math.max(1, Math.round((segStart - p.startTime) / 60000))
            });
        }
        if (pEnd > segEnd) {
            keep.push({
                ...p,
                startTime: segEnd,
                endTime: p.endTime,
                duration: Math.max(1, Math.round((pEnd - segEnd) / 60000))
            });
        }
    });
    parallelHistory = keep;
}

// 已结束并行不应长期停在临时队列里，否则页面会把它错显示在之后的新主线下。
// 优先尊重原 parentId；旧数据父级失效时，再按真实时间重叠补回普通主线。
function settleCompletedParallelHistory() {
    if (!parallelHistory.length) return false;
    const keep = [];
    let changed = false;
    const usedIds = new Set(logs.map((item) => String(item.id)));
    parallelHistory.forEach((parallel) => {
        const end = logEndMs(parallel);
        const directParent = logs.find((item) => !item.parallel && String(item.id) === String(parallel.parentId));
        const directOverlaps = directParent
            && directParent.startTime < end
            && logEndMs(directParent) > parallel.startTime;
        // 常规主线允许跨主线切片；旧 parentId 若已错挂或没有真实重叠，不能阻止按时间找回。
        const candidates = directParent?.sceneActivity && directOverlaps
            ? [directParent]
            : logs.filter((item) => !item.parallel && !item.scene && !item.sceneActivity);
        let remaining = [{ ...parallel, startTime: parallel.startTime, endTime: end }];
        candidates
            .filter((parent) => parent.startTime < end && logEndMs(parent) > parallel.startTime)
            .sort((a, b) => a.startTime - b.startTime)
            .forEach((parent) => {
                const parentEnd = logEndMs(parent);
                const nextRemaining = [];
                remaining.forEach((piece) => {
                    const pieceEnd = logEndMs(piece);
                    const start = Math.max(piece.startTime, parent.startTime);
                    const finish = Math.min(pieceEnd, parentEnd);
                    if (finish <= start) {
                        nextRemaining.push(piece);
                        return;
                    }
                    const duplicate = logs.some((item) => item.parallel
                        && String(item.parentId) === String(parent.id)
                        && item.startTime === start
                        && logEndMs(item) === finish
                        && item.l1 === piece.l1
                        && item.l2 === piece.l2);
                    // 相同区间已有副本时不重复写入；跨多条主线的切片则各自获得唯一 ID。
                    if (!duplicate) {
                        const entryId = usedIds.has(String(piece.id)) ? genId() : piece.id;
                        logs.unshift({
                            ...piece,
                            id: entryId,
                            startTime: start,
                            endTime: finish,
                            duration: Math.max(1, Math.round((finish - start) / 60000)),
                            parallel: true,
                            parentId: parent.id,
                            sceneName: parent.scene ? parent.l2 : (piece.sceneName || ''),
                            note: piece.note || ''
                        });
                        usedIds.add(String(entryId));
                    }
                    if (piece.startTime < start) nextRemaining.push({ ...piece, endTime: start });
                    if (pieceEnd > finish) nextRemaining.push({ ...piece, startTime: finish, endTime: pieceEnd });
                    changed = true;
                });
                remaining = nextRemaining;
            });
        keep.push(...remaining);
    });
    if (changed) {
        parallelHistory = keep;
        localStorage.setItem('v9_logs', JSON.stringify(logs));
        localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
    }
    return changed;
}

function settleParallelForMainSlice(mainLogId, segStart, segEnd, opts) {
    const { continueSame, rollover, endParallel } = opts;
    flushParallelHistoryForSlice(mainLogId, segStart, segEnd);
    if (parallelCurrent) {
        const pStart = Math.max(parallelCurrent.startTime, segStart);
        if (segEnd > pStart) {
            const pDur = Math.max(1, Math.round((segEnd - pStart) / 60000));
            logs.unshift({
                ...parallelCurrent,
                startTime: pStart,
                endTime: segEnd,
                duration: pDur,
                parallel: true,
                parentId: mainLogId,
                note: parallelCurrent.note || ''
            });
        }
        if (continueSame || (rollover && !endParallel)) {
            parallelCurrent = { ...parallelCurrent, id: segEnd + 0.001, startTime: segEnd };
            localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
        } else {
            parallelCurrent = null;
            localStorage.removeItem('v9_parallel');
        }
    }
    localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
}

/** 闭合 current 的一段 [startTime, endMs)；continueSame=true 为日界结转续跑 */
function commitCurrentSlice(endMs, continueSame, parallelOpts) {
    if (!current) return;
    current.startTime = Number(current.startTime);
    if (!Number.isFinite(current.startTime) || endMs <= current.startTime) return;
    const cat = getCat(current.l1);
    const color = current.color || (cat ? cat.color : '#cbd5e1');
    // 当前主线启动时已获得唯一 ID；结束后保留它，子并行的 parentId 无须二次改挂。
    const mainLogId = current.id || genId();
    const dur = Math.max(1, Math.round((endMs - current.startTime) / 60000));
    const needsClassify = !current.l1 && !!(current.note || current.tag);
    logs.unshift({
        ...current,
        id: mainLogId,
        endTime: endMs,
        duration: dur,
        color,
        status: current.l1 ? 'ok' : 'pending'
    });
    if (needsClassify) pendingClassifyLogIds.push(mainLogId);
    if (parallelCurrent && (continueSame || parallelOpts.isMidnightRollover || parallelOpts.endParallel || parallelOpts.rollover)) {
        settleParallelForMainSlice(mainLogId, current.startTime, endMs, {
            continueSame,
            rollover: parallelOpts.rollover,
            endParallel: parallelOpts.endParallel
        });
    } else if (parallelHistory.length) {
        flushParallelHistoryForSlice(mainLogId, current.startTime, endMs);
        localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
    }
    settleCompletedParallelHistory();
    if (continueSame) {
        const nextMainId = genId();
        current = { ...current, id: nextMainId, startTime: endMs };
        if (parallelCurrent) {
            parallelCurrent.parentId = nextMainId;
            localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
        }
        localStorage.setItem('v9_current', JSON.stringify(current));
    }
    localStorage.setItem('v9_logs', JSON.stringify(logs));
}

/** 跨过 0 点：把已结束的自然日逐段写入日志，主线（与并行）从当日 0 点续跑 */
function ensureDayRolloversBefore(now) {
    let changed = false;
    while (current && formatBeijingDate(current.startTime) !== formatBeijingDate(now)) {
        const dayEnd = beijingDateStrToDayEnd(formatBeijingDate(current.startTime));
        commitCurrentSlice(dayEnd, true, { isMidnightRollover: true });
        changed = true;
    }
    if (pendingClassifyLogIds.length) setTimeout(flushUncategorizedClassifyPrompt, 50);
    return changed;
}

function isViewToday() {
    return isDateToday(viewDate);
}

function getViewAnchorMs(dateStr) {
    const d = dateStr || viewDate;
    if (isDateToday(d)) return nowSecondMs();
    return beijingDateStrToDayEnd(d) - 1;
}

function formatDateHeaderLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const wd = new Date(beijingDateStrToDayStart(dateStr) + BJ_OFFSET);
    const w = WEEKDAY_ZH[wd.getUTCDay()];
    return `${y}年${m}月${d}日 星期${w}`;
}

/**
 * 历史版本曾把同一条并行同时存到场景与生活主线。渲染时以真实时间重叠为准，
 * 不再盲信旧 parentId；相同时间、相同活动只展示一次。
 */
function getParallelDisplayRecords(parallelLogs) {
    const mainLogs = logs.filter((item) => !item.parallel);
    const winners = new Map();
    parallelLogs.forEach((parallel) => {
        const start = parallel.startTime;
        const end = logEndMs(parallel);
        let candidates = mainLogs
            .map((main) => ({ main, overlap: Math.max(0, Math.min(logEndMs(main), end) - Math.max(main.startTime, start)) }))
            .filter((item) => item.overlap > 0);
        const directParent = candidates.find((item) => String(item.main.id) === String(parallel.parentId));
        const namedScene = parallel.sceneName
            ? candidates.filter((item) => item.main.scene && item.main.l2 === parallel.sceneName)
            : [];
        if (!directParent && namedScene.length) candidates = namedScene;
        const parent = directParent?.main || candidates.sort((a, b) => b.overlap - a.overlap)[0]?.main || null;
        const parentId = parent?.id || parallel.parentId;
        const key = parallel.id != null
            ? `id:${parallel.id}`
            : [parentId, start, end, parallel.l1 || '', parallel.l2 || '', parallel.icon || ''].join('|');
        const existing = winners.get(key);
        // 同一条旧数据有一份已正确挂在目标主线时，优先保留那一份，便于后续编辑。
        if (!existing || (existing.parentId !== parentId && parallel.parentId === parentId)) {
            parallel._displayParentId = parentId;
            parallel._displayParent = parent;
            winners.set(key, parallel);
        }
    });
    return [...winners.values()];
}

function setViewDate(dateStr) {
    viewDate = dateStr;
    renderCalendarPage();
}

function renderRecordPage() {
    applyClockLayout();
    renderFlow();
    renderHomeHistory();
    renderDayRemain();
}

function renderSceneActivityTree(list, sceneLog, allLogs, parallelLogs) {
    const activities = allLogs
        .filter((item) => item.sceneActivity && String(item.sceneParentId) === getSceneContainerId(sceneLog))
        .sort((a, b) => b.startTime - a.startTime);
    activities.forEach((activity) => {
        const activityWrap = document.createElement('div');
        activityWrap.className = 'log-flow-nest log-flow-scene-activity mt-1 mb-1';
        applySceneNestTheme(activityWrap, sceneLog);
        createLogRow(activityWrap, activity, logs.indexOf(activity));
        list.appendChild(activityWrap);

        parallelLogs
            .filter((child) => child._displayParent === activity)
            .sort((a, b) => a.startTime - b.startTime)
            .forEach((child) => {
                const parallelWrap = document.createElement('div');
                parallelWrap.className = 'log-flow-nest log-flow-true-parallel mt-1 mb-1';
                applySceneNestTheme(parallelWrap, sceneLog);
                createLogRow(parallelWrap, child, logs.indexOf(child));
                list.appendChild(parallelWrap);
            });
    });
    return activities;
}

function renderMainLogTree(list, log, allLogs, parallelLogs) {
    createLogRow(list, log, logs.indexOf(log));
    if (log.scene) return renderSceneActivityTree(list, log, allLogs, parallelLogs);
    parallelLogs
        .filter((child) => child._displayParent === log)
        .sort((a, b) => a.startTime - b.startTime)
        .forEach((child) => {
            const wrap = document.createElement('div');
            wrap.className = 'log-flow-nest mt-1 mb-1';
            applySceneNestTheme(wrap, log);
            createLogRow(wrap, child, logs.indexOf(child));
            list.appendChild(wrap);
        });
    return [];
}

/** 首页流水：今天的实时记录之后，继续显示所有历史日期，编辑入口沿用同一套流水卡片手势。 */
function renderHomeHistory() {
    const list = document.getElementById('log-list');
    if (!list) return;
    renderLogs('log-list', getTodayDateStr());

    const today = getTodayDateStr();
    const historicalDays = [];
    const first = recordMode === 'journal' ? getTrackingStartMs() : null;
    if (first != null) {
        for (let day = beijingDateStrToDayStart(today) - DAY_MS;
            day >= beijingDateStrToDayStart(formatBeijingDate(first)); day -= DAY_MS) {
            historicalDays.push(formatBeijingDate(day));
        }
    } else {
        historicalDays.push(...[...collectLogCalendarDays()].filter((dateStr) => dateStr < today).sort((a, b) => b.localeCompare(a)));
    }

    historicalDays.forEach((dateStr) => {
        const dayLogs = logs.filter((log) => logTouchesDate(log, dateStr));
        list.appendChild(buildLogDayHeader(dateStr, true, false));

        const normalLogs = dayLogs
            .filter((log) => !log.parallel && !log.sceneActivity)
            .sort((a, b) => b.startTime - a.startTime);
        const parallelLogs = getParallelDisplayRecords(dayLogs.filter((log) => log.parallel));
        renderDayMainRows(list, dateStr, normalLogs, dayLogs, parallelLogs);
        appendUnattachedParallelLogs(list, parallelLogs, normalLogs.concat(dayLogs.filter((log) => log.sceneActivity)));
    });
}

function getDayUnassignedSegments(dateStr, now = nowSecondMs(), extraMain = []) {
    const dayStart = beijingDateStrToDayStart(dateStr);
    const dayEnd = Math.min(dayStart + DAY_MS, now);
    if (recordMode !== 'journal' || dayEnd <= dayStart) return [];
    const entries = logs.filter((log) => !log.parallel && !log.sceneActivity && logTouchesDate(log, dateStr)).concat(extraMain);
    if (current && current.startTime < dayEnd) entries.push({ ...current, endTime: now });
    const segments = entries.map((log) => ({
        clippedStart: Math.max(dayStart, log.startTime),
        clippedEnd: Math.min(dayEnd, logEndMs(log)),
    }));
    return getUnrecordedSegments(segments, dayStart, dayStart + DAY_MS, now)
        .map((gap) => ({ start: gap.startTime, end: gap.endTime }));
}

function getActiveUnassignedSegment(dateStr = getTodayDateStr(), now = nowSecondMs()) {
    if (current || recordMode !== 'journal') return null;
    const gaps = getDayUnassignedSegments(dateStr, now);
    return gaps.find((gap) => gap.end === now) || null;
}

function unassignedScopeEnd(dateStr, gap, now = nowSecondMs()) {
    return dateStr === formatBeijingDate(now) && !current && gap.end === now
        ? beijingDateStrToDayStart(dateStr) + DAY_MS
        : gap.end;
}

function assignUnlocatedToGaps(dateStr, gaps, records = unlocatedLogs) {
    const byGap = gaps.map(() => []);
    const used = gaps.map(() => 0);
    const unplaced = [];
    const items = records.filter((item) => item.date === dateStr)
        .sort((a, b) => Number(b.gapStart != null) - Number(a.gapStart != null));
    items.forEach((item) => {
        const choices = gaps.map((gap, index) => ({ gap, index }))
            .filter(({ gap, index }) => gap.end - gap.start - used[index] >= item.durationMs
                && (item.gapEnd == null || (gap.start >= item.gapStart && gap.end <= item.gapEnd)))
            .sort((a, b) => {
                const aPreferred = item.gapStart != null && (a.gap.start === item.gapStart || a.gap.start <= item.gapStart && a.gap.end > item.gapStart);
                const bPreferred = item.gapStart != null && (b.gap.start === item.gapStart || b.gap.start <= item.gapStart && b.gap.end > item.gapStart);
                return Number(bPreferred) - Number(aPreferred) || b.gap.start - a.gap.start;
            });
        const picked = choices[0];
        if (!picked) { unplaced.push(item); return; }
        byGap[picked.index].push(item);
        used[picked.index] += item.durationMs;
    });
    return { byGap, unplaced };
}

function getAllocatedInGap(dateStr, gap) {
    const gaps = getDayUnassignedSegments(dateStr);
    const index = gaps.findIndex((item) => item.start === gap.start);
    return (assignUnlocatedToGaps(dateStr, gaps).byGap[index] || []).reduce((sum, item) => sum + item.durationMs, 0);
}

function buildLogDayHeader(dateStr, history = false, withControl = true) {
    const header = document.createElement('div');
    header.className = `log-day-header${history ? ' log-day-header--history' : ''}`;
    const label = document.createElement('span');
    label.innerText = formatDateHeaderLabel(dateStr);
    header.appendChild(label);
    if (recordMode === 'journal' && withControl) {
        const control = document.createElement('label');
        control.className = 'unassigned-visibility';
        const caption = document.createElement('span');
        caption.innerText = showUnassignedMain ? '主线' : '隐藏';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = showUnassignedMain;
        input.setAttribute('aria-label', '显示未分配主线');
        input.addEventListener('change', () => {
            showUnassignedMain = input.checked;
            localStorage.setItem('v9_show_unassigned_main', String(showUnassignedMain));
            renderHomeHistory();
        });
        control.append(caption, input);
        header.appendChild(control);
    }
    return header;
}

function renderUnassignedMain(list, dateStr, gap, assigned = [], live = false) {
    if (recordMode !== 'journal' || (!showUnassignedMain && !live && !assigned.length)) return;
    const allocatedMs = assigned.reduce((sum, item) => sum + item.durationMs, 0);
    const spanMs = gap.end - gap.start;
    const wrap = document.createElement('div');
    wrap.className = `swipe-wrap${live ? ' unassigned-live-wrap' : ''}`;
    const leftActions = document.createElement('div');
    leftActions.className = 'swipe-actions left';
    const deleteAction = document.createElement('div');
    deleteAction.className = 'swipe-action-btn delete';
    deleteAction.innerText = '删除';
    leftActions.appendChild(deleteAction);
    const rightActions = document.createElement('div');
    rightActions.className = 'swipe-actions right';
    const editAction = document.createElement('div');
    editAction.className = 'swipe-action-btn edit';
    editAction.innerText = '编辑';
    rightActions.appendChild(editAction);
    wrap.append(leftActions, rightActions);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `unassigned-main-card swipe-card log-flow-card--main-log log-flow-card--unassigned-main${live ? ' unassigned-main-card--live' : ''}`;
    card.setAttribute('aria-label', `${formatDateHeaderLabel(dateStr)}未分配主线，补录`);
    let startX = 0, startY = 0, swiping = false, dx = 0, suppressClick = false;
    card.addEventListener('touchstart', (event) => {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        swiping = false;
        dx = 0;
    }, { passive: true });
    card.addEventListener('touchmove', (event) => {
        const x = event.touches[0].clientX - startX;
        const y = event.touches[0].clientY - startY;
        if (!swiping && Math.abs(x) > Math.abs(y) && Math.abs(x) > 10) swiping = true;
        if (!swiping) return;
        event.preventDefault();
        dx = Math.max(-80, Math.min(80, x));
        card.style.transform = `translateX(${dx}px)`;
    }, { passive: false });
    card.addEventListener('touchend', () => {
        card.style.transform = '';
        if (swiping) {
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 350);
            if (dx > 55) requestDeleteUnassignedGap(dateStr, gap.start);
            else if (dx < -55) openUnassignedEdit(dateStr, gap.start);
        }
        swiping = false;
        dx = 0;
    }, { passive: true });
    card.addEventListener('click', () => {
        if (suppressClick) { suppressClick = false; return; }
        openUnassignedBackfill(dateStr, gap.start);
    });
    const inner = document.createElement('div');
    inner.className = 'log-flow-inner';
    inner.appendChild(buildLogFlowBar('#94a3b8', false));
    const body = document.createElement('div');
    body.className = 'log-flow-body';
    const row = document.createElement('div');
    row.className = 'log-flow-main';
    const time = document.createElement('span');
    time.className = 'log-flow-time';
    time.innerText = formatBeijingClockSec(gap.start);
    const parts = document.createElement('span');
    parts.className = 'unassigned-main-parts';
    assigned.forEach((item) => {
        const part = document.createElement('span');
        part.className = 'unassigned-main-part';
        part.style.width = `${item.durationMs / spanMs * 100}%`;
        part.style.backgroundColor = safeColor(getCat(item.l1)?.color || '#94a3b8');
        part.title = `${item.l2 || item.l1} ${formatDuration(item.durationMs)}（未指定时段）`;
        const name = document.createElement('span');
        name.innerText = item.l2 || item.l1;
        part.appendChild(name);
        parts.appendChild(part);
    });
    const remaining = document.createElement('span');
    remaining.className = 'unassigned-main-part unassigned-main-part--empty';
    remaining.style.width = `${Math.max(0, (spanMs - allocatedMs) / spanMs) * 100}%`;
    remaining.title = `未分配 ${formatDuration(Math.max(0, spanMs - allocatedMs))}`;
    const remainingName = document.createElement('span');
    remainingName.innerText = '未分配';
    remaining.appendChild(remainingName);
    parts.appendChild(remaining);
    const duration = document.createElement('span');
    duration.className = `log-flow-dur ${live ? 'log-flow-dur--live' : 'log-flow-dur--log'}`;
    if (live) duration.id = 'live-unassigned-duration';
    duration.innerText = formatDuration(spanMs);
    row.append(time, parts, duration);
    body.appendChild(row);
    inner.appendChild(body);
    card.appendChild(inner);
    wrap.appendChild(card);
    if (live) {
        const eventButton = document.createElement('button');
        eventButton.type = 'button';
        eventButton.className = 'log-event-btn unassigned-live-event-btn';
        eventButton.textContent = '＋';
        eventButton.title = '记录事件';
        eventButton.setAttribute('aria-label', '记录事件');
        eventButton.addEventListener('click', () => openEventModal());
        wrap.appendChild(eventButton);
    }
    list.appendChild(wrap);
}

function renderDayMainRows(list, dateStr, normalLogs, dayLogs, parallelLogs, skipGapStart = null) {
    const now = nowSecondMs();
    const gaps = getDayUnassignedSegments(dateStr, now);
    const assignments = assignUnlocatedToGaps(dateStr, gaps);
    const rows = normalLogs.map((log) => ({ start: log.startTime, log }))
        .concat(gaps.map((gap, index) => ({ start: gap.start, gap, assigned: assignments.byGap[index] || [] }))
            .filter((row) => row.gap.start !== skipGapStart))
        .sort((a, b) => b.start - a.start);
    rows.forEach((row) => {
        if (row.log) renderMainLogTree(list, row.log, dayLogs, parallelLogs);
        else renderUnassignedMain(list, dateStr, row.gap, row.assigned);
    });
    if (recordMode === 'journal') {
        assignments.unplaced.forEach((item) => {
            const pending = document.createElement('button');
            pending.type = 'button';
            pending.className = 'unassigned-pending';
            pending.innerText = `${item.l2 || item.l1} ${formatDuration(item.durationMs)} · 待选择未分配时段`;
            pending.addEventListener('click', () => { viewDate = dateStr; editCalendarSupplement('untimed', item.id); });
            list.appendChild(pending);
        });
    }
}

function renderCalendarPage() {
    renderFlowCalendar();
    renderCalendarDaySummary();
    renderLogs('calendar-log-list', viewDate);
    renderCalendarBackfillRecords();
}

function getMainOccupiedMsForDay(dateStr, excludeId = null, now = nowSecondMs()) {
    const dayStart = beijingDateStrToDayStart(dateStr);
    const dayEnd = dayStart + DAY_MS;
    const intervals = logs.filter((item) => !item.parallel && !item.sceneActivity && (excludeId == null || item.id !== excludeId))
        .concat(current && (excludeId == null || current.id !== excludeId) ? [{ ...current, endTime: now }] : [])
        .map((item) => ({ start: Math.max(dayStart, item.startTime), end: Math.min(dayEnd, logEndMs(item)) }))
        .filter((item) => item.end > item.start)
        .sort((a, b) => a.start - b.start);
    let covered = 0;
    let end = dayStart;
    intervals.forEach((item) => {
        covered += Math.max(0, item.end - Math.max(end, item.start));
        end = Math.max(end, item.end);
    });
    return covered;
}

function getUnlocatedMsForDay(dateStr, excludeId = null) {
    return unlocatedLogs.filter((item) => item.date === dateStr && (excludeId == null || item.id !== excludeId))
        .reduce((sum, item) => sum + item.durationMs, 0);
}

function getRemainingDayMs(dateStr, excludeId = null, now = nowSecondMs()) {
    const dayStart = beijingDateStrToDayStart(dateStr);
    const elapsed = Math.max(0, Math.min(DAY_MS, now - dayStart));
    return elapsed - getMainOccupiedMsForDay(dateStr, excludeId, now) - getUnlocatedMsForDay(dateStr, excludeId);
}

function intervalExceedsDayBudget(start, end, excludeId = null, now = nowSecondMs()) {
    for (let day = beijingDateStrToDayStart(formatBeijingDate(start)); day < end; day += DAY_MS) {
        const date = formatBeijingDate(day);
        const added = Math.max(0, Math.min(day + DAY_MS, end) - Math.max(day, start));
        if (added > getRemainingDayMs(date, excludeId, now)) return true;
    }
    return false;
}

function getCalendarDaySummary(dateStr) {
    const dayStart = beijingDateStrToDayStart(dateStr);
    const dayEnd = dayStart + DAY_MS;
    const live = isDateToday(dateStr) && current ? [{ ...current, endTime: nowSecondMs(), live: true }] : [];
    const segments = logs.filter(l => !l.parallel && !l.sceneActivity).concat(live).flatMap(log => {
        const end = logEndMs(log, log.live ? nowSecondMs() : null);
        const start = Math.max(dayStart, log.startTime);
        const finish = Math.min(dayEnd, end);
        return finish > start ? [{ log, start, end: finish }] : [];
    });
    const byCategory = new Map();
    segments.forEach(({ log, start, end }) => {
        const key = log.l1 || '未分类';
        const item = byCategory.get(key) || { name: key, ms: 0, color: getCat(key)?.color || '#94a3b8' };
        item.ms += end - start;
        byCategory.set(key, item);
    });
    const unlocated = unlocatedLogs.filter((item) => item.date === dateStr);
    unlocated.forEach((record) => {
        const key = record.l1 || '未分类';
        const item = byCategory.get(key) || { name: key, ms: 0, color: getCat(key)?.color || '#94a3b8' };
        item.ms += record.durationMs;
        byCategory.set(key, item);
    });
    return {
        totalMs: segments.reduce((sum, item) => sum + item.end - item.start, 0) + unlocated.reduce((sum, item) => sum + item.durationMs, 0),
        count: segments.length + unlocated.length + eventRecords.filter((item) => formatBeijingDate(item.occurredAt) === dateStr).length,
        categories: [...byCategory.values()].sort((a, b) => b.ms - a.ms)
    };
}

function renderCalendarDaySummary() {
    const host = document.getElementById('calendar-day-summary');
    if (!host) return;
    const summary = getCalendarDaySummary(viewDate);
    const dateLabel = formatDateHeaderLabel(viewDate);
    const total = formatDuration(summary.totalMs);
    const categories = summary.categories.slice(0, 6).map(item => `
        <span class="calendar-summary-chip">
            <i style="background:${safeColor(item.color)}"></i>${escHtml(item.name)} ${formatDuration(item.ms)}
        </span>`).join('');
    host.innerHTML = `
        <div class="calendar-summary-top">
            <div><span class="calendar-summary-kicker">当天复盘</span><strong>${dateLabel}</strong></div>
            <div class="calendar-summary-total"><b>${total}</b><span>${summary.count} 项记录</span></div>
        </div>
        <div class="calendar-summary-chips">${categories || '<span class="calendar-summary-empty">暂无时间记录</span>'}</div>
        <div class="calendar-summary-footer"><span>当天流水</span><button type="button" onclick="openCalendarBackfill(null, 'calendar-add')" aria-label="补录" title="补录">＋</button></div>`;
}

let calendarBackfillKind = null;
let calendarBackfillEditingId = null;
let calendarBackfillTarget = null;
let calendarBackfillFromCalendar = false;
const CALENDAR_BACKFILL_ORIGINS = new Set(['calendar-add', 'unassigned-gap', 'supplement-edit']);
function getCalendarBackfillBlockAddress(kind) {
    const hasTarget = !!calendarBackfillTarget;
    if (kind === 'event') return 'B47';
    if (kind === 'interval') return hasTarget
        ? (calendarBackfillFromCalendar ? 'B12' : 'B58')
        : 'B59';
    if (kind === 'untimed') return hasTarget
        ? (calendarBackfillFromCalendar ? 'B46' : 'B60')
        : 'B61';
    if (recordMode === 'journal' && !hasTarget) return 'B55';
    if (hasTarget) return calendarBackfillFromCalendar ? 'B11' : 'B56';
    return 'B57';
}

function setDrawerDevAddress(code) {
    const drawer = document.getElementById('drawer');
    if (drawer) drawer.dataset.devAddressBlock = code;
}

function openUnassignedBackfill(dateStr, gapStart) {
    const gap = getDayUnassignedSegments(dateStr).find((item) => item.start === gapStart);
    if (!gap) return;
    viewDate = dateStr;
    openCalendarBackfill(gap, 'unassigned-gap');
}

function getUnassignedMergeNeighbors(dateStr, gap) {
    const sameDay = logs.filter((item) => !item.parallel && !item.sceneActivity
        && formatBeijingDate(item.startTime) === dateStr);
    return {
        up: (current && formatBeijingDate(current.startTime) === dateStr && current.startTime === gap.end ? current : null)
            || sameDay.find((item) => item.startTime === gap.end) || null,
        down: sameDay.find((item) => logEndMs(item) === gap.start) || null,
    };
}

function requestDeleteUnassignedGap(dateStr, gapStart) {
    const gaps = getDayUnassignedSegments(dateStr);
    const index = gaps.findIndex((item) => item.start === gapStart);
    if (index < 0) return;
    const gap = gaps[index];
    const assigned = assignUnlocatedToGaps(dateStr, gaps).byGap[index] || [];
    if (assigned.length || unlocatedLogs.some((item) => item.date === dateStr && item.gapStart === gapStart)) {
        showConfirm('不能删除未分配', '这段时间已有补录活动，请先删除活动，再删除未分配主线。', '知道了', () => {});
        return;
    }
    if (getActiveUnassignedSegment(dateStr)?.start === gapStart) {
        showConfirm('正在进行中', '请先开始下一条主线，待这段未分配时间结束后再删除。', '知道了', () => {});
        return;
    }
    const neighbors = getUnassignedMergeNeighbors(dateStr, gap);
    if (!neighbors.up && !neighbors.down) {
        showConfirm('无法删除未分配', '这段时间没有可并入的相邻主线，须保留它才能维持 24 小时。', '知道了', () => {});
        return;
    }
    showConfirm('确认删除', '删除这段未分配时间？时间会并入你选择的相邻主线。', '删除', (ok) => {
        if (!ok) return;
        showMergeDirection({ l2: '未分配' }, (direction) => {
            if (!direction) return;
            const latestGaps = getDayUnassignedSegments(dateStr);
            const latestIndex = latestGaps.findIndex((item) => item.start === gapStart);
            const latest = latestGaps[latestIndex];
            if (!latest || latest.end !== gap.end) return;
            if ((assignUnlocatedToGaps(dateStr, latestGaps).byGap[latestIndex] || []).length
                || unlocatedLogs.some((item) => item.date === dateStr && item.gapStart === gapStart)) return;
            const neighbor = getUnassignedMergeNeighbors(dateStr, latest)[direction];
            if (!neighbor) return;
            if (direction === 'up') neighbor.startTime = latest.start;
            else neighbor.endTime = latest.end;
            if (neighbor === current) localStorage.setItem('v9_current', JSON.stringify(current));
            else {
                neighbor.duration = Math.round((logEndMs(neighbor) - neighbor.startTime) / 60000);
                localStorage.setItem('v9_logs', JSON.stringify(logs));
            }
            renderAll();
        }, neighbors);
    });
}

function openUnassignedEdit(dateStr, gapStart) {
    const gap = getDayUnassignedSegments(dateStr).find((item) => item.start === gapStart);
    if (!gap) return;
    const live = getActiveUnassignedSegment(dateStr)?.start === gapStart;
    editTarget = { source: 'unassigned', dateStr, gapStart, live };
    document.getElementById('edit-modal').dataset.devAddressBlock = 'B54';
    editOldL1 = null;
    editOldL2 = null;
    document.getElementById('edit-log-preview').innerText = `未分配 — ${formatDuration(gap.end - gap.start)}`;
    setTimeInFields('es', new Date(gap.start));
    const endsAtMidnight = gap.end === beijingDateStrToDayEnd(dateStr);
    setTimeInFields('ee', new Date(gap.end), { show24: endsAtMidnight });
    ['ee-h', 'ee-m', 'ee-s'].forEach((id) => {
        const field = document.getElementById(id);
        field.disabled = live;
        field.classList.toggle('opacity-40', live);
    });
    document.getElementById('edit-end-label').innerText = live ? '实时结束' : '结束';
    document.getElementById('edit-parallel-date-row').classList.add('hidden');
    document.getElementById('edit-continue-previous').classList.add('hidden');
    document.getElementById('edit-current-backfill').classList.add('hidden');
    document.getElementById('edit-note-input').value = '';
    updateEditCatDisplay(null, null);
    document.getElementById('edit-modal').classList.remove('hidden');
}

function openCalendarBackfill(target = null, origin = 'calendar-add') {
    if (viewDate > getTodayDateStr()) return;
    if (!CALENDAR_BACKFILL_ORIGINS.has(origin)) throw new Error(`Unregistered calendar backfill origin: ${origin}`);
    calendarBackfillFromCalendar = !target;
    calendarBackfillTarget = target;
    calendarBackfillEditingId = null;
    document.getElementById('calendar-backfill-date-label').innerText = formatDateHeaderLabel(viewDate);
    document.querySelectorAll('#calendar-backfill-options .journal-only').forEach((button) => button.classList.toggle('hidden', recordMode !== 'journal'));
    document.querySelector('#calendar-backfill-options button:last-child').classList.toggle('hidden', !calendarBackfillFromCalendar);
    document.getElementById('calendar-backfill-options').classList.toggle('calendar-backfill-options--target', !!calendarBackfillTarget);
    showCalendarBackfillForm(null);
    document.getElementById('calendar-backfill-modal').classList.remove('hidden');
}

function closeCalendarBackfill() {
    document.getElementById('calendar-backfill-modal').classList.add('hidden');
    calendarBackfillKind = null;
    calendarBackfillEditingId = null;
    calendarBackfillTarget = null;
    calendarBackfillFromCalendar = false;
}

function getGapAvailableMs(dateStr, gap) {
    return Math.max(0, gap.end - gap.start - getAllocatedInGap(dateStr, gap));
}

function formatBackfillGapClock(dateStr, ms) {
    return ms === beijingDateStrToDayStart(dateStr) + DAY_MS ? '24:00:00' : formatBeijingClockSec(ms);
}

function renderCalendarBackfillTargets() {
    const host = document.getElementById('calendar-backfill-target-picker');
    host.replaceChildren();
    const title = document.createElement('div');
    title.className = 'calendar-backfill-target-heading';
    title.innerText = '选择归属时段';
    host.appendChild(title);
    const gaps = getDayUnassignedSegments(viewDate)
        .filter((gap) => getGapAvailableMs(viewDate, gap) > 0)
        .sort((a, b) => a.start - b.start);
    gaps.forEach((gap) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'calendar-backfill-target-choice';
        const times = document.createElement('span');
        times.className = 'calendar-backfill-target-times';
        times.innerText = `${formatBeijingClockSec(gap.start)} — ${formatBackfillGapClock(viewDate, gap.end)}`;
        const remaining = document.createElement('span');
        remaining.className = 'calendar-backfill-target-available';
        remaining.innerText = `可分配 ${formatDuration(getGapAvailableMs(viewDate, gap))}`;
        button.append(times, remaining);
        button.addEventListener('click', () => {
            calendarBackfillTarget = getDayUnassignedSegments(viewDate).find((item) => item.start === gap.start) || null;
            if (calendarBackfillTarget) showCalendarBackfillForm(null);
        });
        host.appendChild(button);
    });
    if (!gaps.length) {
        const empty = document.createElement('p');
        empty.className = 'calendar-backfill-target-empty';
        empty.innerText = '当天没有可补录的未分配时段。';
        host.appendChild(empty);
    }
    if (calendarBackfillFromCalendar) {
        const eventButton = document.createElement('button');
        eventButton.type = 'button';
        eventButton.className = 'calendar-backfill-event-choice';
        eventButton.innerText = '补录事件次数';
        eventButton.addEventListener('click', () => showCalendarBackfillForm('event'));
        host.appendChild(eventButton);
    }
}

function showCalendarBackfillTargets() {
    calendarBackfillTarget = null;
    showCalendarBackfillForm(null);
}

function fillCalendarBackfillSelect(id, items) {
    const select = document.getElementById(id);
    select.replaceChildren();
    items.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.innerText = label;
        select.appendChild(option);
    });
}

function updateCalendarBackfillCategory() {
    const l1 = document.getElementById('calendar-backfill-l1').value;
    const l2 = document.getElementById('calendar-backfill-l2').value;
    const cat = getCat(l1);
    document.getElementById('calendar-backfill-category-button').firstChild.textContent = cat
        ? `${cat.icon || ''} ${l2 || l1}` : '选择活动 ';
}

function openCalendarBackfillCategoryPicker() {
    pickerMode = 'calendar-backfill';
    setDrawerDevAddress('B68');
    document.getElementById('drawer-title').innerText = '选择活动';
    document.getElementById('drawer-footer').classList.add('hidden');
    document.getElementById('calendar-backfill-modal').classList.add('hidden');
    showDrawer();
    renderPicker();
    renderDrawerToggle();
}

function sanitizeCalendarDurationInput(input, max) {
    const digits = input.value.replace(/\D/g, '').slice(0, 2);
    input.value = digits === '' ? '' : String(Math.min(Number(digits), max));
}

function sanitizeCalendarClockInput(input, max) {
    const digits = input.value.replace(/\D/g, '').slice(0, 2);
    input.value = digits === '' ? '' : Number(digits) > max ? String(max) : digits;
}

function normalizeCalendarClockInput(input) {
    if (input.value !== '') input.value = input.value.padStart(2, '0');
}

function initCalendarBackfillClockFields() {
    document.querySelectorAll('.calendar-backfill-time-parts input').forEach((input) => {
        const max = input.id.endsWith('-h')
            ? (input.id.startsWith('calendar-backfill-end-') ? 24 : 23)
            : 59;
        initTimeField(input, max);
    });
}

function readCalendarBackfillClock(prefix, dayStart, allow24 = false) {
    const parts = ['h', 'm', 's'].map((part) => document.getElementById(`${prefix}-${part}`).value.trim());
    if (parts.some((part) => !/^\d{1,2}$/.test(part))) return null;
    const [h, m, s] = parts.map(Number);
    if (m > 59 || s > 59 || h > 24 || (h === 24 && (!allow24 || m || s))) return null;
    return dayStart + (h * 3600 + m * 60 + s) * 1000;
}

function getCalendarBackfillInterval() {
    const dayStart = beijingDateStrToDayStart(viewDate);
    const start = readCalendarBackfillClock('calendar-backfill-start', dayStart);
    let end = readCalendarBackfillClock('calendar-backfill-end', dayStart, true);
    if (start != null && end != null && end <= start) end += DAY_MS;
    return { start, end, dayStart };
}

function updateCalendarBackfillEndDayHint() {
    const { start, end, dayStart } = getCalendarBackfillInterval();
    document.getElementById('calendar-backfill-end-day-hint').classList.toggle('hidden',
        start == null || end == null || end < dayStart + DAY_MS);
}

function showCalendarBackfillForm(kind) {
    if (kind && kind !== 'event' && recordMode !== 'journal') return;
    const blockCode = getCalendarBackfillBlockAddress(kind);
    document.getElementById('calendar-backfill-modal').dataset.devAddressBlock = blockCode;
    calendarBackfillKind = kind;
    const pickingTarget = !kind && recordMode === 'journal' && !calendarBackfillTarget;
    document.getElementById('calendar-backfill-target-picker').classList.toggle('hidden', !pickingTarget);
    if (pickingTarget) renderCalendarBackfillTargets();
    document.getElementById('calendar-backfill-options').classList.toggle('hidden', !!kind || pickingTarget);
    document.getElementById('calendar-backfill-options').classList.toggle('calendar-backfill-options--target', !!calendarBackfillTarget);
    const targetRow = document.getElementById('calendar-backfill-target-row');
    targetRow.classList.toggle('hidden', !calendarBackfillTarget || kind === 'event');
    if (calendarBackfillTarget) {
        document.getElementById('calendar-backfill-target-label').innerText = `归属 ${formatBeijingClockSec(calendarBackfillTarget.start)}—${formatBackfillGapClock(viewDate, calendarBackfillTarget.end)}`;
        document.getElementById('calendar-backfill-change-target').classList.toggle('hidden', !calendarBackfillFromCalendar);
    }
    document.getElementById('calendar-backfill-form').classList.toggle('hidden', !kind);
    document.getElementById('calendar-backfill-category-fields').classList.toggle('hidden', !kind || kind === 'event');
    document.getElementById('calendar-backfill-event-fields').classList.toggle('hidden', kind !== 'event');
    document.getElementById('calendar-backfill-interval-fields').classList.toggle('hidden', kind !== 'interval');
    document.getElementById('calendar-backfill-untimed-fields').classList.toggle('hidden', kind !== 'untimed');
    document.getElementById('calendar-backfill-note-field').classList.toggle('hidden', !kind || kind === 'event');
    renderUnassignedBackfillActivities();
    if (!kind) return;
    if (kind === 'event') {
        fillCalendarBackfillSelect('calendar-backfill-event-type', eventTypes.filter(item => !item.disabled).map((item) => ({ value: String(item.id), label: `${item.icon} ${item.name}` })));
        document.getElementById('calendar-backfill-event-count').value = '1';
    } else {
        document.getElementById('calendar-backfill-l1').value = '';
        document.getElementById('calendar-backfill-l2').value = '';
        updateCalendarBackfillCategory();
        document.getElementById('calendar-backfill-note').value = '';
        if (kind === 'interval') {
            const dayStart = beijingDateStrToDayStart(viewDate);
            const start = calendarBackfillTarget ? calendarBackfillTarget.start : dayStart + 9 * HOUR_MS;
            const end = calendarBackfillTarget ? calendarBackfillTarget.end : dayStart + 10 * HOUR_MS;
            setTimeInFields('calendar-backfill-start', new Date(start));
            setTimeInFields('calendar-backfill-end', new Date(end), { show24: end === dayStart + DAY_MS });
            updateCalendarBackfillEndDayHint();
        } else {
            document.getElementById('calendar-backfill-hours').value = '0';
            document.getElementById('calendar-backfill-minutes').value = '0';
            const targetRemaining = calendarBackfillTarget
                ? calendarBackfillTarget.end - calendarBackfillTarget.start - getAllocatedInGap(viewDate, calendarBackfillTarget)
                : getRemainingDayMs(viewDate);
            document.getElementById('calendar-backfill-remaining').innerText = `可分配 ${formatDuration(Math.max(0, targetRemaining))}`;
        }
    }
}

function saveCalendarBackfill() {
    if (calendarBackfillKind !== 'event' && recordMode !== 'journal') return;
    if (calendarBackfillKind === 'event') {
        const typeId = document.getElementById('calendar-backfill-event-type').value;
        const count = Number(document.getElementById('calendar-backfill-event-count').value);
        if (!eventTypeById(typeId) || !Number.isInteger(count) || count < 1 || count > 999) {
            showConfirm('事件资料不完整', '请选择事件，并输入 1 到 999 的次数。', '知道了', () => {});
            return;
        }
        const record = eventRecords.find((item) => item.id === calendarBackfillEditingId);
        if (record) {
            const type = eventTypeById(typeId);
            Object.assign(record, { typeId: type.id, typeName: type.name, icon: type.icon, color: type.color, count });
            saveEventRecords();
        } else {
            saveEventRecord({ typeId, occurredAt: beijingDateStrToDayStart(viewDate), parentId: null, count, dateOnly: true });
        }
    } else if (calendarBackfillKind === 'untimed') {
        const hours = Number(document.getElementById('calendar-backfill-hours').value);
        const minutes = Number(document.getElementById('calendar-backfill-minutes').value);
        const durationMs = (hours * 60 + minutes) * 60000;
        const l1 = document.getElementById('calendar-backfill-l1').value;
        const l2 = document.getElementById('calendar-backfill-l2').value;
        if (!getCat(l1) || !Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59 || durationMs <= 0 || durationMs > DAY_MS) {
            showConfirm('时长不合法', '请输入大于 0 且不超过 24 小时的时长。', '知道了', () => {});
            return;
        }
        const gap = calendarBackfillTarget
            ? getDayUnassignedSegments(viewDate).find((item) => item.start === calendarBackfillTarget.start)
            : null;
        const candidate = { id: calendarBackfillEditingId || genId(), date: viewDate, durationMs, l1, l2,
            note: document.getElementById('calendar-backfill-note').value.trim(), ...(gap ? { gapStart: gap.start, gapEnd: unassignedScopeEnd(viewDate, gap) } : {}) };
        const existingRecords = unlocatedLogs.filter((item) => item.id !== calendarBackfillEditingId);
        const nextRecords = existingRecords.concat(candidate);
        const gaps = getDayUnassignedSegments(viewDate);
        const before = assignUnlocatedToGaps(viewDate, gaps, existingRecords);
        const assignments = assignUnlocatedToGaps(viewDate, gaps, nextRecords);
        const assignedIndex = assignments.byGap.findIndex((items) => items.includes(candidate));
        if (durationMs > getRemainingDayMs(viewDate, calendarBackfillEditingId) || (calendarBackfillTarget && !gap)
            || assignedIndex < 0 || (gap && gaps[assignedIndex].start !== gap.start)
            || assignments.unplaced.some((item) => item !== candidate && !before.unplaced.includes(item))) {
            showConfirm('时间总数不够分配', '当天已有的时间段和未指定时长合计不能超过可用时间。', '知道了', () => {});
            return;
        }
        const record = unlocatedLogs.find((item) => item.id === calendarBackfillEditingId);
        const update = { ...candidate, gapStart: gaps[assignedIndex].start,
            gapEnd: unassignedScopeEnd(viewDate, gaps[assignedIndex]) };
        if (record) Object.assign(record, update);
        else unlocatedLogs.push(update);
        localStorage.setItem('v9_unlocated_logs', JSON.stringify(unlocatedLogs));
    } else if (calendarBackfillKind === 'interval') {
        const { start, end, dayStart } = getCalendarBackfillInterval();
        if (start == null || end == null || start < dayStart || start >= dayStart + DAY_MS || start >= end || end - start > DAY_MS || end > nowSecondMs()) {
            showConfirm('时间不合法', '开始时间须在所选日期，结束时间须在其后 24 小时内且已经过去。', '知道了', () => {});
            return;
        }
        if (calendarBackfillTarget) {
            const gap = getDayUnassignedSegments(viewDate).find((item) => item.start === calendarBackfillTarget.start);
            if (!gap || start < gap.start || end > gap.end) {
                showConfirm('时间总数不够分配', '请在未分配时段内补录，并保留已分配但未指定时刻的时长。', '知道了', () => {});
                return;
            }
            const reservedMs = getAllocatedInGap(viewDate, gap);
            if (end - start > gap.end - gap.start - reservedMs) {
                showConfirm('有时间已被占用', `这条未分配主线已有 ${formatDuration(reservedMs)} 的补录，请缩短所选时段并为它留出时间。`, '知道了', () => {});
                return;
            }
        }
        const conflict = mainRecordOverlaps(start, end)[0];
        if (conflict) {
            showConfirm('时间段发生重叠', `这段时间与「${displayName(conflict)}」重叠。`, '知道了', () => {});
            return;
        }
        if (intervalExceedsDayBudget(start, end)) {
            showConfirm('时间总数不够分配', '指定时段会占用当天剩余时间，请先调整未指定时长。', '知道了', () => {});
            return;
        }
        const scopedRecords = unlocatedLogs.map((item) => ({ ...item }));
        for (let day = beijingDateStrToDayStart(formatBeijingDate(start)); day < end; day += DAY_MS) {
            const date = formatBeijingDate(day);
            const beforeGaps = getDayUnassignedSegments(date);
            const before = assignUnlocatedToGaps(date, beforeGaps, scopedRecords);
            before.byGap.forEach((items, index) => items.forEach((item) => {
                item.gapStart = beforeGaps[index].start;
                item.gapEnd = unassignedScopeEnd(date, beforeGaps[index]);
            }));
            const after = assignUnlocatedToGaps(date, getDayUnassignedSegments(date, nowSecondMs(), [{ startTime: start, endTime: end }]), scopedRecords);
            if (after.unplaced.length > before.unplaced.length) {
                showConfirm('时间总数不够分配', '这段补录会挤掉该未分配时段内已分配的活动，请缩短时段。', '知道了', () => {});
                return;
            }
        }
        const l1 = document.getElementById('calendar-backfill-l1').value;
        const l2 = document.getElementById('calendar-backfill-l2').value;
        if (!getCat(l1)) {
            showConfirm('请选择活动', '补录前先选择一项活动。', '知道了', () => {});
            return;
        }
        logs.unshift({ id: genId(), startTime: start, endTime: end, duration: Math.round((end - start) / 60000), l1, l2, note: document.getElementById('calendar-backfill-note').value.trim(), color: getCat(l1).color, parallel: false, journal: true });
        localStorage.setItem('v9_logs', JSON.stringify(logs));
        unlocatedLogs = scopedRecords;
        localStorage.setItem('v9_unlocated_logs', JSON.stringify(unlocatedLogs));
    } else return;
    closeCalendarBackfill();
    renderAll();
}

function editCalendarSupplement(kind, id) {
    const record = kind === 'event' ? eventRecords.find((item) => item.id === id) : unlocatedLogs.find((item) => item.id === id);
    if (!record) return;
    openCalendarBackfill(null, 'supplement-edit');
    if (kind === 'untimed') {
        calendarBackfillTarget = getDayUnassignedSegments(viewDate).find((gap) => gap.start === record.gapStart) || calendarBackfillTarget;
    }
    showCalendarBackfillForm(kind);
    calendarBackfillEditingId = id;
    if (kind === 'event') {
        document.getElementById('calendar-backfill-event-type').value = String(record.typeId);
        document.getElementById('calendar-backfill-event-count').value = String(record.count || 1);
    } else {
        document.getElementById('calendar-backfill-l1').value = record.l1;
        document.getElementById('calendar-backfill-l2').value = record.l2 || '';
        updateCalendarBackfillCategory();
        document.getElementById('calendar-backfill-hours').value = String(Math.floor(record.durationMs / HOUR_MS));
        document.getElementById('calendar-backfill-minutes').value = String(Math.floor((record.durationMs % HOUR_MS) / 60000));
        document.getElementById('calendar-backfill-note').value = record.note || '';
        document.getElementById('calendar-backfill-remaining').innerText = `当天可分配 ${formatDuration(Math.max(0, getRemainingDayMs(viewDate, id)))}`;
    }
}

function deleteCalendarSupplement(kind, id) {
    showConfirm('删除补录', '删除后无法撤销。', '删除', (ok) => {
        if (!ok) return;
        if (kind === 'event') {
            eventRecords = eventRecords.filter((item) => item.id !== id);
            saveEventRecords();
        } else {
            unlocatedLogs = unlocatedLogs.filter((item) => item.id !== id);
            localStorage.setItem('v9_unlocated_logs', JSON.stringify(unlocatedLogs));
        }
        renderAll();
        renderUnassignedBackfillActivities();
    });
}

function renderUnassignedBackfillActivities() {
    const host = document.getElementById('calendar-backfill-linked');
    if (!host) return;
    host.replaceChildren();
    host.classList.toggle('hidden', !calendarBackfillTarget || !!calendarBackfillKind);
    if (!calendarBackfillTarget || calendarBackfillKind) return;
    const gaps = getDayUnassignedSegments(viewDate);
    const index = gaps.findIndex((gap) => gap.start === calendarBackfillTarget.start);
    const items = assignUnlocatedToGaps(viewDate, gaps).byGap[index] || [];
    items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'calendar-supplement-row';
        const label = document.createElement('div');
        const name = document.createElement('strong');
        name.innerText = `${item.l2 || item.l1} · ${formatDuration(item.durationMs)}`;
        label.appendChild(name);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.innerText = '删除';
        remove.addEventListener('click', () => deleteCalendarSupplement('untimed', item.id));
        row.append(label, remove);
        host.appendChild(row);
    });
    host.classList.toggle('hidden', !items.length);
}

function renderCalendarBackfillRecords() {
    const host = document.getElementById('calendar-backfill-records');
    if (!host) return;
    const untimed = unlocatedLogs.filter((item) => item.date === viewDate)
        .map((item) => ({ kind: 'untimed', id: item.id, label: `${item.l2 || item.l1} · ${formatDuration(item.durationMs)}`, note: '未指定时段' }));
    const events = eventRecords.filter((item) => formatBeijingDate(item.occurredAt) === viewDate)
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .map((item) => {
            const type = eventTypeById(item.typeId);
            return { kind: 'event', id: item.id, label: `${type?.icon || item.icon || '•'} ${type?.name || item.typeName} · ${item.count || 1} 次`, note: item.dateOnly ? '事件 · 仅日期' : `事件 · ${formatBeijingClockSec(item.occurredAt)}` };
        });
    const rows = untimed.concat(events);
    host.replaceChildren();
    rows.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'calendar-supplement-row';
        const text = document.createElement('div');
        text.innerHTML = `<strong>${escHtml(item.label)}</strong><span>${item.note}</span>`;
        const edit = document.createElement('button');
        edit.type = 'button'; edit.innerText = '编辑'; edit.addEventListener('click', () => item.kind === 'event' ? openEventRecordEditor(item.id) : editCalendarSupplement(item.kind, item.id));
        const del = document.createElement('button');
        del.type = 'button'; del.innerText = '删除'; del.addEventListener('click', () => deleteCalendarSupplement(item.kind, item.id));
        row.appendChild(text);
        if (item.kind === 'event' || recordMode === 'journal') row.appendChild(edit);
        row.appendChild(del);
        host.appendChild(row);
    });
}

function initViewDateState() {
    viewDate = formatBeijingDate(nowSecondMs());
    const d = new Date(nowSecondMs() + BJ_OFFSET);
    calendarViewYear = d.getUTCFullYear();
    calendarViewMonth = d.getUTCMonth();
}

function getCat(name) {
    return cats.find(c => c.name === name);
}

function resolveShortcutIcon(s) {
    const cat = getCat(s.l1);
    if (!cat) return s.icon || '📌';
    // 快捷入口允许独立换图标，不能被目录默认图标覆盖。
    if (s.customIcon && s.icon) return s.icon;
    if (s.l2) return getSubIcon(s.l2, cat.icon, cat);
    return cat.icon || '📌';
}

function syncParallelShortcutRefs(oldL1, newL1, catName, oldL2, newL2) {
    if (oldL1 != null && newL1 != null) {
        parallelShortcuts.forEach((s) => { if (s.l1 === oldL1) s.l1 = newL1; });
    }
    if (catName != null && oldL2 != null && newL2 != null) {
        parallelShortcuts.forEach((s) => {
            if (s.l1 === catName && s.l2 === oldL2) s.l2 = newL2;
        });
    }
}

function recordRecentPick(l1, l2) {
    if (!l1) return;
    let recents = safeJSON('v9_recent_picks') || [];
    recents = [{ l1, l2: l2 || '', t: nowSecondMs() }, ...recents.filter((r) => !(r.l1 === l1 && (r.l2 || '') === (l2 || '')))];
    localStorage.setItem('v9_recent_picks', JSON.stringify(recents.slice(0, 8)));
}

function isPickerWithRecents() {
    return ['record', 'parallel-backfill', 'edit', 'split', 'classify-log', 'calendar-backfill'].includes(pickerMode);
}

function appendDrawerRecentsBar(l2Box) {
    if (!isPickerWithRecents()) return;
    const recents = safeJSON('v9_recent_picks') || [];
    const wrap = document.createElement('div');
    wrap.className = 'drawer-recents-wrap';
    const label = document.createElement('div');
    label.className = 'drawer-recents-label';
    label.innerText = '最近';
    wrap.appendChild(label);
    const row = document.createElement('div');
    row.className = 'drawer-recents-row';
    recents.forEach((r) => {
        const cat = getCat(r.l1);
        if (!cat || (pickerMode === 'calendar-backfill' && cat.name === '场景')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'drawer-recent-btn btn-active';
        const icon = r.l2 ? getSubIcon(r.l2, cat.icon, cat) : cat.icon;
        btn.innerHTML = `<span class="drawer-recent-icon">${escHtml(icon)}</span><span class="drawer-recent-text">${escHtml(r.l2 || r.l1)}</span>`;
        const mode = pickerMode;
        btn.addEventListener('click', () => drawerPick(r.l1, r.l2 || '', mode));
        row.appendChild(btn);
    });
    const addL1Btn = document.createElement('button');
    addL1Btn.type = 'button';
    addL1Btn.className = 'drawer-quick-add-btn btn-active';
    addL1Btn.title = '新建一级分类';
    addL1Btn.innerText = '＋';
    addL1Btn.addEventListener('click', () => addL1());
    const addSubBtn = document.createElement('button');
    addSubBtn.type = 'button';
    addSubBtn.className = 'drawer-quick-add-btn drawer-quick-add-btn--sub btn-active';
    addSubBtn.title = '新建子分类';
    addSubBtn.innerText = '＋子';
    addSubBtn.addEventListener('click', () => openQuickAddSubCategory());
    row.append(addL1Btn, addSubBtn);
    wrap.appendChild(row);
    l2Box.appendChild(wrap);
}

function openQuickAddSubCategory() {
    const cat = getCat(selL1) || cats[0];
    if (!cat) { addL1(); return; }
    showPrompt('新建子分类', `添加到「${cat.name}」下`, '', (n) => {
        if (!n || !n.trim()) return;
        const name = n.trim();
        showCategoryPicker(`为「${name}」选图标`, (icon) => {
            cat.subs.push(name);
            setSubIcon(cat, name, icon);
            save();
            renderPicker();
        });
    });
}

function flushUncategorizedClassifyPrompt() {
    if (_classifyPromptOpen || !pendingClassifyLogIds.length) return;
    const id = pendingClassifyLogIds.shift();
    const log = logs.find((l) => l.id === id);
    if (!log) {
        flushUncategorizedClassifyPrompt();
        return;
    }
    _classifyPromptOpen = true;
    _classifyTargetLogId = id;
    pickerMode = 'classify-log';
    setDrawerDevAddress('B66');
    document.getElementById('drawer-title').innerText = '请为未分类记录选择归档';
    document.getElementById('parallel-time-row').classList.add('hidden');
    document.getElementById('drawer-footer').classList.remove('hidden');
    const noteEl = document.getElementById('drawer-note');
    if (noteEl) {
        noteEl.value = log.note || '';
        noteEl.placeholder = '可补充备注…';
    }
    if (drawerViewMode === 'columns') drawerViewMode = 'flat';
    showDrawer();
    renderPicker();
    renderDrawerToggle();
}

function normalizePhraseKey(text) {
    return (text || '').replace(/#\S+/g, '').trim().toLowerCase();
}

function rememberInputAlias(phrase, l1, l2) {
    const key = normalizePhraseKey(phrase);
    if (!key || !l1) return;
    inputAliases[key] = { l1, l2: l2 || '' };
    localStorage.setItem('v9_input_aliases', JSON.stringify(inputAliases));
}

function rebuildInputAliasesFromLogs() {
    logs.forEach((log) => {
        if (!log || log.parallel || !log.l1) return;
        const phrase = normalizePhraseKey(log.note);
        if (phrase.length < 2) return;
        const key = normalizePhraseKey(phrase);
        if (!inputAliases[key]) rememberInputAlias(phrase, log.l1, log.l2);
    });
}

/** 从「记」输入框解析分类：已学习短语 → 子类名 → 一级类名 */
function matchCategoryFromInput(val) {
    const tag = val.match(/#(\S+)/)?.[1] || '';
    const note = val;
    const plain = normalizePhraseKey(val);

    const aliasKeys = Object.keys(inputAliases).sort((a, b) => b.length - a.length);
    for (const k of aliasKeys) {
        if (plain === k || (k.length >= 2 && plain.includes(k))) {
            const a = inputAliases[k];
            return { l1: a.l1, l2: a.l2 || '', tag, note };
        }
    }

    const matches = [];
    cats.forEach((c) => c.subs.forEach((s) => {
        const idx = val.indexOf(s);
        if (idx >= 0) matches.push({ l1: c.name, l2: s, idx, len: s.length });
    }));
    cats.forEach((c) => {
        const idx = val.indexOf(c.name);
        if (idx >= 0) matches.push({ l1: c.name, l2: '', idx, len: c.name.length });
    });
    matches.sort((a, b) => a.idx - b.idx || b.len - a.len);
    const best = matches[0];
    return best ? { l1: best.l1, l2: best.l2, tag, note } : { l1: '', l2: '', tag, note };
}

function displayName(log) {
    return log?.l2 || log?.l1 || "未分类";
}

/** 未分类进行中：点任意快捷都应切换；仅已明确分类且与快捷相同时忽略点击 */
function isSameClassifiedMainActivity(l1, l2) {
    if (!current || !current.l1) return false;
    return current.l1 === l1 && (current.l2 || '') === (l2 || '');
}

function formatHours(ms) {
    return `${(ms / HOUR_MS).toFixed(1)}h`;
}

function drawClockSegment(parent, r, startMs, endMs, rangeStart, rangeEnd, color, data, strokeWidth) {
    const total = rangeEnd - rangeStart;
    const start = Math.max(startMs, rangeStart);
    const end = Math.min(endMs, rangeEnd);
    if (end <= start) return;
    strokeWidth = strokeWidth || 14;
    const circ = Math.PI * 2 * r;
    const dash = ((end - start) / total) * circ;
    const offset = -((start - rangeStart) / total) * circ;
    const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    arc.setAttribute("cx", "60");
    arc.setAttribute("cy", "60");
    arc.setAttribute("r", r);
    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", color);
    arc.setAttribute("stroke-width", strokeWidth);
    arc.setAttribute("stroke-linecap", "butt");
    arc.setAttribute("stroke-dasharray", `${Math.max(0.5, dash - 0.5)} ${circ}`);
    arc.setAttribute("stroke-dashoffset", offset);
    arc.setAttribute("opacity", strokeWidth < 14 ? "0.7" : "1");
    parent.appendChild(arc);
}

/** 环内刻度：每整点的 15 / 30 / 45 分（整点对齐窗口） */
function renderClockMarks(marksG, rangeStart, rangeEnd) {
    if (!marksG) return;
    marksG.innerHTML = "";
    const total = rangeEnd - rangeStart;
    if (total <= 0) return;
    let hourStart = beijingPeriodStart(rangeStart, HOUR_MS);
    while (hourStart < rangeEnd) {
        [15, 30, 45].forEach(min => {
            const t = hourStart + min * 60000;
            if (t <= rangeStart || t >= rangeEnd) return;
            const angle = ((t - rangeStart) / total) * 360 * (Math.PI / 180);
            const r1 = 44, r2 = 47;
            const x1 = 60 + Math.cos(angle) * r1;
            const y1 = 60 + Math.sin(angle) * r1;
            const x2 = 60 + Math.cos(angle) * r2;
            const y2 = 60 + Math.sin(angle) * r2;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1); line.setAttribute("y1", y1);
            line.setAttribute("x2", x2); line.setAttribute("y2", y2);
            line.setAttribute("stroke", "#94a3b8");
            line.setAttribute("stroke-width", "0.65");
            marksG.appendChild(line);
        });
        hourStart += HOUR_MS;
    }
}

function logSegmentColor(log) {
    if (log?.scene || log?.l1 === '场景') return getSceneColor(log.l2);
    return getCat(log?.l1)?.color || log?.color || '#cbd5e1';
}

function applySceneFlowCardTheme(card, log) {
    if (!log?.scene) return;
    const color = logSegmentColor(log);
    card.classList.add('log-flow-card--scene');
    card.style.setProperty('--tb-scene-color', color);
    card.style.backgroundColor = colorOnWhite(color, 0.10);
    card.style.boxShadow = `inset 0 0 0 1px ${colorWithAlpha(color, 0.38)}`;
}

function applySceneNestTheme(nest, parentLog) {
    if (!parentLog?.scene) return;
    nest.classList.add('log-flow-nest--scene');
    nest.style.setProperty('--tb-scene-color', logSegmentColor(parentLog));
}

function applyClockLayout() {
    const p = getClockPrefs();
    const stage = document.getElementById('clock-stage');
    const panel60 = document.getElementById('clock-panel-60m');
    const panel24 = document.getElementById('clock-panel-24h');
    if (!stage || !panel60 || !panel24) return;
    const dual = p.layout === 'dual';
    stage.classList.toggle('clock-stage--dual', dual);
    stage.classList.toggle('clock-stage--single', !dual);
    if (dual) {
        panel60.classList.remove('hidden');
        panel24.classList.remove('hidden');
    } else {
        panel60.classList.toggle('hidden', p.singleAxis !== '60m');
        panel24.classList.toggle('hidden', p.singleAxis !== '24h');
    }
    const cap60 = panel60.querySelector('.clock-panel-caption');
    const cap24 = panel24.querySelector('.clock-panel-caption');
    if (cap60) cap60.textContent = p.spanHoursA + 'H';
    if (cap24) cap24.textContent = p.spanHoursB + 'H';
    updateClockCenterLabels(getViewAnchorMs(getTodayDateStr()));
}

function renderClockSettings() {
    const wrap = document.getElementById('clock-settings-ui');
    if (!wrap) return;
    const p = getClockPrefs();
    wrap.innerHTML = '';

    const layoutLabel = document.createElement('div');
    layoutLabel.className = 'clock-settings-label';
    layoutLabel.innerText = '显示方式';
    wrap.appendChild(layoutLabel);
    const row1 = document.createElement('div');
    row1.className = 'clock-settings-row';
    [['dual', '双时间轴'], ['single', '单时间轴']].forEach(([val, lab]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'clock-settings-btn btn-active' + (p.layout === val ? ' active' : '');
        btn.setAttribute('aria-pressed', String(p.layout === val));
        btn.innerText = lab;
        btn.addEventListener('click', () => setClockPref('layout', val));
        row1.appendChild(btn);
    });
    wrap.appendChild(row1);

    if (p.layout === 'single') {
        const axisLabel = document.createElement('div');
        axisLabel.className = 'clock-settings-label';
        axisLabel.innerText = '显示时间环';
        wrap.appendChild(axisLabel);
        const row2 = document.createElement('div');
        row2.className = 'clock-settings-row';
        [['60m', '60M 环'], ['24h', '24H 环']].forEach(([val, lab]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'clock-settings-btn btn-active' + (p.singleAxis === val ? ' active' : '');
            btn.setAttribute('aria-pressed', String(p.singleAxis === val));
            btn.innerText = lab;
            btn.addEventListener('click', () => setClockPref('singleAxis', val));
            row2.appendChild(btn);
        });
        wrap.appendChild(row2);
    }

    const addSpanRow = (label, key, value) => {
        const row = document.createElement('div');
        row.className = 'clock-span-row';
        const lab = document.createElement('label');
        lab.innerText = label;
        const items = [];
        CLOCK_SPAN_OPTIONS.forEach((h) => items.push({ value: h, label: h + ' 小时' }));
        const trigger = createPickerTrigger(value + ' 小时', () => {
            openCompactWheel({
                title: label,
                items,
                value,
                onSelect: (v) => setClockPref(key, parseInt(v, 10)),
            });
        });
        row.append(lab, trigger);
        wrap.appendChild(row);
    };

    if (p.layout === 'dual') {
        addSpanRow('60M 环 · 统计范围', 'spanHoursA', p.spanHoursA);
        addSpanRow('24H 环 · 统计范围', 'spanHoursB', p.spanHoursB);
    } else {
        const key = p.singleAxis === '24h' ? 'spanHoursB' : 'spanHoursA';
        const val = p.singleAxis === '24h' ? p.spanHoursB : p.spanHoursA;
        addSpanRow((p.singleAxis === '24h' ? '24H' : '60M') + ' 环 · 统计范围', key, val);
    }
}

function renderOneClockRing(opts) {
    const { gSeg, gMarks, handEl, rangeStart, rangeEnd, logs, now } = opts;
    gSeg.innerHTML = "";
    renderClockMarks(gMarks, rangeStart, rangeEnd);
    const innerBg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    innerBg.setAttribute("cx", "60"); innerBg.setAttribute("cy", "60"); innerBg.setAttribute("r", "38");
    innerBg.setAttribute("fill", "none"); innerBg.setAttribute("stroke", "#f1f5f9"); innerBg.setAttribute("stroke-width", "10");
    gSeg.appendChild(innerBg);
    const windowLogs = logs.filter(l => l.endTime > rangeStart && l.startTime < rangeEnd);
    windowLogs.forEach(log => {
        const color = logSegmentColor(log);
        const thin = !!log.parallel;
        drawClockSegment(gSeg, thin ? 38 : 50, log.startTime, log.endTime, rangeStart, rangeEnd, color, log, thin ? 10 : 14);
    });
    const angle = ((now - rangeStart) / (rangeEnd - rangeStart)) * 360;
    if (handEl) handEl.style.transform = `translateX(-50%) rotate(${angle}deg)`;
}

let promptCallback = null;
function showPrompt(title, placeholder, defaultValue, callback) {
    document.getElementById('prompt-title').innerText = title;
    document.getElementById('prompt-input').placeholder = placeholder || '';
    document.getElementById('prompt-input').value = defaultValue || '';
    promptCallback = callback;
    document.getElementById('prompt-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('prompt-input').focus(), 100);
}
function confirmPrompt() {
    const val = document.getElementById('prompt-input').value;
    document.getElementById('prompt-modal').classList.add('hidden');
    document.activeElement?.blur();
    if (promptCallback) promptCallback(val);
    promptCallback = null;
}
function closePrompt() {
    document.getElementById('prompt-modal').classList.add('hidden');
    if (promptCallback) promptCallback(null);
    promptCallback = null;
}
let catEmojiPickerCb = null;

function showCategoryPicker(title, callback) {
    catEmojiPickerCb = callback;
    document.getElementById('cat-emoji-picker-title').innerText = title || '选择图标';
    const left = document.getElementById('cat-emoji-left');
    left.innerHTML = '';
    EMOJI_CAT_ORDER.forEach((catName, ci) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full text-left px-2.5 py-2 text-[11px] font-bold rounded-lg ' + (ci === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500');
        btn.innerText = catName;
        btn.addEventListener('click', () => {
            left.querySelectorAll('button').forEach(b => {
                b.className = 'w-full text-left px-2.5 py-2 text-[11px] font-bold rounded-lg bg-slate-50 text-slate-500';
            });
            btn.className = 'w-full text-left px-2.5 py-2 text-[11px] font-bold rounded-lg bg-indigo-600 text-white';
            renderCatGrid(EMOJI_CATS[catName]);
        });
        left.appendChild(btn);
    });
    renderCatGrid(EMOJI_CATS['所有']);
    document.getElementById('cat-emoji-picker').classList.remove('hidden');
}
function renderCatGrid(emojis) {
    const grid = document.getElementById('cat-emoji-grid');
    grid.innerHTML = '';
    emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-10 h-10 rounded-lg text-lg flex items-center justify-center bg-slate-50 active:bg-indigo-200 transition-colors';
        btn.innerText = emoji;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('cat-emoji-picker').classList.add('hidden');
            if (catEmojiPickerCb) { catEmojiPickerCb(emoji); catEmojiPickerCb = null; }
        });
        grid.appendChild(btn);
    });
}
document.addEventListener('click', (e) => {
    const picker = document.getElementById('cat-emoji-picker');
    if (picker && !picker.classList.contains('hidden') && e.target === picker) {
        picker.classList.add('hidden');
        if (catEmojiPickerCb) { catEmojiPickerCb(null); catEmojiPickerCb = null; }
    }
});
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('scene-entry-btn')?.addEventListener('click', enterScene);
    document.getElementById('prompt-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmPrompt();
    });
    document.getElementById('edit-note-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmEdit();
    });
    ['es-h','es-m','es-s','ee-h','ee-m','ee-s'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => {
            if (e.key === 'Enter') confirmEdit();
        });
    });
});

let confirmCallback = null;
let confirmSecondaryCallback = null;
function closeConfirm(result, action = 'dismiss') {
    document.getElementById('confirm-modal').classList.add('hidden');
    const secondary = action === 'secondary' ? confirmSecondaryCallback : null;
    const callback = confirmCallback;
    confirmCallback = null;
    confirmSecondaryCallback = null;
    if (secondary) secondary();
    else if (callback) callback(result);
}

let keyboardActiveModal = null;
let keyboardShifts = new WeakMap();
const KEYBOARD_GAP = 80;
function initEventCountInput(input) {
    if (!input) return;
    const selectValue = () => input.select();
    input.addEventListener('focus', selectValue);
    input.addEventListener('click', selectValue);
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 3); });
}
['calendar-backfill-event-count', 'event-edit-count', 'event-supplement-count']
    .forEach(id => initEventCountInput(document.getElementById(id)));
function keepFreeInputVisible() {
    const input = document.getElementById('free-input');
    if (!input || document.activeElement !== input) return;
    const viewport = window.visualViewport;
    const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    const overlap = input.getBoundingClientRect().bottom + 16 - visibleBottom;
    if (overlap > 0) document.querySelector('main')?.scrollBy({ top: overlap, behavior: 'smooth' });
}
document.getElementById('free-input')?.addEventListener('focus', () => {
    setTimeout(keepFreeInputVisible, 350);
});
window.visualViewport?.addEventListener('resize', () => {
    setTimeout(keepFreeInputVisible, 100);
});
document.addEventListener('focusin', (e) => {
    const input = e.target;
    if (input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') return;
    const modal = input.closest('#prompt-modal, #edit-modal, #cat-emoji-picker');
    if (!modal) return;
    keyboardActiveModal = modal;
    if (window.visualViewport) {
        setTimeout(() => {
            const vv = window.visualViewport;
            const body = modal.querySelector('.bg-white');
            if (!body) return;
            const rect = body.getBoundingClientRect();
            if (rect.bottom > vv.height) {
                const overlap = rect.bottom - vv.height + KEYBOARD_GAP;
                keyboardShifts.set(body, body.style.marginTop);
                body.style.marginTop = `-${overlap}px`;
            }
        }, 350);
    }
});
document.addEventListener('focusout', (e) => {
    const input = e.target;
    if (input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') return;
    const modal = input.closest('#prompt-modal, #edit-modal, #cat-emoji-picker');
    if (!modal) return;
    setTimeout(() => {
        if (!modal.contains(document.activeElement)) {
            const body = modal.querySelector('.bg-white');
            if (body && keyboardShifts.has(body)) {
                body.style.marginTop = keyboardShifts.get(body);
                keyboardShifts.delete(body);
            }
            keyboardActiveModal = null;
        }
    }, 150);
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        if (!keyboardActiveModal) return;
        const vv = window.visualViewport;
        const body = keyboardActiveModal.querySelector('.bg-white');
        if (!body) return;
        const rect = body.getBoundingClientRect();
        if (rect.bottom > vv.height) {
            const overlap = rect.bottom - vv.height + KEYBOARD_GAP;
            keyboardShifts.set(body, body.style.marginTop || '');
            body.style.marginTop = `-${overlap}px`;
        } else if (keyboardShifts.has(body)) {
            body.style.marginTop = keyboardShifts.get(body);
            keyboardShifts.delete(body);
        }
    });
}

let editOldL1 = null, editOldL2 = null;
let editTarget = null;
function showConfirm(title, message, okText, callback, cancelText, options = {}) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.innerText = okText || '确定';
    okBtn.className = 'flex-1 py-3 text-sm font-bold text-white ' + (okText?.includes('删除') ? 'bg-red-500' : 'bg-indigo-600') + ' rounded-2xl';
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    if (cancelBtn) cancelBtn.innerText = cancelText || '取消';
    const modal = document.getElementById('confirm-modal');
    if (options.addressBlock) modal.dataset.devAddressBlock = options.addressBlock;
    else delete modal.dataset.devAddressBlock;
    confirmCallback = callback;
    confirmSecondaryCallback = options.onSecondary || null;
    modal.classList.remove('hidden');
}

function openEdit(index, source = 'logs') {
    editIndex = index;
    const collection = source === 'parallelHistory' ? parallelHistory : logs;
    const log = source === 'parallelCurrent' ? parallelCurrent : source === 'current' ? current : collection[index];
    if (!log) return;
    const activeMain = source === 'current';
    const liveEnd = source === 'parallelCurrent' || activeMain ? nowSecondMs() : null;
    const dayStart = beijingDateStrToDayStart(formatBeijingDate(log.startTime));
    const previousEnd = activeMain ? logs
        .filter((item) => !item.parallel && !item.sceneActivity)
        .map((item) => logEndMs(item))
        .filter((end) => end >= dayStart && end <= log.startTime)
        .sort((a, b) => b - a)[0] : null;
    editTarget = { source, id: log.id, liveEnd, previousEnd };
    _backfillRange = null;
    editOldL1 = log.l1;
    editOldL2 = log.l2;
    const previewEnd = liveEnd || logEndMs(log);
    document.getElementById('edit-log-preview').innerText = `${log.l1 || '??'}${log.l2 ? ' / ' + log.l2 : ''} — ${formatDuration(previewEnd - log.startTime)}`;
    setTimeInFields('es', new Date(log.startTime));
    const endIsNextDayStart = previewEnd === beijingDateStrToDayStart(formatBeijingDate(log.startTime)) + DAY_MS;
    const fixedMidnightEnd = !log.parallel && !log.sceneActivity && endIsNextDayStart;
    setTimeInFields('ee', new Date(previewEnd), { show24: endIsNextDayStart });
    const dateRow = document.getElementById('edit-parallel-date-row');
    const dateInput = document.getElementById('edit-parallel-date');
    if (log.parallel) {
        dateRow.classList.remove('hidden');
        dateInput.value = formatBeijingDate(log.startTime);
    } else {
        dateRow.classList.add('hidden');
        dateInput.value = '';
    }
    const activeParallel = source === 'parallelCurrent';
    const editBlock = activeMain
        ? (previousEnd == null ? 'B51' : 'B52')
        : activeParallel ? 'B78'
            : log.parallel ? 'B53'
                : fixedMidnightEnd ? 'B79' : 'B09';
    const editModal = document.getElementById('edit-modal');
    if (editModal?.dataset) editModal.dataset.devAddressBlock = editBlock;
    ['ee-h', 'ee-m', 'ee-s'].forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.disabled = activeParallel || activeMain || (fixedMidnightEnd && !log.journal);
        field.classList.toggle('opacity-40', activeParallel || activeMain || (fixedMidnightEnd && !log.journal));
    });
    const endLabel = document.getElementById('edit-end-label');
    if (endLabel) endLabel.innerText = activeParallel || activeMain ? '实时结束' : fixedMidnightEnd && !log.journal ? '结转结束（24:00 固定）' : '结束';
    const continueButton = document.getElementById('edit-continue-previous');
    continueButton.classList.toggle('hidden', !activeMain || previousEnd == null);
    if (previousEnd != null) continueButton.innerText = `接续上一条结束时间 ${formatBeijingClockSec(previousEnd)}`;
    document.getElementById('edit-current-backfill').classList.toggle('hidden', !activeMain);
    document.getElementById('edit-note-input').value = log.note || '';
    updateEditCatDisplay(log.l1, log.l2);
    document.getElementById('edit-modal').classList.remove('hidden');
}
function continueEditFromPrevious() {
    if (editTarget?.source !== 'current' || editTarget.previousEnd == null) return;
    setTimeInFields('es', new Date(editTarget.previousEnd));
}
function openBackfillFromCurrentEdit() {
    if (editTarget?.source !== 'current' || current?.id !== editTarget.id) return;
    closeEdit();
    openBackfillDrawer(current, { liveParent: true });
}
function updateEditCatDisplay(l1, l2) {
    const d = document.getElementById('edit-cat-display');
    if (!l1) { d.innerText = '选择分类'; return; }
    const cat = getCat(l1);
    const icon = cat?.icon || '📌';
    d.innerText = l2 ? `${icon} ${l1} / ${l2}` : `${icon} ${l1}`;
}
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('edit-cat-btn');
    if (btn) btn.addEventListener('click', () => {
        if (!editTarget) return;
        if (editTarget.source === 'unassigned') {
            editDrawerPreviousViewMode = drawerViewMode;
            drawerViewMode = 'flat';
        }
        _parallelCallback = (l1, l2) => { editOldL1 = l1; editOldL2 = l2; updateEditCatDisplay(l1, l2); document.getElementById('edit-modal').classList.remove('hidden'); };
        pickerMode = 'edit';
        setDrawerDevAddress('B65');
        document.getElementById('edit-modal').classList.add('hidden');
        document.getElementById('drawer-title').innerText = "修改分类";
        document.getElementById('drawer-footer').classList.add('hidden');
        showDrawer();
        renderPicker();
        renderDrawerToggle();
    });
});
function parseEditClock(value, referenceMs) {
    const parts = String(value || '').trim().split(':').map(Number);
    if (parts.length !== 2 && parts.length !== 3) return null;
    if (parts.some(n => !Number.isFinite(n) || n < 0)) return null;
    const h = parts.length === 3 ? parts[0] : parts[0];
    const m = parts.length === 3 ? parts[1] : parts[1];
    const s = parts.length === 3 ? parts[2] : 0;
    if (h > 23 || m > 59 || s > 59) return null;
    const date = formatBeijingDate(referenceMs);
    return beijingDateStrToDayStart(date) + (h * 3600 + m * 60 + s) * 1000;
}

function parseTimeOnBeijingDate(prefix, dateStr) {
    const h = parseInt(document.getElementById(prefix + '-h').value, 10);
    const m = parseInt(document.getElementById(prefix + '-m').value, 10);
    const s = parseInt(document.getElementById(prefix + '-s').value, 10);
    if (![h, m, s].every(Number.isFinite) || h < 0 || h > 24 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
    if (h === 24) return prefix === 'ee' && m === 0 && s === 0 ? beijingDateStrToDayStart(dateStr) + DAY_MS : null;
    return beijingDateStrToDayStart(dateStr) + (h * 3600 + m * 60 + s) * 1000;
}

function getEditBoundaryNeighbors(log) {
    const mainRecords = logs
        .filter(l => !l.parallel && l.id !== log.id)
        .sort((a, b) => a.startTime - b.startTime);
    if (current && current.id !== log.id) mainRecords.push(current);
    mainRecords.sort((a, b) => a.startTime - b.startTime);
    const previous = [...mainRecords].reverse().find((item) => logEndMs(item) <= log.startTime) || null;
    const next = mainRecords.find((item) => item.startTime >= logEndMs(log))
        // 当前主线没有固定结束，且旧数据可能已与它轻微交叠；它仍应是最后一条已结束记录的可调整后继。
        || (current && current.id !== log.id ? current : null);
    return { previous, next };
}

function mainRecordOverlaps(start, end, excludeIds = new Set(), includeCurrent = true) {
    const conflicts = logs.filter((item) => {
        if (item.parallel || excludeIds.has(item.id)) return false;
        const itemEnd = logEndMs(item);
        return item.startTime < end && itemEnd > start;
    });
    if (includeCurrent && current && !excludeIds.has(current.id)) {
        const currentEnd = nowSecondMs();
        if (current.startTime < end && currentEnd > start) conflicts.push(current);
    }
    return conflicts;
}

// 当主线的开始时间落在上一条记录中间时，不能把整条并行一起改挂。
// 位于新边界前的部分仍属原主线，边界后的部分才随新主线走。
function moveParallelTailFromBoundary(boundary, splitAt, replacement) {
    const boundaryId = String(boundary.id);
    const splitCollection = (collection) => collection.flatMap((item) => {
        if (!item?.parallel || String(item.parentId) !== boundaryId) return [item];
        const itemEnd = logEndMs(item);
        if (itemEnd <= splitAt) return [item];
        if (item.startTime >= splitAt) return [{ ...item, parentId: replacement.id }];
        return [
            {
                ...item,
                endTime: splitAt,
                duration: Math.max(1, Math.round((splitAt - item.startTime) / 60000))
            },
            {
                ...item,
                id: genId(),
                startTime: splitAt,
                endTime: itemEnd,
                duration: Math.max(1, Math.round((itemEnd - splitAt) / 60000)),
                parentId: replacement.id
            }
        ];
    });
    logs = splitCollection(logs);
    parallelHistory = splitCollection(parallelHistory);
    if (parallelCurrent && String(parallelCurrent.parentId) === boundaryId) {
        parallelCurrent = { ...parallelCurrent, parentId: replacement.id };
    }
}

function expandMainStartAcrossRecords(log, newStart, newEnd, done) {
    const oldStart = log.startTime;
    const sceneBlocker = logs.find((item) => !item.parallel
        && (item.scene || item.sceneActivity)
        && item.id !== log.id
        && item.startTime < oldStart
        && logEndMs(item) > newStart);
    if (sceneBlocker) {
        showConfirm('无法跨越场景记录', `「${displayName(sceneBlocker)}」是场景时间，不能被普通主线覆盖。请先结束或单独调整该场景。`, '知道了', () => {});
        return;
    }
    const affected = logs
        .filter((item) => !item.parallel && !item.scene && !item.sceneActivity && item.id !== log.id)
        .filter((item) => item.startTime < oldStart && logEndMs(item) > newStart)
        .sort((a, b) => a.startTime - b.startTime);
    const boundary = affected.find((item) => item.startTime < newStart && logEndMs(item) > newStart) || null;
    const swallowed = affected.filter((item) => item !== boundary);
    const names = [
        boundary ? `截短「${displayName(boundary)}」` : '',
        ...swallowed.map((item) => `吸收「${displayName(item)}」`)
    ].filter(Boolean);

    const commit = () => {
        if (boundary) {
            moveParallelTailFromBoundary(boundary, newStart, log);
            boundary.endTime = newStart;
            boundary.duration = Math.max(1, Math.round((newStart - boundary.startTime) / 60000));
        }
        const swallowedIds = new Set(swallowed.map((item) => item.id));
        if (swallowedIds.size) {
            logs = logs.filter((item) => !swallowedIds.has(item.id));
            // 被吸收主线的并行仍保留，改挂到扩展后的主线，而不是变成孤儿。
            rehomeParallelChildren(swallowedIds, log);
        }
        log.startTime = newStart;
        log.endTime = newEnd;
        log.duration = Math.max(1, Math.round((newEnd - newStart) / 60000));
        // 已存在的旧并行若此前因断档而失去父级，也在新的连续范围内重新归属。
        repairOrphanedParallelParents();
        done();
    };
    if (!names.length) {
        commit();
        return;
    }
    showConfirm('确认扩展主线', `开始时间提前后将${names.join('，')}。并行记录会保留并改挂到「${displayName(log)}」。`, '继续', (ok) => {
        if (ok) commit();
    }, '取消');
}

function applyEditedRange(log, newStart, newEnd, done) {
    const oldStart = log.startTime;
    const oldEnd = logEndMs(log);
    // 输入框精确到秒，原始时间戳可能带毫秒；同一显示秒内的差异不应被当成修改。
    const startChanged = Math.floor(newStart / 1000) !== Math.floor(oldStart / 1000);
    const endChanged = Math.floor(newEnd / 1000) !== Math.floor(oldEnd / 1000);
    const effectiveStart = startChanged ? newStart : oldStart;
    const effectiveEnd = endChanged ? newEnd : oldEnd;
    if (effectiveStart >= effectiveEnd) {
        showConfirm('时间不合法', '开始时间必须早于结束时间。', '知道了', () => {});
        return;
    }
    const dayEnd = beijingDateStrToDayEnd(formatBeijingDate(oldStart));
    if (!log.journal && !log.parallel && !log.sceneActivity && oldEnd === dayEnd && effectiveEnd !== oldEnd) {
        showConfirm('结转边界固定', '这条主线已在 24:00 自动结转。请调整当天的其他时段，不能把次日主线拉回昨天。', '知道了', () => {});
        return;
    }
    if (log.parallel) {
        const parallelConflict = [...logs, ...parallelHistory].some((item) => {
            if (!item.parallel || item.id === log.id) return false;
            const itemEnd = logEndMs(item);
            return item.startTime < effectiveEnd && itemEnd > effectiveStart;
        });
        if (parallelConflict) {
            showConfirm('并行时间发生重叠', '调整后的时间与另一条并行记录重叠，请调整后重试。', '知道了', () => {});
            return;
        }
        log.startTime = effectiveStart;
        log.endTime = effectiveEnd;
        log.duration = Math.round((effectiveEnd - effectiveStart) / 60000);
        done();
        return;
    }
    if (log.journal && !log.scene && !log.sceneActivity) {
        const dayStart = beijingDateStrToDayStart(formatBeijingDate(oldStart));
        if (effectiveStart < dayStart || effectiveEnd > dayStart + DAY_MS || effectiveEnd > nowSecondMs()) {
            showConfirm('时间不合法', '手账主线须在当天已过去的时间内。', '知道了', () => {});
            return;
        }
        const outsideChild = logs.concat(parallelHistory).some((item) => item.parallel
            && String(item.parentId) === String(log.id)
            && (item.startTime < effectiveStart || logEndMs(item) > effectiveEnd));
        if (outsideChild) {
            showConfirm('并行超出主线', '请先调整这条主线下面的并行时间。', '知道了', () => {});
            return;
        }
        const conflicts = mainRecordOverlaps(effectiveStart, effectiveEnd, new Set([log.id]));
        if (conflicts.length) {
            showConfirm('时间段发生重叠', `调整后的时间与「${displayName(conflicts[0])}」重叠。`, '知道了', () => {});
            return;
        }
        if (intervalExceedsDayBudget(effectiveStart, effectiveEnd, log.id)) {
            showConfirm('时间总数不够分配', '调整后会超过当天剩余的未记录时间。', '知道了', () => {});
            return;
        }
        log.startTime = effectiveStart;
        log.endTime = effectiveEnd;
        log.duration = Math.max(1, Math.round((effectiveEnd - effectiveStart) / 60000));
        done();
        return;
    }
    // 向前补时间允许跨越多条主线；此前只识别一条相邻记录，会把真实补录误判为冲突。
    if (startChanged && effectiveStart < oldStart) {
        expandMainStartAcrossRecords(log, effectiveStart, effectiveEnd, done);
        return;
    }
    const { previous, next } = getEditBoundaryNeighbors(log);
    const needsPrevious = startChanged;
    const needsNext = endChanged;
    if (needsPrevious && !previous) {
        showConfirm('无法调整开始时间', '上面没有可分配的已结束时间段，不能让时间轴产生空档。', '知道了', () => {});
        return;
    }
    if (needsNext && !next) {
        showConfirm('无法调整结束时间', '下面没有可分配的已结束时间段，不能让时间轴产生空档。', '知道了', () => {});
        return;
    }
    if (needsNext && next === current && effectiveEnd > nowSecondMs()) {
        showConfirm('结束时间还没到', '正在进行的主线不能从未来时间开始。', '知道了', () => {});
        return;
    }
    if (needsNext && formatBeijingDate(effectiveEnd) !== formatBeijingDate(next.startTime)) {
        showConfirm('不能跨日调整', '调整后会把下一条主线的起点移到另一天，导致 24:00 结转错位。请在同一天内调整。', '知道了', () => {});
        return;
    }
    const allowedNeighbors = new Set([log.id, previous?.id, next?.id].filter(Boolean));
    const conflicts = mainRecordOverlaps(effectiveStart, effectiveEnd, allowedNeighbors, next !== current);
    if (conflicts.length) {
        showConfirm('时间段发生重叠', `调整后的时间与「${displayName(conflicts[0])}」重叠，请先缩短时间或调整相邻记录。`, '知道了', () => {});
        return;
    }
    const swallowPrevious = needsPrevious && effectiveStart <= previous.startTime;
    // current 没有固定结束时间，调整上一段时只移动 current 的起点，不吞并当前活动。
    const swallowNext = needsNext && next !== current && effectiveEnd >= logEndMs(next);
    const swallowed = [swallowPrevious ? previous : null, swallowNext ? next : null].filter(Boolean);
    if (swallowed.length) {
        const names = swallowed.map(displayName).join('、');
        showConfirm('确认吞并相邻记录', `这次调整会吞并相邻的「${names}」。是否继续？`, '继续', ok => {
            if (!ok) return;
            commitEditedRange(log, effectiveStart, effectiveEnd, previous, next, swallowPrevious, swallowNext, done);
        }, '取消');
        return;
    }
    commitEditedRange(log, effectiveStart, effectiveEnd, previous, next, false, false, done);
}

function commitEditedRange(log, newStart, newEnd, previous, next, swallowPrevious, swallowNext, done) {
    if (previous && newStart !== log.startTime) {
        if (swallowPrevious) {
            logs = logs.filter(l => l.id !== previous.id);
        } else {
            previous.endTime = newStart;
            previous.duration = Math.round((previous.endTime - previous.startTime) / 60000);
        }
    }
    if (next && newEnd !== logEndMs(log)) {
        if (next === current) {
            current.startTime = newEnd;
            localStorage.setItem('v9_current', JSON.stringify(current));
        } else if (swallowNext) {
            logs = logs.filter(l => l.id !== next.id);
        } else {
            const nextEnd = logEndMs(next);
            next.startTime = newEnd;
            next.duration = Math.round((nextEnd - next.startTime) / 60000);
        }
    }
    log.startTime = newStart;
    log.endTime = newEnd;
    log.duration = Math.round((newEnd - newStart) / 60000);
    done();
}

function confirmEdit() {
    if (!editTarget) return;
    if (editTarget.source === 'unassigned') {
        confirmUnassignedEdit();
        return;
    }
    if (editTarget.source === 'parallelCurrent') {
        confirmActiveParallelEdit();
        return;
    }
    if (editTarget.source === 'current') {
        confirmActiveMainEdit();
        return;
    }
    const target = { ...editTarget };
    const selectedL1 = editOldL1;
    const selectedL2 = editOldL2;
    const collection = target.source === 'parallelHistory' ? parallelHistory : logs;
    const log = collection.find((item) => item.id === target.id);
    if (!log) return;
    const editedDate = log.parallel ? document.getElementById('edit-parallel-date').value : '';
    const newStart = log.parallel ? parseTimeOnBeijingDate('es', editedDate) : parseTimeFromInput('es', log.startTime);
    const newEnd = log.parallel ? parseTimeOnBeijingDate('ee', editedDate) : parseTimeFromInput('ee', log.startTime);
    if (newStart === null || newEnd === null) {
        showConfirm('时间格式不正确', '请输入 HH:MM 或 HH:MM:SS。', '知道了', () => {});
        return;
    }
    const linkedParent = log.parallel
        ? (logs.find((item) => !item.parallel && item.id === log.parentId)
            || (current?.id === log.parentId ? current : null))
        : null;
    const sceneName = linkedParent
        ? (linkedParent.scene ? linkedParent.l2 : '')
        : (target.source === 'parallelHistory' && current?.scene ? current.l2 : '');
    const sceneTarget = log.parallel && sceneName ? getSceneBackfillTarget(sceneName, editedDate) : null;
    if (log.parallel && sceneName && !sceneTarget) {
        showConfirm('当天没有这个场景', '请先选择该场景实际覆盖到的日期。', '知道了', () => {});
        return;
    }
    const finish = () => {
        if (!editTarget || editTarget.id !== target.id || editTarget.source !== target.source) return;
        if (selectedL1) {
            log.l1 = selectedL1;
            log.l2 = selectedL2;
            log.color = getCat(selectedL1)?.color || log.color;
        }
        log.note = document.getElementById('edit-note-input').value;
        if (log.l1) rememberInputAlias(log.note, log.l1, log.l2);
        if (sceneTarget) {
            log.parentId = sceneTarget.parent.id || sceneTarget.parent.startTime;
            log.sceneName = sceneName;
        }

        // parallelHistory 只用于今天仍挂在进行中主线上的并行；跨日期后必须搬入对应日期的正式流水。
        const moveToCompletedScene = log.parallel && target.source === 'parallelHistory'
            && sceneTarget && !sceneTarget.liveParent;
        const moveToLiveScene = log.parallel && target.source === 'logs'
            && sceneTarget && sceneTarget.liveParent && editedDate === getTodayDateStr();
        if (moveToCompletedScene) {
            parallelHistory = parallelHistory.filter((item) => item.id !== log.id);
            logs.unshift(log);
            localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
            localStorage.setItem('v9_logs', JSON.stringify(logs));
        } else if (moveToLiveScene) {
            logs = logs.filter((item) => item.id !== log.id);
            parallelHistory.unshift(log);
            localStorage.setItem('v9_logs', JSON.stringify(logs));
            localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
        } else if (target.source === 'parallelHistory') {
            localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
        } else {
            mergeAdjacentSameActivity();
            localStorage.setItem('v9_logs', JSON.stringify(logs));
        }
        document.getElementById('edit-modal').classList.add('hidden');
        editIndex = null;
        editTarget = null;
        editOldL1 = null; editOldL2 = null;
        renderAll();
    };
    applyEditedRange(log, newStart, newEnd, finish);
}

function confirmUnassignedEdit() {
    const target = editTarget;
    if (!target || target.source !== 'unassigned' || recordMode !== 'journal') return;
    const cat = getCat(editOldL1);
    if (!cat || editOldL1 === '场景') {
        showConfirm('请选择活动', '请先选择这段时间要记录的活动。', '知道了', () => {});
        return;
    }
    const now = nowSecondMs();
    const gap = getDayUnassignedSegments(target.dateStr, now).find((item) => item.start === target.gapStart);
    if (!gap) return;
    const live = target.live && getActiveUnassignedSegment(target.dateStr, now)?.start === gap.start;
    const start = parseTimeOnBeijingDate('es', target.dateStr);
    const end = live ? now : parseTimeOnBeijingDate('ee', target.dateStr);
    if (start == null || end == null || start < gap.start || start >= end || end > gap.end || end > now) {
        showConfirm('时间不合法', '请选择未分配主线内已经过去的时间，且开始时间须早于结束时间。', '知道了', () => {});
        return;
    }
    if (mainRecordOverlaps(start, end).length || intervalExceedsDayBudget(start, end, null, now)) {
        showConfirm('时间段发生冲突', '这段时间与已有主线或已分配时长冲突，请缩短时段。', '知道了', () => {});
        return;
    }
    const scopedRecords = unlocatedLogs.map((item) => ({ ...item }));
    const beforeGaps = getDayUnassignedSegments(target.dateStr, now);
    const before = assignUnlocatedToGaps(target.dateStr, beforeGaps, scopedRecords);
    before.byGap.forEach((items, index) => items.forEach((item) => {
        item.gapStart = beforeGaps[index].start;
        item.gapEnd = unassignedScopeEnd(target.dateStr, beforeGaps[index]);
    }));
    const afterGaps = getDayUnassignedSegments(target.dateStr, now, [{ startTime: start, endTime: end }]);
    const after = assignUnlocatedToGaps(target.dateStr, afterGaps, scopedRecords);
    if (after.unplaced.length > before.unplaced.length) {
        showConfirm('时间总数不够分配', '这段修改会挤掉已补录的活动，请缩短时段或先删除活动。', '知道了', () => {});
        return;
    }
    const entry = { id: genId(), startTime: start, l1: editOldL1, l2: editOldL2 || '',
        note: document.getElementById('edit-note-input').value.trim(), tag: '', color: cat.color, journal: true };
    if (live) {
        current = entry;
        localStorage.setItem('v9_current', JSON.stringify(current));
    } else {
        entry.endTime = end;
        entry.duration = Math.round((end - start) / 60000);
        logs.unshift(entry);
        localStorage.setItem('v9_logs', JSON.stringify(logs));
    }
    unlocatedLogs = scopedRecords;
    localStorage.setItem('v9_unlocated_logs', JSON.stringify(unlocatedLogs));
    closeEdit();
    renderAll();
}

function confirmActiveMainEdit() {
    const target = editTarget;
    if (!target || target.source !== 'current' || !current || current.id !== target.id || recordMode !== 'journal' || current.scene) return;
    const newStart = parseTimeOnBeijingDate('es', formatBeijingDate(current.startTime));
    const now = nowSecondMs();
    if (newStart == null || newStart >= now) {
        showConfirm('时间不合法', '开始时间必须早于当前时间。', '知道了', () => {});
        return;
    }
    if (mainRecordOverlaps(newStart, now, new Set([current.id]), false).length) {
        showConfirm('时间段发生重叠', '开始时间不能早于上一条主线的结束时间。', '知道了', () => {});
        return;
    }
    if (intervalExceedsDayBudget(newStart, now, current.id, now)) {
        showConfirm('时间总数不够分配', '调整后会超过当天剩余的未记录时间。', '知道了', () => {});
        return;
    }
    const earlierParallel = logs.concat(parallelHistory, parallelCurrent ? [parallelCurrent] : []).some((item) => item.parallel
        && String(item.parentId) === String(current.id) && item.startTime < newStart);
    if (earlierParallel) {
        showConfirm('并行超出主线', '请先调整这条主线下面的并行时间。', '知道了', () => {});
        return;
    }
    current.startTime = newStart;
    if (editOldL1) {
        current.l1 = editOldL1;
        current.l2 = editOldL2;
        current.color = getCat(editOldL1)?.color || current.color;
    }
    current.note = document.getElementById('edit-note-input').value;
    if (current.l1) rememberInputAlias(current.note, current.l1, current.l2);
    localStorage.setItem('v9_current', JSON.stringify(current));
    closeEdit();
    renderAll();
}

function confirmActiveParallelEdit() {
    const target = editTarget;
    const log = parallelCurrent;
    if (!target || !log || log.id !== target.id) return;
    const editedDate = document.getElementById('edit-parallel-date').value;
    // 某些移动端会在弹窗回到前台时清空 date 控件；开始日期缺失时沿用记录自身日期。
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(editedDate || '')
        ? editedDate
        : formatBeijingDate(log.startTime);
    const newStart = parseTimeOnBeijingDate('es', startDate);
    const now = nowSecondMs();
    // 运行中的并行没有固定结束点：始终以保存这一刻为临时边界，避免跨午夜时把“今天”误读成开始日。
    const newEnd = now;
    if (newStart === null || newStart >= newEnd) {
        showConfirm('时间不合法', '开始时间必须早于当前时间。', '知道了', () => {});
        return;
    }
    const sceneTarget = current?.scene ? getSceneBackfillTarget(current.l2, editedDate) : null;
    if (current?.scene && !sceneTarget) {
        showConfirm('当天没有这个场景', '请先选择该场景实际覆盖到的日期。', '知道了', () => {});
        return;
    }
    const draft = { ...log, endTime: target.liveEnd, duration: Math.round((target.liveEnd - log.startTime) / 60000) };
    applyEditedRange(draft, newStart, newEnd, () => {
        if (editOldL1) { draft.l1 = editOldL1; draft.l2 = editOldL2; }
        draft.note = document.getElementById('edit-note-input').value;
        if (draft.l1) rememberInputAlias(draft.note, draft.l1, draft.l2);
        const keepRunning = true;
        if (keepRunning) {
            parallelCurrent = { ...log, l1: draft.l1, l2: draft.l2, note: draft.note, startTime: draft.startTime, sceneName: current?.scene ? current.l2 : '' };
            localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
        } else {
            if (sceneTarget) {
                draft.parentId = sceneTarget.parent.id || sceneTarget.parent.startTime;
                draft.sceneName = current?.scene ? current.l2 : '';
            }
            const finished = { ...draft, endTime: draft.endTime, duration: Math.round((draft.endTime - draft.startTime) / 60000), parallel: true };
            if (sceneTarget && !sceneTarget.liveParent) {
                logs.unshift(finished);
                localStorage.setItem('v9_logs', JSON.stringify(logs));
            } else {
                parallelHistory.unshift(finished);
                localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
            }
            parallelCurrent = null;
            localStorage.removeItem('v9_parallel');
        }
        document.getElementById('edit-modal').classList.add('hidden');
        editIndex = null;
        editTarget = null;
        editOldL1 = null; editOldL2 = null;
        renderAll();
    });
}
function closeEdit() {
    document.getElementById('edit-modal').classList.add('hidden');
    _backfillRange = null;
    editIndex = null;
    editTarget = null;
    editOldL1 = null; editOldL2 = null;
}

function rehomeParallelChildren(parentIds, replacementParent = null) {
    const ids = new Set([...parentIds].map((id) => String(id)));
    const shouldMove = !!replacementParent;
    const update = (item) => {
        if (!item?.parallel || !ids.has(String(item.parentId))) return item;
        return shouldMove ? { ...item, parentId: replacementParent.id } : null;
    };
    logs = logs.map(update).filter(Boolean);
    parallelHistory = parallelHistory.map(update).filter(Boolean);
    if (parallelCurrent && ids.has(String(parallelCurrent.parentId))) {
        parallelCurrent = shouldMove ? { ...parallelCurrent, parentId: replacementParent.id } : null;
    }
    localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
    if (parallelCurrent) localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
    else localStorage.removeItem('v9_parallel');
}

function deleteLogEntry(target) {
    if (!target || !logs.includes(target)) return;
    const replacement = !target.parallel && !target.scene && !target.sceneActivity
        ? getDeleteMergeNeighbors(target).down
        : null;
    if (replacement) mergeDeletedTime(target, 'down');
    const sceneActivityIds = target.scene
        ? new Set(logs.filter((item) => item.sceneActivity && String(item.sceneParentId) === getSceneContainerId(target)).map((item) => String(item.id)))
        : new Set();
    const childParentIds = new Set([String(target.id), ...sceneActivityIds]);
    rehomeParallelChildren(childParentIds, replacement);
    logs = logs.filter(l => l !== target);
    // 删除场景容器时移除其场景活动；子并行已在上面一起移除。
    logs = logs.filter((item) => {
        if (target.scene && item.sceneActivity && String(item.sceneParentId) === getSceneContainerId(target)) return false;
        return true;
    });
    mergeAdjacentSameActivity();
    localStorage.setItem('v9_logs', JSON.stringify(logs));
    renderAll();
}

function getDeleteMergeNeighbors(target) {
    const sameDay = logs
        .filter(l => !l.parallel && l !== target && formatBeijingDate(l.startTime) === formatBeijingDate(target.startTime))
        .sort((a, b) => a.startTime - b.startTime);
    const activeUp = current && formatBeijingDate(current.startTime) === formatBeijingDate(target.startTime)
        && current.startTime > target.startTime ? current : null;
    return {
        // 流水页面按倒序展示：up 是时间更晚、视觉上方的记录，包含顶部正在进行的 current。
        up: activeUp || sameDay.find(l => l.startTime > target.startTime) || null,
        down: sameDay.slice().reverse().find(l => l.startTime < target.startTime) || null
    };
}

function mergeDeletedTime(target, direction) {
    const neighbors = getDeleteMergeNeighbors(target);
    const neighbor = direction === 'up' ? neighbors.up : neighbors.down;
    if (!neighbor) return;
    const targetEnd = target.endTime || (target.startTime + (target.duration || 0) * 60000);
    const neighborEnd = neighbor.endTime || (neighbor.startTime + (neighbor.duration || 0) * 60000);
    if (direction === 'up') {
        neighbor.startTime = Math.min(neighbor.startTime, target.startTime);
    } else {
        neighbor.endTime = Math.max(neighborEnd, targetEnd);
    }
    neighbor.endTime = Math.max(neighbor.endTime || neighbor.startTime, neighbor.startTime);
        neighbor.duration = Math.round((neighbor.endTime - neighbor.startTime) / 60000);
}

let mergeDirectionCallback = null;
function closeMergeDirection(result) {
    document.getElementById('merge-direction-modal').classList.add('hidden');
    if (mergeDirectionCallback) mergeDirectionCallback(result);
    mergeDirectionCallback = null;
}
function chooseMergeDirection(direction) {
    closeMergeDirection(direction);
}
function showMergeDirection(target, callback, neighbors = getDeleteMergeNeighbors(target), options = {}) {
    const modal = document.getElementById('merge-direction-modal');
    const title = document.getElementById('merge-direction-title');
    const message = document.getElementById('merge-direction-message');
    const upBtn = document.getElementById('merge-up-btn');
    const downBtn = document.getElementById('merge-down-btn');
    modal.dataset.devAddressBlock = options.addressBlock || 'B82';
    title.innerText = '删除后怎么合并？';
    message.innerText = `删除「${displayName(target)}」后，将把这段时间并入相邻记录。`;
    upBtn.innerText = `向上\n${neighbors.up ? displayName(neighbors.up) : '无上方记录'}`;
    downBtn.innerText = `向下\n${neighbors.down ? displayName(neighbors.down) : '无下方记录'}`;
    upBtn.disabled = !neighbors.up;
    downBtn.disabled = !neighbors.down;
    upBtn.classList.toggle('opacity-40', !neighbors.up);
    downBtn.classList.toggle('opacity-40', !neighbors.down);
    mergeDirectionCallback = callback;
    modal.classList.remove('hidden');
}

function clearLogEntryToUnassigned(target) {
    if (!target || target.parallel || target.scene || target.sceneActivity || !logs.includes(target)) return;
    const targetId = String(target.id);
    logs = logs.filter((item) => item !== target).map((item) =>
        item.parallel && String(item.parentId) === targetId ? { ...item, parentId: null } : item);
    parallelHistory = parallelHistory.map((item) =>
        String(item.parentId) === targetId ? { ...item, parentId: null } : item);
    if (parallelCurrent && String(parallelCurrent.parentId) === targetId) {
        parallelCurrent = { ...parallelCurrent, parentId: null };
        localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
    }
    eventRecords = eventRecords.map((item) =>
        String(item.parentId) === targetId ? { ...item, parentId: null } : item);
    localStorage.setItem('v9_logs', JSON.stringify(logs));
    localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
    saveEventRecords();
    renderAll();
}

function requestDeleteLogEntry(target) {
    if (!target) return;
    if (target.parallel || target.scene || target.sceneActivity) {
        deleteLogEntry(target);
        return;
    }
    const neighbors = getDeleteMergeNeighbors(target);
    if (!neighbors.up && !neighbors.down) {
        deleteLogEntry(target);
        return;
    }
    const activeUp = neighbors.up === current;
    showMergeDirection(target, direction => {
        if (!direction) return;
        const neighbor = direction === 'up' ? neighbors.up : neighbors.down;
        mergeDeletedTime(target, direction);
        if (direction === 'up' && activeUp && current) {
            // 顶部正在进行的活动不在 logs 中，合并后要把新的起点写回 current。
            localStorage.setItem('v9_current', JSON.stringify(current));
        }
        logs = logs.filter(l => l !== target);
        rehomeParallelChildren(new Set([target.id]), neighbor);
        mergeAdjacentSameActivity();
        localStorage.setItem('v9_logs', JSON.stringify(logs));
        renderAll();
    }, neighbors, { addressBlock: 'B81' });
}

function executeRecord(l1, l2, tag, note) {
    if (isSceneActive()) {
        // 场景里的快捷入口只创建场景活动，真正并行要从一条场景活动下面新增。
        openSceneParallelBackfillDrawer(current, { preset: { l1, l2: l2 || '' } });
        return;
    }
    if (recordMode === 'journal' && isSameClassifiedMainActivity(l1, l2)) {
        closeDrawer();
        stopCurrentMain();
        return;
    }
    if (parallelCurrent) {
        const pName = displayName(parallelCurrent);
        showConfirm("⏎ 并行还在运行", `「${pName}」还在跑，是结束它还是结转到下一条主线？`, "一起结束", (ok) => {
            if (!ok) {
                // 结转：结束当前段，重启续上
                doExecuteRecord(l1, l2, tag, note, false, true);
            } else {
                doExecuteRecord(l1, l2, tag, note, true, false);
            }
        }, "结转");
        return;
    }
    doExecuteRecord(l1, l2, tag, note, false);
}
function doExecuteRecord(l1, l2, tag, note, endParallel, rollover) {
    const now = nowSecondMs();
    ensureDayRolloversBefore(now);
    const cat = getCat(l1);
    const color = cat ? cat.color : "#cbd5e1";
    if (current) {
        commitCurrentSlice(now, false, { endParallel: !!endParallel, rollover: !!rollover });
    }
    current = { id: genId(), startTime: now, l1, l2, tag, note, color, ...(recordMode === 'journal' ? { journal: true } : {}) };
    localStorage.setItem('v9_current', JSON.stringify(current));
    closeDrawer();
    renderAll();
    if (pendingClassifyLogIds.length) setTimeout(flushUncategorizedClassifyPrompt, 50);
}

function stopCurrentMain() {
    if (recordMode !== 'journal' || !current || current.scene) return;
    const finish = () => {
        const now = nowSecondMs();
        ensureDayRolloversBefore(now);
        if (!current || now <= current.startTime) return;
        commitCurrentSlice(now, false, { endParallel: true });
        current = null;
        localStorage.removeItem('v9_current');
        setText('header-timer', '00:00:00');
        renderAll();
    };
    if (parallelCurrent) {
        showConfirm('并行仍在运行', `结束主线时也会结束「${displayName(parallelCurrent)}」。`, '一起结束', (ok) => {
            if (ok) finish();
        });
        return;
    }
    finish();
}

function executeAddShortcut(l1, l2) {
    if (shortcuts.length >= 9) {
        alert("上限9个");
        closeDrawer();
        return;
    }
    shortcuts.push({ l1, l2, icon: "📌", customIcon: false });
    localStorage.setItem('v9_shorts', JSON.stringify(shortcuts));
    closeDrawer(); renderAll();
}

function executeEditShortcut(l1, l2) {
    if (editingShortcutIndex === null || !shortcuts[editingShortcutIndex]) return;
    shortcuts[editingShortcutIndex].l1 = l1;
    shortcuts[editingShortcutIndex].l2 = l2;
    localStorage.setItem('v9_shorts', JSON.stringify(shortcuts));
    editingShortcutIndex = null;
    closeDrawer();
    renderAll();
}

let _parallelPending = false;
let _parallelCallback = null;
let _cleanupBackfillDrag = null;
let _reportSummaryCategoryPicker = null;
function drawerPick(l1, l2, expectedMode = pickerMode) {
    // Ignore a delayed tap from a picker that has already closed or changed modes.
    if (expectedMode !== pickerMode) return;
    if (_parallelPending) {
        _parallelPending = false;
        const cat = getCat(l1);
        closeDrawer();
        toggleParallel(l1, l2 || '', resolveShortcutIcon({ l1, l2: l2 || '' }));
        return;
    }
    if (pickerMode === 'calendar-backfill') {
        if (l1 === '场景') return;
        recordRecentPick(l1, l2);
        document.getElementById('calendar-backfill-l1').value = l1;
        document.getElementById('calendar-backfill-l2').value = l2 || '';
        updateCalendarBackfillCategory();
        closeDrawer();
        return;
    }
    if (l1 === '场景' && pickerMode === 'record') {
        closeDrawer();
        showConfirm('请从场景入口进入', '“场景”不能作为普通主线启动，请点击首页顶部的“进入场景”。', '知道了', () => {});
        return;
    }
    if (pickerMode === 'report-summary-category') {
        const pending = _reportSummaryCategoryPicker;
        _reportSummaryCategoryPicker = null;
        closeDrawer();
        if (!pending) return;
        const carryChoice = getReportCarryChoices(pending.periodKey);
        openReportChoiceGrid(carryChoice.title, carryChoice.choices, pending.carry || 'current', (carry) => {
            saveReportSummarySlot(pending.view, pending.index, {
                id: 'categoryAverage', l1, l2: l2 || l1, carry,
            }, pending.periodKey);
        });
        return;
    }
    if (pickerMode !== 'shortcut' && pickerMode !== 'shortcut-edit' && pickerMode !== 'parallel-shortcut') {
        recordRecentPick(l1, l2);
    }
    if (pickerMode === 'classify-log') {
        const log = logs.find((l) => l.id === _classifyTargetLogId);
        if (log) {
            log.l1 = l1;
            log.l2 = l2 || '';
            log.color = getCat(l1)?.color || log.color;
            log.status = 'ok';
            rememberInputAlias(log.note, l1, l2);
            localStorage.setItem('v9_logs', JSON.stringify(logs));
        }
        _classifyPromptOpen = false;
        _classifyTargetLogId = null;
        closeDrawer();
        renderAll();
        setTimeout(flushUncategorizedClassifyPrompt, 80);
        return;
    }
    if (pickerMode === 'shortcut') {
        executeAddShortcut(l1, l2);
    } else if (pickerMode === 'shortcut-edit') {
        executeEditShortcut(l1, l2);
    } else if (pickerMode === 'parallel-record') {
        const cat = getCat(l1);
        const t = document.getElementById('parallel-start').value.split(':');
        const dur = parseInt(document.getElementById('parallel-dur').value) || 30;
        const now = nowSecondMs();
        const d = new Date(now);
        d.setHours(+t[0], +t[1], 0, 0);
        if (d.getTime() > now) d.setDate(d.getDate() - 1);
        const entry = {
            id: genId(),
            startTime: d.getTime(),
            endTime: d.getTime() + dur * 60000,
            duration: dur,
            l1, l2: l2 || '',
            tag: '', note: document.getElementById('drawer-note').value || '',
            color: cat?.color || '#cbd5e1',
            parallel: true,
            parentId: current?.id || null
        };
        logs.unshift(entry);
        localStorage.setItem('v9_logs', JSON.stringify(logs));
        closeDrawer();
        renderAll();
    } else if (pickerMode === 'edit' || pickerMode === 'split' || (pickerMode && pickerMode.startsWith('parallel-backfill'))) {
        if (pickerMode.startsWith('parallel-backfill')) {
            snapTimeToRange();
            if (!isTimeInParentRange()) {
                showConfirm('⏱ 时间不合法', '开始或结束时间超出了父活动的范围，请调整后重新选择分类。', '知道了', () => {});
                return;
            }
        }
        const selectedRange = _backfillRange
            ? {
                start: parseTimeFromInput('ps', _backfillRange.start),
                end: parseTimeFromInput('pe', _backfillRange.start)
            }
            : null;
        if (pickerMode === 'split') {
            if (!selectedRange || !Number.isFinite(selectedRange.start) || !Number.isFinite(selectedRange.end)
                || selectedRange.start >= selectedRange.end) {
                showConfirm('时间不合法', '请先调整切割的开始和结束时间。', '知道了', () => {});
                return;
            }
            if (selectedRange.start === _backfillRange.start && selectedRange.end === _backfillRange.end) {
                showConfirm('请先选择切割范围', '当前仍选中整条时间线，请移动开始或结束位置。', '知道了', () => {});
                return;
            }
        }
        const cb = _parallelCallback;
        closeDrawer();
        if (cb) { cb(l1, l2, selectedRange); }
    } else {
        executeRecord(l1, l2, "", document.getElementById('drawer-note').value);
    }
}

function renderShortcuts() {
    const container = document.getElementById('home-shortcuts');
    const section = document.getElementById('main-shortcut-section');
    if (section) section.classList.toggle('hidden', isSceneActive());
    container.innerHTML = "";
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = "shortcut-add-btn shortcut-add-btn--main btn-active";
    addBtn.innerText = "＋";
    addBtn.title = "记一笔活动";
    addBtn.addEventListener('click', () => { openDrawerForRecord(); });
    container.appendChild(addBtn);
    const n = shortcuts.length;
    let cols = 3;
    if (n <= 2) cols = n;
    else if (n === 3 || n === 4) cols = 2;
    else if (n >= 7 && n <= 8) cols = 4;
    const grid = document.createElement('div');
    grid.className = `shortcut-grid grid grid-cols-${cols} gap-1.5 flex-1`;
    shortcuts.forEach((s, idx) => {
        const item = document.createElement('button');
        item.type = 'button';
        const isPressed = current && (
            (!current.l1 && !current.l2) ||
            (current.l1 === s.l1 && current.l2 === s.l2)
        );
        item.className = `keycap keycap--main${isPressed ? ' pressed' : ''} btn-active`;
        let pressTimer = null;
        let longPressed = false;
        const clearPress = () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; };
        item.addEventListener('pointerdown', () => {
            longPressed = false;
            pressTimer = setTimeout(() => { longPressed = true; editShortcut(idx); }, 550);
        });
        item.addEventListener('pointerup', clearPress);
        item.addEventListener('pointerleave', clearPress);
        item.addEventListener('pointercancel', clearPress);
        item.addEventListener('click', (e) => {
            if (longPressed) { e.preventDefault(); return; }
            if (recordMode !== 'journal' && isSameClassifiedMainActivity(s.l1, s.l2)) return;
            pickerMode = 'record';
            executeRecord(s.l1, s.l2, "", "");
        });
        const icon = document.createElement('span');
        icon.className = "keycap-icon";
        icon.innerText = resolveShortcutIcon(s);
        const label = document.createElement('span');
        label.className = "keycap-label";
        label.innerText = s.l2 || s.l1;
        item.append(icon, label);
        grid.appendChild(item);
    });
    container.appendChild(grid);
}
function renderParallelShortcuts() {
    const container = document.getElementById('parallel-shortcuts');
    container.innerHTML = "";
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = "shortcut-add-btn shortcut-add-btn--parallel btn-active";
    addBtn.innerText = "＋";
    addBtn.title = "记一笔并行活动";
    addBtn.addEventListener('click', () => {
        _parallelPending = true;
        openDrawerForRecord();
    });
    container.appendChild(addBtn);
    const n = parallelShortcuts.length;
    let cols = 3;
    if (n <= 2) cols = n;
    else if (n === 3 || n === 4) cols = 2;
    else if (n >= 7 && n <= 8) cols = 4;
    const grid = document.createElement('div');
    grid.className = `shortcut-grid grid grid-cols-${cols} gap-1.5 flex-1`;
    parallelShortcuts.forEach((s, idx) => {
        const item = document.createElement('button');
        item.type = 'button';
        const isActive = parallelCurrent && parallelCurrent.l1 === s.l1 && parallelCurrent.l2 === s.l2;
        item.className = `keycap keycap--parallel-slot${isActive ? ' pressed' : ''} btn-active`;
        item.dataset.slotIdx = String(idx % 2);
        item.title = s.l2 || s.l1;
        const icon = document.createElement('span');
        icon.className = "keycap-icon";
        icon.innerText = resolveShortcutIcon(s);
        const label = document.createElement('span');
        label.className = "keycap-label";
        label.innerText = s.l2 || s.l1;
        item.append(icon, label);
        item.addEventListener('click', () => { toggleParallel(s.l1, s.l2, resolveShortcutIcon(s)); });
        grid.appendChild(item);
    });
    container.appendChild(grid);
    updateParallelStatus();
}
function toggleParallel(l1, l2, icon) {
    if (!current) {
        showConfirm('先开启主线', '并行需要归属一条主线，请先选择主线活动。', '知道了', () => {});
        return;
    }
    const now = nowSecondMs();
    // 结束当前并行 → 存入 parallelHistory
    if (parallelCurrent) {
        const dur = Math.max(1, Math.round((now - parallelCurrent.startTime) / 60000));
        parallelHistory.unshift({
            ...parallelCurrent,
            endTime: now,
            duration: dur,
            parallel: true,
            parentId: parallelCurrent.parentId || current?.id || null,
            note: parallelCurrent.note || ''
        });
        if (parallelCurrent.l1 === l1 && parallelCurrent.l2 === l2) {
            // 点同一个并行 → 只结束，不开新的
            parallelCurrent = null;
            localStorage.removeItem('v9_parallel');
        } else {
            // 点不同的并行 → 结束旧的，开新的
            parallelCurrent = { id: genId(), startTime: now, l1, l2, icon: icon || '📌', note: '', parentId: current?.id || null, sceneName: current?.scene ? current.l2 : '' };
            localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
        }
        localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
    } else {
        // 没有并行在跑 → 直接开新的
        parallelCurrent = { id: genId(), startTime: now, l1, l2, icon: icon || '📌', note: '', parentId: current?.id || null, sceneName: current?.scene ? current.l2 : '' };
        localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
    }
    renderParallelShortcuts();
    renderAll();
}
function updateParallelStatus() {
    const badge = document.getElementById('parallel-status');
    if (!badge) return;
    if (parallelCurrent) {
        badge.classList.remove('hidden');
        badge.innerText = `${parallelCurrent.icon || '⏎'} ${parallelCurrent.l2 || parallelCurrent.l1}`;
    } else {
        badge.classList.add('hidden');
    }
}
function openDrawer() {
    pickerMode = 'record';
    setDrawerDevAddress('B13');
    document.getElementById('drawer-title').innerText = "记一笔活动";
    document.getElementById('parallel-time-row').classList.add('hidden');
    showDrawer();
    renderDrawerToggle();
    document.getElementById('drawer-note').value = "";
    document.getElementById('drawer-footer').classList.remove('hidden');
    renderPicker();
}
function openDrawerForRecord() {
    pickerMode = 'record';
    setDrawerDevAddress('B13');
    _parallelCallback = null;
    document.getElementById('drawer-title').innerText = "记一笔活动";
    document.getElementById('parallel-time-row').classList.add('hidden');
    document.getElementById('drawer-footer').classList.remove('hidden');
    document.getElementById('drawer-note').placeholder = "选填备注...";
    document.getElementById('drawer-note').value = "";
    showDrawer();
    renderPicker();
    renderDrawerToggle();
}

function editShortcut(idx) {
    const s = shortcuts[idx];
    if (!s) return;
    showPrompt("编辑快捷入口 Emoji", "输入一个 Emoji", s.icon || "📌", (icon) => {
        if (icon === null) return;
        shortcuts[idx].icon = icon.trim() || "📌";
        shortcuts[idx].customIcon = true;
        localStorage.setItem('v9_shorts', JSON.stringify(shortcuts));
        if (confirm("要重新选择这个快捷入口的分类吗？")) {
            editingShortcutIndex = idx;
            pickerMode = 'shortcut-edit';
            setDrawerDevAddress('B64');
            document.getElementById('drawer-title').innerText = "修改快捷入口";
            document.getElementById('drawer-footer').classList.add('hidden');
            showDrawer();
            renderPicker();
        } else {
            renderAll();
        }
    });
}

function syncConfigSectionUI() {
    document.querySelectorAll('.config-tile[data-config-section]').forEach((el) => {
        el.classList.toggle('active', el.dataset.configSection === configSectionOpen);
        el.setAttribute('aria-expanded', String(el.dataset.configSection === configSectionOpen));
    });
    const expand = document.getElementById('config-expand');
    if (expand) expand.classList.toggle('hidden', !configSectionOpen);
    ['config-edit-btn', 'scene-edit-btn'].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.innerText = configEditMode ? '完成' : '编辑';
        btn.className = configEditMode
            ? 'text-[10px] bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-full font-black'
            : 'text-[10px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full font-black';
    });
    ['clock', 'report', 'cats', 'scene', 'event', 'mode', 'data'].forEach((id) => {
        const panel = document.getElementById('config-panel-' + id);
        if (panel) panel.classList.toggle('hidden', configSectionOpen !== id);
    });
}

function openConfigSection(id) {
    configSectionOpen = configSectionOpen === id ? null : id;
    syncConfigSectionUI();
    renderConfig();
}
window.openConfigSection = openConfigSection;

function setRecordMode(mode) {
    if (mode !== 'continuous' && mode !== 'journal') return;
    if (mode === recordMode) return;
    const label = mode === 'journal' ? '手账模式' : '24 小时模式';
    const message = mode === 'journal'
        ? '切换后可结束当前主线，空出的时段会作为“未记录时间”进入报表。正在运行的主线与并行不会被清除。'
        : '切换后主线恢复连续记录；已有的手账空档不会被补造记录。正在运行的主线与并行不会被清除。';
    showConfirm(`切换到${label}？`, message, '确认切换', (ok) => {
        if (!ok) return;
        recordMode = mode;
        localStorage.setItem('v9_record_mode', mode);
        if (mode === 'journal' && current && !current.scene) {
            current.journal = true;
            localStorage.setItem('v9_current', JSON.stringify(current));
        }
        if (!localStorage.getItem('v9_tracking_start')) {
            localStorage.setItem('v9_tracking_start', String(nowSecondMs()));
        }
        renderAll();
    });
}
window.setRecordMode = setRecordMode;

function switchCategoryConfigTab(tab) {
    if (!['categories', 'shortcut', 'parallel'].includes(tab)) return;
    categoryConfigTab = tab;
    renderConfig();
}
window.switchCategoryConfigTab = switchCategoryConfigTab;

function toggleConfigEdit() {
    configEditMode = !configEditMode;
    renderConfig();
}

function renderReportSummarySettings() {
    const box = document.getElementById('report-summary-settings-ui');
    if (!box || typeof REPORT_METRIC_POOL === 'undefined') return;
    box.innerHTML = '';

    const mode = localStorage.getItem('v9_report_summary_mode') === 'separate' ? 'separate' : 'shared';
    const selectedPeriod = localStorage.getItem('v9_report_summary_period') === 'month' ? 'month' : 'week';

    const makeSegmented = (label, options, selected, onChange) => {
        const row = document.createElement('div');
        row.className = 'summary-control-row';
        const text = document.createElement('span');
        text.className = 'summary-control-label';
        text.innerText = label;
        const group = document.createElement('div');
        group.className = 'summary-segmented';
        options.forEach(([value, optionLabel]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'summary-segment' + (selected === value ? ' is-selected' : '');
            button.innerText = optionLabel;
            button.addEventListener('click', () => onChange(value));
            group.appendChild(button);
        });
        row.append(text, group);
        return row;
    };

    const modeRow = document.createElement('div');
    modeRow.className = 'summary-control-row';
    const modeLabel = document.createElement('span');
    modeLabel.className = 'summary-control-label';
    modeLabel.innerText = '摘要是否共用';
    const modeSwitch = document.createElement('button');
    modeSwitch.type = 'button';
    modeSwitch.className = 'summary-share-switch' + (mode === 'shared' ? ' is-on' : '');
    modeSwitch.setAttribute('role', 'switch');
    modeSwitch.setAttribute('aria-label', '周报和月报共用摘要');
    modeSwitch.setAttribute('aria-checked', String(mode === 'shared'));
    modeSwitch.title = mode === 'shared' ? '周报和月报共用一套摘要' : '周报和月报分别设置摘要';
    modeSwitch.innerHTML = '<span></span>';
    modeSwitch.addEventListener('click', () => {
        localStorage.setItem('v9_report_summary_mode', mode === 'shared' ? 'separate' : 'shared');
        renderReportSummarySettings();
        if (typeof renderReportBillboard === 'function') renderReportBillboard();
    });
    modeRow.append(modeLabel, modeSwitch);
    box.appendChild(modeRow);
    if (mode === 'separate') {
        box.appendChild(makeSegmented('报表周期', [['week', '周报'], ['month', '月报']], selectedPeriod, (value) => {
            localStorage.setItem('v9_report_summary_period', value);
            renderReportSummarySettings();
        }));
    }

    const periodKey = mode === 'separate' ? selectedPeriod : 'shared';
    ['main', 'parallel'].forEach((view) => {
        const title = view === 'main' ? '主线摘要（3 格）' : '并行摘要（3 格）';
        const wrap = document.createElement('div');
        wrap.className = 'summary-settings-group';
        const h = document.createElement('div');
        h.className = 'text-[11px] font-black text-slate-600';
        h.innerText = mode === 'separate'
            ? `${selectedPeriod === 'week' ? '周报' : '月报'} · ${title}`
            : title;
        wrap.appendChild(h);
        const slots = getReportSummarySlots(view, periodKey);
        slots.forEach((slot, idx) => {
            const row = document.createElement('div');
            row.className = 'summary-slot-row';
            const lab = document.createElement('span');
            lab.className = 'text-[10px] font-bold text-slate-400 w-8 shrink-0';
            lab.innerText = `格${idx + 1}`;
            const trigger = createPickerTrigger(getReportSummarySlotLabel(slot, view, periodKey), () => openReportSummarySlotPicker(view, idx, periodKey));
            row.append(lab, trigger);
            wrap.appendChild(row);
        });
        box.appendChild(wrap);
    });
}

function getReportCarryCopy(carry, periodKey) {
    const previous = carry === 'previous';
    if (periodKey === 'week') return previous ? '归入周日结束的上一周' : '归入周一开始的新一周';
    if (periodKey === 'month') return previous ? '归入上一个月' : '归入新开始的这个月';
    return previous ? '周归上周 / 月归上月' : '周归新周 / 月归新月';
}

function getReportCarryChoices(periodKey) {
    if (periodKey === 'week') {
        return { title: '跨周记录归到哪份周报？', choices: [
            { value: 'current', label: '归入周一开始的新一周' },
            { value: 'previous', label: '归入周日结束的上一周' },
        ] };
    }
    if (periodKey === 'month') {
        return { title: '跨月记录归到哪份月报？', choices: [
            { value: 'current', label: '归入新开始的这个月' },
            { value: 'previous', label: '归入上一个月' },
        ] };
    }
    return { title: '跨周期时间归属', choices: [
        { value: 'current', label: '归入新开始的周期' },
        { value: 'previous', label: '归入上一个周期' },
    ] };
}

function getReportSummarySlotLabel(slot, view, periodKey) {
    const normalized = typeof slot === 'string' ? { id: slot } : (slot || {});
    const metric = REPORT_METRIC_POOL[view]?.find((item) => item.id === normalized.id);
    if (normalized.id !== 'categoryAverage') return metric?.label || '—';
    const categoryLabel = normalized.l1 && normalized.l2
        ? `${normalized.l1} / ${normalized.l2}`
        : normalized.category;
    if (!categoryLabel) return '类别平均 · 请选择';
    return `类别平均 · ${categoryLabel} · ${getReportCarryCopy(normalized.carry, periodKey)}`;
}

function openReportChoiceGrid(title, choices, selected, onSelect) {
    document.getElementById('report-choice-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'report-choice-overlay';
    overlay.className = 'report-choice-overlay';
    const panel = document.createElement('div');
    panel.className = 'report-choice-panel';
    const head = document.createElement('div');
    head.className = 'report-choice-head';
    const titleEl = document.createElement('span');
    titleEl.innerText = title;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'report-choice-close';
    close.innerText = '×';
    close.addEventListener('click', () => overlay.remove());
    head.append(titleEl, close);
    const grid = document.createElement('div');
    grid.className = 'report-choice-grid';
    choices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'report-choice-item' + (choice.value === selected ? ' is-selected' : '');
        if (choice.color) {
            btn.style.borderColor = choice.color;
            btn.style.color = choice.color;
            btn.style.background = colorWithAlpha(choice.color, .08);
        }
        btn.innerText = choice.label;
        btn.addEventListener('click', () => {
            overlay.remove();
            onSelect(choice.value);
        });
        grid.appendChild(btn);
    });
    panel.append(head, grid);
    overlay.appendChild(panel);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

function saveReportSummarySlot(view, index, slot, periodKey) {
    const next = getReportSummarySlots(view, periodKey);
    next[index] = slot;
    saveReportSummarySlots(view, next, periodKey);
    renderReportSummarySettings();
    if (typeof renderReportBillboard === 'function') renderReportBillboard();
}

function openReportSummarySlotPicker(view, index, periodKey) {
    const current = getReportSummarySlots(view, periodKey)[index] || {};
    const choices = (REPORT_METRIC_POOL[view] || []).map((item) => ({ value: item.id, label: item.label }));
    openReportChoiceGrid(`${view === 'main' ? '主线' : '并行'} · 选择摘要`, choices, current.id, (metricId) => {
        if (metricId !== 'categoryAverage') {
            saveReportSummarySlot(view, index, { id: metricId }, periodKey);
            return;
        }
        openReportSummaryCategoryDrawer(view, index, periodKey, current);
    });
}

function openReportSummaryCategoryDrawer(view, index, periodKey, current) {
    _reportSummaryCategoryPicker = { view, index, periodKey, carry: current?.carry || 'current' };
    const preferredL1 = current?.l1;
    if (preferredL1 && cats.some((cat) => cat.name === preferredL1)) selL1 = preferredL1;
    pickerMode = 'report-summary-category';
    setDrawerDevAddress('B67');
    document.getElementById('drawer-title').innerText = '选择二级目录';
    document.getElementById('drawer-footer').classList.add('hidden');
    showDrawer();
    renderPicker();
    renderDrawerToggle();
}

const COLOR_PRESETS = ['#f59e0b', '#0ea5e9', '#14b8a6', '#22c55e', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#334155'];

function openZoneColorPicker(currentColor, onSelect) {
    document.querySelector('.zone-color-picker-overlay')?.remove();
    document.querySelector('.zone-color-picker-popup')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'zone-color-picker-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
    const popup = document.createElement('div');
    popup.className = 'zone-color-picker-popup';
    popup.style.cssText = 'position:fixed;z-index:9999;background:#fff;border-radius:12px;padding:14px;box-shadow:0 12px 36px rgba(15,23,42,.18);top:50%;left:50%;transform:translate(-50%,-50%);';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5, 36px);gap:9px;';
    COLOR_PRESETS.forEach((color) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.style.cssText = `width:36px;height:36px;border-radius:50%;background:${color};border:2px solid ${currentColor === color ? '#0f172a' : '#e2e8f0'};`;
        swatch.addEventListener('click', (event) => {
            event.stopPropagation();
            onSelect(color);
            popup.remove();
            overlay.remove();
        });
        grid.appendChild(swatch);
    });
    overlay.addEventListener('click', () => { popup.remove(); overlay.remove(); });
    popup.appendChild(grid);
    document.body.append(overlay, popup);
}

function renderSceneSettings() {
    const host = document.getElementById('scene-settings-ui');
    const sceneCat = getCat('场景');
    if (!host || !sceneCat) return;
    host.innerHTML = '';

    const addRow = (label, color, editName, editColor, fixed, remove) => {
        const row = document.createElement('div');
        row.className = 'scene-settings-row';
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'scene-settings-dot';
        dot.style.background = color;
        dot.title = configEditMode ? '修改颜色' : '区域颜色';
        dot.disabled = !configEditMode;
        if (!configEditMode) dot.style.cursor = 'default';
        if (configEditMode) dot.addEventListener('click', editColor);
        const name = document.createElement('span');
        name.className = 'scene-settings-name';
        name.innerText = label;
        row.append(dot, name);
        if (configEditMode) {
            row.classList.add('cursor-pointer');
            row.addEventListener('click', (event) => {
                if (event.target.closest('button')) return;
                editName();
            });
        }
        if (configEditMode && remove) {
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'scene-settings-edit';
            del.style.background = '#fef2f2';
            del.style.color = '#ef4444';
            del.innerText = '✕';
            del.title = '删除场景';
            del.addEventListener('click', remove);
            row.appendChild(del);
        }
        host.appendChild(row);
    };

    addRow(sceneSettings.homeLabel, sceneSettings.homeColor,
        () => showPrompt('编辑生活区名称', '这个名称只用于顶部区域显示。', sceneSettings.homeLabel, (name) => {
            const next = String(name || '').trim();
            if (!next) return;
            sceneSettings.homeLabel = next;
            saveSceneSettings();
            renderAll();
        }),
        () => openZoneColorPicker(sceneSettings.homeColor, (color) => {
            sceneSettings.homeColor = color;
            saveSceneSettings();
            renderAll();
        }),
        true
    );

    const toggleRow = document.createElement('div');
    toggleRow.className = 'scene-settings-row';
    const toggleText = document.createElement('span');
    toggleText.className = 'scene-settings-name';
    toggleText.innerText = '场景辨识色';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'scene-color-toggle' + (sceneSettings.showSceneColor ? ' is-on' : '');
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', String(sceneSettings.showSceneColor));
    toggle.title = sceneSettings.showSceneColor ? '进入场景时显示颜色边框' : '进入场景时不显示颜色边框';
    toggle.appendChild(document.createElement('i'));
    toggle.addEventListener('click', () => {
        sceneSettings.showSceneColor = !sceneSettings.showSceneColor;
        saveSceneSettings();
        renderAll();
    });
    toggleRow.append(toggleText, toggle);
    host.appendChild(toggleRow);

    (sceneCat.subs || []).forEach((sceneName) => {
        ensureSceneColor(sceneName);
        addRow(sceneName, getSceneColor(sceneName),
            () => editS(sceneCat.id, sceneName),
            () => openZoneColorPicker(getSceneColor(sceneName), (color) => {
                sceneSettings.colors[sceneName] = color;
                saveSceneSettings();
                if (current?.scene && current.l2 === sceneName) current.color = color;
                if (current) localStorage.setItem('v9_current', JSON.stringify(current));
                renderAll();
            }),
            false,
            () => delS(sceneCat.id, sceneName)
        );
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'w-full py-2.5 text-[11px] font-black text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-lg';
    add.innerText = '＋ 新增场景';
    add.addEventListener('click', () => addS(sceneCat.id));
    host.appendChild(add);
}

function saveEventTypes() {
    localStorage.setItem('v9_event_types', JSON.stringify(eventTypes));
}

function saveEventRecords() {
    localStorage.setItem('v9_event_records', JSON.stringify(eventRecords));
}

function eventNameAvailable(name, exceptId) {
    const normalized = String(name || '').trim();
    return normalized && !EVENT_RESERVED_NAMES.has(normalized)
        && !eventTypes.some((item) => item.id !== exceptId && item.name === normalized);
}

function addEventType(options = {}) {
    showPrompt('新增事件', '例如：上厕所、吃饭、喝水', '', (name) => {
        const next = String(name || '').trim();
        if (!next) return;
        if (!eventNameAvailable(next)) {
            showConfirm('名称不能使用', EVENT_RESERVED_NAMES.has(next) ? '“睡觉”已被系统时间类别占用。' : '事件名称不能重复。', '知道了', () => {});
            return;
        }
        showCategoryPicker('选择事件图标', (icon) => {
            if (!icon) return;
            eventTypes.push({ id: genId(), name: next, icon, color: EVENT_COLORS[eventTypes.length % EVENT_COLORS.length], quick: options.quick === true, group: '' });
            saveEventTypes();
            renderAll();
        });
    });
}
window.addEventType = addEventType;
function startEventHomeCreate(quick) {
    document.getElementById('event-home-create').classList.add('hidden');
    addEventType({ quick });
}

function renderEventSettings(hostId = 'event-settings-ui') {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';
    if (!eventTypes.length) {
        const empty = document.createElement('div');
        empty.className = 'text-center text-[11px] text-slate-400 py-4';
        empty.innerText = '还没有事件，点击“新增”开始。';
        host.appendChild(empty);
        return;
    }
    eventTypes.forEach((eventType) => {
        const row = document.createElement('div');
        row.className = 'event-manager-item';
        const heading = document.createElement('button');
        heading.type = 'button';
        heading.className = 'event-manager-heading';
        heading.setAttribute('aria-expanded', 'false');
        const headingLabel = document.createElement('span');
        if (hostId === 'event-center-types') {
            headingLabel.className = 'event-manager-identity';
            const iconLabel = document.createElement('span'); iconLabel.className = 'event-manager-type-icon'; iconLabel.textContent = eventType.icon;
            const text = document.createElement('span'); text.className = 'event-manager-type-text';
            const title = document.createElement('strong'); title.textContent = eventType.name;
            const meta = document.createElement('small'); meta.textContent = eventType.disabled ? '已停用' : (eventType.group || '未分类');
            text.append(title, meta); headingLabel.append(iconLabel, text);
        } else headingLabel.textContent = `${eventType.icon}  ${eventType.name}${eventType.disabled ? ' · 已停用' : ''}`;
        const arrow = document.createElement('span'); arrow.textContent = '›';
        heading.append(headingLabel, arrow);
        const detail = document.createElement('div');
        detail.className = 'event-manager-detail';
        detail.hidden = true;
        heading.addEventListener('click', () => {
            detail.hidden = !detail.hidden;
            heading.setAttribute('aria-expanded', String(!detail.hidden));
        });
        const color = document.createElement('button');
        color.type = 'button';
        color.className = 'scene-settings-dot';
        color.style.background = eventType.color;
        color.title = '修改颜色';
        color.setAttribute('aria-label', '修改颜色');
        color.addEventListener('click', () => openZoneColorPicker(eventType.color, (next) => {
            eventType.color = next;
            saveEventTypes();
            renderAll();
        }));
        const icon = document.createElement('button');
        icon.type = 'button';
        icon.className = 'event-settings-icon';
        icon.innerText = eventType.icon;
        icon.title = '修改图标';
        icon.setAttribute('aria-label', '修改图标');
        icon.addEventListener('click', () => showCategoryPicker('选择事件图标', (next) => {
            if (!next) return;
            eventType.icon = next;
            saveEventTypes();
            renderAll();
        }));
        const name = document.createElement('button');
        name.type = 'button';
        name.className = 'event-manager-action';
        name.innerText = '修改名称';
        name.title = '点击修改名称';
        name.addEventListener('click', () => showPrompt('修改事件名称', '输入事件名称', eventType.name, (next) => {
            const value = String(next || '').trim();
            if (!value || value === eventType.name) return;
            if (!eventNameAvailable(value, eventType.id)) {
                showConfirm('名称不能使用', EVENT_RESERVED_NAMES.has(value) ? '“睡觉”已被系统时间类别占用。' : '事件名称不能重复。', '知道了', () => {});
                return;
            }
            eventType.name = value;
            saveEventTypes();
            renderAll();
        }));
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'scene-settings-edit';
        del.style.background = '#fef2f2';
        del.style.color = '#ef4444';
        del.innerText = '删除事件';
        del.title = '删除事件类别';
        del.addEventListener('click', () => showConfirm('删除事件类别', `删除“${eventType.name}”后，历史事件会保留但不再可新增。`, '删除', (ok) => {
            if (!ok) return;
            eventTypes = eventTypes.filter((item) => item.id !== eventType.id);
            saveEventTypes();
            renderAll();
        }));
        const colorLabel = document.createElement('div'); colorLabel.className = 'event-manager-option';
        const colorText = document.createElement('span'); colorText.textContent = '颜色'; colorLabel.append(colorText, color);
        const iconLabel = document.createElement('div'); iconLabel.className = 'event-manager-option';
        const iconText = document.createElement('span'); iconText.textContent = '图标'; iconLabel.append(iconText, icon);
        const enabled = document.createElement('button');
        enabled.type = 'button';
        enabled.className = 'event-manager-action';
        enabled.textContent = eventType.disabled ? '启用事件' : '停用事件';
        enabled.addEventListener('click', () => {
            eventType.disabled = !eventType.disabled;
            saveEventTypes(); renderAll();
        });
        const moveUp = document.createElement('button');
        moveUp.type = 'button'; moveUp.textContent = '上移';
        moveUp.className = 'event-manager-action';
        moveUp.disabled = eventTypes.indexOf(eventType) === 0;
        moveUp.addEventListener('click', () => {
            const index = eventTypes.indexOf(eventType);
            if (index < 1) return;
            [eventTypes[index - 1], eventTypes[index]] = [eventTypes[index], eventTypes[index - 1]];
            saveEventTypes(); renderAll();
        });
        const group = document.createElement('button');
        group.type = 'button'; group.className = 'event-manager-action';
        group.textContent = `分组：${eventType.group || '未分组'}`;
        group.addEventListener('click', () => showPrompt('事件分组', '填写分组名称，留空为未分组', eventType.group || '', value => {
            if (value === null || value === undefined) return;
            eventType.group = String(value).trim(); saveEventTypes(); renderAll();
        }));
        const mode = document.createElement('button');
        mode.type = 'button'; mode.className = 'event-manager-action';
        mode.textContent = eventType.quick ? '记录方式：快速' : '记录方式：详细';
        mode.addEventListener('click', () => { eventType.quick = !eventType.quick; saveEventTypes(); renderAll(); });
        detail.append(colorLabel, iconLabel, name, group, mode, enabled, moveUp, del);
        row.append(heading, detail);
        host.appendChild(row);
    });
}

function renderConfig() {
    syncConfigSectionUI();
    document.querySelectorAll('[data-category-tab]').forEach((button) => {
        const selected = button.dataset.categoryTab === categoryConfigTab;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', String(selected));
    });
    ['categories', 'shortcut', 'parallel'].forEach((tab) => {
        document.getElementById('category-config-' + tab)?.classList.toggle('hidden', categoryConfigTab !== tab);
    });
    document.querySelectorAll('[data-record-mode]').forEach((button) => {
        const selected = button.dataset.recordMode === recordMode;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    renderClockSettings();
    renderReportSummarySettings();
    renderSceneSettings();
    renderEventSettings();
    [['shortcut-list', shortcuts, 'v9_shorts'], ['parallel-shortcut-list', parallelShortcuts, 'v9_parallel_shorts']].forEach(([id, list, key]) => {
        const host = document.getElementById(id);
        host.innerHTML = '';
        list.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'category-selected-item';
            const icon = document.createElement('span');
            icon.className = 'category-selected-icon';
            icon.innerText = resolveShortcutIcon(item);
            const names = document.createElement('span');
            names.className = 'category-selected-names';
            const name = document.createElement('strong');
            name.innerText = item.l2 || item.l1;
            const parent = document.createElement('small');
            parent.innerText = item.l2 ? item.l1 : '一级分类';
            names.append(name, parent);
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'category-selected-remove';
            remove.innerText = '×';
            remove.title = `移除${item.l2 || item.l1}`;
            remove.setAttribute('aria-label', remove.title);
            remove.addEventListener('click', () => {
                if (key === 'v9_shorts') shortcuts.splice(index, 1);
                else parallelShortcuts.splice(index, 1);
                localStorage.setItem(key, JSON.stringify(key === 'v9_shorts' ? shortcuts : parallelShortcuts));
                renderAll();
            });
            row.append(icon, names, remove);
            host.appendChild(row);
        });
    });
    const catList = document.getElementById('full-cat-list');
    catList.innerHTML = "";
    cats.filter(c => c.name !== '场景').forEach(c => {
        const wrap = document.createElement('div');
        const expanded = expandedCategoryId === null ? c.id === cats.find(item => item.name !== '场景')?.id : expandedCategoryId === c.id;
        wrap.className = 'category-group';

        const head = document.createElement('div');
        head.className = 'category-group-head';
        const titleGroup = document.createElement('div');
        titleGroup.className = 'category-group-title';
        const PRESET_COLORS = ['#f59e0b','#06b6d4','#10b981','#0ea5e9','#f97316','#c4841a','#ec4899','#3b82f6','#ef4444','#8b5cf6','#a0522d','#334155'];
        const colorDot = document.createElement('button');
        colorDot.type = 'button';
        colorDot.className = "w-3.5 h-3.5 rounded-full shrink-0 cursor-pointer";
        colorDot.style.background = c.color || '#6366f1';
        colorDot.title = expanded ? "点击修改颜色" : "分类颜色";
        colorDot.setAttribute('aria-label', colorDot.title);
        colorDot.disabled = !expanded;
        if (!expanded) colorDot.style.cursor = 'default';
        if (expanded) colorDot.addEventListener('click', (e) => {
            e.stopPropagation();
            const old = document.querySelector('.color-picker-popup');
            if (old) { document.querySelector('.color-picker-overlay')?.remove(); old.remove(); return; }
            const overlay = document.createElement('div');
            overlay.className = 'color-picker-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
            overlay.addEventListener('click', () => { popup.remove(); overlay.remove(); });
            document.body.appendChild(overlay);
            const popup = document.createElement('div');
            popup.className = 'color-picker-popup';
            popup.style.cssText = 'position:fixed;z-index:9999;background:white;border-radius:20px;padding:14px;box-shadow:0 8px 32px rgba(0,0,0,0.15);top:50%;left:50%;transform:translate(-50%,-50%);width:auto;';
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:8px;';
            PRESET_COLORS.forEach(clr => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.style.cssText = `width:36px;height:36px;border-radius:50%;background:${clr};border:2px solid ${c.color === clr ? '#0f172a' : '#e2e8f0'};cursor:pointer;`;
                swatch.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    c.color = clr;
                    colorDot.style.background = clr;
                    localStorage.setItem('v9_cats', JSON.stringify(cats));
                    renderAll();
                    popup.remove();
                    overlay.remove();
                });
                grid.appendChild(swatch);
            });
            popup.appendChild(grid);
            document.body.appendChild(popup);
        });
        const title = document.createElement('span');
        title.innerText = `${c.icon} ${c.name}`;
        const count = document.createElement('small'); count.className = 'category-manager-count'; count.textContent = `${c.subs.length}项`;
        titleGroup.append(colorDot, title, count);
        head.appendChild(titleGroup);
        const chevron = document.createElement('button');
        chevron.type = 'button';
        chevron.className = 'category-expand-button';
        chevron.innerText = expanded ? '⌃' : '⌄';
        chevron.title = expanded ? '收起二级活动' : '展开二级活动';
        chevron.setAttribute('aria-expanded', String(expanded));
        chevron.addEventListener('click', () => {
            expandedCategoryId = expanded ? -1 : c.id;
            renderConfig();
        });
        titleGroup.addEventListener('click', () => chevron.click());
        head.appendChild(chevron);
        wrap.appendChild(head);

        const subs = document.createElement('div');
        subs.className = 'category-sub-list';
        subs.hidden = !expanded;
        const categoryActions = document.createElement('div'); categoryActions.className = 'category-manager-actions';
        const editCategory = document.createElement('button'); editCategory.type = 'button'; editCategory.textContent = '编辑分类'; editCategory.addEventListener('click', () => editL1(c.id));
        const deleteCategory = document.createElement('button'); deleteCategory.type = 'button'; deleteCategory.textContent = '删除分类'; deleteCategory.addEventListener('click', () => delL1(c.id));
        categoryActions.append(editCategory, deleteCategory);
        c.subs.forEach(name => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'category-sub-row';
            const iconEl = document.createElement('div');
            iconEl.className = 'category-sub-icon';
            iconEl.innerText = getSubIcon(name, c.icon, c);
            card.appendChild(iconEl);
            const nameEl = document.createElement('span');
            nameEl.className = 'category-sub-name';
            nameEl.innerText = name;
            card.appendChild(nameEl);
            const arrow = document.createElement('span'); arrow.className = 'category-manager-arrow'; arrow.textContent = '›'; card.appendChild(arrow);
            card.addEventListener('click', () => {
                const choices = [{ value: 'edit', label: isSystemSleep(c, name) ? '移动或修改图标' : '修改活动' }];
                if (!isSystemSleep(c, name)) choices.push({ value: 'delete', label: '删除活动' });
                openReportChoiceGrid(name, choices, '', (action) => {
                    if (action === 'edit') editS(c.id, name);
                    else if (action === 'delete') delS(c.id, name);
                });
            });
            subs.appendChild(card);
        });
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'category-add-button';
        addBtn.innerText = '＋ 新增二级活动';
        addBtn.addEventListener('click', () => addS(c.id));
        subs.appendChild(addBtn);
        subs.appendChild(categoryActions);

        wrap.append(subs);
        catList.appendChild(wrap);
    });
    if (configEditMode) {
        const addL1Btn = document.createElement('button');
        addL1Btn.type = 'button';
        addL1Btn.className = "w-full py-3 text-center text-sm font-bold text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300";
        addL1Btn.innerText = "＋ 新增一级分类";
        addL1Btn.addEventListener('click', () => addL1());
        catList.appendChild(addL1Btn);
    }
    if (!configEditMode) {
        const addL1Btn = document.createElement('button');
        addL1Btn.type = 'button';
        addL1Btn.className = "w-full py-3 text-center text-sm font-bold text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300";
        addL1Btn.innerText = "＋ 新增一级分类";
        addL1Btn.addEventListener('click', () => addL1());
        catList.appendChild(addL1Btn);
    }
}

function buildLogFlowBar(color, muted) {
    const bar = document.createElement('div');
    bar.className = 'log-flow-bar' + (muted ? ' log-flow-bar--muted' : '');
    bar.style.background = color || '#cbd5e1';
    return bar;
}

let eventDraft = null;
let eventConfirmationDraft = null;
let eventParentSelecting = false;
let eventParentCandidate = null;

function eventTypeById(id) {
    return eventTypes.find((item) => String(item.id) === String(id)) || null;
}

let eventCenterTab = 'history', eventCenterPeriod = 0, eventCenterReturn = 'record', eventEditId = null;
let eventCenterRange = null;
function openEventCenter(tab = 'history', range = null) {
    eventCenterRange = range && Number.isFinite(range.start) && Number.isFinite(range.end) ? range : null;
    const filter = document.getElementById('event-center-filter');
    if (filter) filter.value = '';
    const active = document.querySelector('main > .tab-content.active');
    if (active && active.id !== 'page-events') eventCenterReturn = active.id.replace('page-', '');
    switchTab('events');
    setEventCenterTab(tab);
}
function closeEventCenter() { switchTab(eventCenterReturn); }
function setEventCenterTab(tab) {
    if (tab === 'stats') tab = 'history';
    if (!['history', 'stats', 'manage'].includes(tab)) return;
    eventCenterTab = tab;
    renderEventCenter();
}
function setEventCenterPeriod(days) { eventCenterRange = null; eventCenterPeriod = days; renderEventCenter(); }
function renderEventCenter() {
    if (!document.getElementById('event-center-list')) return;
    ['history', 'stats', 'manage'].forEach(tab => {
        document.getElementById('event-center-' + tab).classList.toggle('hidden', tab !== eventCenterTab);
        const button = document.querySelector(`[data-event-center-tab="${tab}"]`);
        button?.classList.toggle('active', tab === eventCenterTab);
        button?.setAttribute('aria-selected', String(tab === eventCenterTab));
    });
    const filter = document.getElementById('event-center-filter');
    const selected = filter.value;
    filter.replaceChildren(new Option('全部事件', ''));
    const types = new Map(eventTypes.map(type => [String(type.id), type.name]));
    eventRecords.forEach(record => { if (!types.has(String(record.typeId))) types.set(String(record.typeId), record.typeName || '已删除事件'); });
    types.forEach((name, id) => filter.add(new Option(name, id)));
    filter.value = types.has(selected) ? selected : '';
    const choices = document.getElementById('event-history-choices');
    choices.replaceChildren();
    const list = document.getElementById('event-center-list');
    list.replaceChildren();
    document.getElementById('event-center-history-range').textContent = eventCenterRange ? `当前范围：${eventCenterRange.label}` : '全部日期';
    const records = eventRecords.filter(item => (!filter.value || String(item.typeId) === filter.value) && (!eventCenterRange || (item.occurredAt >= eventCenterRange.start && item.occurredAt < eventCenterRange.end))).slice().sort((a, b) => b.occurredAt - a.occurredAt);
    const overview = document.getElementById('event-history-overview');
    overview.replaceChildren();
    const recordDays = new Set(records.map(record => formatBeijingDate(record.occurredAt)));
    [[records.reduce((sum, record) => sum + (record.count || 1), 0), '发生次数'], [recordDays.size, '记录天数'], [records.length, '记录条数']].forEach(([value, label]) => {
        const metric = document.createElement('div');
        const number = document.createElement('strong'); number.textContent = String(value);
        const caption = document.createElement('span'); caption.textContent = label;
        metric.append(number, caption); overview.appendChild(metric);
    });
    const dayCounts = new Map();
    records.forEach(record => { const date = formatBeijingDate(record.occurredAt); dayCounts.set(date, (dayCounts.get(date) || 0) + (record.count || 1)); });
    if (!records.length) {
        const empty = document.createElement('p'); empty.className = 'event-history-empty';
        empty.textContent = '当前范围还没有记录'; list.appendChild(empty);
    }
    let previousEventDate = '';
    records.forEach(record => {
        const recordDate = formatBeijingDate(record.occurredAt);
        if (recordDate !== previousEventDate) {
            const heading = document.createElement('h3');
            heading.className = 'event-record-date';
            const dateLabel = document.createElement('span'); dateLabel.textContent = recordDate;
            const dayTotal = document.createElement('small'); dayTotal.textContent = `${dayCounts.get(recordDate)} 次`;
            heading.append(dateLabel, dayTotal);
            list.appendChild(heading);
            previousEventDate = recordDate;
        }
        const type = eventTypeById(record.typeId);
        const row = document.createElement('div'); row.className = 'event-center-row';
        const content = document.createElement('div'); content.className = 'event-center-row-content';
        const name = document.createElement('strong'); name.textContent = type?.name || record.typeName || '已删除事件';
        const detail = document.createElement('span');
        detail.textContent = `${record.dateOnly ? '未指定时间' : formatBeijingClockSec(record.occurredAt)}${type?.group ? ' · ' + type.group : ''}${record.parentId ? ' · 关联主线' : ''}`;
        content.append(name, detail);
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'event-center-record-button'; edit.setAttribute('aria-label', `查看${type?.name || record.typeName}记录`); edit.addEventListener('click', () => openEventRecordEditor(record.id));
        const arrow = document.createElement('span'); arrow.className = 'event-center-record-arrow'; arrow.textContent = '›';
        const badge = document.createElement('span'); badge.className = 'event-history-icon'; badge.textContent = type?.icon || record.icon || '•'; badge.setAttribute('aria-hidden', 'true');
        const count = document.createElement('span'); count.className = 'event-history-count'; count.textContent = `${record.count || 1} 次`;
        edit.append(badge, content, count, arrow); row.append(edit); list.appendChild(row);
    });
    document.querySelectorAll('[data-event-period]').forEach(button => button.classList.toggle('active', !eventCenterRange && Number(button.dataset.eventPeriod) === eventCenterPeriod));
    const end = beijingDateStrToDayStart(getTodayDateStr()) + DAY_MS;
    const report = buildEventReport(eventCenterRange?.start ?? (eventCenterPeriod ? end - eventCenterPeriod * DAY_MS : 0), eventCenterRange?.end ?? end, 'range');
    const stats = document.getElementById('event-center-stat-content'); stats.replaceChildren();
    const rangeLabel = document.createElement('p'); rangeLabel.className = 'event-center-range-label';
    rangeLabel.textContent = eventCenterRange?.label || (eventCenterPeriod ? `${formatBeijingDate(end - eventCenterPeriod * DAY_MS)} 至 ${formatBeijingDate(end - 1)}` : '全部日期');
    stats.appendChild(rangeLabel);
    const summary = document.createElement('p'); summary.className = 'event-center-summary'; summary.textContent = `总计 ${report.total} 次 · ${report.activeDays} 天`; stats.appendChild(summary);
    if (!report.entries.length) { const empty = document.createElement('p'); empty.textContent = '这个时段没有事件记录'; stats.appendChild(empty); }
    report.entries.forEach(item => { const row = document.createElement('div'); row.className = 'event-center-stat-row'; const name = document.createElement('span'); name.textContent = `${item.icon} ${item.name}`; const value = document.createElement('strong'); value.textContent = `${item.count} 次 · ${item.days} 天`; row.append(name, value); stats.appendChild(row); });
    renderEventSettings('event-center-types');
}
function openEventRecordEditor(id) {
    const record = eventRecords.find(item => String(item.id) === String(id)); if (!record) return;
    eventEditId = record.id;
    const select = document.getElementById('event-edit-type'); select.replaceChildren();
    eventTypes.forEach(type => select.add(new Option(`${type.icon} ${type.name}`, String(type.id))));
    if (!eventTypeById(record.typeId)) select.add(new Option(`${record.typeName || '已删除事件'}（已删除）`, String(record.typeId)));
    select.value = String(record.typeId);
    document.getElementById('event-edit-date').value = formatBeijingDate(record.occurredAt);
    document.getElementById('event-edit-time').value = record.dateOnly ? '' : formatBeijingClockSec(record.occurredAt);
    document.getElementById('event-edit-count').value = record.count || 1;
    document.getElementById('event-edit-date-only').checked = !!record.dateOnly;
    toggleEventEditTime(); document.getElementById('event-record-editor').classList.remove('hidden');
}
function toggleEventEditTime() {
    const dateOnly = document.getElementById('event-edit-date-only').checked;
    document.getElementById('event-edit-time').disabled = dateOnly;
    document.getElementById('event-edit-time-row').classList.toggle('hidden', dateOnly);
}
function closeEventRecordEditor() { eventEditId = null; document.getElementById('event-record-editor').classList.add('hidden'); }
function saveEventRecordEdit() {
    const record = eventRecords.find(item => String(item.id) === String(eventEditId)); if (!record) return;
    const date = document.getElementById('event-edit-date').value, dateOnly = document.getElementById('event-edit-date-only').checked;
    const time = dateOnly ? '00:00:00' : document.getElementById('event-edit-time').value;
    const occurredAt = parseTimeOnBeijingDateParts(date, time), count = Number(document.getElementById('event-edit-count').value);
    if (!Number.isFinite(occurredAt) || !Number.isInteger(count) || count < 1 || count > 999) { showConfirm('信息不正确', '请检查日期、时间和次数（1–999）。', '知道了', () => {}); return; }
    if (record.parentId && (dateOnly !== !!record.dateOnly || occurredAt !== record.occurredAt)) {
        const parent = logs.find(item => String(item.id) === String(record.parentId)) || (current && String(current.id) === String(record.parentId) ? current : null);
        if (!parent || dateOnly || occurredAt < parent.startTime || occurredAt > logEndMs(parent, parent === current ? nowSecondMs() : undefined)) { showConfirm('时间超出归属主线', '请将时间调整到原主线范围内；若主线已不存在，请保留原时间。', '知道了', () => {}); return; }
    }
    const typeId = document.getElementById('event-edit-type').value, type = eventTypeById(typeId);
    record.typeId = type ? type.id : record.typeId;
    if (type) { record.typeName = type.name; record.icon = type.icon; record.color = type.color; }
    record.occurredAt = occurredAt; record.count = count; record.dateOnly = dateOnly;
    saveEventRecords(); closeEventRecordEditor(); renderAll();
}
function deleteEventCenterRecord(id) {
    showConfirm('删除事件记录', '删除后无法撤销，主线时间不受影响。', '删除', ok => {
        if (!ok) return; eventRecords = eventRecords.filter(item => String(item.id) !== String(id)); saveEventRecords(); closeEventRecordEditor(); renderAll();
    }, '取消');
}

function setEventStage(stage) {
    const stageBlocks = { choose: 'B22', confirm: 'B91', time: 'B77' };
    const blockCode = stageBlocks[stage];
    if (!blockCode) throw new Error(`Unregistered event interface stage: ${stage}`);
    document.getElementById('event-modal').dataset.devAddressBlock = blockCode;
    ['choose', 'confirm', 'time'].forEach((name) => {
        document.getElementById('event-stage-' + name)?.classList.toggle('hidden', name !== stage);
    });
}

let eventHomeGroup = '';
let eventHomeReturn = 'record';
let eventHomeFeedbackTimer = null;
function openEventHome() {
    const active = document.querySelector('main > .tab-content.active');
    if (active && active.id !== 'page-event-home') eventHomeReturn = active.id.replace('page-', '');
    eventHomeGroup = '';
    switchTab('event-home');
}
function closeEventHome() { switchTab(eventHomeReturn); }
function renderEventHome() {
    const groups = document.getElementById('event-home-groups');
    const cards = document.getElementById('event-home-cards');
    if (!groups || !cards) return;
    const types = eventTypes.filter(type => !type.disabled);
    const names = [...new Set(types.map(type => type.group).filter(Boolean))];
    if (eventHomeGroup && !names.includes(eventHomeGroup)) eventHomeGroup = '';
    groups.replaceChildren();
    ['', ...names].forEach(name => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = name || '所有';
        button.className = name === eventHomeGroup ? 'active' : '';
        button.setAttribute('aria-pressed', String(name === eventHomeGroup));
        button.addEventListener('click', () => { eventHomeGroup = name; renderEventHome(); });
        groups.appendChild(button);
    });
    cards.replaceChildren();
    const shown = types.filter(type => !eventHomeGroup || type.group === eventHomeGroup);
    document.getElementById('event-home-empty').classList.toggle('hidden', types.length > 0);
    shown.forEach(type => {
        const card = document.createElement('article'); card.className = 'event-home-card';
        const open = document.createElement('button'); open.type = 'button'; open.className = 'event-home-card-main';
        const icon = document.createElement('span'); icon.className = 'event-home-card-icon'; icon.textContent = type.icon;
        icon.style.setProperty('--event-color', safeColor(type.color, '#64748b'));
        const title = document.createElement('strong'); title.textContent = type.name;
        const last = document.createElement('small');
        const latest = eventRecords.filter(record => String(record.typeId) === String(type.id)).reduce((a, b) => !a || b.occurredAt > a.occurredAt ? b : a, null);
        last.textContent = latest ? `上次：${formatBeijingDate(latest.occurredAt)}${latest.dateOnly ? '' : ' ' + formatBeijingClockSec(latest.occurredAt).slice(0, 5)}` : '暂无记录';
        open.append(icon, title, last);
    open.addEventListener('click', () => {
        openEventCenter('history');
        const filter = document.getElementById('event-center-filter');
        filter.value = String(type.id);
        renderEventCenter();
    });
        const action = document.createElement('button'); action.type = 'button'; action.className = 'event-home-card-action';
        action.textContent = type.quick ? 'ϟ' : '＋';
        action.setAttribute('aria-label', type.quick ? `快速记录${type.name}` : `记录${type.name}`);
        action.addEventListener('click', () => {
            if (!type.quick) { openEventModal(); chooseEventType(type.id); return; }
            if (saveEventRecord({ typeId: type.id, occurredAt: nowSecondMs(), parentId: null })) {
                renderEventHome();
                const feedback = document.getElementById('event-home-success');
                feedback.classList.remove('hidden');
                clearTimeout(eventHomeFeedbackTimer);
                eventHomeFeedbackTimer = setTimeout(() => feedback.classList.add('hidden'), 1000);
            }
        });
        card.append(open, action); cards.appendChild(card);
    });
}

function openEventModal() {
    document.getElementById('event-modal-title').innerText = '记录事件';
    document.getElementById('event-choice-search').value = '';
    eventParentSelecting = false;
    eventParentCandidate = null;
    eventDraft = null;
    eventConfirmationDraft = null;
    renderEventChoiceGrid();
    setEventStage('choose');
    document.getElementById('event-modal')?.classList.remove('hidden');
}
window.openEventModal = openEventModal;

function closeEventModal() {
    document.getElementById('event-modal')?.classList.add('hidden');
    eventDraft = null;
    eventConfirmationDraft = null;
    eventParentCandidate = null;
    if (eventParentSelecting) {
        eventParentSelecting = false;
        renderAll();
    }
}
window.closeEventModal = closeEventModal;

function getEventChoiceTypes(types, records, query) {
    const term = String(query || '').trim().toLocaleLowerCase();
    const recentlyUsed = new Map();
    records.forEach(record => {
        const key = String(record.typeId);
        const time = Number(record.createdAt || record.occurredAt || 0);
        recentlyUsed.set(key, Math.max(recentlyUsed.get(key) || 0, time));
    });
    return types.filter(type => !type.disabled && type.name.toLocaleLowerCase().includes(term))
        .sort((a, b) => (recentlyUsed.get(String(b.id)) || 0) - (recentlyUsed.get(String(a.id)) || 0));
}

function renderEventChoiceGrid() {
    const grid = document.getElementById('event-choice-grid');
    const empty = document.getElementById('event-empty-hint');
    if (!grid || !empty) return;
    grid.innerHTML = '';
    const available = eventTypes.filter(type => !type.disabled);
    const matches = getEventChoiceTypes(available, eventRecords, document.getElementById('event-choice-search').value);
    empty.classList.toggle('hidden', available.length > 0);
    document.getElementById('event-search-empty').classList.toggle('hidden', !available.length || matches.length > 0);
    matches.forEach((type) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'event-choice-item';
        button.style.setProperty('--event-color', type.color);
        button.innerHTML = `<span>${escHtml(type.icon)}</span><b>${escHtml(type.name)}</b>`;
        button.addEventListener('click', () => chooseEventType(type.id));
        grid.appendChild(button);
    });
}

function chooseEventType(typeId) {
    const type = eventTypeById(typeId);
    if (!type) return;
    eventDraft = { typeId, parentId: null, occurredAt: nowSecondMs() };
    eventConfirmationDraft = { ...eventDraft };
    document.getElementById('event-confirm-preview').innerText = `记录「${type.icon} ${type.name}」\n归属：当前主线 ${current ? '· ' + displayName(current) : '· 未开启主线'}`;
    document.getElementById('event-modal-title').innerText = `记录${type.name}`;
    document.getElementById('event-time-parent').innerText = '不关联主线';
    fillEventTimeInputs(eventDraft.occurredAt);
    document.getElementById('event-use-time-row').classList.remove('hidden');
    document.getElementById('event-use-time').checked = true;
    document.getElementById('event-supplement-count').value = '1';
    setEventStage('time');
    toggleEventSupplementTime();
}

function clearEventParent() {
    if (!eventDraft) return;
    eventDraft.parentId = null;
    document.getElementById('event-time-parent').innerText = '不关联主线';
    document.getElementById('event-use-time-row').classList.remove('hidden');
    toggleEventSupplementTime();
}

function stepEventCount(delta) {
    const input = document.getElementById('event-supplement-count');
    input.value = String(Math.max(1, Math.min(999, (Number(input.value) || 1) + delta)));
}

function saveEventRecord({ typeId, occurredAt, parentId, count = 1, dateOnly = false }) {
    const type = eventTypeById(typeId);
    if (!type || !Number.isFinite(occurredAt)) return false;
    eventRecords.unshift({
        id: genId(),
        typeId: type.id,
        typeName: type.name,
        icon: type.icon,
        color: type.color,
        occurredAt: toSecondMs(occurredAt),
        parentId: parentId || null,
        count,
        dateOnly,
        createdAt: nowSecondMs(),
    });
    saveEventRecords();
    return true;
}

function confirmCurrentEvent() {
    if (!eventDraft) return;
    if (saveEventRecord(eventDraft)) {
        closeEventModal();
        renderAll();
    }
}
window.confirmCurrentEvent = confirmCurrentEvent;

function returnToEventConfirmation() {
    if (!eventConfirmationDraft) return;
    eventDraft = { ...eventConfirmationDraft };
    setEventStage('confirm');
}

function fillEventTimeInputs(ms) {
    const time = toSecondMs(ms || nowSecondMs());
    document.getElementById('event-date-input').value = formatBeijingDate(time);
    document.getElementById('event-time-input').value = formatBeijingClockSec(time);
}

function openIndependentEventTime() {
    if (!eventDraft) return;
    eventDraft.parentId = null;
    eventDraft.occurredAt = nowSecondMs();
    eventDraft.dateOnly = true;
    document.getElementById('event-time-parent').innerText = '独立事件 · 不归属任何主线';
    fillEventTimeInputs(eventDraft.occurredAt);
    document.getElementById('event-use-time-row').classList.remove('hidden');
    document.getElementById('event-use-time').checked = false;
    document.getElementById('event-supplement-count').value = '1';
    setEventStage('time');
    toggleEventSupplementTime();
}
window.openIndependentEventTime = openIndependentEventTime;

function toggleEventSupplementTime() {
    const useTime = !!eventDraft?.parentId || document.getElementById('event-use-time').checked;
    document.getElementById('event-time-input-row').classList.toggle('hidden', !useTime);
    document.getElementById('event-modal').dataset.devAddressBlock = useTime ? 'B77' : 'B90';
}

function beginEventParentSelection() {
    if (!eventDraft) return;
    eventParentSelecting = true;
    eventParentCandidate = null;
    document.getElementById('event-modal')?.classList.add('hidden');
    renderAll();
}
window.beginEventParentSelection = beginEventParentSelection;

function cancelEventParentSelection() {
    eventParentSelecting = false;
    eventParentCandidate = null;
    document.getElementById('event-modal')?.classList.remove('hidden');
    renderAll();
}
window.cancelEventParentSelection = cancelEventParentSelection;

function selectEventParent(parent) {
    if (!eventParentSelecting || !eventDraft || !parent || parent.parallel) return false;
    eventParentCandidate = parent;
    renderAll();
    return true;
}

function confirmEventParentSelection() {
    const parent = eventParentCandidate;
    if (!eventParentSelecting || !eventDraft || !parent) return;
    eventParentSelecting = false;
    eventParentCandidate = null;
    eventDraft.parentId = parent.id;
    eventDraft.dateOnly = false;
    eventDraft.occurredAt = parent.startTime;
    document.getElementById('event-time-parent').innerText = `归属主线 · ${displayName(parent)}`;
    fillEventTimeInputs(parent.startTime);
    document.getElementById('event-use-time-row').classList.add('hidden');
    document.getElementById('event-modal')?.classList.remove('hidden');
    setEventStage('time');
    toggleEventSupplementTime();
    renderAll();
}
window.confirmEventParentSelection = confirmEventParentSelection;

function saveTimedEvent() {
    if (!eventDraft) return;
    const date = document.getElementById('event-date-input').value;
    const dateOnly = !eventDraft.parentId && !document.getElementById('event-use-time').checked;
    const time = dateOnly ? '00:00:00' : document.getElementById('event-time-input').value;
    const count = Number(document.getElementById('event-supplement-count').value);
    const occurredAt = parseTimeOnBeijingDateParts(date, time);
    if (!Number.isFinite(occurredAt) || !Number.isInteger(count) || count < 1 || count > 999) {
        showConfirm('信息不正确', '请选择日期，并填写 1 至 999 的次数；指定时间时请填写时间。', '知道了', () => {});
        return;
    }
    if (eventDraft.parentId) {
        const parent = logs.find(item => String(item.id) === String(eventDraft.parentId)) || (current && String(current.id) === String(eventDraft.parentId) ? current : null);
        if (!parent || occurredAt < parent.startTime || occurredAt > logEndMs(parent, parent === current ? nowSecondMs() : undefined)) {
            showConfirm('时间超出归属主线', '请选择该主线范围内的时间。', '知道了', () => {}); return;
        }
    }
    eventDraft.occurredAt = occurredAt;
    eventDraft.dateOnly = dateOnly;
    eventDraft.count = count;
    if (saveEventRecord(eventDraft)) {
        closeEventModal();
        renderAll();
    }
}
window.saveTimedEvent = saveTimedEvent;

function parseTimeOnBeijingDateParts(dateStr, timeStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || '')) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(String(timeStr || ''))) return null;
    const [hours, minutes, seconds = '00'] = timeStr.split(':').map(Number);
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    return beijingDateStrToDayStart(dateStr) + (hours * 3600 + minutes * 60 + seconds) * 1000;
}

function buildLogFlowMainRow(opts) {
    const { timeText, nameText, durText, live, durId, endedParallel, eventAction, stopAction } = opts;
    const top = document.createElement('div');
    top.className = 'log-flow-main';
    const time = document.createElement('span');
    time.className = 'log-flow-time';
    time.innerText = timeText;
    const name = document.createElement('span');
    name.className = 'log-flow-name';
    name.innerText = nameText;
    const dur = document.createElement('span');
    const durCls = live ? 'log-flow-dur--live' : (endedParallel ? 'log-flow-dur--done' : 'log-flow-dur--log');
    dur.className = 'log-flow-dur ' + durCls;
    if (durId) dur.id = durId;
    dur.innerText = durText;
    top.append(time, name, dur);
    if (stopAction) {
        const stopButton = document.createElement('button');
        stopButton.type = 'button';
        stopButton.className = 'log-stop-btn';
        stopButton.textContent = '■';
        stopButton.title = '结束当前主线';
        stopButton.setAttribute('aria-label', '结束当前主线');
        stopButton.addEventListener('click', (event) => {
            event.stopPropagation();
            stopCurrentMain();
        });
        top.appendChild(stopButton);
    }
    if (eventAction) {
        const eventButton = document.createElement('button');
        eventButton.type = 'button';
        eventButton.className = 'log-event-btn';
        eventButton.innerText = '＋';
        eventButton.title = '记录事件';
        eventButton.addEventListener('click', (event) => {
            event.stopPropagation();
            openEventModal();
        });
        top.appendChild(eventButton);
    }
    return top;
}

function appendLogFlowNote(body, log) {
    if (!log || (!log.note && !log.tag)) return;
    const noteRow = document.createElement('div');
    noteRow.className = 'log-flow-note';
    if (log.tag) {
        const tagEl = document.createElement('span');
        tagEl.className = "text-[10px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full shrink-0";
        tagEl.innerText = '#' + log.tag;
        noteRow.appendChild(tagEl);
    }
    if (log.note) {
        const note = document.createElement('span');
        note.className = 'log-flow-note-text';
        note.innerText = log.note;
        noteRow.appendChild(note);
    }
    body.appendChild(noteRow);
}

function renderLogs(listId, dateStr) {
    const list = document.getElementById(listId);
    if (!list) return;
    document.getElementById('page-record')?.classList.toggle('event-parent-select-mode', eventParentSelecting);
    const moreWrap = listId === 'log-list' ? document.getElementById('load-more-wrap') : null;
    list.innerHTML = "";
    if (eventParentSelecting) {
        const notice = document.createElement('div');
        notice.className = 'event-parent-notice';
        const text = document.createElement('span');
        text.innerText = eventParentCandidate ? `已选择：${displayName(eventParentCandidate)}` : '请选择要归属的主线';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.innerText = '取消';
        cancel.addEventListener('click', cancelEventParentSelection);
        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.innerText = '确认归属';
        confirm.disabled = !eventParentCandidate;
        confirm.className = eventParentCandidate ? 'event-parent-confirm' : 'event-parent-confirm is-disabled';
        confirm.addEventListener('click', confirmEventParentSelection);
        notice.append(text, cancel, confirm);
        list.appendChild(notice);
    }

    // ── 实时卡片（仅查看今天） ──
    if (isDateToday(dateStr) && current) {
        const liveWrap = document.createElement('div');
        liveWrap.className = "swipe-wrap";
        const liveCard = document.createElement('div');
        liveCard.className = logFlowCardClass('main-live');
        if (eventParentSelecting) liveCard.classList.add('event-parent-selectable');
        if (eventParentCandidate === current) liveCard.classList.add('event-parent-selected');
        applySceneFlowCardTheme(liveCard, current);
        const inner = document.createElement('div');
        inner.className = "log-flow-inner";
        const bar = buildLogFlowBar(logSegmentColor(current), false);
        const body = document.createElement('div');
        body.className = 'log-flow-body';
        body.appendChild(buildLogFlowMainRow({
            timeText: formatBeijingClockSec(current.startTime),
            nameText: displayName(current),
            durText: formatDuration(logDurationMs(current, nowSecondMs())),
            live: true,
            durId: 'live-main-duration',
            stopAction: recordMode === 'journal' && !current.scene,
            eventAction: true
        }));
        appendLogFlowNote(body, current);
        inner.append(bar, body);
        liveCard.appendChild(inner);
        liveCard.title = recordMode === 'journal' && !current.scene ? '修改当前主线' : '补录一段已结束的并行活动';
        let livePressTimer = null, liveLongPressed = false, livePressX = 0, livePressY = 0;
        liveCard.addEventListener('pointerdown', (event) => {
            if (eventParentSelecting || event.target.closest('button') || current?.scene) return;
            liveLongPressed = false;
            livePressX = event.clientX; livePressY = event.clientY;
            livePressTimer = setTimeout(() => {
                livePressTimer = null;
                if (!current || current.scene) return;
                liveLongPressed = true;
                openSplitDrawer(current, { liveParent: true });
            }, 500);
        });
        liveCard.addEventListener('pointermove', (event) => {
            if (Math.abs(event.clientX - livePressX) > 10 || Math.abs(event.clientY - livePressY) > 10) clearTimeout(livePressTimer);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => liveCard.addEventListener(type, () => clearTimeout(livePressTimer)));
        liveCard.addEventListener('contextmenu', (event) => event.preventDefault());
        liveCard.addEventListener('click', () => {
            if (liveLongPressed) { liveLongPressed = false; return; }
            if (eventParentSelecting) {
                selectEventParent(current);
                return;
            }
            if (current?.scene) openSceneParallelBackfillDrawer(current);
            else if (recordMode === 'journal') openEdit(0, 'current');
            else openBackfillDrawer(current, { liveParent: true });
        });
        liveWrap.appendChild(liveCard);
        list.appendChild(liveWrap);
        if (current.scene) {
            const todaySceneLogs = logs.filter((log) => logTouchesDate(log, dateStr));
            const todayParallel = getParallelDisplayRecords(todaySceneLogs.filter((log) => log.parallel));
            renderSceneActivityTree(list, current, todaySceneLogs, todayParallel);
        }
    }
    const liveUnassigned = isDateToday(dateStr) ? getActiveUnassignedSegment(dateStr) : null;
    if (liveUnassigned) {
        const gaps = getDayUnassignedSegments(dateStr);
        const assigned = assignUnlocatedToGaps(dateStr, gaps).byGap[gaps.findIndex((gap) => gap.start === liveUnassigned.start)] || [];
        renderUnassignedMain(list, dateStr, liveUnassigned, assigned, true);
    }

    // ── 辅助：渲染并行使卡片（主线卡片样式，无缩进） ──
    function createLiveParallelCard(parent, parallel, isActive, idx) {
        const wrap = document.createElement('div');
        wrap.className = "swipe-wrap";
        const leftAct = document.createElement('div');
        leftAct.className = "swipe-actions left";
        const delBtn = document.createElement('div');
        delBtn.className = "swipe-action-btn delete";
        delBtn.innerText = isActive ? "关闭" : "删除";
        leftAct.appendChild(delBtn);
        wrap.appendChild(leftAct);
        const rightAct = document.createElement('div');
        rightAct.className = "swipe-actions right";
        const editBtn = document.createElement('div');
        editBtn.className = "swipe-action-btn edit";
        editBtn.innerText = '编辑';
        rightAct.appendChild(editBtn);
        wrap.appendChild(rightAct);
        const card = document.createElement('div');
        card.className = logFlowCardClass(isActive ? 'parallel-live' : 'parallel-log');
        let sx=0,sy=0,swiping=false,dx=0;
        card.addEventListener('touchstart', e=>{const t=e.touches[0];sx=t.clientX;sy=t.clientY;swiping=false;dx=0;card.classList.add('swiping');},{passive:false});
        card.addEventListener('touchmove', e=>{const d=e.touches[0].clientX-sx;const dy=e.touches[0].clientY-sy;if(!swiping&&Math.abs(d)>Math.abs(dy)&&Math.abs(d)>10)swiping=true;if(swiping){e.preventDefault();dx=Math.max(-80,Math.min(80,d));card.style.transform=`translateX(${dx}px)`;}},{passive:false});
        card.addEventListener('touchend', () => {
            card.classList.remove('swiping');
            card.style.transform = '';
            if (!swiping) return;
            if (dx > 55) {
                if (isActive) {
                    showConfirm('关闭并行', `关闭「${displayName(parallel)}」？不会记入日志。`, '关闭', (ok) => {
                        if (ok) { parallelCurrent = null; localStorage.removeItem('v9_parallel'); renderAll(); }
                    });
                } else {
                    showConfirm('删除并行', `删除已结束的「${displayName(parallel)}」？`, '删除', (ok) => {
                        if (ok) { parallelHistory.splice(idx, 1); localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory)); renderAll(); }
                    });
                }
            } else if (dx < -55) {
                if (isActive) {
                    openEdit(0, 'parallelCurrent');
                } else {
                    openEdit(idx, 'parallelHistory');
                }
            }
            swiping = false;
            dx = 0;
        }, { passive: true });
        const inner = document.createElement('div');
        inner.className = "log-flow-inner";
        const bar = buildLogFlowBar(logSegmentColor(parallel), false);
        const body = document.createElement('div');
        body.className = 'log-flow-body';
        const durMs = logDurationMs(parallel, isActive ? nowSecondMs() : null);
        body.appendChild(buildLogFlowMainRow({
            timeText: formatBeijingClockSec(parallel.startTime),
            nameText: displayName(parallel),
            durText: formatDuration(durMs),
            live: isActive,
            durId: isActive ? 'live-parallel-duration' : null,
            endedParallel: !isActive
        }));
        inner.append(bar, body);
        card.appendChild(inner);
        wrap.appendChild(card);
        parent.appendChild(wrap);
    }

    // ── 主线下并行窗口（实时 + 已结束） ──
    if (isDateToday(dateStr) && (parallelCurrent || parallelHistory.length > 0)) {
        const ph = document.createElement('div');
        ph.className = "flex items-center gap-2 px-1 pt-4 pb-1";
        const icon = document.createElement('span');
        icon.className = "parallel-flow-icon text-[14px]";
        icon.innerText = "↳";
        const label = document.createElement('span');
        label.className = "parallel-flow-label text-[11px] font-black uppercase tracking-widest";
        label.innerText = "并行";
        ph.append(icon, label);
        if (parallelCurrent) {
            const badge = document.createElement('span');
            badge.className = "text-[8px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full";
            badge.innerText = "运行中";
            ph.appendChild(badge);
        }
        list.appendChild(ph);
        const pWrap = document.createElement('div');
        pWrap.className = "log-flow-nest";
        if (parallelCurrent) {
            createLiveParallelCard(pWrap, parallelCurrent, true, 0);
        }
        parallelHistory.forEach((p, i) => {
            createLiveParallelCard(pWrap, p, false, i);
        });
        list.appendChild(pWrap);
    }

    list.appendChild(buildLogDayHeader(dateStr, false, listId === 'log-list'));

    const dayLogs = logs.filter((l) => logTouchesDate(l, dateStr));
    const normalLogs = dayLogs.filter((l) => !l.parallel && !l.sceneActivity).sort((a, b) => b.startTime - a.startTime);
    const parallelLogs = getParallelDisplayRecords(dayLogs.filter((l) => l.parallel));

    renderDayMainRows(list, dateStr, normalLogs, dayLogs, parallelLogs, liveUnassigned?.start ?? null);
    appendUnattachedParallelLogs(list, parallelLogs, normalLogs.concat(dayLogs.filter((log) => log.sceneActivity)));

    if (dayLogs.length === 0 && !(isDateToday(dateStr) && (current || parallelCurrent || liveUnassigned)) && !getDayUnassignedSegments(dateStr).length) {
        const empty = document.createElement('div');
        empty.className = 'text-center text-[11px] text-slate-400 py-6';
        empty.innerText = '该日暂无流水';
        list.appendChild(empty);
    }
    if (moreWrap) moreWrap.innerHTML = '';
}

// 已保存的并行绝不能因为旧数据的 parentId 不匹配而从流水中消失。
function appendUnattachedParallelLogs(list, parallelLogs, normalLogs) {
    const parents = new Set(normalLogs);
    const unattached = parallelLogs
        .filter((item) => !parents.has(item._displayParent))
        .sort((a, b) => b.startTime - a.startTime);
    if (!unattached.length) return;

    const label = document.createElement('div');
    label.className = 'parallel-flow-label px-1 pt-2 pb-1 text-[11px] font-black uppercase tracking-widest';
    label.innerText = '并行记录';
    list.appendChild(label);
    unattached.forEach((item) => {
        const wrap = document.createElement('div');
        wrap.className = 'log-flow-nest mt-1 mb-1';
        createLogRow(wrap, item, logs.indexOf(item));
        list.appendChild(wrap);
    });
}

function createLogRow(list, log, idx) {
    const wrap = document.createElement('div');
    wrap.className = "swipe-wrap";

    const leftActions = document.createElement('div');
    leftActions.className = "swipe-actions left";
    const delBtn = document.createElement('div');
    delBtn.className = "swipe-action-btn delete";
    delBtn.innerText = "删除";
    leftActions.appendChild(delBtn);
    wrap.appendChild(leftActions);

    const rightActions = document.createElement('div');
    rightActions.className = "swipe-actions right";
    const editBtn = document.createElement('div');
    editBtn.className = "swipe-action-btn edit";
    editBtn.innerText = "编辑";
    rightActions.appendChild(editBtn);
    wrap.appendChild(rightActions);

    const card = document.createElement('div');
    card.className = logFlowCardClass(log.parallel ? 'parallel-log' : 'main-log');
    applySceneFlowCardTheme(card, log);
    if (eventParentSelecting && !log.parallel) card.classList.add('event-parent-selectable');
    if (eventParentCandidate === log) card.classList.add('event-parent-selected');

    let startX = 0, startY = 0, isSwiping = false, currentDx = 0;
    let _wasLongPress = false, _lpTimer = null;
    card.addEventListener('touchstart', (e) => {
        if (eventParentSelecting) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        isSwiping = false;
        currentDx = 0;
        card.classList.add('swiping');
    }, { passive: true });
    card.addEventListener('touchmove', (e) => {
        if (eventParentSelecting) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (!isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
            isSwiping = true;
            if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
        }
        if (isSwiping) {
            e.preventDefault();
            currentDx = Math.max(-80, Math.min(80, dx));
            card.style.transform = `translateX(${currentDx}px)`;
        }
    }, { passive: false });
    card.addEventListener('touchend', (e) => {
        if (eventParentSelecting) return;
        card.classList.remove('swiping');
        card.style.transform = '';
        if (isSwiping) {
            if (currentDx > 55) {
                const logName = displayName(log);
                showConfirm("确认删除", `删除「${logName}」？删除后可选择把时间并入相邻记录。`, "删除", (ok) => {
                    if (ok) requestDeleteLogEntry(log);
                }, '清空', { addressBlock: 'B83', onSecondary: () => clearLogEntryToUnassigned(log) });
            } else if (currentDx < -55) {
                openEdit(idx);
            }
            isSwiping = false;
            currentDx = 0;
        }
    }, { passive: true });

    if (!log.parallel && !log._crossDay) {
        if (!eventParentSelecting) {
            card.addEventListener('pointerdown', (e) => {
                if (isSwiping) return;
                _wasLongPress = false;
                _lpTimer = setTimeout(() => {
                    if (isSwiping) return;
                    _wasLongPress = true;
                    openSplitDrawer(log);
                }, 500);
            });
            card.addEventListener('pointerup', () => { clearTimeout(_lpTimer); });
            card.addEventListener('pointerleave', () => { clearTimeout(_lpTimer); });
            card.addEventListener('pointercancel', () => { clearTimeout(_lpTimer); });
        }
        card.addEventListener('click', (e) => {
            if (isSwiping || _wasLongPress) return;
            if (eventParentSelecting) {
                selectEventParent(log);
                return;
            }
            openBackfillDrawer(log);
        });
    }

    const inner = document.createElement('div');
    inner.className = "log-flow-inner";

    const bar = buildLogFlowBar(logSegmentColor(log), false);

    const body = document.createElement('div');
    body.className = "log-flow-body";
    body.appendChild(buildLogFlowMainRow({
        timeText: formatBeijingClockSec(log.startTime),
        nameText: displayName(log),
        durText: formatDuration(logDurationMs(log)),
        live: false,
        endedParallel: !!log.parallel
    }));
    appendLogFlowNote(body, log);

    inner.append(bar, body);
    card.appendChild(inner);
    wrap.appendChild(card);
    list.appendChild(wrap);
    return wrap;
}

function getSceneBackfillTarget(sceneName, dateStr) {
    const today = getTodayDateStr();
    if (dateStr === today && current?.scene && current.l2 === sceneName) {
        return { parent: current, end: nowSecondMs(), liveParent: true };
    }
    const matches = logs
        .filter((item) => !item.parallel && item.scene && item.l2 === sceneName && logTouchesDate(item, dateStr))
        .sort((a, b) => b.startTime - a.startTime);
    if (!matches.length) return null;
    const parent = matches[0];
    return { parent, end: logEndMs(parent), liveParent: false };
}

function getSceneBackfillDateBounds(sceneName) {
    const starts = logs
        .filter((item) => !item.parallel && item.scene && item.l2 === sceneName)
        .map((item) => item.startTime);
    if (current?.scene && current.l2 === sceneName) starts.push(current.startTime);
    const earliest = starts.length ? Math.min(...starts) : nowSecondMs();
    return { min: formatBeijingDate(earliest), max: getTodayDateStr() };
}

function openSceneParallelBackfillDrawer(sceneLog, options = {}) {
    const sceneName = sceneLog.l2;
    const dateInput = document.getElementById('parallel-date');
    const dateRow = document.getElementById('parallel-date-row');
    const context = { sceneName, selectedDate: getTodayDateStr(), target: null, preset: options.preset || null };

    pickerMode = 'parallel-backfill';
    setDrawerDevAddress('B70');
    document.getElementById('drawer-title').innerText = `补录场景活动于 ${displayName(sceneLog)}`;
    document.getElementById('parallel-time-row').classList.remove('hidden');
    document.getElementById('drawer-footer').classList.remove('hidden');
    document.getElementById('drawer-note').value = '';
    document.getElementById('drawer-note').placeholder = '备注（选填）';
    dateRow.classList.remove('hidden');
    const bounds = getSceneBackfillDateBounds(sceneName);
    dateInput.min = bounds.min;
    dateInput.max = bounds.max;

    const applyDate = (dateStr) => {
        const target = getSceneBackfillTarget(sceneName, dateStr);
        if (!target) {
            showConfirm('当天没有这个场景', '请选择该场景实际覆盖到的日期。', '知道了', () => {});
            dateInput.value = context.selectedDate;
            return false;
        }
        context.selectedDate = dateStr;
        context.target = target;
        const { parent, end } = target;
        _backfillRange = { start: parent.startTime, end };
        setTimeInFields('ps', new Date(parent.startTime));
        const endAtMidnight = end === beijingDateStrToDayStart(formatBeijingDate(parent.startTime)) + DAY_MS;
        setTimeInFields('pe', new Date(end), { show24: endAtMidnight });
        syncBackfillProgress(parent, end);
        setupBackfillDrag(parent, end);
        _parallelCallback = (l1, l2, selectedRange) => {
            const active = context.target;
            if (!active) return;
            const parentLog = active.parent;
            const parentEnd = active.end;
            const startMs = selectedRange.start;
            const endMs = selectedRange.end;
            const start = Math.max(parentLog.startTime, Math.min(parentEnd, startMs));
            const finish = Math.max(parentLog.startTime, Math.min(parentEnd, endMs));
            if (finish <= start) {
                showConfirm('时间不合法', '结束时间必须晚于开始时间。', '知道了', () => {});
                return;
            }
            const parentId = getSceneContainerId(parentLog);
            const conflicts = logs.filter((item) => item.sceneActivity && String(item.sceneParentId) === String(parentId))
                .some((item) => item.startTime < finish && logEndMs(item) > start);
            if (conflicts) {
                showConfirm('时间已被占用', '这段时间已有场景活动，请调整后重试。', '知道了', () => {});
                return;
            }
            const cat = getCat(l1);
            const entry = {
                id: genId(), startTime: start, endTime: finish,
                duration: Math.round((finish - start) / 60000),
                l1, l2: l2 || '', tag: '', note: document.getElementById('drawer-note').value || '',
                color: cat?.color || '#cbd5e1', parallel: false,
                sceneActivity: true, sceneParentId: parentId, sceneName
            };
            logs.unshift(entry);
            localStorage.setItem('v9_logs', JSON.stringify(logs));
            renderAll();
        };
        return true;
    };

    dateInput.value = context.selectedDate;
    dateInput.onchange = () => applyDate(dateInput.value);
    if (!applyDate(context.selectedDate)) return;
    if (context.preset?.l1 && cats.some((cat) => cat.name === context.preset.l1)) {
        selL1 = context.preset.l1;
    }
    if (drawerViewMode === 'columns') drawerViewMode = 'flat';
    renderPicker();
    renderDrawerToggle();
    showDrawer();
}

function openBackfillDrawer(parentLog, options = {}) {
    const liveParent = options.liveParent === true;
    pickerMode = 'parallel-backfill';
    setDrawerDevAddress('B69');
    document.getElementById('drawer-title').innerText = `↳ 补录并行于 ${displayName(parentLog)}`;
    document.getElementById('parallel-time-row').classList.remove('hidden');
    document.getElementById('parallel-date-row').classList.add('hidden');
    document.getElementById('parallel-date').onchange = null;
    document.getElementById('drawer-footer').classList.remove('hidden');
    document.getElementById('drawer-note').value = '';
    document.getElementById('drawer-note').placeholder = '备注（选填）';
    const parentEnd = liveParent
        ? nowSecondMs()
        : (parentLog.endTime || (parentLog.startTime + (parentLog.duration || 60) * 60000));
    _backfillRange = { start: parentLog.startTime, end: parentEnd };
    setTimeInFields('ps', new Date(parentLog.startTime));
    const endAtMidnight = parentEnd === beijingDateStrToDayStart(formatBeijingDate(parentLog.startTime)) + DAY_MS;
    setTimeInFields('pe', new Date(parentEnd), { show24: endAtMidnight });
    syncBackfillProgress(parentLog, parentEnd);
    setupBackfillDrag(parentLog, parentEnd);
    _parallelCallback = (l1, l2, selectedRange) => {
        const cat = getCat(l1);
        const startMs = selectedRange.start;
        const realParentEnd = parentEnd;
        const clampedStart = Math.max(parentLog.startTime, Math.min(realParentEnd, startMs));
        const clampedEnd = Math.max(parentLog.startTime, Math.min(realParentEnd, selectedRange.end));
        const e = clampedEnd > clampedStart ? clampedEnd : Math.min(realParentEnd, clampedStart + 60000);
        const dur = Math.round((e - clampedStart) / 60000);
        // 时间唯一性：检查与已有并行是否重叠
        const parentId = parentLog.id || parentLog.startTime;
        const existingParallels = [...logs.filter(l => l.parallel && l.parentId === parentId), ...parallelHistory];
        const overlapConflict = existingParallels.some(p => {
            const pEnd = p.endTime || (p.startTime + (p.duration || 0) * 60000);
            return p.startTime < e && pEnd > clampedStart;
        });
        if (overlapConflict) {
            showConfirm('⏰ 时间已被占用', '该时段已有其他并行活动，请调整时间后重试。', '知道了', () => {});
            return;
        }
        const entry = {
            id: genId(),
            startTime: clampedStart,
            endTime: e,
            duration: dur,
            l1, l2: l2 || '',
            tag: '', note: document.getElementById('drawer-note').value || '',
            color: cat?.color || '#cbd5e1',
            parallel: true,
            parentId: parentLog.id || parentLog.startTime
        };
        if (liveParent) {
            parallelHistory.unshift(entry);
            localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
        } else {
            logs.unshift(entry);
            localStorage.setItem('v9_logs', JSON.stringify(logs));
        }
        renderAll();
    };
    if (drawerViewMode === 'columns') drawerViewMode = 'flat';
    renderPicker();
    renderDrawerToggle();
    showDrawer();
}
function openSplitDrawer(parentLog, options = {}) {
    if (parentLog.scene) {
        showConfirm('请切割场景活动', '场景是时间容器，请长按场景下方的活动来切割。', '知道了', () => {});
        return;
    }
    pickerMode = 'split';
    setDrawerDevAddress('B71');
    const pStart = parentLog.startTime;
    const liveParent = options.liveParent === true;
    const capturedParent = liveParent ? { ...parentLog } : parentLog;
    const pEnd = liveParent ? nowSecondMs() : (parentLog.endTime || (pStart + (parentLog.duration || 60) * 60000));
    document.getElementById('drawer-title').innerText = `✂️ 切割 — ${displayName(parentLog)}`;
    document.getElementById('parallel-time-row').classList.remove('hidden');
    document.getElementById('drawer-footer').classList.remove('hidden');
    document.getElementById('drawer-note').value = '';
    document.getElementById('drawer-note').placeholder = '备注（选填）';
    _backfillRange = { start: pStart, end: pEnd };
    setTimeInFields('ps', new Date(pStart));
    const endAtMidnight = pEnd === beijingDateStrToDayStart(formatBeijingDate(pStart)) + DAY_MS;
    setTimeInFields('pe', new Date(pEnd), { show24: endAtMidnight });
    setupBackfillDrag(parentLog, pEnd);
    syncBackfillProgress(parentLog, pEnd);
    _parallelCallback = (l1, l2, selectedRange) => {
        if (liveParent) executeLiveSplit(capturedParent, pEnd, l1, l2, selectedRange);
        else executeSplit(parentLog, l1, l2, selectedRange);
    };
    if (drawerViewMode === 'columns') drawerViewMode = 'flat';
    renderPicker();
    renderDrawerToggle();
    showDrawer();
}
function executeLiveSplit(parentLog, capturedEnd, l1, l2, selectedRange) {
    const splitStart = selectedRange?.start, splitEnd = selectedRange?.end;
    if (!current || current.id !== parentLog.id || current.startTime !== parentLog.startTime) {
        showConfirm('主线已变化', '当前主线已经改变，请重新打开切割。', '知道了', () => {});
        return;
    }
    if (!Number.isFinite(splitStart) || !Number.isFinite(splitEnd) || splitStart < parentLog.startTime
        || splitEnd > capturedEnd || splitEnd - splitStart < 60000) {
        showConfirm('时间不合法', '请选择打开切割时已过去的主线时间，且至少一分钟。', '知道了', () => {});
        return;
    }
    const parentId = parentLog.id || parentLog.startTime;
    const related = logs.some(item => item.parallel && String(item.parentId) === String(parentId))
        || parallelHistory.some(item => String(item.parentId) === String(parentId))
        || !!parallelCurrent;
    if (related) {
        showConfirm('存在关联并行活动', '这条主线有关联的并行活动，暂不能直接切割，请先处理并行活动。', '知道了', () => {});
        return;
    }
    const before = splitStart > parentLog.startTime
        ? { ...parentLog, id: genId(), endTime: splitStart, duration: Math.round((splitStart - parentLog.startTime) / 60000), manualSplit: true }
        : null;
    const cut = { id: genId(), startTime: splitStart, endTime: splitEnd,
        duration: Math.round((splitEnd - splitStart) / 60000), l1, l2: l2 || '', tag: '',
        note: document.getElementById('drawer-note').value || '', color: getCat(l1)?.color || '#cbd5e1', manualSplit: true,
        ...(parentLog.journal ? { journal: true } : {}) };
    if (before) logs.unshift(before);
    logs.unshift(cut);
    eventRecords.forEach(event => {
        if (String(event.parentId) !== String(parentId) || event.occurredAt >= splitEnd) return;
        event.parentId = event.occurredAt < splitStart && before ? before.id : cut.id;
    });
    current = { ...current, startTime: splitEnd };
    localStorage.setItem('v9_logs', JSON.stringify(logs));
    localStorage.setItem('v9_current', JSON.stringify(current));
    saveEventRecords();
    closeDrawer();
    renderAll();
}
function executeSplit(parentLog, l1, l2, selectedRange) {
    const pStart = parentLog.startTime;
    const pEnd = parentLog.endTime || (pStart + (parentLog.duration || 60) * 60000);
    const splitStart = selectedRange?.start;
    const splitEnd = selectedRange?.end;
    if (!Number.isFinite(splitStart) || !Number.isFinite(splitEnd)
        || splitStart < pStart || splitEnd > pEnd || splitEnd - splitStart < 60000) {
        showConfirm('时间不合法', '请选择主线内至少一分钟的切割范围。', '知道了', () => {});
        return;
    }
    // 时间唯一性：切割区间不能与已有并行重叠
    const splitParentId = parentLog.id || parentLog.startTime;
    const splitConflicts = [...logs.filter(l => l.parallel && l.parentId === splitParentId), ...parallelHistory].some(p => {
        const pEnd = p.endTime || (p.startTime + (p.duration || 0) * 60000);
        return p.startTime < splitEnd && pEnd > splitStart;
    });
    if (splitConflicts) {
        showConfirm('⏰ 时间已被占用', '切割区间与已有并行活动冲突，请调整切割范围后重试，或先删除冲突的并行。', '知道了', () => {});
        closeDrawer();
        return;
    }
    const idx = logs.indexOf(parentLog);
    if (idx === -1) { closeDrawer(); return; }
    logs.splice(idx, 1);
    const cat = getCat(l1);
    const color = cat?.color || '#cbd5e1';
    const note = document.getElementById('drawer-note').value || '';
    const newLogs = [];
    if (splitStart > pStart) {
        newLogs.push({ ...parentLog, id: genId(), startTime: pStart, endTime: splitStart, duration: Math.round((splitStart - pStart) / 60000), manualSplit: true });
    }
    const sceneContext = parentLog.sceneActivity
        ? { sceneActivity: true, sceneParentId: parentLog.sceneParentId, sceneName: parentLog.sceneName }
        : {};
    newLogs.push({ ...sceneContext, id: genId(), startTime: splitStart, endTime: splitEnd, duration: Math.round((splitEnd - splitStart) / 60000), l1, l2: l2 || '', tag: '', note, color, manualSplit: true });
    if (splitEnd < pEnd) {
        newLogs.push({ ...parentLog, id: genId(), startTime: splitEnd, endTime: pEnd, duration: Math.round((pEnd - splitEnd) / 60000), manualSplit: true });
    }
    // 主线切割后旧 parentId 会失效；把原有并行记录按重叠范围重新挂到新片段。
    const replacementMain = newLogs.filter((item) => !item.parallel).sort((a, b) => a.startTime - b.startTime);
    const oldParallel = [
        ...logs.filter((item) => item.parallel && item.parentId === splitParentId),
        ...parallelHistory.filter((item) => item.parentId === splitParentId),
    ];
    if (oldParallel.length) {
        logs = logs.filter((item) => !(item.parallel && item.parentId === splitParentId));
        parallelHistory = parallelHistory.filter((item) => item.parentId !== splitParentId);
        oldParallel.forEach((parallelLog) => {
            const parallelEnd = logEndMs(parallelLog);
            replacementMain.forEach((mainPart) => {
                const start = Math.max(parallelLog.startTime, mainPart.startTime);
                const end = Math.min(parallelEnd, mainPart.endTime);
                if (end <= start) return;
                logs.push({
                    ...parallelLog,
                    id: genId(),
                    startTime: start,
                    endTime: end,
                    duration: Math.max(1, Math.round((end - start) / 60000)),
                    parentId: mainPart.id,
                    parallel: true,
                });
            });
        });
    }
    logs.splice(idx, 0, ...newLogs);
    localStorage.setItem('v9_logs', JSON.stringify(logs));
    localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
    closeDrawer();
    renderAll();
}
function mergeAdjacentSameActivity() {
    const merged = [];
    const parentRewrites = new Map();
    for (const log of logs) {
        const last = merged[merged.length - 1];
        const canMerge = last
            && !last.parallel && !log.parallel
            && !last.manualSplit && !log.manualSplit
            && !last.scene && !log.scene
            && !last.sceneActivity && !log.sceneActivity
            && last.l1 === log.l1 && last.l2 === log.l2
            && last.endTime === log.startTime
            && formatBeijingDate(last.startTime) === formatBeijingDate(log.startTime);
        if (canMerge) {
            last.endTime = log.endTime;
            last.duration = Math.round((last.endTime - last.startTime) / 60000);
            // 合并会移除 log 这条主线，所有子并行必须跟着改指向留下的 last。
            parentRewrites.set(String(log.id), last.id);
        } else {
            merged.push({ ...log });
        }
    }
    logs = merged;
    if (!parentRewrites.size) return;
    const rewriteParent = (item) => {
        if (!item?.parallel) return item;
        const replacement = parentRewrites.get(String(item.parentId));
        return replacement == null ? item : { ...item, parentId: replacement };
    };
    logs = logs.map(rewriteParent);
    parallelHistory = parallelHistory.map(rewriteParent);
    if (parallelCurrent) parallelCurrent = rewriteParent(parallelCurrent);
    localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
    if (parallelCurrent) localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
}
// 吸附到最近的空闲区段边界（考虑已有并行占用）
function snapToNearestFreeZone(pct, parentLog, parentEnd) {
    const pStart = parentLog.startTime;
    const pEnd = parentEnd || (pStart + (parentLog.duration || 60) * 60000);
    const total = pEnd - pStart;
    if (total <= 0) return Math.max(0, Math.min(1, pct));
    const pid = parentLog.id || parentLog.startTime;
    // 收集所有已占用的时间区间
    const occupied = [...logs.filter(l => l.parallel && l.parentId === pid), ...parallelHistory]
        .map(p => ({
            start: Math.max(p.startTime, pStart),
            end: Math.min(p.endTime || (p.startTime + (p.duration || 0) * 60000), pEnd)
        }))
        .filter(r => r.end > r.start)
        .sort((a, b) => a.start - b.start);
    // 没有并行占位 → 自由拖动，不磁吸
    if (occupied.length === 0) return Math.max(0, Math.min(1, pct));
    // 计算空闲区段
    const freeZones = [];
    let cursor = pStart;
    occupied.forEach(r => {
        if (r.start > cursor) freeZones.push({ start: cursor, end: r.start });
        cursor = Math.max(cursor, r.end);
    });
    if (cursor < pEnd) freeZones.push({ start: cursor, end: pEnd });
    if (freeZones.length === 0) return 0.5; // 全占满则落在正中
    const clickMs = pStart + total * pct;
    // 判断点击位置落在什么区
    const inOccupied = occupied.some(r => clickMs >= r.start && clickMs <= r.end);
    if (!inOccupied) {
        // 落在空闲区 → 不磁吸，停在原地
        return Math.max(0, Math.min(1, pct));
    }
    // 落在占用区 → 吸到最近空闲边界
    let bestEdge = freeZones[0].start;
    let bestDist = Infinity;
    freeZones.forEach(z => {
        [z.start, z.end].forEach(edge => {
            const dist = Math.abs(edge - clickMs);
            if (dist < bestDist) { bestDist = dist; bestEdge = edge; }
        });
    });
    return Math.max(0, Math.min(1, (bestEdge - pStart) / total));
}
function setupBackfillDrag(parentLog, parentEnd) {
    let dragTarget = null;
    const total = parentEnd - parentLog.startTime;
    _backfillUiSession = { parentLog, parentEnd };

    const setTimeFromPct = (pct, target) => {
        pct = Math.max(0, Math.min(1, pct));
        const ms = parentLog.startTime + total * pct;
        const prefix = target === 'start' ? 'ps' : 'pe';
        const endAtMidnight = target === 'end'
            && ms === beijingDateStrToDayStart(formatBeijingDate(parentLog.startTime)) + DAY_MS;
        setTimeInFields(prefix, new Date(ms), { show24: endAtMidnight });
        syncBackfillProgress(parentLog, parentEnd);
    };

    const clientXFromEvent = (e) => {
        if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
        return e.clientX;
    };

    const oldTrack = document.getElementById('backfill-track');
    const newTrack = oldTrack.cloneNode(true);
    oldTrack.parentNode.replaceChild(newTrack, oldTrack);
    const newStartH = newTrack.querySelector('#backfill-start-handle');
    const newEndH = newTrack.querySelector('#backfill-end-handle');
    if (!newStartH || !newEndH) return;

    const removeDocListeners = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        _cleanupBackfillDrag = null;
    };
    if (_cleanupBackfillDrag) _cleanupBackfillDrag();
    _cleanupBackfillDrag = removeDocListeners;

    const onMove = (e) => {
        if (!dragTarget) return;
        e.preventDefault();
        const rect = newTrack.getBoundingClientRect();
        const handleHalfW = 5; // w-2.5 的一半
        const pct = (clientXFromEvent(e) - rect.left + (dragTarget === 'end' ? handleHalfW : 0)) / rect.width;
        setTimeFromPct(pct, dragTarget);
    };
    const onEnd = () => {
        if (dragTarget) {
            // 释放时吸附到最近的空闲区段边界
            const rect = newTrack.getBoundingClientRect();
            const curEl = document.getElementById('backfill-' + dragTarget + '-handle');
            if (curEl) {
                const curPct = parseFloat(curEl.style.left) / 100;
                const snapped = snapToNearestFreeZone(curPct, parentLog, parentEnd);
                setTimeFromPct(snapped, dragTarget);
            }
        }
        dragTarget = null;
    };

    const onTrackTap = (clientX) => {
        const rect = newTrack.getBoundingClientRect();
        let pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const snapped = snapToNearestFreeZone(pct, parentLog, parentEnd);
        const clickMs = parentLog.startTime + total * snapped;
        const curStart = parseTimeFromInput('ps', parentLog.startTime);
        const curEnd = parseTimeFromInput('pe', parentLog.startTime);
        const distToStart = Math.abs(clickMs - curStart);
        const distToEnd = Math.abs(clickMs - curEnd);
        const target = distToStart <= distToEnd ? 'start' : 'end';
        // 目标位置的最近空闲区段：如果点和目标有距离偏移，取偏移后的位置
        setTimeFromPct(snapped, target);
    };

    newTrack.addEventListener('click', (e) => {
        if (e.target === newStartH || e.target === newEndH) return;
        onTrackTap(e.clientX);
    });
    newStartH.addEventListener('mousedown', (e) => { dragTarget = 'start'; e.preventDefault(); e.stopPropagation(); });
    newStartH.addEventListener('touchstart', (e) => { dragTarget = 'start'; e.stopPropagation(); }, { passive: true });
    newEndH.addEventListener('mousedown', (e) => { dragTarget = 'end'; e.preventDefault(); e.stopPropagation(); });
    newEndH.addEventListener('touchstart', (e) => { dragTarget = 'end'; e.stopPropagation(); }, { passive: true });

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
}
function syncBackfillProgress(parentLog, parentEndOverride) {
    const parentEnd = parentEndOverride || parentLog.endTime || (parentLog.startTime + (parentLog.duration || 60) * 60000);
    const total = parentEnd - parentLog.startTime;
    if (total <= 0) return;
    let startMs = parseTimeFromInput('ps', parentLog.startTime);
    let endMs = parseTimeFromInput('pe', parentLog.startTime);
    startMs = Math.max(parentLog.startTime, Math.min(parentEnd, startMs));
    endMs = Math.max(parentLog.startTime, Math.min(parentEnd, endMs));
    if (endMs <= startMs) endMs = Math.min(parentEnd, startMs + 60000);
    const left = Math.max(0, ((startMs - parentLog.startTime) / total) * 100);
    const right = Math.min(100, ((endMs - parentLog.startTime) / total) * 100);
    if (startMs !== parseTimeFromInput('ps', parentLog.startTime)) {
        setTimeInFields('ps', new Date(startMs));
    }
    if (endMs !== parseTimeFromInput('pe', parentLog.startTime)) {
        const endAtMidnight = endMs === beijingDateStrToDayStart(formatBeijingDate(parentLog.startTime)) + DAY_MS;
        setTimeInFields('pe', new Date(endMs), { show24: endAtMidnight });
    }
    document.getElementById('backfill-fill').style.left = left + '%';
    document.getElementById('backfill-fill').style.width = Math.max(2, right - left) + '%';
    document.getElementById('backfill-start-handle').style.left = left + '%';
    document.getElementById('backfill-end-handle').style.left = right + '%';
    document.getElementById('backfill-track-start').innerText = formatBeijingClockSec(parentLog.startTime);
    document.getElementById('backfill-track-end').innerText = formatBeijingClockSec(parentEnd);
    // 渲染已有并行占用区段（灰色块）
    const occupiedBox = document.getElementById('backfill-occupied');
    if (occupiedBox) {
        const pid = parentLog.id || parentLog.startTime;
        occupiedBox.innerHTML = '';
        [...logs.filter(l => l.parallel && l.parentId === pid), ...parallelHistory].forEach(p => {
            const pStart = Math.max(p.startTime, parentLog.startTime);
            const pEnd = Math.min(p.endTime || (p.startTime + (p.duration || 0) * 60000), parentEnd);
            if (pEnd <= pStart) return;
            const oLeft = ((pStart - parentLog.startTime) / total) * 100;
            const oWidth = ((pEnd - pStart) / total) * 100;
            const block = document.createElement('div');
            block.className = "absolute inset-y-0 bg-slate-300/60 rounded";
            block.style.left = oLeft + '%';
            block.style.width = Math.max(2, oWidth) + '%';
            occupiedBox.appendChild(block);
        });
    }
}
function parseTimeFromInput(prefix, refDate) {
    const h = parseInt(document.getElementById(prefix + '-h').value) || 0;
    const m = parseInt(document.getElementById(prefix + '-m').value) || 0;
    const s = parseInt(document.getElementById(prefix + '-s').value) || 0;
    const dayStart = beijingDateStrToDayStart(formatBeijingDate(refDate));
    if (h === 24) return (prefix === 'ee' || prefix === 'pe') && m === 0 && s === 0 ? dayStart + DAY_MS : null;
    return dayStart
        + Math.min(23, Math.max(0, h)) * 3600000
        + Math.min(59, Math.max(0, m)) * 60000
        + Math.min(59, Math.max(0, s)) * 1000;
}
function setTimeInFields(prefix, date, options = {}) {
    if (options.show24) {
        document.getElementById(prefix + '-h').value = '24';
        document.getElementById(prefix + '-m').value = '00';
        document.getElementById(prefix + '-s').value = '00';
        return;
    }
    const d = new Date(date.getTime() + BJ_OFFSET);
    document.getElementById(prefix + '-h').value = String(d.getUTCHours()).padStart(2,'0');
    document.getElementById(prefix + '-m').value = String(d.getUTCMinutes()).padStart(2,'0');
    document.getElementById(prefix + '-s').value = String(d.getUTCSeconds()).padStart(2,'0');
}
let _backfillRange = null;
let _backfillUiSession = null;

function resetBackfillEditor() {
    const session = _backfillUiSession;
    _backfillRange = null;
    _backfillUiSession = null;
    if (!session) return;
    const { parentLog, parentEnd } = session;
    const endAtMidnight = parentEnd === beijingDateStrToDayStart(formatBeijingDate(parentLog.startTime)) + DAY_MS;
    setTimeInFields('ps', new Date(parentLog.startTime));
    setTimeInFields('pe', new Date(parentEnd), { show24: endAtMidnight });
    syncBackfillProgress(parentLog, parentEnd);
}

function initTimeField(el, max) {
    const backfillField = el.id.startsWith('ps-') || el.id.startsWith('pe-');
    if (!backfillField) el.addEventListener('touchstart', function() {
        this.select();
    });
    el.addEventListener('focus', function() {
        if (backfillField) {
            this.select();
            return;
        }
        this.setSelectionRange(0, this.value.length);
        let tries = 0;
        const poll = setInterval(() => {
            tries++;
            if (document.activeElement !== this) {
                clearInterval(poll);
                return;
            }
            if (this.selectionStart === 0 && this.selectionEnd === this.value.length) {
                clearInterval(poll);
            } else {
                this.setSelectionRange(0, this.value.length);
            }
            if (tries > 20) clearInterval(poll);
        }, 50);
    });
    el.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 2);
        if (this.value.length >= 2 && !backfillField) {
            const all = this.parentElement.querySelectorAll('input[type="text"]');
            const idx = Array.from(all).indexOf(this);
            if (idx >= 0 && idx < all.length - 1) {
                const next = all[idx + 1];
                next.focus();
                setTimeout(() => {
                    next.setSelectionRange(0, next.value.length);
                }, 80);
            }
        }
        // 输入→进度条视觉同步（不写回输入框）
        if (_backfillRange) {
            const { start, end } = _backfillRange;
            const total = end - start;
            if (total > 0) {
                const startMs = parseTimeFromInput('ps', start);
                const endMs = parseTimeFromInput('pe', start);
                const left = Math.max(0, ((startMs - start) / total) * 100);
                const right = Math.min(100, ((endMs - start) / total) * 100);
                document.getElementById('backfill-fill').style.left = left + '%';
                document.getElementById('backfill-fill').style.width = Math.max(2, right - left) + '%';
                document.getElementById('backfill-start-handle').style.left = left + '%';
                document.getElementById('backfill-end-handle').style.left = right + '%';
            }
        }
    });
    el.addEventListener('blur', function() {
        const val = parseInt(this.value);
        if (isNaN(val)) this.value = '00';
        else this.value = String(Math.min(val, max)).padStart(2, '0');
    });
}

function setFieldColor(prefix, bg) {
    ['-h','-m','-s'].forEach(suf => {
        const el = document.getElementById(prefix + suf);
        if (!el) return;
        if (bg) {
            el.style.background = bg;
            el.style.color = '#dc2626';
        } else {
            el.style.background = '';
            el.style.color = '';
        }
    });
}

function snapTimeToRange() {
    if (!_backfillRange) return;
    const { start: prStart, end: prEnd } = _backfillRange;

    const rawPs = parseTimeFromInput('ps', prStart);
    const rawPe = parseTimeFromInput('pe', prStart);

    let sClamped = Math.max(prStart, Math.min(rawPs, prEnd));
    let eClamped = Math.min(prEnd, Math.max(rawPe, prStart));

    if (eClamped - sClamped < 60000) {
        eClamped = Math.min(prEnd, sClamped + 60000);
        if (eClamped - sClamped < 60000) {
            sClamped = Math.max(prStart, eClamped - 60000);
        }
    }

    const sChanged = sClamped !== rawPs;
    const eChanged = eClamped !== rawPe;

    if (sChanged) {
        setTimeInFields('ps', new Date(sClamped));
        flashRed('ps');
    }
    if (eChanged) {
        setTimeInFields('pe', new Date(eClamped));
        flashRed('pe');
    }
    if (!sChanged) setFieldColor('ps', '');
    if (!eChanged) setFieldColor('pe', '');

    syncBackfillProgress({ startTime: prStart, endTime: prEnd, duration: (prEnd - prStart) / 60000 });
}

let _snapRedTimers = {};
function flashRed(prefix) {
    if (_snapRedTimers[prefix]) clearTimeout(_snapRedTimers[prefix]);
    setFieldColor(prefix, '#fee2e2');
    _snapRedTimers[prefix] = setTimeout(() => {
        setFieldColor(prefix, '');
        delete _snapRedTimers[prefix];
    }, 1200);
}

function isTimeInParentRange() {
    if (!_backfillRange) return true;
    const { start: prStart, end: prEnd } = _backfillRange;
    const ps = parseTimeFromInput('ps', prStart);
    const pe = parseTimeFromInput('pe', prStart);
    return ps >= prStart && ps < pe && pe <= prEnd;
}
['ps-h','ps-m','ps-s','pe-h','pe-m','pe-s','es-h','es-m','es-s','ee-h','ee-m','ee-s'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const max = id === 'ee-h' || id === 'pe-h' ? 24 : (id.endsWith('-h') ? 23 : 59);
    initTimeField(el, max);
});
['fb-h','fb-m','fb-s','fe-h','fe-m','fe-s'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const max = id.endsWith('-h') ? 23 : 59;
    initTimeField(el, max);
});
initCalendarBackfillClockFields();

function getSegmentsInRange(rangeStart, rangeEnd, now = nowSecondMs()) {
    const currentLog = current ? { ...current, endTime: now, live: true } : null;
    const parallelLive = parallelCurrent ? { ...parallelCurrent, endTime: now, parallel: true, parentId: current?.id || null } : null;
    return logs
        .map(l => ({ ...l, endTime: l.endTime || l.startTime }))
        .concat(currentLog ? [currentLog] : [])
        .concat(parallelLive ? [parallelLive] : [])
        .concat(parallelHistory.map(l => ({ ...l, endTime: l.endTime || (l.startTime + (l.duration || 0) * 60000), parallel: true })))
        .filter(Boolean)
        .filter(l => l.endTime > rangeStart && l.startTime < rangeEnd)
        .map(l => ({
            ...l,
            clippedStart: Math.max(l.startTime, rangeStart),
            clippedEnd: Math.min(l.endTime, rangeEnd)
        }))
        .filter(l => l.clippedEnd > l.clippedStart)
        .sort((a, b) => a.clippedStart - b.clippedStart);
}

function getTodaySegments() {
    const now = nowSecondMs();
    const dayStart = beijingPeriodStart(now, DAY_MS);
    return getSegmentsInRange(dayStart, dayStart + DAY_MS, now);
}

const UNRECORDED_COLOR = '#cbd5e1';
function getTrackingStartMs() {
    const saved = Number(localStorage.getItem('v9_tracking_start'));
    const starts = logs.filter((log) => !log.parallel && !log.sceneActivity).map((log) => Number(log.startTime));
    if (current) starts.push(Number(current.startTime));
    unlocatedLogs.forEach((item) => starts.push(beijingDateStrToDayStart(item.date)));
    if (Number.isFinite(saved) && saved > 0) starts.push(saved);
    const valid = starts.filter(Number.isFinite);
    return valid.length ? Math.min(...valid) : beijingDateStrToDayStart(getTodayDateStr());
}

function getUnrecordedSegments(mainSegments, rangeStart, rangeEnd, now = nowSecondMs()) {
    const trackingStart = getTrackingStartMs();
    if (trackingStart == null) return [];
    const start = Math.max(rangeStart, beijingDateStrToDayStart(formatBeijingDate(trackingStart)));
    const end = Math.min(rangeEnd, now);
    if (end <= start) return [];
    const covered = mainSegments
        .filter((segment) => !segment.parallel && !segment.sceneActivity && !segment.unrecorded)
        .map((segment) => ({ start: Math.max(start, segment.clippedStart), end: Math.min(end, segment.clippedEnd) }))
        .filter((segment) => segment.end > segment.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);
    const gaps = [];
    let cursor = start;
    const addGap = (gapStart, gapEnd) => {
        if (gapEnd <= gapStart) return;
        gaps.push({
            startTime: gapStart, endTime: gapEnd,
            clippedStart: gapStart, clippedEnd: gapEnd,
            l1: '未记录时间', l2: '未记录时间', color: UNRECORDED_COLOR,
            unrecorded: true
        });
    };
    covered.forEach((segment) => {
        addGap(cursor, segment.start);
        cursor = Math.max(cursor, segment.end);
    });
    addGap(cursor, end);
    return gaps;
}

let reportBillboardReady = false;

function msToReportHours(ms) {
    return Math.round((ms / 3600000) * 10) / 10;
}

function compareReportDuration(a, b, ascending = false) {
    if (a.name === '未记录时间') return b.name === '未记录时间' ? 0 : 1;
    if (b.name === '未记录时间') return -1;
    const aMs = a.ms ?? a.exactHours ?? a.hours ?? 0;
    const bMs = b.ms ?? b.exactHours ?? b.hours ?? 0;
    return (ascending ? aMs - bMs : bMs - aMs) || a.name.localeCompare(b.name, 'zh-CN');
}

function aggregateReportSegments(segments, keyFn) {
    const map = new Map();
    segments.forEach((l) => {
        const key = keyFn(l);
        const ms = l.clippedEnd - l.clippedStart;
        const old = map.get(key) || {
            name: key,
            ms: 0,
            l1: l.l1 || '未分类',
            color: getCat(l.l1)?.color || '#94a3b8',
        };
        old.ms += ms;
        map.set(key, old);
    });
    return [...map.values()].sort(compareReportDuration);
}

function reportMainGroup(log) {
    if (log?.unrecorded) {
        return { key: 'unrecorded', name: '未记录时间', color: UNRECORDED_COLOR };
    }
    if (log?.scene) {
        const sceneName = displayName(log);
        return {
            key: `scene:${sceneName}`,
            name: sceneName,
            color: getSceneColor(sceneName),
        };
    }
    const l1 = log?.l1 || '未分类';
    return {
        key: `category:${l1}`,
        name: l1,
        color: getCat(l1)?.color || '#94a3b8',
    };
}

// 场景是一级目录；其下的场景记录是二级活动，未记录的剩余时段自动归为自由时间。
function buildMainChartComposition(mainSegs, parallelSegs, rangeStart, rangeEnd) {
    const groups = new Map();
    const detailSlices = new Map();
    const detailTotals = new Map();
    const sceneParents = [];

    function addDetail(parentName, log, ms, fallbackColor, nameOverride, colorOverride) {
        const name = nameOverride || displayName(log);
        const sliceKey = `${parentName}|${name}`;
        const color = colorOverride || getCat(log?.l1)?.color || fallbackColor || '#94a3b8';
        const slice = detailSlices.get(sliceKey) || { l1: parentName, name, ms: 0, color, free: name === '自由时间' };
        slice.ms += ms;
        detailSlices.set(sliceKey, slice);

        // 活动明细只认二级活动名称：无论发生在生活区还是场景内，都合并为同一项。
        const total = detailTotals.get(name) || { name, ms: 0, color };
        total.ms += ms;
        detailTotals.set(name, total);
    }

    const sceneActivities = mainSegs.filter((log) => log.sceneActivity);
    mainSegs.filter((log) => !log.sceneActivity).forEach((log) => {
        const group = reportMainGroup(log);
        const ms = log.clippedEnd - log.clippedStart;
        const item = groups.get(group.key) || { key: group.key, name: group.name, ms: 0, color: group.color };
        item.ms += ms;
        groups.set(group.key, item);
        if (log.scene) sceneParents.push({ log, group, ms, children: [] });
        if (!log.scene) {
            addDetail(group.name, log, ms, group.color);
        }
    });

    // 场景活动是主线切片，不再混在真正的并行统计中。
    sceneActivities.forEach((log) => {
            const parent = sceneParents
                .filter((item) => getSceneContainerId(item.log) === String(log.sceneParentId) || (log.sceneName && item.log.l2 === log.sceneName))
                .map((item) => ({
                    ...item,
                    overlap: Math.max(0, Math.min(item.log.clippedEnd, log.clippedEnd) - Math.max(item.log.clippedStart, log.clippedStart)),
                }))
                .sort((a, b) => b.overlap - a.overlap)[0];
            if (!parent?.overlap) return;
            parent.children.push({ log, start: Math.max(parent.log.clippedStart, log.clippedStart), end: Math.min(parent.log.clippedEnd, log.clippedEnd), ms: parent.overlap });
        });

    const sceneCoverage = [];
    sceneParents.forEach((parent) => {
        const sceneName = displayName(parent.log);
        sceneCoverage.push({
            name: sceneName,
            start: parent.log.clippedStart,
            end: parent.log.clippedEnd,
            color: getSceneColor(sceneName),
        });

        parent.children.forEach((child) => addDetail(parent.group.name, child.log, child.ms, parent.group.color));
        const intervals = parent.children
            .map((child) => ({ start: child.start, end: child.end }))
            .sort((a, b) => a.start - b.start);
        let coveredMs = 0;
        let coveredEnd = parent.log.clippedStart;
        intervals.forEach((interval) => {
            const start = Math.max(interval.start, coveredEnd);
            if (interval.end > start) {
                coveredMs += interval.end - start;
                coveredEnd = interval.end;
            }
        });
        const freeMs = Math.max(0, parent.ms - coveredMs);
        if (freeMs) {
            addDetail(parent.group.name, null, freeMs, '#ffffff', '自由时间', '#ffffff');
        }
    });

    return {
        l1: [...groups.values()]
            .sort(compareReportDuration)
            .map((item) => ({ name: item.name, hours: msToReportHours(item.ms), exactHours: item.ms / HOUR_MS, color: item.color })),
        // 供圆环定位的分片保留父块；供“活动明细”展示的总表则完全去掉一级目录。
        l2Slices: [...detailSlices.values()]
            .sort(compareReportDuration)
            .map((item) => ({ l1: item.l1, name: item.name, hours: msToReportHours(item.ms), exactHours: item.ms / HOUR_MS, color: item.color, free: item.free })),
        l2: [...detailTotals.values()]
            .sort(compareReportDuration)
            .map((item) => ({ name: item.name, hours: msToReportHours(item.ms), exactHours: item.ms / HOUR_MS, color: item.color })),
        sceneCoverage,
        sceneRange: { start: rangeStart, end: rangeEnd },
    };
}

function mergeUnlocatedIntoChart(chart, rangeStart, rangeEnd) {
    const entries = unlocatedLogs.filter((item) => {
        const dayStart = beijingDateStrToDayStart(item.date);
        return dayStart >= rangeStart && dayStart < rangeEnd;
    });
    const totalMs = entries.reduce((sum, item) => sum + item.durationMs, 0);
    if (!totalMs) return 0;
    const reduceUnrecorded = (rows, key) => {
        const item = rows.find((row) => row[key] === '未记录时间');
        if (!item) return;
        item.exactHours = Math.max(0, item.exactHours - totalMs / HOUR_MS);
        item.hours = msToReportHours(item.exactHours * HOUR_MS);
    };
    reduceUnrecorded(chart.l1, 'name');
    reduceUnrecorded(chart.l2, 'name');
    reduceUnrecorded(chart.l2Slices, 'name');
    const add = (rows, match, create, ms) => {
        const row = rows.find(match) || create();
        if (!rows.includes(row)) rows.push(row);
        row.exactHours = (row.exactHours || 0) + ms / HOUR_MS;
        row.hours = msToReportHours(row.exactHours * HOUR_MS);
    };
    entries.forEach((item) => {
        const name = item.l2 || item.l1;
        const color = getCat(item.l1)?.color || '#94a3b8';
        add(chart.l1, (row) => row.name === item.l1, () => ({ name: item.l1, hours: 0, exactHours: 0, color }), item.durationMs);
        add(chart.l2Slices, (row) => row.l1 === item.l1 && row.name === name,
            () => ({ l1: item.l1, name, hours: 0, exactHours: 0, color }), item.durationMs);
        add(chart.l2, (row) => row.name === name, () => ({ name, hours: 0, exactHours: 0, color }), item.durationMs);
    });
    ['l1', 'l2', 'l2Slices'].forEach((key) => {
        chart[key] = chart[key].filter((row) => row.exactHours > 0).sort(compareReportDuration);
    });
    return totalMs;
}

function buildMainComposition(segments, periodStart, periodEnd) {
    const clipped = segments
        .filter((l) => l.clippedEnd > periodStart && l.clippedStart < periodEnd)
        .map((l) => ({
            log: l,
            start: Math.max(periodStart, l.clippedStart),
            end: Math.min(periodEnd, l.clippedEnd),
        }))
        .filter((item) => item.end > item.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);

    let cursor = periodStart;
    const parts = [];
    clipped.forEach(({ log, start, end }) => {
        // 主线应当互斥；重叠数据只保留先开始的那一段，避免累计重复。
        const effectiveStart = Math.max(start, cursor);
        if (effectiveStart >= end) return;
        const name = displayName(log);
        const l1 = log.l1 || '未分类';
        const last = parts[parts.length - 1];
        if (last && last.name === name && last.l1 === l1 && last.end === effectiveStart) {
            last.end = end;
            last.ms += end - effectiveStart;
        } else {
            parts.push({ name, l1, start: effectiveStart, end, ms: end - effectiveStart, color: log.unrecorded ? UNRECORDED_COLOR : (getCat(log.l1)?.color || '#94a3b8') });
        }
        cursor = end;
    });
    return parts.map((part) => ({
        name: part.name,
        l1: part.l1,
        hours: msToReportHours(part.ms),
        width: (part.ms / (periodEnd - periodStart)) * 100,
        color: part.color,
        title: `${part.name} ${formatBeijingClockSec(part.start)}–${formatBeijingClockSec(part.end)}`,
    }));
}

function parallelHostL1(paraLog) {
    if (paraLog.parentId) {
        const parent = logs.find((l) => l.id === paraLog.parentId && !l.parallel);
        if (parent?.l1) return parent.l1;
    }
    // 兼容旧数据：用并行时段与主线的最大重叠来恢复所属分类。
    const start = paraLog.clippedStart ?? paraLog.startTime;
    const end = paraLog.clippedEnd ?? paraLog.endTime ?? start;
    const fallback = logs
        .filter((l) => !l.parallel && l.startTime < end && (l.endTime ?? nowSecondMs()) > start)
        .map((l) => ({
            l,
            overlap: Math.max(0, Math.min(l.endTime ?? end, end) - Math.max(l.startTime, start)),
        }))
        .sort((a, b) => b.overlap - a.overlap)[0];
    return fallback?.l?.l1 || '未分类';
}

function buildEventReport(rangeStart, rangeEnd, period, displayEnd = rangeEnd) {
    const dayMs = 86400000;
    const byType = new Map();
    const dailyCounts = new Map();
    const inRange = eventRecords.filter((record) => record.occurredAt >= rangeStart && record.occurredAt < rangeEnd);
    inRange
        .forEach((record) => {
            const date = formatBeijingDate(record.occurredAt);
            dailyCounts.set(date, (dailyCounts.get(date) || 0) + (record.count || 1));
            const type = eventTypeById(record.typeId);
            const key = record.typeId || record.typeName;
            const item = byType.get(key) || {
                id: key,
                name: type?.name || record.typeName || '已删除事件',
                icon: type?.icon || record.icon || '•',
                color: type?.color || record.color || '#64748b',
                count: 0,
                dailyCounts: {},
                days: new Set(),
                latest: 0,
                latestDateOnly: false,
            };
            item.count += record.count || 1;
            item.dailyCounts[date] = (item.dailyCounts[date] || 0) + (record.count || 1);
            item.days.add(formatBeijingDate(record.occurredAt));
            if (record.occurredAt >= item.latest) {
                item.latest = record.occurredAt;
                item.latestDateOnly = !!record.dateOnly;
            }
            byType.set(key, item);
        });
    const entries = [...byType.values()]
        .map((item) => ({ ...item, days: item.days.size }))
        .sort((a, b) => b.count - a.count || b.days - a.days || a.name.localeCompare(b.name, 'zh-CN'));
    return {
        period,
        recordsCount: inRange.length,
        daily: Array.from({ length: Math.max(0, Math.min(366, Math.ceil((displayEnd - rangeStart) / dayMs))) }, (_, index) => {
            const date = formatBeijingDate(rangeStart + index * dayMs);
            return { date, count: dailyCounts.get(date) || 0 };
        }),
        total: entries.reduce((sum, item) => sum + item.count, 0),
        activeDays: new Set(eventRecords.filter((record) => record.occurredAt >= rangeStart && record.occurredAt < rangeEnd).map((record) => formatBeijingDate(record.occurredAt))).size,
        entries,
    };
}

function buildLiveReportDay(rangeOffset = 0) {
    const now = nowSecondMs();
    const dayStart = beijingPeriodStart(now, DAY_MS) + rangeOffset * DAY_MS;
    const dayEnd = Math.min(dayStart + DAY_MS, now);
    const all = getSegmentsInRange(dayStart, dayEnd, now);
    const recordedMainSegs = all.filter((l) => !l.parallel);
    const recordedCore = recordedMainSegs.filter((l) => !l.sceneActivity);
    const unrecorded = getUnrecordedSegments(recordedCore, dayStart, dayStart + DAY_MS, now);
    const mainSegs = recordedMainSegs.concat(unrecorded);
    const coreMainSegs = recordedCore.concat(unrecorded);
    const paraSegs = all.filter((l) => l.parallel);
    const recordedMainMs = recordedCore.reduce((s, l) => s + (l.clippedEnd - l.clippedStart), 0);
    const accountedMs = coreMainSegs.reduce((s, l) => s + (l.clippedEnd - l.clippedStart), 0);
    const paraMs = paraSegs.reduce((s, l) => s + (l.clippedEnd - l.clippedStart), 0);

    const chartComposition = buildMainChartComposition(mainSegs, paraSegs, dayStart, dayStart + DAY_MS);
    const unlocatedMs = mergeUnlocatedIntoChart(chartComposition, dayStart, dayEnd);
    const { l1, l2, l2Slices, sceneCoverage, sceneRange } = chartComposition;

    const topL1 = l1[0];
    const focusPct = topL1 && accountedMs
        ? (Math.round(((topL1.exactHours ?? topL1.hours) / (accountedMs / HOUR_MS)) * 1000) / 10) + '%'
        : '0%';

    const paraL1Agg = aggregateReportSegments(paraSegs, displayName);
    const paraL1 = paraL1Agg.map((r) => ({ name: r.name, hours: msToReportHours(r.ms), exactHours: r.ms / HOUR_MS, color: r.color }));
    const topPara = paraL1[0];
    const paraRatio = recordedMainMs + unlocatedMs
        ? (Math.round((paraMs / (recordedMainMs + unlocatedMs)) * 1000) / 10) + '%'
        : '0%';

    const overlayMap = new Map();
    paraSegs.forEach((l) => {
        const act = displayName(l);
        const host = parallelHostL1(l);
        const key = act + '|' + host;
        const ms = l.clippedEnd - l.clippedStart;
        const old = overlayMap.get(key) || {
            l1: act,
            name: '叠在' + host,
            ms: 0,
            color: getCat(l.l1)?.color || '#a78bfa',
        };
        old.ms += ms;
        overlayMap.set(key, old);
    });
    const paraL2 = [...overlayMap.values()]
        .map((r) => ({ l1: r.l1, name: r.name, hours: msToReportHours(r.ms), exactHours: r.ms / HOUR_MS, color: r.color }))
        .sort((a, b) => b.exactHours - a.exactHours);

    const hostMs = new Map();
    paraSegs.forEach((l) => {
        const host = parallelHostL1(l);
        const ms = l.clippedEnd - l.clippedStart;
        hostMs.set(host, (hostMs.get(host) || 0) + ms);
    });
    const topHostEntry = [...hostMs.entries()].sort((a, b) => b[1] - a[1])[0];

    const timelineSegs = coreMainSegs.map((l) => {
        const left = ((l.clippedStart - dayStart) / DAY_MS) * 100;
        const width = ((l.clippedEnd - l.clippedStart) / DAY_MS) * 100;
        return {
            left,
            width,
            color: l.unrecorded ? UNRECORDED_COLOR : (getCat(l.l1)?.color || '#94a3b8'),
            label: displayName(l),
            title: `${displayName(l)} ${formatBeijingClockSec(l.clippedStart)}-${formatBeijingClockSec(l.clippedEnd)}`,
        };
    });

    return {
        _live: rangeOffset === 0,
        _period: 'day',
        _range: { start: dayStart, end: dayEnd },
        events: buildEventReport(dayStart, dayEnd, 'day'),
        timeline: {
            title: '24 小时时间轴',
            hint: '指定时段按时间定位；未指定补录只计入类别汇总',
            kind: 'day',
            scale: ['00:00', '06:00', '12:00', '18:00', '24:00'],
            segments: timelineSegs,
            nowPct: rangeOffset === 0 ? Math.min(100, Math.max(0, ((now - dayStart) / DAY_MS) * 100)) : null,
        },
        main: {
            meta: {
                title: formatBeijingDate(dayStart),
                range: '当日主线',
                footnote: '指定时段与未指定补录共同计入类别汇总。',
            },
            summary: [
                { icon: '🎯', label: '结构重心', value: topL1?.name || '—', sub: `占 ${focusPct}` },
                { icon: '🔀', label: '活动切换', value: String(Math.max(0, recordedCore.length - 1)), sub: '次' },
                { icon: '📋', label: '流水条数', value: String(recordedCore.length + unlocatedLogs.filter((item) => item.date === formatBeijingDate(dayStart)).length), sub: '条' },
            ],
            l1,
            l2,
            l2Slices,
            sceneCoverage,
            sceneRange,
        },
        parallel: {
            meta: {
                title: formatBeijingDate(dayStart),
                range: '并行活动',
                footnote: '并行时段可重叠累计。',
            },
            summary: [
                { icon: '⏳', label: '并行总时长', value: String(msToReportHours(paraMs)), sub: '小时' },
                { icon: '📐', label: '叠在主线比', value: paraRatio, sub: '并行/主线' },
                { icon: '🔝', label: '最常并行', value: topPara?.name || '—', sub: topPara ? topPara.hours + 'h' : '' },
                { icon: '🏠', label: '叠加最多时段', value: topHostEntry ? topHostEntry[0] : '—', sub: topHostEntry ? msToReportHours(topHostEntry[1]) + 'h' : '' },
            ],
            l1: paraL1,
            l2: paraL2,
        },
    };
}

function getReportPeriodData(period, options = {}) {
    if (period === 'day') return buildLiveReportDay(Math.min(0, Number(options.rangeOffset) || 0));
    return buildLiveReportPeriod(period, options);
}

function getBeijingReportRange(period, now, rangeOffset = 0) {
    const d = new Date(now + BJ_OFFSET);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const today = Date.UTC(y, m, day) - BJ_OFFSET;
    if (period === 'week') {
        const mondayOffset = (d.getUTCDay() + 6) % 7;
        const start = today - mondayOffset * DAY_MS + rangeOffset * 7 * DAY_MS;
        return { start, end: start + 7 * DAY_MS };
    }
    if (period === 'month') {
        const start = Date.UTC(y, m + rangeOffset, 1) - BJ_OFFSET;
        return { start, end: Date.UTC(y, m + rangeOffset + 1, 1) - BJ_OFFSET };
    }
    const start = Date.UTC(y + rangeOffset, 0, 1) - BJ_OFFSET;
    return { start, end: Date.UTC(y + rangeOffset + 1, 0, 1) - BJ_OFFSET };
}

function getReportPeriodTitle(period, range) {
    const start = new Date(range.start + BJ_OFFSET);
    const end = new Date(range.end - 1 + BJ_OFFSET);
    if (period === 'month') return `${start.getUTCFullYear()}年${start.getUTCMonth() + 1}月`;
    if (period === 'week') return `${start.getUTCFullYear()}年${start.getUTCMonth() + 1}月${start.getUTCDate()}日-${end.getUTCMonth() + 1}月${end.getUTCDate()}日`;
    return `${start.getUTCFullYear()}年`;
}

function resolveReportCategoryAverage(slot, periodData, view) {
    const l1 = String(slot?.l1 || '').trim();
    const l2 = String(slot?.l2 || '').trim();
    const category = l2 || String(slot?.category || '').trim();
    const period = periodData?._period;
    const range = periodData?._range;
    if (!category || !range || !['week', 'month'].includes(period)) {
        return { value: '—', label: '类别平均' };
    }
    const now = nowSecondMs();
    if (isSystemSleepSelection(l1, l2)) {
        return resolveSystemSleepAverage(slot, range, now);
    }
    const observedEnd = Math.min(range.end, now);
    const records = getSegmentsInRange(range.start, observedEnd, now)
        .filter((record) => l1 ? record.l1 === l1 && (!l2 || record.l2 === l2) : record.l1 === category);
    let totalMs = 0;
    records.forEach((record) => {
        const crossesIntoPeriod = record.startTime < range.start && record.endTime > range.start;
        if (crossesIntoPeriod && slot.carry === 'previous') return;
        totalMs += crossesIntoPeriod ? record.endTime - record.startTime : record.clippedEnd - record.clippedStart;
    });
    totalMs += unlocatedLogs.filter((item) => {
        const dayStart = beijingDateStrToDayStart(item.date);
        return dayStart >= range.start && dayStart < observedEnd && (l1 ? item.l1 === l1 && (!l2 || item.l2 === l2) : item.l1 === category);
    }).reduce((sum, item) => sum + item.durationMs, 0);
    // 其他类别按实际已经过的时长折算；睡眠有独立的完整自然日规则。
    const days = Math.max(1, (observedEnd - range.start) / DAY_MS);
    return {
        value: formatDuration(Math.round(totalMs / days / 1000) * 1000),
        label: `${category}平均`,
    };
}

function resolveSystemSleepAverage(slot, range, now) {
    // 已结算只算完整结束的自然日；实时模式会在今天已有一整段结束睡眠时，把今天一并纳入。
    const todayStart = beijingDateStrToDayStart(getTodayDateStr());
    const completedEnd = Math.min(range.end, todayStart);
    const completedDays = Math.max(0, Math.floor((completedEnd - range.start) / DAY_MS));

    const source = logs
        .concat(current ? [{ ...current, endTime: now }] : [])
        .concat(parallelHistory)
        .concat(parallelCurrent ? [{ ...parallelCurrent, endTime: now }] : [])
        .filter((record) => isSystemSleepSelection(record.l1, record.l2))
        .map((record) => ({ start: record.startTime, end: logEndMs(record, record.endTime || now) }))
        .filter((record) => Number.isFinite(record.start) && Number.isFinite(record.end) && record.end > record.start)
        .sort((a, b) => a.start - b.start);

    // 场景跨零点会把一晚睡眠切成多个片段；这里合并连续片段，再整体归到醒来的那一天。
    const nights = [];
    source.forEach((record) => {
        const previous = nights[nights.length - 1];
        if (previous && record.start <= previous.end + 1000) {
            previous.end = Math.max(previous.end, record.end);
        } else {
            nights.push({ ...record });
        }
    });

    let totalMs = 0;
    const isRealtime = range.end > todayStart;
    const todaySleeps = nights.filter((night) => {
        const wakeDay = beijingDateStrToDayStart(formatBeijingDate(night.end));
        return wakeDay === todayStart && night.end <= now;
    });
    const todayUnlocated = unlocatedLogs.filter((item) => isSystemSleepSelection(item.l1, item.l2)
        && beijingDateStrToDayStart(item.date) === todayStart);
    const includeToday = isRealtime && (todaySleeps.length > 0 || todayUnlocated.length > 0);
    const days = completedDays + (includeToday ? 1 : 0);
    if (!days) return { value: '—', label: '睡眠日均' };
    nights.forEach((night) => {
        // 睡眠是系统级特殊类别：始终按醒来的日期归属，不受普通类别的跨周/月选择影响。
        const wakeDay = beijingDateStrToDayStart(formatBeijingDate(night.end));
        const isCompletedDay = wakeDay >= range.start && wakeDay < completedEnd;
        const isIncludedToday = includeToday && wakeDay === todayStart;
        if (isCompletedDay || isIncludedToday) totalMs += night.end - night.start;
    });
    totalMs += unlocatedLogs.filter((item) => {
        if (!isSystemSleepSelection(item.l1, item.l2)) return false;
        const dayStart = beijingDateStrToDayStart(item.date);
        return (dayStart >= range.start && dayStart < completedEnd) || (includeToday && dayStart === todayStart);
    }).reduce((sum, item) => sum + item.durationMs, 0);
    return {
        value: formatDuration(Math.round(totalMs / days / 1000) * 1000),
        label: '睡眠日均',
    };
}

function buildYearCategoryComposition(segments, periodStart, periodEnd) {
    const grouped = new Map();
    buildMainComposition(segments, periodStart, periodEnd).forEach((part) => {
        const key = part.l1 || '未分类';
        const old = grouped.get(key) || { name: key, l1: key, ms: 0, color: part.color };
        old.ms += part.ms || (part.width / 100) * (periodEnd - periodStart);
        grouped.set(key, old);
    });
    return [...grouped.values()]
        .sort((a, b) => compareReportDuration(a, b, true))
        .map((part) => ({
            name: part.name,
            l1: part.l1,
            hours: msToReportHours(part.ms),
            width: (part.ms / (periodEnd - periodStart)) * 100,
            color: part.color,
            title: `${part.name} ${msToReportHours(part.ms)}h`,
        }));
}

function buildLiveReportPeriod(period, options = {}) {
    const now = nowSecondMs();
    const range = getBeijingReportRange(period, now, Number(options.rangeOffset) || 0);
    const todayStart = beijingDateStrToDayStart(getTodayDateStr());
    const summaryEnd = options.summaryMode === 'settled'
        ? Math.min(range.end, todayStart)
        : Math.min(range.end, now);
    const all = getSegmentsInRange(range.start, summaryEnd, now);
    const recordedMainSegs = all.filter((l) => !l.parallel);
    const recordedCore = recordedMainSegs.filter((l) => !l.sceneActivity);
    const unrecorded = getUnrecordedSegments(recordedCore, range.start, summaryEnd, now);
    const mainSegs = recordedMainSegs.concat(unrecorded);
    const coreMainSegs = recordedCore.concat(unrecorded);
    const paraSegs = all.filter((l) => l.parallel);
    const recordedMainMs = recordedCore.reduce((sum, l) => sum + l.clippedEnd - l.clippedStart, 0);
    const accountedMs = coreMainSegs.reduce((sum, l) => sum + l.clippedEnd - l.clippedStart, 0);
    const paraMs = paraSegs.reduce((sum, l) => sum + l.clippedEnd - l.clippedStart, 0);
    const chartComposition = buildMainChartComposition(mainSegs, paraSegs, range.start, range.end);
    const unlocatedMs = mergeUnlocatedIntoChart(chartComposition, range.start, summaryEnd);
    const { l1, l2, l2Slices, sceneCoverage, sceneRange } = chartComposition;
    const paraAgg = aggregateReportSegments(paraSegs, displayName);
    const paraL1 = paraAgg.map((r) => ({ name: r.name, hours: msToReportHours(r.ms), exactHours: r.ms / HOUR_MS, color: r.color }));
    const topL1 = l1[0];
    const focusPct = topL1 && accountedMs ? (Math.round(((topL1.exactHours ?? topL1.hours) / (accountedMs / HOUR_MS)) * 1000) / 10) + '%' : '0%';
    const paraRatio = recordedMainMs + unlocatedMs ? (Math.round((paraMs / (recordedMainMs + unlocatedMs)) * 1000) / 10) + '%' : '0%';
    const hostMs = new Map();
    paraSegs.forEach((l) => {
        const host = parallelHostL1(l);
        const ms = l.clippedEnd - l.clippedStart;
        hostMs.set(host, (hostMs.get(host) || 0) + ms);
    });
    const topHostEntry = [...hostMs.entries()].sort((a, b) => b[1] - a[1])[0];
    const bars = [];
    const reportEnd = period === 'year' ? range.end : summaryEnd;
    for (let periodStart = range.start; periodStart < reportEnd;) {
        const nextPeriodStart = period === 'year' ? nextBeijingMonthStart(periodStart) : periodStart + DAY_MS;
        const periodEnd = Math.min(nextPeriodStart, reportEnd);
        const daySegs = coreMainSegs.filter((l) => l.clippedEnd > periodStart && l.clippedStart < periodEnd);
        const segments = period === 'year'
            ? buildYearCategoryComposition(daySegs, periodStart, periodEnd)
            : buildMainComposition(daySegs, periodStart, periodEnd);
        const totalMs = segments.reduce((sum, part) => sum + (part.width / 100) * (periodEnd - periodStart), 0);
        const fullDate = formatBeijingDate(periodStart);
        const label = period === 'year' ? fullDate.slice(0, 7).replace('-', '/') : fullDate.slice(5).replace('-', '/');
        bars.push({ label, hours: msToReportHours(totalMs), segments });
        periodStart = nextPeriodStart;
    }
    const isCurrentPeriod = range.start <= now && range.end > now;
    const periodTitle = getReportPeriodTitle(period, range);
    return {
        _live: isCurrentPeriod,
        _period: period,
        _range: { start: range.start, end: summaryEnd },
        events: buildEventReport(range.start, Math.min(range.end, now), period, range.end),
        timeline: { title: period === 'year' ? `${periodTitle}每月分类构成` : `${periodTitle}每日时间构成`, hint: '时段按时间定位；未指定补录仅计入类别汇总', kind: 'bars', bars },
        main: {
            meta: { title: periodTitle, range: period === 'week' ? '周报主线' : period === 'month' ? '月报主线' : '本年主线', footnote: '指定时段按时间定位；未指定补录只计入时长。' },
            summary: [
                { icon: '🎯', label: '结构重心', value: topL1?.name || '—', sub: `占 ${focusPct}` },
                { icon: '🔀', label: '活动切换', value: String(Math.max(0, recordedCore.length - 1)), sub: '次' },
                { icon: '📋', label: '流水条数', value: String(recordedCore.length + unlocatedLogs.filter((item) => {
                    const dayStart = beijingDateStrToDayStart(item.date);
                    return dayStart >= range.start && dayStart < summaryEnd;
                }).length), sub: '条' },
            ], l1, l2, l2Slices, sceneCoverage, sceneRange,
        },
        parallel: {
            meta: { title: periodTitle, range: '并行活动', footnote: '并行时段可重叠累计。' },
            summary: [
                { icon: '⏳', label: '并行总时长', value: String(msToReportHours(paraMs)), sub: '小时' },
                { icon: '📐', label: '叠在主线比', value: paraRatio, sub: '并行/主线' },
                { icon: '🔝', label: '最常并行', value: paraL1[0]?.name || '—', sub: paraL1[0] ? paraL1[0].hours + 'h' : '' },
                { icon: '🏠', label: '叠加最多时段', value: topHostEntry ? topHostEntry[0] : '—', sub: topHostEntry ? msToReportHours(topHostEntry[1]) + 'h' : '' },
            ], l1: paraL1, l2: paraL1,
        },
    };
}

function ensureReportBillboard() {
    if (!document.getElementById('sunburst-svg')) return;
    if (!reportBillboardReady && typeof initReportBillboard === 'function') {
        initReportBillboard({ defaultPeriod: 'day', getPeriodData: getReportPeriodData });
        reportBillboardReady = true;
    }
}

function renderReport() {
    ensureReportBillboard();
    if (typeof renderReportBillboard === 'function') renderReportBillboard();
}

function showDrawer() {
    const drawer = document.getElementById('drawer');
    drawer.classList.remove('hidden');
    const panel = drawer.querySelector('.drawer-up');
    if (panel) {
        panel.classList.remove('drawer-up');
        void panel.offsetHeight;
        panel.classList.add('drawer-up');
    }
}

function openShortcutPicker() {
    pickerMode = 'shortcut';
    setDrawerDevAddress('B62');
    document.getElementById('drawer-title').innerText = "选择主线快捷";
    document.getElementById('drawer-footer').classList.add('hidden');
    showDrawer();
    renderPicker();
}
function openParallelShortcutPicker() {
    pickerMode = 'parallel-shortcut';
    setDrawerDevAddress('B63');
    document.getElementById('drawer-title').innerText = "选择并行快捷";
    document.getElementById('drawer-footer').classList.add('hidden');
    showDrawer();
    renderPicker();
}

function addShortcut(l1, l2, icon) {
    if (shortcuts.some(s => s.l1 === l1 && s.l2 === l2)) return;
    shortcuts.push({ l1, l2, icon: icon || "📌", customIcon: false });
    localStorage.setItem('v9_shorts', JSON.stringify(shortcuts));
    renderPicker();
    renderAll();
}
function addParallelShortcut(l1, l2, icon) {
    if (parallelShortcuts.some(s => s.l1 === l1 && s.l2 === l2)) return;
    const cat = getCat(l1);
    parallelShortcuts.push({ l1, l2: l2 || '', icon: icon || getSubIcon(l2 || '', cat?.icon || '📌', cat), customIcon: false });
    localStorage.setItem('v9_parallel_shorts', JSON.stringify(parallelShortcuts));
    renderPicker();
    renderAll();
}
function removeShortcut(l1, l2) {
    shortcuts = shortcuts.filter(s => !(s.l1 === l1 && s.l2 === l2));
    localStorage.setItem('v9_shorts', JSON.stringify(shortcuts));
    renderPicker();
    renderAll();
}
function renderDrawerToggle() {
    const btn = document.getElementById('drawer-view-toggle');
    if (!btn) return;
    if (pickerMode === 'record' || pickerMode === 'parallel-backfill' || pickerMode === 'edit' || pickerMode === 'split' || pickerMode === 'classify-log') {
        btn.classList.remove('hidden');
        const modes = [
            { key: 'columns', icon: '◧', title: '左右分栏' },
            { key: 'flat', icon: '⊞', title: '扁平铺满' },
        ];
        btn.innerHTML = modes.map(m =>
            `<span class="drawer-view-btn ${drawerViewMode === m.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}" data-mode="${m.key}" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;font-size:14px;cursor:pointer;transition:.12s" title="${m.title}">${m.icon}</span>`
        ).join('');
        btn.querySelectorAll('.drawer-view-btn').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                drawerViewMode = el.dataset.mode;
                renderDrawerToggle();
                renderPicker();
            });
        });
    } else {
        btn.classList.add('hidden');
    }
}
function renderPicker() {
    const l1Box = document.getElementById('drawer-l1');
    const l2Box = document.getElementById('drawer-l2');
    l1Box.innerHTML = "";
    l2Box.innerHTML = "";
    if (!cats.length) {
        l1Box.style.display = '';
        l2Box.className = "w-3/4 flex-1 min-h-0 p-4 overflow-y-auto grid grid-cols-2 content-start gap-3";
        const empty = document.createElement('div');
        empty.className = "p-4 text-sm text-slate-400 font-bold";
        empty.innerText = "暂无分类";
        l2Box.appendChild(empty);
        return;
    }

    if (pickerMode === 'shortcut') {
        l1Box.style.display = 'none';
        l2Box.className = "w-full flex-1 min-h-0 p-3 overflow-y-auto grid grid-cols-4 content-start gap-2";
        cats.forEach(c => {
            if (!c.subs.length) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = "bg-white border border-slate-100 rounded-xl p-2 text-center text-[10px] font-bold shadow-sm";
                btn.innerHTML = `<div class=\"text-base leading-none mb-0.5\">${escHtml(c.icon)}</div><div class=\"leading-tight\">${escHtml(c.name)}</div>`;
                const already = shortcuts.some(s => s.l1 === c.name && s.l2 === "");
                if (already) {
                    btn.classList.add('shortcut-choice-selected');
                    btn.setAttribute('aria-pressed', 'true');
                    btn.style.borderLeft = `4px solid ${safeColor(c.color, '#6366f1')}`;
                    btn.addEventListener('click', () => removeShortcut(c.name, ""));
                } else {
                    btn.addEventListener('click', () => addShortcut(c.name, "", c.icon));
                }
                l2Box.appendChild(btn);
                return;
            }
            c.subs.forEach(s => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = "bg-white border border-slate-100 rounded-xl p-2 text-center text-[10px] font-bold shadow-sm";
                btn.innerHTML = `<div class=\"text-base leading-none mb-0.5\">${escHtml(getSubIcon(s, c.icon, c))}</div><div class=\"leading-tight\">${escHtml(s)}</div>`;
                const already = shortcuts.some(sm => sm.l1 === c.name && sm.l2 === s);
                if (already) {
                    btn.classList.add('shortcut-choice-selected');
                    btn.setAttribute('aria-pressed', 'true');
                    btn.style.borderLeft = `4px solid ${safeColor(c.color, '#6366f1')}`;
                    btn.addEventListener('click', () => removeShortcut(c.name, s));
                } else {
                    btn.addEventListener('click', () => addShortcut(c.name, s, getSubIcon(s, c.icon, c)));
                }
                l2Box.appendChild(btn);
            });
        });
        return;
    }

    if (pickerMode === 'parallel-shortcut') {
        l1Box.style.display = 'none';
        l2Box.className = "w-full flex-1 min-h-0 p-3 overflow-y-auto grid grid-cols-4 content-start gap-2";
        cats.forEach(c => {
            if (!c.subs.length) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = "bg-white border border-slate-100 rounded-xl p-2 text-center text-[10px] font-bold shadow-sm";
                btn.innerHTML = `<div class=\"text-base leading-none mb-0.5\">${escHtml(c.icon)}</div><div class=\"leading-tight\">${escHtml(c.name)}</div>`;
                const already = parallelShortcuts.some(s => s.l1 === c.name && s.l2 === "");
                if (already) {
                    btn.classList.add('shortcut-choice-selected');
                    btn.setAttribute('aria-pressed', 'true');
                    btn.style.borderLeft = `4px solid ${safeColor(c.color, '#6366f1')}`;
                    btn.addEventListener('click', () => {
                        parallelShortcuts = parallelShortcuts.filter(s => !(s.l1 === c.name && s.l2 === ""));
                        localStorage.setItem('v9_parallel_shorts', JSON.stringify(parallelShortcuts));
                        renderPicker(); renderAll();
                    });
                } else {
                    btn.addEventListener('click', () => addParallelShortcut(c.name, "", getSubIcon("", c.icon, c)));
                }
                l2Box.appendChild(btn);
                return;
            }
            c.subs.forEach(s => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = "bg-white border border-slate-100 rounded-xl p-2 text-center text-[10px] font-bold shadow-sm";
                btn.innerHTML = `<div class=\"text-base leading-none mb-0.5\">${escHtml(getSubIcon(s, c.icon, c))}</div><div class=\"leading-tight\">${escHtml(s)}</div>`;
                const already = parallelShortcuts.some(sm => sm.l1 === c.name && sm.l2 === s);
                if (already) {
                    btn.classList.add('shortcut-choice-selected');
                    btn.setAttribute('aria-pressed', 'true');
                    btn.style.borderLeft = `4px solid ${safeColor(c.color, '#6366f1')}`;
                    btn.addEventListener('click', () => {
                        parallelShortcuts = parallelShortcuts.filter(sm => !(sm.l1 === c.name && sm.l2 === s));
                        localStorage.setItem('v9_parallel_shorts', JSON.stringify(parallelShortcuts));
                        renderPicker(); renderAll();
                    });
                } else {
                    btn.addEventListener('click', () => addParallelShortcut(c.name, s, getSubIcon(s, c.icon, c)));
                }
                l2Box.appendChild(btn);
            });
        });
        return;
    }

    if ((drawerViewMode === 'flat' || pickerMode === 'calendar-backfill') && (pickerMode === 'record' || pickerMode === 'parallel-backfill' || pickerMode === 'edit' || pickerMode === 'split' || pickerMode === 'classify-log' || pickerMode === 'calendar-backfill')) {
        l1Box.style.display = 'none';
        l2Box.className = "w-full flex-1 min-h-0 p-3 overflow-y-auto grid grid-cols-5 content-start gap-1.5";
        appendDrawerRecentsBar(l2Box);
        cats.filter(c => pickerMode !== 'calendar-backfill' || c.name !== '场景').forEach(c => {
            if (!c.subs.length) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = "bg-white border border-slate-100 rounded-xl p-1.5 text-center text-[10px] font-bold text-slate-600 shadow-sm active:bg-indigo-50";
                btn.innerHTML = `<div class="text-base leading-none mb-0.5">${escHtml(c.icon)}</div><div class="leading-tight">${escHtml(c.name)}</div>`;
                const mode = pickerMode;
                btn.addEventListener('click', () => drawerPick(c.name, "", mode));
                l2Box.appendChild(btn);
                return;
            }
            c.subs.forEach(s => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = "bg-white border border-slate-100 rounded-xl p-1.5 text-center text-[10px] font-bold text-slate-600 shadow-sm active:bg-indigo-50";
                btn.innerHTML = `<div class="text-base leading-none mb-0.5">${escHtml(getSubIcon(s, c.icon, c))}</div><div class="leading-tight">${escHtml(s)}</div>`;
                const mode = pickerMode;
                btn.addEventListener('click', () => drawerPick(c.name, s, mode));
                l2Box.appendChild(btn);
            });
        });
        return;
    }

    if (drawerViewMode === 'stacked' && (pickerMode === 'record' || pickerMode === 'parallel-backfill' || pickerMode === 'edit' || pickerMode === 'split' || pickerMode === 'classify-log')) {
        l1Box.style.display = 'none';
        l2Box.className = "w-full flex-1 min-h-0 p-4 overflow-y-auto";
        appendDrawerRecentsBar(l2Box);
        cats.forEach(c => {
            const header = document.createElement('div');
            header.className = "flex items-center gap-2 mb-2 mt-4 first:mt-0";
            header.innerHTML = `<span class="text-lg">${escHtml(c.icon)}</span><span class="text-sm font-black text-slate-500 uppercase tracking-wider">${escHtml(c.name)}</span>`;
            l2Box.appendChild(header);
            const grid = document.createElement('div');
            grid.className = "grid grid-cols-5 gap-1.5";
            const direct = document.createElement('button');
            direct.type = 'button';
            direct.className = "bg-indigo-600 text-white border border-indigo-600 rounded-xl p-1.5 text-center text-[10px] font-bold shadow-sm active:bg-indigo-700";
            direct.innerHTML = `<div class="text-base leading-none mb-0.5">${escHtml(c.icon)}</div><div class="leading-tight">${escHtml(c.name)}</div>`;
            const mode = pickerMode;
            direct.addEventListener('click', () => drawerPick(c.name, "", mode));
            grid.appendChild(direct);
            c.subs.forEach(s => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = "bg-white border border-slate-100 rounded-xl p-1.5 text-center text-[10px] font-bold text-slate-600 shadow-sm active:bg-indigo-50";
                btn.innerHTML = `<div class="text-base leading-none mb-0.5">${escHtml(getSubIcon(s, c.icon, c))}</div><div class="leading-tight">${escHtml(s)}</div>`;
                const mode = pickerMode;
                btn.addEventListener('click', () => drawerPick(c.name, s, mode));
                grid.appendChild(btn);
            });
            l2Box.appendChild(grid);
        });
        return;
    }

    l1Box.style.display = '';
    l2Box.className = "w-3/4 flex-1 min-h-0 p-4 overflow-y-auto grid grid-cols-3 content-start gap-2";
    if (!cats.some(c => c.name === selL1)) selL1 = cats[0].name;
    if (isPickerWithRecents()) appendDrawerRecentsBar(l2Box);

    cats.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `w-full py-5 text-sm font-black ${selL1 === c.name ? 'bg-white text-indigo-600 border-l-4 border-indigo-600' : 'text-slate-400'}`;
        btn.innerText = c.name;
        btn.addEventListener('click', () => {
            selL1 = c.name;
            renderPicker();
        });
        l1Box.appendChild(btn);
    });

    const selected = cats.find(c => c.name === selL1);
    if (!selected) return;
    const reportCategoryPicker = pickerMode === 'report-summary-category';
    if (!reportCategoryPicker && !selected.subs.length) {
        const direct = document.createElement('button');
        direct.type = 'button';
        direct.className = "bg-indigo-600 text-white border border-indigo-600 p-4 rounded-2xl text-sm font-black shadow-sm active:bg-indigo-700";
        direct.innerText = `${selected.name}`;
        const mode = pickerMode;
        direct.addEventListener('click', () => drawerPick(selected.name, "", mode));
        l2Box.appendChild(direct);
    }

    selected.subs.forEach(s => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = "drawer-column-item";
        const icon = document.createElement('span');
        icon.className = 'drawer-column-item-icon';
        icon.textContent = getSubIcon(s, selected.icon, selected);
        const label = document.createElement('span');
        label.className = 'drawer-column-item-label';
        label.textContent = s;
        btn.append(icon, label);
        const mode = pickerMode;
        const category = selL1;
        btn.addEventListener('click', () => drawerPick(category, s, mode));
        l2Box.appendChild(btn);
    });
    if (!selected.subs.length) {
        const hint = document.createElement('div');
        hint.className = "col-span-full text-sm text-slate-300 font-bold px-2";
        hint.innerText = reportCategoryPicker
            ? "这个分类还没有二级目录，暂时不能用于类别统计。"
            : "这个一级分类还没有子类，也可以直接记录。";
        l2Box.appendChild(hint);
    }
}

const REPORT_REFRESH_MS = 15 * 60 * 1000;
let lastSecondTs = 0;
let lastReportRefreshBucket = -1;
function tick() {
    const now = nowSecondMs();
    const clockNow = getViewAnchorMs(getTodayDateStr());
    const d = new Date(now + BJ_OFFSET);
    const secAngle = d.getUTCSeconds() * 6;

    const p = getClockPrefs();
    const hourStart = beijingPeriodStart(now, HOUR_MS);
    const hourEnd = hourStart + HOUR_MS;
    const dayStart = beijingPeriodStart(now, DAY_MS);
    const dayEnd = dayStart + DAY_MS;
    const show60 = p.layout === 'dual' || p.singleAxis === '60m';
    const show24 = p.layout === 'dual' || p.singleAxis === '24h';

    if (show60) {
        const wA = getClockWindow('a', getTodayDateStr());
        const spanA = wA.rangeEnd - wA.rangeStart;
        const hand60 = document.getElementById('hand-60m');
        const angle60 = spanA > 0 ? ((clockNow - wA.rangeStart) / spanA) * 360 : 0;
        if (hand60) hand60.style.transform = `translateX(-50%) rotate(${angle60}deg)`;
        const sec60 = document.getElementById('second-60m');
        if (sec60) sec60.style.transform = `rotate(${secAngle}deg)`;
    }
    if (show24) {
        const wB = getClockWindow('b', getTodayDateStr());
        const spanB = wB.rangeEnd - wB.rangeStart;
        const hand24 = document.getElementById('hand-24h');
        const angle24 = spanB > 0 ? ((clockNow - wB.rangeStart) / spanB) * 360 : 0;
        if (hand24) hand24.style.transform = `translateX(-50%) rotate(${angle24}deg)`;
        const sec24 = document.getElementById('second-24h');
        if (sec24) sec24.style.transform = `rotate(${secAngle}deg)`;
    }

    const sec = Math.floor(now / 1000);
    const todayStr = formatBeijingDate(now);
    if (todayStr !== lastBeijingDateStr) {
        lastBeijingDateStr = todayStr;
        ensureDayRolloversBefore(now);
        renderAll();
    }
    if (sec !== lastSecondTs) {
        lastSecondTs = sec;
        const liveUnassigned = getActiveUnassignedSegment(todayStr, now);
        if (liveUnassigned && !eventParentSelecting && document.getElementById('page-record')?.classList.contains('active')
            && !document.querySelector('#log-list #live-unassigned-duration')) {
            renderHomeHistory();
        }

        updateClockCenterLabels(clockNow);

        if (current) {
            const diff = now - current.startTime;
            const el = document.getElementById('header-timer');
            if (el) el.innerText = formatDuration(diff);
            const liveDur = document.getElementById('live-main-duration');
            if (liveDur) liveDur.innerText = formatDuration(diff);
        } else if (liveUnassigned) {
            const duration = formatDuration(now - liveUnassigned.start);
            setText('header-timer', duration);
            setText('live-unassigned-duration', duration);
        } else {
            setText('header-timer', '00:00:00');
        }
        if (parallelCurrent) {
            const diff = now - parallelCurrent.startTime;
            const badge = document.getElementById('parallel-status');
            if (badge) {
                badge.classList.remove('hidden');
                badge.innerText = `${parallelCurrent.icon || '⏎'} ${(parallelCurrent.l2 || parallelCurrent.l1)} ${formatDuration(diff)}`;
            }
            const livePDur = document.getElementById('live-parallel-duration');
            if (livePDur) livePDur.innerText = formatDuration(diff);
        } else {
            const badge = document.getElementById('parallel-status');
            if (badge && !badge._pinned) badge.classList.add('hidden');
        }
        renderDayRemain();
        if (recordMode === 'journal' && !current && !eventParentSelecting
            && sec % 60 === 0 && document.getElementById('page-record')?.classList.contains('active')) {
            renderHomeHistory();
        }

        // 进行中的记录纳入日报统计，但报表不必每秒重绘；每 15 分钟更新一次。
        const reportBucket = Math.floor(now / REPORT_REFRESH_MS);
        if (reportBucket !== lastReportRefreshBucket) {
            lastReportRefreshBucket = reportBucket;
            renderReport();
        }

        if(current) {
            document.getElementById('status-light').className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
            setText('header-l2', displayName(current));
            setText('header-memo', current.note || "");
        } else if (liveUnassigned) {
            document.getElementById('status-light').className = 'w-2.5 h-2.5 rounded-full bg-slate-400 animate-pulse shrink-0';
            setText('header-l2', '未分配');
            setText('header-memo', '');
        } else {
            document.getElementById('status-light').className = "w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0";
            setText('header-l2', "等待开启...");
            setText('header-memo', "");
        }
        updateUI();
    }
}

function renderDayRemain() {
    const fill = document.getElementById('day-remain-fill');
    const flame = document.getElementById('match-flame');
    if (!fill) return;
    const now = nowSecondMs();
    const dayStart = beijingDateStrToDayStart(getTodayDateStr());
    const elapsed = Math.min(DAY_MS, Math.max(0, now - dayStart));
    const remain = Math.max(0, DAY_MS - elapsed);
    const remainPct = (remain / DAY_MS) * 100;
    fill.style.width = `${remainPct}%`;
    if (flame) {
        flame.style.left = `calc(${remainPct}% - 1px)`;
        flame.style.opacity = (remainPct > 1 && remainPct < 99) ? '1' : '0';
    }
    setText('day-remain-label', `今天剩余 ${Math.round(remainPct)}%`);
}

function updateUI() {
    renderFlow();
}

window.addEventListener('pageshow', () => {
    try {
        normalizeCurrentTimestamps();
        const todayStr = formatBeijingDate(nowSecondMs());
        if (todayStr !== lastBeijingDateStr) lastBeijingDateStr = todayStr;
        if (ensureDayRolloversBefore(nowSecondMs())) renderAll();
    } catch (e) { console.warn('pageshow rollover', e); }
});

function renderFlow() {
    const todayStr = getTodayDateStr();
    const now = getViewAnchorMs(todayStr);
    const dayStart = beijingPeriodStart(now, DAY_MS);
    const dayEnd = dayStart + DAY_MS;
    const hourStart = beijingPeriodStart(now, HOUR_MS);
    const hourEnd = hourStart + HOUR_MS;
    applyClockLayout();
    const p = getClockPrefs();
    const show60 = p.layout === 'dual' || p.singleAxis === '60m';
    const show24 = p.layout === 'dual' || p.singleAxis === '24h';

    const currentLog = current ? { ...current, endTime: now, live: true } : null;
    const all = logs
        .map(l => ({ ...l, endTime: l.endTime || l.startTime }))
        .concat(currentLog ? [currentLog] : [])
        .concat(parallelCurrent ? [{ ...parallelCurrent, endTime: now, parallel: true, parentId: current?.id || null }] : [])
        .concat(parallelHistory.filter(ph => ph.endTime > dayStart || (ph.startTime && ph.startTime < dayEnd)).map(ph => ({ ...ph, endTime: ph.endTime || (ph.startTime + (ph.duration || 0) * 60000) })))
        .filter(Boolean);

    if (show60) {
        const wA = getClockWindow('a', todayStr);
        renderOneClockRing({
            gSeg: document.getElementById('svg-60m'),
            gMarks: document.getElementById('svg-60m-marks'),
            handEl: document.getElementById('hand-60m'),
            rangeStart: wA.rangeStart,
            rangeEnd: wA.rangeEnd,
            logs: all,
            now
        });
    }
    if (show24) {
        const wB = getClockWindow('b', todayStr);
        renderOneClockRing({
            gSeg: document.getElementById('svg-24h'),
            gMarks: document.getElementById('svg-24h-marks'),
            handEl: document.getElementById('hand-24h'),
            rangeStart: wB.rangeStart,
            rangeEnd: wB.rangeEnd,
            logs: all,
            now
        });
    }
    updateClockCenterLabels(now);
}


const CALENDAR_YM_WHEEL_H = 36;
const CALENDAR_YM_WHEEL_PAD = 2;
let calendarYmWheelTimer = null;

function highlightCalendarYmWheelItem(listEl, index) {
    listEl.querySelectorAll('.calendar-ym-wheel-item:not(.calendar-ym-wheel-pad)').forEach((el, i) => {
        el.classList.toggle('is-active', i === index);
    });
}

function scrollCalendarYmWheelToIndex(viewport, listEl, index) {
    const items = listEl.querySelectorAll('.calendar-ym-wheel-item:not(.calendar-ym-wheel-pad)');
    if (!items.length) return 0;
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    viewport.scrollTop = (clamped + CALENDAR_YM_WHEEL_PAD) * CALENDAR_YM_WHEEL_H;
    highlightCalendarYmWheelItem(listEl, clamped);
    return clamped;
}

function getCalendarYmWheelValue(viewport, listEl) {
    const items = listEl.querySelectorAll('.calendar-ym-wheel-item:not(.calendar-ym-wheel-pad)');
    if (!items.length) return null;
    const idx = Math.round(viewport.scrollTop / CALENDAR_YM_WHEEL_H) - CALENDAR_YM_WHEEL_PAD;
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    return items[clamped].dataset.value;
}

function populateCalendarYmWheel(listEl, items, activeValue) {
    listEl.innerHTML = '';
    for (let i = 0; i < CALENDAR_YM_WHEEL_PAD; i++) {
        const pad = document.createElement('li');
        pad.className = 'calendar-ym-wheel-item calendar-ym-wheel-pad';
        pad.setAttribute('aria-hidden', 'true');
        listEl.appendChild(pad);
    }
    items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'calendar-ym-wheel-item';
        li.dataset.value = String(item.value);
        li.textContent = item.label;
        listEl.appendChild(li);
    });
    for (let i = 0; i < CALENDAR_YM_WHEEL_PAD; i++) {
        const pad = document.createElement('li');
        pad.className = 'calendar-ym-wheel-item calendar-ym-wheel-pad';
        pad.setAttribute('aria-hidden', 'true');
        listEl.appendChild(pad);
    }
    const startIdx = Math.max(0, items.findIndex((it) => String(it.value) === String(activeValue)));
    return startIdx;
}

function bindCalendarYmWheel(viewport, listEl) {
    viewport.onscroll = () => {
        clearTimeout(calendarYmWheelTimer);
        calendarYmWheelTimer = setTimeout(() => {
            const idx = Math.round(viewport.scrollTop / CALENDAR_YM_WHEEL_H) - CALENDAR_YM_WHEEL_PAD;
            scrollCalendarYmWheelToIndex(viewport, listEl, idx);
        }, 90);
    };
}

function openCalendarYearMonthPicker() {
    const modal = document.getElementById('calendar-ym-modal');
    const yearVp = document.getElementById('calendar-ym-year-viewport');
    const yearList = document.getElementById('calendar-ym-year-list');
    const monthVp = document.getElementById('calendar-ym-month-viewport');
    const monthList = document.getElementById('calendar-ym-month-list');
    if (!modal || !yearVp || !yearList || !monthVp || !monthList) return;

    const now = new Date(nowSecondMs() + BJ_OFFSET);
    const curYear = now.getUTCFullYear();
    const yearItems = [];
    for (let y = curYear - 10; y <= curYear + 1; y++) {
        yearItems.push({ value: y, label: String(y) });
    }
    const monthItems = [];
    for (let m = 0; m < 12; m++) {
        monthItems.push({ value: m, label: String(m + 1) });
    }

    const yIdx = populateCalendarYmWheel(yearList, yearItems, calendarViewYear);
    const mIdx = populateCalendarYmWheel(monthList, monthItems, calendarViewMonth);
    bindCalendarYmWheel(yearVp, yearList);
    bindCalendarYmWheel(monthVp, monthList);

    modal.classList.remove('hidden');
    document.body.classList.add('calendar-ym-open');
    requestAnimationFrame(() => {
        scrollCalendarYmWheelToIndex(yearVp, yearList, yIdx);
        scrollCalendarYmWheelToIndex(monthVp, monthList, mIdx);
    });
}

function closeCalendarYearMonthPicker() {
    const modal = document.getElementById('calendar-ym-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('calendar-ym-open');
}

function confirmCalendarYearMonthPicker() {
    const yearVp = document.getElementById('calendar-ym-year-viewport');
    const yearList = document.getElementById('calendar-ym-year-list');
    const monthVp = document.getElementById('calendar-ym-month-viewport');
    const monthList = document.getElementById('calendar-ym-month-list');
    const y = yearVp && yearList ? getCalendarYmWheelValue(yearVp, yearList) : null;
    const m = monthVp && monthList ? getCalendarYmWheelValue(monthVp, monthList) : null;
    if (y != null) calendarViewYear = parseInt(y, 10);
    if (m != null) calendarViewMonth = parseInt(m, 10);
    closeCalendarYearMonthPicker();
    renderCalendarPage();
}

function shiftCalendarMonth(delta) {
    calendarViewMonth += delta;
    while (calendarViewMonth < 0) { calendarViewMonth += 12; calendarViewYear -= 1; }
    while (calendarViewMonth > 11) { calendarViewMonth -= 12; calendarViewYear += 1; }
    renderCalendarPage();
}

function renderFlowCalendar() {
    const host = document.getElementById('flow-calendar');
    if (!host) return;
    host.innerHTML = '';
    const todayStr = formatBeijingDate(nowSecondMs());
    const head = document.createElement('div');
    head.className = 'flow-calendar-head';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'flow-calendar-nav btn-active';
    prev.innerText = '‹';
    prev.addEventListener('click', () => shiftCalendarMonth(-1));
    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'flow-calendar-title flow-calendar-title-btn btn-active';
    title.innerText = `${calendarViewYear}年${calendarViewMonth + 1}月`;
    title.addEventListener('click', openCalendarYearMonthPicker);
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'flow-calendar-nav btn-active';
    next.innerText = '›';
    next.addEventListener('click', () => shiftCalendarMonth(1));
    head.append(prev, title, next);
    host.appendChild(head);

    const weekdays = document.createElement('div');
    weekdays.className = 'flow-calendar-weekdays';
    ['一', '二', '三', '四', '五', '六', '日'].forEach((w) => {
        const el = document.createElement('span');
        el.innerText = w;
        weekdays.appendChild(el);
    });
    host.appendChild(weekdays);

    const grid = document.createElement('div');
    grid.className = 'flow-calendar-grid';
    const first = new Date(Date.UTC(calendarViewYear, calendarViewMonth, 1));
    const startWeekday = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(calendarViewYear, calendarViewMonth + 1, 0)).getUTCDate();
    const logDays = collectLogCalendarDays();

    for (let i = 0; i < startWeekday; i++) {
        const pad = document.createElement('span');
        pad.className = 'flow-calendar-pad';
        grid.appendChild(pad);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calendarViewYear}-${pad2(calendarViewMonth + 1)}-${pad2(d)}`;
        const daySummary = getCalendarDaySummary(dateStr);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flow-calendar-day btn-active';
        if (dateStr === todayStr) btn.classList.add('is-today');
        if (dateStr === viewDate) btn.classList.add('is-selected');
        if (dateStr > todayStr) btn.classList.add('is-future');
        if (logDays.has(dateStr)) btn.classList.add('has-logs');
        const eventCount = eventRecords.filter(item => formatBeijingDate(item.occurredAt) === dateStr).reduce((sum, item) => sum + (item.count || 1), 0);
        if (eventCount) {
            const marker = document.createElement('span');
            marker.className = 'calendar-event-marker';
            marker.textContent = eventCount > 99 ? '99+' : String(eventCount);
            marker.setAttribute('aria-hidden', 'true');
            btn.appendChild(marker);
            btn.setAttribute('aria-label', `${dateStr}，${eventCount} 次事件`);
        }
        if (daySummary.totalMs > 0) {
            const load = Math.min(1, daySummary.totalMs / DAY_MS);
            btn.style.setProperty('--calendar-load', String(load));
            btn.title = `${formatDuration(daySummary.totalMs)} · ${daySummary.categories.length} 个一级目录`;
        }
        const numEl = document.createElement('span');
        numEl.className = 'flow-calendar-day-num';
        numEl.innerText = String(d);
        const todayLabel = document.createElement('span');
        todayLabel.className = 'flow-calendar-day-today-label';
        todayLabel.innerText = '今';
        btn.append(numEl, todayLabel);
        if (dateStr <= todayStr) btn.addEventListener('click', () => setViewDate(dateStr));
        else btn.disabled = true;
        grid.appendChild(btn);
    }
    host.appendChild(grid);
}

function switchTab(t) {
    pickerMode = 'record';
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const page = document.getElementById('page-' + t);
    if (page) page.classList.add('active');
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTop = 0;
    if (t === 'dev' && typeof renderDevAppearancePanel === 'function') renderDevAppearancePanel();
    ['record', 'calendar', 'report', 'mine'].forEach(name => {
        const nav = document.getElementById('nav-' + name);
        if (nav) {
            nav.classList.remove('text-indigo-600');
            nav.classList.add('text-slate-400');
        }
    });
    const btn = document.getElementById('nav-'+t); if(btn) btn.classList.replace('text-slate-400','text-indigo-600');
    if (t === 'report') renderReport();
    if (t === 'event-home') renderEventHome();
    if (t === 'record') {
        renderRecordPage();
        renderShortcuts();
        renderParallelShortcuts();
    }
    if (t === 'calendar') renderCalendarPage();
    if (t === 'mine') syncConfigSectionUI();
}
function handleFreeInput() {
    const el = document.getElementById('free-input'); const val = el.value.trim(); if(!val) return;
    const backfillVisible = !document.getElementById('free-backfill').classList.contains('hidden');
    if (backfillVisible) {
        // 带时间段的补录模式
        const now = nowSecondMs();
        const dayStart = beijingPeriodStart(now, DAY_MS);
        const fbH = parseInt(document.getElementById('fb-h').value) || 0;
        const fbM = parseInt(document.getElementById('fb-m').value) || 0;
        const fbS = parseInt(document.getElementById('fb-s').value) || 0;
        const feH = parseInt(document.getElementById('fe-h').value) || 0;
        const feM = parseInt(document.getElementById('fe-m').value) || 0;
        const feS = parseInt(document.getElementById('fe-s').value) || 0;
        const startMs = dayStart + fbH * 3600000 + fbM * 60000 + fbS * 1000;
        const endMs = dayStart + feH * 3600000 + feM * 60000 + feS * 1000;
        if (endMs <= startMs) { showConfirm('⏱ 时间不合法', '结束时间必须晚于开始时间。', '知道了', () => {}); return; }
        const match = matchCategoryFromInput(val);
        const conflicts = mainRecordOverlaps(startMs, endMs);
        if (conflicts.length) {
            showConfirm('时间段已被占用', `这段时间与「${displayName(conflicts[0])}」重叠，不能重复补记主线时间。`, '知道了', () => {});
            return;
        }
        if (intervalExceedsDayBudget(startMs, endMs)) {
            showConfirm('时间总数不够分配', '这段补录会超过当天剩余的未记录时间。', '知道了', () => {});
            return;
        }
        const cat = getCat(match.l1);
        const entry = {
            id: genId(),
            startTime: startMs,
            endTime: endMs,
            duration: Math.round((endMs - startMs) / 60000),
            l1: match.l1, l2: match.l2 || '',
            tag: match.tag,
            note: match.note,
            color: cat?.color || '#cbd5e1',
            parallel: false,
            ...(recordMode === 'journal' ? { journal: true } : {})
        };
        logs.unshift(entry);
        localStorage.setItem('v9_logs', JSON.stringify(logs));
        el.value = '';
        document.getElementById('free-backfill').classList.add('hidden');
        renderAll();
        return;
    }
    const match = matchCategoryFromInput(val);
    executeRecord(match.l1, match.l2, match.tag, match.note);
    el.value = "";
}

function closeDrawer() {
    const wasBackfill = pickerMode === 'split' || pickerMode.startsWith('parallel-backfill');
    const wasCalendarBackfill = pickerMode === 'calendar-backfill';
    if (_cleanupBackfillDrag) { _cleanupBackfillDrag(); }
    if (wasBackfill) resetBackfillEditor();
    const wasClassify = pickerMode === 'classify-log' && _classifyPromptOpen;
    document.getElementById('drawer').classList.add('hidden');
    setDrawerDevAddress('B13');
    if (wasCalendarBackfill) document.getElementById('calendar-backfill-modal').classList.remove('hidden');
    if (pickerMode === 'edit' && editDrawerPreviousViewMode !== null) {
        drawerViewMode = editDrawerPreviousViewMode;
        editDrawerPreviousViewMode = null;
    }
    pickerMode = 'record';
    _parallelCallback = null;
    if (wasClassify) {
        _classifyPromptOpen = false;
        _classifyTargetLogId = null;
        setTimeout(flushUncategorizedClassifyPrompt, 80);
    }
}

function toggleFreeBackfill() {
    const el = document.getElementById('free-backfill');
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) {
        // 初始化时间为当前小时的前后
        const now = nowSecondMs();
        const d = new Date(now);
        const h = d.getHours();
        document.getElementById('fb-h').value = String(Math.max(0, h-2)).padStart(2,'0');
        document.getElementById('fb-m').value = '00';
        document.getElementById('fb-s').value = '00';
        document.getElementById('fe-h').value = String(h).padStart(2,'0');
        document.getElementById('fe-m').value = String(d.getMinutes()).padStart(2,'0');
        document.getElementById('fe-s').value = String(d.getSeconds()).padStart(2,'0');
    }
}

function addL1() {
    showPrompt("新建一级分类", "输入大类名称", "", (n) => {
        if (n && n.trim()) {
            const name = n.trim();
            showCategoryPicker("为「" + name + "」选图标", (icon) => {
                cats.push({id:Date.now(), name:name, icon: icon || "📁", color:"#3b82f6", subs: []});
                save();
            });
        }
    });
}
function addS(id) {
    const cat = cats.find(c => c.id == id);
    if (!cat) return;
    showPrompt("新建子分类", "输入子类名称", "", (n) => {
        if (n && n.trim()) {
            const name = n.trim();
            showCategoryPicker("为「" + name + "」选图标", (icon) => {
                cat.subs.push(name);
                setSubIcon(cat, name, icon);
                if (cat.name === '场景') ensureSceneColor(name);
                save();
            });
        }
    });
}
function editL1(id) {
    const cat = cats.find(c => c.id == id);
    if (!cat) return;
    if (cat.name === '场景') {
        showConfirm('场景分类固定', '场景的名称固定，用于保存场景记录；请在“场景管理”中修改生活区显示名称或场景名称。', '知道了', () => {});
        return;
    }
    const oldName = cat.name;
    const prevIcon = cat.icon;
    showPrompt("编辑一级分类名称", "输入大类名称", cat.name, (name) => {
        if (!name || !name.trim()) return;
        cat.name = name.trim();
        shortcuts.forEach(s => { if (s.l1 === oldName) s.l1 = cat.name; });
        syncParallelShortcutRefs(oldName, cat.name, null, null, null);
        logs.forEach(l => { if (l.l1 === oldName) l.l1 = cat.name; });
        if (current?.l1 === oldName) current.l1 = cat.name;
        if (selL1 === oldName) selL1 = cat.name;
        showCategoryPicker(`为「${cat.name}」选择图标（点空白处可保留原图标）`, (icon) => {
            if (icon) cat.icon = icon;
            else cat.icon = prevIcon;
            saveAll();
        });
    });
}
function editS(id, oldName) {
    const cat = cats.find(c => c.id == id);
    if (!cat) return;
    if (isSystemSleep(cat, oldName)) {
        const choices = cats.filter((item) => item.name !== '场景')
            .map((item) => ({ value: String(item.id), label: item.name, color: item.color }));
        openReportChoiceGrid('选择睡觉所属分类', choices, String(cat.id), (targetId) => {
            const target = cats.find((item) => String(item.id) === String(targetId));
            if (!target) return;
            if (target !== cat && target.subs.includes('睡觉')) {
                showConfirm('分类中已有睡觉', '目标分类已有同名活动，请先处理重名项。', '知道了', () => {});
                return;
            }
            applySubCategoryEdit(cat, target, oldName, oldName);
        });
        return;
    }
    showPrompt("编辑子分类", "输入新的子类名称", oldName, (name) => {
        if (name === null) return;
        const next = name.trim();
        if (!next) return;
        if (next !== oldName && cat.subs.includes(next)) {
            showConfirm('名称已存在', `「${cat.name}」中已有「${next}」，请换一个名称。`, '知道了', () => {});
            return;
        }
        // 场景是容器，不能和普通时间活动互相移动。
        if (cat.name === '场景') {
            applySubCategoryEdit(cat, cat, oldName, next);
            return;
        }
        const choices = cats
            .filter((item) => item.name !== '场景')
            .map((item) => ({ value: String(item.id), label: item.name, color: item.color }));
        openReportChoiceGrid('选择一级目录', choices, String(cat.id), (targetId) => {
            const target = cats.find((item) => String(item.id) === String(targetId));
            if (target) applySubCategoryEdit(cat, target, oldName, next);
        });
    });
}

function updateReportSummaryCategoryRefs(oldL1, oldL2, newL1, newL2) {
    ['v9_report_summary_main', 'v9_report_summary_parallel', 'v9_report_summary_week_main', 'v9_report_summary_week_parallel', 'v9_report_summary_month_main', 'v9_report_summary_month_parallel'].forEach((key) => {
        const raw = safeJSON(key);
        if (!Array.isArray(raw)) return;
        let changed = false;
        raw.forEach((slot) => {
            if (slot?.id !== 'categoryAverage' || slot.l1 !== oldL1 || slot.l2 !== oldL2) return;
            slot.l1 = newL1;
            slot.l2 = newL2;
            changed = true;
        });
        if (changed) localStorage.setItem(key, JSON.stringify(raw));
    });
}

function applySubCategoryEdit(source, target, oldName, next) {
    const oldL1 = source.name;
    const newL1 = target.name;
    const targetAlreadyHasName = source !== target && target.subs.includes(next);
    const carriedIcon = source.subIcons?.[oldName] || '';
    const movingSystemSleep = isSystemSleep(source, oldName);

    if (source.name === '场景' && oldName !== next) {
        const oldColor = sceneSettings.colors[oldName];
        if (oldColor) sceneSettings.colors[next] = oldColor;
        else ensureSceneColor(next);
        delete sceneSettings.colors[oldName];
        saveSceneSettings();
    }
    source.subs = source.subs.filter((name) => name !== oldName);
    if (!targetAlreadyHasName) target.subs.push(next);
    if (movingSystemSleep && source !== target) {
        delete source.systemSleep;
        target.systemSleep = true;
    }
    if (source.subIcons) delete source.subIcons[oldName];
    if (carriedIcon && !targetAlreadyHasName) setSubIcon(target, next, carriedIcon);

    const updateRecord = (record) => {
        if (!record || record.l1 !== oldL1 || record.l2 !== oldName) return;
        record.l1 = newL1;
        record.l2 = next;
        record.color = target.color || record.color;
    };
    logs.forEach(updateRecord);
    parallelHistory.forEach(updateRecord);
    unlocatedLogs.forEach(updateRecord);
    updateRecord(current);
    updateRecord(parallelCurrent);
    shortcuts.forEach((shortcut) => {
        if (shortcut.l1 === oldL1 && shortcut.l2 === oldName) {
            shortcut.l1 = newL1;
            shortcut.l2 = next;
        }
    });
    parallelShortcuts.forEach((shortcut) => {
        if (shortcut.l1 === oldL1 && shortcut.l2 === oldName) {
            shortcut.l1 = newL1;
            shortcut.l2 = next;
        }
    });
    const recents = safeJSON('v9_recent_picks') || [];
    let recentsChanged = false;
    recents.forEach((recent) => {
        if (recent.l1 === oldL1 && recent.l2 === oldName) {
            recent.l1 = newL1;
            recent.l2 = next;
            recentsChanged = true;
        }
    });
    if (recentsChanged) localStorage.setItem('v9_recent_picks', JSON.stringify(recents));
    Object.values(inputAliases).forEach(updateRecord);
    localStorage.setItem('v9_input_aliases', JSON.stringify(inputAliases));
    updateReportSummaryCategoryRefs(oldL1, oldName, newL1, next);

    const previousIcon = target.subIcons?.[next] || carriedIcon;
    showCategoryPicker(`为「${next}」选择图标（点空白处可保留原图标）`, (icon) => {
        if (icon) setSubIcon(target, next, icon);
        else if (previousIcon) setSubIcon(target, next, previousIcon);
        localStorage.setItem('v9_parallel_history', JSON.stringify(parallelHistory));
        localStorage.setItem('v9_unlocated_logs', JSON.stringify(unlocatedLogs));
        if (parallelCurrent) localStorage.setItem('v9_parallel', JSON.stringify(parallelCurrent));
        saveAll();
    });
}
function delS(id, name) {
    const cat = cats.find(c => c.id == id);
    if (!cat) return;
    if (isSystemSleep(cat, name)) {
        showConfirm('睡觉为系统级设置', '睡觉用于睡眠统计，不能删除。', '知道了', () => {});
        return;
    }
    if (cat.name === '场景' && current?.scene && current.l2 === name) {
        showConfirm('场景正在进行中', '请先结束或切换当前场景，再删除它。', '知道了', () => {});
        return;
    }
    if (confirm(`删除子类「${name}」？`)) {
        cat.subs = cat.subs.filter(s => s !== name);
        if (cat.subIcons) delete cat.subIcons[name];
        if (cat.name === '场景') {
            delete sceneSettings.colors[name];
            saveSceneSettings();
        }
        shortcuts = shortcuts.filter(s => !(s.l1 === cat.name && s.l2 === name));
        parallelShortcuts = parallelShortcuts.filter(s => !(s.l1 === cat.name && s.l2 === name));
        saveAll();
    }
}
function delL1(id) {
    const cat = cats.find(c => c.id === id);
    if (cat?.systemSleep) {
        showConfirm('包含系统级睡觉', '“睡觉”是固定的系统设置，不能删除其所属分类。', '知道了', () => {});
        return;
    }
    if (cat?.name === '场景') {
        showConfirm('场景分类不可删除', '场景用于保存出差、旅行等区域记录，不能删除。', '知道了', () => {});
        return;
    }
    if(confirm("删除？")) {
        cats = cats.filter(c=>c.id!==id);
        if (cat) {
            shortcuts = shortcuts.filter(s => s.l1 !== cat.name);
            parallelShortcuts = parallelShortcuts.filter(s => s.l1 !== cat.name);
        }
        if (!cats.some(c => c.name === selL1)) selL1 = cats[0]?.name || "";
        saveAll();
    }
}
function save() { localStorage.setItem('v9_cats', JSON.stringify(cats)); renderAll(); }
function saveAll() {
    localStorage.setItem('v9_cats', JSON.stringify(cats));
    localStorage.setItem('v9_shorts', JSON.stringify(shortcuts));
    localStorage.setItem('v9_parallel_shorts', JSON.stringify(parallelShortcuts));
    localStorage.setItem('v9_logs', JSON.stringify(logs));
    if (current) localStorage.setItem('v9_current', JSON.stringify(current));
    renderAll();
}
