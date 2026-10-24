import {displayExact} from '../cycle-work/angle-boxes.mjs';
const labels={command:'Command',position:'Angle',rate:'Rate'},units={command:'N·m',position:'rad',rate:'rad/s'};
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const svg=(name,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
const short=n=>Number(n.toPrecision(5)).toString();
function exactValue(value){const detail=el('details');detail.append(el('summary',`${displayExact(value)} N·m (approximate display)`),el('code',`${value.integer} × 2^${value.powerOfTwo} N·m (exact)`));return detail;}
function sourceTable(observations,indices,axes,signs=null){
 const wrap=el('div');wrap.className='additive-graph-table';const table=el('table'),head=el('tr');
 for(const title of ['Row',...(signs?['Sign']:[]),...axes.map(a=>`${labels[a]} (${units[a]})`),'Torque (N·m)'])head.append(el('th',title));table.append(head);
 indices.forEach((index,i)=>{const row=el('tr');row.append(el('th',String(index+1)));if(signs)row.append(el('td',signs[i]>0?'+':'−'));for(const axis of axes)row.append(el('td',String(observations[index][axis])));row.append(el('td',String(observations[index].jointTorque)));table.append(row);});wrap.append(table);return wrap;
}
export function renderAdditiveGraph(container,result,observations){
 container.className='additive-graph';container.replaceChildren();container.dataset.status=result.status;
 const titles={'additivity-excluded':'No additive assignment receives this source slice','compatible-on-observed-slice':'One additive assignment receives this source slice','incompatible-replicates':'Repeated readings have incompatible bounds','no-source-states':'No source readings on this exact slice'};
 container.append(el('h4',titles[result.status]),el('p',`${result.sliceRowCount} original readings · ${result.states.length} exact source states. ${result.interpretation}`));
 if(result.status==='no-source-states')return;
 if(result.status==='incompatible-replicates'){
  container.append(el('p','These original readings at the same exact state have disjoint error bounds. This challenges the deterministic-state/bound assumptions; it is not labeled an input interaction.'),sourceTable(observations,result.conflict.rows,result.declaration.axes));
  const detail=el('details');detail.append(el('summary','Inspect the exact conflicting bounds'),el('p','The strongest lower bound exceeds the strongest upper bound.'),exactValue(result.conflict.lowerBound),exactValue(result.conflict.upperBound));container.append(detail);return;
 }
 if(result.status==='additivity-excluded'){
  const edges=result.witness.edges;
  container.append(el('p',`${edges.length} source readings form a closed constraint cycle. Each coordinate effect cancels, so an additive assignment requires the summed upper bound to be at least zero. This exact bound is strictly negative.`),exactValue(result.witness.upperBound));
  if(edges.length<=12){
   const label=el('label','Source witness view'),choice=el('select');choice.id='additive-graph-view';
   for(const [value,text]of [['cycle','Follow the signed source cycle'],['coordinates','Compare the two coordinate groups']]){const option=el('option',text);option.value=value;choice.append(option);}label.append(choice);container.append(label);
   const drawing=el('div');drawing.className='additive-graph-drawing';container.append(drawing);
   function draw(){
    const groups=result.declaration.axes.map(axis=>[...new Set(edges.map(e=>e.from))].filter(i=>result.nodes[i].axis===axis).sort((a,b)=>result.nodes[a].value-result.nodes[b].value));
    const height=choice.value==='cycle'?320:Math.max(320,Math.max(...groups.map(g=>g.length))*65+50);
    const positions=new Map();groups.forEach((group,j)=>group.forEach((id,i)=>positions.set(id,[j===0?55:305,group.length===1?height/2:45+i*(height-90)/(group.length-1)])));
    const points=edges.map((e,i)=>{const angle=-Math.PI/2+2*Math.PI*i/edges.length;return choice.value==='cycle'?[180+110*Math.cos(angle),160+105*Math.sin(angle)]:positions.get(e.from);});
    const graphic=svg('svg',{viewBox:`0 0 360 ${height}`,role:'img','aria-label':choice.value==='cycle'?'Closed source cycle: each coordinate contribution cancels between adjacent signed readings':'The same source witness grouped by its two input coordinates'});graphic.append(svg('title',{},'Actual source-reading constraint cycle, not a simulated mechanism or interpolated observation'));
    edges.forEach((edge,i)=>{const a=points[i],b=points[(i+1)%points.length];graphic.append(svg('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:edge.sign>0?'#17664f':'#79512d','stroke-width':3}));
     const t=choice.value==='cycle'?.5:.38,mid=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];graphic.append(svg('rect',{x:mid[0]-30,y:mid[1]-11,width:60,height:22,fill:'#fff'}),svg('text',{x:mid[0],y:mid[1]+4,'text-anchor':'middle','font-size':12},`${edge.sign>0?'+':'−'} row ${edge.row+1}`));});
    edges.forEach((edge,i)=>{const [x,y]=points[i],node=result.nodes[edge.from];graphic.append(svg('circle',{cx:x,cy:y,r:26,fill:'#f7faf6',stroke:'#254c40','stroke-width':2}),svg('text',{x,y:y-3,'text-anchor':'middle','font-size':12},labels[node.axis]),svg('text',{x,y:y+12,'text-anchor':'middle','font-size':12},short(node.value)));});drawing.replaceChildren(graphic);
   }
   choice.addEventListener('change',draw);draw();
  }else container.append(el('p','This witness is longer than the compact diagram limit. Every source step remains in the complete signed table below.'));
  container.append(sourceTable(observations,edges.map(e=>e.row),result.declaration.axes,edges.map(e=>e.sign)));
 }else{
  container.append(el('p','These coordinate contributions are one constructive witness, not fitted physical terms. Their sum receives every original reading bound on this finite slice. Additive behavior between or beyond these states and the existing finite-feature library remain unqualified.'));
  const table=el('table'),head=el('tr');for(const title of ['Coordinate','Source value','One assigned contribution'])head.append(el('th',title));table.append(head);
  for(const p of result.potentials){const row=el('tr'),value=el('td');value.append(exactValue(p.valueExact));row.append(el('th',labels[p.axis]),el('td',`${p.value} ${units[p.axis]}`),value);table.append(row);}
  const wrap=el('div');wrap.className='additive-graph-table';wrap.append(table);container.append(wrap);
  const source=el('details');source.append(el('summary','Inspect all original readings on the slice'),sourceTable(observations,result.states.flatMap(s=>s.rowIndices).sort((a,b)=>a-b),result.declaration.axes));container.append(source);
 }
 container.append(el('p',result.arithmetic));
}
