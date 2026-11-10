import {scanBalanceCandidates} from './balance-candidates.mjs';

const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const numeric=value=>Number(value.toPrecision(8)).toString();

/** Derived inspection only: evidence and notebook history are never edited. */
export function mountBalanceInspection(root,{getModel,getCommand,onRelease}) {
  const details=element('details');details.id='balance-inspection';
  details.append(element('summary','Find a zero-torque release'));
  const explanation=element('p','Inspect the current law at zero rate and the dynamics fixed command. Choose an angle to run the existing mechanism from rest. These are model predictions, not measured equilibrium.');
  const controls=element('div');controls.className='dynamics-controls';
  const inputs={};
  for(const [id,label,value] of [['minimum','Minimum angle (rad)','-3.2'],['maximum','Maximum angle (rad)','3.2'],['cells','Scan cells','256']]){
    const wrapper=element('label',label),input=element('input');input.type='number';input.id='balance-'+id;input.value=value;input.step=id==='cells'?'1':'0.1';if(id==='cells'){input.min='1';input.max='4096';}wrapper.htmlFor=input.id;wrapper.append(input);controls.append(wrapper);inputs[id]=input;
  }
  const scan=element('button','Inspect balance angles');scan.id='balance-scan';scan.type='button';scan.className='button button-outline';controls.append(scan);
  const status=element('p');status.id='balance-status';status.setAttribute('role','status');
  const source=element('p');source.id='balance-source';source.className='small';
  const results=element('div');results.id='balance-results';
  const limits=element('p','Finite scan: tangent roots, close pairs and unsampled oscillations can be missed. Numerical zeros and sign changes do not establish physical equilibrium, stability or sticking/contact.');limits.className='muted small';
  details.append(explanation,controls,status,source,results,limits);root.append(details);
  let current=null;
  function retire(message='Inspect again for the current law and fixed command.'){
    current=null;results.replaceChildren();source.textContent='';status.textContent=message;details.dataset.state='retired';
  }
  for(const input of Object.values(inputs))input.addEventListener('input',()=>retire('Scan range or resolution changed. Inspect again.'));
  scan.addEventListener('click',()=>{
    retire('Inspecting the current law…');
    try{
      const values={};
      for(const [key,input] of Object.entries(inputs)){
        if(!input.value.trim()||!Number.isFinite(Number(input.value)))throw Error('Enter a finite '+key+' value.');
        values[key]=Number(input.value);
      }
      const law=getModel(),command=getCommand();
      const report=scanBalanceCandidates(law,{command,minPosition:values.minimum,maxPosition:values.maximum,cells:values.cells});
      current=report;
      details.dataset.state='available';
      source.textContent=law.equation+' · fixed command '+numeric(command)+' N·m · rate 0 rad/s';
      if(report.status==='all_terms_vanish_at_rest'){
        status.textContent='Every model term vanishes at rest across this range. There is no isolated release angle to choose.';return;
      }
      status.textContent=report.candidates.length
        ?report.candidates.length+' numerical candidate'+(report.candidates.length===1?'':'s')+' · '+report.evaluations+' torque evaluations. Select a release to execute the inspected law.'
        :'No candidates found on this finite grid. This does not prove the range has no zero.';
      for(const [index,candidate] of report.candidates.entries()){
        const row=element('div');row.className='balance-candidate';
        const text=element('div');
        text.append(element('strong',numeric(candidate.position)+' rad'));
        text.append(element('p','Residual '+candidate.residual.toExponential(3)+' N·m · '+(candidate.kind==='sampled_zero'?'sampled floating-point zero':'refined sign change')));
        const more=element('details');more.append(element('summary','Numerical bracket'));
        more.append(element('p','Initial ['+candidate.initialBracket.join(', ')+']; final ['+candidate.finalBracket.join(', ')+'] rad. Termination: '+candidate.termination+'.'));
        text.append(more);
        const release=element('button','Release from '+numeric(candidate.position)+' rad');release.type='button';release.className='button button-outline';release.dataset.candidate=String(index);
        release.addEventListener('click',()=>{
          if(current!==report)return;
          try{onRelease(candidate.position,command);status.textContent='Executed from '+numeric(candidate.position)+' rad at zero rate, fixed command '+numeric(command)+' N·m. Inspect the mechanism and trajectory; the finite residual can still produce motion.';}
          catch(error){status.textContent='Release unavailable: '+error.message;}
        });
        row.append(text,release);results.append(row);
      }
    }catch(error){retire('Balance inspection unavailable: '+error.message);details.dataset.state='refused';}
  });
  retire('Choose a range, then inspect the current law.');
  return {retire};
}
