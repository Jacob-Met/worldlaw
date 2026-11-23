#!/usr/bin/env node
/** CPU pull-dispatch entry point. Preserve failure evidence before returning. */
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,openSync,closeSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.ARTIFACT_DIR)throw new Error('Require native ARTIFACT_DIR before opening development evidence');
const artifact=resolve(process.env.ARTIFACT_DIR);
mkdirSync(artifact,{recursive:true});
const work=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'worldlaw-continuous-'));
const evidence=join(work,'evidence');mkdirSync(evidence);
const summary={schema:'worldlaw.continuous-qualification/v1',startedAt:new Date().toISOString(),
  runtime:{node:process.version,platform:process.platform,arch:process.arch},
  phases:[],calibrationOpened:false,evaluationOpened:false,status:'incomplete'};
function phase(name,command,args){
  const path=join(evidence,name+'.log'),fd=openSync(path,'wx'),start=Date.now();
  let result;
  try{result=spawnSync(command,args,{cwd:root,env:process.env,stdio:['ignore',fd,fd],timeout:2400000});}
  finally{closeSync(fd);}
  const bytes=readFileSync(path);
  const record={name,command,args,exitCode:result.status,signal:result.signal,
    error:result.error?{name:result.error.name,message:result.error.message}:null,
    durationMs:Date.now()-start,log:{file:name+'.log',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}};
  summary.phases.push(record);
  console.log(JSON.stringify({event:'qualification_phase',...record}));
  if(result.status!==0||result.error){
    process.stdout.write(bytes.subarray(Math.max(0,bytes.length-20000)));
    return false;
  }
  return true;
}
try{
  if(Number(process.versions.node.split('.')[0])<20)throw new Error('Require Node20 or newer');
  const tests=readdirSync(join(root,'tests')).filter(p=>p.endsWith('.test.mjs')).sort().map(p=>'tests/'+p);
  if(!tests.length)throw new Error('No maintained tests found');
  let passed=phase('all-maintained-tests',process.execPath,['--test','--test-concurrency=2',...tests]);
  if(passed)passed=phase('real-app-smoke',process.execPath,['scripts/smoke.mjs']);
  if(passed)passed=phase('real-trajectory-smoke',process.execPath,['scripts/trajectory-smoke-92be.mjs']);
  if(passed)passed=phase('six-world-development',process.execPath,[
    'experiments/continuous-law-course.mjs','--stage','development','--output',join(evidence,'development')]);
  summary.status=passed?'qualified':'refused';
  if(passed)summary.development=JSON.parse(readFileSync(join(evidence,'development/development-summary.json'),'utf8'));
}catch(error){summary.status='refused';summary.error={name:error.name,message:error.message};}
summary.finishedAt=new Date().toISOString();
writeFileSync(join(evidence,'qualification-summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
const tar=spawnSync('tar',['-czf',join(artifact,'continuous-law-development.tgz'),'-C',work,'evidence'],{encoding:'utf8'});
if(tar.status!==0||tar.error){
  summary.status='refused';summary.archiveError={status:tar.status,stderr:tar.stderr,error:tar.error?.message??null};
}
writeFileSync(join(artifact,'continuous-law-qualification.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({event:'qualification_finished',status:summary.status,phases:summary.phases,
  development:summary.development??null,error:summary.error??null,archiveError:summary.archiveError??null}));
if(summary.status!=='qualified')process.exitCode=2;
