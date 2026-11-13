import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const output = join(root, 'android/app/build/generated/webAssets');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of readdirSync(root)) {
    if (/\.(js|css)$/.test(file)) {
        cpSync(join(root, file), join(output, file));
    }
}
const appPath = join(output, 'app.js');
writeFileSync(appPath, readFileSync(appPath, 'utf8').replace(
    '示例加载失败，请检查网络后重试。', '本地示例加载失败，请重试。'));
cpSync(join(root, 'assets'), join(output, 'assets'), { recursive: true });
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace('<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>',
    '<link rel="stylesheet" href="offline.css">');
html = html.replace(/\s*<button id="dev-inspector-shortcut"[\s\S]*?<\/button>/, '');
html = html.replace(/\s*<label class="dev-inspector-setting">[\s\S]*?<\/label>/, '');
html = html.replace(/\s*<div id="demo-mode-layer"[\s\S]*?<\/div><\/div><\/div>/, '');
html = html.replace('<script src="demo-sandbox.js?v=3"></script>',
    '<script>window.__timebookOffline = true;</script>');
html = html.replace(/(<div id="cache-buster"[^>]*>)([^<]+)/,
    '$1$2 · Android 0.12 单机内测');
if (/(?:src|href)="https?:\/\//.test(html)) throw new Error('Remote HTML dependency found');
writeFileSync(join(output, 'index.html'), html);
execFileSync(process.execPath, [join(here, 'node_modules/@tailwindcss/cli/dist/index.mjs'),
    '-i', join(here, 'offline.css'), '-o', join(output, 'offline.css'), '--minify'], { stdio: 'inherit', cwd: root });
console.log(`Offline assets prepared: ${output}`);
