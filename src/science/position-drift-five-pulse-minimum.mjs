/** Unrestricted four-pulse threshold and a separately exhibited five-pulse physical decision tree. */
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {rateWorkBudget,RATE_WORK_EXHAUSTED} from './position-drift-rate-polytopes.mjs';
import {THREE_HULL_SOURCE,prepareThreePulseHullRequest} from './position-drift-three-pulse-hulls.mjs';
import {parsePulseTree,buildPhysicalTreeProof,checkPhysicalTreeProof,receivePhysicalTree} from './persistent-feedback-tree.mjs';
import {projectedFourPulseMenu} from './position-drift-four-pulse-projection.mjs';
import {checkFourPulseMenuProof} from './position-drift-four-pulse-radius.mjs';

const need=(ok,msg)=>{if(!ok)throw Error('Five-pulse certificate: '+msg);};
export const FIVE_PULSE_SOURCE='worldlaw.position-drift-five-pulse-experiment/v1';
const schema='worldlaw.position-drift-five-pulse-minimum-proof/v1';

function prepare(request){
  need(request?.schema===FIVE_PULSE_SOURCE&&Object.keys(request).sort().join(',')==='catalog,program,schema','supply a convex rate catalog and a five-pulse tree');
  const {cat,canonical}=prepareThreePulseHullRequest({schema:THREE_HULL_SOURCE,catalog:request.catalog,fourPulseControl:null});
  const {leaves,program}=parsePulseTree(request.program,cat,5);
  return {cat,leaves,source:{schema:FIVE_PULSE_SOURCE,catalog:canonical,program}};
}
function fullMenu(cat){return cat.commands.map((_,third)=>({third,last:cat.commands.map((_,i)=>i)}));}
function verdict(error,four,five){
  if(compare(error,four)<0)return 'within-four';
  return compare(error,five)<0?'minimum-five':'four-refuted-exhibited-five-refuted';
}
export function certifyFivePulseMinimum(request){
  const {cat,source,leaves}=prepare(request),work=rateWorkBudget(source.catalog.limits.designWork),base={schema,source};
  try{
    const menu=fullMenu(cat),four=[];let best=null;
    for(let p=0;p<cat.commands.length;p++)for(let a=0;a<cat.commands.length;a++){
      const raw=projectedFourPulseMenu(cat,[p,a],menu,work.spend);
      const course={prefix:[cat.commands[p],cat.commands[a]],radius:raw.radius,kept:raw.kept,lower:raw.lower,boundary:raw.boundary};
      four.push(course);if(!best||compare(rational(course.radius),rational(best.radius))>0)best=course;
    }
    const five=buildPhysicalTreeProof(cat,leaves,work.spend),decision=verdict(cat.error,rational(best.radius),rational(five.radius));
    return {...base,status:'horizons-certified',four:{radius:best.radius,bestPrefix:best.prefix.slice(),courses:four},five,
      atRequestedNoise:decision,minimumPulses:decision==='minimum-five'?'5':null,work:work.used};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {...base,status:'design-budget-exhausted',work:work.used};}
}
export function verifyFivePulseMinimum(request,saved){
  const {cat,source,leaves}=prepare(request),work=rateWorkBudget(source.catalog.limits.designWork);
  need(saved?.schema===schema&&equalPositionDriftData(saved.source,source),'source differs');
  if(saved.status==='design-budget-exhausted'){
    need(equalPositionDriftData(certifyFivePulseMinimum(request),saved),'unreproducible exhaustion');return true;
  }
  const m=cat.commands.length,menu=fullMenu(cat);
  need(saved.status==='horizons-certified'&&Number.isSafeInteger(saved.work)&&saved.work>=0&&saved.work<=source.catalog.limits.designWork&&
    saved.four.courses.length===m*m,'incomplete unrestricted four-pulse search');
  try{
    let index=0,best=null;
    for(let p=0;p<m;p++)for(let a=0;a<m;a++){
      const course=saved.four.courses[index++],prefix=[cat.commands[p],cat.commands[a]];
      need(equalPositionDriftData(course.prefix,prefix)&&Array.isArray(course.kept)&&course.kept.length>=1&&course.kept.length<=4&&
        course.kept.every((j,i)=>Number.isSafeInteger(j)&&j>=0&&j<m*m&&(!i||j>course.kept[i-1]))&&course.lower.length<=8,'invalid four-pulse prefix support');
      const lower=course.lower.map(term=>{
        need(Number.isSafeInteger(term.leaf)&&term.leaf>=0&&term.leaf<course.kept.length,'unknown retained leaf');
        return {...term,leaf:course.kept[term.leaf]};
      });
      const {observations,worlds}=course.boundary;
      checkFourPulseMenuProof(cat,[p,a],menu,{prefix,radius:course.radius,lower,observations,worlds},work.spend);
      if(!best||compare(rational(course.radius),rational(best.radius))>0)best=course;
    }
    need(saved.four.radius===best.radius&&equalPositionDriftData(saved.four.bestPrefix,best.prefix),'global four-pulse optimum differs');
    checkPhysicalTreeProof(cat,leaves,saved.five,work.spend);
    const decision=verdict(cat.error,rational(best.radius),rational(saved.five.radius));
    need(saved.atRequestedNoise===decision&&saved.minimumPulses===(decision==='minimum-five'?'5':null),'incorrect minimum-horizon verdict');
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;throw Error('Five-pulse replay exceeded the supplied design budget');}
  return true;
}

export function receiveFivePulseMinimum(request,saved,values){
  verifyFivePulseMinimum(request,saved);
  const {cat,source,leaves}=prepare(request);
  need(saved.status==='horizons-certified','the exhibited tree has no guaranteed separation at this bound');
  return receivePhysicalTree(cat,leaves,saved.five.radius,source.catalog.limits.receiverWork,values);
}
