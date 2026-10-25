import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {createProductServer} from '../server.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_PATH?pathToFileURL(process.env.PUPPETEER_PATH).href:'puppeteer');
import {freezeSaturationRateRequest} from '../src/unknown-lab/saturation-rate-acquisition.mjs';
import {saturatedRatePlanningExample} from '../src/unknown-lab/saturation-rate-fixture.mjs';
const server=createProductServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});

const out=process.env.BROWSER_ARTIFACT_DIR||'/tmp/worldlaw-rate-conditioning-browser';await mkdir(out,{recursive:true});let browser;const errors=[],checks=[];
const study=saturatedRatePlanningExample();
for(const run of study.runs){
 const old=-.4*Math.sign(run.probe.rate),rate=Math.sign(run.probe.rate)*.01,response=-.4*Math.tanh(rate/.28),baseline=-.2*(rate-run.probe.rate);
 run.probe.rate=rate;
 for(const row of run.notebook.trials){row.rate=rate;row.jointTorque+=baseline;if(row.history==='conditioned')row.jointTorque+=response-old;}
}
const config={settings:{maxEvaluations:1024},windows:[[.05,.2],[.5,1]],probes:[0,.01,.1,.2,.3,.5,100].map((rate,i)=>({id:'offer-'+i,position:.6,rate,cost:rate>.3?10:1})),contrastRadius:.002,budget:1};
const request=freezeSaturationRateRequest(study,config,{runId:'conditioned-future-rate',arrangement:'Authored low-rate source control; fixed preparation and paired torque readout',pairs:16});
const source={schema:'worldlaw.saturation-rate-acquisition/v1',request,observation:null};
try{
 browser=await puppeteer.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1440,height:1000});
 await page.goto('http://127.0.0.1:'+server.address().port+'/unknown-lab.html',{waitUntil:'networkidle0'});
 const status=prefix=>page.waitForFunction(prefix=>document.querySelector('#rate-status').textContent.startsWith(prefix),{timeout:60000},prefix);
 const plan=()=>page.$eval('#rate-plan-json',e=>JSON.parse(e.textContent));
 const file=async value=>page.$eval('#rate-file',(e,value)=>{const d=new DataTransfer();d.items.add(new File([JSON.stringify(value)],'conditioning-original-request.json',{type:'application/json'}));e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));},value);
 await page.evaluate(()=>{const original=URL.createObjectURL.bind(URL);window.rateBlob=null;URL.createObjectURL=blob=>{window.rateBlob=blob;return original(blob);};});
 const exported=async id=>{await page.evaluate(()=>{window.rateBlob=null;});await page.click('#'+id);await page.waitForFunction(()=>window.rateBlob!==null,{timeout:60000});return JSON.parse(await page.evaluate(()=>window.rateBlob.text()));};
 await file(source);await status('Original inputs replayed');
 const original=await plan();assert.equal(original.selected,'offer-4');assert.equal(original.courses[4].probe.rate,.3);assert(original.courses[4].margin.outer[0]>.02246);
 assert.equal(original.courses.length,7);assert(original.courses.filter(c=>c.probe.rate>.3).every(c=>!c.affordable));
 assert.match(await page.$eval('.saturation-rate-choice',e=>e.textContent),/relation between each original training response and the offered response/);
 assert.match(await page.$eval('#rate-comparison',e=>e.textContent),/offer-4/);
 // Recalculate through the real worker after controls have been restored from original inputs.
 await page.click('#rate-compare');await status('Complete offered comparison');assert.deepEqual(await plan(),original);
 checks.push('original authored low-rate input restored into visible controls; real worker selects affordable rate0.3 with positive margin and discloses training conditioning');
 const same=original.courses.find(c=>c.probe.rate===.01);
 for(const point of original.training.finiteBaseline.points){
  const limits=point.probe.rate<0?[-point.interval[1],-point.interval[0]]:point.interval;
  for(const group of same.forecasts)for(const band of group){assert(band.outer[0]>=limits[0]);assert(band.outer[1]<=limits[1]);}
 }
 for(const course of original.courses)for(let g=0;g<2;g++){
  assert.equal(course.forecasts[g].length,course.forecastBoxIndices[g].length);
  assert.equal(new Set([...course.forecastBoxIndices[g],...course.excludedForecastBoxIndices[g]]).size,original.groups[g].boxes.length);
 }
 checks.push('every same-rate forecast lies within all original normalized training screens; included and excluded box identities account for every retained box');
 await page.click('#rate-freeze');await status('Original full-state request frozen');
 const saved=await exported('rate-export');assert.equal(saved.observation,null);assert.equal(saved.request.protocol.probe.rate,.3);assert.equal(saved.result,undefined);assert.deepEqual(saved.request.study,request.study);
 const originalStudy=await exported('probe-export');assert.deepEqual(originalStudy,request.study);
 const forged=structuredClone(saved);forged.result={selected:'offer-6',status:'identified'};forged.request.forecast={selected:'offer-6'};
 await file(forged);await status('Original inputs replayed');assert.deepEqual(await plan(),original);assert.deepEqual(await exported('rate-export'),saved);assert.deepEqual(await exported('probe-export'),originalStudy);
 checks.push('new source-only request exports and forged-cache replay retain original study/full protocol and recompute the same selected course');
 await (await page.$('.saturation-rate-choice')).screenshot({path:path.join(out,'conditioning-desktop.png')});
 await page.setViewport({width:390,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.$eval('.saturation-rate-choice',e=>e.scrollIntoView());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.focus('#rate-add');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'rate-compare');assert(await page.$eval('#rate-compare',e=>getComputedStyle(e).outlineStyle!=='none'));
 await (await page.$('.saturation-rate-choice')).screenshot({path:path.join(out,'conditioning-narrow.png')});checks.push('conditioning explanation and seven offers remain usable at390px with visible keyboard focus');
 assert.deepEqual(errors,[]);
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const evidence={schema:'worldlaw.saturation-rate-conditioning-browser/v1',checks,errors,originalStudySha256:hash(originalStudy),requestInputSha256:hash(saved),selected:original.selected,margin:original.courses[4].margin,sameRateForecasts:same.forecasts,hardwareAction:false,priorAcquisitionReceiptModified:false};
 await writeFile(path.join(out,'receipt.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
