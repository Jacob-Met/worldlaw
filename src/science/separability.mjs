import {validateRows} from '../data.mjs';

const AXES = ['command', 'position', 'rate'];
export const SEPARABILITY_SCHEMA = 'worldlaw.separability-screen/v1';
const MAX_WORK = 200000, MAX_RECTANGLES = 1024;

// Directed binary64 enclosure adapted from the maintained input-enclosure.mjs.
// Keep that owner's input-model refinement unchanged. Only + and - are needed.
const bits = new DataView(new ArrayBuffer(8));
function adjacent(value, upward) {
  if (!Number.isFinite(value)) throw new RangeError('Nonfinite contrast arithmetic');
  if (value === 0) return upward ? Number.MIN_VALUE : -Number.MIN_VALUE;
  bits.setFloat64(0, value);
  bits.setBigUint64(0, bits.getBigUint64(0) + ((value > 0) === upward ? 1n : -1n));
  return bits.getFloat64(0);
}
const lower = x => adjacent(x, false), upper = x => adjacent(x, true);
const add = (a,b) => [lower(a[0]+b[0]), upper(a[1]+b[1])];
const negate = a => [-a[1], -a[0]];
const box = (value,radius) => radius === 0 ? [value,value] : [lower(value-radius),upper(value+radius)];

/** Challenge additivity on one exactly matched coordinate slice of original rows.
 * No fitting, interpolation, held-out selection, probabilities or source edits.
 */
export function inspectSeparability(observations, declaration) {
  const rows = validateRows(observations, {allowEmpty:true});
  if (!declaration || !Array.isArray(declaration.axes) || declaration.axes.length !== 2 ||
      new Set(declaration.axes).size !== 2 || !declaration.axes.every(k=>AXES.includes(k)))
    throw new RangeError('Choose two different input coordinates');
  if (declaration.exactCoordinates !== true)
    throw new RangeError('This screen requires explicitly assumed exact coordinates');
  const {fixedValue, torqueRadius} = declaration;
  if (typeof fixedValue !== 'number' || !Number.isFinite(fixedValue) || Math.abs(fixedValue)>1e6)
    throw new RangeError('Choose a finite fixed input coordinate within the source domain');
  if (typeof torqueRadius !== 'number' || !Number.isFinite(torqueRadius) || torqueRadius<0 || torqueRadius>1e6)
    throw new RangeError('Declare an absolute torque-error radius from zero to one million N·m');
  const maxWork = declaration.maxWork ?? MAX_WORK, maxRectangles = declaration.maxRectangles ?? MAX_RECTANGLES;
  if (!Number.isInteger(maxWork) || maxWork<1 || maxWork>MAX_WORK ||
      !Number.isInteger(maxRectangles) || maxRectangles<1 || maxRectangles>MAX_RECTANGLES)
    throw new RangeError('Unsupported complete-screen work or output limit');
  const [x,y] = declaration.axes, fixedAxis = AXES.find(k=>k!==x&&k!==y);
  const states = [], groups = new Map(); let work = 0;
  const spend = () => {if (++work>maxWork) throw new RangeError('Complete separability screen exceeds its work limit; no partial result');};
  for (let index=0; index<rows.length; index++) {
    const row = rows[index];
    if (row[fixedAxis]!==fixedValue) continue;
    let column=groups.get(row[x]);
    if (!column) groups.set(row[x],column=new Map());
    let state=column.get(row[y]);
    const interval=box(row.jointTorque,torqueRadius);
    if (!state) {
      state={id:states.length,x:row[x],y:row[y],rowIndices:[],torqueInterval:interval,
        nominalRange:[row.jointTorque,row.jointTorque]};
      states.push(state); column.set(row[y],state);
    }
    state.rowIndices.push(index);
    state.torqueInterval=[Math.max(state.torqueInterval[0],interval[0]),Math.min(state.torqueInterval[1],interval[1])];
    state.nominalRange=[Math.min(state.nominalRange[0],row.jointTorque),Math.max(state.nominalRange[1],row.jointTorque)];
  }
  for (const state of states) state.status=state.torqueInterval[0]>state.torqueInterval[1]?'incompatible-replicates':'not-excluded';
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
