import{trainingRowBoundsContext,searchTrainingRowBounds,serializeTrainingRowBounds,replayTrainingRowBounds}from'./training-row-bounds.mjs';
import{renderSharedTraining}from'./shared-training-panel.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function renderTrainingRowBounds(host,state,eventIndex,modelIndex,throughEvent,context,readReceiving){
 const details=el('details');details.id='original-training-row-bounds';details.append(el('summary','Use sourced bounds for each original training reading'));
 details.append(el('p',`This optional inquiry retains all ${context.training.length} original training rows in their original order and every selected challenge row. Supply JSON entries {rowIndex, radius, basis}, with zero-based rowIndex and radius in N·m. These are declared calibration bounds, not fitted residuals. The uniform training radius above is not used by this action; the achieved challenge bounds above still apply.`));
 const label=el('label','Complete original training-row bounds and sources'),input=el('textarea');input.id='training-row-bounds-input';input.rows=7;input.maxLength=1000000;input.style.width='100%';input.style.boxSizing='border-box';label.append(input);details.append(label);
 const read=()=>{if(!input.value.trim())throw Error('Declare every original training-row bound and source.');return JSON.parse(input.value);};
 const searchHost=el('div');details.append(searchHost);host.append(details);
 const engine={prepare:()=>trainingRowBoundsContext(state,eventIndex,modelIndex,throughEvent,read(),readReceiving()),search:(_m,_t,_r,options)=>searchTrainingRowBounds(state,eventIndex,modelIndex,throughEvent,read(),readReceiving(),{maxIterations:options.maxIterations,maxProducts:options.maxProducts}),serialize:serializeTrainingRowBounds,replay:replayTrainingRowBounds};
 renderSharedTraining(searchHost,context.model,context.training,context.receiving,[{key:'rowDeclarations',input}],{engine,description:'One common perturbation must respect each original row’s own declared bound. Search normalizes the complete source box, while witness checks independently refit actual torque offsets. Uniform minima or maxima are not substituted. Original fitting, ranking and prospective promises remain unchanged. Numerical screens are engineering checks, not certified QR or physical bounds.'});
 // The existing achieved-challenge controls are outside this nested card.
 // Retire its result and pending replay when those source assumptions change.
 for(const control of host.querySelectorAll('input,textarea'))if(!details.contains(control))for(const kind of ['input','change'])control.addEventListener(kind,()=>input.dispatchEvent(new Event('input')));
}
