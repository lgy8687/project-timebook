const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const latest = app.slice(app.indexOf('function formatEventHomeLatest('), app.indexOf('\nfunction renderEventHome(', app.indexOf('function formatEventHomeLatest(')));

test('event home latest record uses short dates and preserves date-only status', () => {
    const ctx = {
        DAY_MS: 86400000,
        getTodayDateStr: () => '2026-11-03',
        beijingDateStrToDayStart: date => Date.parse(date + 'T00:00:00Z'),
        formatBeijingDate: ms => new Date(ms).toISOString().slice(0, 10),
        formatBeijingClockSec: () => '09:30:00',
    };
    vm.createContext(ctx); vm.runInContext(latest, ctx);
    assert.equal(ctx.formatEventHomeLatest(null), '暂无记录');
    assert.equal(ctx.formatEventHomeLatest({ occurredAt: Date.parse('2026-11-03T03:00:00Z') }), '上次：今天 09:30');
    assert.equal(ctx.formatEventHomeLatest({ occurredAt: Date.parse('2026-11-02T00:00:00Z'), dateOnly: true }), '上次：昨天 · 仅日期');
    assert.equal(ctx.formatEventHomeLatest({ occurredAt: Date.parse('2026-10-13T00:00:00Z') }), '上次：10月13日 09:30');
});
test('event home uses one compact filter row without search or management header', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const home = html.match(/<section id="page-event-home"[\s\S]*?<\/section>/)[0];
    assert.match(home, /event-home-filter-row/);
    assert.match(home, /aria-label="返回"/);
    assert.doesNotMatch(home, /event-home-header|event-home-search|搜索事件|管理/);
});
test('event cards use shared report detail and cancel moved long presses', () => {
    assert.match(app, /window\.openReportEventDetail\(type, latest\)/);
    assert.match(app, /Math\.hypot\(event\.clientX - holdStart\.x, event\.clientY - holdStart\.y\) > 8/);
    assert.match(app, /if \(held\) \{ event\.preventDefault\(\); held = false; return; \}/);
    assert.match(app, /pointerup', 'pointercancel', 'pointerleave/);
});
test('long-press menu is card-anchored and each command has a bundled line icon', () => {
    assert.match(app, /const bounds = anchor\.getBoundingClientRect\(\)/);
    assert.match(app, /layer\.classList\.add\('is-context-menu'\)/);
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const menu = html.match(/id="event-card-menu-options"[\s\S]*?<\/div>/)[0];
    assert.equal((menu.match(/class="event-menu-icon"/g) || []).length, 5);
    for (const match of menu.matchAll(/url\('([^']+)'\)/g)) assert.ok(fs.existsSync(path.join(__dirname, '..', match[1])));
});
