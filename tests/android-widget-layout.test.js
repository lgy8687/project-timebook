const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('widget layouts use only views supported by Android RemoteViews', () => {
    const allowed = new Set(['LinearLayout', 'FrameLayout', 'RelativeLayout', 'GridLayout', 'TextView', 'Button', 'ImageView', 'ImageButton', 'Chronometer', 'ProgressBar', 'TextClock', 'AnalogClock', 'ListView', 'GridView', 'StackView', 'ViewFlipper', 'AdapterViewFlipper', 'ViewStub']);
    for (const name of ['main_widget.xml', 'main_widget_compact.xml', 'main_widget_row.xml']) {
        const source = fs.readFileSync(path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'layout', name), 'utf8');
        for (const match of source.matchAll(/<([A-Za-z][\w.]*)\b/g)) {
            assert.ok(allowed.has(match[1]), `${name}: unsupported RemoteViews element ${match[1]}`);
        }
    }
});

test('widget opens the app and transparency changes backgrounds only', () => {
    const root = path.join(__dirname, '..', 'android', 'app', 'src', 'main');
    const provider = fs.readFileSync(path.join(root, 'java', 'io', 'github', 'lgy8687', 'timebook', 'MainActivityWidget.java'), 'utf8');
    const settings = fs.readFileSync(path.join(root, 'java', 'io', 'github', 'lgy8687', 'timebook', 'WidgetSettingsActivity.java'), 'utf8');
    assert.match(provider, /new Intent\(context, MainActivity\.class\)/);
    assert.match(provider, /R\.id\.row_background, "setImageAlpha"/);
    assert.match(provider, /R\.id\.widget_empty_background, "setImageAlpha"/);
    assert.doesNotMatch(provider, /R\.id\.row_(?:name|timer|duration), "setImageAlpha"/);
    assert.match(settings, /背景透明度/);
    assert.match(settings, /putInt\("background_opacity"/);
});

test('activity selection provides both bulk actions and a compact resizable widget', () => {
    const root = path.join(__dirname, '..', 'android', 'app', 'src', 'main');
    const settings = fs.readFileSync(path.join(root, 'java', 'io', 'github', 'lgy8687', 'timebook', 'WidgetSettingsActivity.java'), 'utf8');
    const provider = fs.readFileSync(path.join(root, 'java', 'io', 'github', 'lgy8687', 'timebook', 'MainActivityWidget.java'), 'utf8');
    const info = fs.readFileSync(path.join(root, 'res', 'xml', 'main_widget_info.xml'), 'utf8');
    assert.match(settings, /setAll\(boxes, true\)/);
    assert.match(settings, /setAll\(boxes, false\)/);
    assert.match(settings, /new android\.widget\.ScrollView/);
    assert.doesNotMatch(settings, /setMultiChoiceItems/);
    assert.match(provider, /onAppWidgetOptionsChanged/);
    assert.doesNotMatch(provider, /OPTION_APPWIDGET_MIN_HEIGHT/);
    assert.match(provider, /i < visibleRows\.size\(\)/);
    assert.match(info, /android:resizeMode="horizontal\|vertical"/);
    assert.match(info, /android:minResizeHeight="48dp"/);
});

test('widget chronometer uses the current segment from buildWidgetSnapshot', () => {
    const root = path.join(__dirname, '..');
    const activity = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/github/lgy8687/timebook/MainActivity.java'), 'utf8');
    const provider = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/github/lgy8687/timebook/MainActivityWidget.java'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(activity, /evaluateJavascript\("buildWidgetSnapshot\(\)"/);
    assert.doesNotMatch(activity, /getTodaySegments\(\)/);
    assert.match(provider, /segmentMs/);
    assert.match(provider, /totalMs/);
    const snapshot = app.slice(app.indexOf('function buildWidgetSnapshot('), app.indexOf('\nconst UNRECORDED_COLOR'));
    const now = 10 * 3600000;
    const context = {
        nowSecondMs: () => now,
        formatBeijingDate: () => '2026-10-14',
        beijingPeriodStart: () => 0,
        DAY_MS: 86400000,
        cats: [{ name: '工作', subs: ['办公'], color: '#112233' }],
        shortcuts: [],
        unlocatedLogs: [],
        current: { l1: '工作', l2: '办公', startTime: now - 600000 },
        getTodaySegments: () => [
            { l1: '工作', l2: '办公', clippedStart: 0, clippedEnd: 3 * 3600000, parallel: false },
            { l1: '工作', l2: '办公', clippedStart: now - 600000, clippedEnd: now, live: true, parallel: false }
        ],
        logSegmentColor: () => '#123456',
        getCat: () => ({ color: '#112233' })
    };
    vm.createContext(context);
    vm.runInContext(snapshot, context);
    const row = context.buildWidgetSnapshot().rows.find((item) => item.live);
    assert.equal(row.segmentMs, 600000);
    assert.equal(row.totalMs, 3 * 3600000 + 600000);
});
