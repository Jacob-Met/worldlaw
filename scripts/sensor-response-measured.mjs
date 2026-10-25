import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readSensorRecording,freezeSensorResponse,receiveSensorResponse,exportSensorResponseInputs,restoreSensorResponseInputs,RESPONSE_CONVENTION} from '../src/science/sensor-response.mjs';
const root=new URL('../',import.meta.url),path=s=>new URL(s,root),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const dir='docs/receipts/sensor-response-56bd8a/';
if(process.argv[2]==='freeze'){
  for(const file of [dir+'training-freeze.json','examples/physical-nad-56bd8a/test-200_006.csv']){let exists=false;try{await access(path(file));exists=true;}catch{}if(exists)throw Error('Historical freeze must not be overwritten or recreated after test acquisition. Use receive to reproduce frozen predictions.');}
  const text=await readFile(path('examples/physical-nad-56bd8a/train-200_001.csv'),'utf8');
  if(sha(text)!=='df28cc85a20a8a44ce69ec49cd3f8ebcd321f09bb9adb1afb23e0234dd5cdb65')throw Error('Original training source changed.');
  const source=await readSensorRecording(text,{joint:4,label:'NAD/train/200_001.csv',convention:RESPONSE_CONVENTION});
  const frozen=freezeSensorResponse(source,[0,.1,.25,.5,.75,1],{terms:['command','rate','coulomb','spring','gravity','quadratic','bias'],maxTerms:4,noiseSigma:.1,ambiguityDelta:6});
  const inputs=exportSensorResponseInputs(frozen),receipt={source:source.sha256,recording:source.label,rows:source.rows.length,joint:4,selectedWidth:frozen.selectedWidth,competitiveWidths:frozen.competitiveWidths,options:frozen.options,candidates:frozen.candidates,work:frozen.work,inputsSha256:sha(inputs),testRecording:'NAD/test/200_006.csv',testState:'unopened and undownloaded at freeze',sourceHashes:{}};
  for(const file of ['src/data.mjs','src/science/sensor-response.mjs','src/science/command-deadzone.mjs','src/science/torque-discovery.mjs','src/science/linear-fit.mjs','src/science/robust-fit.mjs'])receipt.sourceHashes[file]=sha(await readFile(path(file)));
  await writeFile(path(dir+'frozen-training-inputs.json'),inputs);await writeFile(path(dir+'training-freeze.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({mode:'freeze',receiptSha256:sha(await readFile(path(dir+'training-freeze.json'))),rows:source.rows.length,selectedWidth:frozen.selectedWidth,inputsSha256:receipt.inputsSha256}));
}else if(['receive','qualify-current'].includes(process.argv[2])){
  const saved=await readFile(path(dir+'frozen-training-inputs.json'),'utf8'),receipt=JSON.parse(await readFile(path(dir+'training-freeze.json'),'utf8'));
  if(sha(saved)!==receipt.inputsSha256)throw Error('Frozen inputs changed.');
  const actualHashes={};for(const file of Object.keys(receipt.sourceHashes))actualHashes[file]=sha(await readFile(path(file)));
  const historicalFreezeSha256=sha(await readFile(path(dir+'training-freeze.json')));
  const {frozen}=await restoreSensorResponseInputs(saved);
  if(JSON.stringify(frozen.candidates)!==JSON.stringify(receipt.candidates))throw Error('Frozen candidates changed.');
  for(const field of ['selectedWidth','competitiveWidths','options','work'])if(JSON.stringify(frozen[field])!==JSON.stringify(receipt[field]))throw Error('Frozen selection or declaration changed: '+field);
  if(process.argv[2]==='qualify-current'){
    const qualification={historicalFreezeSha256,inputsSha256:receipt.inputsSha256,sourceHashes:actualHashes,exactCandidateReplay:true,scope:'Post-test compatibility receiving only. UTF-8/BOM intake repair and maintained optional cosine addition preserve every frozen training candidate, coefficient and diagnostic. Historical pre-test source receipt is unchanged; no new blind validation is claimed.'};
    await writeFile(path(dir+'current-source-qualification.json'),JSON.stringify(qualification,null,2)+'\n');console.log(JSON.stringify(qualification,null,2));
  }else{
    if(JSON.stringify(actualHashes)!==JSON.stringify(receipt.sourceHashes)){
      const qualification=JSON.parse(await readFile(path(dir+'current-source-qualification.json'),'utf8'));
      if(qualification.historicalFreezeSha256!==historicalFreezeSha256||qualification.inputsSha256!==receipt.inputsSha256||JSON.stringify(qualification.sourceHashes)!==JSON.stringify(actualHashes)||qualification.exactCandidateReplay!==true)throw Error('Current inference source lacks exact historical-candidate compatibility qualification.');
    }

  const csv=await readFile(path('examples/physical-nad-56bd8a/test-200_006.csv'),'utf8'),source=await readSensorRecording(csv,{joint:4,label:'NAD/test/200_006.csv',convention:RESPONSE_CONVENTION});
  if(source.sha256!=='86d49d30d60821021a6da1a884937f49be601999bba47cda00cb9d3ff7234cf9')throw Error('Original receiving source changed.');
  const result=receiveSensorResponse(frozen,source),summary={trainingSha256:frozen.source.sha256,receivingSha256:source.sha256,rows:source.rows.length,selectedWidth:frozen.selectedWidth,competitiveWidths:frozen.competitiveWidths,candidates:result.candidates.map(({rows,...candidate})=>candidate),interpretation:frozen.interpretation};
  await writeFile(path(dir+'measured-receiving.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
  }
}else throw Error('Choose freeze before downloading the separate test recording, then receive.');
