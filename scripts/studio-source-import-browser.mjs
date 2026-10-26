// Independent real-browser source-custody receiver. This does not patch product code.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Maintained location: scripts/studio-source-import-browser.mjs. A broker can
// run this independently retained receiver against another explicit checkout.
const root=resolve(process.env.WORLDLAW_SOURCE || fileURLToPath(new URL('../',import.meta.url)));
const out=resolve(process.env.BROWSER_ARTIFACT_DIR || '/tmp/worldlaw-source-order-review');
const localImport=relative=>import(pathToFileURL(join(root,relative)).href);
const [{createProductServer},{createSession,exportSession},{exportDeadzoneInputs},
  {exportAngularFrequencyInputs},{requireChromiumSandbox},{chromium}]=await Promise.all([
  localImport('server.mjs'),localImport('src/session.mjs'),
  localImport('src/science/command-deadzone.mjs'),
  localImport('src/science/angular-frequency.mjs'),
  localImport('scripts/support/chromium-sandbox.mjs'),
  import(process.env.PLAYWRIGHT_MODULE || 'playwright'),
]);
await mkdir(out,{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
const source=label=>({source:{label,kind:'synthetic_analytic_fixture'},
  observations:Array.from({length:21},(_,i)=>{
    const phase=[...label].reduce((sum,character,index)=>sum+character.codePointAt(0)*(index+1),0)%997/997;
    const command=Math.sin(i*.741+.1+phase),position=Math.cos(i*1.117+.3+phase),rate=Math.sin(i*1.337+.8+phase);
    return {command,position,rate,jointTorque:1.2*command-2.3*position-.17*rate+.2};
  }),heldOut:[]});
const selectors={observation:'#observation-file',notebook:'#session-file',
  deadzone:'#deadzone-open',frequency:'#frequency-open',
  excitation:'#scalar-excitation input[type=file]'};
function fileFor(kind,label,name,invalid=false){
  const dataset=source(label),session=createSession(dataset);
  const text=invalid?'{}':kind==='observation'?JSON.stringify(dataset):
    kind==='notebook'?exportSession(session):
    kind==='deadzone'?exportDeadzoneInputs(session,[0,.2]):
    kind==='frequency'?exportAngularFrequencyInputs(session,{}):
    JSON.stringify({schema:'worldlaw.scalar-excitation-input/v1',
      notebook:JSON.parse(exportSession(session)),terms:['command','spring','bias'],
      permitted:[{command:1,position:0,rate:0}]});
  return {file:{name,mimeType:'application/json',buffer:Buffer.from(text)},dataset,base:session.base,
    inputSHA256:hash(text),kind,invalid};
}

const server=createProductServer();
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
const origin='http://127.0.0.1:'+server.address().port;
const cases=[];
for(const panel of ['deadzone','excitation','frequency']){
  for(const pair of [[panel,'observation'],['notebook',panel]]){
    for(const order of ['older-first','newer-first'])cases.push({older:pair[0],newer:pair[1],order});
  }
}
cases.push({older:'deadzone',newer:'frequency',order:'older-first'});
cases.push({older:'excitation',newer:'deadzone',order:'older-first'});
cases.push({older:'deadzone',newer:'observation',order:'older-first',invalidNewer:true});
cases.push({older:'notebook',newer:'frequency',order:'older-first',invalidNewer:true});
cases.push({older:'deadzone',newer:'observation',order:'newer-first',invalidNewer:true});
cases.push({older:'notebook',newer:'frequency',order:'newer-first',invalidNewer:true});
for(const order of ['older-first','newer-first']){
  cases.push({older:'excitation',newer:'notebook',order});
  cases.push({older:'observation',newer:'notebook',order});
}
for(const kind of ['observation','notebook','deadzone','excitation','frequency']){
  cases.push({older:kind,newer:kind,order:'older-first',sameInput:true});
}

let browser,golden=null;const results=[],pageErrors=[];
const sourceAssets=['/src/app.mjs','/src/science/command-deadzone-panel.mjs','/src/science/excitation-design-panel.mjs','/src/science/angular-frequency-panel.mjs'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceAssets.map(async asset=>[asset,hash(await readFile(join(root,asset.slice(1))))])));
const writeReceipt=()=>writeFile(join(out,'source-order-receipt.json'),JSON.stringify({sourceCommit:process.env.SOURCE_COMMIT||null,sourceHashes,browser:browser?.version(),results,golden,pageErrors,scope:'Actual maintained Studio source imports and exported evidence; deliberately controlled file-read order plus original synthetic discovery golden path; no physical accuracy claim.'},null,2));
try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,
    ...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
  const admission=await browser.newPage(),cdp=await admission.context().newCDPSession(admission);
  const sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});
  await admission.close();await writeFile(join(out,'sandbox.json'),JSON.stringify(sandbox,null,2));
  for(const [index,course] of cases.entries()){
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const page=await context.newPage(),id=String(index+1).padStart(2,'0')+'-'+course.older+'-'+course.newer+'-'+course.order+(course.invalidNewer?'-invalid':'');
    page.on('pageerror',error=>pageErrors.push({id,message:error.message}));
    const record={id,...course};
    try{
      await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#sample-count')?.textContent==='64');
      const accepted=source('Accepted original '+id);
      await page.locator('#observation-file').setInputFiles({name:'accepted.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(accepted))});
      await page.waitForFunction(label=>document.querySelector('#source-name')?.textContent===label,accepted.source.label);
      await page.evaluate(()=>{
        const native=File.prototype.text;
        window.__sourceReadGates={};window.__sourceReadCounts={};
        File.prototype.text=async function(){
          if(this.name.startsWith('held-')){window.__sourceReadCounts[this.name]=(window.__sourceReadCounts[this.name]||0)+1;await new Promise(resolve=>window.__sourceReadGates[this.name]=resolve);}
          return native.call(this);
        };
      });
      const older=fileFor(course.older,'Older selected '+id,'held-older.json');
      const newer=fileFor(course.newer,'Newer selected '+id,'held-newer.json',course.invalidNewer);
      record.inputSHA256={older:older.inputSHA256,newer:newer.inputSHA256};
      for(const item of [older,newer]){
        await page.locator(selectors[item.kind]).setInputFiles(item.file);
        await page.waitForFunction(name=>typeof window.__sourceReadGates[name]==='function',item.file.name);
      }
      record.beforeCompletion=await page.locator('#source-name').innerText();
      const completion=course.order==='older-first'?[older,newer]:[newer,older];
      for(const item of completion){
        await page.evaluate(async name=>{
          window.__sourceReadGates[name]();
          await new Promise(resolve=>setTimeout(resolve,0));
          await new Promise(requestAnimationFrame);
        },item.file.name);
        (record.completed??=[]).push({file:item.file.name,visibleSource:await page.locator('#source-name').innerText()});
        if(course.sameInput&&item===older)record.pendingNewerFile=await page.locator(selectors[newer.kind]).evaluate(input=>input.files?.[0]?.name??null);
      }
      const expected=course.invalidNewer?accepted:newer.dataset;
      const expectedBase=course.invalidNewer?createSession(accepted).base:newer.base;
      record.expectedSource=expected.source.label;
      record.actualSource=await page.locator('#source-name').innerText();
      const downloadEvent=page.waitForEvent('download');await page.locator('#export-session').click();
      const path=join(out,id+'-download.json');await(await downloadEvent).saveAs(path);
      const downloaded=JSON.parse(await readFile(path,'utf8'));
      record.downloadSource=downloaded.base.source.label;
      record.downloadRowsSHA256=hash(JSON.stringify(downloaded.base.observations));
      record.expectedRowsSHA256=hash(JSON.stringify(expected.observations));
      record.downloadBaseSHA256=hash(JSON.stringify(downloaded.base));
      record.expectedBaseSHA256=hash(JSON.stringify(expectedBase));
      record.error=await page.locator('#error').textContent();
      const olderStayedRetired=course.order!=='older-first'||record.completed[0].visibleSource===accepted.source.label;
      record.passed=olderStayedRetired&&record.actualSource===record.expectedSource&&
        record.downloadSource===record.expectedSource&&record.downloadRowsSHA256===record.expectedRowsSHA256&&record.downloadBaseSHA256===record.expectedBaseSHA256;
      if(course.sameInput){
        record.passed=record.passed&&record.pendingNewerFile===newer.file.name;
        record.clearedAfterSuccess=await page.locator(selectors[newer.kind]).inputValue()==='';
        await page.locator(selectors[newer.kind]).setInputFiles(newer.file);
        await page.waitForFunction(name=>window.__sourceReadCounts[name]===2,newer.file.name);
        await page.evaluate(async name=>{window.__sourceReadGates[name]();await new Promise(resolve=>setTimeout(resolve,0));await new Promise(requestAnimationFrame);},newer.file.name);
        record.sameFileReopened=(await page.locator('#source-name').innerText())===record.expectedSource&&
          await page.locator(selectors[newer.kind]).inputValue()==='';
        record.passed=record.passed&&record.clearedAfterSuccess&&record.sameFileReopened;
      }
      if(!record.passed&&results.filter(result=>!result.passed).length<2){
        await page.screenshot({path:join(out,id+'-desktop.png'),fullPage:true});
        await page.setViewportSize({width:390,height:960});
        await page.screenshot({path:join(out,id+'-narrow.png'),fullPage:true});
      }
      console.log(JSON.stringify(record));
    }catch(error){record.passed=false;record.harnessError=error.stack;console.log(JSON.stringify(record));}
    finally{results.push(record);await context.close();await writeReceipt();}
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage(),loadedAssets={},loadedPromises=[];
  page.on('pageerror',error=>pageErrors.push({id:'golden',message:error.message}));
  page.on('response',response=>{const pathname=new URL(response.url()).pathname;if(sourceAssets.includes(pathname))loadedPromises.push(response.body().then(bytes=>{loadedAssets[pathname]={status:response.status(),sha256:hash(bytes)};}));});
  try{
    await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#sample-count')?.textContent==='64');
    await Promise.all(loadedPromises);
    for(const asset of sourceAssets){assert.equal(loadedAssets[asset]?.status,200,asset);assert.equal(loadedAssets[asset]?.sha256,sourceHashes[asset],asset);}
    const before=Number((await page.locator('#heldout-error').innerText()).replaceAll(',',''));
    await page.locator('#use-proposal').focus();await page.keyboard.press('Enter');await page.locator('#run-experiment').click();
    await page.waitForFunction(()=>document.querySelector('#sample-count')?.textContent==='65');
    assert.match(await page.locator('#selected-terms').innerText(),/Sinusoidal gravity/);
    const after=Number((await page.locator('#heldout-error').innerText()).replaceAll(',',''));assert.ok(after<before/100);
    const saving=page.waitForEvent('download');await page.locator('#export-session').click();const notebookPath=join(out,'golden-notebook.json');await(await saving).saveAs(notebookPath);
    const original=JSON.parse(await readFile(notebookPath,'utf8'));assert.equal(original.events.length,1);
    await page.reload();await page.waitForFunction(()=>document.querySelector('#sample-count')?.textContent==='65');
    await page.locator('#undo').click();assert.equal(await page.locator('#sample-count').innerText(),'64');
    await page.locator('#session-file').setInputFiles(notebookPath);await page.waitForFunction(()=>document.querySelector('#sample-count')?.textContent==='65');
    await page.locator('#observation-file').setInputFiles({name:'malformed-observations.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#sample-count').innerText(),'65');
    const secondSaving=page.waitForEvent('download');await page.locator('#export-session').click();const roundtripPath=join(out,'golden-roundtrip.json');await(await secondSaving).saveAs(roundtripPath);
    assert.deepEqual(JSON.parse(await readFile(roundtripPath,'utf8')),original);
    // Reopen to clear the intentional refusal before visual receiving of current results.
    await page.locator('#session-file').setInputFiles(notebookPath);await page.waitForFunction(()=>document.querySelector('#error').hidden===true);
    const layouts=[];for(const width of [1440,390]){await page.setViewportSize({width,height:1000});const dimensions=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(dimensions.document<=width,JSON.stringify(dimensions));layouts.push(dimensions);await page.screenshot({path:join(out,'golden-current-'+width+'.png'),fullPage:true});}
    golden={passed:true,beforeHeldOutRMSE:before,afterHeldOutRMSE:after,notebookSHA256:hash(JSON.stringify(original)),loadedAssets,layouts,checks:['actual imported-module bytes match exact candidate source','keyboard-selected synthetic experiment revises executable structure','held-out improvement in bounded virtual instrument','download, reload, undo and source-only reopen','invalid replacement retains exact accepted notebook','desktop and narrow current-result screenshots']};
    console.log(JSON.stringify({golden}));
  }catch(error){golden={passed:false,error:error.stack,loadedAssets};console.log(JSON.stringify({golden}));}
  finally{await context.close();await writeReceipt();}
  assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));
  assert.equal(golden?.passed,true,JSON.stringify(golden));
  assert.ok(results.every(result=>result.passed),results.filter(result=>!result.passed).map(result=>result.id).join(', '));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
