/**
 * 报表 v2.10 — 每日时间构成保持 24 小时口径
 */
(function () {
    const PERIOD_LABELS = { day: '日报', week: '周报', month: '月报', year: '年报' };

    let state = {
        period: 'day',
        kind: 'time',
        periodOffsets: { day: 0, week: 0, month: 0, year: 0 },
        chartView: 'main',
        legendMode: 'l1',
        summaryModes: {
            main: localStorage.getItem('v9_report_summary_view_main') || 'live',
            parallel: localStorage.getItem('v9_report_summary_view_parallel') || 'live',
        },
        eventMode: localStorage.getItem('v9_report_event_mode') || 'count',
        eventDetail: null,
        eventDetailTab: 'records',
        eventDetailDate: '',
    };
    let getPeriodData = null;
    let eventsBound = false;
    const REPORT_COLORS = ['#2563eb', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#eab308', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1', '#84cc16'];
    const ACTIVITY_COLORS = ['#2563eb', '#f97316', '#0f9f8c', '#8b5cf6', '#dc2626', '#ca8a04', '#0891b2', '#c026d3', '#65a30d', '#4f46e5', '#be123c', '#0f766e'];

    function colorForKey(key, fallback) {
        const text = String(key || fallback || '');
        let hash = 0;
        for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        return REPORT_COLORS[Math.abs(hash) % REPORT_COLORS.length];
    }

    function reportColor(value, fallback) {
        const color = String(value || '').trim();
        if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) return color;
        if (/^(?:rgb|rgba|hsl|hsla)\([\d\s.,%]+\)$/i.test(color)) return color;
        return colorForKey(fallback, fallback);
    }

    function buildActivityColors(items) {
        const names = [...new Set(items.map((item) => item.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
        const colors = new Map();
        names.forEach((name, index) => {
            colors.set(name, name === '自由时间' ? '#ffffff' : (name === '未记录时间' ? '#cbd5e1' : ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]));
        });
        return colors;
    }

    function polar(cx, cy, r, deg) {
        const rad = ((deg - 90) * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function arcPath(cx, cy, r0, r1, a0, a1) {
        if (a1 - a0 >= 360) a1 = a0 + 359.99;
        const p0s = polar(cx, cy, r0, a0);
        const p0e = polar(cx, cy, r0, a1);
        const p1s = polar(cx, cy, r1, a0);
        const p1e = polar(cx, cy, r1, a1);
        const large = a1 - a0 <= 180 ? 0 : 1;
        return [
            'M', p1s.x, p1s.y,
            'A', r1, r1, 0, large, 1, p1e.x, p1e.y,
            'L', p0e.x, p0e.y,
            'A', r0, r0, 0, large, 0, p0s.x, p0s.y,
            'Z'
        ].join(' ');
    }

    function buildRingSegments(items, cx, cy, r0, r1, total, keyCat, useItemColor) {
        let angle = 0;
        return items.filter((item) => (item.exactHours ?? item.hours) > 0).map((item) => {
            const hours = item.exactHours ?? item.hours;
            const sweep = (hours / total) * 360;
            const path = arcPath(cx, cy, r0, r1, angle, angle + sweep);
            const seg = {
                path,
                cat: item[keyCat] || item.name,
                name: item.name,
                l1: item.l1,
                hours,
                color: useItemColor ? reportColor(item.color, item.name) : colorForKey(`${item.l1 || ''}|${item.name}`, item.color),
            };
            angle += sweep;
            return seg;
        });
    }

    function fmtHours(h) {
        if (h > 0 && h < 1) return h < 1 / 60 ? `${Math.max(1, Math.round(h * 3600))}秒` : `${Math.round(h * 60)}分钟`;
        return (Math.round(h * 10) / 10) + 'h';
    }

    function pct(h, total) {
        if (!total) return '0%';
        return (Math.round((h / total) * 1000) / 10) + '%';
    }

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function resolvePeriodData() {
        if (getPeriodData) {
            const live = getPeriodData(state.period, { rangeOffset: state.periodOffsets[state.period] || 0 });
            if (live) return live;
        }
        return typeof REPORT_DATA !== 'undefined' ? REPORT_DATA[state.period] || null : null;
    }

    function resolveSummaryPeriodData(view, fallback) {
        if (getPeriodData) {
            const data = getPeriodData(state.period, {
                summaryMode: state.summaryModes[view] || 'live',
                rangeOffset: state.periodOffsets[state.period] || 0,
            });
            if (data) return data;
        }
        return fallback;
    }

    function syncSummaryModeButtons() {
        const historical = (state.periodOffsets[state.period] || 0) < 0;
        document.querySelectorAll('.summary-view-toggle').forEach(toggle => toggle.classList.toggle('hidden', historical));
        document.querySelectorAll('.summary-view-btn').forEach((button) => {
            const selected = state.summaryModes[button.dataset.summaryView] === button.dataset.summaryMode;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-pressed', String(selected));
            button.textContent = button.dataset.summaryMode === 'settled' ? '截至昨日' : '包含今天';
        });
    }

    function renderSummaryRow(elId, view, periodData) {
        const slots = getReportSummarySlots(view, state.period);
        const box = document.getElementById(elId);
        if (!box) return;
        box.innerHTML = slots.map((slot) => {
            const m = resolveReportMetric(slot, periodData, view);
            return `<div class="stat-indigo">
                <div class="stat-indigo-value">${esc(m.value)}</div>
                <div class="stat-indigo-label">${esc(m.label)}</div>
            </div>`;
        }).join('');
        const note = box.parentElement.querySelector('.summary-scope-note');
        const range = periodData._range;
        if (note && range) {
            const format = ms => {
                const date = new Date(ms + 8 * 3600000);
                return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
            };
            note.textContent = range.end > range.start
                ? `摘要范围：${format(range.start)}—${format(range.end - 1)}`
                : '当前范围内尚无已结束的自然日';
        }
    }

    function formatEventClock(ms) {
        const date = new Date(ms + 8 * 60 * 60 * 1000);
        return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    }

    function renderEventReport(eventData) {
        const box = document.getElementById('event-report-content');
        const pattern = document.getElementById('event-pattern-block');
        if (!box || !pattern) return;
        const data = eventData || { total: 0, activeDays: 0, entries: [], daily: [] };
        pattern.classList.toggle('hidden', state.kind !== 'event');
        box.innerHTML = `<div class="event-overview" aria-label="事件概览"><div><strong>${esc(String(data.entries.length))}</strong><span>事件种类</span></div><div><strong>${esc(String(data.total || 0))}</strong><span>发生次数</span></div><div><strong>${esc(String(data.activeDays || 0))}</strong><span>发生天数</span></div><div><strong>${esc(String(data.recordsCount || 0))}</strong><span>记录条数</span></div></div>`;
        pattern.replaceChildren();
        if (!data.entries.length) {
            pattern.innerHTML = '<p class="event-pattern-empty">这个周期还没有事件记录</p>';
            return;
        }
        const heading = document.createElement('h2');
        heading.textContent = '事件趋势';
        pattern.appendChild(heading);
        const entries = data.entries;
        const dates = data.daily || [];
        const cell = (date, item, compact) => {
            const count = item.dailyCounts?.[date] || 0;
            const node = document.createElement('span');
            node.className = 'event-pattern-cell' + (count ? ' has-records' : '');
            node.title = `${item.name} ${date}：${count}次`;
            node.setAttribute('aria-label', node.title);
            if (count) node.style.backgroundColor = reportColor(item.color, item.name);
            if (count && !compact) node.textContent = count > 1 ? String(count) : '✓';
            return node;
        };
        if (data.period === 'week') {
            const table = document.createElement('div'); table.className = 'event-pattern-week';
            const labels = document.createElement('div'); labels.className = 'event-pattern-week-row event-pattern-week-labels';
            labels.appendChild(document.createElement('span'));
            dates.forEach((day, i) => { const label = document.createElement('span'); label.textContent = ['一','二','三','四','五','六','日'][i] || ''; labels.appendChild(label); });
            table.appendChild(labels);
            entries.forEach(item => {
                const row = document.createElement('div'); row.className = 'event-pattern-week-row';
                const name = document.createElement('button'); name.type = 'button'; name.className = 'event-pattern-name event-pattern-open'; name.textContent = `${item.icon} ${item.name}`; name.setAttribute('aria-label', `查看${item.name}详情`); name.addEventListener('click', () => openEventDetail(item)); row.appendChild(name);
                dates.forEach(day => row.appendChild(cell(day.date, item, false)));
                row.addEventListener('click', event => { if (!event.target.closest('button')) openEventDetail(item); });
                table.appendChild(row);
            });
            pattern.appendChild(table);
        } else {
            const grid = document.createElement('div');
            grid.className = 'event-pattern-cards ' + (data.period === 'month' ? 'is-month' : data.period === 'year' ? 'is-year' : 'is-day');
            entries.forEach(item => {
                const card = document.createElement('article'); card.className = 'event-pattern-card';
                const title = document.createElement('div'); title.className = 'event-pattern-card-title';
                const name = document.createElement('button'); name.type = 'button'; name.className = 'event-pattern-open'; name.textContent = `${item.icon} ${item.name}`; name.setAttribute('aria-label', `查看${item.name}详情`); name.addEventListener('click', () => openEventDetail(item));
                const total = document.createElement('span'); total.textContent = `${item.count}次 · ${item.days}天`;
                title.append(name, total); card.appendChild(title);
                if (data.period === 'month' || data.period === 'year') {
                    const days = document.createElement('div'); days.className = 'event-pattern-days';
                    if (data.period === 'month' && dates.length) {
                        const first = new Date(dates[0].date + 'T00:00:00Z').getUTCDay();
                        for (let i = 0; i < (first + 6) % 7; i++) days.appendChild(document.createElement('span'));
                    }
                    dates.forEach(day => days.appendChild(cell(day.date, item, data.period === 'year')));
                    card.appendChild(days);
                }
                card.addEventListener('click', event => { if (!event.target.closest('button')) openEventDetail(item); });
                grid.appendChild(card);
            });
            pattern.appendChild(grid);
        }
    }

    function openEventDetail(item) {
        state.eventDetail = { id: item.id, name: item.name, icon: item.icon, color: item.color };
        state.eventDetailTab = 'records'; state.eventDetailDate = '';
        render();
        document.getElementById('page-report')?.closest('main')?.scrollTo({ top: 0 });
    }

    function renderEventDetail(data) {
        const box = document.getElementById('event-detail-block');
        if (!box) return;
        const visible = state.kind === 'event' && !!state.eventDetail;
        box.classList.toggle('hidden', !visible);
        if (!visible) { delete box.dataset.devAddressBlock; return; }
        box.dataset.devAddressBlock = state.eventDetailTab === 'records' ? 'B99' : 'B100';
        const detail = state.eventDetail;
        const item = data.entries.find(entry => String(entry.id) === String(detail.id)) || { ...detail, count: 0, days: 0, dailyCounts: {}, records: [] };
        const records = (item.records || []).slice().sort((a, b) => b.occurredAt - a.occurredAt);
        const dates = data.daily || [];
        if (state.eventDetailTab === 'records' && !state.eventDetailDate && records.length) {
            state.eventDetailDate = state.period === 'year' ? records[0].date.slice(0, 7) : records[0].date;
        }
        box.replaceChildren();
        const header = document.createElement('div'); header.className = 'event-detail-header';
        const back = document.createElement('button'); back.type = 'button'; back.className = 'event-detail-back'; back.textContent = '‹'; back.setAttribute('aria-label', '返回事件趋势'); back.onclick = () => { state.eventDetail = null; state.eventDetailDate = ''; render(); };
        const title = document.createElement('h2'); title.textContent = `${item.icon} ${item.name}`;
        const tabs = document.createElement('div'); tabs.className = 'event-detail-tabs report-segmented-template'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '事件详情视图');
        [['records', '记录'], ['statistics', '统计']].forEach(([key, label]) => {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(state.eventDetailTab === key)); button.classList.toggle('active', state.eventDetailTab === key); button.onclick = () => { state.eventDetailTab = key; state.eventDetailDate = ''; render(); }; tabs.appendChild(button);
        });
        header.append(back, title, tabs); box.appendChild(header);
        const calendar = document.createElement('div'); calendar.className = 'event-detail-calendar';
        const days = state.period === 'year' ? Array.from({length: 12}, (_, i) => ({ date: dates[0]?.date.slice(0, 4) + '-' + String(i + 1).padStart(2, '0'), label: `${i + 1}月` })) : dates.map(day => ({ date: day.date, label: String(Number(day.date.slice(-2))) }));
        if (state.period === 'month' && days.length) {
            const offset = (new Date(days[0].date + 'T00:00:00Z').getUTCDay() + 6) % 7;
            ['一','二','三','四','五','六','日'].forEach(day => { const label = document.createElement('span'); label.className = 'event-detail-weekday'; label.textContent = day; calendar.appendChild(label); });
            for (let i = 0; i < offset; i++) calendar.appendChild(document.createElement('span'));
        }
        if (state.period === 'year') calendar.classList.add('is-year');
        days.forEach(day => {
            const count = records.filter(record => record.date.startsWith(day.date)).reduce((sum, record) => sum + record.count, 0);
            const button = document.createElement('button'); button.type = 'button'; button.className = 'event-detail-day'; button.textContent = day.label; button.classList.toggle('has-records', count > 0); button.classList.toggle('active', state.eventDetailDate === day.date); button.setAttribute('aria-label', `${day.date}，${count}次`); button.setAttribute('aria-pressed', String(state.eventDetailDate === day.date));
            button.onclick = () => { state.eventDetailDate = day.date; renderEventDetail(data); };
            if (count) { const dot = document.createElement('small'); dot.textContent = String(count); button.appendChild(dot); }
            calendar.appendChild(button);
        });
        if (state.eventDetailTab === 'records') {
            if (days.length > 1) box.appendChild(calendar);
            const showAll = state.eventDetailDate === 'all' || !state.eventDetailDate;
            const shown = records.filter(record => showAll || record.date.startsWith(state.eventDetailDate));
            const heading = document.createElement('div'); heading.className = 'event-detail-section-head';
            const h = document.createElement('h3'); h.textContent = showAll ? '全部记录' : state.eventDetailDate; heading.appendChild(h);
            if (days.length > 1 && records.length) { const all = document.createElement('button'); all.type = 'button'; all.textContent = showAll ? '最近记录' : '查看全部'; all.onclick = () => { state.eventDetailDate = showAll ? (state.period === 'year' ? records[0].date.slice(0, 7) : records[0].date) : 'all'; renderEventDetail(data); }; heading.appendChild(all); }
            box.appendChild(heading);
            if (!shown.length) { const empty = document.createElement('p'); empty.className = 'event-detail-empty'; empty.textContent = showAll ? '当前范围没有记录' : '这段时间没有记录'; box.appendChild(empty); }
            shown.forEach(record => {
                const row = document.createElement('button'); row.type = 'button'; row.className = 'event-detail-record';
                const details = document.createElement('span'); details.className = 'event-detail-record-info';
                const time = document.createElement('strong'); time.textContent = record.dateOnly ? '未指定时间' : formatEventClock(record.occurredAt); details.appendChild(time);
                if (showAll || state.period === 'year') { const date = document.createElement('small'); date.textContent = record.date; details.appendChild(date); }
                const count = document.createElement('span'); count.className = 'event-detail-record-count'; count.textContent = `${record.count}次`;
                const arrow = document.createElement('span'); arrow.className = 'event-detail-record-arrow'; arrow.textContent = '›'; arrow.setAttribute('aria-hidden', 'true');
                row.append(details, count, arrow); row.setAttribute('aria-label', `${record.date} ${time.textContent}，${record.count}次，编辑记录`); row.onclick = () => window.openEventRecordEditor(record.id); box.appendChild(row);
            });
        } else {
            const overview = document.createElement('div'); overview.className = 'event-detail-metrics';
            [[item.count, '发生次数'], [item.days, '发生天数'], [records.length, '记录条数']].forEach(([value, label]) => { const block = document.createElement('div'); const number = document.createElement('strong'); number.textContent = String(value); const caption = document.createElement('span'); caption.textContent = label; block.append(number, caption); overview.appendChild(block); });
            box.appendChild(overview);
            const label = document.createElement('h3'); label.className = 'event-detail-subtitle'; label.textContent = state.period === 'year' ? '每月记录' : '发生分布'; box.appendChild(label);
            const values = days.map(day => ({ ...day, count: records.filter(record => record.date.startsWith(day.date)).reduce((sum, record) => sum + record.count, 0) }));
            if (values.length) {
                const chart = document.createElement('div'); chart.className = 'event-detail-chart'; chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', values.map(day => `${day.date} ${day.count}次`).join('，'));
                const max = Math.max(1, ...values.map(day => day.count));
                values.forEach(day => { const column = document.createElement('div'); column.className = 'event-detail-chart-column'; const bar = document.createElement('span'); bar.style.height = `${day.count / max * 100}%`; bar.style.backgroundColor = reportColor(item.color, item.name); column.appendChild(bar); column.title = `${day.date}：${day.count}次`; chart.appendChild(column); });
                box.appendChild(chart);
                const scale = document.createElement('div'); scale.className = 'event-detail-chart-scale'; const first = document.createElement('span'); first.textContent = values[0].label; const last = document.createElement('span'); last.textContent = values[values.length - 1].label; scale.append(first, last); box.appendChild(scale);
            }
            box.appendChild(calendar);
        }
    }

    function renderTimelineHalf(tl, suffix, fromPct, toPct, title) {
        const card = document.getElementById('timeline-card-' + suffix);
        const titleEl = document.getElementById('timeline-title-' + suffix);
        const hintEl = document.getElementById('timeline-hint-' + suffix);
        const body = document.getElementById('timeline-body-' + suffix);
        const scaleEl = document.getElementById('timeline-scale-' + suffix);
        if (!card || !body) return;

        if (!tl) {
            card.classList.add('hidden');
            delete card.dataset.devAddressBlock;
            return;
        }
        card.classList.remove('hidden');
        const blockCode = tl.kind === 'day'
            ? (suffix === 'a' ? 'B18' : 'B42')
            : tl.kind === 'bars' ? 'B45' : '';
        if (blockCode) card.dataset.devAddressBlock = blockCode;
        else delete card.dataset.devAddressBlock;
        titleEl.textContent = title || tl.title || '时间分布';
        hintEl.textContent = tl.hint || '';

        if (tl.kind === 'day') {
            let segHtml = '';
            const labels = [];
            (tl.segments || []).forEach((s) => {
                const segStart = Math.max(fromPct, s.left);
                const segEnd = Math.min(toPct, s.left + s.width);
                if (segEnd <= segStart) return;
                const left = ((segStart - fromPct) / (toPct - fromPct)) * 100;
                const width = ((segEnd - segStart) / (toPct - fromPct)) * 100;
                const w = Math.max(width, 0.35);
                segHtml += `<button type="button" class="timeline-block" style="left:${left}%;width:${w}%;background:${reportColor(s.color, s.label)}" title="${esc(s.title)}" aria-label="${esc(s.title)}"></button>`;
                labels.push({ label: s.label, title: s.title, left: left + width / 2 });
            });
            if (tl.nowPct != null && tl.nowPct >= fromPct && tl.nowPct <= toPct) {
                const nowLeft = ((tl.nowPct - fromPct) / (toPct - fromPct)) * 100;
                segHtml += `<div class="timeline-now" style="left:${nowLeft}%"></div>`;
            }
            labels.sort((a, b) => a.left - b.left);
            let lastRight = -Infinity;
            labels.forEach((item) => {
                const row = item.left - 12 < lastRight ? 1 : 0;
                item.row = row;
                lastRight = item.left + 12;
            });
            const labelHtml = labels.map((item) => `<span class="timeline-callout timeline-callout-row-${item.row}" style="left:${item.left}%" title="${esc(item.title)}">${esc(item.label)}</span>`).join('');
            body.innerHTML = `<div class="timeline-stage"><div class="timeline-track">${segHtml}</div><div class="timeline-callouts">${labelHtml}</div></div>`;
            const labelsForHalf = suffix === 'a' ? ['00:00', '03:00', '06:00', '09:00', '12:00'] : ['12:00', '15:00', '18:00', '21:00', '24:00'];
            scaleEl.innerHTML = labelsForHalf.map((t) => `<span>${t}</span>`).join('');
            scaleEl.classList.remove('hidden');
        } else if (tl.kind === 'bars') {
            body.innerHTML = `<div class="timeline-bars">${(tl.bars || []).map((b) => {
                return `<div class="timeline-bar-row">
                    <span class="timeline-bar-label">${esc(b.label)}</span>
                    <div class="timeline-bar-track">${(b.segments || []).map((s) => `<button type="button" class="timeline-bar-segment" style="width:${Math.max(0, s.width)}%;background:${reportColor(s.color, s.l1 || s.name)}" title="${esc(b.label + ' · ' + (s.title || s.name))}" aria-label="${esc(b.label + ' · ' + (s.title || s.name))}"></button>`).join('')}</div>
                    <span class="timeline-bar-val">${esc(String(b.hours))}h</span>
                </div>`;
            }).join('')}</div>`;
            scaleEl.classList.add('hidden');
            scaleEl.innerHTML = '';
        }
        body.querySelectorAll('.timeline-block, .timeline-bar-segment').forEach(button => {
            const show = e => showTip(e, button.title, '', '');
            button.addEventListener('click', show);
            button.addEventListener('focus', show);
            button.addEventListener('blur', hideTip);
        });
    }

    function render() {
        const root = document.getElementById('page-report');
        if (!root) return;

        const periodData = resolvePeriodData();
        if (!periodData) return;
        document.getElementById('report-time-view').classList.toggle('hidden', state.kind !== 'time');
        document.getElementById('report-time-detail').classList.toggle('hidden', state.kind !== 'time');
        document.getElementById('event-report-block').classList.toggle('hidden', state.kind !== 'event');
        document.querySelectorAll('[data-report-kind]').forEach(button => {
            const selected = button.dataset.reportKind === state.kind;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-selected', String(selected));
        });

        const mainBundle = periodData.main;
        const parallelBundle = periodData.parallel;
        const chartBundle = state.chartView === 'main' ? mainBundle : parallelBundle;
        const periodName = PERIOD_LABELS[state.period];
        const isLive = !!periodData._live;
        const badge = isLive
            ? '<span class="badge-live">当前周期</span>'
            : '<span class="badge-sample">历史周期</span>';

        const sub = document.getElementById('bill-subtitle');
        if (sub) {
            sub.innerHTML = `TimeBook · ${esc(mainBundle.meta.title)} · ${periodName} ${badge}`;
        }

        const periodic = state.period === 'week' || state.period === 'month';
        document.getElementById('summary-block-main')?.classList.toggle('hidden', !periodic);
        document.getElementById('summary-block-parallel')?.classList.toggle('hidden', !periodic);
        if (periodic) {
            renderSummaryRow('summary-main', 'main', resolveSummaryPeriodData('main', periodData));
            renderSummaryRow('summary-parallel', 'parallel', resolveSummaryPeriodData('parallel', periodData));
            syncSummaryModeButtons();
        }
        renderEventReport(periodData.events);
        const detailVisible = state.kind === 'event' && !!state.eventDetail;
        document.getElementById('event-report-block').classList.toggle('hidden', state.kind !== 'event' || detailVisible);
        document.getElementById('event-pattern-block').classList.toggle('hidden', state.kind !== 'event' || detailVisible);
        renderEventDetail(periodData.events);

        if (periodData.timeline?.kind === 'day') {
            renderTimelineHalf(periodData.timeline, 'a', 0, 50, '00:00–12:00');
            renderTimelineHalf(periodData.timeline, 'b', 50, 100, '12:00–24:00');
        } else {
            renderTimelineHalf(periodData.timeline, 'a', 0, 100, periodData.timeline?.title || '时间分布');
            const secondHalf = document.getElementById('timeline-card-b');
            secondHalf?.classList.add('hidden');
            if (secondHalf) delete secondHalf.dataset.devAddressBlock;
        }

        const total = chartBundle.l1.reduce((s, x) => s + (x.exactHours ?? x.hours), 0);
        const isMain = state.chartView === 'main';
        document.getElementById('report-structure-card').dataset.devAddressBlock = isMain ? 'B17' : 'B92';

        document.getElementById('structure-title').textContent = '时间结构';
        document.getElementById('chart-legend-hint').textContent = isMain
            ? '内环 = 一级目录 · 外环 = 二级活动 · 最外弧 = 场景覆盖'
            : '内环 = 并行活动 · 外环 = 叠加明细';

        const chartL2 = isMain ? (chartBundle.l2Slices || chartBundle.l2) : chartBundle.l2;
        const activityColors = buildActivityColors((chartBundle.l2 || []).concat(chartL2 || []));
        document.querySelector('#report-structure-card .sunburst-layout').classList.toggle('hidden', !isMain);
        const parallelChart = document.getElementById('parallel-duration-chart');
        parallelChart.classList.toggle('hidden', isMain);
        if (isMain) {
            renderSunburst(chartBundle.l1, chartL2, total, true, chartBundle.sceneCoverage || [], chartBundle.sceneRange, activityColors);
            renderLegend(chartBundle.l1, chartBundle.l2, total, true, activityColors);
        } else {
            renderParallelChart(parallelChart, chartBundle.l1, total);
        }

        const foot = document.getElementById('footer-note');
        if (foot) {
            foot.textContent = chartBundle.meta.footnote + (state.period === 'week' ? ' · 周一起算' : '');
        }

        syncToolbar();
    }

    function renderParallelChart(box, items, total) {
        const rows = items.filter(item => (item.exactHours ?? item.hours) > 0)
            .slice().sort((a, b) => (b.exactHours ?? b.hours) - (a.exactHours ?? a.hours));
        if (!rows.length) {
            box.innerHTML = '<div class="event-report-empty">这个周期还没有并行活动</div>';
            return;
        }
        const max = rows[0].exactHours ?? rows[0].hours;
        box.innerHTML = `<div class="parallel-chart-total"><span>并行累计</span><strong>${fmtHours(total)}</strong></div>` + rows.map(item => {
            const hours = item.exactHours ?? item.hours;
            const color = reportColor(item.color, item.name);
            return `<div class="parallel-duration-row"><div class="parallel-duration-label"><span>${esc(item.name)}</span><strong>${fmtHours(hours)}</strong><span>${pct(hours, total)}</span></div><div class="parallel-duration-track"><span style="width:${hours / max * 100}%;background:${esc(color)}"></span></div></div>`;
        }).join('');
    }

    function renderSunburst(l1, l2, total, isMain, sceneCoverage, sceneRange, activityColors) {
        const svg = document.getElementById('sunburst-svg');
        if (!svg) return;
        const cx = 100, cy = 100;
        const inner = buildRingSegments(l1, cx, cy, 28, 50, total || 1, 'name', isMain);
        const outer = isMain
            ? buildEmbeddedOuterSegments(l1, l2, cx, cy, total || 1, activityColors)
            : buildRingSegments(l2, cx, cy, 54, 80, total || 1, 'l1', false);
        const sceneArcs = isMain ? buildSceneCoverageSegments(sceneCoverage, cx, cy, sceneRange) : [];

        let html = '';
        inner.forEach((s) => {
            html += `<path d="${s.path}" fill="${s.color}" fill-opacity=".88" stroke="#fff" stroke-width="1" class="inner-seg" data-cat="${esc(s.cat)}"
                data-title="${esc(s.name)}" data-hours="${fmtHours(s.hours)}" data-pct="${pct(s.hours, total)}"/>`;
        });
        outer.forEach((s) => {
            const remainder = s.remainder ? ' scene-remainder' : '';
            const free = s.free ? ' free-time-seg' : '';
            html += `<path d="${s.path}" fill="${s.color}" fill-opacity=".78" stroke="${s.free ? '#cbd5e1' : '#fff'}" stroke-width="${s.free ? '1' : '.5'}" class="outer-seg${remainder}${free}" data-cat="${esc(s.l1)}"
                data-title="${esc(s.name)}" data-sub="${esc(s.l1)}" data-hours="${fmtHours(s.hours)}" data-pct="${pct(s.hours, total)}"/>`;
        });
        sceneArcs.forEach((s) => {
            html += `<path d="${s.path}" fill="${s.color}" fill-opacity=".96" stroke="#fff" stroke-width=".8" class="scene-coverage-seg"
                data-title="场景 / ${esc(s.name)}" data-hours="${fmtHours(s.hours)}" data-pct="${pct(s.hours, total)}"/>`;
        });
        const centerVal = Math.round(total * 10) / 10;
        html += `<circle cx="100" cy="100" r="26" fill="#fff" stroke="#e2e8f0" stroke-width="1"/>`;
        html += `<text x="100" y="96" text-anchor="middle" fill="#1e293b" font-size="17" font-weight="800">${centerVal}</text>`;
        html += `<text x="100" y="112" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="700">小时</text>`;
        svg.innerHTML = html;

        svg.querySelectorAll('.inner-seg, .outer-seg:not(.scene-remainder), .scene-coverage-seg').forEach(bindSegTip);
    }

    // 外环严格跟随内环父块；场景内未细分的部分已作为“自由时间”写入切片。
    function buildEmbeddedOuterSegments(l1, l2, cx, cy, total, activityColors) {
        let angle = 0;
        const rows = [];
        l1.filter((item) => (item.exactHours ?? item.hours) > 0).forEach((parent) => {
            const parentHours = parent.exactHours ?? parent.hours;
            const parentSweep = (parentHours / total) * 360;
            const children = l2.filter((item) => item.l1 === parent.name && (item.exactHours ?? item.hours) > 0);
            const childHours = children.reduce((sum, item) => sum + (item.exactHours ?? item.hours), 0);
            const scale = childHours > parentHours && childHours > 0 ? parentHours / childHours : 1;
            let childAngle = angle;
            children.forEach((item) => {
                const hours = item.exactHours ?? item.hours;
                const sweep = (hours * scale / total) * 360;
                if (sweep <= 0) return;
                rows.push({
                    path: arcPath(cx, cy, 54, 80, childAngle, childAngle + sweep),
                    cat: parent.name,
                    name: item.name,
                    l1: parent.name,
                    hours,
                    color: item.free ? '#ffffff' : (activityColors.get(item.name) || colorForKey(`l2|${parent.name}|${item.name}`, item.color)),
                    free: !!item.free,
                });
                childAngle += sweep;
            });
            const remainder = angle + parentSweep - childAngle;
            if (remainder > 0.0001) {
                rows.push({
                    path: arcPath(cx, cy, 54, 80, childAngle, angle + parentSweep),
                    cat: parent.name,
                    name: parent.name,
                    l1: parent.name,
                    hours: 0,
                    color: reportColor(parent.color, parent.name),
                    remainder: true,
                });
            }
            angle += parentSweep;
        });
        return rows;
    }

    // 场景覆盖是观察维度：按真实开始、结束时刻落在圆周位置，不加入中心的 24 小时合计。
    function buildSceneCoverageSegments(items, cx, cy, range) {
        const span = range?.end - range?.start;
        if (!span) return [];
        return items
            .map((item) => ({ ...item, start: Math.max(range.start, item.start), end: Math.min(range.end, item.end) }))
            .filter((item) => item.end > item.start)
            .sort((a, b) => a.start - b.start)
            .map((item) => {
                const a0 = ((item.start - range.start) / span) * 360;
                const a1 = ((item.end - range.start) / span) * 360;
                return {
                    path: arcPath(cx, cy, 84, 89, a0, a1),
                    name: item.name,
                    hours: (item.end - item.start) / 3600000,
                    color: reportColor(item.color, item.name),
                };
            });
    }

    function bindSegTip(el) {
        const show = e => showTip(e, el.dataset.title, el.dataset.hours, el.dataset.pct);
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${el.dataset.title} ${el.dataset.hours} ${el.dataset.pct}`);
        el.addEventListener('mouseenter', show);
        el.addEventListener('mouseleave', hideTip);
        el.addEventListener('click', show);
        el.addEventListener('focus', show);
        el.addEventListener('blur', hideTip);
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(e); }
        });
    }

    function renderLegend(l1, l2, total, isMain, activityColors) {
        const l1Box = document.getElementById('legend-l1');
        const l2Box = document.getElementById('legend-l2');
        l1Box.innerHTML = l1.map((row) => legendRow(row.name, null, row.exactHours ?? row.hours, isMain ? reportColor(row.color, row.name) : colorForKey(`l1|${row.name}`, row.color), total, row.name)).join('');
        l2Box.innerHTML = l2.map((row) => legendRow(
            row.name,
            isMain ? null : row.l1,
            row.exactHours ?? row.hours,
            isMain ? (activityColors.get(row.name) || row.color) : colorForKey(`l2|${row.l1 || ''}|${row.name}`, row.color),
            total,
            isMain ? row.name : row.l1
        )).join('');
        l1Box.style.display = state.legendMode === 'l1' ? 'block' : 'none';
        l2Box.style.display = state.legendMode === 'l2' ? 'block' : 'none';
        document.getElementById('btn-l1').classList.toggle('active', state.legendMode === 'l1');
        document.getElementById('btn-l2').classList.toggle('active', state.legendMode === 'l2');
        document.getElementById('btn-l1').textContent = isMain ? '活动分类' : '并行活动';
        document.getElementById('btn-l2').textContent = isMain ? '活动明细' : '叠加明细';

        document.querySelectorAll('.sunburst-legend .legend-item').forEach((el) => {
            el.addEventListener('mouseenter', () => {
                if (el.dataset.activity) highlightActivity(el.dataset.activity);
                else highlightCat(el.dataset.cat);
            });
            el.addEventListener('mouseleave', unhighlightCat);
        });
    }

    function legendRow(name, l1, hours, color, total, cat) {
        const label = l1 ? `${esc(l1)} · <span class="legend-sub">${esc(name)}</span>` : esc(name);
        return `<div class="legend-item" data-cat="${esc(cat)}"${l1 ? '' : ` data-activity="${esc(name)}"`}>
            <span class="legend-dot" style="background:${color}"></span>
            <span class="legend-name">${label}</span>
            <span class="legend-val">${fmtHours(hours)}</span>
            <span class="legend-pct">${pct(hours, total)}</span>
        </div>`;
    }

    function syncToolbar() {
        document.querySelectorAll('#page-report [data-period], #report-standalone [data-period]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.period === state.period);
        });
        document.querySelectorAll('#page-report [data-chart], #report-standalone [data-chart]').forEach((btn) => {
            const on = btn.dataset.chart === state.chartView;
            btn.classList.toggle('active', on);
            btn.classList.toggle('chart-main', btn.dataset.chart === 'main');
            btn.classList.toggle('chart-parallel', btn.dataset.chart === 'parallel');
        });
        const navigable = !!getPeriodData;
        const offset = state.periodOffsets[state.period] || 0;
        const nav = document.getElementById('report-period-nav');
        const range = document.getElementById('report-period-range');
        const reset = nav?.querySelector('[data-report-nav="current"]');
        const next = nav?.querySelector('[data-report-nav="next"]');
        nav?.classList.toggle('hidden', !navigable);
        if (range && navigable) range.textContent = getPeriodRangeLabel(state.period, offset);
        reset?.classList.toggle('hidden', offset === 0);
        if (reset) reset.textContent = { day: '回到今天', week: '回到本周', month: '回到本月', year: '回到今年' }[state.period];
        if (next) {
            next.disabled = offset >= 0;
            next.title = offset >= 0 ? '已是当前周期' : '查看下一周期';
        }
    }

    function getPeriodRangeLabel(period, offset) {
        const now = new Date();
        const beijing = new Date(now.getTime() + 8 * 3600000);
        const year = beijing.getUTCFullYear();
        const month = beijing.getUTCMonth();
        const day = beijing.getUTCDate();
        const today = Date.UTC(year, month, day);
        if (period === 'month') {
            const target = new Date(Date.UTC(year, month + offset, 1));
            return `${target.getUTCFullYear()}年${target.getUTCMonth() + 1}月`;
        }
        if (period === 'year') return `${year + offset}年`;
        if (period === 'day') {
            const target = new Date(today + offset * 86400000);
            return `${target.getUTCFullYear()}年${target.getUTCMonth() + 1}月${target.getUTCDate()}日`;
        }
        const mondayOffset = (beijing.getUTCDay() + 6) % 7;
        const start = new Date(today - mondayOffset * 86400000 + offset * 7 * 86400000);
        const end = new Date(start.getTime() + 6 * 86400000);
        const fmt = (date) => `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
        return `${start.getUTCFullYear()}年${fmt(start)}-${fmt(end)}`;
    }

    function bindEvents() {
        if (eventsBound) return;
        eventsBound = true;
        document.getElementById('report-date-picker')?.addEventListener('change', event => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) return;
            const target = new Date(event.target.value + 'T00:00:00Z');
            const now = new Date(Date.now() + 8 * 3600000);
            const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
            let offset = Math.floor((target.getTime() - today) / 86400000);
            if (state.period === 'week') offset = Math.round((target.getTime() - ((target.getUTCDay() + 6) % 7) * 86400000 - (today - ((now.getUTCDay() + 6) % 7) * 86400000)) / (7 * 86400000));
            if (state.period === 'month') offset = (target.getUTCFullYear() - now.getUTCFullYear()) * 12 + target.getUTCMonth() - now.getUTCMonth();
            if (state.period === 'year') offset = target.getUTCFullYear() - now.getUTCFullYear();
            state.eventDetailDate = '';
            state.periodOffsets[state.period] = Math.min(0, offset);
            render();
        });
        document.querySelectorAll('[data-report-kind]').forEach(button => button.addEventListener('click', () => {
            state.kind = button.dataset.reportKind;
            render();
        }));
        const reportPage = document.getElementById('page-report');
        let reportSwipeStart = null;
        let reportSwipePreview = null;
        let reportSwipeTimer = null;
        function clearReportSwipe() {
            clearTimeout(reportSwipeTimer);
            reportSwipePreview?.root.remove();
            reportSwipePreview = null;
        }
        function makeReportSwipePreview(direction) {
            clearReportSwipe();
            const toolbar = document.getElementById('report-period-toolbar').getBoundingClientRect();
            const main = reportPage.closest('main').getBoundingClientRect();
            const top = Math.max(main.top, toolbar.bottom);
            const bottom = main.bottom;
            if (bottom <= top) return null;
            const root = document.createElement('div'); root.className = 'report-swipe-preview';
            Object.assign(root.style, { left: main.left + 'px', top: top + 'px', width: main.width + 'px', height: (bottom - top) + 'px' });
            root.setAttribute('aria-hidden', 'true');
            const originalKind = state.kind;
            const targetKind = direction > 0 ? 'time' : 'event';
            const boundary = targetKind === originalKind;
            const makePanel = kind => {
                const panel = document.createElement('div'); panel.className = 'report-swipe-panel';
                panel.style.padding = '0 16px';
                const selectors = kind === 'time' ? ['report-time-view', 'report-time-detail'] : state.eventDetail ? ['event-detail-block'] : ['event-report-block', 'event-pattern-block'];
                selectors.forEach(id => {
                    const node = document.getElementById(id);
                    if (!node) return;
                    const clone = node.cloneNode(true);
                    clone.classList.remove('hidden');
                    clone.removeAttribute('id'); clone.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
                    clone.querySelectorAll('.dev-inspector-badge').forEach(child => child.remove());
                    if (kind === originalKind) {
                        clone.style.position = 'absolute';
                        clone.style.top = `${node.getBoundingClientRect().top - top}px`;
                        clone.style.left = '16px';
                        clone.style.right = '16px';
                    }
                    panel.appendChild(clone);
                });
                return panel;
            };
            const current = makePanel(originalKind);
            const next = makePanel(targetKind);
            if (boundary) next.style.visibility = 'hidden';
            const sourceAnchor = document.getElementById(originalKind === 'time' ? 'report-time-view' : state.eventDetail ? 'event-detail-block' : 'event-report-block');
            next.style.top = `${sourceAnchor.getBoundingClientRect().top - top}px`;
            root.append(current, next); reportPage.appendChild(root);
            return { root, current, next, targetKind, direction, boundary, width: main.width };
        }
        reportPage?.addEventListener('touchstart', event => {
            if (event.touches.length !== 1 || event.target.closest('button, input, select, textarea, a, [role="button"]')) {
                reportSwipeStart = null;
                return;
            }
            const touch = event.touches[0];
            clearReportSwipe();
            reportSwipeStart = { x: touch.clientX, y: touch.clientY, axis: null };
        }, { passive: true });
        reportPage?.addEventListener('touchmove', event => {
            if (!reportSwipeStart || event.touches.length !== 1) return;
            const dx = event.touches[0].clientX - reportSwipeStart.x;
            const dy = event.touches[0].clientY - reportSwipeStart.y;
            if (!reportSwipeStart.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) reportSwipeStart.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'horizontal' : 'vertical';
            if (reportSwipeStart.axis !== 'horizontal') return;
            const direction = dx > 0 ? 1 : -1;
            if (!reportSwipePreview || reportSwipePreview.direction !== direction) reportSwipePreview = makeReportSwipePreview(direction);
            if (!reportSwipePreview) return;
            if (event.cancelable) event.preventDefault();
            const offset = reportSwipePreview.boundary
                ? direction * 36 * (1 - Math.exp(-Math.abs(dx) / 120))
                : Math.max(-reportSwipePreview.width, Math.min(reportSwipePreview.width, dx));
            reportSwipePreview.current.style.transform = `translateX(${offset}px)`;
            reportSwipePreview.next.style.transform = `translateX(${offset - direction * reportSwipePreview.width}px)`;
        }, { passive: false });
        reportPage?.addEventListener('touchend', event => {
            if (!reportSwipeStart || event.changedTouches.length !== 1) { reportSwipeStart = null; clearReportSwipe(); return; }
            const touch = event.changedTouches[0];
            const dx = touch.clientX - reportSwipeStart.x;
            const dy = touch.clientY - reportSwipeStart.y;
            reportSwipeStart = null;
            const preview = reportSwipePreview;
            if (!preview) return;
            const commit = !preview.boundary && Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Math.sign(dx) === preview.direction;
            const offset = commit ? preview.direction * preview.width : 0;
            preview.current.style.transition = preview.next.style.transition = 'transform 240ms ease-out';
            preview.current.style.transform = `translateX(${offset}px)`;
            preview.next.style.transform = `translateX(${offset - preview.direction * preview.width}px)`;
            reportSwipeTimer = setTimeout(() => { if (commit) { state.kind = preview.targetKind; render(); } clearReportSwipe(); }, 240);
        }, { passive: true });
        reportPage?.addEventListener('touchcancel', () => { reportSwipeStart = null; clearReportSwipe(); }, { passive: true });
        document.addEventListener('click', e => {
            if (!e.target.closest('.inner-seg, .outer-seg, .scene-coverage-seg, .timeline-block, .timeline-bar-segment')) hideTip();
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
        document.addEventListener('scroll', hideTip, true);
        document.querySelectorAll('[data-period]').forEach((btn) => {
            btn.addEventListener('click', () => setPeriod(btn.dataset.period));
        });
        document.querySelectorAll('[data-report-nav]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const direction = btn.dataset.reportNav;
                state.eventDetailDate = '';
                if (direction === 'previous') state.periodOffsets[state.period] -= 1;
                if (direction === 'next') state.periodOffsets[state.period] = Math.min(0, state.periodOffsets[state.period] + 1);
                if (direction === 'current') state.periodOffsets[state.period] = 0;
                render();
            });
        });
        document.querySelectorAll('[data-chart]').forEach((btn) => {
            btn.addEventListener('click', () => setChartView(btn.dataset.chart));
        });
        document.querySelectorAll('.summary-view-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.summaryView;
                const mode = btn.dataset.summaryMode;
                if (!view || !mode || state.summaryModes[view] === mode) return;
                state.summaryModes[view] = mode;
                localStorage.setItem(`v9_report_summary_view_${view}`, mode);
                render();
            });
        });
        document.querySelectorAll('.event-mode-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.eventMode;
                if (!mode || state.eventMode === mode) return;
                state.eventMode = mode;
                localStorage.setItem('v9_report_event_mode', mode);
                render();
            });
        });
    }

    function renderTip(title, sub, val1, val2) {
        const tip = document.getElementById('tip');
        if (!tip) return null;
        tip.replaceChildren();
        const titleEl = document.createElement('div');
        titleEl.className = 'tip-title';
        titleEl.textContent = title || '';
        tip.appendChild(titleEl);
        if (sub != null && sub !== '') {
            const subEl = document.createElement('div');
            subEl.className = 'tip-sub';
            subEl.textContent = sub;
            tip.appendChild(subEl);
        }
        const row = document.createElement('div');
        row.className = 'tip-row';
        const left = document.createElement('span');
        const right = document.createElement('span');
        left.textContent = val1 || '';
        right.textContent = val2 || '';
        row.append(left, right);
        tip.appendChild(row);
        return tip;
    }

    window.showTip = function (e, title, val1, val2) {
        const tip = renderTip(title, '', val1, val2);
        if (!tip) return;
        tip.className = 'show';
        positionTip(e);
    };

    window.showTipOuter = function (e, sub, cat, val1, val2) {
        const tip = renderTip(sub, cat, val1, val2);
        if (!tip) return;
        tip.className = 'show';
        positionTip(e);
    };

    function positionTip(e) {
        const tip = document.getElementById('tip');
        const r = e.target.getBoundingClientRect();
        tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 8)) + 'px';
        const top = r.top - tip.offsetHeight - 8;
        tip.style.top = Math.max(8, Math.min(top >= 8 ? top : r.bottom + 8, window.innerHeight - tip.offsetHeight - 8)) + 'px';
    }

    window.hideTip = function () {
        const tip = document.getElementById('tip');
        if (tip) tip.className = '';
    };

    window.highlightCat = function (cat) {
        document.querySelectorAll('.inner-seg, .outer-seg').forEach((el) => {
            el.style.fillOpacity = el.dataset.cat === cat ? '1' : '0.12';
        });
    };

    window.highlightActivity = function (activity) {
        document.querySelectorAll('.inner-seg, .outer-seg').forEach((el) => {
            el.style.fillOpacity = el.classList.contains('outer-seg') && el.dataset.title === activity ? '1' : '0.12';
        });
    };

    window.unhighlightCat = function () {
        document.querySelectorAll('.inner-seg, .outer-seg').forEach((el) => {
            el.style.fillOpacity = '';
        });
    };

    window.setLegendMode = function (mode) {
        state.legendMode = mode;
        render();
    };

    window.setPeriod = function (period) {
        if (!Object.hasOwn(state.periodOffsets, period)) return;
        if (period !== state.period) state.eventDetailDate = '';
        state.period = period;
        render();
    };

    window.setChartView = function (view) {
        state.chartView = view;
        render();
    };

    window.initReportBillboard = function (opts) {
        opts = opts || {};
        if (opts.defaultPeriod) state.period = opts.defaultPeriod;
        if (opts.getPeriodData) getPeriodData = opts.getPeriodData;
        bindEvents();
        render();
    };

    window.renderReportBillboard = function () {
        render();
    };

    window.openReportEventCenter = function (tab = 'stats') {
        const data = resolvePeriodData();
        if (data?._range) window.openEventCenter(tab, { ...data._range, label: getPeriodRangeLabel(state.period, state.periodOffsets[state.period] || 0) });
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('sunburst-svg')) return;
        if (document.body.id === 'report-standalone') {
            state.period = 'month';
            bindEvents();
            render();
        }
    });
})();
