import {compareRecoverySupport} from './recovery-support.mjs';
import {recoverySupportExample} from './recovery-support-example.mjs';
const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(4)).toString():'—';
export function mountRecoverySupport(recovery){
 const host=document.createElement('details');host.id='recovery-support';
 host.innerHTML=`<summary>Does recovery survive the same readout-state population?</summary>
 <p>Different command, angle or rate populations can imitate recovery. Compare the original course with the earliest original pairs on shared exact training coordinates, separately in each acquisition order. Challenge recordings must receive that frozen population.</p>
 <div class="recovery-controls"><button id="support-compare" type="button">Compare common readout support</button><button id="support-example" type="button">Load authored population-shift control</button></div>
 <p id="support-status" role="status" aria-live="polite">No comparison computed.</p><div id="support-result"></div>`;
 document.querySelector('#recovery-qualification').after(host);
 const $=id=>host.querySelector('#'+id);
 function invalidate(){ $('support-result').replaceChildren();$('support-status').textContent='Source changed. Compare again from original evidence.'; }
 recovery.onChange(invalidate);
 function render(){
  const report=compareRecoverySupport(recovery.getStudy());const result=$('support-result');result.replaceChildren();
  $('support-status').textContent=report.status==='compared'?`Frozen training population: ${report.counts['reference-first']} reference-first / ${report.counts['conditioned-first']} conditioned-first pairs per recording.`:'Unavailable: common exact training support needs at least four original pairs in each acquisition order.';
  const paragraph=document.createElement('p');paragraph.textContent=report.qualification;result.append(paragraph);
  if(report.comparison){
   const rows=[...report.baseline.fit.training,...report.baseline.tests[0].rows];
   const selected=[...report.comparison.fit.training,...report.comparison.tests[0].rows];
   const selectedById=new Map(selected.map(r=>[r.recordingId,r]));
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 900 340');svg.setAttribute('role','img');svg.setAttribute('aria-label','Original versus common-support paired contrasts at each original waiting delay; bars are inherited screening bounds, not confidence intervals.');
   const top=Math.max(.1,...rows.concat(selected).map(r=>Math.abs(r.estimate)+r.boundary)),last=Math.max(1,...rows.map(r=>r.delaySeconds));
   const X=t=>90+730*t/last,Y=v=>150-v/top*120;
   const el=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);};
   el('line',{x1:70,x2:850,y1:150,y2:150,stroke:'#67848c'});
   for(const v of [-top,0,top])el('text',{x:60,y:Y(v)+4,fill:'#cce7e8','text-anchor':'end','font-size':14},fmt(v));
   for(const row of rows){const matched=selectedById.get(row.recordingId);for(const [r,color,shift]of [[row,'#ffad5c',-5],[matched,'#5df5df',5]])if(r){el('line',{x1:X(r.delaySeconds)+shift,x2:X(r.delaySeconds)+shift,y1:Y(r.estimate-r.boundary),y2:Y(r.estimate+r.boundary),stroke:color,'stroke-width':2});el('circle',{cx:X(r.delaySeconds)+shift,cy:Y(r.estimate),r:5,fill:color});}el('text',{x:X(row.delaySeconds),y:293,fill:'#cce7e8','text-anchor':'middle','font-size':14},fmt(row.delaySeconds));}
   el('text',{x:450,y:326,fill:'#cce7e8','text-anchor':'middle','font-size':15},'WAIT / s · amber original · cyan common support · TORQUE / N·m');
   const plot=document.createElement('div');plot.className='recovery-scroll';plot.tabIndex=0;plot.setAttribute('aria-label','Original and common-support contrasts; scroll horizontally on narrow screens');svg.style.minWidth='700px';plot.append(svg);result.append(plot);
   const wrap=document.createElement('div');wrap.className='recovery-scroll';wrap.tabIndex=0;wrap.setAttribute('aria-label','Original and common-support model comparison');
   const table=document.createElement('table');table.innerHTML='<thead><tr><th>Law</th><th>Original training / challenge</th><th>Common support training / challenge</th></tr></thead>';const body=document.createElement('tbody');
   report.baseline.fit.candidates.forEach((c,i)=>{const tr=document.createElement('tr'),next=report.comparison.fit.candidates[i];for(const value of [c.id,c.status+' / '+report.baseline.tests[i].status,next.status+' / '+report.comparison.tests[i].status]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);});table.append(body);wrap.append(table);result.append(wrap);
  }
  const strata=document.createElement('details'),summary=document.createElement('summary');summary.textContent=report.strata.length+' frozen coordinate / order strata';strata.append(summary);
  for(const s of report.strata){const p=document.createElement('p');p.textContent=`command ${fmt(s.state[0])} N·m; angle ${fmt(s.state[1])} rad; rate ${fmt(s.state[2])} rad/s; ${s.order}: ${s.count} pairs per recording`;strata.append(p);}result.append(strata);
  for(const row of report.recordings){const d=document.createElement('details'),s=document.createElement('summary');s.textContent=`${row.recordingId} · ${row.role} · ${row.status} · ${row.selected.length}/${row.total} original pairs`;d.append(s);
   const p=document.createElement('p');p.style.overflowWrap='anywhere';p.textContent='Retained pair identities: '+(row.selected.join(', ')||'none');d.append(p);
   if(row.missing.length){const p=document.createElement('p');p.textContent='Missing frozen support: '+row.missing.map(m=>`${m.key} requires ${m.required}, has ${m.available}`).join('; ');d.append(p);}
   const excluded=document.createElement('p');excluded.style.overflowWrap='anywhere';excluded.textContent='Excluded originals: '+(row.excluded.map(p=>p.pairId+' ('+p.reason+')').join(', ')||'none');d.append(excluded);result.append(d);
  }
 }
 $('support-compare').onclick=()=>{try{render();}catch(e){$('support-result').replaceChildren();$('support-status').textContent='Comparison refused: '+e.message;}};
 $('support-example').onclick=()=>{try{recovery.replaceStudy(recoverySupportExample());render();}catch(e){$('support-status').textContent='Control refused: '+e.message;}};
 return {invalidate};
}
