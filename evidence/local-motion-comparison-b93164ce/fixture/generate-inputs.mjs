#!/usr/bin/env node
// Maintained authored recipe: worldlaw@553c0cc5a8cd7ea84d1e197a30fb1bdcdc6445c9
// tests/competitive-library.test.mjs Gitblob8b7f7f3f9debeeef10caac270a859ba46e7c3ef8.
// No manual models/history; this generator invokes no comparison CLI.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const args=process.argv.slice(2);
assert.equal(args.length,4);assert.equal(args[0],'--source-root');assert.equal(args[2],'--output-dir');
const root=resolve(args[1]),out=resolve(args[3]);assert.notEqual(root,out);
const pins=[];
for(const [path,gitBlob] of [['src/session.mjs','a6c689803ff7a518e095bc6c414eea1e964ec974'],['src/science/library-proposal.mjs','d74813f24186fc525bbf8949678169a0f31ca386']]){
 const b=await readFile(join(root,path));assert.equal(blob(b),gitBlob,path);
 pins.push({path,gitBlob,bytes:b.length,sha256:hash(b)});
}
await mkdir(out,{recursive:false}); // Exclusive destination; retain partial outputs on failure.
const {createSession,refitSession,sessionPlan,appendMeasurements,exportSession,restoreSession}=await import(pathToFileURL(join(root,'src/session.mjs')).href);
const {proposeScalarLibrary}=await import(pathToFileURL(join(root,'src/science/library-proposal.mjs')).href);
const rows=Array.from({length:97},(_,i)=>{const position=1.8*Math.sin((i+.23)*2.17),rate=1.3*Math.cos((i+.23)*1.43),command=position**2;return {position,rate,command,jointTorque:.8*command-.3*rate-1.2*position-.65*position**3};});
const offers=[{position:1.3,command:1.69,rate:.2},{position:1.3,command:0,rate:.2},{position:-1.3,command:0,rate:.2}];
const source={schema:'worldlaw.observations/v2',observations:rows,offeredInputs:offers};
const state=createSession(source,{noiseSigma:.0001}),proposal=proposeScalarLibrary(rows,state.discovery.options);
assert.deepEqual(proposal.selectedAddedTerms,['command_position']);assert.deepEqual(proposal.addedTerms,['command_position','cubic']);
const revised=refitSession(state,{includeCommandPosition:proposal.proposedTerms.includes('command_position'),additionalTerms:proposal.proposedTerms.filter(id=>['cubic','cosine','rate_squared'].includes(id))});
assert.equal(revised.discovery.competitive.length,2);
const plan=sessionPlan(revised);assert.equal(plan.status,'proposed');assert.deepEqual(plan.selected.input,offers[1]);
const current=exportSession(revised),p=plan.selected.input;
const next=appendMeasurements(revised,[{...p,jointTorque:.8*p.command-.3*p.rate-1.2*p.position-.65*p.position**3}]);
assert.equal(next.discovery.selected.id,'command+rate+spring+cubic');assert.equal(next.discovery.competitive.length,1);
assert.equal(next.events[0].kind,'options');assert.equal(next.events[1].kind,'measurement');
assert.equal(next.history[2].experiment.models.length,2);assert.equal(next.history[0].experiment,undefined);assert.equal(next.history[1].experiment,undefined);
const historical=exportSession(next),replay=restoreSession(historical);
assert.equal(replay.discovery.competitive.length,1);assert.deepEqual(replay.history[2].experiment.models,next.history[2].experiment.models);
const files=[];
for(const [name,text] of [['current-two-laws.json',current],['after-measurement.json',historical]]){
 const b=Buffer.from(text);await writeFile(join(out,name),b,{flag:'wx'});files.push({path:name,bytes:b.length,sha256:hash(b)});
}
for(const pin of pins)assert.equal(hash(await readFile(join(root,pin.path))),pin.sha256);
const own=await readFile(fileURLToPath(import.meta.url));
const manifest={schema:'worldlaw.comparison-inputs/v1',sourceCommit:'553c0cc5a8cd7ea84d1e197a30fb1bdcdc6445c9',recipeGitBlob:'8b7f7f3f9debeeef10caac270a859ba46e7c3ef8',generatorSha256:hash(own),sourceRoot:root,sourcePins:pins,files,initialObservations:97,afterObservations:98,currentCompetitiveCount:2,afterCurrentCompetitiveCount:1,historicalCompetitiveCount:2,eventArrayIndex:1,historyIndex:2,negativeHistoryIndex:0,sourcePinsUnchanged:true,cliExecuted:false,interpretation:'Maintained authored synthetic control, not physical acquisition.'};
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify(manifest)+'\n');
