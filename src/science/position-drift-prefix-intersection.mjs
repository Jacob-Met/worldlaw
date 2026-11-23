/** A common measured prefix for many persistent laws, or a checked rational contradiction. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parsePositionDriftRates} from './persistent-position-drift-planner.mjs';
import {parseAllHorizonRational} from './persistent-position-drift-all-horizon.mjs';
import {feedbackPrimitive,intersectFeedbackHalfspaces,checkFeedbackContradiction} from './exact-feedback-feasibility.mjs';
import {openPositionDriftFeedback} from './position-drift-terminal-feedback.mjs';

const {Q,Z,add,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;

export function prefixHistoryOracle(source,prefix){
  const {commands,ids,rates,error}=parsePositionDriftRates(source,parseAllHorizonRational);
  const actions=prefix.map(u=>commands.indexOf(u)),width=prefix.length-1;
  if(width<0||actions.includes(-1))throw Error('Expected a nonempty catalog prefix.');
  const cached=new Map();
  // Gauging the observed y0 and y1 to zero translates each law's own
  // unknown position and drift. Every remaining coordinate is shared.
  function lawRows(law,spend){
    if(cached.has(law))return cached.get(law);
    const forcing=[Z()],rows=[];
    for(const u of actions)forcing.push(add(forcing.at(-1),rates[law][u]));
    for(let k=2;k<forcing.length;k++)for(let j=1;j<k;j++)for(let i=0;i<j;i++){
      const ticks=[i,j,k],weights=[BigInt(k-j),BigInt(i-k),BigInt(j-i)];
      const center=ticks.reduce((s,t,n)=>add(s,mul(Q(weights[n]),forcing[t])),Z());
      const radius=mul(Q(2n*BigInt(k-i)),error);
      for(const sign of [-1n,1n]){
        spend();
        const a=Array(width).fill(0n);
        ticks.forEach((t,n)=>{if(t>=2)a[t-2]=weights[n]*sign;});
        rows.push(feedbackPrimitive(a,add(radius,mul(Q(sign),center))));
      }
    }
    cached.set(law,rows);return rows;
  }
  return function check(laws,spend){
    const rows=[],owners=[];
    for(const law of laws)for(const row of lawRows(law,spend)){spend();rows.push(row);owners.push(law);}
    const result=intersectFeedbackHalfspaces(rows,width,spend);
    if(result.proof){
      if(!checkFeedbackContradiction(rows,width,result.proof))throw Error('Invalid common-prefix contradiction.');
      return {excluded:[...new Set(result.proof.map(([i])=>owners[i]))].sort((a,b)=>a-b),
        proof:result.proof.map(([i,w])=>[i,String(w)])};
    }
    const readings=['0','0',...result.point.map(fmt)],allowed=new Set(laws.map(i=>ids[i]));
    const witnesses=openPositionDriftFeedback(source).receive(prefix,readings).filter(w=>allowed.has(w.law));
    if(witnesses.length!==laws.length)throw Error('Common-prefix point failed persistent-state replay.');
    return {readings,witnesses};
  };
}
