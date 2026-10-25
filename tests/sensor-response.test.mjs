import test from 'node:test';
import assert from 'node:assert/strict';
import {readSensorRecording,freezeSensorResponse,receiveSensorResponse,sensorTrainingPredictions,sensorResponseDynamics,exportSensorResponseInputs,restoreSensorResponseInputs,RESPONSE_CONVENTION,decodeSensorCSV} from '../src/science/sensor-response.mjs';
import {discover,evaluate,simulate} from '../src/science/torque-discovery.mjs';
import {parseObservationText} from '../src/data.mjs';
const options={terms:['command','spring','rate','bias'],maxTerms:4,noiseSigma:.001};
const declaration=(label='training.csv',joint=4)=>({label,joint,convention:RESPONSE_CONVENTION});
function csv(count=60,phase=0,offset=0){return 'timestamp,pos4,vel4,tau_d4,tau4,unused\n'+Array.from({length:count},(_,i)=>{const u=2.4*Math.sin(i*1.371+phase),p=.8*Math.cos(i*2.139+phase),v=1.5*Math.sin(i*.917+phase),effective=u>.419?u-.419:u<-.419?u+.419:0;return [i*.016,p,v,u,1.43*effective-2.11*p-.173*v+offset,'unmeasured'].join(',');}).join('\n')+'\n';}
test('original sensor role and every row survive conditional frozen receiving',async()=>{
  const source=await readSensorRecording(csv(),declaration()),frozen=freezeSensorResponse(source,[0,.2,.419,.8],options);
  assert.equal(frozen.selectedWidth,.419);assert.equal(source.rows.length,60);assert.equal(source.rows[0].sourceRow,2);assert.equal(source.rows.at(-1).sourceRow,61);
  const held=await readSensorRecording(csv(47,.618),declaration('separate.csv')),got=receiveSensorResponse(frozen,held);
  assert.ok(got.candidates.find(c=>c.width===.419).rmse<1e-12);assert.ok(got.candidates.find(c=>c.width===0).rmse>.02);
  assert.deepEqual(got.candidates[0].rows.map(r=>r.response),held.rows.map(r=>r.response));assert.equal(frozen.role,'link-side-torque-sensor');
});
test('private adaptation has exact ordinary zero parity without publishing net models',async()=>{
  const source=await readSensorRecording(csv(),declaration()),frozen=freezeSensorResponse(source,[0],options);
  const internal=source.rows.map(r=>({command:r.command,position:r.position,rate:r.rate,jointTorque:r.response})),ordinary=discover(internal,options);
  assert.deepEqual(frozen.candidates[0].terms,ordinary.selected.terms);assert.equal(frozen.candidates[0].metrics.rmse,evaluate(ordinary.selected,internal).rmse);
  assert.throws(()=>simulate(frozen,{position:0,rate:0}),/Invalid executable/);assert.throws(()=>simulate(frozen.candidates[0],{position:0,rate:0}),/Invalid executable/);assert.throws(sensorResponseDynamics,/cannot be adopted/);
  assert.throws(()=>parseObservationText(exportSensorResponseInputs(frozen)),/Unsupported observation schema/);
});
test('source roles, timestamp order, joint identity and independent recording refuse explicitly',async()=>{
  for(const change of [{convention:'net-torque'},{joint:0},{joint:4.5},{label:''}])await assert.rejects(readSensorRecording(csv(),{...declaration(),...change}));
  await assert.rejects(readSensorRecording(csv().replace('0.016,','0,'),declaration()),/timestamps/);
  await assert.rejects(readSensorRecording(csv().replace('tau4,','tau_ext4,'),declaration()),/requires/);
  const source=await readSensorRecording(csv(),declaration()),frozen=freezeSensorResponse(source,[0],options);
  assert.throws(()=>freezeSensorResponse({...source},[0],options),/admitted/);
  assert.throws(()=>receiveSensorResponse(frozen,source),/separately/);
  const same=await readSensorRecording(csv(),declaration('renamed.csv'));assert.throws(()=>receiveSensorResponse(frozen,same),/separately/);
  const wrong=await readSensorRecording(csv().replace('pos4,vel4,tau_d4,tau4','pos5,vel5,tau_d5,tau5'),declaration('other.csv',5));assert.throws(()=>receiveSensorResponse(frozen,wrong),/joint/);
});
test('receiving mutation changes errors but cannot mutate frozen selection or coefficients',async()=>{
  const frozen=freezeSensorResponse(await readSensorRecording(csv(),declaration()),[0,.419],options),before=JSON.stringify(frozen);
  const clean=receiveSensorResponse(frozen,await readSensorRecording(csv(47,.618),declaration('clean.csv'))),wrong=receiveSensorResponse(frozen,await readSensorRecording(csv(47,.618,10),declaration('wrong.csv')));
  assert.ok(clean.candidates[1].rmse<1e-12);assert.ok(wrong.candidates[1].rmse>9.99);assert.equal(JSON.stringify(frozen),before);
  assert.throws(()=>{frozen.candidates[0].terms[0].coefficient=0;});assert.throws(()=>{frozen.source.rows[0].response=0;});
});
test('original-only replay recomputes frozen fit and errors; forged results and wrong schemas refuse',async()=>{
  const frozen=freezeSensorResponse(await readSensorRecording(csv(),declaration()),[0,.419],options),held=await readSensorRecording(csv(47,.618),declaration('separate.csv'));
  const text=exportSensorResponseInputs(frozen,held),input=JSON.parse(text),restored=await restoreSensorResponseInputs(text);
  assert.equal(input.training.csv,csv());assert.equal(input.receiving.csv,csv(47,.618));assert.deepEqual(restored.frozen,frozen);assert.deepEqual(restored.result,receiveSensorResponse(frozen,held));
  await assert.rejects(restoreSensorResponseInputs(JSON.stringify({...input,selectedWidth:0})),/only original/);
  await assert.rejects(restoreSensorResponseInputs(JSON.stringify({...input,schema:'worldlaw.observations/v1'})),/Unsupported/);
});
test('whole-family budget refuses atomically and exact bound replays',async()=>{
  const source=await readSensorRecording(csv(),declaration()),frozen=freezeSensorResponse(source,[0,.419],options);
  assert.throws(()=>freezeSensorResponse(source,[0,.419],options,{maxWork:frozen.work.reserved-1}),/work limit/);
  assert.deepEqual(freezeSensorResponse(source,[0,.419],options,{maxWork:frozen.work.reserved}).candidates,frozen.candidates);
  assert.equal(sensorTrainingPredictions(frozen)[1].rows.length,60);
});
test('escaping cannot export a notebook exceeding its own portable receiving limit',async()=>{
  const padding='\\'.repeat(1_260_000),a=csv(8).replace('unused',padding),b=csv(8,.6).replace('unused',padding);
  const source=await readSensorRecording(a,declaration()),held=await readSensorRecording(b,declaration('separate.csv')),frozen=freezeSensorResponse(source,[0],options),before=JSON.stringify(frozen);
  assert.throws(()=>exportSensorResponseInputs(frozen,held),/portable notebook limit/);assert.equal(JSON.stringify(frozen),before);
  assert.equal((await restoreSensorResponseInputs(exportSensorResponseInputs(frozen))).frozen.source.sha256,source.sha256);
});

test('UTF-8 BOM byte identity survives intake/replay and malformed encoding refuses',async()=>{
  const raw=new TextEncoder().encode('\uFEFF'+csv()),text=decodeSensorCSV(raw),source=await readSensorRecording(text,declaration());
  assert.equal(text.charCodeAt(0),0xfeff);assert.deepEqual(new TextEncoder().encode(text),raw);
  const expected=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),x=>x.toString(16).padStart(2,'0')).join('');assert.equal(source.sha256,expected);
  const frozen=freezeSensorResponse(source,[0],options),saved=exportSensorResponseInputs(frozen);assert.equal(JSON.parse(saved).training.csv,text);assert.equal((await restoreSensorResponseInputs(saved)).frozen.source.sha256,expected);
  assert.throws(()=>decodeSensorCSV(Uint8Array.of(0xc3,0x28)),/encoded data|encoding/i);
  await assert.rejects(readSensorRecording(csv()+'\ud800',declaration()),/well-formed/);
  const malformed=JSON.parse(saved);malformed.training.csv+='\udfff';await assert.rejects(restoreSensorResponseInputs(JSON.stringify(malformed)),/well-formed/);
});
