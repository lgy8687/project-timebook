const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('offline APK has no internet permission and loads only packaged assets', () => {
    assert.doesNotMatch(read('android/app/src/main/AndroidManifest.xml'), /android.permission.INTERNET/);
    const activity = read('android/app/src/main/java/io/github/lgy8687/timebook/MainActivity.java');
    assert.match(activity, /https:\/\/appassets.androidplatform.net\/assets\/index.html/);
    assert.match(activity, /setBlockNetworkLoads\(true\)/);
    assert.match(activity, /WebViewAssetLoader.AssetsPathHandler/);
    assert.match(activity, /headers.put\("Access-Control-Allow-Origin", "\*"\)/);
    assert.doesNotMatch(activity, /github.io/);
    assert.match(read('android/app/build.gradle'), /dependsOn prepareWebAssets/);
});

test('source page has no Supabase client, sync scripts, or cloud login', () => {
    const html = read('index.html');
    assert.doesNotMatch(html, /supabase/i);
    assert.doesNotMatch(html, /sync(?:-config)?\.js/);
    assert.doesNotMatch(html, /云端同步|timebookSync/);
    assert.equal(fs.existsSync(path.join(root, 'sync.js')), false);
    assert.equal(fs.existsSync(path.join(root, 'sync-config.js')), false);
    assert.equal(fs.existsSync(path.join(root, 'supabase')), false);
    assert.doesNotMatch(read('android/tools/offline.css'), /timebook-sync-panel/);
    assert.doesNotMatch(read('android/tools/prepare-web-assets.mjs'), /supabase|sync\.js/);
    assert.match(read('android/tools/prepare-web-assets.mjs'), /dev-inspector-shortcut/);
    assert.match(read('android/tools/prepare-web-assets.mjs'), /demo-mode-layer/);
});

test('generated page contains local resources, demo and backup but no cloud dependencies', {
    skip: !fs.existsSync(path.join(root, 'android/app/build/generated/webAssets/index.html'))
}, () => {
    const dir = 'android/app/build/generated/webAssets/';
    const html = read(dir + 'index.html');
    assert.match(html, /__timebookOffline = true/);
    assert.match(html, /href="offline.css"/);
    assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
    assert.doesNotMatch(html, /<script src="sync(?:-config)?\.js/);
    assert.doesNotMatch(html, /supabase|云端同步|timebookSync/i);
    assert.match(html, /src="backup.js/);
    assert.doesNotMatch(html, /dev-inspector-shortcut|demo-mode-layer|10月示例/);
    assert.doesNotMatch(html, /src="demo-sandbox\.js/);
    for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
        assert.ok(fs.existsSync(path.join(root, dir, match[1])), `Missing asset: ${match[1]}`);
    }
    const css = read(dir + 'offline.css');
    assert.ok(css.length > 10000);
    assert.match(css, /\.flex\{/);
    assert.doesNotMatch(css, /\.timebook-sync-panel/);
});
