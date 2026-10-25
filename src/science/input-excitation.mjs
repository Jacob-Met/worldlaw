/** Prospective input-rank pilots; no prospective torque or held-out values enter. */
import {predict, TERMS} from './torque-discovery.mjs';
import {linearColumnRank, RANK_TOLERANCE} from './linear-fit.mjs';
import {validateRows, validateOfferedInputs, INPUT_FIELDS} from '../data.mjs';

export const MAX_PILOT_RANK_WORK = 8_000_000;
const known = new Set(TERMS.map(term=>term.id));

export function planInputExcitation(observations, offeredTerms, offeredInputs) {
  const samples = validateRows(observations), inputs = validateOfferedInputs(offeredInputs);
  if (!Array.isArray(offeredTerms) || !offeredTerms.length || offeredTerms.length > TERMS.length
    || new Set(offeredTerms).size !== offeredTerms.length || offeredTerms.some(id=>!known.has(id))) {
    throw new Error('Input excitation requires a nonempty, unique library of maintained scalar terms.');
  }
  const terms = [...offeredTerms];
  const bases = terms.map(id=>({schema:'worldlaw.torque-model/v1',terms:[{id,coefficient:1}]}));
  // The actual maintained evaluator owns feature definitions and units.
  const columns = bases.map(basis=>samples.map(row=>predict(basis,row)));
  const currentRank = linearColumnRank(columns);
  const estimatedRankWork = terms.length ** 2 * (samples.length + inputs.length * (samples.length + 1));
  const base = {schema:'worldlaw.input-excitation/v1', terms, sourceCount:samples.length,
    offeredCount:inputs.length, currentRank, librarySize:terms.length, missingDirections:terms.length-currentRank,
    rankTolerance:RANK_TOLERANCE, estimatedRankWork, maxRankWork:MAX_PILOT_RANK_WORK,
    selected:null, outcomes:[], examinedOffers:0,
    method:'prospective_column_normalized_QR_rank',
    interpretation:'Coordinates only, with the offered finite feature library held fixed. Numerical rank gain is not a torque forecast, a confidence bound, physical identification, or evidence that the law is adequate.',
    numericalQualification:'The maintained floating-point QR threshold is used before and after adding each row. Rank loss or a jump greater than one is retained as a numerical rescaling outcome and cannot qualify a pilot.'};
  if (!inputs.length) return {...base,status:'no_offered_inputs'};
  if (currentRank === terms.length) return {...base,status:'already_excited'};
  if (estimatedRankWork > MAX_PILOT_RANK_WORK) return {...base,status:'work_limit'};
  const domain = Object.fromEntries(INPUT_FIELDS.map(field=>[field,{
    min:Math.min(...samples.map(row=>row[field])),max:Math.max(...samples.map(row=>row[field]))}]));
  const outcomes = inputs.map((input,index)=>{
    const prospectiveRank = linearColumnRank(columns.map((column,j)=>[...column,predict(bases[j],input)]));
    const gain = prospectiveRank-currentRank;
    return {index,input,prospectiveRank,gain,missingDirections:terms.length-prospectiveRank,
      status:gain===1?'rank_gain':gain===0?'no_gain':'numerical_rescaling',
      extrapolation:INPUT_FIELDS.filter(field=>input[field]<domain[field].min || input[field]>domain[field].max)};
  });
  // One new row can add one independent direction. All qualifying gains tie;
  // retain the explicitly offered order instead of inventing a precision score.
  const selected = outcomes.find(row=>row.status==='rank_gain') || null;
  return {...base,domain,outcomes,examinedOffers:outcomes.length,selected,
    status:selected?'proposed':outcomes.some(row=>row.status==='numerical_rescaling')?'numerical_rescaling':'no_rank_gain'};
}
