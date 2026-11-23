/** Exhaust all asymmetric three-leaf causal trees using actual grid histories or exact geometry. */
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {rateWorkBudget,RATE_WORK_EXHAUSTED} from './position-drift-rate-polytopes.mjs';
import {prepareFourPulseFeedback,fourPulseMixtureGrid,fourPulseGridCollisions,certifyFourPulseFeedback,verifyFourPulseFeedback} from './position-drift-four-pulse-feedback-witness.mjs';
import {buildFourPulseMenuProof,checkFourPulseMenuProof,buildFourPulseCutProof,checkFourPulseCutProof} from './position-drift-four-pulse-radius.mjs';
import {supportFourLeafBound,checkFourLeafBound} from './position-drift-four-pulse-compact.mjs';
const schema='worldlaw.position-drift-four-pulse-leaf-minimum-proof/v1';
const need=(ok,msg)=>{if(!ok)throw Error('Four-pulse leaf minimum: '+msg);};

function visitAsymmetric(cat,denominator,spend,exception){
  const grid=cat.vertices.map(v=>fourPulseMixtureGrid(v,denominator,spend)),m=cat.commands.length;
  let total=0,gridRefuted=0;
  for(let p=0;p<m;p++)for(let a=0;a<m;a++){
    const bits=new Map(),leaves=[];
    for(let b=0;b<m;b++){
      const row=[];
      for(let c=0;c<m;c++){
        const witnesses=fourPulseGridCollisions(grid,[p,a,b,c],spend),intermediate=new Map();let roots=0n;
        for(const {readings:[s,w]} of witnesses){
          spend();if(!bits.has(s))bits.set(s,1n<<BigInt(bits.size));const bit=bits.get(s);
          roots|=bit;intermediate.set(s+','+w,bit);
        }
        row.push({roots,intermediate});
      }
      leaves.push(row);
    }
    for(let b=0;b<m;b++)for(let c=0;c<m;c++)for(let f=c+1;f<m;f++){
      let siblingRoots=0n;
      for(const [sw,bit] of leaves[b][c].intermediate){
        spend();if(leaves[b][f].intermediate.has(sw))siblingRoots|=bit;
      }
      for(let d=0;d<m;d++)if(d!==b)for(let e=0;e<m;e++){
        spend();total++;
        if(siblingRoots&leaves[d][e].roots){gridRefuted++;continue;}
        const shape=[p,a,b,c,f,d,e],menu=[{third:b,last:[c,f]},{third:d,last:[e]}];
        if(exception(shape,[p,a],menu))return {total,gridRefuted,complete:false};
      }
    }
  }
  return {total,gridRefuted,complete:true};
}

export function certifyFourPulseLeafMinimum(request){
  const {cat,source,prefix,menu}=prepareFourPulseFeedback(request),singleCut=certifyFourPulseFeedback(request);
  const limit=source.experiment.catalog.limits.designWork,base={schema,source};
  if(singleCut.status==='design-budget-exhausted')return {...base,status:'design-budget-exhausted',work:singleCut.work};
  if(!rational(singleCut.menuProof.radius).n)
    return {...base,status:'inconclusive',singleCut,work:singleCut.work};
  const work=rateWorkBudget(limit-singleCut.work);
  try{
    const cutExceptions=[];
    for(const gap of singleCut.missing??[]){
      const px=gap.prefix.map(n=>cat.commands.indexOf(n)),proof=buildFourPulseCutProof(cat,px,gap.mode,work.spend);
      cutExceptions.push({...gap,proof});
      if(rational(proof.radius).n)return {...base,status:'single-cut-witness',singleCut,cutExceptions,work:singleCut.work+work.used};
    }
    const upper=supportFourLeafBound(cat,prefix,menu,singleCut.menuProof,work.spend),exceptions=[];
    const counts=visitAsymmetric(cat,source.denominator,work.spend,(shape,px,tree)=>{
      const proof=buildFourPulseMenuProof(cat,px,tree,work.spend);
      exceptions.push({shape:shape.map(i=>cat.commands[i]),proof});return !!rational(proof.radius).n;
    });
    return {...base,status:counts.complete?'four-leaves-required':'three-leaf-witness',singleCut,cutExceptions,upper,counts,exceptions,work:singleCut.work+work.used};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {...base,status:'design-budget-exhausted',work:singleCut.work+work.used};}
}
export function verifyFourPulseLeafMinimum(request,saved){
  const {cat,source,prefix,menu}=prepareFourPulseFeedback(request),limit=source.experiment.catalog.limits.designWork;
  need(saved?.schema===schema&&equalPositionDriftData(saved.source,source),'source differs');
  if(saved.status==='design-budget-exhausted'){
    need(equalPositionDriftData(certifyFourPulseLeafMinimum(request),saved),'unreproducible exhaustion');return true;
  }
  verifyFourPulseFeedback(request,saved.singleCut);
  if(saved.status==='inconclusive'){
    need(saved.singleCut.menuProof?.radius==='0','unfounded inconclusive result');return true;
  }
  need(['four-leaves-required','three-leaf-witness','single-cut-witness'].includes(saved.status)&&['one-cut-refuted','grid-inconclusive'].includes(saved.singleCut.status)&&
    rational(saved.singleCut.menuProof.radius).n>0n&&Number.isSafeInteger(saved.work)&&saved.work>=saved.singleCut.work&&saved.work<=limit,'incomplete positive menu or lower bound');
  const work=rateWorkBudget(limit-saved.singleCut.work);let i=0;
  try{
    const gaps=saved.singleCut.missing??[];
    for(let j=0;j<gaps.length;j++){
      const gap=gaps[j],record=saved.cutExceptions[j],px=gap.prefix.map(n=>cat.commands.indexOf(n));
      need(record&&record.mode===gap.mode&&equalPositionDriftData(record.prefix,gap.prefix),'missing exact single-cut case');
      checkFourPulseCutProof(cat,px,gap.mode,record.proof,work.spend);
      if(rational(record.proof.radius).n){
        need(saved.status==='single-cut-witness'&&saved.cutExceptions.length===j+1,'unexpected winning single cut');return true;
      }
    }
    need(saved.cutExceptions.length===gaps.length&&saved.status!=='single-cut-witness','single-cut coverage differs');
    checkFourLeafBound(cat,prefix,menu,saved.singleCut.menuProof,saved.upper,work.spend);
    const counts=visitAsymmetric(cat,source.denominator,work.spend,(shape,px,tree)=>{
      const record=saved.exceptions[i++];
      need(record&&equalPositionDriftData(record.shape,shape.map(j=>cat.commands[j])),'missing exact nongrid case');
      checkFourPulseMenuProof(cat,px,tree,record.proof,work.spend);return !!rational(record.proof.radius).n;
    });
    need(i===saved.exceptions.length&&equalPositionDriftData(counts,saved.counts)&&
      saved.status===(counts.complete?'four-leaves-required':'three-leaf-witness'),'asymmetric tree coverage differs');
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;throw Error('Leaf-minimum replay exceeded source budget');}
  return true;
}
