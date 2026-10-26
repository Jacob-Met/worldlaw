import {evaluate,TERMS} from './torque-discovery.mjs';
import {inspectExperimentReceipt} from './experiment-receipts.mjs';

const views=new WeakMap();
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const fmt=value=>Number.isFinite(value)?Number(value.toPrecision(6)).toLocaleString('en-US',{maximumFractionDigits:9}):'—';
function control(text,node){const label=el('label',text);label.append(node);return label;}

export function renderExperimentReceipts(host,state,{chart}) {
  const experiments=state.history.flatMap((entry,index)=>entry.experiment?[{entry,index}]:[]);
  const previous=views.get(host);
  previous?.observer?.disconnect();
  // New acquisitions open their own comparison. Refits and model inspection do
  // not rewrite or silently redirect an already selected historical experiment.
  const last=experiments.at(-1)?.entry.experiment;
  const view=previous&&previous.last===last?previous:{last,eventIndex:experiments.at(-1)?.index,modelIndex:0};
  view.observer=null;
  views.set(host,view);host.replaceChildren();
  const title=el('h3','Predictions before learning the outcome');
  host.append(title,el('p','Inspect the laws from before each measurement update, then compare their predictions with the actual entered outcome. These comparisons are recomputed from earlier notebook evidence; they do not authenticate acquisition time or independent measurements.'));
  if(!experiments.length){host.append(el('p','Record an instrument outcome or run a virtual experiment to compare what the earlier laws predicted. Refitting alone creates no new outcome.'));return;}
  const events=el('select');events.id='experiment-receipt-event';
  for(const {entry,index} of experiments){const option=el('option',`${index}. ${entry.label} · ${entry.experiment.rows.length} reading(s)`);option.value=String(index);events.append(option);}
  events.value=String(view.eventIndex);
  const selected=experiments.find(item=>item.index===view.eventIndex)??experiments.at(-1);
  const receipt=selected.entry.experiment;
  const provenance=el('p',`${state.base.source.label} · ${selected.entry.kind==='virtual'?'synthetic virtual instrument':'user-entered outcomes; source not independently authenticated'}. ${receipt.beforeCount} earlier training rows; ${receipt.models.length} original competitive laws. All rows in this batch use the same earlier fit.`);
  const laws=el('select');laws.id='experiment-receipt-law';
  receipt.models.forEach((model,index)=>{const option=el('option',`${index+1}. ${model.id}${model.id===receipt.selectedBeforeId?' · earlier training choice':''} · ${model.equation}`);option.value=String(index);laws.append(option);});
  laws.value=String(Math.min(view.modelIndex,receipt.models.length-1));
  const summary=el('p');summary.id='experiment-receipt-summary';summary.setAttribute('aria-live','polite');
  const equation=el('p');equation.id='experiment-receipt-equation';
  const coefficients=el('details');coefficients.append(el('summary','Inspect exact earlier coefficients'));
  const coefficientBody=el('div');coefficients.append(coefficientBody);
  const plot=el('div');plot.id='experiment-receipt-chart';
  const details=el('details');details.id='experiment-receipt-readings';details.append(el('summary','Inspect every original reading and prediction'));
  const tableHost=el('div');tableHost.className='prediction-sensitivity-scroll';tableHost.tabIndex=0;tableHost.setAttribute('role','region');tableHost.setAttribute('aria-label','Original experiment readings and pre-update predictions');details.append(tableHost);
  host.append(control('Experiment ',events),provenance,control('Earlier competitive law (training order) ',laws),equation,coefficients,summary,plot,details,
    el('p',`Earlier fitting assumption: ${receipt.options.loss??'least_squares'}${receipt.options.loss==='soft_l1'?` at ${fmt(receipt.options.lossScale)} N·m scale`:''}; assumed noise ${fmt(receipt.options.noiseSigma)} N·m. Errors here use every raw torque reading. Laws remain in their earlier training order; receiving errors do not re-rank this comparison.`),
    el('p','The after-fit result reuses these outcomes and is not a new prediction test. Different updates may use different laws and adaptively chosen inputs; their errors are not a fixed-model held-out score. Competitive-model spread is not calibrated uncertainty.'));
  let plottedWidth=null,plottedBefore=null,plottedAfter=null;
  const redrawPlot=()=>{
    if(!plot.isConnected||!plottedBefore)return;
    const width=Math.max(280,Math.min(580,plot.clientWidth||580));
    if(width===plottedWidth)return;
    plottedWidth=width;
    chart(plot.id,[
      {name:'Before update prediction',color:'#b14e31',points:plottedBefore.rows.map(row=>({x:row.jointTorque,y:row.prediction}))},
      {name:'After fit · outcome reused',color:'#1c7562',points:plottedAfter.rows.map(row=>({x:row.jointTorque,y:row.prediction}))},
    ],{xLabel:'Observed torque (N·m)',yLabel:'Predicted torque (N·m)',diagonal:true,width});
  };
  const draw=()=>{
    const index=Number(laws.value);view.modelIndex=index;
    const inspected=inspectExperimentReceipt(receipt,index);
    const after=evaluate(receipt.selectedAfter,receipt.rows);
    equation.textContent=`Before update: ${inspected.model.equation}. After learning: ${receipt.selectedAfter.equation} (${receipt.selectedAfter.id}). Exact earlier coefficients are retained in the recomputed comparison.`;
    coefficientBody.replaceChildren();
    if(!inspected.model.terms.length)coefficientBody.append(el('p','Zero torque; no coefficients.'));
    for(const term of inspected.model.terms){const definition=TERMS.find(item=>item.id===term.id);coefficientBody.append(el('p',`${term.id}: ${String(term.coefficient)} ${definition?.coefficientUnit??''}`));}
    summary.textContent=`Earlier law ${inspected.model.id}: prediction RMSE ${fmt(inspected.rmse)} N·m; largest absolute error ${fmt(inspected.maxAbsResidual)} N·m. After-fit training choice on these same readings: ${fmt(after.rmse)} N·m RMSE. ${inspected.rows.filter(row=>row.extrapolation.length).length} of ${inspected.count} readings extend beyond at least one earlier observed input range.`;
    summary.dataset.beforeRmse=String(inspected.rmse);summary.dataset.afterRmse=String(after.rmse);
    plottedBefore=inspected;plottedAfter=after;plottedWidth=null;redrawPlot();
    // The full row table is lazy as well: large batches never allocate a table
    // for every original competing model or every previous notebook update.
    tableHost.replaceChildren();
    const fill=()=>{
      if(!details.open||tableHost.childElementCount)return;
      const table=el('table'),head=el('thead'),tr=el('tr');
      for(const text of ['Batch row','Command N·m','Angle rad','Rate rad/s','Observed N·m','Before prediction N·m','Observed − before N·m','Outside earlier ranges']){const th=el('th',text);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
      const body=el('tbody');
      inspected.rows.forEach(row=>{const r=el('tr');r.dataset.sourceRow=String(row.index);for(const value of [String(row.index+1),String(row.command),String(row.position),String(row.rate),String(row.jointTorque),String(row.prediction),String(row.residual),row.extrapolation.join(', ')||'none'])r.append(el('td',value));body.append(r);});
      table.append(body);tableHost.append(table);
    };
    details.ontoggle=fill;fill();
  };
  laws.addEventListener('change',draw);
  events.addEventListener('change',()=>{view.eventIndex=Number(events.value);view.modelIndex=0;renderExperimentReceipts(host,state,{chart});host.querySelector('#experiment-receipt-event').focus();});
  draw();
  view.observer=new ResizeObserver(redrawPlot);
  view.observer.observe(plot);
}
