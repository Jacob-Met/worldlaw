/** Actual panel state/late-read receiving after the original-video course. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifacts = resolve(process.env.BROWSER_ARTIFACT_DIR || '.receipts/plane-reference-state');
const inputs = resolve(process.env.MOTION_INPUT_DIR || '.receipts/plane-path-browser');
const fixtures = resolve(process.env.MOTION_FIXTURE_DIR || 'examples/metric-plane');
await mkdir(artifacts, {recursive: true});
const truth = JSON.parse(await readFile(resolve(fixtures, 'truth.json'), 'utf8'));
const source = JSON.parse(await readFile(resolve(inputs, 'fit-image.json'), 'utf8'));
const other = JSON.parse(await readFile(resolve(inputs, 'challenge-image.json'), 'utf8'));
const plane = await readFile(resolve(fixtures, 'fit-plane.json'));
assert.equal(source.calibration, null);
const server = createProductServer();
await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
const origin = 'http://127.0.0.1:' + server.address().port;
const checks = [], errors = [];
const mark = value => { checks.push(value); console.log('PASS ' + value); };
let browser;
try {
  browser = await chromium.launch({headless: true, chromiumSandbox: true,
    ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath: process.env.BROWSER_EXECUTABLE_PATH} : {})});
  const sandbox = await browser.newPage(); await sandbox.goto('chrome://sandbox');
  const sandboxStatus = await sandbox.locator('body').innerText();
  assert.match(sandboxStatus, /Layer 1 Sandbox\s+Namespace/);
  assert.match(sandboxStatus, /Seccomp-BPF sandbox\s+Yes/); await sandbox.close();
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  page.on('pageerror', error => errors.push(error.message));
  const open = async (name, value) => {
    await page.locator('#notebook-file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value))});
    await page.waitForFunction(() => document.getElementById('motion-notice').textContent.startsWith('Notebook reopened'));
  };
  const saved = async name => {
    const wait = page.waitForEvent('download'); await page.locator('#save-notebook').click();
    const path = resolve(artifacts, name); await (await wait).saveAs(path);
    return JSON.parse(await readFile(path, 'utf8'));
  };
  await page.goto(origin + '/motion.html'); await open('original-marker-only.json', source);
  const chooser = page.waitForEvent('filechooser'); await page.locator('#attach-video').click();
  await (await chooser).setFiles(resolve(fixtures, 'fit.mp4'));
  await page.waitForFunction(() => document.getElementById('motion-notice').textContent.includes('Video reconnected'));
  await page.locator('#metric-plane-panel').evaluate(node => { node.open = true; });
  await page.locator('#plane-declaration-file').setInputFiles({name: 'fit-plane.json', mimeType: 'application/json', buffer: plane});
  await page.waitForFunction(() => document.getElementById('plane-declaration-status').textContent.startsWith('Staged:'));
  assert.equal((await saved('staged-unreferenced.json')).calibration, null);
  assert.match(await page.locator('#plane-declaration-limits').textContent(), /does not change current angles/);
  await page.locator('#pick-pivot').click();
  await page.locator('#coordinate-details').evaluate(node => { node.open = true; });
  const pivot = truth.courses.find(c => c.name === 'fit').pivot;
  await page.locator('#point-x').fill(String(pivot.x)); await page.locator('#point-y').fill(String(pivot.y));
  await page.locator('#apply-point').click();
  assert.match(await page.locator('#plane-declaration-status').textContent(), /image-coordinate reference remains active/);
  const image = await saved('observed-image-reference.json');
  assert.deepEqual(image.calibration.pivot, pivot); assert.equal(image.calibration.plane, undefined);
  assert.deepEqual(image.measurements, source.measurements);
  await page.locator('#apply-staged-plane').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('plane-declaration-status').textContent.startsWith('Applied:'));
  const applied = await saved('explicit-plane-application.json');
  assert.deepEqual(applied.calibration.pivot, pivot); assert.ok(applied.calibration.plane);
  assert.deepEqual(applied.measurements, source.measurements);
  mark('staging does not create a pivot; an explicitly observed image reference stays active until separate plane application');
  await page.locator('#remove-plane-declaration').click();
  await page.locator('#plane-declaration-file').setInputFiles({name: 'fit-plane.json', mimeType: 'application/json', buffer: plane});
  await page.waitForFunction(() => document.getElementById('plane-declaration-status').textContent.startsWith('Applied:'));
  await page.locator('#pivot-mode').selectOption('tracked');
  assert.equal(await page.locator('#infer-path-reference').isDisabled(), true);
  const tracked = await saved('tracked-observed-plane.json');
  assert.equal(tracked.calibration.pivotMode, 'tracked'); assert.ok(tracked.calibration.plane);
  mark('existing observed and tracked-reference modes remain explicit; tracked mode refuses fixed-reference inference');
  await open('original-marker-only.json', source);
  const reattach = page.waitForEvent('filechooser'); await page.locator('#attach-video').click();
  await (await reattach).setFiles(resolve(fixtures, 'fit.mp4'));
  await page.waitForFunction(() => document.getElementById('motion-notice').textContent.includes('Video reconnected'));
  await page.locator('#metric-plane-panel').evaluate(node => { node.open = true; });
  await page.locator('#plane-declaration-file').setInputFiles({name: 'fit-plane.json', mimeType: 'application/json', buffer: plane});
  await page.waitForFunction(() => document.getElementById('plane-declaration-status').textContent.startsWith('Staged:'));
  await page.locator('#path-reference-panel').evaluate(node => { node.open = true; });
  await page.locator('#infer-path-reference').click();
  assert.equal(await page.locator('#apply-path-reference').isEnabled(), true);
  await page.locator('.motion-stage').scrollIntoViewIfNeeded();
  await page.screenshot({path: resolve(artifacts, 'proposed-reference-desktop.png')});
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('#path-reference-panel').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({path: resolve(artifacts, 'proposed-reference-390.png')});
  await page.locator('#path-reference-panel').screenshot({path: resolve(artifacts, 'proposed-reference-panel.png')});
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = function() {
      if (this.name === 'delayed-plane.json') return new Promise(resolve => {
        window.releasePlaneRead = async () => resolve(await original.call(this));
      });
      return original.call(this);
    };
  });
  await page.locator('#plane-declaration-file').setInputFiles({name: 'delayed-plane.json', mimeType: 'application/json', buffer: plane});
  await page.waitForFunction(() => typeof window.releasePlaneRead === 'function');
  await open('different-source.json', other);
  await page.evaluate(async () => { await window.releasePlaneRead(); });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const retained = await saved('late-plane-refused.json');
  assert.deepEqual(retained, other);
  assert.equal(await page.locator('#apply-path-reference').isDisabled(), true);
  assert.equal(await page.locator('#motion-error').isVisible(), false);
  assert.doesNotMatch(await page.locator('#plane-declaration-status').textContent(), /Staged:|Applied:/);
  mark('new source clears the staged plane and proposal; an older delayed plane read cannot modify it');
  assert.deepEqual(errors, []);
  await writeFile(resolve(artifacts, 'receipt.json'), JSON.stringify({checks, errors,
    sourceSha256: source.source.sha256, otherSourceSha256: other.source.sha256,
    browserVersion: browser.version(), chromiumSandbox: true, sandboxStatus}, null, 2) + '\n');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
