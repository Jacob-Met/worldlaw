import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChallengeServer} from './trajectory-server-92be.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),out=process.env.BROWSER_ARTIFACT_DIR;await mkdir(out,{recursive:true});
const server=createChallengeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[],errors=[];
try{
 browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
 const guard=await browser.newPage();await guard.goto('chrome://sandbox');const sandbox=await guard.locator('body').innerText();for(const p of [/Layer 1 Sandbox\s+Namespace/,/PID namespaces\s+Yes/,/Network namespaces\s+Yes/,/Seccomp-BPF sandbox\s+Yes/])assert.match(sandbox,p);await guard.close();
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(String(e)));await page.goto(`http://127.0.0.1:${server.address().port}/trajectory.html`);
 await page.waitForFunction(()=>document.querySelector('#trajectory-chart [data-series="predicted"]'));
 await page.locator('#bundle-file').setInputFiles(process.env.ENERGY_READING_SOURCE);
 await page.waitForFunction(()=>document.querySelector('#source-name').textContent==='Authored reading compatibility receiving'&&document.querySelector('#challenge-workspace').getAttribute('aria-busy')==='false');
 await page.locator('#model-list button[data-model-id="rate+gravity"]').click();
 const check=async()=>{await page.locator('#check-initial-energy').click();await page.waitForFunction(()=>document.querySelector('#initial-energy').dataset.state==='confined');};
 const compare=async value=>{await page.locator('#initial-energy-reading-radius').fill(value);await page.locator('#compare-initial-energy-readings').click();await page.waitForFunction(()=>!document.querySelector('#initial-energy-reading-output').hidden);};
 const upload=async raw=>page.locator('#open-initial-energy').setInputFiles({name:'question.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
 const save=async name=>{const pending=page.waitForEvent('download');await page.locator('#save-initial-energy').click();const download=await pending,path=resolve(out,name);await download.saveAs(path);return JSON.parse(await readFile(path,'utf8'));};
 await page.locator('#initial-position-width').fill('0');await page.locator('#initial-rate-width').fill('0');await check();
 const curve=await page.locator('#trajectory-chart [data-series="predicted"]').getAttribute('points'),bound=await page.locator('#initial-energy-output table').innerText();

 await compare('.5');
 const source=await save('focused-course-source.json');
 const {prepareInitialEnergyQuestion}=await import('../src/trajectory/initial-energy-receipt.mjs');
 const q=prepareInitialEnergyQuestion(source.model,source.run,source.options,source.readingComparison),first=q.readingResult.course.first;
 assert.equal(first.earlier.index,199);assert.equal(first.later.index,200);
 const decimal=s=>{const [base,exponent='0']=s.split('e'),parts=base.split('.'),digits=parts.join(''),scale=(parts[1]?.length??0)-Number(exponent);return scale>=0?[BigInt(digits),10n**BigInt(scale)]:[BigInt(digits)*10n**BigInt(-scale),1n];};
 const le=(a,b)=>a[0]*b[1]<=b[0]*a[1];
 const texts=await page.locator('#initial-energy-course-travel p').allTextContents();
 for(const [i,key] of ['requiredTravel','allowedTravel','gap'].entries()){
  const match=texts[i].match(/: ([0-9.e+-]+)(?: to ([0-9.e+-]+))? rad/);assert(match);const exact=[BigInt(first[key].numerator),BigInt(first[key].denominator)];assert(le(decimal(match[1]),exact));assert(le(exact,decimal(match[2]??match[1])));
  assert((await page.locator('#initial-energy-course details').textContent()).includes(first[key].numerator+'/'+first[key].denominator));
 }
 assert.equal(await page.locator('#initial-energy-course').getAttribute('data-state'),'conjunction_rejected');
 checks.push('Three outward decimal ranges independently enclose exact native certificate; exact fractions and strict result retained');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1100});await page.locator('#initial-energy-course').scrollIntoViewIfNeeded();
  assert(await page.locator('#initial-energy-course').evaluate(e=>e.scrollWidth<=e.clientWidth));
  assert(await page.locator('#initial-energy-course-travel').evaluate(e=>e.scrollWidth<=e.clientWidth));
  await page.screenshot({path:resolve(out,`course-decimal-${width}.png`)});
  await page.locator('#initial-energy-course-later').click();assert.equal(await page.locator('#initial-energy-reading-page').inputValue(),'2');assert.equal(await page.evaluate(()=>document.activeElement.dataset.originalIndex),'200');
 }
 checks.push('Desktop390 readable quantitative summary with unchanged exact details and witness navigation');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'receipt.json'),JSON.stringify({checks,errors,sandbox,browser:await browser.version(),scope:'Focused presentation receiving only, following original six functional groups; decimal summary panel revision'},null,2)+'\n');console.log(JSON.stringify({checks:checks.length}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
