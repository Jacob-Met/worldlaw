import {readSensorRecording,freezeSensorResponse,receiveSensorResponse,sensorTrainingPredictions,exportSensorResponseInputs,restoreSensorResponseInputs,decodeSensorCSV,RESPONSE_CONVENTION} from './sensor-response.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(tag==='p'){n.style.color='#36514b';n.style.fontSize='.875rem';n.style.lineHeight='1.5';}return n;};
const fmt=x=>Number(x.toPrecision(6)).toString();
export function mountSensorResponse(container,{chart}){
  container.style.color='#36514b';container.style.fontSize='.875rem';container.style.lineHeight='1.5';
  const details=el('details');details.id='sensor-response';details.append(el('summary','Challenge a measured link-side torque response'));
  details.append(el('p','Keep the measurement’s role intact. A link-side torque sensor reading is not net torque. Fit a conditional response to the recorded command, angle and rate, then challenge the frozen fit with another recording. No model here replaces the Studio motion law.'));
  const jointLabel=el('label','Franka joint (1–7) '),joint=el('input');joint.id='sensor-joint';joint.type='number';joint.min='1';joint.max='7';joint.step='1';joint.value='4';jointLabel.append(joint);
  const roleLabel=el('label'),role=el('input');role.id='sensor-convention';role.type='checkbox';roleLabel.append(role,document.createTextNode(' I declare NAD Franka SI channels: timestamp in s; pos/vel in rad and rad/s; tau_d is controller command and tau is link-side sensor torque in N·m. This declaration does not calibrate the sensor.'));
  const trainingLabel=el('label','Original training CSV '),trainingFile=el('input');trainingFile.type='file';trainingFile.accept='.csv';trainingFile.id='sensor-training';trainingLabel.append(trainingFile);
  const widthLabel=el('label','Offered command half-widths (N·m), including zero '),widths=el('input');widths.id='sensor-widths';widths.value='0, .1, .25, .5, .75, 1';widthLabel.append(widths);
  const noiseLabel=el('label','Declared residual scale (N·m), not calibrated uncertainty '),noise=el('input');noise.id='sensor-noise';noise.type='number';noise.min='.000000000001';noise.step='any';noise.value='.1';noiseLabel.append(noise);
  const fit=el('button','Freeze training comparison');fit.type='button';fit.className='button button-dark';fit.id='sensor-freeze';
  const receivingLabel=el('label','Separate receiving CSV · enabled only after freeze '),receivingFile=el('input');receivingFile.type='file';receivingFile.accept='.csv';receivingFile.disabled=true;receivingFile.id='sensor-receiving';receivingLabel.append(receivingFile);
  const save=el('button','Save original response inputs');save.id='sensor-save';save.className='button';save.type='button';save.disabled=true;
  const openLabel=el('label','Reopen original response inputs '),open=el('input');open.type='file';open.accept='.json';open.id='sensor-open';openLabel.append(open);
  const status=el('p','Load a training recording and declare its channel convention.');status.id='sensor-status';status.setAttribute('role','status');
  const output=el('div');output.id='sensor-result';
  const controls=el('div');controls.style.display='grid';controls.style.gap='12px';controls.style.margin='12px 0';controls.append(jointLabel,roleLabel,trainingLabel,widthLabel,noiseLabel,fit,receivingLabel,save,openLabel);
  details.append(controls,status,output);container.append(details);
  let original=null,frozen=null,receiving=null,result=null,revision=0,chosen=null,redraw=null;
  let fitOptions={terms:['command','rate','coulomb','spring','gravity','quadratic','bias'],maxTerms:4,noiseSigma:.1,ambiguityDelta:6};
  function clear(message){revision++;frozen=null;receiving=null;result=null;redraw=null;output.replaceChildren();receivingFile.disabled=true;receivingFile.value='';save.disabled=true;status.textContent=message;delete output.dataset.frozen;}
  for(const input of [joint,role,widths,noise])input.addEventListener('input',()=>clear('Declaration changed. Freeze again before receiving; previous fitted and receiving claims are retired.'));
  trainingFile.addEventListener('change',async()=>{clear('Reading original training CSV…');original=null;const file=trainingFile.files?.[0],current=revision;if(!file)return;try{if(file.size>2_000_000)throw Error('CSV exceeds 2 MB.');const csv=decodeSensorCSV(await file.arrayBuffer());if(current!==revision)return;original={csv,label:file.name};status.textContent=`Original training source ${file.name} loaded. Declare its convention and freeze before receiving.`;}catch(e){if(current===revision)status.textContent='Training intake refused: '+e.message;}});
  const declaration=label=>({joint:Number(joint.value),label,convention:role.checked?RESPONSE_CONVENTION:null});
  fit.addEventListener('click',async()=>{clear('Admitting original training rows and freezing comparison…');const current=revision;try{
    if(!original)throw Error('Load original training CSV first.');
    const source=await readSensorRecording(original.csv,declaration(original.label));if(current!==revision)return;
    const parts=widths.value.split(',');if(parts.some(x=>!x.trim()))throw Error('Declare every width explicitly.');
    const options={...fitOptions,noiseSigma:Number(noise.value)};
    frozen=freezeSensorResponse(source,parts.map(Number),options);chosen=frozen.selectedWidth;receivingFile.disabled=false;save.disabled=false;draw();status.textContent='Training comparison frozen. Load a separately identified recording to challenge these unchanged models.';
  }catch(e){if(current===revision)status.textContent='Training freeze refused: '+e.message;}});
  receivingFile.addEventListener('change',async()=>{const file=receivingFile.files?.[0],current=++revision;receiving=null;result=null;if(!frozen||!file)return;draw();status.textContent='Reading separate receiving source; training fit remains frozen…';try{
    if(file.size>2_000_000)throw Error('CSV exceeds 2 MB.');const csv=decodeSensorCSV(await file.arrayBuffer());if(current!==revision)return;
    const source=await readSensorRecording(csv,declaration(file.name));if(current!==revision)return;
    const got=receiveSensorResponse(frozen,source);receiving=source;result=got;draw();status.textContent='Separate recording received against frozen training models. Receiving errors do not change the selected width or coefficients.';
  }catch(e){if(current===revision)status.textContent='Receiving refused: '+e.message;}});
  function draw(){
    output.replaceChildren();if(!frozen)return;output.dataset.frozen=frozen.source.sha256;
    output.append(el('h4',`Frozen training choice: d = ${fmt(frozen.selectedWidth)} N·m`));
    output.append(el('p',`Joint ${frozen.source.joint} · ${frozen.source.rows.length} original training rows · source ${frozen.source.label}. Competitive offered widths: ${frozen.competitiveWidths.map(fmt).join(', ')} N·m. ${frozen.options.loss==='soft_l1'?'Soft-L1':'Ordinary least squares'}; declared basis ${frozen.options.terms.join(', ')}, at most ${frozen.options.maxTerms} terms. The residual scale is a caller assumption.`));
    const identity=el('p',`Training SHA-256: ${frozen.source.sha256}${receiving?`; receiving SHA-256: ${receiving.sha256}`:''}`);identity.style.overflowWrap='anywhere';output.append(identity);
    const table=el('table');table.style.width='100%';table.style.tableLayout='fixed';table.style.fontSize='.78rem';table.style.overflowWrap='anywhere';const head=el('tr');for(const t of ['Width N·m','Training RMSE N·m','Receiving RMSE N·m','Training adequacy'])head.append(el('th',t));table.append(head);
    for(const c of frozen.candidates){const row=el('tr'),held=result?.candidates.find(r=>r.width===c.width);row.append(el('td',fmt(c.width)),el('td',fmt(c.metrics.rmse)),el('td',held?fmt(held.rmse):'Not received'),el('td',c.diagnostics.adequacy==='residual_mismatch'?'Mismatch':'Not falsified'));table.append(row);}output.append(table);
    const selectLabel=el('label','Inspect frozen candidate '),select=el('select');select.id='sensor-inspect';for(const c of frozen.candidates){const option=el('option',`d = ${fmt(c.width)} N·m`);option.value=String(c.width);select.append(option);}select.value=String(chosen);selectLabel.append(select);output.append(selectLabel);
    const equation=el('p'),plot=el('div'),residual=el('div');plot.id='sensor-prediction-chart';residual.id='sensor-residual-chart';output.append(equation,plot,residual);
    const custody=el('details'),raw=el('pre');custody.append(el('summary','Inspect original row numbers, measured responses and frozen predictions'),raw);raw.style.whiteSpace='pre-wrap';raw.style.overflowWrap='anywhere';output.append(custody);
    const training=sensorTrainingPredictions(frozen);
    function inspect(){chosen=Number(select.value);const c=frozen.candidates.find(c=>c.width===chosen),rows=(result?.candidates??training).find(c=>c.width===chosen).rows,kind=result?'Separate recording':'Training';
      equation.textContent=`Conditional sensor equation: ${c.equation.replaceAll('τ','sensor τ')}. Here u means mapped u′ = sign(u) max(0, |u| − ${fmt(chosen)}), from the original command. Basis labels express algebra, not identified gravity, friction or stiffness. ${kind}: ${rows.length} original rows. No temporal interpolation or response filtering.`;
      const width=Math.max(280,Math.min(580,container.clientWidth));
      chart(plot.id,[{name:`${kind} · observed sensor`,color:'#1c7562',line:true,points:rows.map(r=>({x:r.time,y:r.response}))},{name:`Frozen d=${fmt(chosen)} prediction`,color:'#bd502f',line:true,points:rows.map(r=>({x:r.time,y:r.prediction}))}],{width,xLabel:'Original recording time (s)',yLabel:'Link-side sensor torque (N·m)'});
      chart(residual.id,[{name:`${kind} · every residual`,color:'#bd502f',points:rows.map(r=>({x:r.time,y:r.residual}))}],{width,xLabel:'Original recording time (s)',yLabel:'Observed − predicted (N·m)'});
      raw.textContent=JSON.stringify({joint:frozen.source.joint,role:frozen.role,terms:c.terms,rows},null,2);
    }select.addEventListener('change',inspect);inspect();redraw=inspect;
    output.append(el('p',frozen.interpretation),el('p',`Full training work reserved: ${frozen.work.reserved}/${frozen.work.limit}. Receiving uses original contemporaneous measured state; it does not predict that state. Recording identity and channel declarations cannot verify calibration or independence.`),el('p','Motion simulation and net-torque adoption are unavailable for this response type. Save retains original CSV and declarations; reopening freezes from training before evaluating saved receiving rows.'));
  }
  let lastWidth=container.clientWidth;const observer=new ResizeObserver(()=>{if(container.clientWidth!==lastWidth){lastWidth=container.clientWidth;redraw?.();}});observer.observe(container);
  save.addEventListener('click',()=>{try{const text=exportSensorResponseInputs(frozen,receiving),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a');a.href=url;a.download='worldlaw-link-sensor-response-inputs.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}catch(e){status.textContent='Save refused: '+e.message;}});
  open.addEventListener('change',async()=>{clear('Reopening original response inputs…');original=null;const file=open.files?.[0],current=revision;if(!file)return;try{
    if(file.size>5_000_000)throw Error('Notebook exceeds 5 MB.');const text=decodeSensorCSV(await file.arrayBuffer()).replace(/^\uFEFF/,'');if(current!==revision)return;const restored=await restoreSensorResponseInputs(text);if(current!==revision)return;
    trainingFile.value='';frozen=restored.frozen;fitOptions={...frozen.options};original={csv:JSON.parse(text).training.csv,label:frozen.source.label};receiving=restored.receiving;result=restored.result;chosen=frozen.selectedWidth;joint.value=String(frozen.source.joint);role.checked=true;widths.value=frozen.candidates.map(c=>c.width).join(', ');noise.value=String(frozen.options.noiseSigma);receivingFile.disabled=false;save.disabled=false;draw();status.textContent='Reopened original inputs: training-only freeze recomputed, saved receiving recording evaluated separately.';
  }catch(e){if(current===revision)status.textContent='Reopen refused: '+e.message;}finally{open.value='';}});
}
