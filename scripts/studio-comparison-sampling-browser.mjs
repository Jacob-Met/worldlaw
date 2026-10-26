/** Ordinary-input browser receiving for deliberate output resolution and playback. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {createSession} from '../src/session.mjs';
import {fittedSamplingSource, FITTED_SAMPLING_COURSES, fittedSamplingOracle} from '../experiments/studio-fitted-sampling.mjs';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = process.env.BROWSER_ARTIFACT_DIR || resolve('.receipts/studio-comparison-sampling');
await mkdir(dir, {recursive: true});
const server = createProductServer();
await new Promise((ok, bad) => {server.once('error', bad); server.listen(0, '127.0.0.1', ok);});
const checks = [], mark = name => {checks.push(name); console.log('PASS ' + name);};
const errors = [], badRequests = [], external = [], observed = [], spreadReadouts = [];
let browser;
try {
  browser = await chromium.launch({headless: true, chromiumSandbox: true,
    ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath: process.env.BROWSER_EXECUTABLE_PATH} : {})});
  const context = await browser.newContext({viewport: {width: 1440, height: 1050}, reducedMotion: 'reduce'});
  const sandboxPage = await context.newPage(), cdp = await context.newCDPSession(sandboxPage);
  const sandbox = await requireChromiumSandbox({send: (method, params) => cdp.send(method, params)});
  await writeFile(resolve(dir, 'sandbox.json'), JSON.stringify(sandbox, null, 2) + '\n');
  await sandboxPage.close();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) badRequests.push({url: response.url(), status: response.status()});});
  page.on('request', request => {if (!/^(http:\/\/127\.0\.0\.1:|blob:|data:)/.test(request.url())) external.push(request.url());});
  const notebook = () => page.evaluate(() => localStorage.getItem('worldlaw.notebook.v1'));
  const frames = () => page.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
  const assertRetired = async () => {
    await frames();
    assert.equal(await page.locator('#studio-comparison-transport').isVisible(), false);
    assert.equal(await page.locator('#studio-comparison-chart polyline').count(), 0);
    assert.equal(await page.locator('#studio-comparison-outcomes tr').count(), 0);
    assert.equal(await page.locator('#compare-studio-laws').isEnabled(), true);
    assert.equal(await page.locator('#studio-comparison-spread').isVisible(), false);
  };
  const configure = async course => {
    for (const [id, value] of Object.entries({'initial-angle': course.position, 'initial-rate': course.rate,
      inertia: 1, duration: course.duration, 'simulation-command': 0})) await page.locator('#' + id).fill(String(value));
  };
  const importCourse = async course => {
    const source = fittedSamplingSource(course.frequencyHz), native = createSession(source);
    assert.deepEqual(native.discovery.competitive.map(model => model.id), ['command', 'spring']);
    await page.locator('#observation-file').setInputFiles({name: course.id + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source))});
    await page.waitForFunction(label => document.querySelector('#source-name').textContent === label, source.source.label);
    assert.equal(await page.locator('#sample-count').innerText(), '512');
    await assertRetired();
    await configure(course);
    return {native, sourceBytes: await notebook()};
  };
  const compare = async (course, dt) => {
    await page.locator('#studio-comparison-interval').selectOption(String(dt));
    await page.locator('#compare-studio-laws').click();
    await page.waitForFunction(() => document.querySelector('#studio-comparison-status').dataset.state === 'completed'
      && !document.querySelector('#compare-studio-laws').disabled);
    assert.deepEqual(await page.locator('#studio-comparison-outcomes tr').evaluateAll(rows => rows.map(row => ({id: row.dataset.modelId, status: row.dataset.status}))),
      [{id: 'command', status: 'completed'}, {id: 'spring', status: 'completed'}]);
    assert.equal(await page.locator('#studio-comparison-time').getAttribute('max'), String(Math.ceil(course.duration / dt)));
    const details = page.locator('.motion-comparison-details');
    if (!await details.evaluate(node => node.open)) await details.locator('summary').click();
    await page.waitForFunction(() => document.querySelectorAll('#studio-comparison-chart polyline').length === 2);
    const sizes = await page.locator('#studio-comparison-chart polyline').evaluateAll(lines => lines.map(line => line.getAttribute('points').split(' ').length));
    assert.deepEqual(sizes, [Math.ceil(course.duration / dt) + 1, Math.ceil(course.duration / dt) + 1]);
  };
  const angle = async id => {
    const text = await page.locator('#studio-comparison-legend button[data-model-id="' + id + '"]').innerText();
    const match = text.match(/θ\s+([+\-\d.,eE]+)\s+rad/);
    assert.ok(match, 'Expected an explicit sampled angle: ' + text);
    return Number(match[1].replaceAll(',', ''));
  };
  const sampledSpread = async (course, dt) => {
    const text = await page.locator('#studio-comparison-spread').innerText();
    const match = text.match(/Maximum sampled angle difference:\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?)\s*rad/i);
    assert.ok(match, 'Expected a visible numerical sampled spread: ' + text);
    assert.match(text, /autoscaled/i);
    assert.match(text, /returned samples only/i);
    const value = Number(match[1]);
    spreadReadouts.push({course: course.id, dt, value, text});
    return value;
  };
  const keyboardSample = async (course, dt, index) => {
    const slider = page.locator('#studio-comparison-time');
    await slider.focus();
    await page.keyboard.press('Home');
    for (let i = 0; i < index; i++) await page.keyboard.press('ArrowRight');
    assert.equal(await slider.inputValue(), String(index));
    assert.equal(await page.locator('#studio-comparison-pause').getAttribute('data-paused'), 'true');
    const time = index * dt;
    const clock = await page.locator('#studio-comparison-clock').innerText();
    assert.ok(Math.abs(Number.parseFloat(clock) - time) < 1e-10, clock);
    const command = await angle('command'), spring = await angle('spring');
    assert.ok(Math.abs(command - fittedSamplingOracle(course, 'command', time).position) < 1e-4);
    assert.ok(Math.abs(spring - fittedSamplingOracle(course, 'spring', time).position) < 1e-4);
    const row = {course: course.id, dt, sampleIndex: index, time, command, spring, separation: Math.abs(command - spring)};
    observed.push(row);
    return row;
  };

  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => document.querySelector('#sample-count').textContent === '64');
  assert.equal(await page.locator('#studio-comparison-interval').inputValue(), '0.02');
  assert.equal(Number(await page.locator('#studio-comparison-speed').inputValue()), 1);
  const primary = FITTED_SAMPLING_COURSES[0];
  const first = await importCourse(primary);
  await compare(primary, .02);
  const coarse = await keyboardSample(primary, .02, 1);
  assert.ok(coarse.separation < 1e-4);
  assert.ok(await sampledSpread(primary, .02) < 1e-4);
  await page.locator('#studio-motion-comparison').screenshot({path: resolve(dir, 'fitted-50hz-coarse-curves-desktop.png')});
  const coarseCurves = await page.locator('#studio-comparison-chart').innerHTML();
  await page.locator('#studio-comparison-speed').selectOption('0.01');
  assert.equal(await page.locator('#studio-comparison-time').inputValue(), '1');
  assert.equal(await page.locator('#studio-comparison-chart').innerHTML(), coarseCurves);
  assert.equal(await notebook(), first.sourceBytes);
  assert.equal(await page.locator('#studio-comparison-time').getAttribute('max'), '10');
  mark('ordinary 512-row import fits command and fast spring; slower playback preserves the still-aliased 20 ms samples');

  await page.locator('#studio-comparison-interval').selectOption('0.01');
  await assertRetired();
  await compare(primary, .01);
  const revealed = await keyboardSample(primary, .01, 1);
  assert.ok(revealed.separation > 1.99);
  assert.ok(await sampledSpread(primary, .01) > 1.99);
  await page.locator('.instrument-stage').screenshot({path: resolve(dir, 'fitted-50hz-release-desktop.png')});
  await page.locator('#studio-motion-comparison').screenshot({path: resolve(dir, 'fitted-50hz-curves-desktop.png')});
  await page.locator('#studio-comparison-interval').selectOption('0.005');
  await assertRetired();
  await compare(primary, .005);
  const quarter = await keyboardSample(primary, .005, 1);
  assert.ok(Math.abs(quarter.spring) < 1e-4);
  assert.equal(await notebook(), first.sourceBytes);
  mark('explicit finer common-grid execution exposes the fitted 50 Hz intermediate motion and keyboard sample time');

  const curvesBeforeSpeed = await page.locator('#studio-comparison-chart').innerHTML();
  const outcomesBeforeSpeed = await page.locator('#studio-comparison-outcomes').innerHTML();
  const pausedIndex = await page.locator('#studio-comparison-time').inputValue();
  await page.locator('#studio-comparison-speed').selectOption('0.25');
  assert.equal(await page.locator('#studio-comparison-time').inputValue(), pausedIndex);
  assert.equal(await page.locator('#studio-comparison-chart').innerHTML(), curvesBeforeSpeed);
  assert.equal(await page.locator('#studio-comparison-outcomes').innerHTML(), outcomesBeforeSpeed);
  const started = await page.evaluate(() => {
    const slider = document.querySelector('#studio-comparison-time'); slider.value = '0'; slider.dispatchEvent(new Event('input', {bubbles: true}));
    const speed = document.querySelector('#studio-comparison-speed'); speed.value = '0.01'; speed.dispatchEvent(new Event('change', {bubbles: true}));
    const now = performance.now(); document.querySelector('#studio-comparison-pause').click(); return now;
  });
  await page.waitForFunction(() => Number(document.querySelector('#studio-comparison-time').value) >= 2, null, {timeout: 6000});
  const slow = await page.evaluate(() => {
    document.querySelector('#studio-comparison-pause').click();
    return {wall: performance.now(), sampleIndex: Number(document.querySelector('#studio-comparison-time').value)};
  });
  const elapsedSeconds = (slow.wall - started) / 1000;
  assert.ok(elapsedSeconds >= .85 && elapsedSeconds < 6, 'The 0.01× control must make two 5 ms samples take about one wall-clock second.');
  assert.ok(Math.abs(slow.sampleIndex * .005 - elapsedSeconds * .01) < .0075);
  assert.equal(await page.locator('#studio-comparison-chart').innerHTML(), curvesBeforeSpeed);
  assert.equal(await page.locator('#studio-comparison-outcomes').innerHTML(), outcomesBeforeSpeed);
  assert.equal(await notebook(), first.sourceBytes);
  const continuity = await page.evaluate(async () => {
    const slider = document.querySelector('#studio-comparison-time');
    const pause = document.querySelector('#studio-comparison-pause');
    const speed = document.querySelector('#studio-comparison-speed');
    slider.value = '2'; slider.dispatchEvent(new Event('input', {bubbles: true}));
    speed.value = '0.01'; speed.dispatchEvent(new Event('change', {bubbles: true}));
    const started = performance.now(); pause.click();
    await new Promise(ok => setTimeout(ok, 120));
    const changed = performance.now(), beforeIndex = Number(slider.value);
    speed.value = '0.05'; speed.dispatchEvent(new Event('change', {bubbles: true}));
    const immediateIndex = Number(slider.value);
    await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const followingIndex = Number(slider.value);
    await new Promise(ok => setTimeout(ok, 220));
    const stopped = performance.now(); pause.click();
    return {started, changed, stopped, beforeIndex, immediateIndex, followingIndex, finalIndex: Number(slider.value)};
  });
  assert.equal(continuity.immediateIndex, continuity.beforeIndex);
  assert.ok(continuity.followingIndex >= continuity.beforeIndex && continuity.followingIndex <= continuity.beforeIndex + 2,
    'Changing speed while playing must not reset time or multiply the already elapsed phase.');
  const continuousTime = .01 + (continuity.changed - continuity.started) / 1000 * .01
    + (continuity.stopped - continuity.changed) / 1000 * .05;
  assert.ok(Math.abs(continuity.finalIndex * .005 - continuousTime) < .0075);
  assert.equal(await page.locator('#studio-comparison-chart').innerHTML(), curvesBeforeSpeed);
  assert.equal(await notebook(), first.sourceBytes);
  mark('0.01× playback advances actual fine-grid samples; speed changes preserve paused time and ongoing phase without recomputation');

  const pending = await page.evaluate(() => {
    const run = document.querySelector('#compare-studio-laws'); run.click(); const wasPending = run.disabled;
    const interval = document.querySelector('#studio-comparison-interval'); interval.value = '0.01'; interval.dispatchEvent(new Event('change', {bubbles: true}));
    return wasPending;
  });
  assert.equal(pending, true);
  await assertRetired();
  await compare(primary, .005);
  await page.locator('#duration').fill('6.25');
  await page.locator('#studio-comparison-interval').selectOption('0.000625');
  await page.locator('#compare-studio-laws').click();
  await page.waitForFunction(() => document.querySelector('#studio-comparison-status').dataset.state === 'refused'
    && !document.querySelector('#compare-studio-laws').disabled);
  assert.equal(await page.locator('#studio-comparison-outcomes tr[data-status="refused"]').count(), 2);
  assert.equal(await page.locator('#studio-comparison-transport').isVisible(), false);
  assert.equal(await page.locator('#studio-comparison-chart polyline').count(), 0);
  assert.equal(await page.locator('#studio-comparison-spread').isVisible(), false);
  assert.match(await page.locator('#studio-comparison-outcomes').innerText(), /20002|sample/i);
  assert.equal(await notebook(), first.sourceBytes);
  mark('output-interval changes cancel pending results and finer excessive grids visibly refuse every law under unchanged bounds');

  const held = FITTED_SAMPLING_COURSES[1];
  const second = await importCourse(held);
  for (const dt of [.02, .01]) {
    await compare(held, dt);
    assert.ok((await keyboardSample(held, dt, 1)).separation < 1e-4);
    assert.ok(await sampledSpread(held, dt) < 1e-4);
  }
  await compare(held, .005);
  const heldRevealed = await keyboardSample(held, .005, 1);
  assert.ok(heldRevealed.separation > .73);
  assert.ok(await sampledSpread(held, .005) > .73);
  assert.equal(await notebook(), second.sourceBytes);
  await page.locator('#studio-comparison-speed').selectOption('0.01');
  assert.equal(await page.locator('#studio-comparison-pause').getAttribute('data-paused'), 'true');
  await page.setViewportSize({width: 390, height: 960});
  await page.locator('.instrument-stage').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('.instrument-stage').screenshot({path: resolve(dir, 'held-100hz-release-narrow.png')});
  await page.locator('#studio-motion-comparison').screenshot({path: resolve(dir, 'held-100hz-curves-narrow.png')});
  mark('held fitted 100 Hz source defeats two agreeing grids; 5 ms reveals motion through the 390 px ordinary consumer path');

  for (const dt of [.00125, .000625]) {
    await compare(held, dt);
    await keyboardSample(held, dt, 1);
    assert.match(await page.locator('#studio-comparison-time').getAttribute('aria-valuetext'), /sample 2 of/i);
    assert.equal(await notebook(), second.sourceBytes);
  }
  await page.reload();
  await page.waitForFunction(label => document.querySelector('#source-name').textContent === label,
    fittedSamplingSource(held.frequencyHz).source.label);
  assert.equal(await page.locator('#sample-count').innerText(), '512');
  await assertRetired();
  assert.equal(await page.locator('#studio-comparison-interval').inputValue(), '0.02');
  assert.equal(Number(await page.locator('#studio-comparison-speed').inputValue()), 1);
  assert.equal(await notebook(), second.sourceBytes);
  const reopened = JSON.parse(await notebook());
  assert.equal(reopened.discovery, undefined);
  assert.equal(reopened.trajectory, undefined);
  assert.equal(JSON.stringify(reopened).includes('worldlaw.studio-dynamics-comparison'), false);
  mark('1.25 ms and 0.625 ms samples retain exact keyboard times; reload restores source-only evidence with 20 ms and 1× defaults');

  assert.deepEqual(errors, []); assert.deepEqual(badRequests, []); assert.deepEqual(external, []);
  await writeFile(resolve(dir, 'receipt.json'), JSON.stringify({schema: 'worldlaw.fitted-sampling-browser/v1', browser: await browser.version(),
    checks, observed, spreadReadouts, slowPlayback: {selectedSpeed: .01, dt: .005, elapsedSeconds, sampleIndex: slow.sampleIndex},
    playingSpeedChange: {...continuity, expectedPhysicalTime: continuousTime},
    fittedCandidates: [first, second].map(({native}) => native.discovery.competitive.map(({id, terms}) => ({id, terms}))),
    errors, badRequests, external,
    scope: 'Actual browser receiving from authored original observations, refitted by ordinary application imports. Independent harmonic/zero-command formulas check visible sampled angles. No injected model, physical measurement, calibrated uncertainty, general alias-free certificate or observation change.'}, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(ok => server.close(ok));
}
