/** Two six-pulse policies for the original case-12 position/drift catalog. */
import {openPositionDriftFeedback,selectSafePositionDriftCommand} from './position-drift-terminal-feedback.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';

const need=(ok,reason)=>{if(!ok)throw Error('Case-12 feedback: '+reason);};
const pairs=[['L0','L1'],['L0','L2'],['L1','L2']];
export function caseTwelveRateCatalog(){
  return {schema:'worldlaw.position-drift-rate-catalog/v1',commands:['u0','u1','u2'],noiseBound:'1',
    laws:[[-1,6,4],[-4,2,8],[-8,2,-2]].map((rates,i)=>({id:'L'+i,rates}))};
}

function strictContrast(source,prefix,last,laws,ticks){
  const word=last===null?prefix:[...prefix,last];
  const [a,b,c]=ticks,weights=[c-b,a-c,b-a].map(BigInt);
  const centers=laws.map(id=>{
    const row=source.laws.find(l=>l.id===id).rates;
    let total=0n;
    const forcing=[0n,...word.map(u=>total+=BigInt(row[source.commands.indexOf(u)]))];
    return ticks.reduce((sum,t,i)=>sum+weights[i]*forcing[t],0n);
  });
  const threshold=4n*BigInt(c-a)*BigInt(source.noiseBound);
  const difference=centers[0]-centers[1],margin=(difference<0n?-difference:difference)-threshold;
  need(margin>0n,'the claimed pair has a touching or overlapping contrast interval');
  return {laws:laws.slice(),last,ticks,weights:weights.map(String),centers:centers.map(String),
    threshold:String(threshold),margin:String(margin)};
}

export function planCaseTwelveOneFeedback(first){
  need(first==='u0'||first==='u1','choose u0 or u1 as the first repeated command');
  const source=caseTwelveRateCatalog(),other=first==='u0'?'u1':'u0';
  const prefix=[first,first,first,other,other];
  const certificates=[
    strictContrast(source,prefix,null,pairs[2],[0,3,5]),
    strictContrast(source,prefix,'u2',pairs[0],[0,5,6]),
    strictContrast(source,prefix,other,pairs[1],[0,3,6])];
  const assignments=[];
  // The adversary gets a separate last reading and a potentially different
  // physical pair for each command, but one common six-reading prefix.
  for(const a of pairs)for(const b of pairs)for(const c of pairs){
    const choices=[a,b,c];
    const present=new Set(choices.flat());
    const certificate=certificates.findIndex(proof=>proof.last===null?
      proof.laws.every(id=>present.has(id)):
      proof.laws.every(id=>choices[source.commands.indexOf(proof.last)].includes(id)));
    need(certificate>=0,'a private-last assignment lacks a contradiction');
    assignments.push({pairs:choices.map(p=>p.slice()),certificate});
  }
  return {schema:'worldlaw.case-twelve-one-feedback/v1',source,prefix,certificates,assignments};
}

export function openCaseTwelveOneFeedback(first,saved=planCaseTwelveOneFeedback(first)){
  const plan=planCaseTwelveOneFeedback(first);
  need(equalPositionDriftData(saved,plan),'saved plan differs from its exact source');
  const physical=openPositionDriftFeedback(plan.source);
  function afterFive(values){
    const witnesses=physical.receive(plan.prefix,values);
    if(!witnesses.length)return {witnesses,command:null};
    // Preserve the registered certificate's priority while using the general
    // physical interval test for the decision on these actual measurements.
    const order=plan.certificates.filter(c=>c.last&&witnesses.every(w=>c.laws.includes(w.law))).map(c=>c.last);
    const command=selectSafePositionDriftCommand(physical.finalOptions(plan.prefix,values),order);
    need(command!==null,'no certified final action fits the retained prefix');
    return {witnesses,command};
  }
  function receive(values){
    need(Array.isArray(values)&&values.length>=1&&values.length<=7,'supply a prefix of one to seven exact readings');
    if(values.length<=5){
      const word=plan.prefix.slice(0,values.length-1);
      const witnesses=physical.receive(word,values);
      return {commands:word,witnesses,nextCommand:witnesses.length?plan.prefix[word.length]:null};
    }
    const {witnesses,command}=afterFive(values.slice(0,6));
    if(values.length===6)return {commands:plan.prefix.slice(),witnesses,nextCommand:command};
    need(command!==null,'a final reading followed an inconsistent shared prefix');
    const word=[...plan.prefix,command],final=physical.receive(word,values);
    need(final.length<=1,'the chosen final action failed to identify the source');
    return {commands:word,witnesses:final,nextCommand:null};
  }
  return {receive};
}
