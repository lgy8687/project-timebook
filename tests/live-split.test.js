const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const source = app.slice(app.indexOf('function executeLiveSplit('), app.indexOf('\nfunction executeSplit(', app.indexOf('function executeLiveSplit(')));
function setup() {
    let id = 0;
    const context = { current: { id: 'active', startTime: 0, l1: '出行', l2: '网约车', journal: true },
        logs: [], parallelHistory: [], parallelCurrent: null, eventRecords: [
            { occurredAt: 1800000 }, { occurredAt: 5400000 }, { occurredAt: 9000000 }
        ], prompts: [], genId: () => `new-${++id}`, getCat: () => ({ color: '#123456' }),
        document: { getElementById: () => ({ value: '' }) }, localStorage: { setItem() {} },
        saveEventRecords() {}, closeDrawer() {}, renderAll() {},
        showConfirm(title) { context.prompts.push(title); } };
    vm.createContext(context); vm.runInContext(source, context);
    return context;
}
test('cutting a past interval keeps the remaining active activity running', () => {
    const c = setup(), snapshot = { ...c.current };
    c.executeLiveSplit(snapshot, 10800000, '生活', '吃饭', { start: 3600000, end: 7200000 });
    assert.equal(c.current.startTime, 7200000);
    assert.equal(c.current.l2, '网约车');
    assert.deepEqual(Array.from(c.logs, x => [x.startTime, x.endTime, x.l2]), [[3600000, 7200000, '吃饭'], [0, 3600000, '网约车']]);
    assert.deepEqual(Array.from(c.eventRecords, e => e.occurredAt), [1800000, 5400000, 9000000]);
});
test('rejects future, stale and parallel-associated cuts without modifying records', () => {
    for (const kind of ['future', 'stale', 'parallel', 'history']) {
        const c = setup(), snapshot = { ...c.current };
        if (kind === 'stale') c.current = { ...c.current, startTime: 60000 };
        if (kind === 'parallel') c.parallelCurrent = { parentId: 'active' };
        if (kind === 'history') c.parallelHistory = [{ parentId: 'active' }];
        c.executeLiveSplit(snapshot, 10800000, '生活', '吃饭', { start: 3600000, end: kind === 'future' ? 12000000 : 7200000 });
        assert.equal(c.logs.length, 0, kind);
        assert.equal(c.prompts.length, 1, kind);
    }
});
