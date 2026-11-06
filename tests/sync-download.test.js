const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sync = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
const pull = sync.slice(sync.indexOf('async function pullCloud'), sync.indexOf('async function syncNow'));
const queue = sync.slice(sync.indexOf('function queueUpload'), sync.indexOf('async function signOut'));

test('a cloud download clears the upload timer and holds busy across the write', () => {
    const removeAt = pull.indexOf('localStorage.removeItem');
    assert.ok(removeAt > 0);
    assert.ok(pull.indexOf('clearTimeout(pendingTimer)') < removeAt);
    assert.ok(pull.indexOf('busy = true') < removeAt);
    assert.equal(pull.slice(pull.lastIndexOf('location.reload()')).includes('busy = false'), false);
    assert.match(pull, /busy = false/);
    assert.match(queue, /if \(busy\) return/);
    assert.equal(sync.match(/\^v9_\[A-Za-z0-9_\]\+\$/g).length, 1);
});
