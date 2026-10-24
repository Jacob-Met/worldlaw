import {prepareAdditiveSlice,addIntervals as add,negateInterval as negate} from './additive-source.mjs';

export const SEPARABILITY_SCHEMA = 'worldlaw.separability-screen/v1';

/** Original complete rectangle screen, preserving admission, output and work limits. */
export function inspectSeparability(observations,declaration) {
  const {rows,states,groups,fixedAxis,x,y,fixedValue,torqueRadius,maxWork,maxRectangles}=prepareAdditiveSlice(observations,declaration);
  let work=0;
  const spend=()=>{if(++work>maxWork)throw new RangeError('Complete separability screen exceeds its work limit; no partial result');};
  const xs=[...groups.keys()].sort((a,b)=>a-b), rectangles=[];
  for (let a=0;a<xs.length;a++) for (let b=a+1;b<xs.length;b++) {
    spend(); const left=groups.get(xs[a]),right=groups.get(xs[b]),shared=[];
    for (const value of left.keys()) {spend();if(right.has(value))shared.push(value);}
    shared.sort((a,b)=>a-b);
    for(let c=0;c<shared.length;c++) for(let d=c+1;d<shared.length;d++) {
      spend();
      if(rectangles.length>=maxRectangles) throw new RangeError('Complete separability screen exceeds its rectangle limit; no partial result');
      const corners=[left.get(shared[c]),right.get(shared[c]),left.get(shared[d]),right.get(shared[d])];
      const conflict=corners.some(s=>s.status==='incompatible-replicates');
      const interval=conflict?null:add(add(corners[0].torqueInterval,negate(corners[1].torqueInterval)),
        add(negate(corners[2].torqueInterval),corners[3].torqueInterval));
      rectangles.push({id:rectangles.length,corners:corners.map(s=>s.id),contrastInterval:interval,
        status:conflict?'incompatible-replicates':interval[0]>0||interval[1]<0?'additivity-excluded':'not-excluded'});
    }
  }
  return {schema:SEPARABILITY_SCHEMA,declaration:{axes:[x,y],fixedValue,torqueRadius,exactCoordinates:true,maxWork,maxRectangles},
    fixedAxis,sourceRowCount:rows.length,sliceRowCount:states.reduce((n,s)=>n+s.rowIndices.length,0),
    states,rectangles,work,excludedCount:rectangles.filter(r=>r.status==='additivity-excluded').length,
    replicateConflictCount:states.filter(s=>s.status==='incompatible-replicates').length,
    status:rectangles.length?'complete':'no-complete-rectangles',
    interpretation:'Necessary local tests of a deterministic sum of separate input functions under declared exact coordinates and absolute reading bounds; passing does not establish joint feasibility, additivity, physical cause or calibrated confidence.'};
}
