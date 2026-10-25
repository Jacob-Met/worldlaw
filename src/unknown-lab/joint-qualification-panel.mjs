const AUTHORED={
  "schema": "worldlaw.joint-plan-qualification/v1",
  "correlation": {
    "schema": "worldlaw.correlation-band/v1",
    "comparison": {
      "schema": "worldlaw.serial-orders/v2",
      "sourceNote": "Authored eight-pair schedules, not physical acquisitions.",
      "plans": [
        {
          "id": "order-85",
          "pairs": [
            {
              "reference": 0,
              "conditioned": 1
            },
            {
              "reference": 3,
              "conditioned": 2
            },
            {
              "reference": 4,
              "conditioned": 5
            },
            {
              "reference": 7,
              "conditioned": 6
            },
            {
              "reference": 8,
              "conditioned": 9
            },
            {
              "reference": 11,
              "conditioned": 10
            },
            {
              "reference": 12,
              "conditioned": 13
            },
            {
              "reference": 15,
              "conditioned": 14
            }
          ]
        },
        {
          "id": "order-101",
          "pairs": [
            {
              "reference": 0,
              "conditioned": 1
            },
            {
              "reference": 3,
              "conditioned": 2
            },
            {
              "reference": 4,
              "conditioned": 5
            },
            {
              "reference": 7,
              "conditioned": 6
            },
            {
              "reference": 9,
              "conditioned": 8
            },
            {
              "reference": 10,
              "conditioned": 11
            },
            {
              "reference": 12,
              "conditioned": 13
            },
            {
              "reference": 15,
              "conditioned": 14
            }
          ]
        }
      ],
      "rhos": [
        -0.9,
        -0.5,
        0,
        0.5,
        0.9
      ],
      "periodic": {
        "sourceNote": "Hypothetical finite periodic family.",
        "periods": [
          3,
          5
        ]
      }
    },
    "band": {
      "lower": -0.9,
      "upper": 0.9,
      "sourceNote": "Hypothetical continuous AR(1) correlation band, not fitted or calibrated."
    },
    "maximumVariance": 0.26,
    "maxCells": 16,
    "workLimit": 40000
  },
  "drift": {
    "curvatureBound": 0.01,
    "sourceNote": "Authored hypothetical curvature bound, not physical calibration."
  },
  "maximumBias": 0.015
};
const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
export function mountJointQualification(){
 const host=node('section');host.id='joint-qualification';host.style.gridColumn='1 / -1';host.innerHTML=`<h2>Which offered orders pass both declared criteria?</h2><p>Exact continuous-correlation noise qualification and conditional smooth-drift bias remain separate. No unresolved criterion admits a plan.</p><label>Noise variance budget <input id="jq-noise" type="number" min="0" max="4" step="any"></label><label>Drift bias budget · N·m <input id="jq-bias" type="number" min="0" max="1000000000" step="any"></label><label>Curvature bound · N·m/index² <input id="jq-curvature" type="number" min="0" max="1000" step="any"></label><label>Cells per offered plan <input id="jq-cells" type="number" min="1" max="64" step="1"></label><details><summary>Original offered plans, correlation interval and source declarations</summary><textarea id="jq-input" rows="16" style="width:100%"></textarea></details><button id="jq-run">Qualify every offered plan</button><label>Open original inputs <input id="jq-file" type="file" accept="application/json,.json"></label><button id="jq-save" disabled>Download original inputs</button><button id="jq-restore" disabled>Restore last complete comparison</button><p id="jq-status" role="status"></p><div id="jq-results"></div>`;document.querySelector('main').append(host);const $=id=>host.querySelector('#'+id);let generation=0,worker=null,timer=null,report=null,accepted=null,selected=new Set();
 function cancel(){generation++;worker?.terminate();worker=null;clearTimeout(timer);timer=null;}
 function invalidate(){cancel();report=null;$('jq-results').replaceChildren();$('jq-save').disabled=true;$('jq-status').textContent='Draft changed; qualify the original declarations again.';}
 function fill(raw){$('jq-input').value=JSON.stringify(raw,null,2);$('jq-noise').value=raw.correlation.maximumVariance;$('jq-bias').value=raw.maximumBias;$('jq-curvature').value=raw.drift.curvatureBound;$('jq-cells').value=raw.correlation.maxCells;}
 function read(){for(const id of ['jq-noise','jq-bias','jq-curvature','jq-cells'])if(!$(id).value.trim()||!$(id).checkValidity())throw Error('Supply every numeric declaration explicitly within its allowed range.');const r=JSON.parse($('jq-input').value);r.correlation.maximumVariance=Number($('jq-noise').value);r.maximumBias=Number($('jq-bias').value);r.drift.curvatureBound=Number($('jq-curvature').value);r.correlation.maxCells=Number($('jq-cells').value);return r;}
 function download(raw,name){const a=node('a'),url=URL.createObjectURL(new Blob([JSON.stringify(raw,null,2)+'\n'],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function execute(inputs,action='qualify',ids=[]){cancel();const token=generation;worker=new Worker(new URL('./joint-qualification-worker.mjs',import.meta.url),{type:'module'});$('jq-status').textContent='Evaluating the complete offered family within unchanged exact work limits…';const fail=message=>{if(token!==generation)return;cancel();$('jq-status').textContent=message;};timer=setTimeout(()=>fail('Refused after the 10-second worker deadline; no partial classification. Restore the previous complete source explicitly if needed.'),10000);worker.onerror=e=>fail(e.message);worker.onmessage=({data})=>{if(token!==generation)return;cancel();if(!data.ok){$('jq-status').textContent=data.error;return;}if(action==='select'){download(data.result,'joint-selected-drift.json');$('jq-status').textContent='Open the selected declaration in the existing smooth-drift viewer to inspect its attaining drift. Selection does not certify excluded plans.';return;}report=data.result;accepted=report;selected=new Set();fill(report.inputs);draw();$('jq-save').disabled=false;$('jq-restore').disabled=false;$('jq-status').textContent='Complete offered family qualified. Exact noise and engineering drift statuses are retained separately.';};worker.postMessage({inputs,action,ids});}
 function draw(){const out=$('jq-results');out.replaceChildren();out.append(node('p',report.bestIds.length?'All finite-periodic gain ties among jointly admitted offered plans: '+report.bestIds.join(', '):'No offered plan is jointly admitted. Inspect unresolved and excluded criteria separately.'),node('p',report.interpretation));for(const r of report.rows){const article=node('article');article.style.minWidth='0';article.dataset.plan=r.id;const checkbox=node('input');checkbox.type='checkbox';checkbox.setAttribute('aria-label','Select '+r.id);checkbox.onchange=()=>checkbox.checked?selected.add(r.id):selected.delete(r.id);article.append(node('h3',r.id+(r.admitted?' · jointly admitted':' · not jointly admitted')),checkbox);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 760 190');svg.style.width='100%';svg.setAttribute('role','img');svg.setAttribute('aria-label',r.id+' separate noise and drift budget instruments');const shape=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text)e.textContent=text;svg.append(e);return e;};
 const friendly={'below-budget-entire-band':'Below budget across band','exact-budget-boundary':'Exactly at budget','witness-exceeds-budget':'Witness exceeds budget','unresolved-budget':'Unresolved at cell limit','within':'Below drift budget','outside':'Exceeds drift budget','boundary':'Drift boundary unresolved','zero-curvature':'Zero declared curvature'};const strips=[{name:'Normalized noise variance / σ²',lower:r.continuousNoise.lower.lower,upper:r.continuousNoise.upper.upper,budget:report.inputs.correlation.maximumVariance,status:r.noiseStatus},{name:'Conditional drift bias / N·m',lower:r.drift.worstBias,upper:r.drift.worstBias,budget:report.inputs.maximumBias,status:r.driftStatus}];strips.forEach((s,i)=>{const top=25+i*80,max=Math.max(.000001,s.upper,s.budget)*1.12,x=v=>40+680*v/max;shape('text',{x:40,y:top,fill:'currentColor','font-size':13},s.name+' · '+friendly[s.status]);shape('line',{x1:40,x2:720,y1:top+25,y2:top+25,stroke:'#71838c'});shape('line',{x1:x(s.lower),x2:x(s.upper),y1:top+25,y2:top+25,stroke:'#5de4c9','stroke-width':6});shape('circle',{cx:x(s.lower),cy:top+25,r:5,fill:'none',stroke:'#5de4c9','stroke-width':3});shape('line',{x1:x(s.budget),x2:x(s.budget),y1:top+13,y2:top+37,stroke:'#eea455','stroke-width':2});shape('text',{x:40,y:top+52,fill:'currentColor','font-size':12},'0');shape('text',{x:720,y:top+52,'text-anchor':'end',fill:'currentColor','font-size':12},max.toPrecision(6));});const plotScroll=node('div');plotScroll.className='jq-plot-scroll';plotScroll.style.overflowX='auto';plotScroll.style.maxWidth='100%';plotScroll.tabIndex=0;plotScroll.setAttribute('aria-label','Separate noise and drift strips; scroll horizontally on narrow displays');svg.style.minWidth='760px';svg.style.display='block';plotScroll.append(svg);article.append(plotScroll,node('p',`Noise exact maximum projects outward to [${r.continuousNoise.lower.lower}, ${r.continuousNoise.upper.upper}]; budget ${report.inputs.correlation.maximumVariance}. Drift bias ${r.drift.worstBias} N·m, engineering allowance ${r.drift.engineeringAllowance}; budget ${report.inputs.maximumBias} N·m.`),node('p',`Original finite noise maximum ${r.continuousNoise.worstVariance}; finite periodic gain ${r.maximumGain}. Separate strip scales, marked numerically; marker radius is not uncertainty.`));const exact=node('details');exact.append(node('summary','Inspect exact noise fractions, complete cells and drift witness'),node('pre',JSON.stringify({noise:r.continuousNoise,drift:r.drift},null,2)));exact.style.overflowX='auto';exact.style.maxHeight='400px';article.append(exact);out.append(article);}const handoff=node('button','Download selected plans for attaining-drift inspection');handoff.id='jq-select';handoff.onclick=()=>{if(report)execute(report.inputs,'select',[...selected]);};out.append(handoff,node('p','Planning source: '+report.inputs.correlation.comparison.sourceNote),node('p','Correlation source: '+report.inputs.correlation.band.sourceNote),node('p','Curvature source: '+report.inputs.drift.sourceNote));}
 for(const id of ['jq-noise','jq-bias','jq-curvature','jq-cells'])$(id).oninput=invalidate;$('jq-input').oninput=()=>{invalidate();try{const r=JSON.parse($('jq-input').value);fill(r);}catch{}};
 $('jq-run').onclick=()=>{invalidate();try{execute(read());}catch(e){$('jq-status').textContent=e.message;}};$('jq-save').onclick=()=>{if(report)download(report.inputs,'joint-qualification.json');};$('jq-restore').onclick=()=>{if(!accepted)return;cancel();report=accepted;selected=new Set();fill(report.inputs);draw();$('jq-save').disabled=false;$('jq-status').textContent='Restored the previous complete source-bound comparison.';};
 $('jq-file').onchange=async()=>{invalidate();const token=generation,file=$('jq-file').files[0];try{if(!file||file.size>1048576)throw Error('Choose original inputs up to 1 MiB.');const text=await file.text();if(token!==generation)return;execute(JSON.parse(text));}catch(e){if(token===generation)$('jq-status').textContent=e.message;}};
 fill(AUTHORED);
}
