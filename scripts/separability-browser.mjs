// Receive the actual maintained Studio served by `node server.mjs`.
// No mocked DOM, server replacement, browser-sandbox disabling or source edits.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createProductServer} from '../server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.env.BROWSER_ARTIFACT_DIR||path.join(root,'evidence/separability-browser'));
await mkdir(output,{recursive:true});
const modulePath=process.env.PLAYWRIGHT_MODULE;
if(!modulePath)throw new Error('Set PLAYWRIGHT_MODULE to the installed Playwright entrypoint');
const {chromium}=await import(pathToFileURL(modulePath).href);
const browser=await chromium.launch({headless:true,chromiumSandbox:true,
  ...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
const server=process.env.WORLDLAW_URL?null:createProductServer();
if(server)await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const base=process.env.WORLDLAW_URL||`http://127.0.0.1:${server.address().port}`;
const receipt={url:base,browser:browser.version(),checks:[],screenshots:[]};
const check=(name)=>receipt.checks.push(name);
async function openPanel(){const detail=page.locator('#separability > details');if(await detail.getAttribute('open')===null)await detail.locator(':scope > summary').click();}
async function run(){await openPanel();await page.locator('#separability-radius').fill('.01');await page.locator('#separability-exact').check();await page.locator('#separability-run').click();}
async function save(name){const pending=page.waitForEvent('download');await page.locator('#export-session').click();const download=await pending;const dest=path.join(output,name);await download.saveAs(dest);return dest;}
try{
  await page.goto('chrome://sandbox/');
  receipt.sandbox=await page.locator('body').innerText();
  assert.match(receipt.sandbox,/You are adequately sandboxed/);
  await page.goto(base);await page.locator('#sample-count').waitFor();
  await page.locator('#observation-file').setInputFiles(path.join(root,'examples/separability/interaction.json'));
  await page.getByText('Authored interaction separability control',{exact:true}).first().waitFor();
  const original=await save('original-notebook.json');
  await openPanel();await page.locator('#separability-run').click();
  assert.match(await page.locator('#separability-output').innerText(),/Declare an absolute reading-error bound/);
  await page.locator('#separability-radius').fill('.01');await page.locator('#separability-run').click();
  assert.match(await page.locator('#separability-output').innerText(),/requires explicitly assumed exact/);
  await run();
  assert.equal(await page.locator('#separability-output h3').innerText(),'9 of 9 rectangles exclude additivity');
  assert.equal(await page.locator('#separability-rectangle option').count(),9);
  assert.match(await page.locator('#separability-output').innerText(),/synthetic-authored/);
  check('Actual authored observation import; explicit assumptions; all nine source rectangles exclude additivity');
  await page.locator('#separability-rectangle').selectOption('4');
  const readings=page.locator('.separability-view td details');
  for(let i=0;i<4;i++)await readings.nth(i).locator('summary').click();
  assert.match(await page.locator('.separability-view').innerText(),/Row 1:/);
  assert.match(await page.locator('.separability-view').innerText(),/Row 9:/);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    for(const composition of ['corners','differences']){
      await page.locator('#separability-composition').selectOption(composition);
      const name=`${composition}-${width}.png`;
      await page.locator('#separability').screenshot({path:path.join(output,name)});
      receipt.screenshots.push(name);
      assert.ok(await page.locator('#separability').evaluate(node=>node.scrollWidth<=node.clientWidth+1),'panel must fit its available width');
    }
  }
  check('Every original corner reading; both scientific compositions at desktop and390px without panel overflow');
  await page.locator('#separability-radius').fill('2');
  assert.match(await page.locator('#separability-output').innerText(),/Inputs changed/);
  assert.equal(await page.locator('#separability-output h3').count(),0);
  await page.locator('#separability-run').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#separability-output h3').innerText(),'0 of 9 rectangles exclude additivity');
  const after=await save('after-screen-notebook.json');
  assert.deepEqual(JSON.parse(await readFile(after,'utf8')),JSON.parse(await readFile(original,'utf8')));
  check('Changed bounds invalidate old result; keyboard rerun changes conclusion; source notebook is unchanged');
  await page.reload();await openPanel();
  assert.equal(await page.locator('#separability-radius').inputValue(),'');
  assert.equal(await page.locator('#separability-exact').isChecked(),false);
  await page.locator('#session-file').setInputFiles(original);
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Reopened the notebook'));
  await run();
  assert.equal(await page.locator('#separability-output h3').innerText(),'9 of 9 rectangles exclude additivity');
  check('Actual downloaded notebook reopens and recomputes after deliberate redeclaration');
  await page.locator('#observation-file').setInputFiles(path.join(root,'examples/separability/additive.json'));
  await page.getByText('Authored additive separability control',{exact:true}).first().waitFor();await run();
  assert.equal(await page.locator('#separability-output h3').innerText(),'0 of 9 rectangles exclude additivity');
  check('Independent additive source control excludes none; previous source conclusion is removed');
  assert.deepEqual(errors,[]);check('No page exceptions');
  receipt.status='passed';await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
