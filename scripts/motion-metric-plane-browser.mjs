/** Actual decoded movies -> unchanged tracker -> metric angles -> executable-law consumer. */
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {deriveAngles, calibratePlaneNotebook} from '../src/motion/measurement.mjs';
import {restoreChallenge} from '../src/trajectory/session.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const inferReference = process.env.INFER_PLANE_REFERENCE === '1';
const artifacts = resolve(process.env.BROWSER_ARTIFACT_DIR || (inferReference ? '.receipts/plane-path-browser' : '.receipts/metric-plane-browser'));
const fixtures = resolve(process.env.MOTION_FIXTURE_DIR || '.receipts/metric-plane-fixtures');
await mkdir(artifacts, {recursive: true});
const truth = JSON.parse(await readFile(resolve(fixtures, 'truth.json'), 'utf8'));
const server = createProductServer();
await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
const origin = 'http://127.0.0.1:' + server.address().port;
const checks = [], metrics = [], pageErrors = [], externalRequests = [], notebooks = {};
const mark = name => { checks.push(name); console.log('PASS ' + name); };
let browser;
try {
  browser = await chromium.launch({headless: true, chromiumSandbox: true,
    ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath: process.env.BROWSER_EXECUTABLE_PATH} : {})});
  const sandbox = await browser.newPage(); await sandbox.goto('chrome://sandbox');
  const sandboxStatus = await sandbox.locator('body').innerText();
  assert.match(sandboxStatus, /Layer 1 Sandbox\s+Namespace/);
  for (const key of ['PID namespaces', 'Network namespaces', 'Seccomp-BPF sandbox'])
    assert.match(sandboxStatus, new RegExp(key + '\\s+Yes'));
  await sandbox.close();
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin)) externalRequests.push(request.url()); });
  const download = async (selector, name) => {
    const wait = page.waitForEvent('download'); await page.locator(selector).click();
    const path = resolve(artifacts, name); await (await wait).saveAs(path);
    const text = await readFile(path, 'utf8'); return {path, text, value: JSON.parse(text)};
  };
  const place = async (id, point) => {
    await page.locator(id).click(); await page.locator('#coordinate-details').evaluate(node => { node.open = true; });
    await page.locator('#point-x').fill(String(point.x)); await page.locator('#point-y').fill(String(point.y));
    await page.locator('#apply-point').click();
  };
  for (const course of truth.courses) {
    await page.goto(origin + '/motion.html');
    await page.locator('#video-file').setInputFiles(resolve(fixtures, course.file));
    await page.waitForFunction(name => document.getElementById('source-name').textContent.includes(name), course.file);
    if (inferReference) {
      await page.locator('#metric-plane-panel').evaluate(node => { node.open = true; });
      await page.locator('#plane-declaration-file').setInputFiles(resolve(fixtures, course.name + '-plane.json'));
      await page.waitForFunction(() => document.getElementById('plane-declaration-status').textContent.startsWith('Staged:'));
      const uncalibrated = await download('#save-notebook', course.name + '-uncalibrated.json');
      assert.equal(uncalibrated.value.calibration, null);
      assert.equal(uncalibrated.value.measurements.length, 0);
      assert.equal(await page.locator('#angle-chart path').count(), 0);
    } else await place('#pick-pivot', course.pivot);
    await place('#pick-marker', course.truth[0].point);
    // An explicit 20 Hz request admits the observed 30 fps decoder cadence.
    // A 30 Hz request produced 33/67 ms gaps and was correctly refused as
    // fragmented by the existing 1.6-step continuity rule; do not widen it.
    await page.locator('#sample-step').fill('0.05');
    await page.locator('#track-until').fill('7.95');
    await page.locator('#track-motion').click();
    await page.waitForFunction(() => document.getElementById('cancel-tracking').hidden, {}, {timeout: 120000});
    assert.equal(await page.locator('#motion-error').isVisible(), false);
    let before = await download('#save-notebook', course.name + '-image.json');
    const initialAcquisition = {rows: before.value.measurements.length,
      lastTime: before.value.measurements.at(-1).time, lastStatus: before.value.measurements.at(-1).status};
    const corrections = [];
    // The fixed template can lose a genuinely projected patch. Exercise the
    // existing explicit correction flow on that exact displayed frame. The
    // fixture's known center is authored control evidence; no future rows or
    // predicted points are inserted into the notebook behind the interface.
    while (!before.value.measurements.at(-1).point && corrections.length < 16) {
      const row = before.value.measurements.at(-1), t = row.time;
      if (!corrections.length) await page.locator('.motion-stage').screenshot({path: resolve(artifacts, course.name + '-tracking-failure.png')});
      const angle = course.amplitude * Math.exp(-.08 * t) * Math.cos(1.6 * t), x = Math.sin(angle), y = Math.cos(angle), h = course.camera;
      const w = h[6] * x + h[7] * y + h[8];
      const marked = {x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w};
      corrections.push({time: t, failedStatus: row.status, reason: row.reason, authoredControlPoint: marked});
      await place('#correct-point', marked);
      await page.locator('#track-motion').click();
      await page.waitForFunction(() => document.getElementById('cancel-tracking').hidden, {}, {timeout: 120000});
      before = await download('#save-notebook', course.name + '-image.json');
    }
    assert.ok(before.value.measurements.length >= 100, 'The explicit correction course must produce usable original evidence: ' + before.value.measurements.length);
    assert.ok(before.value.measurements.every(row => row.point && row.timeBasis === 'decoded-media-time'));
    assert.equal(before.value.source.sha256, course.sha256);
    if (inferReference) {
      assert.equal(before.value.calibration, null);
      await page.locator('#path-reference-panel').evaluate(node => { node.open = true; });
      await page.locator('#infer-path-reference').focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.getElementById('apply-path-reference').disabled);
      assert.match(await page.locator('#path-reference-result').textContent(), /Plane center:/);
      await page.locator('.motion-stage').scrollIntoViewIfNeeded();
      await page.screenshot({path: resolve(artifacts, course.name + '-proposed-reference.png')});
      await page.locator('#path-residual').fill('0.001');
      assert.equal(await page.locator('#apply-path-reference').isDisabled(), true);
      await page.locator('#path-residual').fill('2');
      await page.locator('#infer-path-reference').click();
      await page.locator('#apply-path-reference').focus(); await page.keyboard.press('Enter');
      mark(course.name + ': staged source plane, marker-first acquisition, projected path inspection and explicit reference acceptance');
    } else {
      await page.locator('#metric-plane-panel').evaluate(node => { node.open = true; });
      await page.locator('#plane-declaration-file').setInputFiles(resolve(fixtures, course.name + '-plane.json'));
    }
    await page.waitForFunction(() => document.getElementById('plane-declaration-status').textContent.startsWith('Applied:'));
    assert.equal(await page.locator('#motion-error').isVisible(), false);
    assert.ok(await page.locator('#angle-chart path[data-angle-frame="image"]').count());
    assert.match(await page.locator('#angle-convention').textContent(), /plane \+Y/);
    const after = await download('#save-notebook', course.name + '-plane-notebook.json');
    assert.deepEqual(after.value.measurements, before.value.measurements);
    assert.equal(after.value.schema, 'worldlaw.motion-notebook/v3');
    const expected = t => course.amplitude * Math.exp(-.08 * t) * Math.cos(1.6 * t);
    const rmse = nb => {
      const samples = deriveAngles(nb).samples.filter(row => Number.isFinite(row.position));
      return Math.sqrt(samples.reduce((sum, row) => sum + (row.position - expected(row.time)) ** 2, 0) / samples.length);
    };
    const result = {name: course.name, originalSha256: course.sha256, measuredFrames: after.value.measurements.length,
      initialAcquisition, explicitManualCorrections: corrections,
      imageAngleRMSE: rmse(inferReference ? calibratePlaneNotebook(after.value, null) : before.value), metricAngleRMSE: rmse(after.value),
      ...(inferReference ? {inferredPivotErrorPixels: Math.hypot(after.value.calibration.pivot.x - course.pivot.x, after.value.calibration.pivot.y - course.pivot.y), referenceMethod: after.value.revisions.at(-1).method} : {})};
    metrics.push(result); console.log(JSON.stringify(result));
    assert.ok(result.imageAngleRMSE > .05);
    assert.ok(result.metricAngleRMSE < .025);
    if (inferReference) assert.ok(result.inferredPivotErrorPixels < 3, JSON.stringify(result));
    assert.ok(result.metricAngleRMSE < result.imageAngleRMSE / 4);
    notebooks[course.name] = after;
    mark(course.name + ': original decoded pixels, retained fixed-template failures and explicit corrections reach improved metric angles with unchanged raw points');
    if (course.name === 'fit') {
      await page.locator('.motion-stage').scrollIntoViewIfNeeded();
      await page.screenshot({path: resolve(artifacts, 'metric-plane-desktop.png')});
      await page.locator('#angle-chart').scrollIntoViewIfNeeded();
      await page.screenshot({path: resolve(artifacts, 'metric-plane-angle-comparison.png')});
      const wrong = JSON.parse(await readFile(resolve(fixtures, 'challenge-plane.json'), 'utf8'));
      await page.locator('#plane-declaration-file').setInputFiles({name: 'wrong-source.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(wrong))});
      await page.waitForFunction(() => !document.getElementById('motion-error').hidden);
      assert.match(await page.locator('#motion-error').textContent(), /different source bytes/);
      const retained = await download('#save-notebook', 'wrong-source-refused.json');
      assert.deepEqual(retained.value, after.value);
      await page.locator('#remove-plane-declaration').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#motion-error').isVisible(), false);
      const removed = await download('#save-notebook', 'image-restored.json');
      assert.deepEqual(deriveAngles(removed.value).samples, deriveAngles(inferReference ? calibratePlaneNotebook(after.value, null) : before.value).samples);
      await page.locator('#plane-declaration-file').setInputFiles(resolve(fixtures, 'fit-plane.json'));
      await page.waitForFunction(() => document.getElementById('plane-declaration-status').textContent.startsWith('Applied:'));
      await page.locator('#notebook-file').setInputFiles(after.path);
      await page.waitForFunction(() => document.getElementById('motion-notice').textContent.startsWith('Notebook reopened'));
      assert.match(await page.locator('#plane-declaration-status').textContent(), /Applied:/);
      const choose = page.waitForEvent('filechooser'); await page.locator('#attach-video').click();
      await (await choose).setFiles(resolve(fixtures, course.file));
      await page.waitForFunction(() => document.getElementById('motion-notice').textContent.includes('Video reconnected'));
      assert.equal(await page.locator('#frame-empty').isVisible(), false);
      assert.deepEqual((await download('#save-notebook', 'reopened.json')).value, after.value);
      mark('wrong source is transactional; keyboard removal restores image angles; notebook reopen and original-video reattachment preserve the declaration');
      await page.setViewportSize({width: 390, height: 844});
      await page.locator('#metric-plane-panel').evaluate(node => { node.open = true; });
      await page.locator('#metric-plane-panel').scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.locator('#open-plane-declaration').focus(); assert.equal(await page.evaluate(() => document.activeElement.id), 'open-plane-declaration');
      await page.screenshot({path: resolve(artifacts, 'metric-plane-narrow.png')});
      mark('390px layout, keyboard focus and reduced-motion controls remain operable');
      await page.setViewportSize({width: 1440, height: 1000});
    }
  }
  await page.goto(origin + '/trajectory.html');
  await page.waitForFunction(() => document.getElementById('refit') && !document.getElementById('refit').disabled);
  await page.locator('#motion-intake-panel').evaluate(node => { node.open = true; });
  for (const [role, name] of [['training', 'fit'], ['challenge', 'challenge']]) {
    await page.locator('#motion-' + role + '-file').setInputFiles(notebooks[name].path);
    await page.waitForFunction(role => !document.getElementById('motion-' + role + '-course').disabled, role);
    await page.locator('#motion-' + role + '-kind').selectOption('synthetic');
    await page.locator('#motion-' + role + '-rate').fill(String(truth.courses.find(course => course.name === name).initialRate));
    await page.locator('#motion-' + role + '-rate-basis').fill('Known independent authored oscillator derivative at release.');
  }
  await page.locator('#motion-unforced').check(); await page.locator('#motion-shared-frame').check();
  await page.locator('#motion-assumption-basis').fill('Authored unforced scalar oscillators share metric plane axes; camera projections differ.');
  await page.locator('#motion-compare').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('motion-intake-status').textContent.startsWith('Separate Motion recordings loaded.') || !document.getElementById('motion-intake-error').hidden);
  assert.equal(await page.locator('#motion-intake-error').isVisible(), false,
    await page.locator('#motion-intake-error').textContent());
  assert.match(await page.locator('#source-description').textContent(), /caller-declared metric planes/);
  const saved = await download('#export-notebook', 'metric-plane-trajectory.json');
  const challenged = restoreChallenge(saved.text);
  assert.ok(challenged.summary.selectedPositionRMSE < .12, JSON.stringify(challenged.summary));
  assert.equal(challenged.bundle.trainingRuns[0].source.motion.notebookSchema, 'worldlaw.motion-notebook/v3');
  await page.locator('#notebook-file').setInputFiles(saved.path);
  await page.waitForFunction(() => document.getElementById('notice').textContent.startsWith('Notebook reopened.'));
  assert.deepEqual((await download('#export-notebook', 'metric-plane-trajectory-reopened.json')).value, saved.value);
  await page.locator('#trajectory-chart').scrollIntoViewIfNeeded();
  await page.screenshot({path: resolve(artifacts, 'metric-plane-trajectory.png')});
  mark('separate corrected video recordings reach actual model fitting, forward challenge and input-only notebook reopen');
  assert.deepEqual(pageErrors, []); assert.deepEqual(externalRequests, []);
  mark('no uncaught page errors or external requests');
  const receipt = {inferReference, checks, metrics, trajectory: challenged.summary, selectedModel: challenged.discovery.selected,
    sandboxStatus, chromiumSandbox: true, browserVersion: browser.version(), pageErrors, externalRequests,
    scope: 'Authored original pixel movies through actual decode, unchanged NCC tracker and explicitly recorded UI corrections, source-bound declared plane, explicit observed or inferred reference and maintained executable-law consumer. First-pass tracking losses remain in the receipt; this is not physical calibration or an automatic tracking-quality gain.'};
  await writeFile(resolve(artifacts, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
