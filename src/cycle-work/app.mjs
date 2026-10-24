import {mountAngleBoxes} from './angle-boxes-panel.mjs';
import {mountRefinement} from './refinement-panel.mjs';
import {evaluateCycle,cycleExample,exportCycle,importCycle} from './core.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
let generation=0, rendered=null, renderedWidth=0;
const fmt=x=>Number(x).toPrecision(6);
function clear(){generation++;rendered=null;$('result').textContent='Inputs changed. Analyze to recompute.';$('details').textContent='';$('segments').replaceChildren();$('trace').replaceChildren();$('trace').setAttribute('aria-label','No current result; analyze the declared inputs.');$('error').textContent='';}
function fail(error){clear();$('error').textContent=error.message;$('error').focus();}
function svg(tag,attributes,text){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attributes))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;$('trace').append(el);return el;}
const tick=n=>n===0?'0':Math.abs(n)>=10000||Math.abs(n)<.001?n.toExponential(1):String(Number(n.toPrecision(3)));
function draw(r){
 rendered=r;const width=Math.max(280,Math.floor($('trace').clientWidth)),height=Math.max(300,Math.round(width*.62));renderedWidth=width;
 $('trace').replaceChildren();$('trace').setAttribute('viewBox',`0 0 ${width} ${height}`);
 const rows=r.input.samples,angles=rows.map(s=>s.position),torques=rows.map(s=>s.jointTorque);
 const xmin=Math.min(...angles),xmax=Math.max(...angles),ymin=Math.min(...torques),ymax=Math.max(...torques);
 const left=72,right=width-25,top=52,bottom=height-62;
 const x=v=>left+(v-xmin)/(xmax-xmin)*(right-left),y=v=>ymax===ymin?(top+bottom)/2:bottom-(v-ymin)/(ymax-ymin)*(bottom-top);
 svg('line',{x1:left,y1:bottom,x2:right,y2:bottom,stroke:'#7690a8'});svg('line',{x1:left,y1:top,x2:left,y2:bottom,stroke:'#7690a8'});
 svg('polyline',{points:rows.map(s=>`${x(s.position)},${y(s.jointTorque)}`).join(' '),fill:'none',stroke:'#ffcb6b','stroke-width':3});
 // Combine exact coincident coordinates into one label without merging rows.
 const grouped=new Map();rows.forEach((s,i)=>{const key=JSON.stringify([s.position,s.jointTorque]);if(!grouped.has(key))grouped.set(key,{sample:s,indices:[]});grouped.get(key).indices.push(i+1);});
 const groups=[...grouped.values()],step=Math.max(1,Math.ceil(groups.length/Math.max(6,Math.floor(width/45))));
 groups.forEach(({sample:s,indices},i)=>{
  if(i%step&&i!==groups.length-1)return;const px=x(s.position),py=y(s.jointTorque),inward=px>(left+right)/2;
  svg('circle',{cx:px,cy:py,r:4,fill:'#9fe7ff'});
  const label=indices.length<=6?indices.join(','):indices.slice(0,5).join(',')+',…';
  const node=svg('text',{x:px+(inward?-8:8),y:py<top+18?py+20:py-9,'text-anchor':inward?'end':'start',class:'sample-label'},label);
  const title=document.createElementNS(ns,'title');title.textContent='Acquisition rows '+indices.join(', ');node.append(title);
 });
 svg('text',{x:left,y:height-37},tick(xmin));svg('text',{x:right,y:height-37,'text-anchor':'end'},tick(xmax));
 svg('text',{x:(left+right)/2,y:height-10,'text-anchor':'middle'},'Angle (rad)');
 svg('text',{x:left,y:24},'Torque (N·m)');
 svg('text',{x:left-8,y:top+5,'text-anchor':'end'},tick(ymax));if(ymax!==ymin)svg('text',{x:left-8,y:bottom+5,'text-anchor':'end'},tick(ymin));
 $('trace').setAttribute('aria-label',`${rows.length} ordered samples; signed polygonal work ${fmt(r.work)} joules. ${r.conclusion}. Coincident coordinates share acquisition labels; original rows remain separate.`);
}
new ResizeObserver(()=>{if(rendered&&Math.max(280,Math.floor($('trace').clientWidth))!==renderedWidth)draw(rendered);}).observe($('trace'));

function analyze(){try{clear();const r=evaluateCycle(importCycle($('input').value));draw(r);$('result').textContent=`${fmt(r.work)} J · ${r.conclusion==='zero-compatible'?'zero remains compatible':'zero excluded for declared polygon and bounds'}`;$('details').textContent=`Work interval [${fmt(r.interval[0])}, ${fmt(r.interval[1])}] J. Torque-bound contribution ${fmt(r.torqueBound)} J; integration allowance ${fmt(r.integrationAllowance)} J; floating-point guard ${fmt(r.roundingGuard)} J. Separately rounded segment sum ${fmt(r.segmentWork)} J (difference from shared-weight total ${fmt(r.segmentRoundingDifference)} J). Source: ${r.input.source}`;for(const s of r.segments){const tr=document.createElement('tr');for(const value of [`${s.from+1} → ${s.to+1}`,fmt(s.delta),fmt(s.work)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('segments').append(tr);}}catch(e){fail(e);}}
function adopt(input){$('input').value=exportCycle(input);clear();}
function save(){try{const content=exportCycle(importCycle($('input').value)),url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-cycle-inputs.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){fail(e);}}
$('input').addEventListener('input',clear);
$('load').addEventListener('click',()=>adopt(cycleExample($('example').value)));
$('analyze').addEventListener('click',analyze);
$('reverse').addEventListener('click',()=>{try{const input=importCycle($('input').value);input.samples.reverse();input.source+=' [order reversed by user]';adopt(input);}catch(e){fail(e);}});
$('save').addEventListener('click',save);
$('open').addEventListener('change',async()=>{
 const ticket=++generation,file=$('open').files[0];
 try{if(!file)return;if(file.size>2000000)throw new Error('Cycle JSON must be at most 2 MB of UTF-8.');const text=await file.text();if(ticket!==generation)return;adopt(importCycle(text));}
 catch(e){if(ticket===generation)fail(e);}
 finally{if($('open').files[0]===file)$('open').value='';}
});
adopt(cycleExample());

mountRefinement();

mountAngleBoxes();
