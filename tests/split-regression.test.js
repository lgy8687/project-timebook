const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const drawerPickSource = source.slice(
    source.indexOf('function drawerPick('),
    source.indexOf('\nfunction renderShortcuts()', source.indexOf('function drawerPick('))
);
const executeSplitSource = source.slice(
    source.indexOf('function executeSplit('),
    source.indexOf('\nfunction mergeAdjacentSameActivity()', source.indexOf('function executeSplit('))
);
const mergeSource = source.slice(
    source.indexOf('function mergeAdjacentSameActivity()'),
    source.indexOf('\n// 吸附到最近的空闲区段边界', source.indexOf('function mergeAdjacentSameActivity()'))
);
const homeHistorySource = source.slice(
    source.indexOf('function renderHomeHistory()'),
    source.indexOf('\nfunction renderCalendarPage()', source.indexOf('function renderHomeHistory()'))
);
const sceneTreeSource = source.slice(
    source.indexOf('function renderSceneActivityTree('),
    source.indexOf('\nfunction renderMainLogTree(', source.indexOf('function renderSceneActivityTree('))
);
const confirmEditSource = source.slice(
    source.indexOf('function confirmEdit()'),
    source.indexOf('\nfunction confirmActiveParallelEdit()', source.indexOf('function confirmEdit()'))
);

function makeEditor(parent, start, end) {
    const fields = { start, end };
    const prompts = [];
    let nextId = 0;
    const context = {
        _parallelPending: false,
        _parallelCallback: null,
        _backfillRange: { start: parent.startTime, end: parent.endTime },
        pickerMode: 'split',
        logs: [parent],
        parallelHistory: [],
        recordRecentPick() {},
        parseTimeFromInput(prefix) { return fields[prefix === 'ps' ? 'start' : 'end']; },
        closeDrawer() {
            context.pickerMode = 'record';
            context._backfillRange = null;
            fields.start = parent.startTime;
            fields.end = parent.endTime;
        },
        showConfirm(title, message) { prompts.push({ title, message }); },
        getCat() { return { color: '#123456' }; },
        genId() { return `test-${++nextId}`; },
        sameId(a, b) { return a != null && b != null && String(a) === String(b); },
        logEndMs(log) {
            if (!log) return 0;
            if (log.endTime != null) return log.endTime;
            if (log.duration != null) return log.startTime + Math.round(log.duration * 60000);
            return log.startTime;
        },
        formatBeijingDate() { return '1970-01-01'; },
        parallelCurrent: null,
        renderAll() {},
        localStorage: { setItem() {} },
        document: { getElementById() { return { value: '' }; } },
        Number,
    };
    vm.createContext(context);
    vm.runInContext(drawerPickSource + '\n' + executeSplitSource + '\n' + mergeSource, context);
    context._parallelCallback = (l1, l2, range) => context.executeSplit(parent, l1, l2, range);
    return { context, prompts };
}

test('split saves the selected interval even when closing resets the fields', () => {
    const parent = { id: 'main', startTime: 0, endTime: 7200000, l1: 'Life', l2: 'Rest' };
    const { context } = makeEditor(parent, 1800000, 3600000);

    context.drawerPick('Work', 'Meeting');

    assert.equal(context.logs.length, 3);
    assert.deepEqual(Array.from(context.logs, (log) => [log.startTime, log.endTime]), [
        [0, 1800000], [1800000, 3600000], [3600000, 7200000]
    ]);
    assert.equal(context.logs[1].l2, 'Meeting');
});

test('split refuses an unchanged full-range selection', () => {
    const parent = { id: 'main', startTime: 0, endTime: 7200000, l1: 'Life', l2: 'Rest' };
    const { context, prompts } = makeEditor(parent, 0, 7200000);

    context.drawerPick('Work', 'Meeting');

    assert.equal(context.logs.length, 1);
    assert.equal(context.logs[0], parent);
    assert.equal(context.pickerMode, 'split');
    assert.equal(prompts.length, 1);
});

test('same-category split stays visible as separate main records in history', () => {
    const parent = { id: 'main', startTime: 0, endTime: 7200000, l1: 'Life', l2: 'Rest' };
    const { context } = makeEditor(parent, 1800000, 3600000);
    context.drawerPick('Life', 'Rest');
    context.mergeAdjacentSameActivity();
    const visible = [];
    const list = { appendChild() {} };
    context.recordMode = 'continuous';
    context.showUnassignedMain = false;
    context.unlocatedLogs = [];
    context.document = {
        getElementById() { return list; },
        createElement() { return { appendChild() {} }; }
    };
    context.renderLogs = () => {};
    context.getTodayDateStr = () => '1970-01-02';
    context.collectLogCalendarDays = () => new Set(['1970-01-01']);
    context.logTouchesDate = (log, dateStr) => {
        const dayStart = Date.parse(dateStr + 'T00:00:00+08:00');
        return log.startTime < dayStart + 86400000 && log.endTime > dayStart;
    };
    context.formatDateHeaderLabel = () => '1970-01-01';
    context.getParallelDisplayRecords = () => [];
    context.renderMainLogTree = (_list, log) => { visible.push(log); };
    context.appendUnattachedParallelLogs = () => {};
    context.nowSecondMs = () => Date.parse('1970-01-02T12:00:00+08:00');
    context.beijingDateStrToDayStart = (date) => Date.parse(date + 'T00:00:00+08:00');
    context.DAY_MS = 86400000;
    context.getDayUnassignedSegments = () => [];
    context.assignUnlocatedToGaps = () => ({ byGap: [], unplaced: [] });
    vm.runInContext(homeHistorySource, context);

    context.renderHomeHistory();

    assert.equal(visible.length, 3);
    assert.equal(new Set(visible.map((log) => log.id)).size, 3);
});

test('split keeps a scene activity inside its scene', () => {
    const parent = {
        id: 'scene-activity', startTime: 0, endTime: 7200000,
        l1: 'Life', l2: 'Rest', sceneActivity: true,
        sceneParentId: 'scene', sceneName: 'Trip'
    };
    const { context } = makeEditor(parent, 1800000, 3600000);

    context.drawerPick('Work', 'Meeting');

    assert.equal(context.logs[1].sceneActivity, true);
    assert.equal(context.logs[1].sceneParentId, 'scene');
    assert.equal(context.logs[1].sceneName, 'Trip');
    const visible = [];
    context.document = { createElement() { return { appendChild() {} }; } };
    context.getSceneContainerId = (log) => String(log.sceneRootId || log.id);
    context.applySceneNestTheme = () => {};
    context.createLogRow = (_wrap, log) => { visible.push(log); };
    vm.runInContext(sceneTreeSource, context);

    context.renderSceneActivityTree({ appendChild() {} }, { id: 'scene' }, context.logs, []);

    assert.equal(visible.length, 3);
});

test('parallel backfill also keeps its selected interval after closing', () => {
    const parent = { id: 'main', startTime: 0, endTime: 7200000, l1: 'Life', l2: 'Rest' };
    const { context } = makeEditor(parent, 1800000, 3600000);
    let selectedRange;
    context.pickerMode = 'parallel-backfill';
    context.snapTimeToRange = () => {};
    context.isTimeInParentRange = () => true;
    context._parallelCallback = (_l1, _l2, range) => { selectedRange = range; };

    context.drawerPick('Work', 'Meeting');

    assert.deepEqual([selectedRange.start, selectedRange.end], [1800000, 3600000]);
});

test('a stale picker tap cannot switch from split into recording another activity', () => {
    const parent = { id: 'main', startTime: 0, endTime: 7200000, l1: 'Life', l2: 'Rest' };
    const { context } = makeEditor(parent, 1800000, 3600000);
    let recorded = false;
    context.executeRecord = () => { recorded = true; };

    context.drawerPick('Work', 'Meeting', 'split');
    context.drawerPick('Life', 'Sleep', 'split');

    assert.equal(recorded, false);
    assert.equal(context.logs.length, 3);
    assert.deepEqual(Array.from(context.logs, (log) => log.l2), ['Rest', 'Meeting', 'Rest']);
});

test('split keeps each original activity name and reparents its parallel by interval', () => {
    const parent = { id: 'main', startTime: 0, endTime: 7200000, l1: 'Life', l2: 'Rest' };
    const { context } = makeEditor(parent, 1800000, 3600000);
    context.logs.push({ id: 'parallel', startTime: 3600000, endTime: 4200000,
        l1: 'Work', l2: 'Call', parallel: true, parentId: 'main' });

    context.drawerPick('Work', 'Meeting');

    const mains = context.logs.filter((log) => !log.parallel);
    const child = context.logs.find((log) => log.parallel);
    assert.deepEqual(Array.from(mains, (log) => log.l2), ['Rest', 'Meeting', 'Rest']);
    assert.equal(child.l2, 'Call');
    assert.equal(child.parentId, mains[2].id);
    assert.equal(new Set(context.logs.map((log) => log.id)).size, context.logs.length);
});

test('an edit confirmation keeps its selected category when another picker changes later', () => {
    const log = { id: 'one', startTime: 0, endTime: 3600000, l1: 'Life', l2: 'Rest', color: '#aaa' };
    let finish;
    const context = {
        editTarget: { source: 'logs', id: 'one' }, editOldL1: 'Work', editOldL2: 'Meeting',
        logs: [log], parallelHistory: [], current: null,
        parseTimeFromInput(prefix) { return prefix === 'es' ? 0 : 3600000; },
        applyEditedRange(_log, _start, _end, done) { finish = done; },
        getCat() { return { color: '#123456' }; },
        rememberInputAlias() {}, mergeAdjacentSameActivity() {}, renderAll() {},
        localStorage: { setItem() {} },
        document: { getElementById() { return { value: '', classList: { add() {} } }; } }
    };
    vm.createContext(context);
    vm.runInContext(confirmEditSource, context);

    context.confirmEdit();
    context.editOldL1 = 'Life';
    context.editOldL2 = 'Sleep';
    finish();

    assert.equal(log.l1, 'Work');
    assert.equal(log.l2, 'Meeting');
    assert.equal(log.color, '#123456');
});

test('split matches a string parentId to a numeric main id and keeps a one-minute duration', () => {
    const parent = { id: 1747651200000.123, startTime: 0, endTime: 7200000, l1: 'Life', l2: 'Rest' };
    const parallel = {
        id: 'parallel', startTime: 1800000, duration: 1,
        l1: 'Work', l2: 'Call', parallel: true, parentId: '1747651200000.123'
    };
    const blocked = makeEditor(parent, 1800000, 2400000);
    blocked.context.logs.push(parallel);
    blocked.context.drawerPick('Work', 'Meeting');
    assert.equal(blocked.prompts.length, 1);
    assert.equal(blocked.context.logs.includes(parent), true);

    const allowed = makeEditor({ ...parent }, 3600000, 4200000);
    allowed.context.logs.push({ ...parallel });
    allowed.context.drawerPick('Work', 'Meeting');
    assert.equal(allowed.prompts.length, 0);
    const child = allowed.context.logs.find((log) => log.parallel);
    const host = allowed.context.logs.find((log) => !log.parallel && log.startTime === 0);
    assert.equal(String(child.parentId), String(host.id));
});

test('open split reads the record end and does not invent 60 minutes', () => {
    const openSplit = source.slice(source.indexOf('function openSplitDrawer('), source.indexOf('\nfunction executeLiveSplit('));
    assert.match(openSplit, /logEndMs\(parentLog\)/);
    assert.doesNotMatch(openSplit, /\|\| 60/);
    assert.match(openSplit, /缺少结束时间/);
});

test('a 20 second parallel is not stored as one minute', () => {
    const toggle = source.slice(source.indexOf('function toggleParallel('), source.indexOf('\nfunction updateParallelStatus('));
    const now = 1000000000000;
    const context = {
        current: { id: 'main', l2: '' },
        parallelCurrent: { id: 'p', startTime: now - 20000, l1: '工作', l2: '办公', parentId: 'main', note: '' },
        parallelHistory: [],
        nowSecondMs: () => now,
        localStorage: { setItem() {}, removeItem() {} },
        renderParallelShortcuts() {},
        renderAll() {},
        showConfirm() { throw new Error('unexpected confirm'); },
        genId: () => 'new'
    };
    vm.createContext(context);
    vm.runInContext(toggle, context);
    context.toggleParallel('工作', '办公', '📝');
    assert.equal(context.parallelHistory[0].duration, 0);
    assert.equal(context.parallelHistory[0].endTime - context.parallelHistory[0].startTime, 20000);
});

test('flushing a parallel slice keeps distinct ids and both residual ranges', () => {
    const flushSource = source.slice(
        source.indexOf('function flushParallelHistoryForSlice('),
        source.indexOf('\n// 已结束并行不应长期停在临时队列里')
    );
    const repairSource = source.slice(
        source.indexOf('function repairOrphanedParallelParents('),
        source.indexOf('\nfunction getSceneContainerId(')
    );
    const hour = 3600000;
    let nextId = 0;
    const context = {
        logs: [
            { id: 'main', startTime: 8 * hour, endTime: 12 * hour, parallel: false, l1: '工作', l2: '办公' },
            { id: 'p1', startTime: 0, endTime: hour, parallel: true, parentId: 'other', l1: '其他', l2: '已占用' }
        ],
        parallelHistory: [{
            id: 'p1', startTime: 8 * hour, endTime: 12 * hour,
            l1: '工作', l2: '办公', parallel: true, parentId: 'main'
        }],
        genId: () => `new-${++nextId}`,
        sameId(a, b) { return a != null && b != null && String(a) === String(b); },
        logEndMs(log) {
            if (!log) return 0;
            if (log.endTime != null) return log.endTime;
            if (log.duration != null) return log.startTime + Math.round(log.duration * 60000);
            return log.startTime;
        },
        localStorage: { setItem() {} }
    };
    vm.createContext(context);
    vm.runInContext(`${flushSource}\n${repairSource}`, context);
    context.flushParallelHistoryForSlice('main', 9 * hour, 11 * hour);
    const middle = context.logs.find((item) => item.parallel && item.startTime === 9 * hour);
    assert.ok(middle);
    assert.notEqual(String(middle.id), 'p1');
    assert.equal(context.parallelHistory.length, 2);
    for (const residual of context.parallelHistory) assert.notEqual(String(residual.id), 'p1');
    assert.equal(new Set([middle.id, ...context.parallelHistory.map((item) => item.id)]).size, 3);
    assert.deepEqual(
        Array.from(context.parallelHistory, (item) => [item.startTime, item.endTime]).sort((a, b) => a[0] - b[0]),
        [[8 * hour, 9 * hour], [11 * hour, 12 * hour]]
    );
    context.logs.push(...Array.from(context.parallelHistory, (item) => ({ ...item, parallel: true, parentId: 'main' })));
    context.repairOrphanedParallelParents();
    const ranges = Array.from(context.logs)
        .filter((item) => item.parallel && item.l2 === '办公')
        .map((item) => [item.startTime, context.logEndMs(item)])
        .sort((a, b) => a[0] - b[0]);
    assert.deepEqual(ranges, [[8 * hour, 9 * hour], [9 * hour, 11 * hour], [11 * hour, 12 * hour]]);
});
