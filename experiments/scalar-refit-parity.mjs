import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {discover,refitDiscovery,DEFAULT_TERMS} from '../src/science/torque-discovery.mjs';
const root=process.argv.find(value=>value.startsWith('--baseline-root='))?.slice(16);
if(!root)throw new Error('Supply --baseline-root=/absolute/path/to/retained/source');
const {discover:baseline}=await import(pathToFileURL(resolve(root,'src/science/torque-discovery.mjs')));
let checked=0;
for(let seed=1;seed<=12;seed++) {
  const rows=Array.from({length:8+seed*7},(_,i)=>{
    const command=Math.sin((i+seed)*1.39),position=Math.sin(i*.71+seed)*2,rate=Math.cos(i*1.17+seed)*3;
    return {command,position,rate,jointTorque:seed%3===0?0:1.1*command-.3*rate-.7*position+.2*Math.sin(position)+.04*Math.cos(i*seed)};
  });
  for(const options of [{},{noiseSigma:1e-8},{noiseSigma:1000,ambiguityDelta:100},
    {terms:[...DEFAULT_TERMS].reverse(),noiseSigma:.05},
    {terms:[...DEFAULT_TERMS,'command_position','cubic'],maxTerms:5}]) {
    const actual=discover(rows,options);
    assert.equal(JSON.stringify(actual),JSON.stringify(baseline(rows,options)));
    for(const noiseSigma of [1e-7,.05,1000])
      assert.equal(JSON.stringify(refitDiscovery(actual,{...options,noiseSigma})),JSON.stringify(baseline(rows,{...options,noiseSigma})));
    checked+=4;
  }
}
console.log(JSON.stringify({independentBaselineCompleteResults:checked,allExact:true}));
