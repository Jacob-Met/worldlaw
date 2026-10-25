/** Receive an extracted distribution through its maintained Studio and Reference UI. */
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {createNotebook, calibrateNotebook} from '../src/motion/measurement.mjs';

const out = resolve(process.env.BROWSER_ARTIFACT_DIR || '.receipts/distribution-browser');
await mkdir(out, {recursive: true});
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const launch = chromium.launch;
const sandboxReceipts = [];
// Reuse the maintained Studio receiver with an explicitly sandboxed launch.
// This process-local wrapper changes no packaged source or application behavior.
chromium.launch = async function(options) {
  const browser = await launch.call(this, {...options, chromiumSandbox: true});
  try {
    const page = await browser.newPage();
    await page.goto('chrome://sandbox');
    const status = await page.locator('body').innerText();
    assert.match(status, /Layer 1 Sandbox\s+Namespace/);
    for (const key of ['PID namespaces', 'Network namespaces', 'Seccomp-BPF sandbox']) {
      assert.match(status, new RegExp(key + '\\s+Yes'));
    }
    sandboxReceipts.push({browser: browser.version(), status});
    await page.close();
    return browser;
  } catch (error) {
    await browser.close();
    throw error;
  }
};

const report = {result: 'FAIL', referenceChecks: [], errors: [], offsite: [], sandboxReceipts,
  scope: 'Extracted product and authored software controls. Reference coordinates are constructed; no physical video accuracy is asserted.'};
let browser, server;
const oldDirectory = process.env.BROWSER_ARTIFACT_DIR;
const record = text => {report.referenceChecks.push(text); console.log('PASS ' + text);};
try {
  process.env.BROWSER_ARTIFACT_DIR = resolve(out, 'studio');
  await import('./browser.mjs');
  report.studio = JSON.parse(await readFile(resolve(out, 'studio/receipt.json'), 'utf8'));

  server = createProductServer();
  await new Promise((yes, no) => {server.once('error', no); server.listen(0, '127.0.0.1', yes);});
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless: true,
    ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath: process.env.BROWSER_EXECUTABLE_PATH} : {})});
  const page = await browser.newPage({viewport: {width: 1280, height: 960}, acceptDownloads: true});
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) report.offsite.push(request.url());
  });
  const input = async (id, value) => page.locator(id).setInputFiles({
    name: 'authored-distribution-control.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value))});
  const compared = () => page.waitForFunction(() => document.getElementById('notice').textContent.includes('Comparison recomputed'));
  let notebook = createNotebook({source: {kind: 'local-video', label: 'authored-distribution-control.webm',
    sha256: 'a'.repeat(64), width: 100, height: 100, nativeWidth: 100, nativeHeight: 100, duration: 1}});
  notebook = calibrateNotebook(notebook, {pivot: {x: 50, y: 50}, pivotMode: 'fixed'});
  notebook.measurements = [
    {time: .1, timeBasis: 'decoded-media-time', status: 'accepted', point: {x: 20, y: 30}, quality: {score: .99}},
    {time: .2, timeBasis: 'decoded-media-time', status: 'lost', point: null, candidatePoint: {x: 91, y: 91}, quality: {score: 1}},
  ];
  const reference = {format: 'chronos-independent-reference/v1', source: {sha256: 'a'.repeat(64), width: 100, height: 100},
    position_unit: 'px', time_unit: 's', coordinate_frame: 'native-video-raster',
    annotation: {method: 'Authored 3-4-5 distance and missing-point software controls, not physical observations.', independent_of_tracker: true},
    tracks: [{id: 'marker', labels: [.1, .2].map(t => ({t, frame_t: t, frame_sha256: 'b'.repeat(64),
      status: 'visible', x: 23, y: 34, uncertainty_px: 2}))}]};
  await page.goto(origin + '/motion.html');
  await page.locator('a[href="/motion-reference.html"]').click();
  await page.waitForURL('**/motion-reference.html');
  await input('#notebook-file', notebook);
  await input('#reference-file', reference);
  await page.waitForFunction(() => !document.getElementById('compare').disabled);
  await page.locator('#compare').focus();
  await page.keyboard.press('Enter');
  await compared();
  assert.equal(await page.locator('#scored-count').textContent(), '1');
  assert.equal(await page.locator('#unscored-count').textContent(), '1');
  assert.match(await page.locator('#selected-decision').textContent(), /Distance 5\.000 px/);
  assert.equal(await page.locator('#frame-empty').isVisible(), true);
  await page.screenshot({path: resolve(out, 'reference-desktop.png'), fullPage: true});
  record('Motion link and keyboard comparison load distributed shared modules; authored 3-4-5 error is scored and lost point remains unscored');

  const pending = page.waitForEvent('download');
  await page.locator('#save-case').click();
  const download = await pending;
  assert.equal(await download.failure(), null);
  const path = resolve(out, 'reference-inputs.json');
  await download.saveAs(path);
  const raw = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(raw.notebook, notebook);
  assert.deepEqual(raw.reference, reference);
  assert.equal(raw.comparison, undefined);
  // Change the actual reference too: an unchanged previous result must not
  // satisfy this assertion while the new File.text() read is still pending.
  const changed = structuredClone(raw);
  Object.assign(changed.reference.tracks[0].labels[0], {x: 26, y: 38});
  await input('#case-file', {...changed, comparison: {tracks: [{summary: {scored: 999}, rows: [{error_px: 0}]}]}});
  await page.waitForFunction(() => document.getElementById('selected-decision').textContent.includes('Distance 10.000 px'));
  assert.equal(await page.locator('#scored-count').textContent(), '1');
  assert.match(await page.locator('#selected-decision').textContent(), /Distance 10\.000 px/);
  record('completed raw-input download reopens; a changed 6-8-10 reference defeats stale-result and forged-answer success');

  const bad = structuredClone(changed);
  bad.reference.source.sha256 = 'c'.repeat(64);
  await input('#case-file', bad);
  await page.waitForFunction(() => !document.getElementById('error').hidden);
  assert.equal(await page.locator('#scored-count').textContent(), '1');
  assert.match(await page.locator('#selected-decision').textContent(), /Distance 10\.000 px/);
  record('wrong-source reference refuses while preserving the accepted comparison');

  await page.setViewportSize({width: 390, height: 844});
  await page.reload();
  await page.locator('#case-file').setInputFiles(path);
  await compared();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.getByRole('button', {name: 'Inspect 0.200000 seconds', exact: true}).focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#selected-decision').textContent(), /no accepted position/);
  await page.screenshot({path: resolve(out, 'reference-narrow.png'), fullPage: true});
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.offsite, []);
  record('fresh 390 px reopen and keyboard gap inspection work without overflow, page errors or external requests');
  report.result = 'PASS';
} catch (error) {
  report.failure = {message: error.message, stack: error.stack};
  throw error;
} finally {
  if (oldDirectory === undefined) delete process.env.BROWSER_ARTIFACT_DIR;
  else process.env.BROWSER_ARTIFACT_DIR = oldDirectory;
  chromium.launch = launch;
  await browser?.close();
  if (server) {server.closeAllConnections(); await new Promise(ok => server.close(ok));}
  await writeFile(resolve(out, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
}
