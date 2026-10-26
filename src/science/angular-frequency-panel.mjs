import {frequencySettings,evaluateAngularFrequency,predictAngularFrequency,simulateAngularFrequency,exportAngularFrequencyInputs,restoreAngularFrequencyInputs} from './angular-frequency.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const fmt=x=>x===null?'No rows':Number(x.toPrecision(6)).toString();
export function renderAngularFrequency(root,session,{chart,simulationInputs,onReopen,settings=null,getSourceGeneration=()=>0}) {
  root.frequencyDispose?.();root.replaceChildren();let worker=null,revision=0,report=null,redraw=null;
  const stop=()=>{worker?.terminate();worker=null;};
  const resize=new ResizeObserver(()=>redraw?.());resize.observe(root);
  root.frequencyDispose=()=>{revision++;stop();resize.disconnect();};
  const details=el('details');details.id='angular-frequency';details.open=settings!==null;
  details.append(el('summary','Discover a different angular period'));
  details.append(el('p','Could a periodic restoring response have a different period from sin(θ)? Fit sine and cosine together across a bounded frequency profile, retaining command, rate and bias alternatives. Original angles remain unchanged. This is a conditional response model, not measured gearing or sensor calibration.'));
  const controls=el('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:10px';const inputs={};
  for(const [key,label] of [['min','Minimum k (1/rad)'],['max','Maximum k (1/rad)'],['points','Coarse points'],['noiseSigma','Assumed noise (N·m)']]){
    const box=el('label',label+' '),input=el('input');input.type='number';input.step='any';input.id='frequency-'+key;input.style.width='110px';input.value=String((settings??frequencySettings())[key]);box.append(input);controls.append(box);inputs[key]=input;
  }
  const run=el('button','Infer angular period');run.id='frequency-run';run.type='button';const cancel=el('button','Cancel');cancel.id='frequency-cancel';cancel.type='button';cancel.disabled=true;
  const save=el('button','Save frequency inputs');save.id='frequency-save';save.type='button';save.disabled=true;
  controls.append(run,cancel,save);details.append(controls);
  const open=el('label','Reopen frequency inputs '),file=el('input');file.id='frequency-open';file.type='file';file.accept='.json';open.append(file);details.append(open);
  const output=el('div','No profile computed.');output.id='frequency-output';output.setAttribute('role','status');details.append(output);root.append(details);
  function invalidate(message){revision++;stop();report=null;redraw=null;run.disabled=false;cancel.disabled=true;save.disabled=true;delete output.dataset.status;output.replaceChildren(el('p',message));}
  for(const input of Object.values(inputs))input.addEventListener('input',()=>invalidate('Settings changed. Recompute the complete comparison.'));
  cancel.onclick=()=>invalidate('Inference canceled. No partial profile accepted.');
  function display(result){
    report=result;save.disabled=false;output.dataset.status=result.status;output.replaceChildren();
    output.append(el('h4',result.selected.frequency===null?'Nonperiodic response preferred':`Conditional k = ${fmt(result.selected.frequency)} /rad · period ${fmt(2*Math.PI/result.selected.frequency)} rad`));
    output.append(el('p',`Status: ${result.status.replaceAll('_',' ')}. ${result.profile.length} sampled frequency evaluations; ${result.competitiveFrequencies.length} competitive samples. Search range and profile are not confidence bounds. Ordinary least squares uses every original reading; no Studio model is replaced.`));
    const table=el('table');table.style.cssText='width:100%;table-layout:fixed;font-size:.8rem;overflow-wrap:anywhere';table.append(el('caption','Training selection frozen before separate receiving · N·m'));
    const header=el('tr');for(const text of ['Response','Training RMSE','Receiving RMSE'])header.append(el('th',text));table.append(header);
    for(const [name,c]of [['No periodic term',result.noPeriod.selected],['Unit frequency',result.baseline.selected],['Selected profile',result.selected]]){
      const row=el('tr');row.append(el('th',name),el('td',c?fmt(c.rmse):'Rank refused'),el('td',c?fmt(evaluateAngularFrequency(c,session.base.heldOut).rmse):'Unavailable'));table.append(row);
    }output.append(table);
    const profile=el('div'),response=el('div'),residual=el('div');profile.id='frequency-profile-chart';response.id='frequency-response-chart';residual.id='frequency-residual-chart';output.append(profile,response,residual);
    const draw=()=>{
      const width=Math.max(280,Math.min(580,root.clientWidth)),ordered=result.profile.filter(p=>p.selected).sort((a,b)=>a.frequency-b.frequency);
      chart(profile.id,[{name:'Training profile · every sampled frequency',color:'#8737a2',points:ordered.map(p=>({x:p.frequency,y:p.selected.rmse}))}],{width,xLabel:'Angular frequency k (1/rad)',yLabel:'Training torque RMSE (N·m)'});
      const positions=result.training.map(r=>r.position),lo=Math.min(...positions),hi=Math.max(...positions),sweep=Array.from({length:161},(_,i)=>({command:0,rate:0,position:lo+(hi-lo)*i/160}));
      chart(response.id,[['Unit frequency',result.baseline.selected,'#1c7562'],['Selected response',result.selected,'#bd502f']].filter(([,m])=>m).map(([name,m,color])=>({name,color,line:true,points:sweep.map(r=>({x:r.position,y:predictAngularFrequency(m,r)}))})),{width,xLabel:'Original angle θ (rad) · u=ω=0',yLabel:'Conditional torque (N·m)'});
      const receiving=evaluateAngularFrequency(result.selected,session.base.heldOut);
      chart(residual.id,[{name:'Separate receiving residuals',color:'#bd502f',points:receiving.rows.map(r=>({x:r.position,y:r.residual}))}],{width,xLabel:'Original receiving angle (rad)',yLabel:'Receiving torque residual (N·m)'});
    };redraw=draw;draw();
    output.append(el('p','The response sweep fixes command and rate at zero; it may be outside joint observed support. Separate residuals retain each original measured state. A narrow angular range or regularly spaced samples can conceal aliases.'));
    const motion=el('button','Execute selected and unit-frequency motion'),motionOutput=el('div');motion.id='frequency-motion';motion.type='button';output.append(motion,motionOutput);
    motion.onclick=()=>{motionOutput.replaceChildren();try{const {initial,settings}=simulationInputs(),series=[];for(const [name,m,color]of [['Selected',result.selected,'#bd502f'],['Unit frequency',result.baseline.selected,'#1c7562']])if(m){const execution=simulateAngularFrequency(m,initial,settings);series.push({name,color,line:true,points:execution.trajectory.map(r=>({x:r.time,y:r.position}))});}const plot=el('div');plot.id='frequency-motion-chart';motionOutput.append(plot);chart(plot.id,series,{width:Math.min(580,root.clientWidth),xLabel:'Computed time (s)',yLabel:'Original angle (rad)'});motionOutput.append(el('p',`Maintained adaptive RK4; declared inertia ${settings.inertia} kg·m², command ${settings.command} N·m, initial θ ${initial.position} rad and ω ${initial.rate} rad/s. Conditional simulation, not observed motion.`));}catch(error){motionOutput.append(el('p','Execution refused: '+error.message));}};
    const raw=el('details'),pre=el('pre');raw.append(el('summary','Original source, complete profile and frozen coefficients'),pre);pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';pre.textContent=JSON.stringify({source:session.base.source,...result},null,2);output.append(raw);
    for(const note of result.limitations)output.append(el('p',note));
  }
  run.onclick=()=>{invalidate('Computing complete training-only frequency profile…');const token=revision,sourceToken=getSourceGeneration();
    try{if(session.discovery.options.loss&&session.discovery.options.loss!=='least_squares')throw Error('This investigation requires an ordinary least-squares Studio source. Change the declared loss explicitly first.');
      const requested=frequencySettings({...settings,...Object.fromEntries(Object.entries(inputs).map(([k,n])=>{if(!n.value.trim())throw Error('Every profile setting needs a number.');return [k,Number(n.value)];}))});
      worker=new Worker(new URL('./angular-frequency-worker.mjs',import.meta.url),{type:'module'});run.disabled=true;cancel.disabled=false;
      worker.onmessage=({data})=>{if(token!==revision||!details.isConnected)return;if(sourceToken!==getSourceGeneration()){invalidate('A newer Studio source operation retired this result. Recompute from the accepted source.');return;}stop();run.disabled=false;cancel.disabled=true;if(data.error)invalidate('Inference refused: '+data.error);else display(data.result);};
      worker.onerror=()=>{if(token===revision)invalidate('Inference worker failed; no partial result accepted.');};worker.postMessage({training:session.discovery.observations,settings:requested});
    }catch(error){invalidate('Inference refused: '+error.message);}
  };
  save.onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([exportAngularFrequencyInputs(session,report.settings)],{type:'application/json'})),a=el('a');a.href=url;a.download='worldlaw-angular-frequency.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  file.onchange=async()=>{const chosen=file.files?.[0];if(!chosen)return;invalidate('Reading source-only frequency notebook…');const token=revision,sourceToken=getSourceGeneration();try{if(chosen.size>2000000)throw Error('Inputs exceed 2 MB.');const text=await chosen.text();if(token!==revision||!details.isConnected)return;if(sourceToken!==getSourceGeneration()){invalidate('A newer Studio source operation retired this result. Recompute from the accepted source.');return;}const restored=restoreAngularFrequencyInputs(text);onReopen(restored.session,restored.settings);}catch(error){if(token===revision)invalidate('Reopen refused: '+error.message);}finally{file.value='';}};
}
