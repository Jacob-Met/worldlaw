import {evaluate} from './torque-discovery.mjs';

// Derived evidence only: session export retains the original inputs and replay
// reconstructs this comparison. It does not authenticate when a reading arrived.
const axes=['command','position','rate'];
function snapshotDomain(domain,sharedDomains) {
  // Current fitted candidates carry the same original observed bounds. Share
  // only exactly equal canonical domains inside this receipt, never source
  // objects or a domain from another update. Unfamiliar shapes still clone.
  const canonical=domain && typeof domain==='object' && !Array.isArray(domain) &&
    Object.keys(domain).length===axes.length && axes.every(axis=>{
      const bounds=domain[axis];
      return Object.hasOwn(domain,axis) && bounds && typeof bounds==='object' && !Array.isArray(bounds) &&
        Object.keys(bounds).length===2 && Object.hasOwn(bounds,'min') && Object.hasOwn(bounds,'max') &&
        Number.isFinite(bounds.min) && Number.isFinite(bounds.max);
    });
  if(!canonical || !sharedDomains)return structuredClone(domain);
  const key=axes.flatMap(axis=>[domain[axis].min,domain[axis].max])
    .map(value=>Object.is(value,-0)?'-0':String(value)).join('|');
  if(!sharedDomains.has(key))sharedDomains.set(key,Object.freeze(Object.fromEntries(
    axes.map(axis=>[axis,Object.freeze({min:domain[axis].min,max:domain[axis].max})]))));
  return sharedDomains.get(key);
}
function snapshot(model,sharedDomains) {
  // Scalar strings are already immutable. Keep independent coefficient and
  // fitting copies, without repeatedly cloning equations and identical bounds.
  return {schema:model.schema,id:model.id,equation:model.equation,
    terms:structuredClone(model.terms),domain:snapshotDomain(model.domain,sharedDomains),
    ...(model.fitting?{fitting:structuredClone(model.fitting)}:{}),
    trainingScore:model.metrics.score};
}
function summary(result) {
  return {count:result.count,rmse:result.rmse,maxAbsResidual:result.maxAbsResidual};
}

export function captureExperimentReceipt(previous, next, observations) {
  // Retain each observed row once and every competitive law in its original
  // training order. Never materialize candidate × reading histories here.
  const rows=observations.map(row=>({...row}));
  const domains=new Map();
  return {
    beforeCount:previous.observations.length,
    options:structuredClone(previous.options),
    selectedBeforeId:previous.selected.id,
    models:previous.competitive.map(model=>snapshot(model,domains)),
    selectedAfter:snapshot(next.selected),
    rows,
    before:summary(evaluate(previous.selected,rows)),
    after:summary(evaluate(next.selected,rows)),
  };
}

export function inspectExperimentReceipt(receipt, modelIndex=0) {
  if(!Number.isInteger(modelIndex)||modelIndex<0||modelIndex>=receipt.models.length)
    throw new Error('Choose one of the original pre-update competitive laws.');
  const model=receipt.models[modelIndex];
  const result=evaluate(model,receipt.rows);
  return {...result,model,rows:result.rows.map((row,index)=>({...row,index,
    extrapolation:['command','position','rate'].filter(field=>model.domain &&
      (row[field]<model.domain[field].min||row[field]>model.domain[field].max))}))};
}
