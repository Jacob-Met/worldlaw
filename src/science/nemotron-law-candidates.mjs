// NVIDIA Nemotron on Nebius Token Factory proposes candidate law structures.
// The model only names terms from the maintained feature library. The app then
// fits every proposed term set itself, on the original training rows, and reports
// held-out error as a check. The model never fits, ranks or edits any number.
import {TERMS, discover, evaluate, DiscoveryError} from './torque-discovery.mjs';

export const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1';
export const NEMOTRON_MODEL = 'nvidia/nemotron-3-super-120b-a12b';
export const MAX_PROPOSED_CANDIDATES = 6;
export const MAX_CANDIDATE_TERMS = 4;
export const MAX_PROMPT_ROWS = 40;
const TERM_IDS = TERMS.map(term => term.id);
const FIELDS = ['command', 'position', 'rate', 'jointTorque'];

// Compact description of the original training rows for the prompt. Only
// ranges and an evenly spaced sample leave the browser; the full set stays local.
export function summarizeTraining(observations) {
  if (!Array.isArray(observations) || observations.length < 8) throw new DiscoveryError('Nemotron proposals need at least 8 original training rows.');
  const ranges = Object.fromEntries(FIELDS.map(key => {
    const values = observations.map(row => row[key]);
    return [key, {min: Math.min(...values), max: Math.max(...values)}];
  }));
  const step = Math.max(1, Math.floor(observations.length / MAX_PROMPT_ROWS));
  const sample = [];
  for (let i = 0; i < observations.length && sample.length < MAX_PROMPT_ROWS; i += step) {
    const row = observations[i];
    sample.push(Object.fromEntries(FIELDS.map(key => [key, Number(row[key].toPrecision(4))])));
  }
  return {rowCount: observations.length, ranges, sample};
}

export function buildLawMessages(summary, baseTerms) {
  const catalog = TERMS.map(term => `- ${term.id}: ${term.label} (coefficient unit ${term.coefficientUnit})`).join('\n');
  const system = [
    'You propose candidate explanations for the scalar joint torque of a mechanism.',
    'Use only feature IDs from the catalog. A candidate is a set of 1 to 4 distinct IDs.',
    'Propose sets that could explain structure the baseline terms leave unexplained, and say why in one short sentence.',
    `Return at most ${MAX_PROPOSED_CANDIDATES} candidates. Reply with JSON only, in the form {"candidates":[{"terms":["id",...],"rationale":"..."}]}.`,
    'Do not give coefficients, predictions, or claims about held-out data. The application fits and scores every candidate itself.',
  ].join(' ');
  const user = JSON.stringify({
    feature_catalog: catalog,
    baseline_terms: baseTerms,
    training_rows: summary,
  });
  return [{role: 'system', content: system}, {role: 'user', content: `Feature catalog:\n${catalog}\n\nData (JSON):\n${user}`}];
}

// Accepts only the maintained catalog. Anything else is reported, never executed.
export function parseLawCandidates(text) {
  const stripped = String(text ?? '').replace(/```(?:json)?/gi, '');
  const start = stripped.indexOf('{'), end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) throw new DiscoveryError('Nemotron did not return a JSON object.', 'model_reply');
  let parsed;
  try { parsed = JSON.parse(stripped.slice(start, end + 1)); }
  catch { throw new DiscoveryError('Nemotron returned malformed JSON.', 'model_reply'); }
  if (!Array.isArray(parsed?.candidates)) throw new DiscoveryError('Nemotron reply has no candidates array.', 'model_reply');
  const accepted = [], rejected = [], seen = new Set();
  for (const item of parsed.candidates.slice(0, MAX_PROPOSED_CANDIDATES)) {
    const terms = Array.isArray(item?.terms) ? item.terms : null;
    const rationale = typeof item?.rationale === 'string' ? item.rationale.slice(0, 300) : '';
    if (!terms || terms.length < 1 || terms.length > MAX_CANDIDATE_TERMS || new Set(terms).size !== terms.length || !terms.every(id => TERM_IDS.includes(id))) {
      rejected.push({terms: terms ?? null, reason: 'Not a set of 1 to 4 distinct catalog IDs.'});
      continue;
    }
    const key = [...terms].sort().join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push({terms: [...terms], rationale});
  }
  return {candidates: accepted, rejected};
}

// Server-side only. The key is passed in by the caller and is never returned or logged.
export async function requestLawCandidates({summary, baseTerms, apiKey, model = NEMOTRON_MODEL, fetchImpl = fetch, baseUrl = NEBIUS_BASE_URL}) {
  if (!apiKey) throw new DiscoveryError('NEBIUS_API_KEY is not set on the server.', 'no_key');
  const started = Date.now();
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`},
    body: JSON.stringify({model, messages: buildLawMessages(summary, baseTerms), max_tokens: 2500, temperature: 0.2}),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new DiscoveryError(`Token Factory returned HTTP ${response.status}.`, 'upstream');
  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content;
  const parsed = parseLawCandidates(text);
  return {model, latencyMs: Date.now() - started, ...parsed, usage: body.usage ?? null};
}

// App-side scoring. Each proposal is fitted exactly as written on training rows.
// Held-out rows only compute the displayed check error.
export function scoreLawCandidates(training, heldOut, candidates, selectedHeldOutRmse, requestedOptions = {}) {
  return candidates.map(candidate => {
    const id = candidate.terms.join('+');
    let model;
    try {
      model = discover(training, {...requestedOptions, terms: candidate.terms, maxTerms: candidate.terms.length}).candidates.find(item => item.id === id);
    } catch (error) {
      return {...candidate, status: 'not_estimable', reason: error.message};
    }
    if (!model) return {...candidate, status: 'not_estimable'};
    const check = heldOut?.length ? evaluate(model, heldOut) : null;
    return {
      ...candidate, status: 'fitted', id, equation: model.equation,
      trainingRmse: model.metrics.rmse, heldOutRmse: check?.rmse ?? null,
      heldOutDeltaVsSelected: check && Number.isFinite(selectedHeldOutRmse) ? check.rmse - selectedHeldOutRmse : null,
    };
  }).sort((a, b) => (a.trainingRmse ?? Infinity) - (b.trainingRmse ?? Infinity));
}
