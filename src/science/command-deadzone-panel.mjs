import * as asymmetric from './asymmetric-command-deadzone.mjs';
import {compareCommandDeadzones,evaluateDeadzone,predictDeadzone,simulateDeadzone,exportDeadzoneInputs,restoreDeadzoneInputs,checkedWidths} from './command-deadzone.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(tag==='p'){n.style.color='#36514b';n.style.fontSize='.875rem';n.style.lineHeight='1.5';}return n;};
const fmt=x=>x===null?'No receiving rows':typeof x==='string'?x:Number(x.toPrecision(6)).toString();
export function renderCommandDeadzone(container,session,{chart,onReopen,simulationInputs,widths=null}) {
  container.commandDeadzoneDispose?.();
  container.replaceChildren();
  const plotWidth=()=>Math.max(280,Math.min(580,container.clientWidth));
  let redraw=null,lastWidth=container.clientWidth;
  const observer=new ResizeObserver(()=>{const width=container.clientWidth;if(width!==lastWidth){lastWidth=width;redraw?.();}});
  observer.observe(container);container.commandDeadzoneDispose=()=>observer.disconnect();
  const reopenedAsymmetric=Boolean(widths?.asymmetric);if(reopenedAsymmetric)widths=widths.widths;
  const mode=el('input');mode.type='checkbox';mode.id='deadzone-asymmetric';mode.checked=reopenedAsymmetric;
  const modeLabel=el('label','Compare separate negative / positive thresholds from the complete declared grid ');modeLabel.prepend(mode);
  const evaluateCandidate=(c,rows)=>mode.checked?asymmetric.evaluateAsymmetricDeadzone(c,rows):evaluateDeadzone(c,rows);
  const predictCandidate=(c,row)=>mode.checked?asymmetric.predictAsymmetricDeadzone(c,row):predictDeadzone(c,row);
  const simulateCandidate=(c,initial,settings)=>mode.checked?asymmetric.simulateAsymmetricDeadzone(c,initial,settings):simulateDeadzone(c,initial,settings);
  const details=el('details');details.id='command-deadzone';details.open=widths!==null;
  details.append(el('summary','Investigate a static command dead zone'));
  details.append(el('p','Could a symmetric command threshold explain the response before changing mechanical terms? Compare executable laws using u′ = sign(u) max(0, |u| − d). The default assumes a memoryless, centered command map. The optional separate-threshold comparison uses u′=u−p above p, u′=u+n below −n, and zero between. Neither identifies actuator physics, hysteresis or delay.'));
  const label=el('label','Declared half-widths d (N·m), comma separated; include 0 '),input=el('input');input.id='deadzone-widths';input.type='text';input.value=(widths??[0,.25,.5,.75]).join(', ');label.append(input);
  const run=el('button','Compare command mappings');run.type='button';run.id='deadzone-run';run.className='button button-dark';
  const save=el('button','Save comparison inputs');save.type='button';save.id='deadzone-save';save.disabled=true;save.className='button';
  const openLabel=el('label','Reopen comparison inputs '),file=el('input');file.type='file';file.accept='.json';file.id='deadzone-open';openLabel.append(file);
  const output=el('div','No command-map comparison computed.');output.id='deadzone-output';output.setAttribute('role','status');
  let report=null,revision=0;
  const readWidths=()=>{const parts=input.value.split(',');if(parts.some(x=>!x.trim()))throw Error('Every width must be a number.');return checkedWidths(parts.map(Number));};
  input.addEventListener('input',()=>{revision++;report=null;redraw=null;save.disabled=true;delete output.dataset.status;output.replaceChildren(el('p','Declaration changed. Recompute before interpreting or saving a comparison.'));});
  mode.addEventListener('change',()=>input.dispatchEvent(new Event('input')));
  run.addEventListener('click',()=>{
    revision++;report=null;redraw=null;save.disabled=true;output.replaceChildren();delete output.dataset.status;
    try {
      if(mode.checked){
        report=asymmetric.compareAsymmetricCommandDeadzones(session.discovery.observations,readWidths(),session.discovery.options);
        for(const c of report.candidates)c.width=`${fmt(c.negative)} / ${fmt(c.positive)}`;
        report.competitiveWidths=report.competitive.map(c=>`${fmt(c.negative)} / ${fmt(c.positive)}`);
      }else report=compareCommandDeadzones(session.discovery.observations,readWidths(),session.discovery.options);
      const baseline=report.candidates.find(c=>mode.checked?c.negative===0&&c.positive===0:c.width===0);
      output.dataset.status='computed';
      output.append(el('h4',`Training-ranked threshold(s): ${fmt(report.selected.width)} N·m`));
      output.append(el('p',report.options.loss==='soft_l1'?`Fitting assumption: soft-L1 at ${report.options.lossScale} N·m scale. Ranking uses that declared loss; every raw residual remains in the RMSE below. Reduced loss influence does not identify faulty readings.`:report.options.loss==='weighted_least_squares'?`Fitting assumption: weighted least squares with the original declared torque-noise ratios. Ranking and adequacy use ratio-normalized residuals against reference noise ${report.options.noiseSigma} N·m. The table retains raw torque errors. Ratios are assumptions, not verified reliability.`:'Fitting assumption: ordinary least squares. Every original training reading contributes to the fitted objective.'));
      if(mode.checked)output.append(el('p',`Threshold pairs are negative / positive magnitudes. The complete Cartesian grid includes every symmetric alternative; best symmetric mapping ${fmt(report.symmetricSelected.width)} N·m has receiving RMSE ${fmt(evaluateCandidate(report.symmetricSelected,session.base.heldOut).rmse)} N·m. Conditional grid scores do not penalize threshold search.`));
      output.append(el('p',`Competitive declared widths: ${report.competitiveWidths.map(fmt).join(', ')} N·m. Ties retain the declared family’s deterministic ordering. This ranking uses only training readings; no mapping replaces the Studio model.`));
      const table=el('table');table.style.width='100%';table.style.tableLayout='fixed';table.style.fontSize='.78rem';table.style.overflowWrap='anywhere';table.append(el('caption','All declared widths · torque errors in N·m'));
      const header=el('tr');for(const t of ['d (N·m)','Training RMSE (N·m)','Receiving RMSE (N·m)','Training adequacy'])header.append(el('th',t));table.append(header);
      const short=x=>x===null?'No rows':Number(x.toPrecision(3)).toString();
      for(const candidate of report.candidates){const row=el('tr');row.append(el('th',fmt(candidate.width)),el('td',short(candidate.model.metrics.rmse)),el('td',short(evaluateCandidate(candidate,session.base.heldOut).rmse)),el('td',candidate.diagnostics.adequacy==='residual_mismatch'?'Mismatch':'Not falsified'));table.append(row);}
      const scroll=el('div');scroll.style.overflowX='auto';scroll.append(table);output.append(scroll);
      output.append(el('p',`Full comparison work reservation: ${report.work.reserved} / ${report.work.limit}. ${session.base.heldOut.length} receiving rows are excluded from fitting and ranking. Width ambiguity, a low score or a good training fit does not establish correct physics.`));
      if(report.work.robustReserved)output.append(el('p',`Complete soft-L1 family reservation: ${report.work.robustReserved} / ${report.work.robustLimit}, including the maintained iteration and line-search limits at every width. No partial family is ranked.`));
      if(report.candidates.some(c=>c.mappedCommandSupport<2))output.append(el('p','At least one mapped command has fewer than two distinct training values. Its gain/width is unsupported; a mechanical-only fit can still rank well.'));
      const selectLabel=el('label','Inspect a declared mapping '),select=el('select');select.id='deadzone-inspect';
      for(const c of report.candidates){const option=el('option',`${fmt(c.width)} N·m`);option.value=String(c.width);select.append(option);}select.value=String(report.selected.width);selectLabel.append(select);output.append(selectLabel);
      const modelText=el('p'),plot=el('div'),residual=el('div'),source=el('details'),sourcePre=el('pre');plot.id='deadzone-response-chart';residual.id='deadzone-receiving-chart';
      source.append(el('summary','Inspect original rows, mapped inputs, coefficients and diagnostics'),sourcePre);sourcePre.style.whiteSpace='pre-wrap';sourcePre.style.overflowWrap='anywhere';
      output.append(modelText,plot,residual,source);
      const motionButton=el('button','Compare motion using Studio solver inputs'),motion=el('div');motionButton.type='button';motionButton.id='deadzone-motion';motionButton.className='button';motion.id='deadzone-motion-result';output.append(motionButton,motion);
      let motionSeries=null;
      const inspect=(preserveMotion=false)=>{
        if(!preserveMotion){motion.replaceChildren();motionSeries=null;}
        const candidate=report.candidates.find(c=>String(c.width)===select.value);
        const training=evaluateCandidate(candidate,report.training),receiving=evaluateCandidate(candidate,session.base.heldOut);
        modelText.textContent=`Conditional equation (u means mapped u′ here): ${candidate.model.equation}. Inspecting changes no ranking.`;
        // Draw a declared zero-angle/zero-rate sweep; actual rows retain their
        // own states and appear separately as residuals, never on this slice.
        const lo=candidate.originalCommandRange.min,hi=candidate.originalCommandRange.max;
        const sweep=Array.from({length:121},(_,i)=>({command:lo+(hi-lo)*i/120,position:0,rate:0}));
        chart(plot.id,[{name:'Zero-width model · θ=ω=0',color:'#1c7562',line:true,points:sweep.map(r=>({x:r.command,y:predictCandidate(baseline,r)}))},{name:`d=${fmt(candidate.width)} · θ=ω=0`,color:'#bd502f',line:true,points:sweep.map(r=>({x:r.command,y:predictCandidate(candidate,r)}))}],{width:plotWidth(),xLabel:'Original command u (N·m)',yLabel:'Predicted torque (N·m)'});
        chart(residual.id,[{name:'Training residual · original states',color:'#1c7562',points:training.rows.map(r=>({x:r.command,y:r.residual}))},{name:'Receiving residual · original states',color:'#bd502f',points:receiving.rows.map(r=>({x:r.command,y:r.residual}))}],{width:plotWidth(),xLabel:'Original command u (N·m)',yLabel:'Torque residual (N·m)'});
        if(motionSeries)chart('deadzone-motion-chart',motionSeries,{width:plotWidth(),xLabel:'Simulated time (s)',yLabel:'Conditional angle (rad)'});
        sourcePre.textContent=JSON.stringify({source:session.base.source,width:candidate.width,terms:candidate.model.terms,diagnostics:candidate.diagnostics,training:training.rows,receiving:receiving.rows},null,2);
      };select.addEventListener('change',()=>inspect());inspect();redraw=()=>inspect(true);
      motionButton.addEventListener('click',()=>{
        motion.replaceChildren();motionSeries=null;
        try {
          const candidate=report.candidates.find(c=>String(c.width)===select.value),{initial,settings}=simulationInputs();
          const original=simulateCandidate(baseline,initial,settings),revised=simulateCandidate(candidate,initial,settings);
          const plot=el('div');plot.id='deadzone-motion-chart';motion.append(plot);
          motionSeries=[{name:'Zero-width law',color:'#1c7562',line:true,points:original.map(r=>({x:r.time,y:r.position}))},{name:`d=${fmt(candidate.width)} law`,color:'#bd502f',line:true,points:revised.map(r=>({x:r.time,y:r.position}))}];
          chart(plot.id,motionSeries,{width:plotWidth(),xLabel:'Simulated time (s)',yLabel:'Conditional angle (rad)'});
          motion.append(el('p',`Frozen execution settings: original constant command ${settings.command} N·m; inertia ${settings.inertia} kg·m²; initial angle ${initial.position} rad and rate ${initial.rate} rad/s; duration ${settings.duration} s, step ${settings.dt} s. Both use the maintained RK4 solver. These are conditional predictions, not observed motion or a numerical convergence certificate. Editing Studio inputs requires another execution.`));
        }catch(error){motion.replaceChildren(el('p','Conditional motion refused: '+error.message));}
      });
      output.append(el('p','The response sweep fixes θ=0 rad and ω=0 rad/s; it is a conditional model prediction and may be outside measured state support. Residual points use each original row’s actual state. Different mechanical terms may compensate for a wrong command mapping.'));
      output.append(el('p',report.interpretation));save.disabled=false;
    } catch(error){report=null;redraw=null;save.disabled=true;delete output.dataset.status;output.replaceChildren(el('p','Command-map comparison refused: '+error.message));}
  });
  save.addEventListener('click',()=>{try{if(!report)throw Error('Compute a complete comparison first.');const text=mode.checked?asymmetric.exportAsymmetricDeadzoneInputs(session,readWidths()):exportDeadzoneInputs(session,readWidths()),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a');a.href=url;a.download='worldlaw-command-deadzone-inputs.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}catch(error){output.append(el('p',error.message));}});
  file.addEventListener('change',async()=>{const current=++revision,selected=file.files?.[0];if(!selected)return;report=null;redraw=null;save.disabled=true;delete output.dataset.status;output.replaceChildren(el('p','Reading replacement comparison inputs…'));
    try{if(selected.size>2_000_000)throw Error('Comparison input exceeds 2 MB.');const text=await selected.text();if(current!==revision||!details.isConnected)return;const isAsymmetric=JSON.parse(text)?.schema===asymmetric.ASYMMETRIC_DEADZONE_SCHEMA;const restored=isAsymmetric?asymmetric.restoreAsymmetricDeadzoneInputs(text):restoreDeadzoneInputs(text);onReopen(restored.session,isAsymmetric?{asymmetric:true,widths:restored.widths}:restored.widths);}catch(error){if(current===revision&&details.isConnected)output.replaceChildren(el('p','Reopen refused: '+error.message));}finally{file.value='';}
  });
  const controls=el('div');controls.style.display='flex';controls.style.flexWrap='wrap';controls.style.gap='10px';controls.style.margin='10px 0';controls.append(run,save);
  details.append(label,modeLabel,controls,openLabel,output,el('p','Save comparison inputs retains the original portable notebook and width declarations, never fitted results. Reopening replaces the Studio source with those original inputs; explicitly compare again to recompute. Ordinary Studio saves retain their existing format.'));container.append(details);
}
