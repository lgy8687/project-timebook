/* global supabase */
(() => {
    if (window.__timebookDemo) return;
    const config = window.TIMEBOOK_SYNC_CONFIG || {};
    const TABLE = 'timebook_snapshots';
    const OWNER_KEY = 'timebook_sync_owner';
    const ACTIVE_KEY = 'timebook_sync_active';
    const REVISION_KEY = 'timebook_sync_revision';
    const client = window.supabase?.createClient && config.url && config.publishableKey
        && !config.publishableKey.includes('PASTE_')
        ? window.supabase.createClient(config.url, config.publishableKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        }) : null;
    let user = null;
    let cloudRevision = null;
    let cloudExists = false;
    let pendingTimer = null;
    let busy = false;
    let conflict = false;

    const el = (id) => document.getElementById(id);
    const setStatus = (text) => { if (el('sync-status')) el('sync-status').textContent = text; };
    const snapshotKey = (key) => /^v9_[A-Za-z0-9_]+$/.test(String(key));
    const allKeys = () => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (snapshotKey(key)) data[key] = localStorage.getItem(key);
        }
        return data;
    };
    const activeForCurrentUser = () => user && localStorage.getItem(ACTIVE_KEY) === user.id
        && localStorage.getItem(OWNER_KEY) === user.id;

    function render() {
        if (!el('sync-auth-form')) return;
        el('sync-auth-form').classList.toggle('hidden', !!user);
        el('sync-connected').classList.toggle('hidden', !user);
        if (user) {
            el('sync-account').textContent = `已登录：${user.email || 'Supabase 用户'}`;
            el('sync-choice').classList.toggle('hidden', activeForCurrentUser());
            el('sync-active-actions').classList.toggle('hidden', !activeForCurrentUser());
        }
    }

    async function loadCloudState() {
        if (!client || !user) return;
        setStatus('正在读取云端状态…');
        const { data, error } = await client.from(TABLE).select('payload, revision, updated_at')
            .eq('user_id', user.id).maybeSingle();
        if (error) {
            setStatus(error.code === '42P01' || error.code === 'PGRST205'
                ? '云端数据表尚未创建' : `读取失败：${error.message}`);
            cloudExists = false;
            return;
        }
        cloudExists = !!data;
        cloudRevision = data ? Number(data.revision) : null;
        if (activeForCurrentUser() && (!data || Number(localStorage.getItem(REVISION_KEY)) !== cloudRevision)) {
            localStorage.removeItem(ACTIVE_KEY);
            conflict = true;
        }
        render();
        if (conflict) setStatus('云端版本与本机上次同步后不同，请选择上传本机或下载云端');
        else if (activeForCurrentUser()) setStatus('已连接，自动同步开启');
        else setStatus(data ? `云端已有数据（版本 ${data.revision}），请选择同步方向` : '云端暂无数据，请上传本机数据');
    }

    async function authenticate(kind) {
        if (!client) {
            setStatus('同步配置未完成：还需要 Supabase publishable key');
            return;
        }
        const email = el('sync-email').value.trim();
        const password = el('sync-password').value;
        if (!email || password.length < 8) {
            setStatus('请输入有效邮箱和至少 8 位密码');
            return;
        }
        setStatus(kind === 'signup' ? '正在注册…' : '正在登录…');
        const response = kind === 'signup'
            ? await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href } })
            : await client.auth.signInWithPassword({ email, password });
        if (response.error) {
            setStatus(`认证失败：${response.error.message}`);
            return;
        }
        if (!response.data.session) {
            setStatus('注册已提交，请先查收验证邮件，再回来登录。');
            return;
        }
        user = response.data.user;
        render();
        await loadCloudState();
    }

    async function pushLocal(initial = false) {
        if (!client || !user || busy) return;
        if (initial) {
            const latest = await client.from(TABLE).select('revision').eq('user_id', user.id).maybeSingle();
            if (latest.error) {
                setStatus(`读取云端版本失败：${latest.error.message}`);
                return;
            }
            cloudExists = !!latest.data;
            cloudRevision = latest.data ? Number(latest.data.revision) : null;
            render();
        }
        if (initial && !window.confirm(cloudExists
            ? '这会用本机全部 v9_ 数据替换该账号当前云端快照。云端版本会被覆盖，是否继续？'
            : '这会把本机全部 v9_ 数据作为该账号的初始云端快照上传，是否继续？')) return;
        busy = true;
        setStatus('正在上传…');
        const payload = allKeys();
        const nextRevision = cloudExists ? cloudRevision + 1 : 1;
        let result;
        if (!cloudExists) {
            result = await client.from(TABLE).insert({ user_id: user.id, revision: 1, payload }).select('revision').maybeSingle();
        } else {
            result = await client.from(TABLE).update({ revision: nextRevision, payload, updated_at: new Date().toISOString() })
                .eq('user_id', user.id).eq('revision', cloudRevision).select('revision').maybeSingle();
        }
        busy = false;
        if (result.error || !result.data) {
            conflict = true;
            localStorage.removeItem(ACTIVE_KEY);
            render();
            setStatus(result.error ? `上传失败：${result.error.message}` : '云端版本已变化，已暂停自动同步；请重新读取后选择方向');
            return;
        }
        cloudRevision = Number(result.data.revision);
        cloudExists = true;
        conflict = false;
        localStorage.setItem(OWNER_KEY, user.id);
        localStorage.setItem(REVISION_KEY, String(cloudRevision));
        localStorage.setItem(ACTIVE_KEY, user.id);
        render();
        setStatus(`同步完成 · 云端版本 ${cloudRevision}`);
        if (JSON.stringify(payload) !== JSON.stringify(allKeys())) queueUpload();
    }

    async function pullCloud(initial = false) {
        if (!client || !user || busy) return;
        const { data, error } = await client.from(TABLE).select('payload, revision')
            .eq('user_id', user.id).maybeSingle();
        if (error || !data) {
            setStatus(error ? `读取失败：${error.message}` : '云端还没有数据，请先上传本机数据');
            return;
        }
        if (initial && !window.confirm('这会先在本机保存一份安全快照，然后用云端数据替换本机全部 v9_ 数据。是否继续？')) return;
        clearTimeout(pendingTimer);
        pendingTimer = null;
        busy = true;
        let safety = null;
        try {
            safety = { savedAt: new Date().toISOString(), data: allKeys() };
            localStorage.setItem('timebook_sync_safety_backup', JSON.stringify(safety));
            Object.keys(safety.data).forEach((key) => localStorage.removeItem(key));
            Object.entries(data.payload || {}).forEach(([key, value]) => {
                if (snapshotKey(key) && typeof value === 'string') localStorage.setItem(key, value);
            });
        } catch (writeError) {
            if (safety) {
                Object.keys(allKeys()).forEach((key) => localStorage.removeItem(key));
                Object.entries(safety.data).forEach(([key, value]) => localStorage.setItem(key, value));
            }
            busy = false;
            setStatus(`本机存储空间不足，下载未完成；本机数据已恢复。${writeError.message}`);
            return;
        }
        cloudRevision = Number(data.revision);
        cloudExists = true;
        conflict = false;
        localStorage.setItem(OWNER_KEY, user.id);
        localStorage.setItem(REVISION_KEY, String(cloudRevision));
        localStorage.setItem(ACTIVE_KEY, user.id);
        location.reload();
    }

    async function syncNow() {
        if (!client || !user || !activeForCurrentUser()) return;
        if (conflict) {
            localStorage.removeItem(ACTIVE_KEY);
            render();
            await loadCloudState();
            return;
        }
        await pushLocal(false);
    }

    function queueUpload() {
        if (busy) return;
        if (!activeForCurrentUser() || conflict) return;
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { if (!busy) pushLocal(false); }, 1200);
    }

    async function signOut() {
        if (!client) return;
        clearTimeout(pendingTimer);
        const { error } = await client.auth.signOut();
        if (error) setStatus(`退出失败：${error.message}`);
        user = null;
        render();
        setStatus('已退出；本机数据保留');
    }

    if (client) {
        client.auth.onAuthStateChange((_event, session) => {
            user = session?.user || null;
            render();
            if (user) setTimeout(loadCloudState, 0);
            else setStatus('尚未连接');
        });
        client.auth.getSession().then(({ data }) => {
            user = data.session?.user || null;
            render();
            if (user) loadCloudState();
        });
    } else {
        setStatus('同步配置未完成：还需要 Supabase publishable key');
    }

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
        originalSetItem.call(this, key, value);
        if (this === localStorage && snapshotKey(key)) queueUpload();
    };
    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
        originalRemoveItem.call(this, key);
        if (this === localStorage && snapshotKey(key)) queueUpload();
    };

    window.timebookSyncSignIn = () => authenticate('signin');
    window.timebookSyncSignUp = () => authenticate('signup');
    window.timebookSyncSignOut = signOut;
    window.timebookSyncPush = (initial) => pushLocal(initial);
    window.timebookSyncPull = (initial) => pullCloud(initial);
    window.timebookSyncNow = syncNow;
    render();
})();
