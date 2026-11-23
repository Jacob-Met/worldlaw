/** Physical zero-noise obstructions for both one-feedback four-pulse classes. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {rateWorkBudget,RATE_WORK_EXHAUSTED,mixRateRows} from './position-drift-rate-polytopes.mjs';
import {prepareThreePulseHullRequest} from './position-drift-three-pulse-hulls.mjs';
import {fourPulseCourseTree,buildFourPulseMenuProof,checkFourPulseMenuProof,receiveFourPulseMenu} from './position-drift-four-pulse-radius.mjs';
const {Q,Z,add,sub,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const need=(ok,msg)=>{if(!ok)throw Error('Four-pulse feedback witness: '+msg);};
export const FOUR_PULSE_FEEDBACK_SOURCE='worldlaw.position-drift-four-pulse-feedback-witness/v1';
const schema='worldlaw.position-drift-four-pulse-feedback-proof/v1';

function prepare(request){
  need(request?.schema===FOUR_PULSE_FEEDBACK_SOURCE&&Object.keys(request).sort().join(',')==='branches,denominator,experiment,prefix,schema',
    'supply a binary experiment, a two-command prefix, continuation menu and grid denominator');
  const {cat,canonical,control}=prepareThreePulseHullRequest(request.experiment);
  const index=name=>{const i=cat.commands.indexOf(name);need(i>=0,'unknown command');return i;};
  need(Array.isArray(request.prefix)&&request.prefix.length===2&&Array.isArray(request.branches)&&request.branches.length>0&&
    Number.isSafeInteger(request.denominator)&&request.denominator>0,'malformed prefix, menu or denominator');
  const prefix=request.prefix.map(index),menu=request.branches.map(b=>{
    need(b&&Object.keys(b).sort().join(',')==='last,third'&&Array.isArray(b.last)&&b.last.length&&new Set(b.last).size===b.last.length,
      'supply distinct last commands for each third command');
    return {third:index(b.third),last:b.last.map(index)};
  });
  need(new Set(menu.map(b=>b.third)).size===menu.length,'repeated third command');
  const source={schema:request.schema,experiment:{schema:request.experiment.schema,catalog:canonical,fourPulseControl:control?.slice()??null},
    prefix:request.prefix.slice(),branches:request.branches.map(b=>({third:b.third,last:b.last.slice()})),denominator:request.denominator};
  return {cat,source,prefix,menu};
}
function mixtureGrid(vertices,denominator,spend){
  const rates=[],weights=[];
  function visit(left){
    spend();
    if(weights.length===vertices.length-1){
      const mass=[...weights,left].map(n=>Q(BigInt(n),BigInt(denominator)));
      rates.push(mixRateRows(vertices,mass));return;
    }
    for(let n=0;n<=left;n++){weights.push(n);visit(left-n);weights.pop();}
  }
  visit(denominator);return rates;
}
function trace(row,word){
  let displacement=Z();return word.slice(1).map(c=>fmt(displacement=add(displacement,sub(row[c],row[word[0]]))));
}
// Fix initial readings 0,0 using start=0 and drift=-rate[first command].
// The grid supplies physical examples only. Missing a grid point proves nothing.
function collisions(grid,word,spend){
  const second=new Map(),shared=[];
  grid[1].forEach((row,i)=>{spend();second.set(trace(row,word).join(','),i);});
  grid[0].forEach((row,i)=>{
    spend();const readings=trace(row,word),j=second.get(readings.join(','));
    if(j!==undefined)shared.push({readings,pair:[i,j]});
  });
  return shared;
}
function gridCourse(cat,prefix,mode,lookup,spend){
  const tree=fourPulseCourseTree(cat,prefix,mode,spend),candidates=tree.leaves.map(l=>lookup(l.word));
  const count=mode==='late'?2:1;
  for(const ancestor of candidates[0]){
    spend();const values=Array(tree.width),worlds=[];let valid=true;
    for(const [i,leaf] of tree.leaves.entries()){
      const match=candidates[i].find(v=>{spend();return v.readings.slice(0,count).every((x,j)=>x===ancestor.readings[j]);});
      if(!match){valid=false;break;}
      leaf.coordinates.forEach((j,t)=>values[j]=match.readings[t]);worlds.push(match.pair);
    }
    if(valid)return {prefix:prefix.map(j=>cat.commands[j]),observations:values,worlds};
  }
  return null;
}
export function certifyFourPulseFeedback(request){
  const {cat,source,prefix,menu}=prepare(request),work=rateWorkBudget(source.experiment.catalog.limits.designWork);
  const base={schema,source};
  try{
    const menuProof=buildFourPulseMenuProof(cat,prefix,menu,work.spend);
    const grid=cat.vertices.map(v=>mixtureGrid(v,source.denominator,work.spend));
    const early=[],late=[],missing=[];
    for(let p=0;p<cat.commands.length;p++)for(let a=0;a<cat.commands.length;a++){
      const cache=new Map(),lookup=word=>{
        const key=word.join(',');if(!cache.has(key))cache.set(key,collisions(grid,word,work.spend));return cache.get(key);
      };
      const save=(px,mode,records)=>{
        const course=gridCourse(cat,px,mode,lookup,work.spend);
        if(course)records.push(course);else missing.push({mode,prefix:px.map(i=>cat.commands[i])});
      };
      save([p,a],'early',early);
      cat.commands.forEach((_,b)=>save([p,a,b],'late',late));
    }
    if(missing.length)return {...base,status:'grid-inconclusive',menuProof,missing,work:work.used};
    return {...base,status:'one-cut-refuted',menuProof,early,late,work:work.used};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {...base,status:'design-budget-exhausted',work:work.used};}
}
export function verifyFourPulseFeedback(request,saved){
  const {cat,source,prefix,menu}=prepare(request),work=rateWorkBudget(source.experiment.catalog.limits.designWork);
  need(saved?.schema===schema&&equalPositionDriftData(saved.source,source),'source differs');
  if(['grid-inconclusive','design-budget-exhausted'].includes(saved.status)){
    need(equalPositionDriftData(certifyFourPulseFeedback(request),saved),'unreproducible inconclusive result');return true;
  }
  const m=cat.commands.length;
  need(saved.status==='one-cut-refuted'&&Number.isSafeInteger(saved.work)&&saved.work>=0&&saved.work<=source.experiment.catalog.limits.designWork&&
    saved.early.length===m*m&&saved.late.length===m*m*m,'incomplete one-cut classes');
  try{
    checkFourPulseMenuProof(cat,prefix,menu,saved.menuProof,work.spend);
    const grid=cat.vertices.map(v=>mixtureGrid(v,source.denominator,work.spend));
    function check(px,mode,course){
      const tree=fourPulseCourseTree(cat,px,mode,work.spend);
      need(equalPositionDriftData(course.prefix,px.map(i=>cat.commands[i]))&&course.observations.length===tree.width&&
        course.worlds.length===tree.leaves.length,'invalid course coverage');
      tree.leaves.forEach(({word,coordinates},i)=>{
        const pair=course.worlds[i];need(Array.isArray(pair)&&pair.length===2,'invalid pair of physical mixtures');
        pair.forEach((member,law)=>{
          work.spend();need(Number.isSafeInteger(member)&&member>=0&&member<grid[law].length,'invalid mixture index');
          const clean=trace(grid[law][member],word);
          need(coordinates.every((j,t)=>clean[t]===course.observations[j]),'physical trajectory misses a shared ancestor or terminal reading');
        });
      });
    }
    for(let p=0;p<m;p++)for(let a=0;a<m;a++){
      const i=p*m+a;check([p,a],'early',saved.early[i]);
      for(let b=0;b<m;b++)check([p,a,b],'late',saved.late[i*m+b]);
    }
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;throw Error('Four-pulse feedback replay exceeded the source budget');}
  return true;
}

export function receiveFourPulseFeedback(request,saved,values){
  verifyFourPulseFeedback(request,saved);
  const {cat,source,prefix,menu}=prepare(request),work=rateWorkBudget(source.experiment.catalog.limits.receiverWork);
  need(saved.status==='one-cut-refuted'&&compare(cat.error,rational(saved.menuProof.radius))<0,'the supplied menu has no guarantee at this noise');
  need(Array.isArray(values),'supply a consecutive sequence of exact positions');
  try{return {...receiveFourPulseMenu(cat,prefix,menu,values,work.spend),work:work.used};}
  catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {status:'receiver-budget-exhausted',surviving:null,nextCommand:null,work:work.used};}
}
