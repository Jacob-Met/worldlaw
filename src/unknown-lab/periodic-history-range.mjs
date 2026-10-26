import {normalizePeriodicCourse,searchPeriodicCourse,searchFixedPeriodicHistory,checkFixedPeriodicHistory} from './periodic-course.mjs';
export const HISTORY_RANGE_SCHEMA='worldlaw.periodic-history-range/v1';
const require=(ok,message)=>{if(!ok)throw Error(message);};
const compact=r=>({status:r.status,...(r.reason?{reason:r.reason}:{}),search:{...r.inputs.search},iterations:r.iterations,products:r.products,rank:r.rank,activeColumns:r.activeColumns,...(r.certificate?{certificate:r.certificate,check:r.check}:{})});

export function boundPeriodicHistory(raw){
 require(raw?.schema===HISTORY_RANGE_SCHEMA,'Expected periodic-history-range inputs v1.');
 const settings=raw.settings;
 require(settings&&typeof settings==='object'&&!Array.isArray(settings)&&Object.keys(settings).every(k=>['resolution','maxQueries','maxProducts'].includes(k)),'Declare bounded range settings.');
 const {resolution,maxQueries,maxProducts}=settings;
 require(Number.isFinite(resolution)&&resolution>=1e-8&&resolution<=1000,'Declare offset resolution from 1e-8 to 1000 N*m.');
 require(Number.isSafeInteger(maxQueries)&&maxQueries>=0&&maxQueries<=64,'Declare 0–64 fixed-offset queries.');
 require(Number.isSafeInteger(maxProducts)&&maxProducts>=0&&maxProducts<=67108864,'Declare a global estimated matrix-term budget up to 67108864.');
 require(Array.isArray(raw.course?.evidence?.components)&&raw.course.evidence.components.every(c=>c&&Object.keys(c).every(k=>['period','amplitudeBound'].includes(k))),'This convex range requires explicit fixed-period components only, not frequency bands or alternative model unions.');
 const course=normalizePeriodicCourse(raw.course);
 const inputs={schema:HISTORY_RANGE_SCHEMA,course,settings:{resolution,maxQueries,maxProducts}};
 const H=course.historyBound,prior=[-H,H];let products=0;
 const solve=fixed=>{
  const search={maxIterations:course.search.maxIterations,maxProducts:Math.min(course.search.maxProducts,maxProducts-products)};
  const supplied={...course,search};
  const result=fixed===null?searchPeriodicCourse(supplied):searchFixedPeriodicHistory(supplied,fixed);
  products+=result.products;
  return compact(result);
 };
 const initial=solve(null);
 const qualification='Conditional projection of one fixed-period convex model family within the declared preparation-offset prior. The inner interval is supported by compatible parameter witnesses and convexity; outer exclusions use independently checked fixed-offset separators plus a compatible offset on the opposite side. These are engineering numerical checks, not calibrated confidence, physical cause or certified floating-point interval arithmetic. Unknown frequency bands or unions of alternative families do not inherit this convex proof.';
 const base={inputs,prior,priorFixed:H===0,initial,qualification};
 if(initial.status!=='verified-course-witness')return {...base,status:initial.status==='verified-course-separation'?'incompatible-course':'unresolved-initial-search',inner:null,outer:initial.status==='verified-course-separation'?null:prior,products,queries:[],sides:[]};
 const h=initial.certificate.values[0];
 const sides=[{side:'lower',outer:-H,inner:h,witness:initial,closed:false},{side:'upper',outer:H,inner:h,witness:initial,closed:false}];
 const queries=[];
 function ask(side,offset){
  const result=solve(offset);queries.push({side:side.side,offset,...result});
  if(result.status==='verified-course-witness'){side.inner=offset;side.witness=result;return 'witness';}
  if(result.status==='verified-course-separation'){side.outer=offset;side.separator=result;return 'excluded';}
  side.closed=true;side.reason=result.reason??'fixed-offset-search-unresolved';return 'unresolved';
 }
 for(const side of sides){
  if(queries.length>=maxQueries||products>=maxProducts)break;
  if(ask(side,side.outer)==='witness'){side.closed=true;side.reason='prior-bound-compatible';}
 }
 while(queries.length<maxQueries&&products<maxProducts){
  const available=sides.filter(s=>!s.closed&&Math.abs(s.outer-s.inner)>resolution).sort((a,b)=>Math.abs(b.outer-b.inner)-Math.abs(a.outer-a.inner));
  if(!available.length)break;
  const side=available[0],mid=(side.outer+side.inner)/2;
  if(mid===side.outer||mid===side.inner){side.closed=true;side.reason='numerical-offset-resolution';continue;}
  ask(side,mid);
 }
 const widths=sides.map(s=>Math.abs(s.outer-s.inner));
 const status=widths.every(w=>w<=resolution)?'bracketed':'unresolved-boundary';
 return {...base,status,inner:sides.map(s=>s.inner),outer:sides.map(s=>s.outer),products,queries,sides,widths,
  stoppingReason:status==='bracketed'?'requested-offset-resolution':products>=maxProducts?'global-matrix-budget':queries.length>=maxQueries?'fixed-query-budget':'unresolved-fixed-offset-search'};
}

/** Independently receive a recorded fixed-offset certificate against supplied
 * original course inputs and its explicit per-query work declaration. */
export function checkRangeQuery(inputs,query){
 require(inputs?.schema===HISTORY_RANGE_SCHEMA,'Expected periodic-history-range inputs v1.');
 const course=normalizePeriodicCourse(inputs.course);
 require(query&&Number.isFinite(query.offset)&&query.certificate,'A completed fixed-offset certificate is required.');
 return checkFixedPeriodicHistory({...course,search:query.search},query.offset,query.certificate);
}
