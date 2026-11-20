/**
 * Finite prospective sparse excitation synthesis under independently unknown
 * initial states. No outcomes, actuators or physical measurements are read.
 *
 * Distinct from a handwritten intervention menu: the complete proposed
 * actuation search is generated from the user-declared time/channel grid and
 * exact nonzero rational amplitudes. A precompiled necessary observable-mask
 * for each elementary input discards provably unidentifiable pulse supports,
 * before the more expensive exact dual-witness measurement search.
 *
 * This is sparse, finite-alphabet open-loop course synthesis, NOT universal
 * optimal control, adversarial robust-optimal LP, closed-loop control or
 * real-world actuator calibration.
 */
import {
  designActiveLinearFamily,
  ACTIVE_LINEAR_FAMILY_SCHEMA,
} from './active-linear-family.mjs';

export const ACTIVE_SPARSE_SYNTHESIS_SCHEMA='worldlaw.active-sparse-excitation/v1';
const fail=msg=>{throw Error('Sparse excitation synthesis: '+msg);};
const guard=(condition,msg)=>{if(!condition)fail(msg);};
const abs=n=>n<0n?-n:n;
function gcd(a,b){
  a=abs(a);b=abs(b);
  while(b)[a,b]=[b,a%b];
  return a;
}
function normalizeAmplitude(x){
  if(typeof x==='number'){
    guard(Number.isSafeInteger(x),'amplitudes must be exact safe integers or rational strings');
    x=String(x);
  }
  guard(typeof x==='string'&&x.length<=36&&/^[+-]?\d+(?:\/[1-9]\d*)?$/.test(x),
    'amplitudes must be exact integer or positive-denominator rational strings');
  const [p,q]=x.split('/'),n=BigInt(p),d=BigInt(q??'1');
  guard(n!==0n,'amplitude must be nonzero; zero is represented by inactive controls');
  guard(abs(n)<=1000000000000n&&d<=1000000000000n,
    'amplitude rational exceeds exact input budget');
  const g=gcd(n,d);
  return d/g===1n?String(n/g):String(n/g)+'/'+String(d/g);
}
function safePositiveInt(x,low,high,name){
  guard(Number.isSafeInteger(x)&&x>=low&&x<=high,
    name+' must be an integer in ['+low+','+high+']');
  return x;
}
function controlsFor(horizon,channels,points=[],amplitudes=[]){
  const controls=Array.from({length:horizon},()=>Array(channels).fill('0'));
  for(let i=0;i<points.length;i++){
    const j=points[i];
    controls[Math.floor(j/channels)][j%channels]=amplitudes[i];
  }
  return controls;
}
function selectedOrder(a,b){
  return a.pulseCount-b.pulseCount||
    a.numReadings-b.numReadings||
    a.totalDeclaredCost-b.totalDeclaredCost||
    a.courseKey.localeCompare(b.courseKey);
}
export function synthesizeSparseExcitation(request){
  guard(request&&typeof request==='object'&&!Array.isArray(request)
    &&request.schema===ACTIVE_SPARSE_SYNTHESIS_SCHEMA,
    'explicit worldlaw.active-sparse-excitation/v1 source schema is required');
  const horizon=safePositiveInt(request.controlHorizon,2,10,'controlHorizon');
  const channels=safePositiveInt(request.inputChannels,1,4,'inputChannels');
  const maxPulses=safePositiveInt(request.maxPulses??2,1,3,'maxPulses');
  const maxCourses=safePositiveInt(request.maxCourses??2000,1,50000,'maxCourses');
  const maxCombinations=safePositiveInt(request.maxCombinations??50000,1,100000,'maxCombinations');
  const maxWorkNodes=safePositiveInt(request.maxWorkNodes??500000,100,10000000,'maxWorkNodes');
  const pulseCost=safePositiveInt(request.pulseCost??1,0,1000000,'pulseCost');
  const maxInnerNodes=safePositiveInt(request.workLimitPerCourse??50000,100,50000,'workLimitPerCourse');
  guard(Array.isArray(request.amplitudes)&&request.amplitudes.length>=1&&
    request.amplitudes.length<=4,'declare 1–4 exact nonzero amplitude choices');
  const amplitudes=request.amplitudes.map(normalizeAmplitude);
  guard(new Set(amplitudes).size===amplitudes.length,
    'amplitude menu must have distinct canonical nonzero values');
  const positions=Array.from({length:horizon*channels},(_,i)=>({
    index:i,tick:Math.floor(i/channels),channel:i%channels
  }));
  const base={
    schema:ACTIVE_LINEAR_FAMILY_SCHEMA,
    source:request.source,
    hypotheses:request.hypotheses,
    offeredTicks:request.offeredTicks,
    maxReadings:request.maxReadings,
    noiseBound:request.noiseBound??0,
    costByTick:request.costByTick,
    workLimit:maxInnerNodes
  };
  const evaluate=(points,values)=>designActiveLinearFamily({
    ...base,controls:controlsFor(horizon,channels,points,values)
  });
  // Refuse malformed hypotheses, sensor dimension, source and cost bounds
  // before even considering a candidate control. The no-action trajectory is
  // an actual structural negative: linear homogeneous states can always be 0.
  const idle=evaluate([],[]);
  guard(idle.potential.every(p=>!p.structural),
    'unexpected idle structural separation violates the homogeneous-law invariant');
  const pairNames=idle.potential.map(p=>p.pair),pairCount=pairNames.length;
  guard(pairCount>=1&&pairCount<=10,'must have 1–10 competing model pairs');
  const all=(1n<<BigInt(pairCount))-1n;
  // Because the forced response is exactly linear in every control cell, a
  // pair that cannot be separated by ANY single unit coordinate over the full
  // offered sensor horizon cannot be separated by ANY linear combination of
  // those coordinates, even with continuous amplitudes or arbitrary pulse count.
  // This is an exact span no-go independent of enumeration and amplitude menu.
  const impulseMasks=[],pairSupport=Array.from({length:pairCount},()=>[]);
  for(const p of positions){
    const proof=evaluate([p.index],['1']);
    guard(proof.potential.length===pairCount,
      'model pair count changed during source-only rank compilation');
    let mask=0n;
    for(let i=0;i<pairCount;i++)if(proof.potential[i].structural){
      mask|=1n<<BigInt(i);
      pairSupport[i].push({tick:p.tick,channel:p.channel});
    }
    impulseMasks.push(mask);
  }
  const span=impulseMasks.reduce((mask,p)=>mask|p,0n);
  const impossible=pairSupport.flatMap((support,i)=>support.length?[]:[pairNames[i]]);
  const baseResult={
    schema:ACTIVE_SPARSE_SYNTHESIS_SCHEMA,
    source:request.source,
    sourceOnly:true,
    physicalActionsPerformed:false,
    measuredOutcomesUsed:false,
    hypothesisIds:idle.hypothesisIds,
    controlHorizon:horizon,inputChannels:channels,
    amplitudes,offeredTicks:idle.offeredTicks,
    noiseBound:idle.noiseBound,maxReadings:idle.maxReadings,
    maxPulses,pulseCost,maxCourses,maxCombinations,maxWorkNodes,
    rankSpan:{
      pairCount,elementaryUnitProbes:positions.length,
      perPair:pairNames.map((pair,i)=>({pair,
        identifyingUnitPulsePositions:pairSupport[i]})),
      impossiblePairs:impossible,
      interpretation:'Exact full-horizon necessary structural support of unit impulses. The forced-response map is linear in all control cells; an all-zero pair row proves no finite input on this horizon and declared sensors can separate that pair.'
    }
  };
  if(span!==all)return {...baseResult,
    status:'structurally_indistinguishable_for_every_input_on_offered_course',
    chosenControls:null,chosenReadings:null,pairProof:null,
    pulseCount:null,numReadings:null,totalDeclaredCost:null,
    coursesEvaluated:0,combinationsExamined:0,combinationsPruned:0,
    innerNodes:0,exhausted:false,
    interpretation:'Exact source-only algebraic impossibility on the offered observation horizon for at least one pair, even for unbounded real-valued controls; change model, sensors, or horizon.'
  };
  let coursesEvaluated=0,combinationsExamined=0,combinationsPruned=0,
    innerNodes=0,exhausted=false,innerExhausted=false,best=null;
  const suffix=new Array(positions.length+1).fill(0n);
  for(let i=positions.length-1;i>=0;i--)suffix[i]=suffix[i+1]|impulseMasks[i];
  function evaluateCourse(points,values){
    if(coursesEvaluated>=maxCourses||innerNodes>=maxWorkNodes){
      exhausted=true;return;
    }
    const proof=evaluate(points,values);
    coursesEvaluated++;
    innerNodes+=proof.nodes;
    if(proof.exhausted){innerExhausted=true;exhausted=true;}
    if(innerNodes>maxWorkNodes)exhausted=true;
    if(proof.selection){
      const key=points.map((p,i)=>p+':'+values[i]).join(';');
      const candidate={
        pulseCount:points.length,
        numReadings:proof.numReadings,
        readingCost:proof.totalCost,
        totalDeclaredCost:proof.totalCost+pulseCost*points.length,
        courseKey:key,
        chosenPulses:points.map((p,i)=>({
          tick:Math.floor(p/channels),channel:p%channels,
          amplitude:values[i],cost:pulseCost
        })),
        chosenControls:controlsFor(horizon,channels,points,values),
        chosenReadings:proof.selection,
        pairProof:proof.proof,
        innerStatus:proof.status
      };
      if(!best||selectedOrder(candidate,best)<0)best=candidate;
    }
  }
  function assign(points,index,values){
    if(exhausted)return;
    if(index===points.length){
      evaluateCourse(points,values);
      return;
    }
    for(const amp of amplitudes){
      assign(points,index+1,[...values,amp]);
      if(exhausted)return;
    }
  }
  // Each support's observed pair coverage is a necessary condition, so
  // lattice pruning never rejects a feasible course. All support sets with
  // smaller cardinality are examined before any larger cardinality.
  function examineAtPulseCount(count){
    function supports(start,chosen,mask){
      if(exhausted)return;
      if(chosen.length===count){
        if(combinationsExamined>=maxCombinations){exhausted=true;return;}
        combinationsExamined++;
        if(mask!==all){combinationsPruned++;return;}
        assign(chosen,0,[]);
        return;
      }
      const left=count-chosen.length;
      for(let i=start;i<=positions.length-left;i++){
        const candidateMask=mask|impulseMasks[i];
        if((candidateMask|suffix[i+1])!==all){
          combinationsPruned++;
          continue;
        }
        supports(i+1,[...chosen,i],candidateMask);
        if(exhausted)return;
      }
    }
    supports(0,[],0n);
  }
  for(let count=1;count<=maxPulses;count++){
    examineAtPulseCount(count);
    if(best||exhausted)break;
  }
  const status=best
    ? exhausted?'candidate_uncertified':'optimal_certified_sparse_course'
    : exhausted?'search_inconclusive':'no_sparse_course_certified_within_budget';
  return {...baseResult,status,
    chosenPulses:best?.chosenPulses??null,
    chosenControls:best?.chosenControls??null,
    chosenReadings:best?.chosenReadings??null,
    pairProof:best?.pairProof??null,
    pulseCount:best?.pulseCount??null,
    numReadings:best?.numReadings??null,
    readingCost:best?.readingCost??null,
    totalDeclaredCost:best?.totalDeclaredCost??null,
    courseKey:best?.courseKey??null,
    coursesEvaluated,combinationsExamined,combinationsPruned,
    innerNodes,innerExhausted,exhausted,
    interpretation:best?
      'Exact least number of nonzero source-declared coordinate actuation cells, then fewest readouts and lowest declared cost, among exhaustively searched nonzero finite alphabet courses satisfying conservative exact nullspace noise witnesses. A nonzero exhausted flag explicitly withdraws optimality. Synthetic/source-conditional ONLY.':
      exhausted?
      'Finite control or readout search budget was exhausted: no global feasibility or optimality claim.':
      'No conservative pairwise certified course exists within the complete declared sparse-control and readout menu; other alphabets, longer horizons, sensors or optimal robust dual combinations remain untested.'
  };
}
export function replaySparseExcitation(request,certificate){
  const derived=synthesizeSparseExcitation(request);
  guard(certificate?.schema===ACTIVE_SPARSE_SYNTHESIS_SCHEMA&&
    JSON.stringify(certificate)===JSON.stringify(derived),
    'source or exact sparse control certificate changed; replay refused');
  return {valid:true,sourceOnly:true,physicalActionsPerformed:false};
}
