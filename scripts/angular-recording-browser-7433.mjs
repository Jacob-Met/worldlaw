/** Focused actual-consumer receiving; uses the normal product server and owner planner. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(process.env.WORLDLAW_RECEIVE_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const output = resolve(process.env.BROWSER_ARTIFACT_DIR || resolve(root, '.receipts/angular-recording-7433'));
const {createProductServer} = await import(pathToFileURL(resolve(root, 'server.mjs')));
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir(output, {recursive: true});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function sources(directory = '') {
  const result = [];
  for (const entry of await readdir(resolve(root, directory), {withFileTypes: true})) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = directory ? directory + '/' + entry.name : entry.name;
    if (entry.isDirectory() && ['src', 'examples'].some(prefix => path === prefix || path.startsWith(prefix + '/'))) result.push(...await sources(path));
    else if (entry.isFile() && /\.(mjs|html|css|json|csv)$/.test(path)) result.push(path);
  }
  return result.sort();
}
async function manifest() {
  const files = await Promise.all((await sources()).map(async path => ({path, sha256: sha256(await readFile(resolve(root, path)))})));
  return {commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    status: execFileSync('git', ['status', '--short'], {cwd: root, encoding: 'utf8'}).trim(), files};
}
const before = await manifest();
await writeFile(resolve(output, 'source-manifest.json'), JSON.stringify(before, null, 2) + '\n');
const checks = [], errors = [], failedRequests = [], metrics = {}, layouts = [];
const copyOnly = process.env.WORLDLAW_RECEIVE_FOCUS === 'copy';
const mark = name => {checks.push(name); console.log('PASS ' + name);};
const server = createProductServer();
await new Promise((yes, no) => {server.once('error', no); server.listen(0, '127.0.0.1', yes);});
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({headless: true, ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath: process.env.BROWSER_EXECUTABLE_PATH} : {})});
  const context = await browser.newContext({viewport: {width: 1440, height: 1100}, reducedMotion: 'reduce'});
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.url().startsWith(origin) && response.status() >= 400) failedRequests.push({url: response.url(), status: response.status()});});
  const p = name => page.locator(`#angular-recording-panel #recording-${name}`);
  const ready = () => page.waitForFunction(() => document.getElementById('challenge-workspace')?.getAttribute('aria-busy') === 'false');
  const compare = async () => {
    await p('plan').focus(); await page.keyboard.press('Enter');
    await p('results').waitFor({state: 'visible'});
    await page.waitForFunction(() => document.getElementById('angular-recording-panel')?.shadowRoot?.querySelector('section')?.getAttribute('aria-busy') === 'false');
    assert.equal(await p('error').isVisible(), false);
  };
  const download = async (locator, filename) => {
    const event = page.waitForEvent('download'); await locator.focus(); await page.keyboard.press('Enter');
    const path = resolve(output, filename); await (await event).saveAs(path);
    return {path, value: JSON.parse(await readFile(path, 'utf8'))};
  };
  const fillDesign = async () => {
    for (const [name, value] of [['position-min', '-2.2'], ['position-max', '2.2'], ['rate-min', '-.6'], ['rate-max', '.6'], ['durations', '2, 4, 8']]) await p(name).fill(value);
  };
  const importBundle = async (value, name) => {
    await page.locator('#bundle-file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value))});
    await page.waitForFunction(label => document.getElementById('source-name')?.textContent === label, value.label);
    await ready(); assert.equal(await page.locator('#error').isVisible(), false);
  };
  const assertRequest = request => {
    assert.equal(request.schema, 'worldlaw.angular-recording-request/v1');
    assert.equal(request.kind, 'requested_protocol_not_observed_evidence');
    assert.equal(request.inertia, null); assert.equal(request.acquisitionPerformed, false); assert.equal(request.physicalSetupVerified, false);
    for (const key of ['samples', 'predictions', 'command', 'trainingRuns', 'challengeRuns']) assert.equal(Object.hasOwn(request, key), false);
    assert.doesNotMatch(JSON.stringify(request), /N·m|kg·m|worldlaw\.torque-model/);
  };

  await page.goto(origin + '/trajectory.html'); await ready();
  if (!copyOnly) {
  assert.equal(await page.locator('#angular-recording-panel').isVisible(), false);
  await page.locator('#example-choice').selectOption('measured'); await page.locator('#load-example').click();
  await page.waitForFunction(() => document.getElementById('source-kind')?.textContent.includes('MEASURED')); await ready();
  await page.locator('input[name="method"][value="weak"]').check(); await page.locator('#refit').click();
  await page.waitForFunction(() => document.getElementById('method-badge')?.textContent === 'WINDOW ANGULAR FIT'); await ready();
  assert.equal(await page.locator('#angular-recording-panel').isVisible(), true);
  assert.equal(await page.locator('#experiment-panel').isVisible(), false);
  assert.equal(await page.locator('#noise-sigma').inputValue(), '0.01');
  for (const [name, value] of [['position-min', '-.3'], ['position-max', '.3'], ['rate-min', '-.2'], ['rate-max', '.2']]) await p(name).fill(value);
  await compare();
  assert.equal(await p('duration-rows').locator('tr').count(), 3);
  assert.match(await p('status-title').innerText(), /Below the requested spread/);
  assert.match(await p('fit').innerText(), /7\.55×/); assert.match(await p('fit').innerText(), /mismatch/i);
  assert.equal(await p('export').isDisabled(), true);
  assert.equal(await p('release').isVisible(), false);
  metrics.measured = {noiseSigma: await page.locator('#noise-sigma').inputValue(), fit: await p('fit').innerText(), durations: await p('duration-rows').innerText(), requestAvailable: false};
  await page.locator('#angular-recording-panel').screenshot({path: resolve(output, 'measured-no-request-1440.png')});
  mark('actual PASCO weak fit keeps its fixed-noise mismatch and all three negative duration outcomes without export');

  const original = JSON.parse(await readFile(resolve(root, 'examples/trajectory-ambiguous-92be.json'), 'utf8'));
  const convert = run => ({id: run.id, label: run.label, kind: 'synthetic', inertia: null, dynamics: 'unforced_scalar_rotation', initialRate: run.initialRate,
    source: {label: 'Existing controlled synthetic recording, viewed without physical torque scale', recordingId: `independent-angular-${run.id}`},
    samples: run.samples.map(({time, position}) => ({time, position}))});
  const bundle = {schema: 'worldlaw.angular-bundle/v1', label: 'Independent synthetic angular panel receiving',
    units: {time: 's', position: 'rad', initialRate: 'rad/s'}, trainingRuns: original.trainingRuns.map(convert), challengeRuns: original.challengeRuns.map(convert)};
  await importBundle(bundle, 'synthetic-angular.json');
  const notebookBefore = await download(page.locator('#export-notebook'), 'synthetic-before-planning.json');
  await fillDesign(); await compare();
  assert.match(await p('status-title').innerText(), /^4 seconds/);
  assert.match(await p('ensemble').innerText(), /8 training-ranked models considered; 14 competitive alternatives omitted/);
  assert.match(await p('extrapolation').innerText(), /leaves the training range/);
  assert.equal(await p('chart').locator('svg path').count(), 8);
  const requested = await download(p('export'), 'synthetic-recording-request.json'); assertRequest(requested.value);
  assert.equal(requested.value.duration, 4); assert.deepEqual(requested.value.sourceTrainingRunIds, bundle.trainingRuns.map(run => run.id));
  const notebookAfter = await download(page.locator('#export-notebook'), 'synthetic-after-planning.json');
  assert.deepEqual(notebookAfter.value, notebookBefore.value);
  metrics.synthetic = {request: requested.value, durations: await p('duration-rows').innerText(), scope: await p('ensemble').innerText()};
  await page.locator('#angular-recording-panel').screenshot({path: resolve(output, 'synthetic-request-1440.png')});
  mark('actual owner planner and angular panel produce a keyboard-exported synthetic request without changing evidence or inventing samples');

  const ranking = await page.locator('#model-list button').evaluateAll(nodes => nodes.map(node => node.dataset.modelId));
  const poisoned = structuredClone(bundle); poisoned.label = 'Independent future perturbation with unchanged training';
  for (const run of poisoned.challengeRuns) for (let i = 1; i < run.samples.length; i++) run.samples[i].position += 4;
  await importBundle(poisoned, 'altered-futures.json');
  assert.equal(await p('export').isDisabled(), true);
  assert.deepEqual(await page.locator('#model-list button').evaluateAll(nodes => nodes.map(node => node.dataset.modelId)), ranking);
  await fillDesign(); await compare();
  const poisonedRequest = await download(p('export'), 'unchanged-request-altered-futures.json');
  assert.deepEqual(poisonedRequest.value, requested.value);
  assert.equal(await p('duration-rows').innerText(), metrics.synthetic.durations);
  mark('altering reserved observed futures leaves fitted ranking, every duration score and the exported request unchanged');

  await p('durations').fill('2, 4');
  assert.equal(await p('export').isDisabled(), true); assert.equal(await p('results').isVisible(), false);
  await compare(); assert.equal(await p('duration-rows').locator('tr').count(), 2);
  await page.locator('#noise-sigma').fill('.02');
  assert.equal(await p('export').isDisabled(), true); assert.equal(await p('plan').isDisabled(), true);
  await page.locator('#noise-sigma').fill('.01'); await page.locator('#refit').click(); await ready();
  assert.equal(await p('export').isDisabled(), true); assert.equal(await p('plan').isDisabled(), false);
  await fillDesign(); await compare();
  await page.locator('input[name="method"][value="weak"]').check();
  assert.equal(await p('export').isDisabled(), true); assert.equal(await p('plan').isDisabled(), true);
  await page.locator('input[name="method"][value="integral"]').check(); await page.locator('#refit').click(); await ready();
  assert.equal(await p('export').isDisabled(), true); assert.equal(await p('plan').isDisabled(), false);
  mark('release, duration, fit-noise and fitting-method edits revoke old requests; unapplied fitting settings block new planning');

  await page.locator('#notebook-file').setInputFiles(notebookAfter.path); await ready();
  await page.waitForFunction(label => document.getElementById('source-name')?.textContent === label, bundle.label);
  assert.equal(await p('export').isDisabled(), true); assert.equal(await p('results').isVisible(), false);
  await fillDesign(); await compare();
  const reopenedRequest = await download(p('export'), 'recomputed-after-notebook-reopen.json');
  assert.deepEqual(reopenedRequest.value, requested.value);
  await page.locator('#notebook-file').setInputFiles(requested.path);
  await page.locator('#error').waitFor({state: 'visible'}); await ready();
  assert.equal(await page.locator('#source-name').innerText(), bundle.label);
  const retained = await download(page.locator('#export-notebook'), 'retained-after-request-as-notebook-refusal.json');
  assert.deepEqual(retained.value, notebookAfter.value);
  mark('portable notebook reopen requires recomputation, and importing a request as observations refuses without changing recorded evidence');

  await p('advanced').locator('summary').focus(); await page.keyboard.press('Enter');
  await p('interval').fill('0'); await p('plan').focus(); await page.keyboard.press('Enter');
  await p('error').waitFor({state: 'visible'});
  assert.equal(await p('export').isDisabled(), true);
  assert.equal(await p('error').evaluate(node => node.getRootNode().activeElement === node), true);
  await p('interval').fill('.04'); await fillDesign(); await compare();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({width, height: 1100});
    const layout = await page.evaluate(() => ({viewport: innerWidth, document: document.documentElement.scrollWidth}));
    assert.ok(layout.document <= width, JSON.stringify(layout)); layouts.push(layout);
    await page.locator('#angular-recording-panel').screenshot({path: resolve(output, `synthetic-request-${width}.png`)});
  }
  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  assert.deepEqual(await manifest(), before, 'Frozen receiving sources changed during the run.');
  mark('keyboard validation focuses its refusal and the actual shadow-root panel fits desktop and narrow mobile without page or asset failures');
  }

  // A separate analytic component scene reaches metadata cases that normal
  // discovery fixtures do not expose. It uses the actual duration/owner planners,
  // never a fabricated physical recording or an injected UI result.
  await page.evaluate(async () => {
    const [{createAngularRecordingPanel}, {createAngularDurationPlanner}, {planTrajectoryExperiment}, angular] = await Promise.all([
      import('/src/experiment-design/angular-recording-panel.mjs'), import('/src/experiment-design/angular-duration-planner.mjs'),
      import('/src/trajectory/planner.mjs'), import('/src/trajectory/angular-discovery.mjs')]);
    const host = document.createElement('div'); host.id = 'independent-copy-scene'; document.body.append(host);
    const scaleMeaning = 'angular_acceleration_only_absolute_torque_unknown';
    const candidates = [0, 2].map((coefficient, i) => ({schema: 'worldlaw.angular-model/v1', id: `analytic-${i}`,
      terms: [{id: 'bias', coefficient, coefficientUnit: angular.ANGULAR_COEFFICIENT_UNITS.bias}], units: {...angular.ANGULAR_MODEL_UNITS},
      scaleMeaning, physicalInertia: null, absoluteTorqueIdentified: false}));
    const discovery = {schema: 'worldlaw.angular-discovery/v1', units: {...angular.ANGULAR_MODEL_UNITS}, scaleMeaning,
      physicalInertia: null, absoluteTorqueIdentified: false, selected: candidates[0], candidates, competitive: candidates,
      trainingRuns: [{id: 'independent-analytic-scene'}]};
    const panel = createAngularRecordingPanel(host, {plan: createAngularDurationPlanner(planTrajectoryExperiment)});
    panel.render({discovery, sourceLabel: 'Analytic metadata edge, not a recording', evidenceKind: 'declared'});
    window.independentCopyScene = {panel, discovery};
  });
  const edge = name => page.locator(`#independent-copy-scene #recording-${name}`);
  for (const name of ['position-min', 'position-max', 'rate-min', 'rate-max']) await edge(name).fill('0');
  await edge('durations').fill('1'); await edge('plan').focus(); await page.keyboard.press('Enter');
  await edge('release').waitFor({state: 'visible'});
  const unknownText = await edge('extrapolation').innerText();
  assert.match(unknownText, /unknown/i); assert.doesNotMatch(unknownText, /within the recorded training ranges/);
  const uniqueGridText = await edge('ensemble').innerText();
  assert.match(uniqueGridText, /1 distinct releases per duration from a requested 5 × 3 grid/);
  await page.evaluate(() => {
    const next = structuredClone(window.independentCopyScene.discovery);
    next.selected.domain = {position: {min: 5, max: 6}, rate: {min: 1, max: 2}};
    window.independentCopyScene.panel.render({discovery: next, sourceLabel: 'Analytic nonzero-domain edge', evidenceKind: 'declared'});
  });
  assert.equal(await edge('position-min').inputValue(), '5'); assert.equal(await edge('position-max').inputValue(), '6');
  const domainText = await edge('domain').innerText(); assert.doesNotMatch(domainText, /near zero/);
  // Shadow text requires the inner section for these stable copy assertions.
  const shadowCopy = await page.locator('#independent-copy-scene section').innerText();
  assert.match(shadowCopy, /must be recomputed after a notebook is reopened/);
  assert.doesNotMatch(shadowCopy, /Every considered model must complete the declared grid/);
  metrics.copyEdges = {scope: 'Separate analytic component scene, actual planners, no acquired evidence', unknownText, domainText, uniqueGridText};
  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  assert.deepEqual(await manifest(), before, 'Frozen receiving sources changed during the run.');
  mark('analytic component edges retain unknown training ranges and honest nonzero-domain/reopen wording');

  await writeFile(resolve(output, 'receipt.json'), JSON.stringify({mode: copyOnly ? 'focused-angular-panel-copy-edges' : 'normal-product-server-angular-recording-panel', sourceCommit: before.commit,
    sourceStatus: before.status, browser: await browser.version(), node: process.version, checks, metrics, layouts,
    sourceManifest: 'source-manifest.json', limitations: ['PASCO is a known reused measured benchmark; this is not new blind physical validation.',
      'The positive request uses existing synthetic observations with physical torque scale withheld.',
      'No new recording, physical hardware action or calibration of model disagreement occurred.',
      'Manual requests are transient until exported; the notebook retains original evidence and recomputes scientific results.']}, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
