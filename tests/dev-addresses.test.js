const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');
const inspector = fs.readFileSync(path.join(root, 'dev-inspector.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const report = fs.readFileSync(path.join(root, 'report.js'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'docs/design-registry.md'), 'utf8');

test('developer shortcut follows the shared inspector state and drawer exposes two modes', () => {
    assert.match(html, /id="dev-inspector-shortcut"/);
    assert.match(inspector, /shortcut\.setAttribute\('aria-pressed', String\(enabled\)\)/);
    const chooser = app.slice(app.indexOf('function renderDrawerToggle()'), app.indexOf('function renderPicker()'));
    assert.match(chooser, /key: 'columns'/);
    assert.match(chooser, /key: 'flat'/);
    assert.doesNotMatch(chooser, /key: 'stacked'/);
});

function readRegistryArray(name) {
    const match = inspector.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n    \\]);`));
    assert.ok(match, `Unable to read ${name} from dev-inspector.js`);
    return vm.runInNewContext(match[1]);
}

function registeredTemplateCodes() {
    return new Set([...registry.matchAll(/^\| (C\d+) \|/gm)].map(match => match[1]));
}

test('B and Z addresses are unique and every Z has one registered parent B', () => {
    const blocks = readRegistryArray('blocks');
    const submodules = readRegistryArray('submodules');
    const blockCodes = blocks.map(([code]) => code);
    const submoduleCodes = submodules.map(([code]) => code);

    assert.equal(new Set(blockCodes).size, blockCodes.length, 'B code is registered more than once');
    assert.equal(new Set(submoduleCodes).size, submoduleCodes.length, 'Z code is registered more than once');
    assert.equal(blockCodes.some(code => submoduleCodes.includes(code)), false, 'A B code is incorrectly listed as a Z');
    for (const code of submoduleCodes) {
        const parentB = `B${code.match(/^Z(\d+)-/)[1]}`;
        assert.ok(blockCodes.includes(parentB), `${code} has no registered parent ${parentB}`);
    }
});

test('all C references resolve to a registered design template', () => {
    const templates = registeredTemplateCodes();
    for (const [code, , , contract] of [...readRegistryArray('blocks'), ...readRegistryArray('submodules')]) {
        if (contract) assert.ok(templates.has(contract), `${code} refers to missing ${contract}`);
    }
});

test('main rings and parallel duration ranking use separate B addresses', () => {
    const byCode = new Map(readRegistryArray('blocks').map(([code, , selector]) => [code, selector]));
    assert.equal(byCode.get('B17'), '#report-structure-card[data-dev-address-block="B17"]');
    assert.equal(byCode.get('B92'), '#report-structure-card[data-dev-address-block="B92"]');
    assert.match(report, /dataset\.devAddressBlock = isMain \? 'B17' : 'B92'/);
});

test('single-instance B selectors use unique static DOM IDs', () => {
    const blocks = readRegistryArray('blocks');
    for (const [code, , selector, , options = {}] of blocks) {
        if (options.repeatable) continue;
        const direct = selector.match(/^#([\w-]+)$/);
        const workflow = selector.match(/^#([\w-]+)\[data-dev-address-block="(B\d+)"\] #(\w[\w-]*)$/);
        const stateScoped = selector.match(/^#([\w-]+)\[data-dev-address-block="(B\d+)"\]$/);
        assert.ok(direct || workflow || stateScoped, `${code} must use one unique ID selector or a declared workflow-scoped ID: ${selector}`);
        if (direct) {
            const count = [...html.matchAll(new RegExp(`\\bid=["']${direct[1]}["']`, 'g'))].length;
            assert.equal(count, 1, `${code} must point to one unique DOM id; found ${count}: ${selector}`);
        } else if (workflow) {
            assert.equal(workflow[2], code, `${code} selector is scoped to a different rendered state`);
            for (const id of [workflow[1], workflow[3]]) {
                const count = [...html.matchAll(new RegExp(`\\bid=["']${id}["']`, 'g'))].length;
                assert.equal(count, 1, `${code} requires unique DOM id #${id}; found ${count}`);
            }
        } else {
            assert.equal(stateScoped[2], code, `${code} selector is scoped to a different rendered state`);
            assert.equal([...html.matchAll(new RegExp(`\\bid=["']${stateScoped[1]}["']`, 'g'))].length, 1,
                `${code} requires unique DOM id #${stateScoped[1]}`);
        }
    }
});

test('backfill form state changes the B and C address independently of its entry origin', () => {
    const blocks = readRegistryArray('blocks');
    const byCode = new Map(blocks.map(([code, , selector, contract]) => [code, { selector, contract }]));
    const selector = code => `#calendar-backfill-modal[data-dev-address-block="${code}"] #calendar-backfill-card`;
    assert.deepEqual(byCode.get('B11'), { selector: selector('B11'), contract: 'C04' });
    assert.deepEqual(byCode.get('B12'), { selector: selector('B12'), contract: 'C25' });
    assert.deepEqual(byCode.get('B46'), { selector: selector('B46'), contract: 'C26' });
    assert.deepEqual(byCode.get('B47'), { selector: selector('B47'), contract: 'C27' });
    assert.match(html, /id="calendar-backfill-modal"[^>]*data-dev-address-block="B55"/);
    assert.match(app, /const CALENDAR_BACKFILL_ORIGINS = new Set\(\['calendar-add', 'unassigned-gap', 'supplement-edit'\]\)/);
    assert.match(app, /function getCalendarBackfillBlockAddress\(kind\)[\s\S]*if \(kind === 'interval'\)[\s\S]*calendarBackfillFromCalendar \? 'B12' : 'B58'[\s\S]*if \(kind === 'untimed'\)[\s\S]*calendarBackfillFromCalendar \? 'B46' : 'B60'/,
        'Each visible backfill composition must resolve to its own B address');
    assert.match(app, /const blockCode = getCalendarBackfillBlockAddress\(kind\)/,
        'The modal must apply the address resolved from the visible state');
    assert.match(app, /modal'\)\.dataset\.devAddressBlock = blockCode/,
        'The active modal state must drive the rendered B selector');
    const originsMatch = app.match(/const CALENDAR_BACKFILL_ORIGINS = new Set\((\[[^\]]+\])\);/);
    assert.ok(originsMatch, 'Recognized backfill origins must be explicitly registered');
    const origins = new Set(vm.runInNewContext(originsMatch[1]));
    const declarations = [...app.matchAll(/function\s+([\w$]+)\s*\([^)]*\)\s*\{/g)];
    const actual = [];
    for (const call of app.matchAll(/\bopenCalendarBackfill\(([^)]*)\)/g)) {
        if (/function\s+$/.test(app.slice(Math.max(0, call.index - 16), call.index))) continue;
        const owner = declarations.filter(item => item.index < call.index).at(-1)?.[1];
        const origin = call[1].match(/,\s*'([^']+)'\s*$/)?.[1];
        assert.ok(origin, `Call from ${owner} must explicitly name its workflow origin`);
        assert.ok(origins.has(origin), `Call from ${owner} uses unregistered backfill origin ${origin}`);
        actual.push(origin);
    }
    assert.deepEqual(new Set(actual), origins, 'Every recognized origin must be used by a real entry point');
    for (const code of ['B11', 'B12', 'B46', 'B47', 'B55', 'B56', 'B57', 'B58', 'B59', 'B60', 'B61']) {
        assert.ok(byCode.has(code), `Backfill interface state ${code} must be registered`);
    }
    assert.match(inspector, /const parentBlock = `B\$\{code\.match\(\/\^Z\(\\d\+\)-\//,
        'Submodule display must enforce Z parent ownership when the backfill modal is open');
    assert.match(inspector, /element\.closest\('\[data-dev-address-block\]'\)[\s\S]*element\.dataset\.devBlockCode === activeCode[\s\S]*dev-inspector-badge--block/,
        'A modal state change must remove the prior B badge before adding the new one');
});

test('every backfill interface composition maps to its own B address', () => {
    const source = app.match(/function getCalendarBackfillBlockAddress\(kind\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(source, 'Backfill state resolver must exist');
    const context = { calendarBackfillTarget: null, calendarBackfillFromCalendar: true, recordMode: 'journal' };
    const resolve = vm.runInNewContext(`${source}; getCalendarBackfillBlockAddress`, context);
    const cases = [
        [{ kind: null, target: null, fromCalendar: true, mode: 'journal' }, 'B55'],
        [{ kind: null, target: {}, fromCalendar: true, mode: 'journal' }, 'B11'],
        [{ kind: null, target: {}, fromCalendar: false, mode: 'journal' }, 'B56'],
        [{ kind: null, target: null, fromCalendar: true, mode: 'continuous' }, 'B57'],
        [{ kind: 'interval', target: {}, fromCalendar: true }, 'B12'],
        [{ kind: 'interval', target: {}, fromCalendar: false }, 'B58'],
        [{ kind: 'interval', target: null, fromCalendar: true }, 'B59'],
        [{ kind: 'untimed', target: {}, fromCalendar: true }, 'B46'],
        [{ kind: 'untimed', target: {}, fromCalendar: false }, 'B60'],
        [{ kind: 'untimed', target: null, fromCalendar: true }, 'B61'],
        [{ kind: 'event', target: null, fromCalendar: true }, 'B47']
    ];
    for (const [state, expected] of cases) {
        Object.assign(context, {
            calendarBackfillTarget: state.target,
            calendarBackfillFromCalendar: state.fromCalendar,
            recordMode: state.mode || 'journal'
        });
        const result = resolve(state.kind);
        assert.equal(result, expected, `Unexpected B for ${JSON.stringify(state)}`);
    }
    const blocks = new Set(readRegistryArray('blocks').map(([code]) => code));
    for (const [, expected] of cases) assert.ok(blocks.has(expected), `Mapped interface ${expected} must be registered`);
});

test('backfill target options belong to the target-selection interface B55', () => {
    const submodules = readRegistryArray('submodules');
    for (const code of ['Z55-1', 'Z55-2']) {
        assert.ok(submodules.some(([candidate]) => candidate === code), `${code} must be registered under B55`);
    }
    assert.ok(!submodules.some(([code]) => ['Z11-1', 'Z11-3'].includes(code)),
        'Target-list controls must not remain children of the B11 choice interface');
});

test('repeated record cards share B only when they are the same rendered prototype', () => {
    const blocks = new Map(readRegistryArray('blocks').map(([code, label, selector, , options = {}]) => [code, { label, selector, options }]));
    assert.equal(blocks.get('B04').selector, '.log-flow-card--main-log:not(.log-flow-card--unassigned-main)');
    assert.equal(blocks.get('B05').selector, '.log-flow-card--parallel-log');
    assert.equal(blocks.get('B50').selector, '.log-flow-card--unassigned-main:not(.unassigned-main-card--live)');
    assert.equal(blocks.get('B85').selector, '.unassigned-live-wrap');
    assert.equal(blocks.get('B04').options.repeatable, true);
    assert.equal(blocks.get('B05').options.repeatable, true);
    assert.match(app, /log-flow-card--main-log log-flow-card--unassigned-main/,
        'Unassigned cards must not be accidentally swept into the completed-main prototype');
});

test('report timeline functional views have distinct, state-scoped B addresses and templates', () => {
    const blocks = readRegistryArray('blocks');
    const byCode = new Map(blocks.map(([code, , selector, contract]) => [code, { selector, contract }]));
    assert.deepEqual(byCode.get('B18'), { selector: '#timeline-card-a[data-dev-address-block="B18"]', contract: 'C23' });
    assert.deepEqual(byCode.get('B42'), { selector: '#timeline-card-b[data-dev-address-block="B42"]', contract: 'C23' });
    assert.deepEqual(byCode.get('B45'), { selector: '#timeline-card-a[data-dev-address-block="B45"]', contract: 'C24' });
    assert.match(report, /tl\.kind === 'day'[\s\S]*\? \(suffix === 'a' \? 'B18' : 'B42'\)[\s\S]*: tl\.kind === 'bars' \? 'B45'/,
        'Timeline rendering must map daily halves and period-composition bars to separate B addresses');
    assert.match(report, /delete card\.dataset\.devAddressBlock/,
        'Hidden or empty timeline cards must not keep a stale B address');
    assert.match(inspector, /element\.closest\('\[data-dev-address-block\]'\)[\s\S]*const activeCode = addressOwner\?\.dataset\.devAddressBlock[\s\S]*element\.dataset\.devBlockCode === activeCode[\s\S]*dev-inspector-badge--block/,
        'Developer mode must replace the old B badge whenever a reused element changes functional view');
    assert.match(inspector, /const parentBlock = `B\$\{code\.match\(\/\^Z\(\\d\+\)-\//,
        'Submodule display must derive and enforce its parent B when a workflow modal is active');
    assert.match(html, /id="timeline-card-a"[^>]*data-dev-address-kind="timeline"/);
    assert.match(html, /id="timeline-card-b"[^>]*data-dev-address-kind="timeline"/);
});
