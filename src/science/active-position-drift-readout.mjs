/** Readout documents for the active experiment notebook and CLI. */
import {openAllHorizonPositionDrift} from './persistent-position-drift-all-horizon.mjs';

import {isGuidedPlan,CASE_TWELVE_REQUEST,GUIDED_INPUT,GUIDED_RESULT} from './active-guided-drift.mjs';

export const ACTIVE_DRIFT_PLAN='worldlaw.position-drift-all-horizon-policy/v1';
export const ACTIVE_DRIFT_CHECKPOINTS='worldlaw.active-position-drift-checkpoints/v1';
export const ACTIVE_DRIFT_TRACE='worldlaw.active-position-drift-gauge-input/v1';
const need=(ok,message)=>{if(!ok)throw Error(message);};

// JSON.parse rounds a number before a schema validator can inspect it.
// On exact drift documents, a bare number must be an actual safe integer
// token. Strings may contain arbitrary digits and keep their original bytes.
export function parseActiveOriginalJSON(text){
  const data=JSON.parse(text);
  const schema=data?.schema;
  if(schema!=='worldlaw.position-drift-rate-catalog/v1' && schema!==ACTIVE_DRIFT_PLAN &&
     schema!==ACTIVE_DRIFT_CHECKPOINTS && schema!==ACTIVE_DRIFT_TRACE && schema!==CASE_TWELVE_REQUEST &&
     schema!==GUIDED_INPUT && schema!==GUIDED_RESULT && !isGuidedPlan(data) && !isGuidedPlan(data?.plan) &&
     schema!=='worldlaw.active-position-drift-checkpoint-result/v1' &&
     schema!=='worldlaw.active-position-drift-gauge-result/v1' && data?.plan?.schema!==ACTIVE_DRIFT_PLAN)return data;
  for(const [token] of text.matchAll(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)){
    if(token[0]!=='"')need(/^-?\d+$/.test(token) && Number.isSafeInteger(Number(token)),
      'A bare position/drift number must be a safe integer token. Use a quoted exact integer or rational string.');
  }
  return data;
}

function fields(value,expected){
  need(value && typeof value==='object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',')===[...expected].sort().join(','),
    'The position/drift input has missing or unexpected fields.');
}

export function evaluateActiveDriftInput(source,policy,supplied){
  const session=openAllHorizonPositionDrift(source,policy);
  const bound=['schema','sourceSHA256','planSHA256'];
  if(policy.status==='indistinguishable'){
    fields(supplied,[...bound,'laws','origin','runs']);
    need(supplied.schema===ACTIVE_DRIFT_TRACE && Array.isArray(supplied.laws) && supplied.laws.length===2,
      'Choose a gauge trace for two laws from this frozen catalog.');
    need(Array.isArray(supplied.origin) && supplied.origin.length===2,'Supply initial position and drift.');
    const trace=session.trace(...supplied.laws,supplied.runs,supplied.origin);
    return {schema:'worldlaw.active-position-drift-gauge-result/v1',status:'equal_gauge_trajectories',
      acquisition:'synthetic',trace};
  }
  fields(supplied,[...bound,'source','acquisition','readings']);
  need(supplied.schema===ACTIVE_DRIFT_CHECKPOINTS && ['synthetic','supplied'].includes(supplied.acquisition) &&
    typeof supplied.source==='string' && supplied.source.trim().length>=12 && supplied.source.length<=2048,
    'Give the checkpoint readings a source description and acquisition kind.');
  const rows=supplied.readings;
  need(Array.isArray(rows) && rows.length>0 && rows.length<=policy.readAt.length,
    'Supply a consecutive checkpoint prefix beginning at tick 0.');
  for(const [i,row] of rows.entries()){
    fields(row,['tick','value']);
    need(row.tick===policy.readAt[i],'Checkpoint ticks must be the ordered decimal strings from the frozen schedule.');
  }
  const checked=session.observe(rows.map(r=>r.value));
  const compatible=checked.surviving.map(r=>r.law);
  return {schema:'worldlaw.active-position-drift-checkpoint-result/v1',status:compatible.length===0?
    'all_hypotheses_falsified':compatible.length===1?'one_hypothesis_consistent':'multiple_hypotheses_consistent',
    acquisition:supplied.acquisition,readoutSource:supplied.source,consistentHypothesisIds:compatible,checked};
}
