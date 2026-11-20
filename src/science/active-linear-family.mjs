/**
 * Exact prospective excitation design for finite linear dynamical hypotheses.
 *
 * Each law has x[t+1] = A x[t] + B u[t], y[t] = C x[t]. The initial
 * state x[0] is UNKNOWN and can differ across laws. For a selected time
 * schedule, pair i/j can be separated for every possible initial state only
 * when the known-input response difference is outside col([O_i,-O_j]).
 *
 * Exact left-nullspace witnesses prove this and, when sensor noise is
 * bounded by epsilon in absolute output units, a certificate
 * |w.d| > 2 epsilon ||w||_1 proves separation even under adversarial noise
 * on both hypothetical models. Failure to find that witness is NOT a
 * proof of impossibility under noise. No real measurements are read.
 */
export const ACTIVE_LINEAR_FAMILY_SCHEMA='worldlaw.active-linear-family/v1';
const err=s=>{throw Error('Active linear family: '+s);};
const need=(ok,s)=>{if(!ok)err(s);};
const abs=x=>x<0n?-x:x;
const gcd=(aa,bb)=>{let a=abs(aa),b=abs(bb);while(b)[a,b]=[b,a%b];return a;};
const Q=(n,d=1n)=>{
  need(d!==0n,'zero denominator');
  if(d<0n){n=-n;d=-d;}
  const g=gcd(n,d)||1n;return {n:n/g,d:d/g};
};
const Z=()=>Q(0n);
const add=(a,b)=>Q(a.n*b.d+b.n*a.d,a.d*b.d);
const neg=a=>Q(-a.n,a.d);
const sub=(a,b)=>add(a,neg(b));
const mul=(a,b)=>Q(a.n*b.n,a.d*b.d);
const div=(a,b)=>{need(b.n!==0n,'singular rational pivot');return Q(a.n*b.d,a.d*b.n);};
const fmt=a=>a.d===1n?String(a.n):String(a.n)+'/'+String(a.d);
const number=x=>{
  if(typeof x==='number'){need(Number.isSafeInteger(x),'numbers must be exact safe integers; pass rationals as strings');x=String(x);}
  need(typeof x==='string'&&x.length<=36&&/^[+-]?\d+(?:\/[1-9]\d*)?$/.test(x),
    'coefficients must be exact integer or rational strings');
  const p=x.split('/'),n=BigInt(p[0]),d=BigInt(p[1]??'1');
  need(abs(n)<=1000000000000n&&d<=1000000000000n,'source rational exceeds input budget');
  return Q(n,d);
};
const dot=(a,b)=>a.reduce((s,v,i)=>add(s,mul(v,b[i])),Z());
const zero=n=>Array.from({length:n},Z);
const rowTimes=(r,m)=>m[0].map((_,j)=>dot(r,m.map(t=>t[j])));
const matTimes=(m,v)=>m.map(r=>dot(r,v));
const sumVectors=(a,b)=>a.map((v,i)=>add(v,b[i]));
const copy=x=>JSON.parse(JSON.stringify(x));
function matrix(raw,n,col,label){
  need(Array.isArray(raw)&&raw.length===n&&raw.every(r=>Array.isArray(r)&&r.length===col),
    label+' must be '+n+'x'+col);
  return raw.map(r=>r.map(number));
}
function rref(matrix){
  const a=matrix.map(r=>r.slice()),m=a.length,n=a[0]?.length??0;
  let k=0,pivots=[];
  for(let c=0;c<n&&k<m;c++){
    let p=k;while(p<m&&a[p][c].n===0n)p++;
    if(p===m)continue;
    [a[k],a[p]]=[a[p],a[k]];
    const scale=a[k][c];a[k]=a[k].map(x=>div(x,scale));
    for(let i=0;i<m;i++)if(i!==k&&a[i][c].n!==0n){
      const f=a[i][c];a[i]=a[i].map((v,j)=>sub(v,mul(f,a[k][j])));
    }
    pivots.push(c);k++;
  }
  return {rows:a.slice(0,k),pivots,rank:k};
}
function nullBasis(m){
  if(!m.length)return [];
  const k=m.length,p=m[0].length;
  const t=Array.from({length:p},(_,j)=>m.map(row=>row[j]));
  const reduced=rref(t);
  const piv=new Set(reduced.pivots),out=[];
  for(let f=0;f<k;f++)if(!piv.has(f)){
    const w=zero(k);w[f]=Q(1n);
    for(let j=reduced.rank-1;j>=0;j--){
      const c=reduced.pivots[j];
      let v=Z();for(let x=c+1;x<k;x++)v=add(v,mul(reduced.rows[j][x],w[x]));
      w[c]=neg(v);
    }
    out.push(w);
  }
  return out;
}
function proofForPair(a,b,indices,epsilon){
  const rows=indices.map(t=>[
    ...a[t].observable,
    ...b[t].observable.map(neg)
  ]);
  const delta=indices.map(t=>sub(b[t].forced,a[t].forced));
  const bases=nullBasis(rows);
  let witness=null,margin=Z();
  for(const w of bases){
    const gap=dot(w,delta);
    if(gap.n===0n)continue;
    const norm=w.reduce((s,v)=>add(s,Q(abs(v.n),v.d)),Z());
    const candidate=div(Q(abs(gap.n),gap.d),norm);
    if(!witness||sub(candidate,margin).n>0n){margin=candidate;witness=w;}
  }
  const structural=!!witness;
  const robust=structural&&sub(margin,mul(Q(2n),epsilon)).n>0n;
  if(witness){
    need(witness.every((_,idx)=>true)&&rows[0].every((_,col)=>
      dot(witness,rows.map(row=>row[col])).n===0n),
      'internal nullspace certificate failure');
  }
  return {
    structural,
    robustCertified:robust,
    marginLowerBound:fmt(margin),
    ...(witness?{witness:{
      weights:witness.map(fmt),
      signedGap:fmt(dot(witness,delta)),
      l1Norm:fmt(witness.reduce((s,v)=>add(s,Q(abs(v.n),v.d)),Z())),
      meaning:'Exact unknown-state annihilator; |gap|/||weights||1 is a sufficient noise-separation margin.'
    }}:{counterexample:'Known forcing is absorbable by independent unknown initial states.'})
  };
}
export function designActiveLinearFamily(request){
  need(request&&typeof request==='object'&&!Array.isArray(request),
    'provide a source-declared linear hypothesis family');
  need(request.schema===ACTIVE_LINEAR_FAMILY_SCHEMA,
    'explicit worldlaw.active-linear-family/v1 schema is required');
  need(typeof request.source==='string'&&request.source.trim().length>=12&&request.source.length<=2048,
    'declare an independent source or explicitly hypothetical excitation contract');
  const hs=request.hypotheses;
  need(Array.isArray(hs)&&hs.length>=2&&hs.length<=5,'offer 2–5 competing linear dynamical hypotheses');
  const ids=new Set();
  const controls=request.controls;
  need(Array.isArray(controls)&&controls.length>=2&&controls.length<=10,
    'declare 2–10 time-ordered known control vectors');
  need(Array.isArray(controls[0])&&controls[0].length>=1&&controls[0].length<=4,
    'control input dimension must be 1–4');
  const u=controls.map(r=>{
    need(Array.isArray(r)&&r.length===controls[0].length,
      'all control vectors must use the same dimension');
    return r.map(number);
  });
  const length=controls.length,cols=u[0].length;
  const tickMenu=request.offeredTicks??Array.from({length:length+1},(_,i)=>i);
  need(Array.isArray(tickMenu)&&tickMenu.length>=1&&tickMenu.length<=12&&
    tickMenu.every(t=>Number.isSafeInteger(t)&&t>=0&&t<=length)&&
    new Set(tickMenu).size===tickMenu.length,
    'offer 1–12 distinct integer observation ticks from 0 through control horizon');
  const offered=[...tickMenu].sort((a,b)=>a-b);
  const maxReadings=request.maxReadings??Math.min(offered.length,7);
  const workLimit=request.workLimit??50000;
  need(Number.isSafeInteger(maxReadings)&&maxReadings>=1&&maxReadings<=Math.min(8,offered.length),
    'maxReadings must be 1–8 within offered menu');
  need(Number.isSafeInteger(workLimit)&&workLimit>=100&&workLimit<=50000,
    'workLimit must be 100–50000');
  const eps=number(request.noiseBound??0);
  need(eps.n>=0n,'noiseBound must be nonnegative');
  const cost=request.costByTick??{};
  need(cost&&typeof cost==='object'&&!Array.isArray(cost),'costByTick must map ticks to positive integer costs');
  for(const [tick,c] of Object.entries(cost))
    need(offered.includes(Number(tick))&&Number.isSafeInteger(c)&&c>=1&&c<=1000000000,
      'costByTick has unknown tick or invalid positive integer cost');
  const laws=hs.map((h,i)=>{
    need(h&&typeof h==='object'&&typeof h.id==='string'&&
      /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(h.id)&&!ids.has(h.id),
      'hypothesis IDs must be distinct stable labels');
    ids.add(h.id);
    const n=h.A?.length;
    need(Number.isSafeInteger(n)&&n>=1&&n<=5,'hypothesis '+h.id+' needs 1–5 latent dimensions');
    const A=matrix(h.A,n,n,'A for '+h.id);
    const B=matrix(h.B,n,cols,'B for '+h.id);
    need(Array.isArray(h.C)&&h.C.length===n,'C for '+h.id+' must be one latent observation row');
    const C=h.C.map(number);
    let unknown=C.slice(),forced=zero(n);
    const schedule=[];
    for(let t=0;t<=length;t++){
      schedule.push({observable:unknown.slice(),forced:dot(C,forced)});
      if(t<length){unknown=rowTimes(unknown,A);forced=sumVectors(matTimes(A,forced),matTimes(B,u[t]));}
    }
    return {id:h.id,schedule};
  });
  const pairs=[];
  for(let i=0;i<laws.length;i++)for(let j=i+1;j<laws.length;j++)
    pairs.push({id:laws[i].id+'__'+laws[j].id,a:laws[i].schedule,b:laws[j].schedule});
  const evaluate=indices=>pairs.map(p=>({
    pair:p.id,...proofForPair(p.a,p.b,indices,eps)
  }));
  const potential=evaluate(offered);
  const impossible=potential.filter(p=>!p.structural);
  const base={schema:ACTIVE_LINEAR_FAMILY_SCHEMA,source:request.source,
    hypothesisIds:laws.map(l=>l.id),offeredTicks:offered,
    observationUnits:'Declared scalar output units; unknown initial states are independent for each hypothesis',
    noiseBound:fmt(eps),sourceOnly:true,physicalActionsPerformed:false,
    outcomeValuesUsed:false,
    potential,pairCount:pairs.length,maxReadings,workLimit};
  if(impossible.length)return {...base,status:'structurally_indistinguishable_on_offered_course',
    selection:null,proof:null,nodes:0,
    interpretation:'Exact row-space no-go for at least one pair even with every proposed measurement; control or sensors must change.'};
  // A basis-only robust witness criterion is deliberately one-sided and
  // NOT monotone under adding observations: a subset can expose a better
  // canonical null vector than the union. Never prune the finite search
  // from a failed full-menu witness. Structural impossibility above *is*
  // monotone and remains a valid early no-go.
  let nodes=0,exhausted=false,best=null,structuralCandidates=0;
  for(let size=1;size<=maxReadings;size++){
    let winner=null;
    const walk=(next,chosen,expense)=>{
      nodes++;if(nodes>workLimit){exhausted=true;return;}
      if(chosen.length===size){
        const cases=evaluate(chosen);
        if(cases.every(p=>p.structural))structuralCandidates++;
        if(cases.every(p=>p.robustCertified)){
          if(!winner||expense<winner.expense||
            (expense===winner.expense&&chosen.join(',')<winner.chosen.join(',')))
            winner={chosen:chosen.slice(),expense,proof:cases};
        }
        return;
      }
      const remaining=size-chosen.length;
      for(let i=next;i<=offered.length-remaining;i++){
        walk(i+1,[...chosen,offered[i]],expense+(cost[offered[i]]??1));
        if(exhausted)return;
      }
    };
    walk(0,[],0);
    if(winner){best=winner;break;}
    if(exhausted)break;
  }
  const status=best?(exhausted?'candidate_uncertified':'optimal_certified_schedule'):
    exhausted?'search_inconclusive':
    structuralCandidates>0?'noise_separation_not_certified':'insufficient_reading_budget';
  return {...base,status,
    selection:best?best.chosen.map(t=>({tick:t,cost:cost[t]??1})):null,
    proof:best?.proof??null,
    numReadings:best?.chosen.length??null,totalCost:best?.expense??null,
    nodes,exhausted,
    interpretation:best?
      'Exact finite-choice minimum number and declared cost for the stated sufficient witness criterion; source-only design, not a performed experiment. The noise certificate is conservative, not an optimal adversarial margin.':
      exhausted?'Finite search interrupted before exhaustive optimality; no optimal claim.':
      'No witness-certified pairwise separating schedule found within the declared reading budget.'};
}
export function replayActiveLinearFamily(request,prior){
  const fresh=designActiveLinearFamily(request);
  need(prior?.schema===ACTIVE_LINEAR_FAMILY_SCHEMA&&JSON.stringify(prior)===JSON.stringify(fresh),
    'certificate or source changed; exact prospective replay refused');
  return {valid:true,sourceOnly:true,physicalActionsPerformed:false};
}
