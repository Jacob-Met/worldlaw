#!/usr/bin/env node
/**
 * Reproduce the preregistered physical two-tank experiment on the real,
 * independently measured 2026 Dataset_v2.zip. Nothing is fetched, selected,
 * trained, or reported from synthetic samples by this CLI.
 *
 * Source: https://doi.org/10.5281/zenodo.23529910
 * Source code: https://github.com/pedropgg/TwoTank-Dataset-Code
 * Attribution: Gómez-González et al., Scientific Data 13:1465 (2026)
 * Dataset CC BY 4.0. Do not put the source archive or extracted CSV in git.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {
  partitionTwoTankRuns,trainSelectTwoTank,fitTwoTankCandidate,
  evaluateTwoTankModel,TWO_TANK_SCHEMA
} from '../src/science/two-tank-identification.mjs';

const PINNED_ZIP_MD5='3a70e0b3b9d14b4c0520110963c3d33e';
const SOURCE_REV='10.5281/zenodo.23529910';
const need=(ok,message)=>{if(!ok)throw Error('two-tank physical receiving: '+message);};
const hash=(b,algorithm='sha256')=>createHash(algorithm).update(b).digest('hex');

export function parseMeasuredCsv(bytes,id,group){
  const text=bytes.toString('utf8').replace(/^\uFEFF/,'');
  const lines=text.split(/\r?\n/).filter(s=>s.trim().length);
  need(lines.length>=7,'short source CSV '+id);
  // Published v2 fields are scalar unquoted numeric cells except Timestamp.
  // A quoted, embedded comma is explicitly rejected rather than shifted.
  const header=lines[0].split(',').map(s=>s.trim().replace(/^"|"$/g,''));
  const expected=['Time_s','Level_pct','Control_Signal_pct','Valve_Opening_pct','Sensor_Dropout'];
  for(const col of expected)need(header.includes(col),'missing version-2 '+col+' in '+id);
  need(header.length===new Set(header).size,'duplicate source CSV header '+id);
  const col=Object.fromEntries(expected.map(k=>[k,header.indexOf(k)]));
  const pi=header.indexOf('perturbation');
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const cells=lines[i].split(',');
    need(cells.length===header.length,'source CSV malformed column count at '+id+':'+(i+1));
    const num=k=>cells[col[k]].trim()===''?NaN:Number(cells[col[k]]);
    const time=num('Time_s');
    need(Number.isFinite(time),'missing time in '+id+' at line '+(i+1));
    const dropout=num('Sensor_Dropout');
    need(dropout===0||dropout===1,'missing/invalid dropout marker in '+id);
    const level=num('Level_pct'),pump=num('Control_Signal_pct'),valve=num('Valve_Opening_pct');
    const valid=dropout===0&&[level,pump,valve].every(x=>Number.isFinite(x)&&x>=0&&x<=100);
    rows.push({time,level,pump,valve,valid,perturbation:pi>=0&&cells[pi]?.trim()==='1'});
  }
  need(rows.length>=30000&&rows.length<=32000,'unexpected author run sample count '+id+':'+rows.length);
  return {id,group,sha256:hash(bytes),samples:rows,validCount:rows.filter(r=>r.valid).length};
}
export function readMeasuredSource(directory){
  const paths=[];
  function visit(dir,depth){
    need(depth<=5,'source path nested too deeply');
    for(const name of fs.readdirSync(dir)){
      const abs=path.join(dir,name),info=fs.lstatSync(abs);
      need(!info.isSymbolicLink(),'source symlink refused');
      if(info.isDirectory())visit(abs,depth+1);
      else if(/\.csv$/i.test(name))paths.push(abs);
    }
  }
  visit(directory,0);
  const runs=[],ids=new Set();
  for(const filename of paths.sort()){
    const basename=path.basename(filename),prefix=basename.split('_')[0];
    const normalized=prefix.toLowerCase();
    const group=normalized==='baseline'?'Baseline':
      normalized==='passiveoutflow'?'PassiveOutflow':
      normalized==='disturbance'?'Disturbance':null;
    // No unrelated CSV gets admitted as if it were one of the 25 original runs.
    need(group!==null,'unrecognized CSV in source '+filename);
    const id=group+'/'+basename;
    need(!ids.has(id),'duplicate source filename '+id);ids.add(id);
    const bytes=fs.readFileSync(filename);
    need(bytes.length<15000000,'abnormal individual measured source byte count');
    runs.push(parseMeasuredCsv(bytes,id,group));
  }
  need(runs.length===25,'expected 25 original physical experiment files, saw '+runs.length);
  return runs;
}
function prepareZip(archive){
  const bytes=fs.readFileSync(archive);
  need(bytes.length>1000000&&bytes.length<55000000,'abnormal v2 source archive size');
  const md5=hash(bytes,'md5');
  need(md5===PINNED_ZIP_MD5,'real source checksum mismatch; v2 ZIP required, got '+md5);
  const names=spawnSync('unzip',['-Z1',archive],{encoding:'utf8',maxBuffer:2e6});
  need(names.status===0,'unzip listing unavailable');
  const entries=names.stdout.trim().split('\n');
  need(entries.length<150&&entries.every(s=>s&&!(s.startsWith('/')||s.includes('..')||s.includes('\\'))),'unsafe source archive entry');
  const tmpBase=process.env.TMPDIR||'/workspace/tmp';
  fs.mkdirSync(tmpBase,{recursive:true});
  const temp=fs.mkdtempSync(path.join(tmpBase,'worldlaw-measured-tank-'));
  const out=spawnSync('unzip',['-q',archive,'-d',temp],{encoding:'utf8',maxBuffer:2e6});
  if(out.status!==0){fs.rmSync(temp,{recursive:true,force:true});throw Error('source extraction failed '+out.stderr);}
  return {temp,archive:{sha256:hash(bytes),md5,bytes:bytes.length}};
}
const makePersistence=()=>({schema:TWO_TANK_SCHEMA,type:'ar2',coefficients:[0,1,0,0],
  spec:{type:'persistence',ridge:0,threshold:0},trainCount:0,trainingOnly:true});
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const nanSafe=x=>typeof x==='number'&&Number.isFinite(x);
export function assessGate(results){
  const base=results.ar2?.macro[120],candidate=results.hydraulic?.macro[120],
    paired=results.hydraulic?.byRun.map((r,i)=>{
      const other=results.ar2.byRun[i];
      return {id:r.id,ratio:other?.horizons[120].rmse>0?r.horizons[120].rmse/other.horizons[120].rmse:null};
    })??[];
  const good=paired.every(x=>nanSafe(x.ratio)&&x.ratio<=2);
  return {metric:'measured-run macro 120s open-loop level % RMSE',
    baseline:base,hydraulic:candidate,relativeImprovement:
      nanSafe(base)&&base>0&&nanSafe(candidate)?1-candidate/base:null,
    worstRunRatio:paired.reduce((v,x)=>Math.max(v,x.ratio??Infinity),0),
    accepted:good&&nanSafe(base)&&nanSafe(candidate)&&candidate<=0.9*base,
    limitations:'Physical form and actual logged future controls do not identify a causal plant or validate proposed new interventions.'};
}
export function runPhysicalStudy(original,{archive=null}={}){
  const start=performance.now(),runs=partitionTwoTankRuns(original);
  const split=runs.assignment;
  const fitted=trainSelectTwoTank(runs.train,runs.development);
  const models={persistence:makePersistence(),...fitted.selected};
  const results={};
  // Model selection is finished before the first heldout observation enters
  // the evaluator, which cannot fit or mutate model coefficients.
  const frozen=hash(Buffer.from(JSON.stringify(fitted.selected)));
  for(const [type,model]of Object.entries(models))
    results[type]=evaluateTwoTankModel(model,runs.test);
  need(hash(Buffer.from(JSON.stringify(fitted.selected)))===frozen,'heldout touched frozen model coefficients');
  const controls={
    arxShiftedControls97:evaluateTwoTankModel(models.arx,runs.test,{shiftControls:97}).macro,
    hydraulicShiftedControls97:evaluateTwoTankModel(models.hydraulic,runs.test,{shiftControls:97}).macro,
    hydraulicZeroValve:evaluateTwoTankModel(models.hydraulic,runs.test,{zeroValve:true}).macro,
    shuffledTrainingLabelsArx:evaluateTwoTankModel(fitTwoTankCandidate(runs.train,
      models.arx.spec,{targetShuffle:true}),runs.test).macro
  };
  const verdict=assessGate(results);
  const peak=process.memoryUsage();
  return {schema:'worldlaw.measured-two-tank-study/v1',
    source:{doi:SOURCE_REV,articleDoi:'10.1038/s41597-026-07686-2',datasetLicense:'CC BY 4.0',
      authorRepository:'pedropgg/TwoTank-Dataset-Code',archive,
      originalFiles:original.map(({id,sha256,samples,validCount})=>({id,sha256,
        rows:samples.length,validRows:validCount??samples.filter(x=>x.valid).length}))},
    preregistration:{task:'t-mwn55jc2ouav',threadPost:155623,
      trainTestMethod:'complete original run files, deterministic sorted-group split',
      sealedEntireTestGroup:'Disturbance',selection:'development 120s macro only',
      features:['past level','past command','past valve opening'],
      forbiddenFeatures:['online RLS a1/a2/b1','PID gains','setpoint','error','future level']},
    split,modelSelection:{frozenSha256:frozen,development:fitted.development},
    models:Object.fromEntries(Object.entries(models).map(([k,v])=>[k,{...v}])),
    heldout:results,controls,physicalGate:verdict,
    runtime:{node:process.version,wallSeconds:(performance.now()-start)/1000,
      memoryRssBytes:peak.rss,heapUsedBytes:peak.heapUsed},
    qualification:'Measured hardware observations; controls are closed-loop real commands. No independently randomized interventions, no absolute physical parameter identification, no causal claim. Test is immutable after selection.'};
}
async function main(){
  const archive=process.argv[2],out=process.argv[3];
  need(archive&&out,'usage: node experiments/two-tank-measured.mjs Dataset_v2.zip output.json');
  const input=path.resolve(archive);
  need(fs.existsSync(input)&&fs.statSync(input).isFile(),'source zip must exist');
  const staged=prepareZip(input);
  try{
    const source=readMeasuredSource(staged.temp);
    const result=runPhysicalStudy(source,{archive:staged.archive});
    fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
    const bytes=JSON.stringify(result,null,2)+'\n';
    fs.writeFileSync(out,bytes);
    console.log(JSON.stringify({source:SOURCE_REV,sourceMd5:staged.archive.md5,
      output:path.resolve(out),reportSha256:hash(Buffer.from(bytes)),counts:result.split,
      gate:result.physicalGate,
      selected:result.modelSelection.development.map(x=>({type:x.type,spec:x.selectedSpec,dev120:x.devMacro[120]})),
      heldout:Object.fromEntries(Object.entries(result.heldout).map(([type,r])=>[type,r.macro])),
      controls:result.controls,wallSeconds:result.runtime.wallSeconds},null,2));
  }finally{fs.rmSync(staged.temp,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
  main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
}
