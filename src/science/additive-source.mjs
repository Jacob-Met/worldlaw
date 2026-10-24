import {validateRows} from '../data.mjs';

const AXES = ['command', 'position', 'rate'];
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
export const addIntervals = (a,b) => [lower(a[0]+b[0]), upper(a[1]+b[1])];
export const negateInterval = a => [-a[1], -a[0]];
const box = (value,radius) => radius === 0 ? [value,value] : [lower(value-radius),upper(value+radius)];

/** Shared admission and source grouping; no rectangle or graph search. */
export function prepareAdditiveSlice(observations,declaration) {
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
  const states = [], groups = new Map();
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
  return {rows,states,groups,fixedAxis,x,y,fixedValue,torqueRadius,maxWork,maxRectangles};
}
