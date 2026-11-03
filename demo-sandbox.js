(function () {
    if (new URLSearchParams(location.search).get('demo') !== 'october2026') return;
    document.documentElement.dataset.demo = 'october2026';
    window.__timebookDemo = true;
    const values = new Map();
    const storage = {
        get length() { return values.size; },
        key(index) { return Array.from(values.keys())[index] ?? null; },
        getItem(key) { key = String(key); return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(String(key), String(value)); },
        removeItem(key) { values.delete(String(key)); },
        clear() { values.clear(); }
    };
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: false });
    const base = Date.parse('2026-10-01T00:00:00+08:00');
    const hour = 3600000;
    const segments = [
        [0, 7, '生活', '睡觉'], [7, 8, '生活', '起床'],
        [8, 12, '工作', '办公'], [12, 13, '生活', '餐饮'],
        [13, 17, '工作', '办公'], [17, 18, '出行', '开车'],
        [18, 19, '生活', '餐饮'], [19, 21, '学习', '阅读'],
        [21, 24, '休闲', '休息']
    ];
    const types = [
        { id: 'demo-water', name: '喝水', icon: '💧', color: '#278674', group: '健康', quick: true },
        { id: 'demo-exercise', name: '运动', icon: '🏃', color: '#e89925', group: '健康', quick: true },
        { id: 'demo-fuel', name: '加油', icon: '⛽', color: '#526a91', group: '出行', quick: false },
        { id: 'demo-meal', name: '吃饭', icon: '🍽️', color: '#d76678', group: '生活', quick: true }
    ];
    const logs = [], events = [];
    for (let day = 0; day < 31; day++) {
        const start = base + day * 24 * hour;
        segments.forEach(([from, to, l1, l2], index) => logs.push({
            id: `demo-main-${day}-${index}`, l1, l2, startTime: start + from * hour,
            endTime: start + to * hour, parallel: false, journal: true
        }));
        const addEvent = (type, at, count) => events.push({
            id: `demo-event-${day}-${type.id}`, typeId: type.id, typeName: type.name,
            icon: type.icon, color: type.color, occurredAt: start + at * hour,
            parentId: null, count, dateOnly: false, createdAt: start + at * hour
        });
        addEvent(types[0], 9, 3 + day % 3);
        addEvent(types[3], 12, 2);
        if (day % 3 === 0) addEvent(types[1], 19, 1);
        if (day % 7 === 0) addEvent(types[2], 17, 1);
    }
    storage.setItem('v9_record_mode', 'journal');
    storage.setItem('v9_logs', JSON.stringify(logs));
    storage.setItem('v9_event_types', JSON.stringify(types));
    storage.setItem('v9_event_records', JSON.stringify(events));
    storage.setItem('timebook_dev_inspector_enabled', 'false');
    window.addEventListener('load', () => {
        setTimeout(() => {
            viewDate = '2026-10-15';
            calendarViewYear = 2026;
            calendarViewMonth = 9;
            if (typeof setPeriod === 'function') {
                setPeriod('month');
                const picker = document.getElementById('report-date-picker');
                if (picker) {
                    picker.value = '2026-10-15';
                    picker.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            switchTab('calendar');
            renderCalendarPage();
        }, 0);
    });
})();
