// CLI consumer of the same input-only investigation as UNKNOWN LAB.
import {readFile} from 'node:fs/promises';
import {analyzeProbeStudy,importProbeStudy,exportProbeStudy} from '../src/unknown-lab/probe-response.mjs';
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';
try{
 const [mode,value,...extra]=process.argv.slice(2);
 if(extra.length||!value||!['--input','--example','--export-example'].includes(mode))throw Error('Usage: node scripts/probe-study.mjs --input study.json | --example ambiguous|drag|offset|restoring|mixed | --export-example ambiguous|drag|offset|restoring|mixed');
 const study=mode==='--input'?importProbeStudy(await readFile(value,'utf8')):probeExample(value);
 if(mode==='--export-example')process.stdout.write(exportProbeStudy(study));
 else{const r=analyzeProbeStudy(study);process.stdout.write(JSON.stringify({schema:'worldlaw.probe-analysis/v1',source:r.source,preparation:study.preparation,training:{status:r.fit.status,reasons:r.fit.reasons,candidates:r.fit.candidates},challenges:r.challenges,jointChallenges:r.jointChallenges,interpretation:r.interpretation},null,2)+'\n');}
}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
