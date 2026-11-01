const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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
    assert.match(settings, /setAll\(dialog, checked, true\)/);
    assert.match(settings, /setAll\(dialog, checked, false\)/);
    assert.match(provider, /onAppWidgetOptionsChanged/);
    assert.doesNotMatch(provider, /OPTION_APPWIDGET_MIN_HEIGHT/);
    assert.match(provider, /i < visibleRows\.size\(\)/);
    assert.match(info, /android:resizeMode="horizontal\|vertical"/);
    assert.match(info, /android:minResizeHeight="48dp"/);
});
