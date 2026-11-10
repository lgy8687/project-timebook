const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const inspector = fs.readFileSync(path.join(__dirname, '..', 'dev-inspector.js'), 'utf8');
const deleteSource = app.slice(app.indexOf('function getUnassignedMergeNeighbors('), app.indexOf('\nfunction openCalendarBackfill(', app.indexOf('function getUnassignedMergeNeighbors(')));
const clearSource = app.slice(app.indexOf('function clearLogEntryToUnassigned('), app.indexOf('\nfunction requestDeleteLogEntry(', app.indexOf('function clearLogEntryToUnassigned(')));
const mergeDirectionSource = app.slice(app.indexOf('let mergeDirectionCallback = null;'), app.indexOf('\nfunction clearLogEntryToUnassigned(', app.indexOf('let mergeDirectionCallback = null;')));
const requestDeleteSource = app.slice(app.indexOf('function requestDeleteLogEntry('), app.indexOf('\nfunction executeRecord(', app.indexOf('function requestDeleteLogEntry(')));
const renderUnassignedSource = app.slice(app.indexOf('function renderUnassignedMain('), app.indexOf('\nfunction renderDayMainRows(', app.indexOf('function renderUnassignedMain(')));
const closeConfirmSource = app.slice(app.indexOf('function closeConfirm('), app.indexOf('\nlet keyboardActiveModal', app.indexOf('function closeConfirm(')));
const editSource = app.slice(app.indexOf('function confirmUnassignedEdit('), app.indexOf('\nfunction confirmActiveMainEdit(', app.indexOf('function confirmUnassignedEdit(')));
const dayStart = Date.parse('2026-10-12T00:00:00+08:00');
const hour = 3600000;
const gap = { start: dayStart + 10 * hour, end: dayStart + 10 * hour + 10 * 60000 };

function storage() {
    const saved = new Map();
    return {
        setItem(key, value) { saved.set(key, value); },
        getItem(key) { return saved.get(key); },
    };
}

function deleteContext(direction, assigned = []) {
    const earlier = { id: 'earlier', startTime: dayStart + 9 * hour, endTime: gap.start, l2: '较早活动' };
    const later = { id: 'later', startTime: gap.end, endTime: dayStart + 11 * hour, l2: '较晚活动' };
    const alerts = [];
    const context = {
        logs: [earlier, later], current: null, unlocatedLogs: assigned,
        localStorage: storage(),
        getDayUnassignedSegments: () => [gap],
        assignUnlocatedToGaps: () => ({ byGap: [assigned], unplaced: [] }),
        getActiveUnassignedSegment: () => null,
        formatBeijingDate: () => '2026-10-12',
        logEndMs: (item) => item.endTime,
        showConfirm(title, _message, _button, callback) { alerts.push(title); if (title === '确认删除') callback(true); },
        showMergeDirection(_target, callback) { callback(direction); },
        renderAll() {},
    };
    vm.createContext(context);
    vm.runInContext(deleteSource, context);
    return { context, earlier, later, alerts };
}

test('deleting a ten-minute gap merges it into only the chosen adjacent main', () => {
    const up = deleteContext('up');
    up.context.requestDeleteUnassignedGap('2026-10-12', gap.start);
    assert.equal(up.later.startTime, gap.start);
    assert.equal(up.earlier.endTime, gap.start);
    assert.equal(up.later.endTime - up.later.startTime, 60 * 60000);

    const down = deleteContext('down');
    down.context.requestDeleteUnassignedGap('2026-10-12', gap.start);
    assert.equal(down.earlier.endTime, gap.end);
    assert.equal(down.later.startTime, gap.end);
    assert.equal(down.earlier.endTime - down.earlier.startTime, 70 * 60000);
});

test('a gap with an untimed activity cannot be deleted', () => {
    const activity = { id: 'activity', date: '2026-10-12', durationMs: 60000, gapStart: gap.start };
    const { context, earlier, later, alerts } = deleteContext('down', [activity]);
    context.requestDeleteUnassignedGap('2026-10-12', gap.start);
    assert.deepEqual(alerts, ['不能删除未分配']);
    assert.equal(earlier.endTime, gap.start);
    assert.equal(later.startTime, gap.end);
});

test('editing a gap creates a classified main only within the selected interval', () => {
    const store = storage();
    const alerts = [];
    const context = {
        editTarget: { source: 'unassigned', dateStr: '2026-10-12', gapStart: gap.start, live: false },
        editOldL1: '生活', editOldL2: '洗漱', recordMode: 'journal',
        logs: [], current: null, unlocatedLogs: [], localStorage: store,
        nowSecondMs: () => dayStart + 2 * 86400000,
        getCat: () => ({ color: '#f90' }),
        getDayUnassignedSegments: () => [gap],
        getActiveUnassignedSegment: () => null,
        parseTimeOnBeijingDate: (prefix) => prefix === 'es' ? gap.start + 2 * 60000 : gap.end - 2 * 60000,
        mainRecordOverlaps: () => [], intervalExceedsDayBudget: () => false,
        assignUnlocatedToGaps: () => ({ byGap: [[]], unplaced: [] }),
        document: { getElementById: () => ({ value: '' }) },
        showConfirm: (title) => alerts.push(title),
        genId: () => 'classified', closeEdit() {}, renderAll() {},
    };
    vm.createContext(context);
    vm.runInContext(editSource, context);
    context.confirmUnassignedEdit();
    assert.deepEqual(alerts, []);
    assert.equal(context.logs[0].startTime, gap.start + 2 * 60000);
    assert.equal(context.logs[0].endTime, gap.end - 2 * 60000);
    assert.equal(context.logs[0].l2, '洗漱');
    assert.equal(JSON.parse(store.getItem('v9_logs'))[0].id, 'classified');
});

test('clearing a classified main preserves its time as an unassigned gap and detaches child records', () => {
    const target = { id: 'main', startTime: gap.start, endTime: gap.end, l1: '生活', l2: '散步' };
    const child = { id: 'parallel', parentId: 'main', parallel: true };
    const event = { id: 'event', occurredAt: gap.start };
    const saved = new Map();
    let rendered = false;
    const context = {
        logs: [target, child], parallelHistory: [], parallelCurrent: null, eventRecords: [event],
        localStorage: { setItem(key, value) { saved.set(key, value); } },
        saveEventRecords() { saved.set('v9_event_records', JSON.stringify(context.eventRecords)); },
        renderAll() { rendered = true; },
    };
    vm.createContext(context);
    vm.runInContext(clearSource, context);
    context.clearLogEntryToUnassigned(target);
    assert.deepEqual(context.logs.map(item => item.id), ['parallel']);
    assert.equal(context.logs[0].parentId, null);
    assert.equal(context.eventRecords[0].occurredAt, gap.start);
    assert.deepEqual(JSON.parse(saved.get('v9_logs')).map(item => item.id), ['parallel']);
    assert.equal(rendered, true);
});

test('classified-main and gap merge dialogs only offer a merge direction', () => {
    const elements = new Map();
    const element = (id) => {
        if (!elements.has(id)) {
            const classes = new Set(['hidden']);
            elements.set(id, {
                dataset: {}, disabled: false, innerText: '',
                classList: {
                    add(name) { classes.add(name); },
                    remove(name) { classes.delete(name); },
                    toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
                    contains(name) { return classes.has(name); },
                },
            });
        }
        return elements.get(id);
    };
    const context = { document: { getElementById: element }, displayName: item => item.l2 };
    vm.createContext(context);
    vm.runInContext(mergeDirectionSource, context);
    const neighbors = { up: null, down: { l2: '睡觉' } };
    let chosen = null;
    context.showMergeDirection({ l2: '跑网约车' }, direction => { chosen = direction; }, neighbors, { addressBlock: 'B81' });
    assert.equal(element('merge-direction-title').innerText, '删除后怎么合并？');
    assert.equal(element('merge-up-btn').disabled, true);
    context.chooseMergeDirection('down');
    assert.equal(chosen, 'down');
    context.showMergeDirection({ l2: '未分配' }, () => {}, neighbors, { addressBlock: 'B82' });
    assert.equal(element('merge-direction-title').innerText, '删除后怎么合并？');
});

test('classified-main deletion uses B81 for merging, never clearing', () => {
    const target = { id: 'main', l2: '跑网约车' };
    const neighbors = { up: null, down: { id: 'sleep', l2: '睡觉' } };
    let merged = false;
    const context = {
        current: null, logs: [target], localStorage: storage(),
        getDeleteMergeNeighbors: () => neighbors,
        showMergeDirection(_target, callback, _neighbors, options) {
            assert.equal(options.addressBlock, 'B81');
            assert.equal(options.allowClear, undefined);
            callback('down');
        },
        mergeDeletedTime() { merged = true; },
        rehomeParallelChildren() {}, mergeAdjacentSameActivity() {}, renderAll() {},
    };
    vm.createContext(context);
    vm.runInContext(requestDeleteSource, context);
    context.requestDeleteLogEntry(target);
    assert.equal(merged, true);
    assert.equal(context.logs.length, 0);
});

test('delete confirmation offers clear; backdrop dismissal remains non-destructive', () => {
    assert.match(index, /id="confirm-cancel-btn"[^>]*>取消<\/button>/);
    assert.match(index, /onclick="if\(event\.target===this\)closeConfirm\(false\)"/);
    assert.match(app, /showConfirm\("确认删除"[\s\S]*?'清空', \{ addressBlock: 'B83', onSecondary: \(\) => clearLogEntryToUnassigned\(log\) \}\)/);
    assert.doesNotMatch(index, /id="merge-clear-btn"/);
    assert.match(app, /showMergeDirection\(target, direction => \{[\s\S]*\}, neighbors, \{ addressBlock: 'B81' \}\)/);
    assert.match(inspector, /\['B81', '已分配主线删除归并方向界面'/);
    assert.match(inspector, /\['B82', '未分配时段删除归并方向界面'/);
    assert.match(inspector, /\['B83', '流水删除确认及清空界面'/);

    let result = null;
    let cleared = false;
    const context = {
        document: { getElementById: () => ({ classList: { add() {} } }) },
        confirmCallback: value => { result = value; },
        confirmSecondaryCallback: () => { cleared = true; },
    };
    vm.createContext(context);
    vm.runInContext(closeConfirmSource, context);
    context.closeConfirm(false);
    assert.equal(result, false);
    assert.equal(cleared, false);
    context.confirmCallback = value => { result = value; };
    context.confirmSecondaryCallback = () => { cleared = true; };
    context.closeConfirm(false, 'secondary');
    assert.equal(result, false);
    assert.equal(cleared, true);
});

test('hiding unassigned mains omits ordinary historical gaps without changing gap data', () => {
    const rendered = [];
    const context = {
        recordMode: 'journal', showUnassignedMain: false,
        document: { createElement() { assert.fail('hidden gap must not render'); } },
    };
    vm.createContext(context);
    vm.runInContext(renderUnassignedSource, context);
    const list = { appendChild(node) { rendered.push(node); } };
    const first = { start: gap.start, end: gap.end };
    const second = { start: gap.end + 60000, end: gap.end + 120000 };
    context.renderUnassignedMain(list, '2026-10-12', first);
    context.renderUnassignedMain(list, '2026-10-12', second);
    assert.equal(rendered.length, 0);
    assert.match(renderUnassignedSource, /!showUnassignedMain && !live && !assigned\.length/);
    assert.equal(first.start, gap.start);
    assert.equal(second.end, gap.end + 120000);
});

test('live unassigned event button opens events without opening backfill', () => {
    const makeElement = () => ({
        children: [], style: {}, listeners: {},
        appendChild(child) { this.children.push(child); },
        append(...children) { this.children.push(...children); },
        setAttribute() {}, addEventListener(type, callback) { this.listeners[type] = callback; },
    });
    let events = 0, backfills = 0;
    const context = {
        recordMode: 'journal', showUnassignedMain: true,
        document: { createElement: makeElement },
        buildLogFlowBar: makeElement, formatDateHeaderLabel: () => '当天',
        formatBeijingClockSec: () => '10:00:00', formatDuration: () => '10:00',
        openEventModal() { events++; }, openUnassignedBackfill() { backfills++; },
    };
    vm.createContext(context);
    vm.runInContext(renderUnassignedSource, context);
    const list = makeElement();
    context.renderUnassignedMain(list, '2026-10-12', gap, [], true);
    const wrap = list.children[0];
    const card = wrap.children.find(child => child.className?.includes('unassigned-main-card'));
    const eventButton = wrap.children.find(child => child.className?.includes('unassigned-live-event-btn'));
    eventButton.listeners.click();
    assert.equal(events, 1);
    assert.equal(backfills, 0);
    card.listeners.click();
    assert.equal(backfills, 1);
});

test('quick note scrolls above the visible keyboard area when focused', () => {
    const source = app.slice(app.indexOf('function keepFreeInputVisible()'), app.indexOf("document.getElementById('free-input')?.addEventListener", app.indexOf('function keepFreeInputVisible()')));
    const input = { getBoundingClientRect: () => ({ bottom: 510 }) };
    let scroll = 0;
    const context = {
        document: { activeElement: input, getElementById: () => input, querySelector: () => ({ scrollBy: options => { scroll = options.top; } }) },
        window: { visualViewport: { offsetTop: 0, height: 400 } },
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    context.keepFreeInputVisible();
    assert.equal(scroll, 126);
    context.document.activeElement = null;
    scroll = 0;
    context.keepFreeInputVisible();
    assert.equal(scroll, 0);
});

test('adding a drawer note has a confirm button and the done key submits it', () => {
    assert.match(index, /id="drawer-note"[^>]*enterkeyhint="done"/);
    assert.match(index, /id="drawer-note-confirm"[^>]*>确认</);
    assert.match(index, /id="free-input"[^>]*enterkeyhint="done"/);
    assert.match(index, /id="edit-note-input"[^>]*enterkeyhint="done"/);
    assert.match(app, /function confirmDrawerNote\(/);
    assert.match(app, /getElementById\('drawer-note'\)\?\.addEventListener\('keydown'/);
    assert.match(app, /if \(event\.key === 'Enter'\) \{\s*event\.preventDefault\(\);\s*handleFreeInput\(\);/s);
});
