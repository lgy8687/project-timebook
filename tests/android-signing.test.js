const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const test = require('node:test');

const root = path.join(__dirname, '..');
const hasTools = ['keytool', 'openssl'].every((tool) => spawnSync(tool, ['-help']).status === 0);

test('signing installer checks compatibility and preserves existing keys', { skip: !hasTools }, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timebook-signing-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const tools = path.join(dir, 'android/tools');
    fs.mkdirSync(tools, { recursive: true });
    const script = path.join(tools, 'install-local-signing-keystore.sh');
    fs.copyFileSync(path.join(root, 'android/tools/install-local-signing-keystore.sh'), script);
    const source = path.join(dir, 'original key.keystore');
    const dest = path.join(dir, 'android/keystore/timebook-debug.keystore');
    const generated = spawnSync('keytool', ['-genkeypair', '-keystore', source,
        '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey',
        '-keyalg', 'RSA', '-dname', 'CN=Signing regression test', '-validity', '1'], { encoding: 'utf8' });
    assert.equal(generated.status, 0, generated.stderr);
    const certificate = spawnSync('keytool', ['-exportcert', '-keystore', source,
        '-storepass', 'android', '-alias', 'androiddebugkey']);
    assert.equal(certificate.status, 0, certificate.stderr.toString());
    const fingerprint = createHash('sha256').update(certificate.stdout).digest('hex');
    const install = (...args) => spawnSync('bash', [script, ...args], { encoding: 'utf8' });

    assert.notEqual(install().status, 0);
    assert.notEqual(install(source, 'invalid').status, 0);
    assert.notEqual(install(path.join(dir, 'missing'), fingerprint).status, 0);
    assert.notEqual(install(source, '0'.repeat(64)).status, 0);
    assert.equal(fs.existsSync(dest), false);
    const formatted = fingerprint.match(/../g).join(':').toUpperCase();
    const valid = install(source, formatted);
    assert.equal(valid.status, 0, valid.stderr);
    assert.deepEqual(fs.readFileSync(dest), fs.readFileSync(source));
    assert.equal(fs.statSync(dest).mode & 0o777, 0o600);
    assert.notEqual(install(source, fingerprint).status, 0);
    fs.writeFileSync(dest, 'existing key must survive');
    assert.notEqual(install(source, fingerprint).status, 0);
    assert.equal(fs.readFileSync(dest, 'utf8'), 'existing key must survive');
    assert.deepEqual(fs.readdirSync(path.dirname(dest)), ['timebook-debug.keystore']);
});
