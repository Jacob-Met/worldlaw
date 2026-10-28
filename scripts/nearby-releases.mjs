#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {restoreSession,MAX_SESSION_FILE_BYTES} from '../src/session.mjs';
import {compareNearbyReleases} from '../src/science/release-separation.mjs';

const help=`Compare finite nearby releases from an exported WORLDLAW notebook.
Usage: node scripts/nearby-releases.mjs --notebook notebook.json
       --position 0 --rate 0 --delta-position 0 --delta-rate 0.01
       --command 0 --inertia 1
       [--model command+spring] [--duration 4] [--interval 0.01]
       [--time-scale 1] [--max-trials 50000]
       [--relative-tolerance 1e-8] [--position-tolerance 1e-10]
       [--rate-tolerance 1e-10]

Replays the original notebook, then executes the selected recomputed law from
the nominal state and full/half declared perturbations with the Studio solver.
Position is unwrapped radians, rate rad/s, command N*m and inertia kg*m^2.
The interval sets output times and caps smooth internal trial steps; refinement
may take smaller steps. For nonzero Coulomb laws it is the nominal fixed step.
The declared time scale (seconds, default 1) weights rate in the state norm:
hypot(position difference, time-scale * rate difference). It does not affect motion.
The factor concerns this finite perturbation, not maximum gain or stability.
Half-amplitude disagreement is not a numerical convergence or physical-validity test.
The notebook is never written. JSON goes to stdout; malformed input to stderr.
Exit 0: complete comparison; 2: JSON retains an incomplete/failed course; 1: refusal.
`;

try {
  const args=process.argv.slice(2);
  if (args.length===1 && args[0]==='--help') process.stdout.write(help);
  else {
    const allowed=new Set(['--notebook','--position','--rate','--delta-position','--delta-rate',
      '--command','--inertia','--model','--duration','--interval','--time-scale',
      '--max-trials','--relative-tolerance','--position-tolerance','--rate-tolerance']);
    const values={};
    for(let i=0;i<args.length;i+=2) {
      if(!allowed.has(args[i]) || i+1>=args.length || Object.hasOwn(values,args[i]))
        throw new Error('Unknown, duplicate or incomplete argument. Use --help.');
      values[args[i]]=args[i+1];
    }
    if(!values['--notebook'] || ['--position','--rate','--delta-position','--delta-rate','--command','--inertia'].some(flag=>values[flag]===undefined))
      throw new Error('Supply --notebook, --position, --rate, --delta-position, --delta-rate, --command and --inertia.');
    const numeric=(flag,fallback)=>{
      const text=values[flag];
      if(text===undefined)return fallback;
      if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text))
        throw new Error(flag+' requires a finite decimal number.');
      const value=Number(text);
      if(!Number.isFinite(value) || (value===0 && /[1-9]/.test(text.split(/e/i)[0])))
        throw new Error(flag+' is outside representable finite decimal values.');
      return value;
    };
    const initial={position:numeric('--position'),rate:numeric('--rate')};
    const perturbation={position:numeric('--delta-position'),rate:numeric('--delta-rate')};
    const settings={command:numeric('--command'),inertia:numeric('--inertia'),
      duration:numeric('--duration',4),dt:numeric('--interval',0.01),timeScale:numeric('--time-scale',1),
      maxTrials:numeric('--max-trials',50000),relativeTolerance:numeric('--relative-tolerance',1e-8),
      positionTolerance:numeric('--position-tolerance',1e-10),rateTolerance:numeric('--rate-tolerance',1e-10)};
    if(values['--model']!==undefined && (!values['--model'] || values['--model'].length>256))
      throw new Error('--model must be a recomputed candidate ID of at most 256 characters.');
    const handle=await open(values['--notebook'],constants.O_RDONLY | (constants.O_NONBLOCK || 0));
    let bytes;
    try {
      const metadata=await handle.stat();
      if(!metadata.isFile() || metadata.size>MAX_SESSION_FILE_BYTES)
        throw new Error('The notebook must be a regular file within the maintained byte limit.');
      const buffer=Buffer.alloc(MAX_SESSION_FILE_BYTES+1);
      let count=0;
      while(count<buffer.length) {
        const {bytesRead}=await handle.read(buffer,count,buffer.length-count,null);
        if(!bytesRead)break;
        count+=bytesRead;
      }
      if(count>MAX_SESSION_FILE_BYTES)throw new Error('Notebook bytes exceed the maintained byte limit.');
      bytes=buffer.subarray(0,count);
    } finally {await handle.close();}
    const state=restoreSession(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    const candidateId=values['--model']??state.discovery.selected.id;
    const candidate=state.discovery.candidates.find(model=>model.id===candidateId);
    if(!candidate)throw new Error('The requested model is not a candidate recomputed from this notebook.');
    const report=compareNearbyReleases(candidate,initial,perturbation,settings);
    report.notebook={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,
      originalEvents:state.events.length,observations:state.discovery.observations.length,
      candidateId,selectedId:state.discovery.selected.id,candidateCount:state.discovery.candidates.length,
      explicitlySelected:values['--model']!==undefined,
      interpretation:'Recomputed from original notebook source and events. Release conditions and inertia are declarations, not acquired measurements; no source evidence is added.'};
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if(report.status!=='completed')process.exitCode=2;
  }
} catch(error) {
  process.stderr.write('Nearby-release comparison unavailable: '+error.message+'\n');
  process.exitCode=1;
}
