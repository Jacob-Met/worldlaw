import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';
import {MAX_TEXT_LENGTH} from '../src/data.mjs';
import {restoreSession} from '../src/session.mjs';
import {metadataInput,unicodeInput} from '../tests/support/notebook-size.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseline=process.argv.includes('--baseline');
const dir=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/notebook-size');
await mkdir(dir,{recursive:true});
const server=createProductServer();
await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
let browser;
const checks=[],sizes={};
const mark=name=>{checks.push(name);console.log('PASS '+name);};
const storageKey='worldlaw.notebook.v1';
try {
  browser=await chromium.launch({headless:true,chromiumSandbox:true,
    ...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='64');
  const stored=()=>page.evaluate(key=>localStorage.getItem(key),storageKey);
  const openSource=async(name,text,count)=>{
    await page.locator('#observation-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
    await page.waitForFunction(n=>document.getElementById('sample-count').textContent===String(n),count);
  };
  const download=async name=>{
    const pending=page.waitForEvent('download');
    await page.locator('#export-session').focus();await page.keyboard.press('Enter');
    const file=await pending,path=resolve(dir,name);await file.saveAs(path);
    return {path,text:await readFile(path,'utf8')};
  };
  await openSource('authored-metadata.json',metadataInput(),8);
  const metadataSaved=await stored(),metadataDownload=await download('metadata-notebook.json');
  sizes.metadata={sourceBytes:Buffer.byteLength(metadataInput()),exportCodeUnits:metadataDownload.text.length,exportBytes:Buffer.byteLength(metadataDownload.text)};
  assert.equal(metadataSaved,metadataDownload.text);
  if(baseline) {
    assert.ok(metadataSaved.length>MAX_TEXT_LENGTH);
    await page.reload();await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='64');
    assert.match(await page.locator('#notice').innerText(),/could not be reopened/);
    assert.equal(await stored(),metadataSaved);
    mark('original metadata export exceeds parser limit; reload refuses and retains stored bytes');
  } else {
    assert.ok(metadataSaved.length<=MAX_TEXT_LENGTH);
    assert.equal(restoreSession(metadataSaved).base.source.metadata.capture.diagnostics.qualityFlags.length,120000);
    await page.reload();await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='8');
    await page.locator('#session-file').setInputFiles(metadataDownload.path);
    await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Reopened'));
    assert.equal(await stored(),metadataSaved);
    mark('large accepted metadata survives browser save, reload, keyboard download and file reopen');
  }
  const unicode=unicodeInput();assert.ok(Buffer.byteLength(unicode)<2_000_000);
  await openSource('authored-unicode.json',unicode,4095);
  for(const id of ['command','position','rate','measured-torque'])await page.locator('#'+id).fill('0');
  await page.locator('#measurement-noise-ratio').fill('1');
  await page.locator('#run-experiment').click();
  await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='4096');
  const unicodeDownload=await download('unicode-notebook.json');
  const portable=baseline?JSON.stringify(JSON.parse(unicodeDownload.text)):unicodeDownload.text;
  sizes.unicode={sourceBytes:Buffer.byteLength(unicode),exportCodeUnits:unicodeDownload.text.length,
    exportBytes:Buffer.byteLength(unicodeDownload.text),portableCodeUnits:portable.length,portableBytes:Buffer.byteLength(portable)};
  assert.ok(portable.length<=MAX_TEXT_LENGTH);assert.ok(Buffer.byteLength(portable)>2_000_000);
  const expected=restoreSession(portable);
  assert.equal(expected.events.length,1);
  assert.equal(expected.base.source.metadata.notes,'\u0800'.repeat(170000));
  const before=await stored();
  await page.locator('#session-file').setInputFiles(baseline?
    {name:'unicode-whitespace-only-compact.json',mimeType:'application/json',buffer:Buffer.from(portable)}:unicodeDownload.path);
  if(baseline) {
    await page.locator('#error').waitFor({state:'visible'});
    assert.match(await page.locator('#error').innerText(),/Notebook files must be smaller than 2 MB/);
    assert.equal(await stored(),before);
    mark('original byte preflight refuses a semantically valid whitespace-compacted Unicode notebook');
  } else {
    await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Reopened'));
    assert.equal(await stored(),portable);
    assert.deepEqual(restoreSession(await stored()).history,expected.history);
    await page.reload();await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='4096');
    assert.equal(await stored(),portable);
    mark('valid Unicode source and measured revision export above 2 MB, then reopen and reload intact');
    const refuse=async(name,text,message)=>{
      await page.locator('#session-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
      await page.locator('#error').waitFor({state:'visible'});assert.match(await page.locator('#error').innerText(),message);
      assert.equal(await stored(),portable);assert.equal(await page.locator('#sample-count').innerText(),'4096');
    };
    await refuse('invalid.json','{',/could not be read/);
    await refuse('too-many-code-units.json',portable.padEnd(MAX_TEXT_LENGTH+1,' '),/smaller than 2 MB/);
    await page.evaluate(()=>{window.notebookReads=[];const original=File.prototype.text;File.prototype.text=function(){window.notebookReads.push(this.name);return original.call(this);};});
    await refuse('too-many-bytes.json',' '.repeat(3*MAX_TEXT_LENGTH+1),/no larger than 6 MB/);
    assert.equal(await page.evaluate(()=>window.notebookReads.includes('too-many-bytes.json')),false);
    const tooWideSource=unicode.replace('\u0800'.repeat(170000),'\u0800'.repeat(190000));
    assert.ok(tooWideSource.length<MAX_TEXT_LENGTH);assert.ok(Buffer.byteLength(tooWideSource)>2_000_000);
    await page.locator('#observation-file').setInputFiles({name:'source-too-many-bytes.json',mimeType:'application/json',buffer:Buffer.from(tooWideSource)});
    await page.locator('#error').waitFor({state:'visible'});assert.match(await page.locator('#error').innerText(),/Observation files must be smaller than 2 MB/);
    assert.equal(await stored(),portable);
    assert.equal(await page.evaluate(()=>window.notebookReads.includes('source-too-many-bytes.json')),false);
    mark('malformed and oversized notebooks preserve the current evidence; pre-read and raw-source limits remain bounded');
    await page.locator('#session-file').setInputFiles(unicodeDownload.path);
    await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Reopened'));
    await page.screenshot({path:resolve(dir,'notebook-desktop.png')});
    await page.setViewportSize({width:390,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:resolve(dir,'notebook-mobile.png')});
    mark('reopened notebook renders at desktop and 390-pixel width');
  }
  assert.deepEqual(errors,[]);
  const receipt={mode:baseline?'original-controls':'candidate',browser:await browser.version(),checks,sizes,
    scope:'Authored software persistence controls, not physical measurements or human acceptance.'};
  await writeFile(resolve(dir,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
} finally {
  if(browser)await browser.close();
  await new Promise(res=>server.close(res));
}
