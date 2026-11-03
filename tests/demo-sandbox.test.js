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

test('example frame has an opaque origin and cloud sync is disabled', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const sync = fs.readFileSync(path.join(root, 'sync.js'), 'utf8');
    assert.match(html, /id="demo-mode-frame"[^>]*sandbox="allow-scripts"/);
    assert.match(sync, /if \(window\.__timebookDemo\) return/);
});
