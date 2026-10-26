/**
 * Complementary consumer receiving for partial refusal and stale-result retirement.
 * All models come from ordinary original-observation imports. No fitted model,
 * solver policy, application state, or observation is injected into the page.
 * WORLDLAW_RECEIVING_URL may point to a maintained server in an extracted package;
 * otherwise the maintained server is launched from this source tree.
 */
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createSession} from '../src/session.mjs';
import {compareStudioDynamics} from '../src/science/studio-dynamics-comparison.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';

const observations = (length, range, torque) => Array.from({length}, (_, i) => {
  const position = range * Math.sin(i * .731 + .2);
  const rate = .35 * Math.cos(i * 1.117 + .4);
  const command = .4 * Math.sin(i * 1.331 + .7);
  return {command, position, rate, jointTorque: torque({command, position, rate})};
});
const original = {
  schema: 'worldlaw.observations/v1',
  source: {label: 'Authored small-angle receiving control; no physical acquisition', kind: 'synthetic_analytic_fixture'},
  observations: observations(64, .12, ({command, position, rate}) => command - 2.8 * Math.sin(position) - .15 * rate),
  heldOut: [],
};
const replacement = {
  schema: 'worldlaw.observations/v1',
  source: {label: 'Authored replacement spring control; no physical acquisition', kind: 'synthetic_analytic_fixture'},
  observations: observations(27, 1.1, ({command, position, rate}) => command - 1.6 * position - .3 * rate),
  heldOut: [],
};
const release = {position: 1.3, rate: 0};
const partialSettings = {duration: .6, dt: .02, inertia: .001, command: 0};
const ordinarySettings = {...partialSettings, inertia: .8};
const firstSession = createSession(original), nextSession = createSession(replacement);
const partial = compareStudioDynamics(firstSession.discovery, release, partialSettings);
const ordinary = compareStudioDynamics(firstSession.discovery, release, ordinarySettings);
const next = compareStudioDynamics(nextSession.discovery, release, ordinarySettings);
const allRefused = compareStudioDynamics(firstSession.discovery, release, {...ordinarySettings, duration: 100});
assert.equal(partial.status, 'incomplete', 'The source must produce real mixed numerical outcomes.');
assert.equal(ordinary.status, 'completed');
assert.equal(next.status, 'completed');
assert.equal(allRefused.status, 'refused');
assert.ok(partial.completedCount > 0 && partial.refusedCount > 0);
assert.notDeepEqual(partial.results.map(row => row.id), next.results.map(row => row.id));

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = process.env.BROWSER_ARTIFACT_DIR || resolve('.receipts/studio-comparison-receiving');
await mkdir(dir, {recursive: true});
const checks = [], mark = name => {checks.push(name); console.log('PASS ' + name);};
const errors = [], badRequests = [], external = [];
const moduleResponses = new Set();
let server, browser;
let target = process.env.WORLDLAW_RECEIVING_URL;
const launchMode = target ? 'caller-supplied-maintained-server' : 'source-tree-maintained-server';

try {
  if (!target) {
    const {createProductServer} = await import('../server.mjs');
    server = createProductServer();
    await new Promise((ok, bad) => {server.once('error', bad); server.listen(0, '127.0.0.1', ok);});
    target = 'http://127.0.0.1:' + server.address().port;
  }
  const origin = new URL(target).origin;
  browser = await chromium.launch({headless: true, chromiumSandbox: true,
    ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath: process.env.BROWSER_EXECUTABLE_PATH} : {})});
  const context = await browser.newContext({viewport: {width: 1440, height: 1050}, reducedMotion: 'reduce'});
  const sandboxPage = await context.newPage(), cdp = await context.newCDPSession(sandboxPage);
  const sandbox = await requireChromiumSandbox({send: (method, params) => cdp.send(method, params)});
  await writeFile(resolve(dir, 'sandbox.json'), JSON.stringify(sandbox, null, 2) + '\n');
  await sandboxPage.close();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) badRequests.push({url: response.url(), status: response.status()});
    if (response.ok()) moduleResponses.add(new URL(response.url()).pathname);
  });
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith('blob:') && !url.startsWith('data:') && new URL(url).origin !== origin) external.push(url);
  });
  const notebook = () => page.evaluate(() => localStorage.getItem('worldlaw.notebook.v1'));
  const settleFrames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const importSource = async source => {
    await page.locator('#observation-file').setInputFiles({name: 'receiving-original.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source))});
    await page.waitForFunction(label => document.querySelector('#source-name').textContent === label, source.source.label);
    assert.equal(await page.locator('#sample-count').innerText(), String(source.observations.length));
  };
  const configure = async settings => {
    for (const [id, value] of Object.entries({'initial-angle': release.position, 'initial-rate': release.rate,
      inertia: settings.inertia, duration: settings.duration, 'simulation-command': settings.command})) {
      await page.locator('#' + id).fill(String(value));
    }
  };
  const compare = async expected => {
    await page.locator('#compare-studio-laws').click();
    await page.waitForFunction(status => document.querySelector('#studio-comparison-status').dataset.state === status
      && !document.querySelector('#compare-studio-laws').disabled, expected.status);
    const actual = await page.locator('#studio-comparison-outcomes tr').evaluateAll(rows => rows.map(row => ({
      id: row.dataset.modelId, status: row.dataset.status, text: row.textContent,
    })));
    assert.deepEqual(actual.map(({id, status}) => ({id, status})), expected.results.map(({id, status}) => ({id, status})));
    for (let i = 0; i < actual.length; i++) if (expected.results[i].status === 'refused') {
      assert.ok(actual[i].text.includes('Refused:'));
      assert.ok(actual[i].text.includes(expected.results[i].error.message));
    }
    return actual;
  };
  const assertRetired = async () => {
    await settleFrames();
    assert.equal(await page.locator('#studio-comparison-transport').isVisible(), false);
    assert.equal(await page.locator('#studio-comparison-outcomes tr').count(), 0);
    assert.equal(await page.locator('#studio-comparison-chart polyline').count(), 0);
    assert.equal(await page.locator('#compare-studio-laws').isEnabled(), true);
    assert.doesNotMatch(await page.locator('#mechanism-canvas').getAttribute('aria-label'), /Synchronized numerical predictions/);
  };

  await page.goto(target);
  await page.waitForFunction(() => document.querySelector('#sample-count').textContent === '64');
  await importSource(original);
  const sourceBytes = await notebook();
  await configure(partialSettings);
  await compare(partial);
  await page.waitForFunction(() => document.querySelector('#mechanism-canvas').getAttribute('aria-label').includes('Incomplete comparison'));
  assert.match(await page.locator('#studio-comparison-status').innerText(), new RegExp(partial.completedCount + ' of ' + partial.candidateCount));
  assert.match(await page.locator('.motion-comparison-transport-note').innerText(), /surviving paths do not establish agreement/);
  const successfulIds = partial.results.filter(row => row.status === 'completed').map(row => row.id);
  assert.deepEqual(await page.locator('#studio-comparison-legend button').evaluateAll(nodes => nodes.map(node => node.dataset.modelId)), successfulIds);
  await page.locator('.motion-comparison-details summary').click();
  await page.waitForFunction(n => document.querySelectorAll('#studio-comparison-chart polyline').length === n, partial.completedCount);
  assert.equal(await notebook(), sourceBytes);
  await page.locator('.instrument-stage').screenshot({path: resolve(dir, 'partial-ensemble-stage.png')});
  await page.locator('#studio-motion-comparison').screenshot({path: resolve(dir, 'partial-ensemble-refusals.png')});
  mark('ordinary original-source import retains every law and explicit numerical refusal in a genuinely incomplete ensemble');

  await configure({...ordinarySettings, duration: 100});
  await compare(allRefused);
  assert.equal(await page.locator('#studio-comparison-transport').isVisible(), false);
  assert.equal(await page.locator('#studio-comparison-chart polyline').count(), 0);
  assert.match(await page.locator('#studio-comparison-chart').innerText(), /No complete predicted path/);
  assert.equal(await notebook(), sourceBytes);
  mark('complete-set work refusal keeps all original refusal rows and cannot retain successful paths');

  await configure(ordinarySettings);
  await compare(ordinary);
  await page.locator('#hypothesis-list button[aria-pressed="false"]').first().click();
  await assertRetired();
  assert.equal(await notebook(), sourceBytes);
  await compare(ordinary);
  mark('ordinary inspected-law selection retires the prior comparison without changing evidence or competitive membership');

  await page.locator('#clear-studio-comparison').click();
  // These are ordinary DOM actions in one browser task, before the comparison's
  // scheduled animation frame. The assertion proves the queued action was pending.
  for (const action of ['dynamics-input', 'inspected-law']) {
    const pending = await page.evaluate(action => {
      const run = document.querySelector('#compare-studio-laws');
      run.click();
      const wasPending = run.disabled;
      if (action === 'dynamics-input') {
        const input = document.querySelector('#initial-rate');
        input.value = '.05';
        input.dispatchEvent(new Event('input', {bubbles: true}));
      } else document.querySelector('#hypothesis-list button[aria-pressed="false"]').click();
      return wasPending;
    }, action);
    assert.equal(pending, true, 'The comparison must actually be awaiting its frame.');
    await assertRetired();
    assert.equal(await notebook(), sourceBytes);
    await configure(ordinarySettings);
  }
  await compare(ordinary);
  mark('input and inspected-law changes during the pending animation frame prevent stale publication and leave comparison usable');

  await importSource(replacement);
  await assertRetired();
  const replacementBytes = await notebook();
  assert.notEqual(replacementBytes, sourceBytes);
  const saved = JSON.parse(replacementBytes);
  assert.deepEqual(saved.base.observations, nextSession.base.observations);
  assert.equal(saved.discovery, undefined);
  assert.equal(saved.trajectory, undefined);
  assert.equal(JSON.stringify(saved).includes('worldlaw.studio-dynamics-comparison'), false);
  await compare(next);
  assert.equal(await notebook(), replacementBytes);
  await page.reload();
  await page.waitForFunction(label => document.querySelector('#source-name').textContent === label, replacement.source.label);
  await assertRetired();
  assert.equal(await notebook(), replacementBytes);
  await configure(ordinarySettings);
  await compare(next);
  assert.equal(await notebook(), replacementBytes);
  mark('replacement source and browser reload discard derived paths; explicit comparison uses only the replacement source competitive set');

  const expectedModules = ['/src/science/studio-comparison-panel.mjs', '/src/science/studio-comparison-view.mjs',
    '/src/science/studio-dynamics-comparison.mjs', '/src/science/studio-dynamics.mjs'];
  for (const path of expectedModules) assert.ok(moduleResponses.has(path), 'The maintained entry point must serve ' + path);
  assert.deepEqual(errors, []);
  assert.deepEqual(badRequests, []);
  assert.deepEqual(external, []);
  const sourceHashes = {};
  for (const path of expectedModules) sourceHashes[path.slice(1)] = createHash('sha256')
    .update(await readFile(new URL('..' + path, import.meta.url))).digest('hex');
  const receipt = {browser: await browser.version(), launchMode, checks, localOracleSourceHashes: sourceHashes,
    loadedModules: expectedModules, originalCandidates: partial.candidateCount,
    partialResults: partial.results.map(({id, status, error}) => ({id, status, ...(error ? {error} : {})})),
    replacementCandidates: next.candidateCount, errors, badRequests, external,
    scope: 'Software receiving from authored original observations through the maintained browser entry point. Models are fitted in the application. Refused numerical paths remain refused; no physical acquisition, accuracy or calibrated uncertainty claim. Local oracle hashes identify the comparison expectation source, not independently verified server bytes.'};
  await writeFile(resolve(dir, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(ok => server.close(ok));
}
