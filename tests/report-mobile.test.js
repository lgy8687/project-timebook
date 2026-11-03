const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('yearly event trend requires count mode and at least three daily samples', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'report.js'), 'utf8');
    assert.match(source, /mode === 'count' && data.period === 'year' && data.daily\?\.length >= 3/);
    assert.doesNotMatch(source, /box.prepend\(trend\)/);
});

test('event trend bars have a width cap instead of filling sparse periods', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'report.css'), 'utf8');
    assert.match(css, /\.event-trend-bar\s*\{[^}]*max-width:20px/);
});
