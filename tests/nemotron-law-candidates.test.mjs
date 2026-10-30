import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createProductServer} from '../server.mjs';
import {summarizeTraining,requestLawCandidates,parseLawCandidates,buildLawMessages,scoreLawCandidates} from '../src/science/nemotron-law-candidates.mjs';
import {evaluate,discover} from '../src/science/torque-discovery.mjs';

function course(n,phase,law) {
  return Array.from({length:n},(_,i)=>{
    const position=1.8*Math.sin((i+phase)*2.17),rate=1.3*Math.cos((i+phase)*1.43),command=Math.sin((i+phase)*.77);
    return {position,rate,command,jointTorque:.8*command-.3*rate-1.2*position+law(position,rate,command)};
  });
}
const cubic=p=>-.65*p**3;

test('only maintained catalog term sets are accepted; anything else is reported, never executed',()=>{
  const reply='Sure:\n```json\n{"candidates":[{"terms":["cubic"],"rationale":"stiffening"},{"terms":["cubic","cubic"],"rationale":"dup"},{"terms":["eval_me"],"rationale":"bad"},{"terms":["cosine","rate_squared"],"rationale":"ok"},{"terms":["cubic"],"rationale":"again"}]}\n```';
  const parsed=parseLawCandidates(reply);
  assert.deepEqual(parsed.candidates.map(c=>c.terms),[['cubic'],['cosine','rate_squared']]);
  assert.equal(parsed.rejected.length,2);
  assert.throws(()=>parseLawCandidates('no json here'),e=>e.code==='model_reply');
  assert.throws(()=>parseLawCandidates('{"candidates":"nope"}'),e=>e.code==='model_reply');
});

test('the prompt carries ranges and a bounded sample, not the full notebook or any key',()=>{
  const rows=course(500,.2,cubic);
  const summary=summarizeTraining(rows);
  assert.equal(summary.rowCount,500);
  assert.ok(summary.sample.length<=40);
  const text=JSON.stringify(buildLawMessages(summary,['command','rate']));
  assert.ok(!text.includes('Bearer'));
  assert.ok(text.includes('cubic'));
});

test('adapter sends bearer auth to Token Factory and reads message.content',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});return new Response(JSON.stringify({choices:[{message:{content:'{"candidates":[{"terms":["cubic"],"rationale":"x"}]}'}}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  const result=await requestLawCandidates({summary:summarizeTraining(course(40,0,cubic)),baseTerms:['command'],apiKey:'test-key-not-real',fetchImpl});
  assert.equal(calls[0].url,'https://api.tokenfactory.nebius.com/v1/chat/completions');
  assert.equal(calls[0].init.headers.Authorization,'Bearer test-key-not-real');
  assert.equal(calls[0].body.model,'nvidia/nemotron-3-super-120b-a12b');
  assert.ok(calls[0].body.max_tokens>=1500);
  assert.deepEqual(result.candidates.map(c=>c.terms),[['cubic']]);
  await assert.rejects(requestLawCandidates({summary:{},baseTerms:[],apiKey:'',fetchImpl}),e=>e.code==='no_key');
});

test('the app fits each proposed term set itself and reports held-out error as a check',()=>{
  const training=course(97,0,cubic),held=course(61,.731,cubic);
  const baseline=discover(training,{}).selected;
  const exact=['command','rate','spring','cubic'];
  const scored=scoreLawCandidates(training,held,[{terms:['command','rate','spring','cosine'],rationale:'b'},{terms:exact,rationale:'a'}],evaluate(baseline,held).rmse,{});
  const first=scored[0];
  assert.deepEqual(first.terms,exact);
  assert.equal(first.status,'fitted');assert.equal(first.id,exact.join('+'));
  assert.ok(first.heldOutRmse<1e-10);
  assert.ok(first.heldOutDeltaVsSelected<0);
  assert.equal(scored[1].status,'fitted');
});

test('server refuses without a key and rejects wrong media types before any upstream call',async()=>{
  const saved=process.env.NEBIUS_API_KEY;delete process.env.NEBIUS_API_KEY;
  const server=createProductServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const {port}=server.address();
  try{
    const post=(body,type='application/json')=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:'/api/nemotron/law-candidates',method:'POST',headers:{'Content-Type':type,Host:`127.0.0.1:${port}`}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({status:res.statusCode,body:d}));});req.on('error',reject);req.end(body);});
    const noKey=await post(JSON.stringify({observations:course(20,0,cubic),baseTerms:['command']}));
    assert.equal(noKey.status,503);assert.equal(JSON.parse(noKey.body).code,'no_key');
    const wrongType=await post('{}','text/plain');
    assert.equal(wrongType.status,415);
    const get=await new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port,path:'/api/nemotron/law-candidates',headers:{Host:`127.0.0.1:${port}`}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject));
    assert.equal(get,405);
  }finally{
    if(saved!==undefined)process.env.NEBIUS_API_KEY=saved;
    await new Promise(r=>server.close(r));
  }
});
