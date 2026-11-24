/** Synthetic acquisition layer. It exposes noisy states and known commanded
 * inputs to the estimator and keeps law labels in this scorer only. */
import {writeFileSync,renameSync,mkdirSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {laws,layoutFor,rollout} from '../src/trajectory/field-law-dictionary.mjs';
import {activeDesign,identify} from '../src/trajectory/noisy-field-intervention.mjs';

import {rng,initial,outsider,observe,scrambled} from './noisy-field-acquisition.mjs';

function single(id,world,db,index) {
  const {seed,coefficients}=world,layout=layoutFor(id),outside=!laws[layout].includes(id);
  const start=initial(layout,seed),verifyStart=initial(layout,seed+982451653);
  const seedBase=seed+10163*index+421*db;
  const acquire=(st,drive,noise)=>{
    const truth=outside?outsider(id,st,drive,coefficients):rollout(id,coefficients,st,drive);
    if(!truth) throw Error('unstable truth for '+JSON.stringify({id,seed,db,drive}));
    return observe(truth,layout,drive,db,noise);
  };
  const pilot=acquire(start,-1,seedBase+1),verify=acquire(verifyStart,2,seedBase+3);
  const plan=activeDesign(pilot),random=Math.floor(rng(seedBase+47)()*8);
  const arms={};
  for(const [name,drive,method] of [['active-weak',plan.drive,'weak'],['random-weak',random,'weak'],['passive-sindy',-1,'sindy']]) {
    const response=acquire(start,drive,seedBase+2);
    const found=identify([pilot,response],verify,method);
    const sham=identify([scrambled(pilot,seedBase+5),scrambled(response,seedBase+7)],
      scrambled(verify,seedBase+11),method);
    arms[name]={drive,fit:found,sham,correct:!outside&&found.admitted&&found.law===id,
      wrong:found.admitted&&(outside||found.law!==id)};
  }
  return {id,seed,db,outside,plan,arms};
}

const registrationURL=new URL('../experiments/noisy-field-interventions/protocol.json',import.meta.url);
const raw=readFileSync(registrationURL);
const p=JSON.parse(raw);
const output=process.argv[2];
if(!output) throw Error('usage: node scripts/noisy-field-course.mjs NEW_REPORT.json');
const report={schema:p.format,protocol_sha256:createHash('sha256').update(raw).digest('hex'),node:process.version,rows:[],status:'running'};
mkdirSync(dirname(output),{recursive:true});
function save() {writeFileSync(output+'.pending',JSON.stringify(report)+'\n');renameSync(output+'.pending',output);}
try {
  for(const [index,id] of [...p.worlds,...p.ood].entries()) {
    for(const world of p.outer_worlds) for(const db of p.snr_db) {
      report.rows.push(single(id,world,db,index));
    }
    save();
  }
  const valid=report.rows.filter(x=>!x.outside),ood=report.rows.filter(x=>x.outside);
  if(valid.length!==132||ood.length!==12) throw Error('incomplete denominator');
  report.scores=Object.fromEntries(p.arms.map(name=>[name,{
    correct:valid.filter(x=>x.arms[name].correct).length,wrong:valid.filter(x=>x.arms[name].wrong).length,
    abstain:valid.filter(x=>!x.arms[name].fit.admitted).length,
    sham_admissions:report.rows.filter(x=>x.arms[name].sham.admitted).length,
    ood_admissions:ood.filter(x=>x.arms[name].fit.admitted).length,
  }]));
  const a=report.scores['active-weak'];
  report.admitted=a.correct>report.scores['random-weak'].correct&&a.correct>report.scores['passive-sindy'].correct
    &&a.sham_admissions===0&&a.ood_admissions===0;
  report.status='complete';save();console.log(JSON.stringify(report.scores));
} catch(e) {report.status='failed';report.error=String(e);save();throw e;}
