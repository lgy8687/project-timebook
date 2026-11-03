const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('event trend uses per-event daily counts for week, month and year', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'report.js'), 'utf8');
    assert.match(source, /item\.dailyCounts\?\.\[date\]/);
    assert.match(source, /data\.period === 'week'/);
    assert.match(source, /data\.period === 'month' \|\| data\.period === 'year'/);
});

test('event trends open dedicated record and statistics views without changing primary time', () => {
    const report = fs.readFileSync(path.join(__dirname, '..', 'report.js'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    assert.match(report, /function openEventDetail\(item\)/);
    assert.match(report, /eventDetailTab === 'records' \? 'B99' : 'B100'/);
    assert.match(app, /item\.records\.push\(\{ id: record\.id/);
    assert.match(report, /record\.dateOnly \? '未指定时间'/);
    assert.match(report, /state\.eventDetailDate = state\.period === 'year' \? records\[0\]\.date\.slice\(0, 7\) : records\[0\]\.date/);
    assert.match(report, /showAll \? '最近记录' : '查看全部'/);
});

test('event trends use seven weekday columns and a compact yearly grid', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'report.css'), 'utf8');
    assert.match(css, /\.event-pattern-days\s*\{[^}]*repeat\(7,/);
    assert.match(css, /\.is-year \.event-pattern-days\s*\{[^}]*repeat\(26,/);
});

test('swipe preview does not rerender or detach the active touch target', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'report.js'), 'utf8');
    const preview = source.match(/function makeReportSwipePreview\(direction\) \{([\s\S]*?)\n        reportPage\?\.addEventListener\('touchstart'/)?.[1];
    assert.ok(preview);
    assert.doesNotMatch(preview, /\brender\(\)/);
    assert.match(preview, /clone\.classList\.remove\('hidden'\)/);
    assert.match(preview, /next\.style\.top = `\$\{sourceAnchor\.getBoundingClientRect\(\)\.top - top\}px`/);
    assert.match(source, /const targetKind = direction > 0 \? 'time' : 'event'/);
    assert.match(source, /const boundary = targetKind === originalKind/);
    assert.match(source, /!preview\.boundary &&/);
    assert.match(source, /touchcancel.*clearReportSwipe/);
});
