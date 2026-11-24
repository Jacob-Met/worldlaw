import {fitLinearColumns} from './linear-fit.mjs';

const requirePrefix=(ok,message)=>{if(!ok)throw new RangeError(message);};

/** Estimate an initial state from an explicitly supplied observation prefix.
 * The callback must simulate exactly this prefix. No later observed states,
 * fitted-law labels or latent initial values are accepted by this interface.
 * This bounded local least-squares fit is not an uncertainty certificate.
 */
export function fitPrefixState(observations,simulate,{scales=null,iterations=4,maxMagnitude=1e6}={}) {
  const points=observations?.length,n=observations?.[0]?.length;
  requirePrefix(Array.isArray(observations)&&Number.isInteger(points)&&points>=5&&points<=33,'Require 5–33 prefix observations');
  requirePrefix(Number.isInteger(n)&&n>=1&&n<=128,'Invalid prefix state dimension');
  requirePrefix(observations.every(row=>Array.isArray(row)&&row.length===n&&row.every(Number.isFinite)),'Require finite prefix states');
  requirePrefix(typeof simulate==='function','Require a prefix simulator');
  requirePrefix(Number.isInteger(iterations)&&iterations>=1&&iterations<=8,'Invalid prefix iteration budget');
  requirePrefix(Number.isFinite(maxMagnitude)&&maxMagnitude>0,'Invalid prefix state bound');
  const maxEvaluations=1+iterations*(n+4);
  requirePrefix(points*n*maxEvaluations<=2000000,'Prefix shooting work budget exceeded');
  const units=scales===null?Array(n).fill(1):scales;
  requirePrefix(Array.isArray(units)&&units.length===n&&units.every(x=>Number.isFinite(x)&&x>0),'Invalid prefix measurement scales');
  // Copy before invoking user code. The numerical fit never mutates recordings.
  const measured=observations.map(row=>row.slice()),weights=units.slice();
  let evaluations=0,steps=0,converged=false;
  function evaluate(initial) {
    evaluations++;
    if(initial.some(x=>!Number.isFinite(x)||Math.abs(x)>maxMagnitude))return null;
    const path=simulate(initial.slice());
    if(!Array.isArray(path)||path.length!==points||
      path.some(row=>!Array.isArray(row)||row.length!==n||row.some(x=>!Number.isFinite(x)||Math.abs(x)>maxMagnitude)))return null;
    const residual=path.flatMap((row,t)=>row.map((x,j)=>(x-measured[t][j])/weights[j]));
    if(!residual.every(Number.isFinite))return null;
    const loss=residual.reduce((sum,x)=>sum+x*x,0);
    return Number.isFinite(loss)?{initial:initial.slice(),path,residual,loss}:null;
  }
  let best=evaluate(measured[0]);
  if(!best)return {status:'abstained',reason:'initial_prefix_outside_model_domain',points,evaluations,initial:null,terminal:null};
  const lossBefore=best.loss;
  for(let iteration=0;iteration<iterations;iteration++) {
    const columns=[];
    for(let j=0;j<n;j++) {
      const h=1e-5*Math.max(1,Math.abs(best.initial[j])),perturbed=best.initial.slice();
      perturbed[j]+=h;
      const trial=evaluate(perturbed);
      if(!trial)return {status:'abstained',reason:'prefix_sensitivity_outside_model_domain',points,evaluations,initial:null,terminal:null};
      const column=trial.residual.map((v,i)=>(v-best.residual[i])/h);
      // A fixed dimensionless ridge regularizes the state update, not the data.
      const penalty=Math.sqrt(1e-6*points)/weights[j];
      columns.push(column.concat(Array.from({length:n},(_,k)=>k===j?penalty:0)));
    }
    const fit=fitLinearColumns(columns,best.residual.map(v=>-v).concat(Array(n).fill(0)));
    if(!fit)return {status:'abstained',reason:'prefix_sensitivity_rank_failure',points,evaluations,initial:null,terminal:null};
    let accepted=null;
    for(const fraction of [1,.5,.25,.125]) {
      const trial=evaluate(best.initial.map((v,j)=>v+fraction*fit.coefficients[j]));
      if(trial&&trial.loss<best.loss){accepted=trial;break;}
    }
    steps++;
    if(!accepted){converged=true;break;}
    const improvement=best.loss-accepted.loss;
    best=accepted;
    if(improvement<=1e-9*(1+best.loss)){converged=true;break;}
  }
  requirePrefix(evaluations<=maxEvaluations,'Internal prefix evaluation budget exceeded');
  return {status:'fitted',initial:best.initial,terminal:best.path.at(-1).slice(),
    points,iterations:steps,evaluations,converged,lossBefore,lossAfter:best.loss,
    prefixRmse:Math.sqrt(best.loss/(points*n)),usedStateRange:[0,points-1],
    scope:'local fit to the supplied prefix only; coefficients and simulator fixed'};
}
