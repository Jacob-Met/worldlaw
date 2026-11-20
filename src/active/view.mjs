import {COUPLED_DEMO_SOURCE_SHA256} from './instrument.mjs';

export const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const approximate=value=>{const [n,d='1']=String(value).split('/');return Number(n)/Number(d);};
export const displayNumber=value=>Number.isFinite(value)?Number(value.toPrecision(5)).toString():'outside display range';
export const plannedTicks=plan=>(plan.chosenReadings??plan.selection??[]).map(row=>row.tick);
export const certified=plan=>['optimal_certified_intervention','optimal_certified_schedule','optimal_certified_control_box'].includes(plan?.status);
const colors=['#6ce4f2','#ffbf69','#c7adff','#9cdea7','#ff9eb0'];
export function finiteDisplayRange(values,padding=.12){
  if(!values.length||!values.every(Number.isFinite))return null;
  let lo=Math.min(...values),hi=Math.max(...values);
  const span=hi-lo||Math.max(1,Math.abs(lo)*.1);lo-=span*padding;hi+=span*padding;
  return [lo,hi,hi-lo].every(Number.isFinite)&&hi>lo?{lo,hi}:null;
}
const shortLabel=(text,length)=>text.length>length?text.slice(0,Math.max(1,length-1))+'…':text;
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+approximate(v)*b[i],0);

/** Numerical display only. Exact decisions always come from the sealed core.
 * These illustrative starts are not fitted states or uncertainty envelopes. */
export function illustrateModels(book){
  const request=JSON.parse(book.sourceText),isDemo=book.plan.sourceSHA256===COUPLED_DEMO_SOURCE_SHA256;
  const controls=request.controls??book.plan.chosenControls??
    request.interventions?.find(row=>row.id===book.plan.chosenIntervention)?.controls??
    request.interventions?.[0]?.controls??request.controlBounds?.map(row=>row.min);
  const traces=request.hypotheses.map((law,index)=>{
    const initial=isDemo?[3,-2]:law.A.map(()=>0);
    let state=initial.slice(),forced=law.A.map(()=>0);const values=[],response=[];
    for(let tick=0;tick<=controls.length;tick++){
      values.push(dot(law.C,state));response.push(dot(law.C,forced));
      if(tick<controls.length){
        const next=x=>law.A.map((row,i)=>dot(row,x)+dot(law.B[i],controls[tick].map(approximate)));
        state=next(state);forced=next(forced);
      }
    }
    return {id:law.id,color:colors[index%colors.length],initial,values,response};
  });
  return {request,controls,traces,isDemo,horizon:controls.length,
    bounded:request.schema==='worldlaw.active-linear-control-box/v1',
    referenceControls:Boolean(request.controlBounds&&!book.plan.chosenControls)};
}

export function witnessProjection(book,readingIndex,pairIndex=0){
  const proof=(book.plan.pairProof??book.plan.proof??[])[pairIndex];
  if(!proof?.witness)return null;
  const data=illustrateModels(book),pairs=[];
  for(let i=0;i<data.traces.length;i++)for(let j=i+1;j<data.traces.length;j++)pairs.push([data.traces[i],data.traces[j]]);
  const pair=pairs[pairIndex],ticks=plannedTicks(book.plan),weights=proof.witness.weights.map(approximate);
  const centers=pair.map(trace=>ticks.reduce((sum,tick,i)=>sum+weights[i]*trace.response[tick],0));
  const radius=approximate(book.plan.noiseBound)*approximate(proof.witness.l1Norm);
  const record=book.readouts[readingIndex];const supplied=record?JSON.parse(record.readingsText):null;
  const values=new Map(supplied?.readings.map(row=>[row.tick,approximate(row.value)])??[]);
  const complete=weights.every((w,i)=>w===0||values.has(ticks[i]));
  const observed=supplied&&complete?ticks.reduce((sum,tick,i)=>sum+(weights[i]===0?0:weights[i]*values.get(tick)),0):null;
  const finite=[...centers,radius,...(observed==null?[]:[observed])].every(Number.isFinite);
  return {proof,pair,ticks,weights,centers,radius,observed,finite,acquisition:supplied?.acquisition??null};
}

export function drawApparatus(host,book,tick,readingIndex){
  const data=illustrateModels(book),record=book.readouts[readingIndex];
  const observed=record?JSON.parse(record.readingsText):null;
  const width=Math.max(270,Math.round(host.getBoundingClientRect().width)),narrow=width<600;
  const left=narrow?36:62,right=width-(narrow?32:62),rowHeight=narrow?103:95;
  const rows=data.traces.length+(record?1:0),height=65+rows*rowHeight+48;
  const all=data.traces.flatMap(row=>row.values).concat(observed?.readings.map(row=>approximate(row.value))??[]);
  const range=finiteDisplayRange(all);
  if(!range){
    host.innerHTML='<p class="display-refusal">These exact values exceed the numerical display range. Inspect the source and exact certificate below.</p>';return;
  }
  const {lo,hi}=range;
  const x=value=>left+(value-lo)/(hi-lo)*(right-left);
  const axis=Array.from({length:5},(_,i)=>{const p=left+i*(right-left)/4,v=lo+i*(hi-lo)/4;return `<path d="M${p} 25V${height-30}" class="scene-grid"/><text x="${p}" y="${height-10}" text-anchor="middle" class="scene-axis">${escapeHTML(displayNumber(v))}</text>`;}).join('');
  const tickSet=new Set(plannedTicks(book.plan));
  const lanes=data.traces.map((trace,index)=>{
    const y=65+index*rowHeight,value=trace.values[tick];
    const status=record?.result.checks.find(row=>row.hypothesis===trace.id)?.status;
    const stateLabel=status?` · ${status==='consistent'?'conditionally consistent':status}`:'';
    const ghosts=trace.values.map((v,t)=>tickSet.has(t)?`<circle cx="${x(v)}" cy="${y+30}" r="3" fill="${trace.color}" opacity=".45"><title>Forecast at planned tick ${t}: ${escapeHTML(displayNumber(v))}</title></circle>`:'').join('');
    const marker=data.isDemo?'<path d="M-25 -18H17L29 -5V6H-29V-8Z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.8"/><circle cx="-17" cy="10" r="5" fill="currentColor"/><circle cx="18" cy="10" r="5" fill="currentColor"/>':'<path d="M0 -20L18 0L0 20L-18 0Z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="2"/>';
    return `<g style="color:${trace.color}"><text x="${left}" y="${y-12}" class="scene-label"><title>${escapeHTML(trace.id.replaceAll('_',' '))}</title>${escapeHTML(shortLabel(trace.id.replaceAll('_',' '),Math.floor((right-left-65)/7.3)))}</text><text x="${right}" y="${y-12}" text-anchor="end" class="scene-value">${escapeHTML(displayNumber(value))}</text><path d="M${left} ${y+32}H${right}M${left} ${y+36}H${right}" class="scene-rail"/>${ghosts}<g class="model-marker" transform="translate(${x(value)} ${y+22})">${marker}</g>${stateLabel?`<text x="${left}" y="${y+64}" class="scene-condition">${escapeHTML(stateLabel.slice(3))}</text>`:''}</g>`;
  }).join('');
  let measurement='';
  if(observed){
    const y=65+data.traces.length*rowHeight,reading=observed.readings.find(row=>row.tick===tick);
    measurement=`<g class="scene-measurement"><text x="${left}" y="${y-12}" class="scene-label">${observed.acquisition==='synthetic'?'Synthetic reading':'Supplied reading'}</text><path d="M${left} ${y+32}H${right}" class="scene-rail"/>${reading?`<circle cx="${x(approximate(reading.value))}" cy="${y+27}" r="8" fill="currentColor"/><text x="${right}" y="${y-12}" text-anchor="end" class="scene-value">${escapeHTML(String(reading.value)===displayNumber(approximate(reading.value))?String(reading.value):'≈ '+displayNumber(approximate(reading.value)))}</text>`:`<text x="${left}" y="${y+24}" class="scene-condition">No reading at tick ${tick}</text>`}${observed.acquisition==='synthetic'?'':`<text x="${left}" y="${y+64}" class="scene-condition">Origin unverified</text>`}</g>`;
  }
  host.innerHTML=`<svg id="mechanism-view" viewBox="0 0 ${width} ${height}" role="img" aria-label="Illustrative candidate output at tick ${tick}. ${record?'Only separately supplied reading points are drawn.':'No readings acquired.'} The exact test permits independent unknown initial states.">${axis}${lanes}${measurement}</svg>`;
}

export function drawProjection(host,projection){
  if(!projection?.finite){host.innerHTML='<p class="muted">The exact certificate remains available below; no finite projection plot is available.</p>';return;}
  const p=projection,width=Math.max(270,Math.round(host.getBoundingClientRect().width)),left=30,right=width-30;
  const extents=p.centers.flatMap(v=>[v-p.radius,v+p.radius]).concat(p.observed==null?[]:[p.observed]);
  const range=finiteDisplayRange(extents,.18);
  if(!range){host.innerHTML='<p class="muted">The exact certificate remains available below; this projection exceeds the finite display range.</p>';return;}
  const {lo,hi}=range;
  const x=v=>left+(v-lo)/(hi-lo)*(right-left);
  const bands=p.centers.map((v,i)=>`<g style="color:${p.pair[i].color}"><path d="M${x(v-p.radius)} 46H${x(v+p.radius)}" stroke="currentColor" stroke-width="15" stroke-opacity=".24"/><path d="M${x(v-p.radius)} 36V56M${x(v+p.radius)} 36V56" stroke="currentColor"/><circle cx="${x(v)}" cy="46" r="3" fill="currentColor"/><text x="${x(v)}" y="22" text-anchor="middle" class="projection-label">${i===0?'A':'B'} ≈ ${escapeHTML(displayNumber(v))}</text></g>`).join('');
  const measured=p.observed==null?'':`<g class="scene-measurement"><path d="M${x(p.observed)} 64V91" stroke="currentColor" stroke-dasharray="3 3"/><path d="M${x(p.observed)-6} 90L${x(p.observed)+6} 90L${x(p.observed)} 81Z" fill="currentColor"/><text x="${x(p.observed)}" y="114" text-anchor="middle" class="projection-label">${p.acquisition==='synthetic'?'Synthetic':'Supplied'} ≈ ${escapeHTML(displayNumber(p.observed))}</text></g>`;
  host.innerHTML=`<svg viewBox="0 0 ${width} 130" role="img" aria-label="Approximate plot of the two candidate invariant error intervals${p.observed==null?'': ' and the separate reading projection'}."><path d="M${left} 46H${right}" class="scene-rail"/>${bands}${measured}</svg>`;
}
