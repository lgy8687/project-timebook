const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'demo-sandbox.js'), 'utf8');

test('October example has complete non-overlapping days and separate event records', () => {
    const real = new Map([['v9_logs', 'REAL']]);
    const window = { localStorage: real, addEventListener() {} };
    const context = { window, location: { search: '?demo=october2026' }, document: { documentElement: { dataset: {} } }, URLSearchParams, Date, Map, setTimeout };
    vm.runInNewContext(script, context);
    const demo = window.localStorage;
    const logs = JSON.parse(demo.getItem('v9_logs'));
    const events = JSON.parse(demo.getItem('v9_event_records'));
    assert.equal(logs.length, 31 * 9);
    for (let day = 0; day < 31; day++) {
        const rows = logs.slice(day * 9, day * 9 + 9);
        assert.equal(rows[8].endTime - rows[0].startTime, 86400000);
        for (let i = 1; i < rows.length; i++) assert.equal(rows[i - 1].endTime, rows[i].startTime);
    }
    assert.ok(events.length > 31);
    demo.setItem('v9_logs', 'changed');
    demo.clear();
    assert.equal(real.get('v9_logs'), 'REAL');
});

test('example frame has an opaque origin and the page does not load cloud sync', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="demo-mode-frame"[^>]*sandbox="allow-scripts"/);
    assert.doesNotMatch(html, /supabase|sync(?:-config)?\.js|云端同步|timebookSync/i);
});

test('local files use the hosted example while websites keep their own origin', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const source = app.slice(app.indexOf('function demoModeUrl('), app.indexOf('function openDemoMode('));
    const context = { URL };
    vm.runInNewContext(source, context);
    assert.equal(context.demoModeUrl({ protocol: 'file:', href: 'file:///tmp/index.html' }),
        'https://lgy8687.github.io/project-timebook/?demo=october2026');
    assert.equal(context.demoModeUrl({ protocol: 'https:', href: 'https://example.org/app/?old=1#section' }),
        'https://example.org/app/?demo=october2026');
});
