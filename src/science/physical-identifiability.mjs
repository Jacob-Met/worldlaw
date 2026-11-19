/** Exact structural identifiability and minimum-cardinality physical anchor design.
 *
 * A measurement here is one source-declared *linear observation equation*.
 * Observed values, model residuals, heldout outcomes, empirical accuracy and
 * calibrations are never accepted. A numerical rank heuristic cannot turn a
 * gauge direction into a physical parameter. This engine proves row-space
 * membership using primitive BigInt integer elimination, and returns exact
 * nullspace counterexamples for unidentifiable target functionals.
 *
 * Distinct from statistical covariance fitting and dynamical observability.
 */
export const PHYSICAL_IDENTIFIABILITY_SCHEMA='worldlaw.physical-identifiability/v1';
export const PHYSICAL_IDENTIFIABILITY_WORK_LIMIT=50000;
const fail=(message)=>{throw Error('Physical structural identifiability: '+message);};
const requireThat=(ok,message)=>{if(!ok)fail(message);};
const abs=x=>x<0n?-x:x;
function gcd(a,b){a=abs(a);b=abs(b);while(b){[a,b]=[b,a%b];}return a;}
function primitive(values){
  let k=0n;
  for(const v of values)if(v!==0n){k=k?gcd(k,v):abs(v);if(k===1n)break;}
  if(!k)return values.map(()=>0n);
  const first=values.find(v=>v!==0n);
  return values.map(v=>(first<0n?-v:v)/k);
}
function ratio(n,d=1n){
  requireThat(d!==0n,'rational denominator zero');
  if(d<0n){n=-n;d=-d;}
  const factor=gcd(n,d)||1n;
  return {n:n/factor,d:d/factor};
}
const plus=(a,b)=>ratio(a.n*b.d+b.n*a.d,a.d*b.d);
const minus=(a,b)=>ratio(a.n*b.d-b.n*a.d,a.d*b.d);
const multiply=(a,b)=>ratio(a.n*b.n,a.d*b.d);
const divide=(a,b)=>{requireThat(b.n!==0n,'singular nullspace pivot');return ratio(a.n*b.d,a.d*b.n);};
const str=f=>f.d===1n?String(f.n):String(f.n)+'/'+String(f.d);
const MAX_INPUT=1000000000000n;
function scalar(value){
  let s;
  if(typeof value==='number'){
    requireThat(Number.isSafeInteger(value),'JSON numeric coefficients must be safe integers; provide decimal/rational coefficients as strings');
    s=String(value);
  }else{
    requireThat(typeof value==='string'&&value.length<=44,'coefficient must be an integer, fixed decimal or rational string');
    s=value.trim();
  }
  requireThat(/^[-+]?(?:\d+(?:\.\d{1,12})?|\.\d{1,12})(?:\/\d{1,12})?$/.test(s),'malformed exact decimal or fraction: '+s);
  let sign=1n;if(s[0]==='-'){sign=-1n;s=s.slice(1);}else if(s[0]==='+')s=s.slice(1);
  const parts=s.split('/'),point=parts[0].split('.'),decimals=point[1]??'';
  const numerator=BigInt((point[0]||'0')+decimals)*sign;
  const denominator=10n**BigInt(decimals.length)*BigInt(parts[1]??'1');
  requireThat(denominator!==0n,'denominator must not be zero');
  const out=ratio(numerator,denominator);
  requireThat(abs(out.n)<=MAX_INPUT&&out.d<=MAX_INPUT,'coefficient numerator/denominator exceeds ±1e12');
  return out;
}
function checkedRows(rows,variables,max,label){
  requireThat(Array.isArray(rows)&&rows.length<=max&&(label!=='targets'||rows.length>0),
    label+' must have at most '+max+' rows; targets must be nonempty');
  const ids=new Set();
  return rows.map((r,i)=>{
    requireThat(r&&typeof r==='object'&&!Array.isArray(r),'invalid '+label+' row '+i);
    requireThat(typeof r.id==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(r.id),
      label+' row needs stable ID');
    requireThat(!ids.has(r.id),'duplicate '+label+' ID '+r.id);
    ids.add(r.id);
    requireThat(Array.isArray(r.coefficients)&&r.coefficients.length===variables.length,
      'row '+r.id+' must give one exact coefficient per variable');
    const fractions=r.coefficients.map(scalar);
    requireThat(fractions.some(v=>v.n!==0n),'zero-information row '+r.id+' should not be offered');
    let lcm=1n;for(const f of fractions)lcm=lcm/gcd(lcm,f.d)*f.d;
    const vector=primitive(fractions.map(f=>f.n*(lcm/f.d)));
    return {id:r.id,vector,source:r.source??null,
      ...(label==='anchors'?{cost:checkedCost(r.cost??1,r.id)}:{})};
  });
}
function checkedCost(x,id){
  requireThat(Number.isSafeInteger(x)&&x>=1&&x<=1000000000,
    'anchor '+id+' cost must be positive safe integer ≤1e9');
  return x;
}
function echelon(basis,row){
  let v=row.slice();
  for(const b of basis){
    const p=b.pivot;
    if(v[p]===0n)continue;
    const left=b.values[p],right=v[p];
    v=primitive(v.map((x,k)=>left*x-right*b.values[k]));
  }
  const pivot=v.findIndex(x=>x!==0n);
  if(pivot<0)return basis;
  const extended=[...basis,{pivot,values:v}];
  extended.sort((a,b)=>a.pivot-b.pivot);
  return extended;
}
function rankBasis(rows){
  let basis=[];
  for(const row of rows)basis=echelon(basis,row);
  return basis;
}
const inSpan=(basis,vector)=>echelon(basis,vector).length===basis.length;
function targetState(basis,targets){
  const resolved=targets.map(t=>inSpan(basis,t.vector));
  return {resolved,all:resolved.every(Boolean),count:resolved.filter(Boolean).length};
}
function witness(basis,target,n){
  requireThat(!inSpan(basis,target),'target already resolved');
  const pivot=new Set(basis.map(x=>x.pivot));
  for(let free=0;free<n;free++)if(!pivot.has(free)){
    const x=Array.from({length:n},()=>ratio(0n));
    x[free]=ratio(1n);
    for(let i=basis.length-1;i>=0;i--){
      const row=basis[i].values,p=basis[i].pivot;
      let acc=ratio(0n);
      for(let j=p+1;j<n;j++)if(row[j]!==0n)acc=plus(acc,multiply(ratio(row[j]),x[j]));
      x[p]=divide(ratio(-acc.n,acc.d),ratio(row[p]));
    }
    let dot=ratio(0n);
    for(let i=0;i<n;i++)if(target[i]!==0n)dot=plus(dot,multiply(ratio(target[i]),x[i]));
    if(dot.n!==0n){
      for(const b of basis){
        let residual=ratio(0n);
        for(let i=0;i<n;i++)if(b.values[i]!==0n)residual=plus(residual,multiply(ratio(b.values[i]),x[i]));
        requireThat(residual.n===0n,'internal error: nullspace witness violates original measurement equations');
      }
      return {direction:x.map(str),targetChange:str(dot)};
    }
  }
  fail('internal error: unresolved target has no exact kernel witness');
}
const report=(basis,targets,variables)=>{
  const s=targetState(basis,targets);
  return {equationRank:basis.length,unresolvedDimensions:variables.length-basis.length,
    targets:targets.map((t,i)=>({id:t.id,identifiable:s.resolved[i],
      ...(!s.resolved[i]?{counterexample:witness(basis,t.vector,variables.length)}:{})})),
    allTargetsIdentifiable:s.all};
};
function timeBudgetGuard(start,work,limit){if(work>limit)fail('work budget invalid');}
/**
 * Return a proof if and only if *all* smaller cardinalities were searched.
 * A successful witness with an exhausted exact search is never advertised as
 * globally optimal; structural no-go statements use the full union instead.
 */
export function designPhysicalAnchors(request){
  requireThat(request&&typeof request==='object'&&!Array.isArray(request),'provide a declared linear measurement contract');
  requireThat(request.schema===undefined||request.schema==='worldlaw.physical-identifiability-input/v1','unknown contract schema');
  const variables=request.variables;
  requireThat(Array.isArray(variables)&&variables.length>=2&&variables.length<=16&&
    variables.every(v=>typeof v==='string'&&/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(v))&&
    new Set(variables).size===variables.length,
    'declare 2–16 unique valid latent variable IDs');
  const observations=checkedRows(request.observations,variables,128,'observations');
  requireThat(observations.length>0,'at least one observed channel is required');
  const anchors=checkedRows(request.anchors??[],variables,32,'anchors');
  const targets=checkedRows(request.targets,variables,16,'targets');
  const maxAnchors=request.maxAnchors??Math.min(anchors.length,8);
  const workLimit=request.workLimit??PHYSICAL_IDENTIFIABILITY_WORK_LIMIT;
  requireThat(Number.isSafeInteger(maxAnchors)&&maxAnchors>=0&&maxAnchors<=Math.min(anchors.length,12),
    'maxAnchors must be 0–12 and no greater than proposed physical anchors');
  requireThat(Number.isSafeInteger(workLimit)&&workLimit>=100&&workLimit<=PHYSICAL_IDENTIFIABILITY_WORK_LIMIT,
    'exact work budget must be 100–50000 nodes');
  const base=rankBasis(observations.map(o=>o.vector));
  const union=anchors.reduce((b,a)=>echelon(b,a.vector),base);
  const initial=report(base,targets,variables);
  const potential=report(union,targets,variables);
  const interfaceReceipt={schema:PHYSICAL_IDENTIFIABILITY_SCHEMA,variables:[...variables],
    observationIds:observations.map(o=>o.id),anchorIds:anchors.map(a=>a.id),
    targetIds:targets.map(t=>t.id),maxAnchors,workLimit,sourceOnly:true,
    fitUsesNumericReadings:false,experimentalActionsAreDeclarationsNotEvidence:true,
    initial,potential};
  if(initial.allTargetsIdentifiable)return {...interfaceReceipt,status:'already_identifiable',
    exactMinimalAnchors:0,selection:[],work:{nodes:0,exhausted:false},
    interpretation:'Targets are structurally in the original measurement row span; this does not certify actual sensor calibration or law truth.'};
  if(!potential.allTargetsIdentifiable)return {...interfaceReceipt,status:'fundamentally_unidentifiable_with_offered_anchors',
    exactMinimalAnchors:null,selection:null,work:{nodes:0,exhausted:false},
    interpretation:'Even granting every offered independent anchor cannot resolve this exact latent gauge. No amount of repeated same-kind readings can repair absent structural information.'};
  const objective=(basis)=>targetState(basis,targets).all;
  let nodes=0,exhausted=false,answer=null,foundSize=null;
  // Globally exact minimal cardinality and, at that cardinality, minimal
  // offered integer cost; exhaustive node budget is a visible failure.
  for(let size=1;size<=maxAnchors;size++){
    let winner=null;
    const walk=(start,depth,basis,chosen,cost)=>{
      if(exhausted)return;
      nodes++;
      if(nodes>workLimit){exhausted=true;return;}
      if(depth===size){
        if(objective(basis)){
          if(!winner||cost<winner.cost||(cost===winner.cost&&
            chosen.join(',')<winner.indices.join(',')))
            winner={indices:chosen.slice(),cost,basis};
        }
        return;
      }
      const slots=size-depth;
      if(anchors.length-start<slots)return;
      // The rank of all *remaining* anchors upper-bounds any completion.
      let maxBasis=basis;
      for(let i=start;i<anchors.length;i++)maxBasis=echelon(maxBasis,anchors[i].vector);
      if(!objective(maxBasis))return;
      for(let i=start;i<=anchors.length-slots;i++){
        // Candidates with duplicate latent span still matter for cost only
        // if they are cheaper than stronger anchors. Exact exhaustive search
        // permits them but rejects no-gain branches via remaining-bound.
        walk(i+1,depth+1,echelon(basis,anchors[i].vector),[...chosen,i],cost+anchors[i].cost);
        if(exhausted)return;
      }
    };
    walk(0,0,base,[],0);
    if(winner){answer=winner;foundSize=size;break;}
    if(exhausted)break;
  }
  const selection=answer?answer.indices.map(i=>({id:anchors[i].id,
    source:anchors[i].source,cost:anchors[i].cost,coefficients:anchors[i].vector.map(String)})):null;
  const selectedRank=answer?report(answer.basis,targets,variables):null;
  const status=answer?(exhausted?'valid_design_uncertified':'optimal_structural_design'):
    exhausted?'search_inconclusive':'insufficient_anchor_budget';
  return {...interfaceReceipt,status,
    exactMinimalAnchors:answer&&!exhausted?foundSize:null,selection,
    achieved: selectedRank,
    totalCost:answer?answer.cost:null,
    work:{nodes,exhausted,limit:workLimit},
    interpretation:answer?
      'Exact finite-choice structural row-space witness. Selecting anchors does not execute or authenticate those measurements; minimum refers to the offered finite anchor set and exact linear model, not all physical experiments.':
      exhausted?'Search budget exhausted, but full-union feasibility remains proved. Cannot claim anchor budget insufficient.':
      'All offered subsets up to the declared cardinality budget failed to resolve target functionals. This is a finite-search proof, not a physical impossibility beyond the offered actions.'};
}
/** Reverify a published claim without executing a physical sensor. */
export function replayPhysicalAnchorCertificate(request,prior){
  const fresh=designPhysicalAnchors(request);
  requireThat(prior?.schema===PHYSICAL_IDENTIFIABILITY_SCHEMA,'certificate schema mismatch');
  requireThat(prior.status===fresh.status,'certificate status changed under exact replay');
  requireThat(JSON.stringify(prior)===JSON.stringify(fresh),
    'certificate or source changed: full exact replay differs');
  return {valid:true,status:fresh.status,work:fresh.work,
    interpretation:'Deterministic source-only proof, not authenticated physical readings.'};
}
