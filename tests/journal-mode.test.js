const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const backup = fs.readFileSync(path.join(__dirname, '..', 'backup.js'), 'utf8');
const gapSource = app.slice(app.indexOf('const UNRECORDED_COLOR'), app.indexOf('\nlet reportBillboardReady', app.indexOf('const UNRECORDED_COLOR')));
const stopSource = app.slice(app.indexOf('function stopCurrentMain()'), app.indexOf('\nfunction executeAddShortcut(', app.indexOf('function stopCurrentMain()')));
const editSource = app.slice(app.indexOf('function applyEditedRange('), app.indexOf('\nfunction commitEditedRange(', app.indexOf('function applyEditedRange(')));
const resetSource = backup.slice(backup.indexOf('function resetTimebookStorage('), backup.indexOf('\nfunction requestTimebookReset(', backup.indexOf('function resetTimebookStorage(')));
const modeSource = app.slice(app.indexOf('function setRecordMode('), app.indexOf('\nwindow.setRecordMode = setRecordMode;', app.indexOf('function setRecordMode(')));
const executeSource = app.slice(app.indexOf('function executeRecord('), app.indexOf('\nfunction doExecuteRecord(', app.indexOf('function executeRecord(')));
const shortcutSource = app.slice(app.indexOf('function renderShortcuts()'), app.indexOf('\nfunction renderParallelShortcuts()', app.indexOf('function renderShortcuts()')));
const timeFieldSource = app.slice(app.indexOf('function initTimeField('), app.indexOf('\nfunction setFieldColor(', app.indexOf('function initTimeField(')));
const openEditSource = app.slice(app.indexOf('function openEdit('), app.indexOf('\nfunction updateEditCatDisplay(', app.indexOf('function openEdit(')));
const activeMainEditSource = app.slice(app.indexOf('function confirmActiveMainEdit('), app.indexOf('\nfunction confirmActiveParallelEdit(', app.indexOf('function confirmActiveMainEdit(')));
const calendarBudgetSource = app.slice(app.indexOf('function getMainOccupiedMsForDay('), app.indexOf('\nfunction getCalendarDaySummary(', app.indexOf('function getMainOccupiedMsForDay(')));
const unlocatedChartSource = app.slice(app.indexOf('function mergeUnlocatedIntoChart('), app.indexOf('\nfunction buildMainComposition(', app.indexOf('function mergeUnlocatedIntoChart(')));
const reportSortSource = app.slice(app.indexOf('function compareReportDuration('), app.indexOf('\nfunction aggregateReportSegments(', app.indexOf('function compareReportDuration(')));
const periodReportSource = app.slice(app.indexOf('function buildLiveReportPeriod('), app.indexOf('\nfunction ensureReportBillboard(', app.indexOf('function buildLiveReportPeriod(')));
const durationInputSource = app.slice(app.indexOf('function sanitizeCalendarDurationInput('), app.indexOf('\nfunction showCalendarBackfillForm(', app.indexOf('function sanitizeCalendarDurationInput(')));
const calendarClockSource = app.slice(app.indexOf('function readCalendarBackfillClock('), app.indexOf('\nfunction showCalendarBackfillForm(', app.indexOf('function readCalendarBackfillClock(')));
const eventReportSource = app.slice(app.indexOf('function buildEventReport('), app.indexOf('\nfunction buildLiveReportDay(', app.indexOf('function buildEventReport(')));
const calendarSaveSource = app.slice(app.indexOf('function saveCalendarBackfill('), app.indexOf('\nfunction editCalendarSupplement(', app.indexOf('function saveCalendarBackfill(')));
const unassignedSource = app.slice(app.indexOf('function getDayUnassignedSegments('), app.indexOf('\nfunction buildLogDayHeader(', app.indexOf('function getDayUnassignedSegments(')));
const assignSource = app.slice(app.indexOf('function assignUnlocatedToGaps('), app.indexOf('\nfunction getAllocatedInGap(', app.indexOf('function assignUnlocatedToGaps(')));
const scopeSource = app.slice(app.indexOf('function unassignedScopeEnd('), app.indexOf('\nfunction assignUnlocatedToGaps(', app.indexOf('function unassignedScopeEnd(')));

function storage(values) {
    const valuesMap = new Map(Object.entries(values));
    return {
        get length() { return valuesMap.size; },
        key(index) { return [...valuesMap.keys()][index]; },
        getItem(key) { return valuesMap.get(key) ?? null; },
        setItem(key, value) { valuesMap.set(key, String(value)); },
        removeItem(key) { valuesMap.delete(key); },
    };
}

const DAY = 86400000;
const start = Date.parse('2026-10-13T00:00:00+08:00');
function segment(fromHour, toHour, extra = {}) {
    return { clippedStart: start + fromHour * 3600000, clippedEnd: start + toHour * 3600000, ...extra };
}

function gapContext(segments, nowHour = 24) {
    const context = {
        logs: [{ startTime: start + 2 * 3600000, parallel: false }],
        current: null,
        unlocatedLogs: [],
        localStorage: storage({}),
        nowSecondMs: () => start + nowHour * 3600000,
        formatBeijingDate: () => '2026-10-13',
        beijingDateStrToDayStart: () => start,
    };
    vm.createContext(context);
    vm.runInContext(gapSource, context);
    return context.getUnrecordedSegments(segments, start, start + DAY * 2, start + nowHour * 3600000);
}

test('unrecorded time fills elapsed gaps but not scene coverage or future time', () => {
    const gaps = gapContext([
        segment(2, 4),
        segment(6, 9, { scene: true }),
        segment(7, 8, { sceneActivity: true }),
        segment(10, 12),
    ], 12);
    assert.deepEqual(Array.from(gaps, (gap) => [(gap.clippedStart - start) / 3600000, (gap.clippedEnd - start) / 3600000]), [
        [0, 2], [4, 6], [9, 10]
    ]);
    assert.equal(gaps.every((gap) => gap.unrecorded && gap.l1 === '未记录时间'), true);
});

test('cross-day gaps keep a complete 24-hour day and shrink after backfill', () => {
    const original = gapContext([segment(22, 25)], 48);
    const backfilled = gapContext([segment(10, 12), segment(22, 25)], 48);
    const total = (items) => items.reduce((sum, item) => sum + item.clippedEnd - item.clippedStart, 0);
    assert.equal(total(original) + 3 * 3600000, 2 * DAY);
    assert.equal(total(original) - total(backfilled), 2 * 3600000);
});

test('an unassigned main carries across midnight as two date-bounded gaps', () => {
    const now = start + DAY + 5 * 60000;
    const context = {
        DAY_MS: DAY, recordMode: 'journal', current: null,
        logs: [{ id: 'last-main', startTime: start + 23 * 3600000, endTime: start + 23.5 * 3600000 }],
        unlocatedLogs: [], localStorage: storage({ v9_tracking_start: String(start) }),
        nowSecondMs: () => now,
        formatBeijingDate: (ms) => new Date(ms + 8 * 3600000).toISOString().slice(0, 10),
        beijingDateStrToDayStart: (date) => Date.parse(`${date}T00:00:00+08:00`),
        logTouchesDate: (log, date) => log.startTime < Date.parse(`${date}T00:00:00+08:00`) + DAY
            && log.endTime > Date.parse(`${date}T00:00:00+08:00`),
        logEndMs: (log) => log.endTime,
    };
    vm.createContext(context);
    vm.runInContext(gapSource, context);
    vm.runInContext(unassignedSource, context);
    const yesterday = context.getDayUnassignedSegments('2026-10-13', now).at(-1);
    const today = context.getActiveUnassignedSegment('2026-10-14', now);
    assert.equal(yesterday.start, start + 23.5 * 3600000);
    assert.equal(yesterday.end, start + DAY);
    assert.equal(today.start, start + DAY);
    assert.equal(today.end, now);
});

test('calendar backfill budget respects both days of a cross-midnight interval', () => {
    const context = {
        DAY_MS: DAY, HOUR_MS: 3600000,
        logs: [{ id: 'night', startTime: start + 22 * 3600000, endTime: start + 25 * 3600000 }],
        current: null,
        unlocatedLogs: [{ id: 'a', date: '2026-10-13', durationMs: 5 * 3600000 }, { id: 'b', date: '2026-10-14', durationMs: 3600000 }],
        nowSecondMs: () => start + 2 * DAY,
        beijingDateStrToDayStart: (date) => Date.parse(`${date}T00:00:00+08:00`),
        formatBeijingDate: (ms) => new Date(ms + 8 * 3600000).toISOString().slice(0, 10),
        logEndMs: (item) => item.endTime,
    };
    vm.createContext(context);
    vm.runInContext(calendarBudgetSource, context);
    assert.equal(context.getRemainingDayMs('2026-10-13'), 17 * 3600000);
    assert.equal(context.getRemainingDayMs('2026-10-14'), 22 * 3600000);
    assert.equal(context.intervalExceedsDayBudget(start, start + 17 * 3600000), false);
    assert.equal(context.intervalExceedsDayBudget(start, start + 18 * 3600000), true);
    assert.equal(context.intervalExceedsDayBudget(start + 20 * 3600000, start + DAY + 23 * 3600000), true);
    context.nowSecondMs = () => start + 12 * 3600000;
    context.logs = [{ id: 'morning', startTime: start + 8 * 3600000, endTime: start + 10 * 3600000 }];
    context.unlocatedLogs = [{ id: 'untimed', date: '2026-10-13', durationMs: 9 * 3600000 }];
    assert.equal(context.getRemainingDayMs('2026-10-13'), 3600000);
    assert.equal(context.intervalExceedsDayBudget(start, start + 2 * 3600000), true);
});

test('unassigned main fills initial, middle, and trailing gaps without overlapping recorded main', () => {
    const context = {
        DAY_MS: DAY, recordMode: 'journal',
        logs: [
            { startTime: start + 8 * 3600000, endTime: start + 9 * 3600000 },
            { startTime: start + 12 * 3600000, endTime: start + 13 * 3600000 },
            { startTime: start + 14 * 3600000, endTime: start + 20 * 3600000, parallel: true },
        ],
        current: null,
        nowSecondMs: () => start + DAY + 3600000,
        beijingDateStrToDayStart: () => start,
        formatBeijingDate: () => '2026-10-13',
        getTodayDateStr: () => '2026-10-13',
        unlocatedLogs: [], localStorage: storage({}),
        logTouchesDate: (log) => !log.parallel,
        logEndMs: (log) => log.endTime,
    };
    vm.createContext(context);
    vm.runInContext(gapSource, context);
    vm.runInContext(unassignedSource, context);
    const gaps = context.getDayUnassignedSegments('2026-10-13');
    assert.deepEqual(Array.from(gaps, (gap) => [(gap.start - start) / 3600000, (gap.end - start) / 3600000]), [
        [0, 8], [9, 12], [13, 24],
    ]);
    context.recordMode = 'continuous';
    assert.equal(context.getDayUnassignedSegments('2026-10-13').length, 0);
});

test('an untimed activity in the live gap stays assigned as that gap grows', () => {
    const context = {
        DAY_MS: DAY, current: null,
        nowSecondMs: () => start + 12 * 3600000,
        formatBeijingDate: () => '2026-10-13',
        beijingDateStrToDayStart: () => start,
    };
    vm.createContext(context);
    vm.runInContext(scopeSource, context);
    vm.runInContext(assignSource, context);
    const initial = { start: start + 10 * 3600000, end: start + 12 * 3600000 };
    const record = { id: 'untimed', date: '2026-10-13', durationMs: 3600000,
        gapStart: initial.start, gapEnd: context.unassignedScopeEnd('2026-10-13', initial) };
    assert.equal(record.gapEnd, start + DAY);
    const grown = { start: initial.start, end: start + 14 * 3600000 };
    assert.equal(context.assignUnlocatedToGaps('2026-10-13', [grown], [record]).unplaced.length, 0);
});

test('unassigned main backfill keeps existing untimed duration when adding an exact interval', () => {
    const inputs = {
        'calendar-backfill-start-h': '10', 'calendar-backfill-start-m': '00', 'calendar-backfill-start-s': '00',
        'calendar-backfill-end-h': '23', 'calendar-backfill-end-m': '30', 'calendar-backfill-end-s': '00',
    };
    const prompts = [];
    const context = {
        calendarBackfillKind: 'interval', calendarBackfillTarget: { start: start + 10 * 3600000, end: start + DAY },
        recordMode: 'journal', viewDate: '2026-10-13', DAY_MS: DAY,
        logs: [], unlocatedLogs: [{ id: 'reserved', date: '2026-10-13', durationMs: 2 * 3600000, gapStart: start + 10 * 3600000 }],
        document: { getElementById: (id) => ({ value: inputs[id] }) },
        beijingDateStrToDayStart: () => start,
        nowSecondMs: () => start + DAY + 3600000,
        getDayUnassignedSegments: (_date, _now, extraMain = []) => extraMain.length
            ? [{ start, end: start + 10 * 3600000 }, { start: start + 23.5 * 3600000, end: start + DAY }]
            : [{ start, end: start + 10 * 3600000 }, { start: start + 10 * 3600000, end: start + DAY }],
        getAllocatedInGap: () => 2 * 3600000,
        formatDuration: () => '2:00:00',
        unassignedScopeEnd: (_date, gap) => gap.end,
        mainRecordOverlaps: () => [], intervalExceedsDayBudget: () => false,
        formatBeijingDate: () => '2026-10-13',
        showConfirm: (title) => prompts.push(title),
    };
    vm.createContext(context);
    vm.runInContext(calendarClockSource, context);
    vm.runInContext(assignSource, context);
    vm.runInContext(calendarSaveSource, context);
    context.saveCalendarBackfill();
    assert.deepEqual(prompts, ['有时间已被占用']);
    assert.equal(context.logs.length, 0);
});

test('untimed time replaces unrecorded hours without inventing a timeline interval', () => {
    const unrecorded = { name: '未记录时间', exactHours: 20, hours: 20, color: '#cbd5e1' };
    const work = { name: '工作', exactHours: 4, hours: 4, color: '#345678' };
    const chart = {
        l1: [{ ...unrecorded }, { ...work }],
        l2: [{ ...unrecorded }, { name: '办公', exactHours: 4, hours: 4, color: '#345678' }],
        l2Slices: [{ ...unrecorded, l1: '未记录时间' }, { l1: '工作', name: '办公', exactHours: 4, hours: 4, color: '#345678' }],
    };
    const context = {
        HOUR_MS: 3600000,
        unlocatedLogs: [{ date: '2026-10-13', l1: '工作', l2: '办公', durationMs: 2 * 3600000 }],
        beijingDateStrToDayStart: () => start,
        getCat: () => ({ color: '#345678' }),
        msToReportHours: (ms) => Math.round(ms / 360000) / 10,
    };
    vm.createContext(context);
    vm.runInContext(reportSortSource, context);
    vm.runInContext(unlocatedChartSource, context);
    assert.equal(context.mergeUnlocatedIntoChart(chart, start, start + DAY), 2 * 3600000);
    assert.equal(chart.l1.find((item) => item.name === '未记录时间').exactHours, 18);
    assert.equal(chart.l1.find((item) => item.name === '工作').exactHours, 6);
    assert.equal(chart.l1.reduce((sum, item) => sum + item.exactHours, 0), 24);
    assert.equal(chart.l1.at(-1).name, '未记录时间');
    assert.equal(chart.l2.at(-1).name, '未记录时间');
});

test('daily composition totals never add untimed records to a 24-hour timeline', () => {
    const hour = 3600000;
    const now = start + 2 * DAY + 12 * hour;
    const context = {
        DAY_MS: DAY, HOUR_MS: hour,
        UNRECORDED_COLOR: '#cbd5e1',
        unlocatedLogs: [{ date: '2026-10-13', durationMs: 2 * hour }],
        nowSecondMs: () => now,
        getTodayDateStr: () => '2026-10-15',
        beijingDateStrToDayStart: (date) => Date.parse(`${date}T00:00:00+08:00`),
        formatBeijingDate: (ms) => new Date(ms + 8 * hour).toISOString().slice(0, 10),
        formatBeijingClockSec: () => '00:00:00',
        getBeijingReportRange: () => ({ start, end: start + 7 * DAY }),
        getSegmentsInRange: () => [],
        getUnrecordedSegments: () => [{ clippedStart: start, clippedEnd: now, unrecorded: true, l1: '未记录时间' }],
        buildMainChartComposition: () => ({ l1: [], l2: [], l2Slices: [] }),
        mergeUnlocatedIntoChart: () => 2 * hour,
        aggregateReportSegments: () => [],
        buildEventReport: () => ({}),
        getReportPeriodTitle: () => '本周',
        displayName: () => '未记录时间',
        getCat: () => null,
        msToReportHours: (ms) => Math.round(ms / hour * 10) / 10,
    };
    vm.createContext(context);
    vm.runInContext(app.slice(app.indexOf('function buildMainComposition('), app.indexOf('\nfunction parallelHostL1(', app.indexOf('function buildMainComposition('))), context);
    vm.runInContext(periodReportSource, context);
    const bars = context.buildLiveReportPeriod('week').timeline.bars;
    assert.deepEqual(Array.from(bars, (bar) => bar.hours), [24, 24, 12]);
    assert.deepEqual(Array.from(bars, (bar) => bar.segments.reduce((sum, segment) => sum + segment.width, 0)), [100, 100, 100]);
});

test('report duration sorting always puts unrecorded last', () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(reportSortSource, context);
    const rows = [{ name: '未记录时间', ms: 20 }, { name: '工作', ms: 2 }, { name: '生活', ms: 5 }];
    assert.deepEqual(Array.from(rows.sort(context.compareReportDuration), (row) => row.name), ['生活', '工作', '未记录时间']);
    assert.deepEqual(Array.from(rows.sort((a, b) => context.compareReportDuration(a, b, true)), (row) => row.name), ['工作', '生活', '未记录时间']);
});

test('untimed backfill entry limits hours and minutes while typing', () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(durationInputSource, context);
    const minutes = { value: '065880' };
    context.sanitizeCalendarDurationInput(minutes, 59);
    assert.equal(minutes.value, '6');
    minutes.value = '99';
    context.sanitizeCalendarDurationInput(minutes, 59);
    assert.equal(minutes.value, '59');
    const hours = { value: '45' };
    context.sanitizeCalendarDurationInput(hours, 24);
    assert.equal(hours.value, '24');
});

test('calendar backfill clocks use the selected day and infer a next-day end', () => {
    const values = {
        'calendar-backfill-start-h': '23', 'calendar-backfill-start-m': '30', 'calendar-backfill-start-s': '00',
        'calendar-backfill-end-h': '01', 'calendar-backfill-end-m': '15', 'calendar-backfill-end-s': '00',
    };
    const context = {
        viewDate: '2026-10-13', DAY_MS: DAY,
        beijingDateStrToDayStart: () => start,
        document: { getElementById: (id) => ({ value: values[id] }) },
    };
    vm.createContext(context);
    vm.runInContext(calendarClockSource, context);
    const range = context.getCalendarBackfillInterval();
    assert.equal(range.start, start + 23.5 * 3600000);
    assert.equal(range.end, start + DAY + 1.25 * 3600000);
    values['calendar-backfill-end-h'] = '24';
    values['calendar-backfill-end-m'] = '00';
    assert.equal(context.getCalendarBackfillInterval().end, start + DAY);
    values['calendar-backfill-end-m'] = '01';
    assert.equal(context.getCalendarBackfillInterval().end, null);
});

test('date-only event supplements count occurrences but not time', () => {
    const context = {
        eventRecords: [
            { typeId: 'water', occurredAt: start, count: 3 },
            { typeId: 'water', occurredAt: start + 3600000, count: 1 },
        ],
        eventTypeById: () => ({ name: '喝水', icon: '•', color: '#123456' }),
        formatBeijingDate: () => '2026-10-13',
    };
    vm.createContext(context);
    vm.runInContext(eventReportSource, context);
    const report = context.buildEventReport(start, start + DAY, 'day');
    assert.equal(report.total, 4);
    assert.equal(report.entries[0].count, 4);
    assert.equal(report.entries[0].days, 1);
});

test('calendar interval save blocks overlap and exhausted time before writing a new main', () => {
    const inputs = {
        'calendar-backfill-start-h': '09', 'calendar-backfill-start-m': '00', 'calendar-backfill-start-s': '00',
        'calendar-backfill-end-h': '10', 'calendar-backfill-end-m': '00', 'calendar-backfill-end-s': '00',
        'calendar-backfill-l1': '工作', 'calendar-backfill-l2': '办公', 'calendar-backfill-note': '',
    };
    const prompts = [];
    const store = storage({});
    const context = {
        calendarBackfillKind: 'interval', calendarBackfillTarget: null, recordMode: 'journal', viewDate: '2026-10-13',
        DAY_MS: DAY, logs: [], unlocatedLogs: [], localStorage: store,
        document: { getElementById: (id) => ({ value: inputs[id] }) },
        beijingDateStrToDayStart: () => start,
        nowSecondMs: () => start + 12 * 3600000,
        formatBeijingDate: () => '2026-10-13',
        getDayUnassignedSegments: () => [],
        unassignedScopeEnd: (_date, gap) => gap.end,
        assignUnlocatedToGaps: () => ({ byGap: [], unplaced: [] }),
        mainRecordOverlaps: () => [{ l1: '生活', l2: '休息' }],
        intervalExceedsDayBudget: () => false,
        displayName: () => '休息',
        showConfirm: (title) => prompts.push(title),
        getCat: () => ({ color: '#345678' }),
        genId: () => 'new-main', closeCalendarBackfill() {}, renderAll() {},
    };
    vm.createContext(context);
    vm.runInContext(calendarClockSource, context);
    vm.runInContext(calendarSaveSource, context);
    context.saveCalendarBackfill();
    assert.deepEqual(prompts, ['时间段发生重叠']);
    context.mainRecordOverlaps = () => [];
    context.intervalExceedsDayBudget = () => true;
    context.saveCalendarBackfill();
    assert.deepEqual(prompts, ['时间段发生重叠', '时间总数不够分配']);
    context.intervalExceedsDayBudget = () => false;
    context.saveCalendarBackfill();
    assert.equal(context.logs.length, 1);
    assert.equal(context.logs[0].journal, true);
    assert.equal(JSON.parse(store.getItem('v9_logs'))[0].id, 'new-main');
});

test('calendar event supplements remain available in continuous mode', () => {
    const saved = [];
    const context = {
        calendarBackfillKind: 'event', calendarBackfillEditingId: null,
        recordMode: 'continuous', viewDate: '2026-10-13', eventRecords: [],
        document: { getElementById: (id) => ({ value: id === 'calendar-backfill-event-count' ? '3' : 'water' }) },
        eventTypeById: () => ({ id: 'water' }),
        beijingDateStrToDayStart: () => start,
        saveEventRecord: (item) => saved.push(item),
        closeCalendarBackfill() {}, renderAll() {},
    };
    vm.createContext(context);
    vm.runInContext(calendarSaveSource, context);
    context.saveCalendarBackfill();
    assert.equal(saved[0].count, 3);
    assert.equal(saved[0].dateOnly, true);
    assert.equal(saved[0].parentId, undefined);
});

test('ending a journal main records it and leaves no active main', () => {
    const active = { id: 'main', startTime: start, l1: '生活', l2: '休息' };
    const store = storage({ v9_current: JSON.stringify(active) });
    const calls = [];
    const context = {
        recordMode: 'journal', current: active, parallelCurrent: null, localStorage: store,
        nowSecondMs: () => start + 3600000,
        ensureDayRolloversBefore() {},
        commitCurrentSlice(end, continuation, options) { calls.push({ end, continuation, options }); },
        setText() {}, renderAll() {},
    };
    vm.createContext(context);
    vm.runInContext(stopSource, context);
    context.stopCurrentMain();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.endParallel, true);
    assert.equal(store.getItem('v9_current'), null);
    assert.equal(context.current, null);
});

test('selecting the active journal activity ends it instead of starting a new segment', () => {
    const calls = [];
    const context = {
        recordMode: 'journal', parallelCurrent: null,
        isSceneActive: () => false,
        isSameClassifiedMainActivity: () => true,
        closeDrawer: () => calls.push('close'),
        stopCurrentMain: () => calls.push('stop'),
        doExecuteRecord: () => calls.push('start'),
    };
    vm.createContext(context);
    vm.runInContext(executeSource, context);
    context.executeRecord('生活', '休息', '', '');
    assert.deepEqual(calls, ['close', 'stop']);
    context.recordMode = 'continuous';
    context.executeRecord('生活', '休息', '', '');
    assert.deepEqual(calls, ['close', 'stop', 'start']);
});

test('active shortcut remains tappable only in journal mode', () => {
    const makeElement = () => ({
        children: [], listeners: {},
        classList: { toggle() {} },
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); },
        addEventListener(type, listener) { this.listeners[type] = listener; },
    });
    const shortcutBox = makeElement();
    const section = makeElement();
    const calls = [];
    const context = {
        recordMode: 'journal', current: { l1: '生活', l2: '休息' },
        shortcuts: [{ l1: '生活', l2: '休息' }],
        document: {
            getElementById(id) { return id === 'home-shortcuts' ? shortcutBox : section; },
            createElement: makeElement,
        },
        isSceneActive: () => false,
        isSameClassifiedMainActivity: () => true,
        resolveShortcutIcon: () => '·',
        executeRecord: () => calls.push('tap'),
    };
    vm.createContext(context);
    vm.runInContext(shortcutSource, context);
    context.renderShortcuts();
    shortcutBox.children.at(-1).children[0].listeners.click({ preventDefault() {} });
    assert.deepEqual(calls, ['tap']);
    context.recordMode = 'continuous';
    context.renderShortcuts();
    shortcutBox.children.at(-1).children[0].listeners.click({ preventDefault() {} });
    assert.deepEqual(calls, ['tap']);
});

test('backfill time fields keep focus while entering two digits', () => {
    const listeners = {};
    let selections = 0;
    let nextFocuses = 0;
    const next = { focus: () => { nextFocuses++; } };
    const field = {
        id: 'ps-h', value: '08',
        addEventListener(type, listener) { listeners[type] = listener; },
        select() { selections++; },
        parentElement: { querySelectorAll: () => [field, next] },
    };
    const context = { _backfillRange: null };
    vm.createContext(context);
    vm.runInContext(timeFieldSource, context);
    context.initTimeField(field, 23);
    assert.equal(listeners.touchstart, undefined);
    listeners.focus.call(field);
    field.value = '12';
    listeners.input.call(field);
    assert.equal(selections, 1);
    assert.equal(nextFocuses, 0);
});

test('calendar backfill clock fields reuse the shared two-digit focus advance', () => {
    const listeners = {};
    let nextFocuses = 0;
    const next = { value: '', focus() { nextFocuses++; }, setSelectionRange() {} };
    const field = {
        id: 'calendar-backfill-start-h', value: '1',
        addEventListener(type, listener) { listeners[type] = listener; },
        setSelectionRange() {},
        parentElement: { querySelectorAll: () => [field, next] },
    };
    const context = { _backfillRange: null, setTimeout(callback) { callback(); } };
    vm.createContext(context);
    vm.runInContext(timeFieldSource, context);
    context.initTimeField(field, 23);
    field.value = '10';
    listeners.input.call(field);
    assert.equal(nextFocuses, 1);
});

test('active journal editor offers the latest previous main end as its start', () => {
    const active = { id: 'active', startTime: start + 10 * 3600000, l1: '生活', l2: '休息' };
    const elements = new Map();
    const fieldSets = [];
    const element = (id) => {
        if (!elements.has(id)) elements.set(id, {
            classList: { add() {}, remove() {}, toggle() {} },
            style: {}, value: '', disabled: false,
        });
        return elements.get(id);
    };
    const context = {
        current: active, DAY_MS: DAY, logs: [
            { id: 'older', startTime: start + 2 * 3600000, endTime: start + 5 * 3600000 },
            { id: 'previous', startTime: start + 6 * 3600000, endTime: start + 8 * 3600000 },
            { id: 'parallel', parallel: true, startTime: start + 8 * 3600000, endTime: start + 9 * 3600000 },
        ], parallelHistory: [], parallelCurrent: null,
        nowSecondMs: () => start + 12 * 3600000,
        beijingDateStrToDayStart: () => start,
        formatBeijingDate: () => '2026-10-13',
        formatBeijingClockSec: () => '08:00:00',
        logEndMs: (item) => item.endTime,
        formatDuration: () => '02:00:00',
        setTimeInFields: (prefix, date) => fieldSets.push([prefix, date.getTime()]),
        updateEditCatDisplay() {},
        document: { getElementById: element },
    };
    vm.createContext(context);
    vm.runInContext(openEditSource, context);
    context.openEdit(0, 'current');
    assert.equal(context.editTarget.previousEnd, start + 8 * 3600000);
    assert.equal(element('ee-h').disabled, true);
    assert.equal(element('edit-continue-previous').innerText, '接续上一条结束时间 08:00:00');
    context.continueEditFromPrevious();
    assert.deepEqual(fieldSets.at(-1), ['es', start + 8 * 3600000]);
});

test('editing an active journal main preserves its id and rejects overlap', () => {
    const active = { id: 'active', startTime: start + 10 * 3600000, l1: '生活', l2: '休息' };
    const previous = { id: 'previous', startTime: start + 6 * 3600000, endTime: start + 8 * 3600000 };
    const store = storage({});
    const prompts = [];
    let selectedStart = start + 7 * 3600000;
    const context = {
        recordMode: 'journal', current: active, logs: [previous], parallelHistory: [], parallelCurrent: null,
        editTarget: { source: 'current', id: 'active' }, editOldL1: '生活', editOldL2: '休息',
        nowSecondMs: () => start + 12 * 3600000,
        formatBeijingDate: () => '2026-10-13',
        parseTimeOnBeijingDate: () => selectedStart,
        mainRecordOverlaps: (from, to) => previous.endTime > from && previous.startTime < to ? [previous] : [],
        intervalExceedsDayBudget: () => false,
        getCat: () => ({ color: '#123456' }),
        showConfirm: (title, message) => prompts.push([title, message]),
        document: { getElementById: () => ({ value: '更新备注' }) },
        localStorage: store, closeEdit() {}, renderAll() {}, rememberInputAlias() {},
    };
    vm.createContext(context);
    vm.runInContext(activeMainEditSource, context);
    context.confirmActiveMainEdit();
    assert.equal(active.startTime, start + 10 * 3600000);
    assert.equal(store.getItem('v9_current'), null);
    assert.equal(prompts[0][0], '时间段发生重叠');
    selectedStart = start + 8 * 3600000;
    context.confirmActiveMainEdit();
    assert.equal(active.id, 'active');
    assert.equal(active.startTime, selectedStart);
    assert.equal(active.endTime, undefined);
    assert.equal(JSON.parse(store.getItem('v9_current')).id, 'active');
});

test('active journal main cannot be shortened past a child parallel start', () => {
    const active = { id: 'active', startTime: start + 8 * 3600000, l1: '生活', l2: '休息' };
    const child = { id: 'child', parentId: 'active', parallel: true, startTime: start + 9 * 3600000 };
    const prompts = [];
    const store = storage({});
    const context = {
        recordMode: 'journal', current: active, logs: [], parallelHistory: [child], parallelCurrent: null,
        editTarget: { source: 'current', id: 'active' }, editOldL1: '生活', editOldL2: '休息',
        nowSecondMs: () => start + 12 * 3600000,
        formatBeijingDate: () => '2026-10-13',
        parseTimeOnBeijingDate: () => start + 10 * 3600000,
        mainRecordOverlaps: () => [],
        intervalExceedsDayBudget: () => false,
        showConfirm: (title) => prompts.push(title),
        localStorage: store,
    };
    vm.createContext(context);
    vm.runInContext(activeMainEditSource, context);
    context.confirmActiveMainEdit();
    assert.deepEqual(prompts, ['并行超出主线']);
    assert.equal(active.startTime, start + 8 * 3600000);
    assert.equal(store.getItem('v9_current'), null);
});

test('switching mode waits for confirmation and preserves active parallel state', () => {
    const parallel = { id: 'parallel-1', parentId: 'main-1', startTime: start };
    const store = storage({ v9_parallel: JSON.stringify(parallel) });
    let confirm;
    let renders = 0;
    const context = {
        recordMode: 'continuous', current: { id: 'main-1', startTime: start },
        parallelCurrent: parallel, localStorage: store,
        showConfirm(title, message, action, callback) { confirm = callback; },
        nowSecondMs: () => start, renderAll() { renders++; },
    };
    vm.createContext(context);
    vm.runInContext(modeSource, context);
    context.setRecordMode('journal');
    assert.equal(store.getItem('v9_record_mode'), null);
    confirm(false);
    assert.equal(store.getItem('v9_record_mode'), null);
    context.setRecordMode('journal');
    confirm(true);
    assert.equal(store.getItem('v9_record_mode'), 'journal');
    assert.equal(store.getItem('v9_parallel'), JSON.stringify(parallel));
    assert.equal(context.parallelCurrent, parallel);
    assert.equal(renders, 1);
});

test('journal main can expand into a gap without moving adjacent records', () => {
    const log = { id: 'journal', journal: true, startTime: start + 10 * 3600000, endTime: start + 11 * 3600000 };
    const next = { id: 'next', startTime: start + 13 * 3600000, endTime: start + 14 * 3600000 };
    const context = {
        logs: [log, next], parallelHistory: [], current: null,
        DAY_MS: DAY,
        nowSecondMs: () => start + 20 * 3600000,
        formatBeijingDate: () => '2026-10-13',
        beijingDateStrToDayStart: () => start,
        beijingDateStrToDayEnd: () => start + DAY,
        logEndMs: (item) => item.endTime,
        mainRecordOverlaps: (from, to, excluded) => [log, next].filter((item) => !excluded.has(item.id) && item.startTime < to && item.endTime > from),
        intervalExceedsDayBudget: () => false,
        showConfirm() { throw new Error('An open gap should not need a prompt'); },
    };
    vm.createContext(context);
    vm.runInContext(editSource, context);
    let saved = false;
    context.applyEditedRange(log, start + 9 * 3600000, start + 11 * 3600000, () => { saved = true; });
    assert.equal(saved, true);
    assert.equal(log.startTime, start + 9 * 3600000);
    assert.equal(next.startTime, start + 13 * 3600000);
});

test('journal midnight end can move earlier but cannot cross the day boundary', () => {
    const log = { id: 'journal', journal: true, startTime: start + 22 * 3600000, endTime: start + DAY };
    const next = { id: 'next', startTime: start + DAY, endTime: start + DAY + 3600000 };
    const alerts = [];
    const context = {
        logs: [log, next], parallelHistory: [], current: null, DAY_MS: DAY,
        nowSecondMs: () => start + 2 * DAY,
        formatBeijingDate: () => '2026-10-13',
        beijingDateStrToDayStart: () => start, beijingDateStrToDayEnd: () => start + DAY,
        logEndMs: item => item.endTime,
        mainRecordOverlaps: (from, to, excluded) => [log, next].filter(item => !excluded.has(item.id) && item.startTime < to && item.endTime > from),
        intervalExceedsDayBudget: () => false,
        showConfirm: title => alerts.push(title),
    };
    vm.createContext(context);
    vm.runInContext(editSource, context);
    let saved = false;
    context.applyEditedRange(log, log.startTime, start + 23 * 3600000, () => { saved = true; });
    assert.equal(saved, true);
    assert.equal(log.endTime, start + 23 * 3600000);
    assert.equal(next.startTime, start + DAY);
    saved = false;
    context.applyEditedRange(log, log.startTime, start + DAY + 60000, () => { saved = true; });
    assert.equal(saved, false);
    assert.equal(log.endTime, start + 23 * 3600000);
    assert.deepEqual(alerts, ['时间不合法']);
});

test('record reset keeps configuration; full reset clears only app data', () => {
    const values = {
        v9_logs: '[]', v9_current: '{}', v9_event_records: '[]', v9_unlocated_logs: '[]',
        v9_cats: 'categories', v9_scene_settings: 'scenes', v9_record_mode: 'journal',
        unrelated: 'keep',
    };
    const context = {};
    vm.createContext(context);
    vm.runInContext(resetSource, context);
    const records = storage(values);
    context.resetTimebookStorage('records', records, start);
    assert.equal(records.getItem('v9_logs'), null);
    assert.equal(records.getItem('v9_event_records'), null);
    assert.equal(records.getItem('v9_unlocated_logs'), null);
    assert.equal(records.getItem('v9_cats'), 'categories');
    assert.equal(records.getItem('v9_record_mode'), 'journal');
    assert.equal(records.getItem('v9_tracking_start'), String(start));
    const all = storage(values);
    context.resetTimebookStorage('all', all);
    assert.equal(all.getItem('v9_cats'), null);
    assert.equal(all.getItem('v9_record_mode'), null);
    assert.equal(all.getItem('unrelated'), 'keep');
});
