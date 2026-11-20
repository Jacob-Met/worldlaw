/** Maximize the minimum of finitely many rational linear forms on a box.
 *
 * The caller supplies the existing exact arithmetic domain. No floating point
 * comparison, tolerance, random pivot or feasibility guess enters this solver.
 * A finite box and at least one line make the free-margin LP finite and feasible.
 *
 * Shift u=lo+range*v and t=L+z, where L=min_i f_i(lo). Then v=z=0 is
 * feasible, all right hand sides are nonnegative, and z>=0 cannot remove an
 * optimum: the lower corner already attains L. A primal tableau therefore
 * needs no artificial variables. Bland's smallest-index entering/leaving rule
 * prevents cycling, including degenerate and zero-width source courses.
 * https://doi.org/10.1287/moor.2.2.103
 */
export function maximizeSignedBoxEnvelope(lines,bounds,budget,ops){
  const {Q,Z,add,sub,mul,div,neg,dot}=ops;
  const ensure=(ok,message)=>{if(!ok)throw Error('Exact box envelope: '+message);};
  const zeros=n=>Array.from({length:n},Z);
  const same=(a,b)=>sub(a,b).n===0n;
  ensure(lines.length>0&&bounds.length>0&&lines.every(line=>line.length===bounds.length),
    'nonempty, matching line and box dimensions are required');
  ensure(bounds.every(b=>sub(b.upper,b.lower).n>=0n),'reversed box');
  let pivots=0;
  const incomplete=()=>({complete:false,pivots});
  if(!budget.take())return incomplete();
  const free=bounds.flatMap((bound,i)=>sub(bound.upper,bound.lower).n!==0n&&
    lines.some(line=>line[i].n!==0n)?[i]:[]);
  const lower=bounds.map(b=>b.lower),width=free.map(i=>sub(bounds[i].upper,bounds[i].lower));
  const offsets=lines.map(line=>dot(line,lower));
  const floor=offsets.reduce((a,b)=>sub(a,b).n<=0n?a:b);
  const variableCount=free.length+1,marginColumn=free.length;
  const A=lines.map(line=>[...free.map((i,j)=>neg(mul(line[i],width[j]))),Q(1n)]);
  const b=offsets.map(value=>sub(value,floor));
  for(let j=0;j<free.length;j++){
    const row=zeros(variableCount);row[j]=Q(1n);A.push(row);b.push(Q(1n));
  }
  const constraintCount=A.length,totalVariables=variableCount+constraintCount;
  const table=A.map((row,i)=>[...row,...Array.from({length:constraintCount},(_,j)=>Q(BigInt(i===j))),b[i]]);
  const objective=zeros(totalVariables+1);objective[marginColumn]=Q(-1n);table.push(objective);
  const basic=Array.from({length:constraintCount},(_,i)=>variableCount+i);
  while(true){
    const entering=table[constraintCount].findIndex((v,j)=>j<totalVariables&&v.n<0n);
    if(entering<0)break;
    let leaving=-1,ratio=null;
    for(let i=0;i<constraintCount;i++){
      if(table[i][entering].n<=0n)continue;
      const candidate=div(table[i][totalVariables],table[i][entering]);
      const difference=ratio===null?-1n:sub(candidate,ratio).n;
      if(leaving<0||difference<0||(difference===0n&&basic[i]<basic[leaving])){
        leaving=i;ratio=candidate;
      }
    }
    ensure(leaving>=0,'bounded box LP unexpectedly unbounded');
    const affected=table.flatMap((row,i)=>i!==leaving&&row[entering].n!==0n?[i]:[]);
    // Reserve all work before changing a tableau. Interrupted LPs never return
    // an unchecked point or an infeasibility/optimality claim.
    for(let i=0;i<=affected.length;i++)if(!budget.take())return incomplete();
    const scale=table[leaving][entering];table[leaving]=table[leaving].map(v=>div(v,scale));
    for(const i of affected){
      const factor=table[i][entering];
      table[i]=table[i].map((v,j)=>sub(v,mul(factor,table[leaving][j])));
    }
    basic[leaving]=entering;pivots++;
  }
  const primal=zeros(variableCount);
  basic.forEach((variable,i)=>{if(variable<variableCount)primal[variable]=table[i][totalVariables];});
  const dual=table[constraintCount].slice(variableCount,totalVariables);
  const c=zeros(variableCount);c[marginColumn]=Q(1n);
  ensure(primal.every(v=>v.n>=0n)&&A.every((row,i)=>sub(b[i],dot(row,primal)).n>=0n),
    'primal certificate failed');
  ensure(dual.every(v=>v.n>=0n)&&c.every((value,j)=>
    sub(dot(dual,A.map(row=>row[j])),value).n>=0n),'dual certificate failed');
  const optimum=dot(c,primal);
  ensure(same(optimum,dot(b,dual))&&same(optimum,table[constraintCount][totalVariables]),
    'exact primal/dual equality failed');
  const controls=bounds.map(bound=>bound.lower.n>0n?bound.lower:bound.upper.n<0n?bound.upper:Z());
  free.forEach((index,j)=>{controls[index]=add(bounds[index].lower,mul(width[j],primal[j]));});
  const value=add(floor,optimum),pairDual=dual.slice(0,lines.length);
  const sum=pairDual.reduce(add,Z());ensure(sum.n>0n,'margin dual has no mass');
  const mixtureWeights=pairDual.map(v=>div(v,sum));
  const aggregate=bounds.map((_,j)=>dot(mixtureWeights,lines.map(line=>line[j])));
  const upper=dot(aggregate,aggregate.map((coefficient,j)=>
    coefficient.n>=0n?bounds[j].upper:bounds[j].lower));
  ensure(controls.every((v,j)=>sub(v,bounds[j].lower).n>=0n&&sub(bounds[j].upper,v).n>=0n)&&
    lines.every(line=>sub(dot(line,controls),value).n>=0n),'original box primal certificate failed');
  // Normalize even when z=0 and the shifted LP permits sum(pairDual)>1.
  // The normalized convex combination still bounds the original free t.
  ensure(mixtureWeights.every(v=>v.n>=0n)&&same(mixtureWeights.reduce(add,Z()),Q(1n))&&same(upper,value),
    'independent normalized box upper certificate failed');
  return {complete:true,value,controls,mixtureWeights,upperBound:upper,pivots};
}
