import { writeFileSync } from 'node:fs';

// Beijing-time samples, explicitly fictional and capped at the generation instant.
const hour = 3600000, dayMs = 24 * hour;
const begin = Date.parse('2026-10-01T00:00:00+08:00');
const now = Math.floor(Date.now() / 60000) * 60000;
if (now < begin) throw new Error('Sample start is in the future');
const cats = [
    { id: 1, name: '工作', icon: '💼', color: '#3b82f6', subs: ['办公', '开会', '沟通', '见客户', '上班'] },
    { id: 2, name: '学习', icon: '📘', color: '#6366f1', subs: ['学习', '阅读', '上课', '备考'] },
    { id: 3, name: '生活', icon: '🏠', color: '#f59e0b', subs: ['睡觉', '起床', '洗漱', '家务', '做饭', '餐饮'], systemSleep: true },
    { id: 4, name: '出行', icon: '🧭', color: '#ef4444', subs: ['开车', '网约车', '公交', '地铁', '高铁', '飞机', '步行', '骑行'] },
    { id: 5, name: '休闲', icon: '🎧', color: '#a855f7', subs: ['游戏', '刷手机', '娱乐', '社交', '购物', '休息'] },
    { id: 6, name: '锻炼', icon: '🏅', color: '#14b8a6', subs: ['运动', '健身', '跑步', '散步', '瑜伽', '冥想'] }
];
const types = [
    { id: 'fiction-water', name: '喝水', icon: '💧', color: '#278674', group: '健康' },
    { id: 'fiction-meals', name: '吃饭', icon: '🍽️', color: '#d76678', group: '生活' },
    { id: 'fiction-exercise', name: '运动', icon: '🏃', color: '#e89925', group: '健康' },
    { id: 'fiction-fuel', name: '加油', icon: '⛽', color: '#526a91', group: '出行' }
];
const weekday = [
    [0, 7, '生活', '睡觉'], [7, 8, '生活', '起床'], [8, 11.5, '出行', '网约车'],
    [11.5, 12.5, '生活', '餐饮'], [12.5, 17, '出行', '网约车'], [17, 18, '生活', '家务'],
    [18, 19, '生活', '餐饮'], [19, 20, '锻炼', '散步'], [20, 21.5, '学习', '阅读'], [21.5, 24, '休闲', '休息']
];
const weekend = [
    [0, 8, '生活', '睡觉'], [8, 9, '生活', '起床'], [9, 11, '锻炼', '运动'],
    [11, 12, '生活', '家务'], [12, 13, '生活', '餐饮'], [13, 16, '休闲', '社交'],
    [16, 18, '出行', '开车'], [18, 19, '生活', '餐饮'], [19, 21, '学习', '阅读'], [21, 24, '休闲', '休息']
];
const logs = [], events = [];
for (let start = begin, n = 0; start < now; start += dayMs, n++) {
    const weekdayNumber = new Date(start + 8 * hour).getUTCDay();
    const plan = weekdayNumber === 0 || weekdayNumber === 6 ? weekend : weekday;
    const limit = Math.min(start + dayMs, now);
    plan.forEach(([from, to, l1, l2], i) => {
        const startTime = start + from * hour, endTime = Math.min(start + to * hour, limit);
        if (endTime <= startTime) return;
        if (l2 === '阅读' && n % 3 === 1) { l1 = '休闲'; l2 = '娱乐'; }
        if (l2 === '散步' && n % 4 === 2) l2 = '瑜伽';
        logs.push({ id: `fiction-main-${n}-${i}`, l1, l2, startTime, endTime, duration: (endTime - startTime) / 60000, parallel: false, journal: true });
    });
    const add = (type, at, count) => {
        const occurredAt = start + at * hour;
        if (occurredAt > limit) return;
        events.push({ id: `fiction-event-${n}-${type.id}`, typeId: type.id, typeName: type.name, icon: type.icon,
            color: type.color, occurredAt, count, dateOnly: false, createdAt: occurredAt });
    };
    add(types[0], 9, 2 + n % 3);
    add(types[1], 12, 2 + (n % 4 === 0 ? 1 : 0));
    if (n % 3 !== 1) add(types[2], 19, 1);
    if (n % 7 === 2) add(types[3], 17, 1);
}
const data = {
    v9_record_mode: 'journal', v9_cats: JSON.stringify(cats), v9_logs: JSON.stringify(logs),
    v9_event_types: JSON.stringify(types), v9_event_records: JSON.stringify(events)
};
const backup = { format: 'timebook-backup', version: 1, exportedAt: new Date(now).toISOString(), data };
const target = process.argv[2];
if (!target) throw new Error('Provide an output path');
writeFileSync(target, JSON.stringify(backup, null, 2) + '\n');
console.log(JSON.stringify({ target, logs: logs.length, events: events.length, through: new Date(now).toISOString() }));
