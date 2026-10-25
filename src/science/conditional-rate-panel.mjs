import {conditionalRateFit} from './conditional-rate-fit.mjs';
import {evaluate,simulate} from './torque-discovery.mjs';
const el=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e;};
const fmt=x=>x===null?'No held-out rows':Number(x.toPrecision(6)).toString();
export function renderConditionalRate(container,model,training,heldOut,{trajectory,solver,chart}){
 const group=el('section');group.id='conditional-rate-revision';
 group.append(el('h4','What if the rate response cannot supply power?'));
 group.append(el('p','Fit a competing rate law under that explicit assumption. Keep every other selected coefficient fixed, then confront both laws with the same held-out readings and solver initial state. The selected model stays in place.'));
 const label=el('label','Conditional maximum absolute speed (rad/s) '),input=el('input');input.type='number';input.min='0';input.max='1000000';input.step='any';input.value=String(Math.max(...training.map(r=>Math.abs(r.rate))));label.append(input);
 const button=el('button','Fit under nonpositive rate-power assumption');button.type='button';button.className='button button-dark';button.style.margin='10px 0';
 const output=el('div','No conditional revision has been fitted.');output.setAttribute('role','status');
 input.addEventListener('input',()=>{delete output.dataset.status;output.replaceChildren(el('p','Declaration changed. Fit again to compare the laws.'));});
 button.addEventListener('click',()=>{
  output.replaceChildren();
  try{
   if(!input.value.trim())throw Error('Enter a positive maximum speed.');
   const report=conditionalRateFit(model,training,Number(input.value));
   const original=evaluate(model,heldOut),revised=evaluate(report.model,heldOut);
   output.dataset.status='computed';
   output.append(el('p',`Revised polynomial has nonpositive rate power throughout |ω| ≤ ${report.maximumSpeed} rad/s. This is an imposed assumption, not a physical finding.`));
   const table=el('table');table.append(el('caption','Torque prediction errors · all admitted rows · N·m'));
   const head=el('tr');for(const text of ['Evidence','Original','Conditional revision'])head.append(el('th',text));table.append(head);
   for(const [name,a,b] of [['Training',report.training.original.rmse,report.training.revised.rmse],['Held-out',original.rmse,revised.rmse]]){
    const row=el('tr');row.append(el('th',name),el('td',fmt(a)),el('td',fmt(b)));table.append(row);
   }
   output.append(table);
   output.append(el('p',heldOut.length?`All ${heldOut.length} held-out readings are receiving evidence only. ${revised.rmse>original.rmse?'The conditional law predicts them worse. Retain this failure of the imposed assumption plus fixed-model context.':'A smaller error here does not establish the imposed assumption or choose the conditional law automatically.'}`:'No held-out evidence is available to challenge this revision.'));
   const detail=el('details');detail.append(el('summary','Inspect every held-out prediction and revised coefficient'));
   const pre=el('pre',JSON.stringify({terms:report.model.terms,heldOut:original.rows.map((r,i)=>({index:i,observed:r.jointTorque,original:r.prediction,revised:revised.rows[i].prediction})),diagnostics:report.diagnostics},null,2));pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';detail.append(pre);output.append(detail);
   const plot=el('div');plot.id='conditional-rate-trajectories';output.append(plot);
   try{
    const revisedTrajectory=simulate(report.model,trajectory[0],solver);
    chart(plot.id,[{name:'Original prediction',color:'#1c7562',line:true,points:trajectory.map(r=>({x:r.time,y:r.position}))},{name:'Conditional prediction',color:'#bd502f',line:true,points:revisedTrajectory.map(r=>({x:r.time,y:r.position}))}],{xLabel:'Simulation time (s)',yLabel:'Predicted angle (rad)'});
    output.append(el('p','Both traces use the maintained RK4 solver and the same declared initial state, inertia and fixed command. They are model predictions, not observed motion. The imposed rate-power interval does not constrain states outside that speed interval.'));
   }catch(error){plot.append(el('p','Conditional trajectory refused: '+error.message));}
   output.append(el('p',report.interpretation));
  }catch(error){delete output.dataset.status;output.append(el('p','Conditional revision refused: '+error.message));}
 });
 group.append(label,button,output,el('p','This temporary comparison does not replace or save a fitted model. Notebook reopening restores original inputs; explicitly fit the conditional law again.'));
 container.append(group);
}
