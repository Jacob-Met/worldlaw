import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const sourceRoot=resolve(process.env.WORLDLAW_SOURCE_ROOT||'.');
const source=path=>import(pathToFileURL(resolve(sourceRoot,path)).href);
const [{createProductServer},{MAX_TEXT_LENGTH},{createSession,appendMeasurements,exportSession,restoreSession},{parseObservationText},{metadataInput,unicodeInput}]=
  await Promise.all([source('server.mjs'),source('src/data.mjs'),source('src/session.mjs'),source('src/data.mjs'),source('tests/support/notebook-size.mjs')]);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseline=process.argv.includes('--baseline');
const dir=resolve(process.env.BROWSER_ARTIFACT_DIR||'.receipts/legacy-notebook');
await mkdir(dir,{recursive:true});
const storageKey='worldlaw.notebook.v1',checks=[],fixtures=[],errors=[];
const mark=name=>{checks.push(name);console.log('PASS '+name);};
const sameReplay=(text,expected)=>{
  assert.ok(text.length<=MAX_TEXT_LENGTH);
  const actual=restoreSession(text);
  for(const key of ['base','lab','initialOptions','events','options','history'])
    assert.deepEqual(actual[key],expected[key],key);
};
for(const name of ['metadata','unicode']){
  let text;
  if(process.env.LEGACY_FIXTURE_DIR){
    text=await readFile(resolve(process.env.LEGACY_FIXTURE_DIR,name+'-notebook.json'),'utf8');
  }else{
    let state=createSession(parseObservationText(name==='metadata'?metadataInput():unicodeInput()));
    if(name==='unicode')state=appendMeasurements(state,[{command:0,position:0,rate:0,jointTorque:0,torqueNoiseRatio:1}]);
    text=JSON.stringify(JSON.parse(exportSession(state)),null,2);
  }
  assert.ok(text.length>MAX_TEXT_LENGTH);
  assert.ok(Buffer.byteLength(text)<=6_000_000);
  const expected=restoreSession(JSON.stringify(JSON.parse(text)));
  fixtures.push({name,text,expected,codeUnits:text.length,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
}
const server=createProductServer();
await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,
    ...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  for(const fixture of fixtures){
    for(const entry of ['file','storage']){
      const context=await browser.newContext({viewport:{width:1440,height:1000}});
      try{
        const page=await context.newPage();page.setDefaultTimeout(90000);
        page.on('pageerror',error=>errors.push(error.message));
        let downloads=0;page.on('download',()=>downloads++);
        await page.goto(origin);
        await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='64'&&document.getElementById('storage-status').textContent.length>0);
        const stored=()=>page.evaluate(key=>localStorage.getItem(key),storageKey);
        const open=async(name,text)=>{
          await page.locator('#session-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
          await page.waitForFunction(()=>document.getElementById('session-file').value==='');
        };
        const target=async()=>{
          await page.waitForFunction(({count,heldOut,label,history})=>
            document.getElementById('sample-count').textContent===String(count)&&
            document.getElementById('heldout-count').textContent===String(heldOut)&&
            document.getElementById('source-name').textContent===label&&
            document.getElementById('history-list').children.length===history,
            {count:fixture.expected.discovery.observations.length,heldOut:fixture.expected.base.heldOut.length,
              label:fixture.expected.base.source.label,history:fixture.expected.history.length});
        };
        const download=async()=>{
          const pending=page.waitForEvent('download');
          await page.locator('#export-session').focus();await page.keyboard.press('Enter');
          const file=await pending,path=resolve(dir,fixture.name+'-'+entry+'-recovered.json');
          await file.saveAs(path);
          return readFile(path,'utf8');
        };
        if(entry==='storage'){
          // Seed this upgrade fixture once. Reload must not hide a storage rewrite.
          await page.evaluate(({key,text})=>localStorage.setItem(key,text),{key:storageKey,text:fixture.text});
          assert.equal(await stored(),fixture.text);
          await page.reload();
          if(baseline){
            await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('could not be reopened'));
            assert.equal(await page.locator('#sample-count').innerText(),'64');
            assert.equal(await stored(),fixture.text);
            mark(fixture.name+': baseline startup refuses legacy text and preserves exact stored bytes');
            continue;
          }
          await target();
          assert.match(await page.locator('#notice').innerText(),/Reopened your local notebook/);
          assert.equal(await stored(),fixture.text);
          sameReplay(await download(),fixture.expected);
          assert.equal(await stored(),fixture.text,'Header Save downloads without rewriting legacy storage');
          mark(fixture.name+': startup recovers exact legacy bytes; keyboard download preserves evidence and original storage');
          if(fixture.name==='metadata'){
            for(const id of ['command','position','rate','measured-torque'])await page.locator('#'+id).fill('0');
            await page.locator('#run-experiment').click();
            await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='9');
            const saved=await stored();
            const next=restoreSession(saved);
            assert.ok(saved.length<=MAX_TEXT_LENGTH);
            assert.deepEqual(next.base,fixture.expected.base);
            assert.equal(next.events.length,fixture.expected.events.length+1);
            await page.reload();await page.waitForFunction(()=>document.getElementById('sample-count').textContent==='9');
            assert.equal(await stored(),saved);
            mark('recovered startup notebook accepts a measured revision, autosaves compactly and reloads');
          }
        }else{
          const before=await stored();
          await open(fixture.name+'-legacy.json',fixture.text);
          if(baseline){
            assert.match(await page.locator('#error').innerText(),/smaller than 2 MB/);
            assert.equal(await page.locator('#sample-count').innerText(),'64');
            assert.equal(await stored(),before);
            mark(fixture.name+': baseline file import refuses legacy text without replacing current evidence');
            continue;
          }
          await target();
          assert.match(await page.locator('#notice').innerText(),/Reopened the notebook/);
          const saved=await stored();sameReplay(saved,fixture.expected);
          sameReplay(await download(),fixture.expected);
          await page.reload();await target();assert.equal(await stored(),saved);
          mark(fixture.name+': original legacy file reopens, autosaves bounded text, downloads and reloads');
          if(fixture.name==='metadata'){
            const beforeDownloads=downloads;
            for(const [broken,repaired] of [['1 2','12'],['- 1','-1'],['1 e2','1e2'],['tru e','true']]){
              const raw=JSON.parse(saved);raw.base.source.metadata.tokenGuard='REPLACE_TOKEN';
              const template=JSON.stringify(raw);
              // If whitespace were deleted indiscriminately, this damaged notebook
              // would become an otherwise accepted notebook with a changed value.
              restoreSession(template.replace('"REPLACE_TOKEN"',repaired));
              const invalid=template.replace('"REPLACE_TOKEN"',broken);
              const padded=' '.repeat(MAX_TEXT_LENGTH+1-invalid.length)+invalid;
              await open('split-token.json',padded);
              assert.match(await page.locator('#error').innerText(),/could not be read/);
              await target();assert.equal(await stored(),saved);
            }
            assert.equal(downloads,beforeDownloads);
            mark('split numeric and boolean tokens refuse without state, storage or download side effects');
          }
        }
      }finally{await context.close();}
    }
  }
  assert.deepEqual(errors,[]);
  const receipt={mode:baseline?'PR340-baseline':'candidate',browser:await browser.version(),checks,errors,
    fixtureOrigin:process.env.LEGACY_FIXTURE_DIR?'retained original browser downloads':'generated legacy formatting controls',
    fixtures:fixtures.map(({name,codeUnits,bytes,sha256})=>({name,codeUnits,bytes,sha256})),
    scope:'Authored software persistence and upgrade controls; no physical measurement or human acceptance claim.'};
  await writeFile(resolve(dir,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
}finally{
  if(browser)await browser.close();
  await new Promise(res=>server.close(res));
}
