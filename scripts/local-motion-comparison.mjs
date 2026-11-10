#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {restoreSession,MAX_SESSION_FILE_BYTES} from '../src/session.mjs';
import {outputIntervalCount} from '../src/science/output-grid.mjs';
import {compareLocalMotion,sampleLocalMotionComparison} from '../src/science/local-motion-comparison.mjs';

const help=`Compare local responses of every original competitive law from a saved WORLDLAW notebook.
Usage: node scripts/local-motion-comparison.mjs --notebook notebook.json
       --position 0 --rate 0 --inertia 1 --command 0
       [--duration 4] [--interval 0.01] [--max-trials 50000]
       [--sample-index 0] [--history-index 1]

Without --history-index, compare the current competitive set reconstructed from inputs.
--history-index selects the exact earlier experiment receipt at that maintained history index.
Every original law retains its own coefficients, trajectory and numerical refusals.
--sample-index selects an exact returned common sample, never interpolated time.
Position is rad, rate rad/s, inertia kg*m^2 and fixed command N*m.
Frozen local modes do not establish finite-time growth, stability or physical truth.
The notebook is never written. JSON goes to stdout, malformed input to stderr.
Exit0: complete calculation (may contain nonsmooth/unresolved sample rows).
Exit2: JSON retains incomplete/refused laws. Exit1: invalid input or unavailable sample.
`;
try {
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--help')process.stdout.write(help);
  else {
    const allowed=new Set(['--notebook','--position','--rate','--inertia','--command','--duration','--interval','--max-trials','--sample-index','--history-index']);
    const values={};
    for(let i=0;i<args.length;i+=2){
      if(!allowed.has(args[i])||i+1>=args.length||Object.hasOwn(values,args[i]))throw new Error('Unknown, duplicate or incomplete argument. Use --help.');
      values[args[i]]=args[i+1];
    }
    if(!values['--notebook']||['--position','--rate','--inertia','--command'].some(flag=>values[flag]===undefined))throw new Error('Supply notebook, position, rate, inertia and command.');
    const numeric=(flag,fallback)=>{
      const text=values[flag];if(text===undefined)return fallback;
      if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text))throw new Error(flag+' requires a finite decimal number.');
      const value=Number(text);
      if(!Number.isFinite(value)||(value===0&&/[1-9]/.test(text.split(/e/i)[0])))throw new Error(flag+' is outside representable finite decimal values.');
      return value;
    };
    const integer=(flag,fallback,min=0,max=Number.MAX_SAFE_INTEGER)=>{
      const text=values[flag];if(text===undefined)return fallback;
      if(!/^[0-9]+$/.test(text))throw new Error(flag+' requires nonnegative decimal integer text.');
      const value=Number(text);if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(flag+' is outside its supported integer range.');return value;
    };
    const initial={position:numeric('--position'),rate:numeric('--rate')};
    const settings={inertia:numeric('--inertia'),command:numeric('--command'),duration:numeric('--duration',4),dt:numeric('--interval',.01),maxTrials:integer('--max-trials',50000,1,100000)};
    const historyIndex=integer('--history-index',null),sampleIndex=integer('--sample-index',null);
    if(Math.abs(initial.position)>1e6||Math.abs(initial.rate)>1e6||settings.inertia<=0||settings.inertia>1e12||Math.abs(settings.command)>1e6||settings.duration<=0||settings.duration>1000||settings.dt<=0||settings.dt>1||outputIntervalCount(settings.duration,settings.dt)>10000)throw new Error('Release declarations exceed maintained Studio bounds (state1e6, inertia(0,1e12], command1e6, duration(0,1000], interval(0,1], at most10000 intervals).');
    const handle=await open(values['--notebook'],constants.O_RDONLY|(constants.O_NONBLOCK||0));let bytes;
    try {
      const metadata=await handle.stat();if(!metadata.isFile()||metadata.size>MAX_SESSION_FILE_BYTES)throw new Error('Notebook must be a regular file within the maintained byte limit.');
      const buffer=Buffer.alloc(MAX_SESSION_FILE_BYTES+1);let count=0;
      while(count<buffer.length){const {bytesRead}=await handle.read(buffer,count,buffer.length-count,null);if(!bytesRead)break;count+=bytesRead;}
      if(count>MAX_SESSION_FILE_BYTES)throw new Error('Notebook bytes exceed the maintained byte limit.');bytes=buffer.subarray(0,count);
    } finally {await handle.close();}
    const state=restoreSession(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    let discovery=state.discovery,selection={kind:'current',historyIndex:null,label:'Current competitive laws'};
    if(historyIndex!==null){
      const history=state.history[historyIndex],receipt=history?.experiment;
      if(!Array.isArray(receipt?.models)||!receipt.models.length)throw new Error('Select a history event containing its original earlier competitive laws.');
      discovery={competitive:receipt.models};selection={kind:'historical',historyIndex,label:history.label,beforeCount:receipt.beforeCount};
    }
    const comparison=compareLocalMotion(discovery,initial,settings);
    const report=sampleIndex===null?comparison:sampleLocalMotionComparison(comparison,sampleIndex);
    const output={...report,notebook:{sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,
      originalEvents:state.events.length,selection,originalCandidateCount:discovery.competitive.length,
      interpretation:'Models reconstructed from original notebook inputs and events; historical motion is computed now, not an authenticated earlier forecast. No evidence or ranking is changed.'}};
    process.stdout.write(JSON.stringify(output,null,2)+'\n');if(comparison.status!=='completed')process.exitCode=2;
  }
}catch(error){process.stderr.write('Local-motion comparison unavailable: '+error.message+'\n');process.exitCode=1;}
