const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'backup.js'), 'utf8');

function storage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        get length() { return data.size; },
        key(index) { return [...data.keys()][index] || null; },
        getItem(key) { return data.get(key) ?? null; },
        setItem(key, value) { data.set(key, value); },
        removeItem(key) { data.delete(key); },
        entries() { return Object.fromEntries(data); }
    };
}

function backupFunctions() {
    const context = { Date, Object, JSON, Array, Error };
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

test('exports all app data but no unrelated origin data', () => {
    const context = backupFunctions();
    const sourceStorage = storage({
        v9_logs: '[{"id":"main","startTime":1}]',
        v9_current: '{"id":"live","startTime":2}',
        v9_parallel_history: '[]',
        v9_unlocated_logs: '[{"date":"2026-10-13","durationMs":3600000}]',
        other_app_token: 'private'
    });

    const backup = context.collectTimebookBackup(sourceStorage);
    assert.equal(backup.data.v9_logs, sourceStorage.getItem('v9_logs'));
    assert.equal(backup.data.v9_current, sourceStorage.getItem('v9_current'));
    assert.equal(backup.data.v9_parallel_history, '[]');
    assert.equal(backup.data.v9_unlocated_logs, sourceStorage.getItem('v9_unlocated_logs'));
    assert.equal('other_app_token' in backup.data, false);
});

test('valid backup restores records and removes stale app keys only', () => {
    const context = backupFunctions();
    const sourceStorage = storage({ v9_logs: '[{"id":"main","startTime":1}]', v9_cats: '[]' });
    const backup = context.parseTimebookBackup(JSON.stringify(context.collectTimebookBackup(sourceStorage)));
    const target = storage({ v9_logs: '[]', v9_old_setting: 'old', other_app_token: 'keep' });

    context.restoreTimebookBackup(backup, target);

    assert.equal(target.getItem('v9_logs'), sourceStorage.getItem('v9_logs'));
    assert.equal(target.getItem('v9_cats'), '[]');
    assert.equal(target.getItem('v9_old_setting'), null);
    assert.equal(target.getItem('other_app_token'), 'keep');
});

test('rejects a malformed backup before changing storage', () => {
    const context = backupFunctions();
    const target = storage({ v9_logs: '[{"id":"safe"}]' });
    const malformed = JSON.stringify({ format: 'timebook-backup', version: 1, data: { v9_logs: '{}' } });

    assert.throws(() => context.parseTimebookBackup(malformed));
    assert.equal(target.getItem('v9_logs'), '[{"id":"safe"}]');
});

test('date import stops when the in-progress parallel overlaps the backup', () => {
    const context = backupFunctions();
    const confirms = [];
    const ten = Date.parse('2026-10-14T02:00:00Z');
    const tenThirty = ten + 30 * 60000;
    const running = { id: 'live', l1: '工作', l2: '办公', startTime: ten, parallel: true };
    context.localStorage = storage({
        v9_logs: '[]',
        v9_parallel_history: '[]',
        v9_unlocated_logs: '[]',
        v9_event_records: '[]',
        v9_parallel: JSON.stringify(running)
    });
    context.pendingTimebookBackup = {
        format: 'timebook-backup',
        version: 1,
        data: {
            v9_logs: '[]',
            v9_parallel_history: JSON.stringify([{
                id: 'old', l1: '工作', l2: '开会', parallel: true,
                startTime: tenThirty, endTime: tenThirty + 3600000
            }]),
            v9_unlocated_logs: '[]',
            v9_event_records: '[]'
        }
    };
    const fields = {
        'backup-import-from': { value: '', min: '', max: '' },
        'backup-import-to': { value: '', min: '', max: '' },
        'backup-import-preview': { innerText: '' },
        'backup-import-selected-btn': { disabled: false },
        'backup-import-modal': { classList: { add() {}, remove() {} } }
    };
    context.document = { getElementById(id) { return fields[id]; } };
    context.showConfirm = (title) => { confirms.push(title); };
    context.location = { reload() { throw new Error('reload'); } };
    context.showBackupImportPicker(context.pendingTimebookBackup);
    fields['backup-import-from'].value = '2026-10-14';
    fields['backup-import-to'].value = '2026-10-14';
    const before = context.localStorage.getItem('v9_parallel');
    const originalNow = Date.now;
    Date.now = () => Date.parse('2026-10-14T06:00:00Z');
    try {
        context.importSelectedBackupDates();
    } finally {
        Date.now = originalNow;
    }
    assert.deepEqual(confirms, ['时间段发生冲突']);
    assert.equal(context.localStorage.getItem('v9_parallel'), before);
    assert.equal(context.localStorage.getItem('v9_parallel_history'), '[]');
});

test('accepts a backup containing only untimed supplements', () => {
    const context = backupFunctions();
    const sourceStorage = storage({ v9_unlocated_logs: '[{"date":"2026-10-13","durationMs":3600000}]' });
    const backup = context.parseTimebookBackup(JSON.stringify(context.collectTimebookBackup(sourceStorage)));
    assert.equal(backup.data.v9_unlocated_logs, sourceStorage.getItem('v9_unlocated_logs'));
});
