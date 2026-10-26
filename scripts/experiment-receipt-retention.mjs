import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]??'.');
const load=path=>import(pathToFileURL(resolve(root,path)).href);
const {discover,TERMS}=await load('src/science/torque-discovery.mjs');
const {captureExperimentReceipt}=await load('src/science/experiment-receipts.mjs');
const rows=Array.from({length:64},(_,i)=>({command:Math.sin(i*1.171),
  position:2*Math.sin(i*.317),rate:2*Math.cos(i*.793),jointTorque:0}));
const started=performance.now();
const discovery=discover(rows,{terms:TERMS.map(term=>term.id),maxTerms:7,
  noiseSigma:1000,ambiguityDelta:100});
const discoveryMs=performance.now()-started;
globalThis.gc?.();
const baseline=process.memoryUsage(),retained=[];
const snapshotsStarted=performance.now();
for(let i=0;i<128;i++)retained.push(captureExperimentReceipt(discovery,discovery,[rows[0]]));
const snapshotMs=performance.now()-snapshotsStarted;
globalThis.gc?.();
const after=process.memoryUsage();
console.log(JSON.stringify({kind:'snapshot-retention-probe',
  qualification:'Repeated compact capture of one complete unchanged fitted ensemble. This measures retained snapshot storage, not full acquisition, session replay, browser performance or generated-library support.',
  candidateCount:discovery.candidates.length,competitiveCount:discovery.competitive.length,
  receiptCount:retained.length,retainedModelSnapshots:retained.reduce((sum,r)=>sum+r.models.length,0),
  observedRowsPerReceipt:retained[0].rows.length,
  firstReceiptUtf8Bytes:Buffer.byteLength(JSON.stringify(retained[0])),
  discoveryMs,snapshotMs,gcAvailable:typeof globalThis.gc==='function',
  baseline,after,heapUsedDelta:after.heapUsed-baseline.heapUsed,rssDelta:after.rss-baseline.rss,
},null,2));
