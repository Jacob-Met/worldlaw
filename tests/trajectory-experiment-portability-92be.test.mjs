import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createProductServer} from '../server.mjs';
import {createChallenge} from '../src/trajectory/session.mjs';
import {createExperimentSession,planNextExperiment,acquireNextExperiment,applyNextExperiment,
  exportExperimentSession,restoreExperimentSession} from '../src/trajectory/experiment-session.mjs';
import {acquireVirtualPendulum} from '../src/trajectory/virtual-experiment.mjs';

// Actual Chromium 131.0.6778.204 acquisition, captured 2026-10-19 using the
// real app modules and seed 91234. This is a runtime interoperability fixture,
// not a physical measurement or additional independent scientific evidence.
// Original complete notebook SHA-256: 6d278141169093213ff2da00e7d204477c34dfd1b99c16444fefe7a2d508e586
// Its 201 observations are retained verbatim below. In Node 24.19.0, 13 differed
// from local regeneration; the largest discrepancy was 1.6653345369377348e-16 rad.
const capturedChromePositions=[-2.2,-2.2221145378645746,-2.2404373537519606,-2.2551532117164172,-2.2662700380671197,-2.273926483395414,-2.2781018419687813,-2.278977681429004,-2.2765083709483847,-2.2707024253324644,-2.2616442365367444,-2.2493416733666223,-2.2337569058914126,-2.2149001070163887,-2.192755439491981,-2.167322885812195,-2.1386258315055513,-2.106501564616704,-2.0710962737456944,-2.032230750131025,-1.9898799410963062,-1.9441066259518103,-1.8947320691420813,-1.8418218650179954,-1.785354107522115,-1.7252909762091044,-1.6616360759971747,-1.594338847022572,-1.5234449332325988,-1.4491233667855552,-1.3712929810997483,-1.2901297301551498,-1.2056999196007894,-1.1182135665615507,-1.027864222247131,-0.9348224690112126,-0.839412665994529,-0.7418962788297033,-0.6425062064792514,-0.5417824688789381,-0.4399085907182851,-0.33749931235269676,-0.23477393272473132,-0.13230093338271703,-0.030420131821267748,0.0702872233439718,0.16958328672541068,0.26683393271686007,0.3619096422025168,0.4542185478128218,0.5435198207591819,0.6295514026907325,0.7119304822352083,0.7904661162080437,0.864955323357326,0.9353027043367698,1.0012186088361692,1.0627199937243017,1.1196220527475378,1.1718770774620184,1.2195407263693752,1.2625345615406107,1.3008019091260956,1.33443135224782,1.363416800207217,1.3877679485288013,1.4075379390686646,1.4227323335980138,1.4334932367927358,1.4397013435826502,1.4415445004297494,1.4390066065238165,1.4321313229680173,1.4210673379265641,1.405792362074115,1.3863887910814323,1.3629262216746247,1.335448271112864,1.3040197245815017,1.268865246151671,1.229807895997053,1.1871431181028917,1.1409750185342775,1.091351473466748,1.0384120196648228,0.982377598134077,0.9233518400768028,0.8615630042558452,0.7971964832124477,0.7304606833782326,0.6615858410102542,0.5908916415675532,0.5185783776554179,0.44495098531133265,0.37035188679282144,0.2950753817845905,0.2193536104536276,0.14361944934662396,0.06818661564002729,-0.0066329985754739525,-0.08063251521768237,-0.15325041039737086,-0.22441492913632252,-0.2937701756927958,-0.36103493855302277,-0.4258966013327091,-0.48826513640777003,-0.5477973027405219,-0.6043276285710729,-0.6576666298903945,-0.7077825256137408,-0.7543826725253386,-0.7974757802250414,-0.8369154194570074,-0.8726509532523038,-0.9045979470358156,-0.9327192016280031,-0.9570134761140722,-0.9774564987111848,-0.9939826665699993,-1.0066172641822533,-1.01549824759353,-1.020515918807859,-1.0217377076669505,-1.0192272204539274,-1.0130066494504766,-1.0031795701113564,-0.989746411426855,-0.9728246664095417,-0.9524925286485855,-0.9288667838075634,-0.9020291827191828,-0.8720074373417018,-0.8390296933952036,-0.8032316253459998,-0.7646736267923845,-0.7236116005205151,-0.6800996455954479,-0.6343307474476982,-0.5865571835905601,-0.5369276422409907,-0.48562559279338813,-0.432956028581317,-0.37900841828028053,-0.32413227263338895,-0.2684807304806903,-0.21237500369571227,-0.15599153656575412,-0.09958426665252003,-0.04344899171895418,0.012170288361343711,0.06713849022115027,0.12115453847829558,0.17397106477153287,0.2253785942044348,0.2752498995569868,0.3233257488205485,0.3694270428547067,0.41335467774223356,0.45510635918989406,0.494395713599305,0.5310898133466413,0.5651693315623507,0.5964848491051006,0.6249694742665468,0.6506049462729974,0.6732686833946568,0.6929374595418695,0.709559443381731,0.7231258911699026,0.7336269575313431,0.7411168155427881,0.7455708904383453,0.7469971354654255,0.7454127363395512,0.7408639221469699,0.733448453159902,0.7232340764704965,0.7101635480621752,0.6944302602076289,0.6761017969454151,0.6552209780512769,0.6319489800783292,0.6064138083743881,0.5785805671371906,0.5488437903979204,0.5170806995538704,0.48356210479992723,0.44837249705771276,0.41173406186717265,0.3738113213046659,0.3347166193981938,0.29467099004671654,0.2538012341522124,0.21231539416478235,0.17045301896783857,0.12830113508188382,0.08610464953093643,0.044072526173744866,0.002278822835026786,-0.03898924798958391];
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json',import.meta.url)));
const pending=(bundle=fixture(),options={seed:91234})=>acquireNextExperiment(
  planNextExperiment(createExperimentSession(createChallenge(bundle))),options);
const capturedRecipe=()=>{
  const raw=JSON.parse(exportExperimentSession(pending()));
  assert.equal(raw.experiment.pending.run.id,'virtual-pendulum-933ba46215b4c32e');
  assert.equal(raw.experiment.pending.run.samples.length,capturedChromePositions.length);
  raw.experiment.pending.run.samples.forEach((row,i)=>{row.position=capturedChromePositions[i];});
  return raw;
};
const positions=run=>run.samples.map(row=>row.position);
const refusal=fn=>assert.throws(fn,error=>error.code==='invalid_history');

test('actual captured Chrome131 positions reopen, apply and reopen again without replacing observations',()=>{
  const reopened=restoreExperimentSession(JSON.stringify(capturedRecipe()));
  assert.deepEqual(positions(reopened.acquisition.run),capturedChromePositions);
  const applied=applyNextExperiment(reopened);
  assert.deepEqual(positions(applied.current.bundle.trainingRuns.at(-1)),capturedChromePositions);
  const twice=restoreExperimentSession(exportExperimentSession(applied));
  assert.deepEqual(positions(twice.current.bundle.trainingRuns.at(-1)),capturedChromePositions);
  assert.equal(twice.current.discovery.selected.id,'rate+gravity');
  assert.ok(twice.current.summary.selectedPositionRMSE<.001);
});

test('runtime allowance does not accept materially changed positions, timestamps or provenance',()=>{
  const original=capturedRecipe();
  for(const change of [
    raw=>{raw.experiment.pending.run.samples[71].position+=1e-7;},
    raw=>{raw.experiment.pending.run.samples[71].time+=1e-12;},
    raw=>{raw.experiment.pending.run.source.recordingId+='changed';},
    raw=>{raw.experiment.pending.request.seed++;},
  ]){const raw=structuredClone(original);change(raw);refusal(()=>restoreExperimentSession(JSON.stringify(raw)));}
});

test('same-runtime pending and applied evidence remain exact on notebook replay',()=>{
  const original=pending(),restored=restoreExperimentSession(exportExperimentSession(original));
  assert.deepEqual(restored.acquisition.run,original.acquisition.run);
  const applied=applyNextExperiment(restored),twice=restoreExperimentSession(exportExperimentSession(applied));
  assert.deepEqual(twice.current.bundle,applied.current.bundle);
  assert.deepEqual(twice.comparison,applied.comparison);
});

function highNoisePending(){
  const bundle=fixture(),runs=[];
  for(const request of [
    {initialPosition:.06,initialRate:0,duration:6.4,seed:50021},
    {initialPosition:-.045,initialRate:.025,duration:6.4,seed:50022},
    {initialPosition:1.9,initialRate:0,duration:8,seed:50023},
  ])runs.push(acquireVirtualPendulum({...request,sampleInterval:.04,noiseSigma:.01},{existingRuns:runs}));
  bundle.trainingRuns=runs.slice(0,2);bundle.challengeRuns=runs.slice(2);
  return pending(bundle,{seed:50024,noiseSigma:.01});
}

// Optional real-engine receiving. Ordinary component runs need no browser package.
// Enable with PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs and, if needed,
// BROWSER_EXECUTABLE_PATH=/absolute/chrome. No app code or output is mocked.
test('live Node and Chromium exchange pending and applied notebooks through actual modules',
  {skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
    const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
    const server=createProductServer();
    await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
    let browser;
    const receipt={node:process.version,checks:[],inputSHA256:{}};
    const sha=text=>createHash('sha256').update(text).digest('hex');
    try{
      browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
      receipt.browser=await browser.version();
      const page=await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/health`);
      const browserText=await page.evaluate(async bundle=>{
        const {createChallenge}=await import('/src/trajectory/session.mjs');
        const {createExperimentSession,planNextExperiment,acquireNextExperiment,exportExperimentSession}=await import('/src/trajectory/experiment-session.mjs');
        return exportExperimentSession(acquireNextExperiment(planNextExperiment(createExperimentSession(createChallenge(bundle))),{seed:91234}));
      },fixture());
      const imported=restoreExperimentSession(browserText);
      const browserRaw=JSON.parse(browserText);
      assert.deepEqual(imported.acquisition.run.samples,browserRaw.experiment.pending.run.samples);
      receipt.inputSHA256.browserPending=sha(browserText);receipt.checks.push('Chromium pending to Node preserves all recorded samples');
      const nodeAppliedText=exportExperimentSession(applyNextExperiment(imported));
      const browserReopened=await page.evaluate(async text=>{
        const {restoreExperimentSession,exportExperimentSession}=await import('/src/trajectory/experiment-session.mjs');
        return exportExperimentSession(restoreExperimentSession(text));
      },nodeAppliedText);
      assert.deepEqual(JSON.parse(browserReopened).bundle,JSON.parse(nodeAppliedText).bundle);
      receipt.checks.push('Node applied history returns to Chromium with identical evidence');
      const noisyText=exportExperimentSession(highNoisePending());
      receipt.inputSHA256.nodeHighNoisePending=sha(noisyText);
      const noisyResult=await page.evaluate(async text=>{
        const {restoreExperimentSession,applyNextExperiment,exportExperimentSession}=await import('/src/trajectory/experiment-session.mjs');
        const pending=restoreExperimentSession(text),saved=pending.acquisition.run.samples;
        const applied=applyNextExperiment(pending);
        const reopened=restoreExperimentSession(exportExperimentSession(applied));
        return {saved,applied:applied.current.bundle.trainingRuns.at(-1).samples,
          reopened:reopened.current.bundle.trainingRuns.at(-1).samples,
          selected:applied.current.discovery.selected.id,after:applied.comparison.after.status,
          error:applied.comparison.after.error?.code};
      },noisyText);
      const noisySamples=JSON.parse(noisyText).experiment.pending.run.samples;
      assert.deepEqual(noisyResult.saved,noisySamples);assert.deepEqual(noisyResult.applied,noisySamples);
      assert.deepEqual(noisyResult.reopened,noisySamples);assert.equal(noisyResult.after,'failed');
      assert.equal(noisyResult.error,'runaway_state');
      receipt.checks.push('Node high-noise pending to Chromium preserves samples and retains the failed refit');
      receipt.highNoiseAfter=noisyResult.after;receipt.highNoiseError=noisyResult.error;
      if(process.env.PORTABILITY_ARTIFACT_DIR){
        const dir=resolve(process.env.PORTABILITY_ARTIFACT_DIR);await mkdir(dir,{recursive:true});
        await writeFile(resolve(dir,'browser-pending.json'),browserText);
        await writeFile(resolve(dir,'node-applied.json'),nodeAppliedText);
        await writeFile(resolve(dir,'node-high-noise-pending.json'),noisyText);
        receipt.sources=Object.fromEntries(['src/trajectory/experiment-session.mjs','src/trajectory/virtual-experiment.mjs','src/trajectory/planner.mjs','tests/trajectory-experiment-portability-92be.test.mjs'].map(file=>[file,sha(readFileSync(new URL('../'+file,import.meta.url)))]));
        await writeFile(resolve(dir,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
      }
    }finally{if(browser)await browser.close();await new Promise(done=>server.close(done));}
  });
