import {residualEpochs} from './residual-epochs.mjs';
const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const fmt=value=>Number.isFinite(value)?Number(value.toPrecision(5)).toString():'undefined';
export function createResidualEpochPanel(parent){
  const host=element('section');host.id='residual-epochs';host.hidden=true;
  const style=element('style','#residual-epochs{border-top:2px solid #b85c26;margin-top:24px;padding-top:16px;min-width:0}#residual-epochs[hidden],#residual-epochs [hidden]{display:none}#residual-epochs .epoch-scroll{overflow:auto;max-height:360px}#residual-epochs .epoch-controls{display:flex;flex-wrap:wrap;gap:12px}#residual-epochs .epoch-controls label{flex:1 1 180px;min-width:0}#residual-epochs svg{display:block;width:100%;height:auto}');
  host.append(style,element('h3','When does the frozen prediction fail?'),element('p','Partition the complete original source time span. Compare error magnitude across epochs while keeping the same forecast, original observations and full-receiving mean. A partition does not restart the model.'));
  const boundaryLabel=element('label','Source-time boundaries in seconds, including exact original first and last times');
  const boundaryInput=element('input');boundaryInput.id='residual-epoch-boundaries';boundaryLabel.append(boundaryInput);
  const inspect=element('button','Attribute errors across the complete recording');inspect.id='inspect-residual-epochs';inspect.type='button';inspect.className='button outline';
  const status=element('p');status.id='residual-epoch-status';status.setAttribute('role','status');
  const summary=element('div');summary.className='epoch-scroll';const plot=element('div');plot.id='residual-epoch-timeline';
  const controls=element('div');controls.className='epoch-controls';
  const scopeLabel=element('label','Inspect original source group'),scope=element('select');scope.id='residual-epoch-scope';scopeLabel.append(scope);
  const bandLabel=element('label','Retained physical-delay band'),band=element('select');band.id='residual-epoch-band';bandLabel.append(band);
  const pageLabel=element('label','Original rows / pairs page'),page=element('select');page.id='residual-epoch-page';pageLabel.append(page);controls.append(scopeLabel,bandLabel,pageLabel);
  const note=element('p');note.id='residual-epoch-page-note';
  const ledger=element('div');ledger.className='epoch-scroll';ledger.id='residual-epoch-ledger';
  host.append(boundaryLabel,inspect,status,summary,plot,controls,note,ledger,element('p','Every source row belongs to one left-open/right-closed epoch. The initial condition is excluded once. Pairs crossing epochs remain separately inspectable; overlapping delay bands still reuse pairs. These are descriptive groups, not independent runs, detected change points or causal explanations. Original-source notebooks recompute the forecast; epoch declarations must be entered again after reopening.'));
  parent.append(host);
  let sourceRows=null,sourceBands=null,result=null,pageIndex=0;
  function clear(message){result=null;pageIndex=0;status.textContent=message;summary.replaceChildren();plot.replaceChildren();scope.replaceChildren();band.replaceChildren();page.replaceChildren();ledger.replaceChildren();note.textContent='';controls.hidden=true;}
  const table=(headers,values)=>{const table=element('table'),tr=element('tr');for(const h of headers){const th=element('th',h);th.scope='col';tr.append(th);}table.append(tr);for(const row of values){const tr=element('tr');for(const value of row)tr.append(element('td',String(value)));table.append(tr);}return table;};
  function timeline(){
    plot.replaceChildren();if(!result)return;
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','-60 0 640 260');svg.setAttribute('role','img');svg.setAttribute('aria-label','Every original receiving residual against source time; declared epoch boundaries do not restart predictions.');
    const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
    const rows=result.source.slice(1),first=result.boundaries[0],last=result.boundaries.at(-1),magnitude=Math.max(...rows.map(r=>Math.abs(r.residual)))||1;
    const x=time=>70+(time-first)/(last-first)*470,y=error=>210-(error/magnitude+1)*85;
    if(scope.value!=='cross'){const epoch=result.epochs[Number(scope.value)];add('rect',{x:x(epoch.startExclusive),y:40,width:x(epoch.endInclusive)-x(epoch.startExclusive),height:170,fill:'#f2dfc7'});}
    for(const time of result.boundaries)add('line',{x1:x(time),x2:x(time),y1:40,y2:210,stroke:'#acb8bc','stroke-dasharray':'3 4'});
    add('line',{x1:70,x2:540,y1:y(0),y2:y(0),stroke:'#52636c'});
    add('polyline',{points:rows.map(r=>`${x(r.time)},${y(r.residual)}`).join(' '),fill:'none',stroke:'#ad5525','stroke-width':1.5});
    for(const[text,xx,yy,anchor]of[['Frozen prediction error (rad)',10,20,'start'],['Original source time (s)',540,250,'end'],[fmt(magnitude),65,45,'end'],[fmt(-magnitude),65,210,'end'],[String(first),70,230,'start'],[String(last),540,230,'end']])add('text',{x:xx,y:yy,'text-anchor':anchor,'font-size':12,fill:'#233f50'},text);
    plot.append(svg);
  }
  function draw(){
    ledger.replaceChildren();if(!result)return;
    const bandIndex=Number(band.value),partition=result.pairPartitions[bandIndex],originalBand=result.physical.reports[bandIndex];
    const cross=scope.value==='cross',epoch=cross?null:result.epochs[Number(scope.value)];
    const entries=cross?partition.crossEpoch.pairs:epoch.rowIndices;
    const pages=Math.max(1,Math.ceil(entries.length/200));pageIndex=Math.min(pageIndex,pages-1);page.replaceChildren();
    for(let i=0;i<pages;i++){const option=element('option',`${i+1} / ${pages}`);option.value=String(i);page.append(option);}page.value=String(pageIndex);
    const visible=entries.slice(pageIndex*200,(pageIndex+1)*200);
    if(cross){
      const values=visible.map(item=>{const p=originalBand.pairs[item.pairIndex];return [item.pairIndex,p.earlier.index,p.later.index,item.earlierEpoch+1,item.laterEpoch+1,p.earlier.time,p.later.time,p.earlier.observed,p.earlier.predicted,p.later.observed,p.later.predicted,p.earlier.residual,p.later.residual];});
      ledger.append(table(['Pair index','Earlier row','Later row','Earlier epoch','Later epoch','Earlier time (s)','Later time (s)','Earlier observed (rad)','Earlier predicted (rad)','Later observed (rad)','Later predicted (rad)','Earlier error (rad)','Later error (rad)'],values));
      note.textContent=`Cross-epoch pairs ${entries.length?pageIndex*200+1:0}–${Math.min((pageIndex+1)*200,entries.length)} of ${entries.length}. ${partition.accountedPairCount}/${partition.pairCount} original band pairs are accounted for. Cross-epoch centered cosine ${fmt(partition.crossEpoch.correlation)} retains the full receiving mean.`;
    }else{
      ledger.append(table(['Original row','Original time (s)','Observed angle (rad)','Frozen prediction (rad)','Error (rad)'],visible.map(i=>{const r=result.source[i];return [r.index,r.time,r.observed,r.predicted,r.residual];})));
      const group=partition.withinEpochs[epoch.epochIndex];
      note.textContent=`Epoch ${epoch.epochIndex+1}, (${epoch.startExclusive}, ${epoch.endInclusive}] s: original rows ${entries.length?pageIndex*200+1:0}–${Math.min((pageIndex+1)*200,entries.length)} of ${entries.length}. ${group.count} within-epoch pairs; centered cosine ${fmt(group.correlation)} uses the unchanged full receiving mean. All crossing pairs remain in the separate group.`;
    }
    timeline();
  }
  boundaryInput.addEventListener('input',()=>clear('Epoch boundaries changed; previous attribution cleared. No forecast is restarted.'));
  scope.addEventListener('change',()=>{pageIndex=0;draw();});band.addEventListener('change',()=>{pageIndex=0;draw();});page.addEventListener('change',()=>{pageIndex=Number(page.value);draw();});
  inspect.addEventListener('click',()=>{
    clear('');try{
      const boundaries=boundaryInput.value.split(',').map(s=>s.trim()===''?NaN:Number(s));result=residualEpochs(sourceRows,{boundaries,bands:sourceBands});
      status.textContent=`${result.accountedSourceCount}/${result.sourceCount} original receiving rows accounted for. Full-recording RMSE ${fmt(result.physical.rmse)} rad. The original forecast and complete physical-delay populations are unchanged.`;
      summary.append(table(['Epoch','Original source interval (s)','Rows','RMSE (rad)','Mean error (rad)','Share of squared error'],result.epochs.map(e=>[e.epochIndex+1,`(${e.startExclusive}, ${e.endInclusive}]`,e.count,fmt(e.rmse),fmt(e.meanError),fmt(e.squaredErrorFraction)])));
      for(const e of result.epochs){const option=element('option',`Epoch ${e.epochIndex+1}: (${e.startExclusive}, ${e.endInclusive}] s`);option.value=String(e.epochIndex);scope.append(option);}const cross=element('option','Pairs crossing epochs');cross.value='cross';scope.append(cross);
      result.physical.reports.forEach((b,i)=>{const option=element('option',`${b.lowerSeconds}–${b.upperSeconds} s`);option.value=String(i);band.append(option);});
      controls.hidden=false;draw();
    }catch(error){clear(error.message);}
  });
  return {render(rows,bands){clear('Declare complete original-source epochs before inspecting attribution.');host.hidden=!rows||!bands;if(host.hidden){sourceRows=null;sourceBands=null;return;}sourceRows=rows.map(r=>({time:r.time,observed:r.observed,predicted:r.predicted}));sourceBands=bands.map(b=>({...b}));const indices=[0,1,2,3,4].map(k=>Math.floor((rows.length-1)*k/4));boundaryInput.value=[...new Set(indices)].map(i=>String(rows[i].time)).join(',');}};
}
