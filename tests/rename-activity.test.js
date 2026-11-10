const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const editL1 = app.slice(app.indexOf('function editL1('), app.indexOf('\nfunction editS('));
const helpers = app.slice(
    app.indexOf('function updateReportSummaryCategoryRefs('),
    app.indexOf('\nfunction applySubCategoryEdit(')
);

test('renaming an L1 updates parallel, unlocated, recents and report refs', () => {
    const saved = {};
    const kept = { l1: '生活', l2: '睡觉' };
    const context = {
        cats: [{ id: 1, name: '工作', icon: '💼', subs: ['办公'] }],
        shortcuts: [{ l1: '工作', l2: '办公' }, kept],
        parallelShortcuts: [{ l1: '工作', l2: '开会' }],
        logs: [{ l1: '工作', l2: '办公' }, { l1: '生活', l2: '睡觉' }],
        parallelHistory: [{ l1: '工作', l2: '开会' }],
        unlocatedLogs: [{ l1: '工作', l2: '办公', date: '2026-10-14' }],
        current: { l1: '工作', l2: '办公' },
        parallelCurrent: { l1: '工作', l2: '开会' },
        inputAliases: { office: { l1: '工作', l2: '办公' } },
        selL1: '工作',
        showPrompt(_title, _message, _initial, callback) { callback('上班'); },
        showCategoryPicker(_title, callback) { callback('🏢'); },
        safeJSON(key) {
            if (key === 'v9_recent_picks') return [{ l1: '工作', l2: '办公' }, { l1: '生活', l2: '睡觉' }];
            if (String(key).startsWith('v9_report_summary')) return [{ id: 'categoryAverage', l1: '工作', l2: '开会' }];
            return [];
        },
        localStorage: { setItem(key, value) { saved[key] = value; } },
        saveAll() { saved.saveAll = true; }
    };
    vm.createContext(context);
    vm.runInContext(`${editL1}\n${helpers}`, context);
    context.editL1(1);

    for (const record of [
        context.logs[0], context.parallelHistory[0], context.unlocatedLogs[0],
        context.current, context.parallelCurrent, context.shortcuts[0], context.inputAliases.office
    ]) assert.equal(record.l1, '上班');
    assert.equal(context.logs[0].l2, '办公');
    assert.equal(context.parallelHistory[0].l2, '开会');
    assert.equal(context.logs[1].l1, '生活');
    assert.equal(context.shortcuts[1], kept);
    assert.equal(JSON.parse(saved.v9_parallel_history)[0].l1, '上班');
    assert.equal(JSON.parse(saved.v9_parallel).l1, '上班');
    assert.equal(JSON.parse(saved.v9_unlocated_logs)[0].l1, '上班');
    assert.equal(JSON.parse(saved.v9_recent_picks)[0].l1, '上班');
    assert.equal(JSON.parse(saved.v9_recent_picks)[1].l1, '生活');
    assert.equal(JSON.parse(saved.v9_report_summary_main)[0].l1, '上班');
    assert.equal(JSON.parse(saved.v9_report_summary_main)[0].l2, '开会');
    assert.equal(saved.saveAll, true);
    assert.equal(context.cats[0].icon, '🏢');
});
