export const OBSERVATION_SCHEMA = 'worldlaw.observations/v1';
export const UNITS = Object.freeze({command:'N·m',position:'rad',rate:'rad/s',jointTorque:'N·m'});
export const FIELDS = Object.keys(UNITS);
export const MAX_ROWS = 4096;
export const MAX_TEXT_LENGTH = 2_000_000;
const decimal = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function fail(message) { throw new Error(message); }
export function validateRows(rows, {allowEmpty=false}={}) {
  if (!Array.isArray(rows) || (!allowEmpty && rows.length < 8) || rows.length > MAX_ROWS) fail(`Supply ${allowEmpty ? '0' : '8'}–${MAX_ROWS} complete observation rows.`);
  return Array.from(rows, (row, i) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`Row ${i+1} must contain the four observation fields.`);
    const copy = {};
    for (const field of FIELDS) {
      const value = row[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e6) fail(`Row ${i+1}: ${field} must be a finite number between −1,000,000 and 1,000,000 (${UNITS[field]}).`);
      copy[field] = value;
    }
    return copy;
  });
}
export function validateDataset(input, filename='Imported observations') {
  if (!input || typeof input !== 'object') fail('Expected an observation object or array.');
  if (input.schema && input.schema !== OBSERVATION_SCHEMA) fail(`Unsupported observation schema: ${input.schema}.`);
  for(const units of [input.units,input.source?.units]) {
    if (units !== undefined && units !== null && FIELDS.some(key => units[key] !== UNITS[key])) fail('Unit declarations must be command/jointTorque N·m, position rad, and rate rad/s. Convert the data before importing.');
  }
  const observations = validateRows(Array.isArray(input) ? input : input.observations || input.samples);
  const heldOut = validateRows(input.heldOut || [], {allowEmpty:true});
  const label = String(input.source?.label || input.label || filename).trim().slice(0,240) || 'Imported observations';
  const suppliedSource=input.source&&typeof input.source==='object'?input.source:{};
  const additional=suppliedSource.metadata ?? Object.fromEntries(Object.entries(suppliedSource).filter(([key])=>!['label','kind','units','declaredKind'].includes(key)));
  const metadataText=JSON.stringify(additional);
  if(metadataText.length>250_000) fail('Source metadata must be smaller than 250 KB.');
  const metadata=JSON.parse(metadataText);
  return {schema:OBSERVATION_SCHEMA,source:{label,kind:'user-supplied',declaredKind:String(suppliedSource.declaredKind||suppliedSource.kind||'unspecified').slice(0,100),units:{...UNITS},metadata},observations,heldOut};
}
export function csvRecords(text) {
  const rows=[]; let row=[], cell='', quoted=false, closed=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (quoted) {
      if (c === '"' && text[i+1] === '"') {cell+='"'; i++;}
      else if (c === '"') {quoted=false; closed=true;}
      else cell+=c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell=''; closed=false;
      if (c !== ',') {if (c === '\r' && text[i+1] === '\n') i++; if (row.some(x=>x.trim())) rows.push(row); row=[];}
    } else if (c === '"' && cell.length === 0 && !closed) quoted=true;
    else if (closed && !/\s/.test(c)) fail('Invalid CSV: text after a quoted field.');
    else cell+=c;
  }
  if (quoted) fail('Invalid CSV: an open quoted field has no closing quote.');
  row.push(cell); if(row.some(x=>x.trim())) rows.push(row);
  return rows;
}
export function parseObservationText(text, filename='observations.csv') {
  if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH) fail('Observation files must be text smaller than 2 MB.');
  text=text.replace(/^\uFEFF/, '').trim();
  if (!text) fail('The observation file is empty.');
  if (/^[\[{]/.test(text)) {
    let json;
    try { json=JSON.parse(text); } catch { fail('The JSON file could not be read. Check its syntax.'); }
    return validateDataset(json,filename);
  }
  const records=csvRecords(text); const headers=records.shift()?.map(x=>x.trim());
  if (!headers || new Set(headers).size !== headers.length || FIELDS.some(f=>!headers.includes(f))) fail(`CSV needs unique headers: ${FIELDS.join(',')}. Extra metadata columns are allowed.`);
  const observations=records.map((record,i)=> {
    if(record.length !== headers.length) fail(`CSV row ${i+2} has ${record.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(FIELDS.map(field=> {
      const cell=record[headers.indexOf(field)].trim();
      if(!decimal.test(cell)) fail(`CSV row ${i+2}: ${field} is not a decimal number.`);
      return [field, Number(cell)];
    }));
  });
  return validateDataset({observations},filename);
}
export function observationsCSV(rows) { return FIELDS.join(',')+'\n'+rows.map(row=>FIELDS.map(f=>row[f]).join(',')).join('\n')+'\n'; }
export function candidateGrid(rows) {
  const axes=['command','position','rate'].map(field=> {
    const values=rows.map(r=>r[field]); const lo=Math.min(...values), hi=Math.max(...values);
    return lo === hi ? [lo] : Array.from({length:5},(_,i)=>lo+(hi-lo)*i/4);
  });
  const result=[];
  for(const command of axes[0]) for(const position of axes[1]) for(const rate of axes[2]) result.push({command,position,rate});
  return result;
}
