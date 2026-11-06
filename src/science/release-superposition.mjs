import {compareStudioDynamics} from './studio-dynamics-comparison.mjs';
import {outputIntervalCount} from './output-grid.mjs';
// Exact binary64 input arithmetic only; no tolerance-snap for release closure.
function closes(values){const view=new DataView(new ArrayBuffer(8));const parts=values.map(([value,sign])=>{view.setFloat64(0,value);const bits=view.getBigUint64(0),e=Number((bits>>52n)&2047n),f=bits&((1n<<52n)-1n);return {n:BigInt(sign)*((bits>>63n)?-1n:1n)*(e?f+(1n<<52n):f),e:(e?e-1023:-1022)-52};});const exponent=Math.min(...parts.map(x=>x.e));return parts.reduce((s,x)=>s+(x.n<<BigInt(x.e-exponent)),0n)===0n;}
export function investigateReleaseSuperposition(discovery,initial,displacement,settings={},scales={}, {allowance=.01}={}){
 if(!Array.isArray(discovery?.competitive)||!discovery.competitive.length)throw Error('Retain every original competitive law');
 if(!Number.isFinite(allowance)||allowance<0)throw Error('Declare a finite nonnegative scaled interaction allowance');
 const {starts,perpendicular}=prepareSuperpositionStarts(initial,displacement,scales),norm=x=>Math.hypot(x.position/scales.positionScale,x.rate/scales.rateScale);
 const dt=settings.dt??.01,duration=settings.duration??4;if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(duration)||duration<=0)throw Error('Declare positive finite duration and interval');
 const samplesPerPath=outputIntervalCount(duration,dt)+1,requestedSamples=samplesPerPath*4*discovery.competitive.length;
 const base={schema:'worldlaw.release-superposition/v1',starts,displacement:{...displacement},perpendicular,scales:{...scales},settings:{...settings,dt,duration},allowance,requestedSamples,maxTotalSamples:20000,maxTotalEvaluations:240000,interpretation:'Four executed releases test finite superposition: combined minus first minus second plus nominal. The represented starting rectangle closes exactly. Scaled interaction includes integration error; it is not a mixed derivative, numerical error bound, universal nonlinearity test or physical validation. Zero interaction for these directions does not establish a linear law.'};
 if(!Number.isSafeInteger(samplesPerPath)||samplesPerPath<2||samplesPerPath>10001||requestedSamples>20000)return {...base,status:'work-limit',courses:[],laws:[]};
 const courses=starts.map(start=>compareStudioDynamics(discovery,start,base.settings,{maxTotalEvaluations:60000,maxTotalSamples:5000}));
 if(courses.some(c=>c.status!=='completed'))return {...base,status:'incomplete',courses,laws:[]};
 let maximumInteraction=0,witness=null;
 const laws=courses[0].results.map((row,index)=>{let maximum=0,lawWitness=null;const samples=row.trajectory.map((nominal,i)=>{
  const [first,second,combined]=courses.slice(1).map(c=>c.results[index].trajectory[i]);if([first,second,combined].some(s=>s.time!==nominal.time))throw Error('Mixed releases lost exact common reporting times');
  const position=(combined.position-first.position)-(second.position-nominal.position),rate=(combined.rate-first.rate)-(second.rate-nominal.rate),interaction=norm({position,rate});if(!Number.isFinite(interaction))throw Error('Scaled interaction overflowed');
  const sample={time:nominal.time,position,rate,interaction};if(interaction>maximum){maximum=interaction;lawWitness={index,...sample};}return sample;
 });if(maximum>maximumInteraction){maximumInteraction=maximum;witness=lawWitness;}return {index,id:row.id,maximumInteraction:maximum,witness:lawWitness,samples};});
 return {...base,status:maximumInteraction>allowance?'finite-superposition-difference':'within-declared-interaction',courses,laws,maximumInteraction,witness};
}

export function prepareSuperpositionStarts(initial,displacement,scales){
 for(const key of ['position','rate'])if(!Number.isFinite(initial?.[key])||!Number.isFinite(displacement?.[key]))throw Error('Declare finite release coordinates');
 if(!Number.isFinite(scales.positionScale)||scales.positionScale<=0||!Number.isFinite(scales.rateScale)||scales.rateScale<=0)throw Error('Declare positive finite coordinate scales');
 const perpendicular={position:-(displacement.rate/scales.rateScale)*scales.positionScale,rate:(displacement.position/scales.positionScale)*scales.rateScale},norm=x=>Math.hypot(x.position/scales.positionScale,x.rate/scales.rateScale);
 for(const d of [displacement,perpendicular])if(!Number.isFinite(norm(d))||norm(d)===0)throw Error('Both finite release directions must be resolved');
 if(displacement.rate!==0&&perpendicular.position===0||displacement.position!==0&&perpendicular.rate===0)throw Error('Perpendicular release coordinate is unresolved');
 const starts=[{...initial},{},{},{}];
 for(const key of ['position','rate']){
  starts[1][key]=initial[key]+displacement[key];starts[2][key]=initial[key]+perpendicular[key];starts[3][key]=initial[key]+(displacement[key]+perpendicular[key]);
  if(starts.some(s=>!Number.isFinite(s[key])||Math.abs(s[key])>1e6))throw Error('Complete mixed-release starts exceed the supported state envelope');
  if(displacement[key]!==0&&starts[1][key]===initial[key]||perpendicular[key]!==0&&starts[2][key]===initial[key])throw Error('A release coordinate is not representable');
  if(!closes([[starts[3][key],1],[starts[1][key],-1],[starts[2][key],-1],[initial[key],1]]))throw Error('Represented mixed-release starts do not close exactly; choose resolved inputs');
 }
 return {starts,perpendicular};
}
