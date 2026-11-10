import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createProductServer} from '../server.mjs';
import {restoreSession} from '../src/session.mjs';
import {executeStudioDynamics} from '../src/science/studio-dynamics.mjs';
import {localMotionResponse} from '../src/science/local-motion-response.mjs';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const directory = resolve(process.env.BROWSER_ARTIFACT_DIR || '.receipts/local-motion-response');
await mkdir(directory, {recursive:true});
const server = createProductServer();
await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
const checks = [], sourceHashes = [], errors = [];
const mark = name => {checks.push(name); console.log('PASS ' + name);};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-12, Math.abs(expected) * 0.00006), `${actual} != ${expected}`);
let browser;
try {
  browser = await chromium.launch({headless:true, chromiumSandbox:true,
    ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath:process.env.BROWSER_EXECUTABLE_PATH} : {})});
  const sandboxPage = await browser.newPage();
  await sandboxPage.goto('chrome://sandbox');
  const sandbox = await sandboxPage.locator('body').innerText();
  assert.match(sandbox, /Seccomp-BPF sandbox\s+Yes/i);
  await sandboxPage.close();
  const page = await browser.newPage({viewport:{width:1440, height:1000}, reducedMotion:'reduce'});
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (this.canvas.id === 'mechanism-canvas' && String(text).startsWith('t '))
        window.__localResponseCanvasTime = Number(String(text).slice(2).replace(' s', ''));
      return fillText.call(this, text, ...args);
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const panel = page.locator('.local-response-instrument');
  await page.waitForFunction(() => document.querySelector('.local-response-instrument')?.dataset.state === 'available');
  async function notebook(filename) {
    const pending = page.waitForEvent('download');
    await page.locator('#export-session').click();
    const path = resolve(directory, filename);
    await (await pending).saveAs(path);
    const text = await readFile(path, 'utf8');
    sourceHashes.push({filename, sha256:createHash('sha256').update(text).digest('hex')});
    return {text, path};
  }
  async function inspect(text) {
    const session = restoreSession(text);
    await page.waitForFunction(() => Number.isFinite(window.__localResponseCanvasTime));
    const observed = await page.evaluate(() => {
      const element = document.querySelector('.local-response-instrument');
      return {index:Number(element.dataset.index), time:Number(element.dataset.time), status:element.dataset.state,
        canvasTime:window.__localResponseCanvasTime,
        derivatives:[...element.querySelectorAll('.local-response-detail')].slice(0, 2).map(node => node.textContent),
        initial:{position:Number(document.getElementById('initial-angle').value),rate:Number(document.getElementById('initial-rate').value)},
        settings:{inertia:Number(document.getElementById('inertia').value),command:Number(document.getElementById('simulation-command').value),duration:Number(document.getElementById('duration').value),dt:0.02}};
    });
    const model = session.discovery.selected;
    const execution = executeStudioDynamics(model, observed.initial, observed.settings);
    const row = localMotionResponse(model, execution.trajectory, observed.settings).rows[observed.index];
    assert.equal(observed.time, execution.trajectory[observed.index].time);
    assert.equal(observed.status, row.status);
    assert.ok(Math.abs(observed.canvasTime - observed.time) < 0.006);
    for (const [index, expected] of [row.torqueByPosition, row.torqueByRate].entries()) {
      if (expected === null) assert.equal(observed.derivatives[index], 'No admitted derivative');
      else close(Number(observed.derivatives[index].split(' = ')[1].split(' ')[0]), expected);
    }
    return observed;
  }
  const initial = await notebook('initial-notebook.json');
  assert.equal((await inspect(initial.text)).index, 0);
  await page.waitForTimeout(120);
  assert.equal(await panel.getAttribute('data-index'), '0');
  assert.ok(await page.locator('#mechanism-canvas').evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(value => value)));
  mark('actual default notebook, executed mechanism and reduced-motion row zero share the same law and state');

  await page.locator('#use-proposal').click();
  await page.locator('#run-experiment').click();
  await page.waitForFunction(() => document.getElementById('sample-count').textContent === '65');
  const revised = await notebook('revised-notebook.json');
  assert.match(await page.locator('.local-response-source').innerText(), /65 observations/);
  await inspect(revised.text);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(() => Number(document.querySelector('.local-response-instrument').dataset.index) > 2);
  await inspect(revised.text);
  await page.evaluate(() => {
    window.__localResponseAnnouncements = 0;
    new MutationObserver(records => window.__localResponseAnnouncements += records.length)
      .observe(document.querySelector('.local-response-status'), {childList:true, subtree:true, characterData:true});
  });
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.__localResponseAnnouncements), 0);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(() => document.querySelector('.local-response-instrument').dataset.index === '0');
  mark('new evidence changes the readout; ordinary animation uses the canvas sample without repeated live announcements');

  await page.locator('#inertia').fill('0');
  assert.equal(await panel.getAttribute('data-index'), null);
  await page.locator('#run-simulation').click();
  assert.match(await page.locator('.local-response-status').innerText(), /trajectory was refused/);
  await page.waitForTimeout(80);
  assert.equal(await panel.getAttribute('data-index'), null);
  await page.locator('#inertia').fill('2');
  await page.locator('#simulation-command').fill('0.4');
  await page.locator('#run-simulation').click();
  await inspect(revised.text);
  assert.match(await page.locator('.local-response-declarations').textContent(), /inertia 2 .*fixed command 0\.4/);
  mark('edited declarations retire old values; refused dynamics remain empty; a new accepted release recomputes the course');

  for (const selector of ['#compare-studio-laws', '#compare-earlier-studio-laws']) {
    await page.locator(selector).click();
    await page.waitForFunction(() => document.getElementById('studio-comparison-transport').hidden === false);
    await page.waitForFunction(() => document.querySelector('.local-response-instrument').dataset.index === undefined);
    assert.match(await page.locator('.local-response-status').innerText(), /Competitive-law motion/);
    await page.locator('#clear-studio-comparison').click();
    await page.waitForFunction(() => document.querySelector('.local-response-instrument').dataset.state === 'available');
    await inspect(revised.text);
  }
  mark('current and earlier competing-law views retire the inspected-law readout and returning executes it again');

  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = async function() {
      if (this.name === 'delayed-local-response.json') await new Promise(resolve => window.__releaseLocalResponseSource = resolve);
      return original.call(this);
    };
  });
  await page.locator('#observation-file').setInputFiles({name:'delayed-local-response.json', mimeType:'application/json', buffer:await readFile(resolve('examples/synthetic-quadratic-drag.json'))});
  assert.equal(await panel.getAttribute('data-index'), null);
  await page.locator('#session-file').setInputFiles(initial.path);
  await page.waitForFunction(() => document.getElementById('sample-count').textContent === '64');
  await inspect(initial.text);
  await page.evaluate(() => window.__releaseLocalResponseSource());
  await page.waitForTimeout(100);
  assert.match(await page.locator('.local-response-source').innerText(), /64 observations/);
  await inspect(initial.text);
  mark('pending replacement clears the old readout and a late superseded source cannot replace the accepted notebook');

  const observations = [];
  for (const command of [-1, 0, 1]) for (const position of [-1, -0.3, 0.6]) for (const rate of [-1, -0.2, 0, 0.4, 1.2])
    observations.push({command, position, rate, jointTorque:1.2 * command - 0.4 * rate - 0.3 * Math.sign(rate) - 0.8 * position});
  const signSource = {schema:'worldlaw.observations/v1', source:{label:'Declared analytic sign-torque receiving control',kind:'synthetic_analytic_fixture',units:{command:'N·m',position:'rad',rate:'rad/s',jointTorque:'N·m'}},observations,heldOut:[]};
  await page.locator('#observation-file').setInputFiles({name:'sign-torque-control.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(signSource))});
  await page.waitForFunction(() => document.getElementById('selected-terms').textContent.includes('Coulomb'));
  await page.waitForFunction(() => document.querySelector('.local-response-instrument').dataset.state === 'nonsmooth');
  assert.match(await panel.innerText(), /Zero-rate sign torque is nonsmooth/);
  assert.doesNotMatch(await panel.innerText(), /Decaying frozen modes|Growing frozen modes/);
  const signNotebook = await notebook('sign-torque-notebook.json');
  await inspect(signNotebook.text);
  mark('actual imported sign-torque observations produce an explicit nonsmooth zero-rate readout without invented frozen modes');

  await page.locator('#session-file').setInputFiles(revised.path);
  await page.waitForFunction(() => document.querySelector('.local-response-instrument').dataset.state === 'available');
  // Refuse a real diagnostic DOM update while selecting a different law. The
  // maintained renderer must retire the old response before either view runs.
  for (const [capture, target] of [['#clock-use-model', 'clock-results'], ['#affine-use-law', 'affine-results']]) {
    await page.locator(capture).click();
    await page.evaluate(id => {
      const element = document.getElementById(id);
      window.__localResponseRefusal = {element, original:element.replaceChildren};
      element.replaceChildren = () => {throw new Error('Controlled ' + id + ' DOM refusal');};
    }, target);
    await page.locator('.hypothesis[aria-pressed="false"]').first().click();
    assert.match(await page.locator('#error').innerText(), new RegExp('Controlled ' + target + ' DOM refusal'));
    assert.equal(await panel.getAttribute('data-index'), null);
    await page.waitForTimeout(80);
    assert.equal(await panel.getAttribute('data-index'), null);
    assert.match(await page.locator('.local-response-status').innerText(), /inspected law changed/);
    await page.evaluate(() => {
      const {element, original} = window.__localResponseRefusal;
      element.replaceChildren = original;
      delete window.__localResponseRefusal;
    });
    await page.locator('.hypothesis[aria-pressed="true"]').click();
    await page.waitForFunction(() => document.querySelector('.local-response-instrument').dataset.state === 'available');
    await inspect(revised.text);
  }
  mark('refused clock and affine DOM updates cannot retain the previous law response; a subsequent accepted selection recomputes it');
  await panel.locator('summary').focus();
  assert.equal(await page.evaluate(() => document.activeElement.matches('.local-response-explanation > summary')), true);
  await page.keyboard.press('Enter');
  assert.equal(await panel.locator('details').getAttribute('open'), '');
  assert.match(await panel.innerText(), /do not establish equilibrium.*nonlinear stability/);
  await page.locator('.instrument-stage').screenshot({path:resolve(directory, 'desktop-keyboard.png')});
  await page.keyboard.press('Enter');
  await page.locator('.instrument-stage').screenshot({path:resolve(directory, 'concept-b-integrated.png')});
  await page.evaluate(() => {
    const host = document.getElementById('local-motion-response');
    document.querySelector('.instrument-stage').after(host);
    host.dataset.receivingConcept = 'external';
  });
  const exploration = await page.addStyleTag({content:'[data-receiving-concept="external"]{background:#edf2f1;border-block:2px solid #456575;padding:18px}[data-receiving-concept="external"] .local-response-instrument{margin:0;border:0;padding:0;color:#203e4a}[data-receiving-concept="external"] .local-response-readouts{grid-template-columns:1fr}[data-receiving-concept="external"] .local-response-field{display:grid;grid-template-columns:130px 1fr 1fr;gap:16px;border-left:0;border-top:1px solid #a5b9bc;padding:12px 0 0}[data-receiving-concept="external"] h3,[data-receiving-concept="external"] h4,[data-receiving-concept="external"] p,[data-receiving-concept="external"] span,[data-receiving-concept="external"] summary{color:#203e4a}'});
  // Keep the capture origin explicit after the preceding locator screenshots
  // have scrolled the page, so both concepts include the whole mechanism.
  await page.evaluate(() => window.scrollTo(0, 0));
  const conceptBounds = await page.evaluate(() => {
    const stage = document.querySelector('.instrument-stage').getBoundingClientRect();
    const readout = document.getElementById('local-motion-response').getBoundingClientRect();
    return {x:stage.x + scrollX, y:stage.y + scrollY, width:stage.width, height:readout.bottom - stage.top};
  });
  await page.screenshot({path:resolve(directory, 'concept-a-separate-readout.png'), fullPage:true, clip:conceptBounds});
  await exploration.evaluate(node => node.remove());
  await page.evaluate(() => {
    const host = document.getElementById('local-motion-response');
    document.getElementById('studio-comparison-transport-slot').before(host);
    delete host.dataset.receivingConcept;
  });
  const layouts = [];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({width, height:960});
    const dimensions = await page.evaluate(() => ({viewport:innerWidth, document:document.documentElement.scrollWidth, readout:document.getElementById('local-motion-response').scrollWidth}));
    assert.ok(dimensions.document <= width, JSON.stringify(dimensions));
    layouts.push(dimensions);
    if (width === 390) await page.locator('.instrument-stage').screenshot({path:resolve(directory, 'narrow-instrument.png')});
  }
  assert.deepEqual(errors, []);
  mark('keyboard calculation disclosure, two rendered compositions and 320–1440 px layouts preserve source labels without overflow');
  await writeFile(resolve(directory, 'receipt.json'), JSON.stringify({browser:await browser.version(), sandbox, checks, layouts, sourceHashes,
    design:'Compared a separate ruled diagnostic report with the integrated mechanism readout. The integrated version keeps state time, the actual moving object and its local derivatives in one instrument.',
    scope:'Actual Chrome and launched Studio with declared synthetic observations. No physical validation, global stability or between-sample enclosure claim.'}, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
