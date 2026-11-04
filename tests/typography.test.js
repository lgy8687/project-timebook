const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('ordinary CSS sizes use the shared size palette', () => {
    for (const file of ['style.css', 'report.css', 'design-system.css']) {
        const css = fs.readFileSync(path.join(root, file), 'utf8');
        assert.doesNotMatch(css, /font-size:\s*(10|11|12|13|14|15|16|17|18|20)px\b/, file);
    }
});

test('event home text roles use semantic tokens', () => {
    const css = fs.readFileSync(path.join(root, 'design-system.css'), 'utf8');
    assert.match(css, /\.event-home-header h2 \{ font-size: var\(--ui-heading-1\)/);
    assert.match(css, /\.event-home-groups button \{ font-size: var\(--ui-body\)/);
    assert.match(css, /\.event-home-card-main small \{ font-size: var\(--ui-caption\)/);
});
