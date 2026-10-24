import {readCouplingNotebook} from './notebook.mjs';
import {normalizeCirculation} from './circulation.mjs';
import {STRUCTURES,requireThat,finite} from './science.mjs';
import {searchCoupledSharedCourse} from './shared-course.mjs';
export const ALLOWANCE_LIMITS=Object.freeze({entries:8,workUnits:2000000000,iterations:512,products:16777216,bytes:4194304});
export const ALLOWANCE_SCHEMA='worldlaw.coupled-receiving-allowance-inputs/v1';
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const interpretation='Hypothetical independent receiving-radius additions for one fixed-coordinate, fixed-structure computed least-squares family. Original bounds and readings remain unchanged. These additions do not estimate sensor accuracy, repair evidence or identify missing physics. Verified scenarios give a tested numerical bracket, not an exact minimum; bounded search exhaustion is unresolved. Inherited QR-error limitations remain.';
export function planReceivingAllowance(raw){
 requireThat(exact(raw,['schema','notebook','path','trainingRadius','modelId','additions','basis','maxIterations','maxProducts'])&&raw.schema===ALLOWANCE_SCHEMA,'Retain original source and declared allowance settings only; cached results are not inputs.');
 const notebook=readCouplingNotebook(raw.notebook),path=normalizeCirculation(raw.path),trainingRadius=finite(raw.trainingRadius,'training radius');
 requireThat(trainingRadius>=0&&STRUCTURES.some(s=>s.id===raw.modelId),'Select a retained structure and nonnegative training radius.');
 requireThat(path.source.coordinateConvention===notebook.assumptions.coordinateConvention,'Original coordinate conventions must match exactly.');
 requireThat(typeof raw.basis==='string'&&raw.basis.trim().length>0&&raw.basis.length<=2000,'Describe the hypothetical allowance basis in at most2000 characters.');
 requireThat(Array.isArray(raw.additions)&&raw.additions.length>=2&&raw.additions.length<=ALLOWANCE_LIMITS.entries&&raw.additions[0]===0,'Supply two to eight increasing additions beginning at zero.');
 const additions=raw.additions.map((d,i)=>{finite(d,'receiving allowance addition',1e12);requireThat(d>=0&&(i===0||d>raw.additions[i-1]),'Additions must be strictly increasing and nonnegative.');return d;});
 for(const row of path.samples)for(const radius of row.torqueRadius)for(const d of additions)requireThat(Number.isFinite(radius+d)&&radius+d<=1e12&&(d===0||radius+d>radius),'Every enlarged radius must remain representable within the receiving bound.');
 const {maxIterations,maxProducts}=raw;
 requireThat(Number.isSafeInteger(maxIterations)&&maxIterations>=0&&maxIterations<=ALLOWANCE_LIMITS.iterations&&Number.isSafeInteger(maxProducts)&&maxProducts>=0&&maxProducts<=ALLOWANCE_LIMITS.products,'Per-scenario search budgets exceed ladder limits.');
 const count=notebook.training.length+notebook.revisions.length,m=path.samples.length,n=2*count;
 requireThat(count<=128&&m<=128,'Retain at most128 training and128 receiving rows.');
 // Conservative source-sized units: reserve complete region construction for
 // initial preparation and fresh finish; reserve an entire construction plus
 // all notebook history/planning work for every possible candidate-refit step.
 const region=STRUCTURES.reduce((s,x)=>s+n*n*x.terms.length**2+m*(n+4)*(n+2),0);
 const history=(notebook.revisions.length+2)*STRUCTURES.reduce((s,x)=>s+(n+2*notebook.challenges.length+2*notebook.permitted.length+4)*n*x.terms.length**2,0);
 const perPreparation=region+history,perIteration=3*n*2*m;
 const effectiveIterations=Math.min(maxIterations,Math.floor(maxProducts/perIteration));
 const reservedWorkUnits=additions.length*((effectiveIterations+3)*perPreparation+effectiveIterations*perIteration);
 requireThat(Number.isSafeInteger(reservedWorkUnits)&&reservedWorkUnits<=ALLOWANCE_LIMITS.workUnits,'The complete ladder including repeated preparation, histories and candidate refits exceeds its work budget. No scenarios were run.');
 return {source:{schema:ALLOWANCE_SCHEMA,notebook,path,trainingRadius,modelId:raw.modelId,additions,basis:raw.basis.trim(),maxIterations,maxProducts},reservedWorkUnits,perPreparation,effectiveIterations};
}
export function inspectReceivingAllowance(raw){
 const plan=planReceivingAllowance(raw),source=plan.source;
 const entries=source.additions.map(addition=>{
  const path=structuredClone(source.path);for(const row of path.samples)row.torqueRadius=row.torqueRadius.map(r=>r+addition);
  const result=searchCoupledSharedCourse(source.notebook,path,source.trainingRadius,source.modelId,{maxIterations:source.maxIterations,maxProducts:source.maxProducts});
  return {addition,...result};
 });
 const separated=entries.filter(e=>e.status==='verified-separation'),supported=entries.filter(e=>e.status==='verified-interior-witness');
 const excludedThrough=separated.length?separated.at(-1).addition:null,supportedAt=supported.length?supported[0].addition:null;
 const conflict=excludedThrough!==null&&supportedAt!==null&&excludedThrough>=supportedAt;
 return {...plan,entries,bracket:conflict?null:{excludedThrough,supportedAt},status:conflict?'numerically-inconsistent':'computed',interpretation};
}
export function serializeReceivingAllowance(raw){const {source}=planReceivingAllowance(raw),text=JSON.stringify(source,null,2);requireThat(new TextEncoder().encode(text).length<=ALLOWANCE_LIMITS.bytes,'Allowance inputs exceed4MiB.');return text;}
export function reopenReceivingAllowance(text){requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=ALLOWANCE_LIMITS.bytes,'Allowance inputs exceed4MiB.');let raw;try{raw=JSON.parse(text);}catch{throw Error('Allowance inputs must be JSON.');}return inspectReceivingAllowance(raw);}
