(() => {
    const STORAGE_KEY = 'timebook_dev_inspector_enabled';
    const blocks = [
        ['B01', '主线快捷入口', '#main-shortcut-section'],
        ['B02', '并行快捷入口', '#parallel-section'],
        ['B03', '时钟面板', '#clock-stage'],
        ['B04', '已结束主线流水卡片', '.log-flow-card--main-log:not(.log-flow-card--unassigned-main)', null, { repeatable: true }],
        ['B05', '已结束并行流水卡片', '.log-flow-card--parallel-log', null, { repeatable: true }],
        ['B06', '日历月视图', '#calendar-month-block'],
        ['B07', '日历当日摘要', '#calendar-day-summary'],
        ['B09', '已结束主线修改界面', '#edit-modal[data-dev-address-block="B09"] #edit-modal-card'],
        ['B10', '流水时间输入区', '#edit-time-range'],
        ['B11', '补录时段与方式选择界面', '#calendar-backfill-modal[data-dev-address-block="B11"] #calendar-backfill-card', 'C04'],
        ['B12', '指定时段补录表单（可更换归属）', '#calendar-backfill-modal[data-dev-address-block="B12"] #calendar-backfill-card', 'C25'],
        ['B13', '记录活动分类选择界面', '#drawer[data-dev-address-block="B13"] #drawer-card'],
        ['B14', '主线摘要', '#summary-block-main', 'C01'],
        ['B15', '并行摘要', '#summary-block-parallel', 'C01'],
        ['B16', '事件统计', '#event-report-block', 'C01'],
        ['B17', '主线时间结构', '#report-structure-card[data-dev-address-block="B17"]', 'C01'],
        ['B18', '日报 00:00–12:00 时间轴', '#timeline-card-a[data-dev-address-block="B18"]', 'C23'],
        ['B19', '设置入口', '#config-grid-card'],
        ['B21', '开始场景选择界面', '#scene-popover[data-dev-address-block="B21"] #scene-popover-card'],
        ['B22', '事件类型选择界面', '#event-modal[data-dev-address-block="B22"] #event-modal-card'],
        ['B30', '底部导航', '#app-bottom-nav', 'C07'],
        ['B31', '当前状态卡片', '#header-main-status'],
        ['B32', '场景切换键', '#scene-entry-btn', 'C21'],
        ['B33', '报表周期与日期', '#report-period-toolbar', 'C16'],
        ['B34', '随手记', '#free-note-module'],
        ['B35', '时钟设置面板', '#config-panel-clock', 'C22'],
        ['B36', '报表摘要设置面板', '#config-panel-report', 'C22'],
        ['B37', '分类管理设置面板', '#config-panel-cats', 'C22'],
        ['B38', '场景管理设置面板', '#config-panel-scene', 'C22'],
        ['B39', '事件管理设置面板', '#config-panel-event', 'C22'],
        ['B40', '记录模式设置面板', '#config-panel-mode', 'C22'],
        ['B41', '数据管理设置面板', '#config-panel-data', 'C22'],
        ['B42', '日报 12:00–24:00 时间轴', '#timeline-card-b[data-dev-address-block="B42"]', 'C23'],
        ['B45', '周报、月报、年报时间构成图', '#timeline-card-a[data-dev-address-block="B45"]', 'C24'],
        ['B46', '未指定时长补录表单（可更换归属）', '#calendar-backfill-modal[data-dev-address-block="B46"] #calendar-backfill-card', 'C26'],
        ['B47', '事件次数补录表单', '#calendar-backfill-modal[data-dev-address-block="B47"] #calendar-backfill-card', 'C27'],
        ['B48', '正在进行的主线流水卡片', '.log-flow-card--main-live:not(.log-flow-card--scene)', null, { repeatable: true }],
        ['B49', '正在进行的并行流水卡片', '.log-flow-card--parallel-live', null, { repeatable: true }],
        ['B50', '未分配时间流水卡片', '.log-flow-card--unassigned-main:not(.unassigned-main-card--live)', null, { repeatable: true }],
        ['B51', '正在进行的主线修改界面', '#edit-modal[data-dev-address-block="B51"] #edit-modal-card'],
        ['B52', '正在进行且可接续的主线修改界面', '#edit-modal[data-dev-address-block="B52"] #edit-modal-card'],
        ['B53', '并行记录修改界面', '#edit-modal[data-dev-address-block="B53"] #edit-modal-card'],
        ['B54', '未分配时间修改界面', '#edit-modal[data-dev-address-block="B54"] #edit-modal-card'],
        ['B55', '选择补录归属时段界面', '#calendar-backfill-modal[data-dev-address-block="B55"] #calendar-backfill-card', 'C04'],
        ['B56', '补录选择界面（固定归属）', '#calendar-backfill-modal[data-dev-address-block="B56"] #calendar-backfill-card', 'C04'],
        ['B57', '补录选择界面（仅事件次数）', '#calendar-backfill-modal[data-dev-address-block="B57"] #calendar-backfill-card', 'C04'],
        ['B58', '指定时段补录表单（固定归属）', '#calendar-backfill-modal[data-dev-address-block="B58"] #calendar-backfill-card', 'C25'],
        ['B59', '指定时段补录表单（无归属时段）', '#calendar-backfill-modal[data-dev-address-block="B59"] #calendar-backfill-card', 'C25'],
        ['B60', '未指定时长补录表单（固定归属）', '#calendar-backfill-modal[data-dev-address-block="B60"] #calendar-backfill-card', 'C26'],
        ['B61', '未指定时长补录表单（无归属时段）', '#calendar-backfill-modal[data-dev-address-block="B61"] #calendar-backfill-card', 'C26'],
        ['B62', '主线快捷项选择界面', '#drawer[data-dev-address-block="B62"] #drawer-card'],
        ['B63', '并行快捷项选择界面', '#drawer[data-dev-address-block="B63"] #drawer-card'],
        ['B64', '编辑快捷项分类界面', '#drawer[data-dev-address-block="B64"] #drawer-card'],
        ['B65', '修改记录分类选择界面', '#drawer[data-dev-address-block="B65"] #drawer-card'],
        ['B66', '未分类记录归档界面', '#drawer[data-dev-address-block="B66"] #drawer-card'],
        ['B67', '报表摘要类别选择界面', '#drawer[data-dev-address-block="B67"] #drawer-card'],
        ['B68', '补录活动选择界面', '#drawer[data-dev-address-block="B68"] #drawer-card'],
        ['B69', '补录并行活动选择界面', '#drawer[data-dev-address-block="B69"] #drawer-card'],
        ['B70', '补录场景活动选择界面', '#drawer[data-dev-address-block="B70"] #drawer-card'],
        ['B71', '切割时间活动选择界面', '#drawer[data-dev-address-block="B71"] #drawer-card'],
        ['B72', '当前场景操作界面', '#scene-popover[data-dev-address-block="B72"] #scene-popover-card'],
        ['B73', '切换场景选择界面', '#scene-popover[data-dev-address-block="B73"] #scene-popover-card'],
        ['B74', '结束场景后选择主线界面', '#scene-popover[data-dev-address-block="B74"] #scene-popover-card'],
        ['B77', '事件日期时间编辑界面', '#event-modal[data-dev-address-block="B77"] #event-modal-card'],
        ['B78', '正在进行的并行记录修改界面', '#edit-modal[data-dev-address-block="B78"] #edit-modal-card'],
        ['B79', '结转主线记录修改界面', '#edit-modal[data-dev-address-block="B79"] #edit-modal-card'],
        ['B80', '正在进行的场景主线卡片', '.log-flow-card--main-live.log-flow-card--scene', null, { repeatable: true }],
        ['B81', '已分配主线删除归并方向界面', '#merge-direction-modal[data-dev-address-block="B81"] #merge-direction-card', 'C28'],
        ['B82', '未分配时段删除归并方向界面', '#merge-direction-modal[data-dev-address-block="B82"] #merge-direction-card', 'C28'],
        ['B83', '流水删除确认及清空界面', '#confirm-modal[data-dev-address-block="B83"] #confirm-modal-card', 'C29'],
        ['B85', '正在进行的未分配主线', '.unassigned-live-wrap', null, { repeatable: true }],
        ['B86', '事件记录列表', '#event-center-history'],
        ['B87', '事件统计详情', '#event-center-stats'],
        ['B88', '事件类型管理', '#event-center-manage'],
        ['B89', '事件记录编辑', '#event-record-editor-card'],
        ['B90', '仅日期的事件补录', '#event-modal[data-dev-address-block="B90"] #event-modal-card'],
        ['B91', '事件确认和补录选择', '#event-modal[data-dev-address-block="B91"] #event-modal-card'],
        ['B92', '并行时长排行', '#report-structure-card[data-dev-address-block="B92"]', 'C01'],
        ['B101', '事件首页', '#page-event-home[data-dev-address-block="B101"]'],
        ['B94', '新建事件方式选择', '#event-home-create-card'],
        ['B95', '数据模式入口', '#demo-entry-bar'],
        ['B96', '示例模式状态栏', '#demo-mode-header'],
        ['B97', '事件趋势', '#event-pattern-block'],
        ['B98', '设计模块', '#page-design'],
        ['B99', '单事件记录', '#event-detail-block[data-dev-address-block="B99"]'],
        ['B100', '单事件统计', '#event-detail-block[data-dev-address-block="B100"]']
    ];
    // A Z address names a submodule prototype; repeated instances share one badge and contract.
    const submodules = [
        ['Z01-1', '主线快捷键', '#home-shortcuts .keycap--main', 'C09'],
        ['Z01-2', '添加主线快捷键', '#home-shortcuts .shortcut-add-btn--main', 'C10'],
        ['Z02-1', '并行快捷键', '#parallel-shortcuts .keycap--parallel-slot', 'C11'],
        ['Z02-2', '添加并行快捷键', '#parallel-shortcuts .shortcut-add-btn--parallel', 'C12'],
        ['Z06-1', '日历日期格', '#page-calendar .flow-calendar-day', 'C13'],
        ['Z06-2', '日历月份切换键', '#page-calendar .flow-calendar-nav', 'C14'],
        ['Z06-3', '日历月份选择键', '#page-calendar .flow-calendar-title-btn', 'C15'],
        ['Z11-2', '补录方式中的事件次数入口', '#calendar-backfill-event-choice', 'C06'],
        ['Z11-4', '补录指定时段入口', '#calendar-backfill-interval-choice', 'C06'],
        ['Z11-5', '补录未指定时段入口', '#calendar-backfill-untimed-choice', 'C06'],
        ['Z55-1', '补录归属时段选项', '#calendar-backfill-target-picker .calendar-backfill-target-choice', 'C05'],
        ['Z55-2', '时段选择列表中的事件次数入口', '#calendar-backfill-target-picker .calendar-backfill-event-choice', 'C19'],
        ['Z14-1', '主线摘要切换', '#summary-block-main .summary-view-toggle', 'C02'],
        ['Z15-1', '并行摘要切换', '#summary-block-parallel .summary-view-toggle', 'C02'],
        ['Z16-1', '事件统计切换', '#event-report-block .chart-mode-toggle', 'C02'],
        ['Z17-1', '主线结构切换', '#report-structure-card[data-dev-address-block="B17"] .chart-mode-toggle', 'C02'],
        ['Z92-1', '并行结构切换', '#report-structure-card[data-dev-address-block="B92"] .chart-mode-toggle', 'C02'],
        ['Z17-2', '活动分类与明细切换', '#legend-mode-toggle', 'C02'],
        ['Z30-1', '底部导航键', '#nav-record, #nav-calendar, #nav-report, #nav-mine', 'C08'],
        ['Z33-1', '报表周期切换', '#seg-period', 'C02'],
        ['Z33-2', '报表日期导航', '#report-period-nav', 'C03'],
        ['Z33-3', '时间与事件切换', '#report-period-toolbar .report-kind-tabs', 'C02'],
        ['Z34-1', '随手记旁的事件入口', '#free-note-event-btn'],
        ['Z85-1', '未分配主线的事件入口', '.unassigned-live-event-btn'],
        ['Z95-1', '打开示例模式', '#demo-entry-button'],
        ['Z96-1', '返回真实数据', '#demo-exit-button']
    ];
    const floatingBadges = new Map();
    let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
    let scheduled = false;
    let toastTimer;

    function scanSubmodules() {
        const activeModal = document.querySelector('#calendar-backfill-modal:not(.hidden)');
        for (const [code, label, selector, contract] of submodules) {
            const address = contract ? `${code}/${contract}` : code;
            const parentBlock = `B${code.match(/^Z(\d+)-/)?.[1]}`;
            let entry = floatingBadges.get(code);
            if (activeModal && activeModal.dataset.devAddressBlock !== parentBlock) {
                if (entry) entry.badge.hidden = true;
                continue;
            }
            const instances = [...document.querySelectorAll(selector)];
            instances.forEach(element => { element.dataset.devAddress = address; });
            const visible = element => {
                if (activeModal && !activeModal.contains(element)) return false;
                const rect = element.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
            };
            const representative = instances.find(element => element.classList.contains('is-selected') && visible(element))
                || instances.find(visible);
            if (!representative) {
                if (entry) {
                    entry.element.classList.remove('dev-inspector-target');
                    entry.badge.hidden = true;
                }
                continue;
            }
            if (!entry) {
                const badge = document.createElement('button');
                badge.type = 'button';
                badge.className = `dev-inspector-badge dev-inspector-badge--detail dev-inspector-badge--${code.startsWith('B') ? 'block' : 'submodule'}`;
                badge.textContent = address;
                badge.title = `${address} · ${label}（点击复制）`;
                badge.setAttribute('aria-label', `复制${code.startsWith('B') ? '区块' : '模块'}编号 ${address}，${label}`);
                badge.addEventListener('pointerdown', event => event.stopPropagation());
                badge.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    copyCode(address);
                });
                document.body.appendChild(badge);
                entry = { element: representative, badge };
                floatingBadges.set(code, entry);
            }
            if (entry.element !== representative) entry.element.classList.remove('dev-inspector-target');
            entry.element = representative;
            representative.classList.add('dev-inspector-target');
            const rect = representative.getBoundingClientRect();
            entry.badge.hidden = false;
            if (code.startsWith('B')) {
                entry.badge.style.left = `${Math.max(0, Math.min(window.innerWidth - entry.badge.offsetWidth, rect.right - entry.badge.offsetWidth - 6))}px`;
                entry.badge.style.top = `${Math.max(0, rect.top - 10)}px`;
            } else {
                entry.badge.style.left = `${Math.max(0, Math.min(window.innerWidth - entry.badge.offsetWidth, rect.left + 6))}px`;
                entry.badge.style.top = `${Math.max(0, Math.min(window.innerHeight - entry.badge.offsetHeight, rect.bottom - 12))}px`;
            }
        }
    }

    function showToast(message) {
        let toast = document.getElementById('dev-inspector-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'dev-inspector-toast';
            toast.className = 'dev-inspector-toast';
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
    }

    async function copyCode(code) {
        try {
            await navigator.clipboard.writeText(code);
        } catch (_) {
            const input = document.createElement('textarea');
            input.value = code;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.select();
            const copied = document.execCommand('copy');
            input.remove();
            if (!copied) {
                showToast(`复制失败：${code}`);
                return;
            }
        }
        showToast(`已复制 ${code}`);
    }

    function scan() {
        scheduled = false;
        if (!enabled) return;
        document.querySelectorAll('[data-dev-block-code]').forEach((element) => {
            const addressOwner = element.closest('[data-dev-address-block]');
            const activeCode = addressOwner?.dataset.devAddressBlock
                || (element.dataset.devAddressKind === 'timeline' ? '' : element.dataset.devBlockCode);
            if (element.dataset.devBlockCode === activeCode) return;
            element.querySelectorAll(':scope > .dev-inspector-badge--block').forEach((badge) => badge.remove());
            element.classList.remove('dev-inspector-target');
            delete element.dataset.devBlockCode;
        });
        for (const [code, label, selector, contract, options = {}] of blocks) {
            const targets = [...document.querySelectorAll(selector)];
            if (targets.length > 1 && !options.repeatable) {
                console.error(`[dev-inspector] ${code} must identify one functional block; selector matched ${targets.length}: ${selector}`);
                continue;
            }
            targets.forEach((element) => {
                if ([...element.children].some(child => child.classList.contains('dev-inspector-badge') && child.dataset.code === code)) return;
                element.classList.add('dev-inspector-target');
                element.dataset.devBlockCode = code;
                const badge = document.createElement('button');
                badge.type = 'button';
                badge.className = 'dev-inspector-badge dev-inspector-badge--block';
                badge.dataset.code = code;
                const address = contract ? `${code}/${contract}` : code;
                badge.textContent = address;
                badge.title = `${address} · ${label}（点击复制）`;
                badge.setAttribute('aria-label', `复制区块编号 ${address}，${label}`);
                badge.addEventListener('pointerdown', (event) => event.stopPropagation());
                badge.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    copyCode(address);
                });
                element.appendChild(badge);
            });
        }
        scanSubmodules();
        scanTypography();
    }

    function scanTypography() {
        const rootStyle = getComputedStyle(document.documentElement);
        const typeLevels = new Map(UI_TYPE_LEVEL_TOKENS.map(([level, token]) => [Number.parseFloat(rootStyle.getPropertyValue(token)), level]));
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const elements = new Set();
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.textContent.trim()) continue;
            const element = node.parentElement;
            if (!element || element.closest('script, style, .dev-inspector-badge, #dev-inspector-toast')) continue;
            elements.add(element);
        }
        document.querySelectorAll('input, textarea, select').forEach(element => elements.add(element));
        for (const element of elements) {
            const pixels = Number.parseFloat(getComputedStyle(element).fontSize);
            const level = typeLevels.get(pixels) || '待归档';
            const size = `${pixels}px`;
            if (element.dataset.devTypeLevel !== level) element.dataset.devTypeLevel = level;
            if (element.dataset.devTypeSize !== size) element.dataset.devTypeSize = size;
        }
    }

    function scheduleScan() {
        if (enabled && !scheduled) {
            scheduled = true;
            requestAnimationFrame(scan);
        }
    }

    function setEnabled(value) {
        enabled = !!value;
        localStorage.setItem(STORAGE_KEY, String(enabled));
        document.body.classList.toggle('dev-inspector-on', enabled);
        const toggle = document.getElementById('dev-inspector-toggle');
        if (toggle) toggle.checked = enabled;
        const shortcut = document.getElementById('dev-inspector-shortcut');
        if (shortcut) {
            shortcut.setAttribute('aria-pressed', String(enabled));
            shortcut.title = enabled ? '关闭开发者模式' : '开启开发者模式';
        }
        if (enabled) scheduleScan();
        else {
            document.querySelectorAll('.dev-inspector-badge').forEach((badge) => badge.remove());
            for (const { badge } of floatingBadges.values()) badge.remove();
            floatingBadges.clear();
            document.querySelectorAll('.dev-inspector-target').forEach((element) => element.classList.remove('dev-inspector-target'));
            document.querySelectorAll('[data-dev-address]').forEach((element) => delete element.dataset.devAddress);
            document.querySelectorAll('[data-dev-block-code]').forEach((element) => delete element.dataset.devBlockCode);
            document.querySelectorAll('[data-dev-type-level]').forEach((element) => {
                delete element.dataset.devTypeLevel;
                delete element.dataset.devTypeSize;
            });
        }
    }

    function validateEntryPoints() {
        for (const [code, label, , , options = {}] of blocks) {
            if (options.entryPoint && typeof window[options.entryPoint] !== 'function') {
                console.error(`[dev-inspector] ${code} entry point is missing or renamed: ${options.entryPoint} (${label})`);
            }
        }
    }

    window.setDevInspectorEnabled = setEnabled;
    validateEntryPoints();
    window.addEventListener('scroll', scheduleScan, true);
    window.addEventListener('resize', scheduleScan);
    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
    setEnabled(enabled);
})();
