const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const source = app.slice(app.indexOf('function buildEventReport('), app.indexOf('\nfunction buildLiveReportDay(', app.indexOf('function buildEventReport(')));

test('event chooser searches enabled types and orders by latest use without mutating settings', () => {
    const picker = app.slice(app.indexOf('function getEventChoiceTypes('), app.indexOf('\nfunction renderEventChoiceGrid(', app.indexOf('function getEventChoiceTypes(')));
    const context = {}; vm.createContext(context); vm.runInContext(picker, context);
    const types = [{id:'a',name:'喝水'}, {id:'b',name:'吃药'}, {id:'c',name:'喝茶',disabled:true}];
    const records = [{typeId:'b',createdAt:20}, {typeId:'a',createdAt:10}];
    assert.deepEqual(Array.from(context.getEventChoiceTypes(types, records, ''), x => x.id), ['b', 'a']);
    assert.deepEqual(Array.from(context.getEventChoiceTypes(types, records, '喝'), x => x.id), ['a']);
    assert.deepEqual(types.map(x => x.id), ['a', 'b', 'c']);
});

test('event statistics count occurrences and distinct days, preserving date-only status', () => {
    const day = 86400000, start = Date.parse('2026-10-01T00:00:00Z');
    const context = {
        eventRecords: [
            { typeId: 'water', occurredAt: start + 1000, count: 2 },
            { typeId: 'water', occurredAt: start + day, count: 3, dateOnly: true },
            { typeId: 'water', occurredAt: start + 3 * day, count: 8 },
        ],
        eventTypeById: () => ({ name: '喝水', icon: '💧', color: '#0ea5e9' }),
        formatBeijingDate: ms => new Date(ms).toISOString().slice(0, 10),
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    const report = context.buildEventReport(start, start + 2 * day, 'range');
    assert.equal(report.total, 5);
    assert.equal(report.recordsCount, 2);
    assert.deepEqual(Array.from(report.daily, item => item.count), [2, 3]);
    assert.equal(report.activeDays, 2);
    assert.equal(report.entries[0].days, 2);
    assert.equal(report.entries[0].latestDateOnly, true);
    assert.equal(report.entries[0].records.length, 2);
    assert.equal(report.entries[0].records[1].dateOnly, true);
    assert.equal(report.entries[0].records[1].date, '2026-10-02');
    assert.equal(report.entries[0].records[1].count, 3);
    const fullPeriod = context.buildEventReport(start, start + 2 * day, 'week', start + 7 * day);
    assert.equal(fullPeriod.daily.length, 7);
    assert.equal(fullPeriod.total, 5);
});

test('independent supplement saves count without inventing a time', () => {
    const fn = app.slice(app.indexOf('function saveTimedEvent()'), app.indexOf('\nwindow.saveTimedEvent', app.indexOf('function saveTimedEvent()')));
    const fields = {
        'event-date-input': { value: '2026-10-01' }, 'event-time-input': { value: '' },
        'event-use-time': { checked: false }, 'event-supplement-count': { value: '3' },
    };
    let saved;
    const context = {
        eventDraft: { typeId: 'water', parentId: null },
        document: { getElementById: id => fields[id] },
        parseTimeOnBeijingDateParts(date, time) { assert.equal(time, '00:00:00'); return Date.parse(date + 'T00:00:00Z'); },
        saveEventRecord: draft => { saved = { ...draft }; return true; },
        closeEventModal() {}, renderAll() {}, showConfirm() { assert.fail('unexpected warning'); },
    };
    vm.createContext(context); vm.runInContext(fn, context); context.saveTimedEvent();
    assert.equal(saved.dateOnly, true);
    assert.equal(saved.count, 3);
});

test('event parentId is stripped once and an unchanged record is left alone', () => {
    const fn = app.slice(app.indexOf('function normalizeEventRecord('), app.indexOf('\n// --- 数据模型'));
    const context = {};
    vm.createContext(context);
    vm.runInContext(fn, context);
    const plain = { id: 'a', typeId: 'water', occurredAt: 5, count: 1 };
    assert.equal(context.normalizeEventRecord(plain, false), plain);
    assert.equal(context.normalizeEventRecord(plain, true), plain);
    const legacy = { id: 'b', typeId: 'water', parentId: 'main', occurredAt: 5, count: 2 };
    const stripped = context.normalizeEventRecord(legacy, true);
    assert.equal(stripped.parentId, undefined);
    assert.equal(stripped.count, 2);
    assert.equal(legacy.parentId, 'main');
    assert.match(app, /v9_event_record_migration_v1/);
    assert.match(app, /JSON\.stringify\(logs\) !== storedLogs/);
    assert.doesNotMatch(app, /\.map\(\(\{ parentId, \.\.\.item \}\)/);
});
