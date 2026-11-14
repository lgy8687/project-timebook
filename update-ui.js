const UPDATE_RING_C = 213.6;
let updateAutoClose = null;

function updateEl(id) { return document.getElementById(id); }

function closeUpdateOverlay() {
    if (updateAutoClose) { clearTimeout(updateAutoClose); updateAutoClose = null; }
    updateEl('update-overlay').classList.add('hidden');
}

function startTimeBookUpdate() {
    if (window.TimeBookUpdate) window.TimeBookUpdate.startUpdate();
}

function setUpdateVisual(mode) {
    updateEl('update-spinner').classList.toggle('hidden', mode !== 'spin');
    updateEl('update-ringwrap').classList.toggle('hidden', mode !== 'ring');
    const icon = updateEl('update-icon');
    icon.classList.toggle('hidden', mode !== 'ok' && mode !== 'err' && mode !== 'new');
    icon.classList.toggle('update-icon--ok', mode === 'ok');
    icon.classList.toggle('update-icon--err', mode === 'err');
    icon.classList.toggle('update-icon--new', mode === 'new');
    icon.textContent = mode === 'ok' ? '✓' : mode === 'err' ? '!' : mode === 'new' ? '↑' : '';
}

function setUpdateButtons(cancel, confirm, close) {
    updateEl('update-cancel').classList.toggle('hidden', !cancel);
    updateEl('update-confirm').classList.toggle('hidden', !confirm);
    updateEl('update-close').classList.toggle('hidden', !close);
}

window.__tbUpdateEvent = function (ev) {
    if (updateAutoClose) { clearTimeout(updateAutoClose); updateAutoClose = null; }
    updateEl('update-overlay').classList.remove('hidden');
    const title = updateEl('update-title');
    const msg = updateEl('update-message');
    switch (ev.type) {
        case 'checking':
            setUpdateVisual('spin');
            title.textContent = '检查更新';
            msg.textContent = '正在连接更新源…';
            setUpdateButtons(true, false, false);
            break;
        case 'available':
            setUpdateVisual('new');
            title.textContent = '发现新版本 ' + (ev.versionName || '');
            msg.textContent = ev.notes || '';
            setUpdateButtons(true, true, false);
            break;
        case 'downloading': {
            const p = typeof ev.percent === 'number' ? ev.percent : -1;
            if (p < 0) {
                setUpdateVisual('spin');
            } else {
                setUpdateVisual('ring');
                updateEl('update-ring-fill').style.strokeDashoffset = String(UPDATE_RING_C * (1 - p / 100));
                updateEl('update-percent').textContent = p + '%';
            }
            title.textContent = '正在下载更新';
            msg.textContent = '请保持网络畅通…';
            setUpdateButtons(false, false, false);
            break;
        }
        case 'installing':
            setUpdateVisual('spin');
            title.textContent = '即将安装';
            msg.textContent = '下载完成，正在调起系统安装…';
            setUpdateButtons(false, false, false);
            break;
        case 'latest':
            setUpdateVisual('ok');
            title.textContent = '已是最新版本';
            msg.textContent = '当前版本无需更新。';
            setUpdateButtons(false, false, true);
            updateAutoClose = setTimeout(closeUpdateOverlay, 1600);
            break;
        case 'needPermission':
            setUpdateVisual('err');
            title.textContent = '需要安装权限';
            msg.textContent = '请在设置中允许本应用「安装未知应用」，返回后重新点检查更新。';
            setUpdateButtons(false, false, true);
            break;
        case 'error':
            setUpdateVisual('err');
            title.textContent = '更新失败';
            msg.textContent = ev.message || '请重试';
            setUpdateButtons(false, false, true);
            break;
    }
};