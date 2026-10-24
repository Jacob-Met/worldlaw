import {analyzeCouplingNotebook} from './notebook.mjs';
import {inspectModeTrajectory} from './modes.mjs';
const node=(tag,text,attrs={})=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;};
const svg=(tag,attrs={},text)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
const fmt=n=>Number(n.toPrecision(6)).toString();
/** Input evidence and the exact retained comparison travel together; no new solver. */
export function appendModeInspection(root,notebook,study){
 root.replaceChildren();const button=node('button','Find coordinates for this motion',{type:'button',id:'modes-inspect'}),out=node('div',undefined,{id:'modes-result'});root.append(button,out);
 button.addEventListener('click',()=>{
  out.replaceChildren();
  try{
   const analysis=analyzeCouplingNotebook(notebook),reports=analysis.discovery.candidates.map(model=>inspectModeTrajectory(model,study.inputs,study.results.find(r=>r.modelId===model.id)));
   out.append(node('h3','The same motion in learned coordinates'),node('p','These directions diagonalize each symmetric fitted response after scaling by the declared inertia. They are a change of representation, not newly observed bodies. The original trajectory and its numerical status are retained.'));
   const select=node('select',undefined,{id:'modes-model','aria-label':'Fitted law for coordinate inspection'}),view=node('div');
   for(const r of reports)select.append(node('option',r.label,{value:r.modelId}));out.append(select,view);
   const draw=()=>{
    view.replaceChildren();const r=reports.find(x=>x.modelId===select.value);view.dataset.modeStatus=r.status;
    view.append(node('p',`Source: ${study.source.label}. Declared inertia [${study.inputs.inertia.map(fmt).join(', ')}] kg·m². ${study.inputs.declaration}`));
    if(r.status!=='available'){view.append(node('p',r.reason));return;}
    view.append(node('p',r.qualification));
    if(r.axisAmbiguity)view.append(node('strong','The stiffness eigenvalues are repeated or numerically unresolved. These axis directions are not uniquely identified.'));
    const stage=svg('svg',{viewBox:'0 0 420 600',role:'img','aria-label':'Learned mode directions and transformed retained trajectory',style:'display:block;width:100%;max-width:560px;height:auto;background:#101c2d;color:#e5eef8'});
    stage.append(svg('text',{x:25,y:26,fill:'currentColor','font-size':17},'Mode directions in original angle plane'));
    const center=[210,140],colors=['#64e0ce','#ffc65d'];
    stage.append(svg('line',{x1:90,y1:140,x2:330,y2:140,stroke:'#718198'}),svg('line',{x1:210,y1:45,x2:210,y2:230,stroke:'#718198'}));
    stage.append(svg('text',{x:310,y:163,fill:'currentColor','font-size':13},'q₁'),svg('text',{x:218,y:57,fill:'currentColor','font-size':13},'q₂'));
    r.directions.forEach((d,i)=>{const norm=Math.hypot(...d),x=d[0]/norm*82,y=-d[1]/norm*82;stage.append(svg('line',{x1:center[0]-x,y1:center[1]-y,x2:center[0]+x,y2:center[1]+y,stroke:colors[i],'stroke-width':4,'data-mode-direction':i}),svg('text',{x:25,y:262+i*55,fill:colors[i],'font-size':17},`Mode ${i+1}: ${r.stability[i]}`),svg('text',{x:25,y:284+i*55,fill:colors[i],'font-size':14},r.frequencies[i]===null?(r.stability[i]==='anti-restoring'?'No oscillatory undamped frequency':'Undamped frequency unresolved'):`${fmt(r.frequencies[i])} rad/s · undamped`));});
    stage.append(svg('text',{x:25,y:375,fill:'currentColor','font-size':16},'Retained modal coordinates over time'));
    if(r.rows.length){
     const values=r.rows.flatMap(row=>row.position),low=Math.min(...values),high=Math.max(...values),span=high-low||1;
     for(let axis=0;axis<2;axis++)stage.append(svg('path',{d:r.rows.map((row,i)=>(i?'L':'M')+(40+340*row.time/study.inputs.duration)+' '+(535-130*(row.position[axis]-low)/span)).join(' '),fill:'none',stroke:colors[axis],'stroke-width':2.5,'stroke-dasharray':r.trajectoryStatus==='step_sensitive'?'6 5':'','data-mode-trace':axis}));
     stage.append(svg('text',{x:25,y:562,fill:'currentColor','font-size':13},`0 s → ${fmt(study.inputs.duration)} s; rad·√(kg·m²)`));
    }else stage.append(svg('text',{x:40,y:440,fill:'currentColor'},'No completed retained trajectory.'));
    view.append(stage);
    view.append(node('p',`Direction lines are normalized for display. Original-angle directions per unit modal coordinate: mode 1 [${r.directions[0].map(fmt).join(', ')}]; mode 2 [${r.directions[1].map(fmt).join(', ')}]. Line segments join retained solver samples; they do not add observations.`));
    if(r.rows.length){const values=r.rows.flatMap(row=>row.position);view.append(node('p',`Both modal traces share a vertical range of ${fmt(Math.min(...values))} to ${fmt(Math.max(...values))} rad·√(kg·m²).`));}
    view.append(node('p',`Transformed damping matrix: [${r.damping[0].map(fmt).join(', ')}; ${r.damping[1].map(fmt).join(', ')}] s⁻¹. Off-diagonal terms remain in the equation; diagonal stiffness alone does not make the damped motion independent.`));
    view.append(node('p',`Mode bias [${r.bias.map(fmt).join(', ')}] N·m/√(kg·m²). Stiffness eigenvalues [${r.eigenvalues.map(fmt).join(', ')}] s⁻². Coordinate units are rad·√(kg·m²); transformed forces have different units from original torques.`));
    if(r.checks)view.append(node('p',`Retained trajectory: ${r.trajectoryStatus}; ${r.domainStatus}. Maximum round-trip coordinate residual ${fmt(r.checks.roundtripResidual)} rad; response residual ${fmt(r.checks.responseResidual)} in transformed force units; instantaneous-power residual ${fmt(r.checks.powerResidual)} W. These floating-point checks are not physical validation or verified error bounds.`));
   };select.addEventListener('change',draw);draw();
  }catch(error){out.append(node('p',`Coordinate inspection refused: ${error.message}`));}
 });
}
