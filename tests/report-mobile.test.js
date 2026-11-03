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

test('bottom navigation uses locally bundled line icons', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    for (const icon of ['house', 'calendar-days', 'chart-pie', 'circle-ellipsis']) {
        assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'lucide', `${icon}.svg`)));
    }
    const nav = html.match(/<nav id="app-bottom-nav"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav);
    assert.equal((nav.match(/class="nav-line-icon /g) || []).length, 4);
});

test('narrow headers reserve space for the active name and settings share spacing tokens', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'design-system.css'), 'utf8');
    assert.match(css, /#header-main-status #status-light \{ margin-right: var\(--ui-space-1\) !important/);
    assert.match(css, /#header-timer \{ font-size: 16px !important/);
    assert.match(css, /#clock-settings-ui \{ display: grid; gap: var\(--ui-space-2\)/);
    assert.match(css, /\.event-record-editor-card \{ display: grid; gap: var\(--ui-space-3\)/);
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

test('event overview stays concise and framed areas share the same corner token', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'design-system.css'), 'utf8');
    const overview = html.match(/<section class="event-report-block[\s\S]*?<\/section>/)?.[0];
    assert.ok(overview);
    assert.doesNotMatch(overview, /事件统计|事件记录与编辑|管理事件/);
    assert.match(css, /\.event-pattern-card, \.event-pattern-week[\s\S]*?border-radius: var\(--ui-report-surface-radius\)/);
    assert.match(css, /\.unassigned-main-card\.swipe-card\.log-flow-card--main-log\.swiping\s*\{\s*border-radius:\s*0/);
    assert.match(css, /#page-report \.event-overview\s*\{\s*margin:\s*0/);
    assert.match(css, /--ui-space-4:\s*16px/);
});

test('swipe preview does not rerender or detach the active touch target', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'report.js'), 'utf8');
    const preview = source.match(/function makeReportSwipePreview\(direction\) \{([\s\S]*?)\n        reportScrollArea\?\.addEventListener\('touchstart'/)?.[1];
    assert.ok(preview);
    assert.doesNotMatch(preview, /\brender\(\)/);
    assert.match(preview, /clone\.classList\.remove\('hidden'\)/);
    assert.match(preview, /next\.style\.top = `\$\{sourceAnchor\.getBoundingClientRect\(\)\.top - top\}px`/);
    assert.match(source, /const targetKind = direction > 0 \? 'time' : 'event'/);
    assert.match(source, /const boundary = targetKind === originalKind/);
    assert.match(source, /!preview\.boundary &&/);
    assert.match(source, /touchcancel.*clearReportSwipe/);
    assert.match(source, /const reportScrollArea = reportPage\?\.closest\('main'\)/);
    assert.match(source, /!reportPage\.classList\.contains\('active'\)/);
    assert.match(preview, /element\.dataset\.swipeSourceId = element\.id/);
    assert.match(preview, /reportBounds\.left - main\.left/);
    const css = fs.readFileSync(path.join(__dirname, '..', 'design-system.css'), 'utf8');
    assert.match(css, /\[data-swipe-source-id="chart-mode-toggle"\]/);
    assert.match(css, /\[data-swipe-source-id="legend-mode-toggle"\]/);
});
