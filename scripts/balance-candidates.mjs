#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {restoreSession, MAX_SESSION_FILE_BYTES} from '../src/session.mjs';
import {scanBalanceCandidates} from '../src/science/balance-candidates.mjs';

const help = `Inspect numerical zero-torque candidates from an exported WORLDLAW notebook.
Usage: node scripts/balance-candidates.mjs --notebook notebook.json
       --command 0 --minimum -2 --maximum 2
       [--model command+spring] [--cells 256] [--refinements 48]

The notebook's source and events are replayed by maintained restoreSession.
--model selects an exact recomputed candidate ID; default is its selected model.
Angles are unwrapped radians in that law's existing frame. Rate is fixed at zero.
The finite scan can miss tangent roots, close pairs and unsampled oscillations.
It does not establish all roots, physical equilibrium, stability or contact.
JSON goes to stdout; refusals go to stderr. The notebook is never written.
`;

try {
  const args = process.argv.slice(2);
  if (args.length===1 && args[0]==='--help') process.stdout.write(help);
  else {
    const allowed = new Set(['--notebook','--command','--minimum','--maximum','--model','--cells','--refinements']);
    const values = {};
    for (let i=0; i<args.length; i+=2) {
      if (!allowed.has(args[i]) || i+1>=args.length || Object.hasOwn(values,args[i]))
        throw new Error('Unknown, duplicate or incomplete argument. Use --help.');
      values[args[i]] = args[i+1];
    }
    if (!values['--notebook'] || ['--command','--minimum','--maximum'].some(flag=>values[flag]===undefined))
      throw new Error('--notebook, --command, --minimum and --maximum are required.');
    const numeric = (flag, fallback) => {
      const text = values[flag];
      if (text === undefined) return fallback;
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text))
        throw new Error(flag+' requires a finite decimal number.');
      const value = Number(text);
      if (!Number.isFinite(value) || (value===0 && /[1-9]/.test(text.split(/e/i)[0])))
        throw new Error(flag+' is outside representable finite decimal values.');
      return value;
    };
    const settings = {
      command:numeric('--command'), minPosition:numeric('--minimum'), maxPosition:numeric('--maximum'),
      cells:numeric('--cells',256), refinements:numeric('--refinements',48),
    };
    if (values['--model']!==undefined && (!values['--model'] || values['--model'].length>256))
      throw new Error('--model must be a recomputed candidate ID of at most 256 characters.');
    const handle = await open(values['--notebook'], constants.O_RDONLY | (constants.O_NONBLOCK || 0));
    let bytes;
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile() || metadata.size > MAX_SESSION_FILE_BYTES)
        throw new Error('The notebook must be a regular file within the maintained byte limit.');
      const buffer = Buffer.alloc(MAX_SESSION_FILE_BYTES+1);
      let count = 0;
      while (count < buffer.length) {
        const {bytesRead} = await handle.read(buffer, count, buffer.length-count, null);
        if (!bytesRead) break;
        count += bytesRead;
      }
      if (count > MAX_SESSION_FILE_BYTES) throw new Error('Notebook bytes exceed the maintained byte limit.');
      bytes = buffer.subarray(0,count);
    } finally { await handle.close(); }
    const sourceText = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const state = restoreSession(sourceText);
    const candidateId = values['--model'] ?? state.discovery.selected.id;
    const candidate = state.discovery.candidates.find(model=>model.id===candidateId);
    if (!candidate) throw new Error('The requested model is not a candidate recomputed from this notebook.');
    const report = scanBalanceCandidates(candidate,settings);
    report.notebook = {
      sha256:createHash('sha256').update(bytes).digest('hex'), bytes:bytes.length,
      originalEvents:state.events.length, observations:state.discovery.observations.length,
      candidateId, selectedId:state.discovery.selected.id,
      candidateCount:state.discovery.candidates.length, explicitlySelected:values['--model']!==undefined,
      interpretation:'Recomputed from the supplied notebook source and events; derived candidate positions are not original measurements.',
    };
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  }
} catch (error) {
  process.stderr.write('Balance inspection unavailable: '+error.message+'\n');
  process.exitCode = 1;
}
