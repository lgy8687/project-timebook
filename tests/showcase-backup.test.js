const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

test('fictional backup is importable, complete through its snapshot, and has no future records', () => {
    const backup = JSON.parse(fs.readFileSync(path.join(root, 'downloads/timebook-fiction-2026-10-11.json'), 'utf8'));
    const context = {}; vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'backup.js'), 'utf8'), context);
    assert.equal(context.parseTimebookBackup(JSON.stringify(backup)).format, 'timebook-backup');
    const logs = JSON.parse(backup.data.v9_logs), events = JSON.parse(backup.data.v9_event_records);
    const start = Date.parse('2026-10-01T00:00:00+08:00'), end = Date.parse(backup.exportedAt);
    assert.equal(logs[0].startTime, start);
    assert.equal(logs.at(-1).endTime, end);
    for (let i = 0; i < logs.length; i++) {
        assert.ok(logs[i].endTime > logs[i].startTime && logs[i].endTime <= end);
        if (i) assert.equal(logs[i].startTime, logs[i - 1].endTime, `gap or overlap at ${i}`);
    }
    const types = JSON.parse(backup.data.v9_event_types);
    assert.ok(events.every(e => e.occurredAt <= end && types.some(type => type.id === e.typeId)));
    assert.ok(new Set(logs.map(log => log.l2)).size >= 8);
});
