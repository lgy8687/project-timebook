const TIMEBOOK_BACKUP_FORMAT = 'timebook-backup';
const TIMEBOOK_BACKUP_VERSION = 1;

function collectTimebookBackup(storage = localStorage) {
    const data = {};
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (/^v9_[A-Za-z0-9_]+$/.test(key)) data[key] = storage.getItem(key);
    }
    return {
        format: TIMEBOOK_BACKUP_FORMAT,
        version: TIMEBOOK_BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        data
    };
}

function parseTimebookBackup(text) {
    const backup = JSON.parse(text);
    if (!backup || backup.format !== TIMEBOOK_BACKUP_FORMAT || backup.version !== TIMEBOOK_BACKUP_VERSION
        || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
        throw new Error('不是受支持的时间记录备份文件。');
    }
    const entries = Object.entries(backup.data);
    if (!entries.length || !entries.every(([key, value]) => /^v9_[A-Za-z0-9_]+$/.test(key) && typeof value === 'string')) {
        throw new Error('备份文件中的数据格式不正确。');
    }
    if (!('v9_logs' in backup.data) && !('v9_current' in backup.data) && !('v9_event_records' in backup.data)
        && !('v9_unlocated_logs' in backup.data)) {
        throw new Error('备份文件中没有可恢复的记录。');
    }
    const arrays = ['v9_logs', 'v9_parallel_history', 'v9_unlocated_logs', 'v9_cats', 'v9_event_types', 'v9_event_records'];
    for (const key of arrays) {
        if (key in backup.data && !Array.isArray(JSON.parse(backup.data[key]))) {
            throw new Error(`${key} 不是有效的记录列表。`);
        }
    }
    for (const key of ['v9_current', 'v9_parallel']) {
        if (!(key in backup.data)) continue;
        const value = JSON.parse(backup.data[key]);
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error(`${key} 不是有效的进行中记录。`);
        }
    }
    return backup;
}

function restoreTimebookBackup(backup, storage = localStorage) {
    const previous = collectTimebookBackup(storage).data;
    const restored = { ...backup.data };
    ['v9_dev_theme', 'v9_labelFontSize'].forEach((key) => {
        if (!(key in restored) && previous[key] != null) restored[key] = previous[key];
    });
    const replace = (data) => {
        Object.keys(previous).forEach((key) => storage.removeItem(key));
        Object.entries(data).forEach(([key, value]) => storage.setItem(key, value));
    };
    try {
        replace(restored);
    } catch (error) {
        Object.keys(backup.data).forEach((key) => storage.removeItem(key));
        Object.entries(previous).forEach(([key, value]) => storage.setItem(key, value));
        throw error;
    }
}

let pendingTimebookBackup = null;

function backupDateFromMs(ms) {
    return new Date(Number(ms) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function backupArray(backup, key) {
    return JSON.parse(backup.data[key] || '[]');
}

function backupRecordDate(record, key) {
    if (key === 'v9_unlocated_logs') return record.date || null;
    const timestamp = key === 'v9_event_records' ? record.occurredAt : record.startTime;
    return Number.isFinite(Number(timestamp)) ? backupDateFromMs(timestamp) : null;
}

function getBackupDateRange(backup) {
    const dates = [];
    ['v9_logs', 'v9_parallel_history', 'v9_unlocated_logs', 'v9_event_records'].forEach((key) => {
        backupArray(backup, key).forEach((record) => {
            const date = backupRecordDate(record, key);
            if (date) dates.push(date);
        });
    });
    if (!dates.length) return null;
    dates.sort();
    return { from: dates[0], to: dates[dates.length - 1] };
}

function getBackupDateSelection(backup, from, to) {
    const logs = backupArray(backup, 'v9_logs');
    const parallelHistory = backupArray(backup, 'v9_parallel_history');
    const timeRows = logs.map((record) => ({ record, key: 'v9_logs' }))
        .concat(parallelHistory.map((record) => ({ record, key: 'v9_parallel_history' })));
    const selected = new Set(timeRows.filter(({ record, key }) => {
        const date = backupRecordDate(record, key);
        return date && date >= from && date <= to;
    }).map(({ record }) => record));
    const selectedLogs = logs.filter((record) => selected.has(record));
    const selectedParallelHistory = parallelHistory.filter((record) => selected.has(record));
    const selectedUntimed = backupArray(backup, 'v9_unlocated_logs')
        .filter((record) => record.date >= from && record.date <= to);
    const selectedEvents = backupArray(backup, 'v9_event_records')
        .filter((record) => {
            const date = backupRecordDate(record, 'v9_event_records');
            return date && date >= from && date <= to;
        });
    const dates = new Set();
    selectedLogs.forEach((record) => dates.add(backupRecordDate(record, 'v9_logs')));
    selectedParallelHistory.forEach((record) => dates.add(backupRecordDate(record, 'v9_parallel_history')));
    selectedUntimed.forEach((record) => dates.add(record.date));
    selectedEvents.forEach((record) => dates.add(backupRecordDate(record, 'v9_event_records')));
    dates.delete(null);
    return { logs: selectedLogs, parallelHistory: selectedParallelHistory, unlocated: selectedUntimed, events: selectedEvents, dates };
}

function showBackupImportPicker(backup) {
    const range = getBackupDateRange(backup);
    if (!range) {
        showConfirm('没有可按日期导入的记录', '这份备份里没有带日期的流水或事件。', '知道了', () => {});
        return;
    }
    pendingTimebookBackup = backup;
    const from = document.getElementById('backup-import-from');
    const to = document.getElementById('backup-import-to');
    from.min = to.min = range.from;
    from.max = to.max = range.to;
    from.value = range.to;
    to.value = range.to;
    updateBackupImportPreview();
    document.getElementById('backup-import-modal').classList.remove('hidden');
}

function closeBackupImportPicker() {
    document.getElementById('backup-import-modal').classList.add('hidden');
    pendingTimebookBackup = null;
}

function updateBackupImportPreview() {
    if (!pendingTimebookBackup) return;
    const from = document.getElementById('backup-import-from').value;
    const to = document.getElementById('backup-import-to').value;
    const preview = document.getElementById('backup-import-preview');
    const button = document.getElementById('backup-import-selected-btn');
    if (!from || !to || from > to) {
        preview.innerText = '请选择有效的起止日期。';
        button.disabled = true;
        return;
    }
    const selected = getBackupDateSelection(pendingTimebookBackup, from, to);
    const logCount = selected.logs.length + selected.parallelHistory.length;
    const count = logCount + selected.unlocated.length + selected.events.length;
    preview.innerText = count
        ? `将导入 ${selected.dates.size} 天：${logCount} 条流水、${selected.unlocated.length} 条未指定时长、${selected.events.length} 条事件。`
        : '所选日期内没有可导入的记录。';
    button.disabled = count === 0;
}

function readStoredArray(storage, key) {
    try {
        const value = JSON.parse(storage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
}

function backupRecordEndMs(record) {
    if (record.endTime != null && Number.isFinite(Number(record.endTime))) return Number(record.endTime);
    const duration = Number(record.duration);
    return Number(record.startTime) + (Number.isFinite(duration) ? duration * 60000 : 0);
}

function importSelectedBackupDates() {
    if (!pendingTimebookBackup) return;
    const from = document.getElementById('backup-import-from').value;
    const to = document.getElementById('backup-import-to').value;
    if (!from || !to || from > to) return;
    const selection = getBackupDateSelection(pendingTimebookBackup, from, to);
    if (!selection.dates.size) return;
    const storage = localStorage;
    const existingLogs = readStoredArray(storage, 'v9_logs');
    const existingParallel = readStoredArray(storage, 'v9_parallel_history');
    const existingUntimed = readStoredArray(storage, 'v9_unlocated_logs');
    const existingEvents = readStoredArray(storage, 'v9_event_records');
    const active = (() => { try { return JSON.parse(storage.getItem('v9_current') || 'null'); } catch (_) { return null; } })();
    const inSelectedDates = (record, key) => selection.dates.has(backupRecordDate(record, key));
    const replacedLogs = existingLogs.filter((record) => inSelectedDates(record, 'v9_logs'));
    const replacedParallel = existingParallel.filter((record) => inSelectedDates(record, 'v9_parallel_history'));
    const replacedUntimed = existingUntimed.filter((record) => inSelectedDates(record, 'v9_unlocated_logs'));
    const replacedEvents = existingEvents.filter((record) => inSelectedDates(record, 'v9_event_records'));
    const keepLogs = existingLogs.filter((record) => !inSelectedDates(record, 'v9_logs'));
    const keepParallel = existingParallel.filter((record) => !inSelectedDates(record, 'v9_parallel_history'));
    const keepUntimed = existingUntimed.filter((record) => !inSelectedDates(record, 'v9_unlocated_logs'));
    const keepEvents = existingEvents.filter((record) => !inSelectedDates(record, 'v9_event_records'));
    const unselectedMain = keepLogs.filter((record) => !record.parallel && !record.sceneActivity)
        .concat(active ? [{ ...active, endTime: Date.now() }] : []);
    const overlap = selection.logs.filter((incoming) => !incoming.parallel && !incoming.sceneActivity)
        .find((incoming) => unselectedMain.some((local) => Number(incoming.startTime) < backupRecordEndMs(local)
            && backupRecordEndMs(incoming) > Number(local.startTime)));
    if (overlap) {
        closeBackupImportPicker();
        showConfirm('时间段发生冲突', `备份中的「${overlap.l2 || overlap.l1 || '主线'}」与所选日期外保留的主线时间重叠。为保证时间不冲突，本次导入已停止。`, '知道了', () => {});
        return;
    }
    const activeParallel = (() => { try { return JSON.parse(storage.getItem('v9_parallel') || 'null'); } catch (_) { return null; } })();
    const runningParallel = activeParallel && activeParallel.startTime != null
        ? [{ ...activeParallel, endTime: Date.now() }]
        : [];
    const incomingParallel = selection.parallelHistory.concat(selection.logs.filter((record) => record.parallel));
    const parallelOverlap = incomingParallel.find((incoming) => runningParallel.some((local) =>
        Number(incoming.startTime) < backupRecordEndMs(local) && backupRecordEndMs(incoming) > Number(local.startTime)));
    if (parallelOverlap) {
        closeBackupImportPicker();
        showConfirm('时间段发生冲突', `备份中的「${parallelOverlap.l2 || parallelOverlap.l1 || '并行'}」与本机正在进行的并行时间重叠。为保证时间不冲突，本次导入已停止。`, '知道了', () => {});
        return;
    }
    const replaceCount = replacedLogs.length + replacedParallel.length + replacedUntimed.length + replacedEvents.length;
    const importCount = selection.logs.length + selection.parallelHistory.length + selection.unlocated.length + selection.events.length;
    const message = replaceCount
        ? `备份所选日期与本机有 ${replaceCount} 条记录重叠。继续后将替换这些日期的记录；其他日期、进行中的任务和本机设置会保留。`
        : `将导入 ${importCount} 条记录。现有日期不受影响，本机设置和进行中的任务会保留。`;
    closeBackupImportPicker();
    showConfirm(replaceCount ? '确认替换所选日期' : '确认按日期导入', message,
        replaceCount ? '替换并导入' : '导入', (ok) => {
            if (!ok) return;
            try {
                const nextLogs = keepLogs.concat(selection.logs).sort((a, b) => Number(b.startTime) - Number(a.startTime));
                const nextParallel = keepParallel.concat(selection.parallelHistory);
                const nextUntimed = keepUntimed.concat(selection.unlocated);
                const nextEvents = keepEvents.concat(selection.events);
                const updates = {
                    v9_logs: JSON.stringify(nextLogs),
                    v9_parallel_history: JSON.stringify(nextParallel),
                    v9_unlocated_logs: JSON.stringify(nextUntimed),
                    v9_event_records: JSON.stringify(nextEvents)
                };
                const before = Object.fromEntries(Object.keys(updates).map((key) => [key, storage.getItem(key)]));
                try {
                    Object.entries(updates).forEach(([key, value]) => storage.setItem(key, value));
                } catch (writeError) {
                    Object.entries(before).forEach(([key, value]) => {
                        if (value == null) storage.removeItem(key);
                        else storage.setItem(key, value);
                    });
                    throw writeError;
                }
                location.reload();
            } catch (_) {
                showConfirm('导入失败', '存储空间可能不足，导入未能完成。请重新导出当前备份后再试。', '知道了', () => {});
            }
        }, '取消');
}

function restorePendingBackupWhole() {
    if (!pendingTimebookBackup) return;
    const backup = pendingTimebookBackup;
    closeBackupImportPicker();
    const count = backupArray(backup, 'v9_logs').length;
    showConfirm('完整恢复备份', `备份中有 ${count} 条流水记录。完整恢复会替换本机全部记录和设置，请确认已另存当前备份。`, '继续', (ok) => {
        if (!ok) return;
        showConfirm('最后确认', '本机记录将被备份内容替换。外观设置在备份缺少时会保留。', '完整恢复', (confirmed) => {
            if (!confirmed) return;
            try {
                restoreTimebookBackup(backup);
                location.reload();
            } catch (_) {
                showConfirm('恢复失败', '存储空间可能不足，原有记录已尝试保留。', '知道了', () => {});
            }
        }, '取消');
    }, '取消');
}

function resetTimebookStorage(kind, storage = localStorage, now = Date.now()) {
    if (kind !== 'records' && kind !== 'all') throw new Error('未知的清空范围。');
    const recordKeys = new Set([
        'v9_logs', 'v9_current', 'v9_parallel', 'v9_parallel_history',
        'v9_event_records', 'v9_unlocated_logs', 'v9_recent_picks', 'v9_input_aliases', 'v9_tracking_start'
    ]);
    const keys = [];
    for (let i = 0; i < storage.length; i++) keys.push(storage.key(i));
    keys.forEach((key) => {
        if (kind === 'all' ? /^v9_[A-Za-z0-9_]+$/.test(key) : recordKeys.has(key)) storage.removeItem(key);
    });
    if (kind === 'records') storage.setItem('v9_tracking_start', String(now));
}

function requestTimebookReset(kind) {
    const all = kind === 'all';
    if (!all && kind !== 'records') return;
    const title = all ? '全部恢复初始数据' : '清空记录';
    const message = all
        ? '这会清空本机所有时间线、事件、类别、场景和设置，恢复首次使用状态。请先导出备份。'
        : '这会清空本机时间线和事件记录，保留类别、场景、快捷入口和设置。请先导出备份。';
    showConfirm(title, message, '删除', (ok) => {
        if (!ok) return;
        showConfirm('最后确认', all
            ? '所有记录、分类和设置都将从这台设备删除，无法撤销。确认已经导出备份后再继续。'
            : '所有时间线和事件记录都将从这台设备删除，无法撤销；分类和设置会保留。', '确认删除', (confirmed) => {
            if (!confirmed) return;
            resetTimebookStorage(kind);
            location.reload();
        }, '保留数据');
    }, '取消');
}

function exportTimebookBackup() {
    const backup = collectTimebookBackup();
    const json = JSON.stringify(backup, null, 2);
    const name = `timebook-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (window.TimeBookAndroid?.saveBackup) {
        window.TimeBookAndroid.saveBackup(name, json);
        return;
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function importTimebookBackup(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
        showConfirm('文件太大', '备份文件超过 50 MB，请检查是否选错文件。', '知道了', () => {});
        return;
    }
    let backup;
    try {
        backup = parseTimebookBackup(await file.text());
    } catch (error) {
        showConfirm('无法读取备份', error.message || '请选择本应用导出的 JSON 备份。', '知道了', () => {});
        return;
    }
    showBackupImportPicker(backup);
}
