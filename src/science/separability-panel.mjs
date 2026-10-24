import {inspectSeparability} from './separability.mjs';

const labels={command:'Command (N·m)',position:'Angle (rad)',rate:'Rate (rad/s)'};
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const n=value=>Number(value.toPrecision(7)).toString();
function labelled(text,control){const label=el('label',text);label.append(control);return label;}
function option(value,text){const node=el('option',text);node.value=value;return node;}
const svgNode=(name,attrs,text)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;};

/** Read-only source-linked instrument inside the maintained scalar Studio. */
export function renderSeparability(container, observations, source) {
  container.replaceChildren();container.className='separability';
  const details=el('details'),summary=el('summary','Challenge the additive law library');details.append(summary);container.append(details);
  details.append(el('p','Does changing one input have the same torque effect at two settings of another? Four matched source states can contradict every sum of separate command, angle and rate functions—including every additive scalar candidate—without choosing new coefficients.'));
  const controls=el('div');controls.className='separability-controls';
  const pair=el('select');pair.id='separability-pair';
  for(const axes of [['command','position'],['command','rate'],['position','rate']])pair.append(option(axes.join(','),axes.map(k=>labels[k]).join(' × ')));
  const fixed=el('select');fixed.id='separability-fixed';
  const fixedLabel=labelled('Fixed coordinate',fixed);
  const radius=el('input');radius.type='number';radius.min='0';radius.max='1000000';radius.step='any';radius.placeholder='Declare a bound';radius.id='separability-radius';
  const exact=el('input');exact.type='checkbox';exact.id='separability-exact';
  const run=el('button','Inspect all complete rectangles');run.type='button';run.id='separability-run';
  run.className='button button-outline';
  controls.append(labelled('Varied inputs',pair),fixedLabel,labelled('Absolute error of each torque reading (N·m)',radius),labelled('Assume the declared input coordinates are exact',exact),run);
  details.append(controls,el('p','The absolute error bound is your declaration, not the fitted noise standard deviation. No near-match rounding or interpolation is used. A missing rectangle is missing evidence.'));
  const output=el('div');output.id='separability-output';output.setAttribute('aria-live','polite');details.append(output);
  function resetFixed(){
    const axes=pair.value.split(','),axis=Object.keys(labels).find(k=>!axes.includes(k));
    fixed.replaceChildren(...[...new Set(observations.map(r=>r[axis]))].sort((a,b)=>a-b).map(v=>option(String(v),String(v))));
    fixedLabel.firstChild.textContent=`Fixed ${labels[axis]} `;
  }
  resetFixed();
  function stale(){output.replaceChildren(el('p','Inputs changed. Run the complete screen again.'));}
  pair.addEventListener('change',()=>{resetFixed();stale();});
  for(const input of [fixed,radius,exact])input.addEventListener('input',stale);
  run.addEventListener('click',()=>{
    output.replaceChildren();
    try{
      if(radius.value.trim()==='')throw new Error('Declare an absolute reading-error bound before screening.');
      const result=inspectSeparability(observations,{axes:pair.value.split(','),fixedValue:Number(fixed.value),torqueRadius:Number(radius.value),exactCoordinates:exact.checked});
      show(result);
    }catch(error){output.append(el('p',`Screen refused: ${error.message}`));}
  });
  function show(result){
    output.append(el('h3',result.status==='no-complete-rectangles'?'No complete source rectangles':`${result.excludedCount} of ${result.rectangles.length} rectangles exclude additivity`));
    output.append(el('p',`${source.label} · ${source.kind}${source.declaredKind?` (${source.declaredKind})`:''}. ${result.sliceRowCount} of ${result.sourceRowCount} original fitting rows share this exact ${labels[result.fixedAxis]} value. ${result.replicateConflictCount} states have incompatible repeated-reading bounds.`));
    output.append(el('p','Each corner uses the intersection of all repeated-reading intervals at that exact state. Incompatible repeats challenge a deterministic state response and the declared bounds; they are not reported as an input interaction. Excluded rectangles challenge additivity only under these declarations. Passing local screens does not establish a jointly feasible law, physical cause or calibrated confidence.'));
    if(!result.rectangles.length)return;
    const select=el('select');select.id='separability-rectangle';
    for(const rectangle of result.rectangles)select.append(option(String(rectangle.id),`Rectangle ${rectangle.id+1} · ${rectangle.status}`));
    const composition=el('select');composition.id='separability-composition';composition.append(option('corners','Four source corners'),option('differences','Compare the two input effects'));
    output.append(labelled('Source rectangle',select),labelled('Inspection view',composition));
    const view=el('div');view.className='separability-view';output.append(view);
    function inspect(){
      view.replaceChildren();const rectangle=result.rectangles[Number(select.value)],states=rectangle.corners.map(id=>result.states[id]);
      view.append(el('p',rectangle.contrastInterval?`Signed contrast enclosure (rounded display): [${rectangle.contrastInterval.map(n).join(', ')}] N·m. Additive models require zero.`:'No contrast is calculated: at least one corner has incompatible repeated readings.'));
      const graphic=svgNode('svg',{viewBox:'0 0 400 250',role:'img','aria-label':composition.value==='corners'?'Four observed input states and contrast signs':'Two source-supported input changes at different settings'});
      graphic.append(svgNode('title',{},'Original matched input coordinates; torque is read from the retained observations, not simulated.'));
      const positions=composition.value==='corners'?[[65,170],[335,170],[65,45],[335,45]]:[[65,45],[335,45],[65,170],[335,170]];
      for(const [a,b]of [[0,1],[2,3]])graphic.append(svgNode('line',{x1:positions[a][0]+24,y1:positions[a][1],x2:positions[b][0]-24,y2:positions[b][1],stroke:'currentColor','stroke-width':2}));
      if(composition.value==='corners')for(const [a,b]of [[0,2],[1,3]])graphic.append(svgNode('line',{x1:positions[a][0],y1:positions[a][1]-24,x2:positions[b][0],y2:positions[b][1]+62,stroke:'currentColor','stroke-dasharray':'4 4'}));
      states.forEach((state,i)=>{
        const [x,y]=positions[i];graphic.append(svgNode('circle',{cx:x,cy:y,r:24,fill:'none',stroke:'currentColor','stroke-width':2}));
        graphic.append(svgNode('text',{x,y:y+5,'text-anchor':'middle'},`${[1,-1,-1,1][i]>0?'+':'−'} ${String.fromCharCode(65+i)}`));
        graphic.append(svgNode('text',{x,y:y+43,'text-anchor':'middle','font-size':11},`(${n(state.x)}, ${n(state.y)})`));
        graphic.append(svgNode('text',{x,y:y+59,'text-anchor':'middle','font-size':12},state.rowIndices.length===1?`τ = ${n(observations[state.rowIndices[0]].jointTorque)}`:`${state.rowIndices.length} readings`));
      });
      graphic.append(svgNode('text',{x:200,y:125,'text-anchor':'middle','font-size':13},composition.value==='corners'?'Δ = A − B − C + D':'(D − C) − (B − A)'));
      view.append(graphic);
      const table=el('table'),head=el('tr');for(const title of ['Corner / signs',...result.declaration.axes.map(k=>labels[k]),'Retained torque readings (N·m)'])head.append(el('th',title));table.append(head);
      states.forEach((state,i)=>{
        const row=el('tr');row.append(el('th',`${['+A','−B','−C','+D'][i]}`),el('td',String(state.x)),el('td',String(state.y)));
        const values=el('td');values.append(el('span',state.rowIndices.length===1?`Row ${state.rowIndices[0]+1}: ${observations[state.rowIndices[0]].jointTorque} N·m`:`${state.rowIndices.length} original rows · ${state.nominalRange.map(String).join(' to ')} N·m`));
        const original=el('details');original.append(el('summary','Inspect original readings'));
        for(const index of state.rowIndices)original.append(el('p',`Row ${index+1}: ${observations[index].jointTorque} N·m`));
        values.append(original);row.append(values);table.append(row);
      });view.append(table);
    }
    select.addEventListener('change',inspect);composition.addEventListener('change',inspect);inspect();
    output.append(el('p','Save or reopen the original notebook with the Studio controls. This screen never changes those observations; redeclare the exact-coordinate assumption and reading bound after reopening.'));
  }
}
