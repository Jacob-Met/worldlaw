import {acquireStrengthStudy, replayStrengthStudy} from './sparse-strength.mjs';

export function mountStrengthStudy(host) {
  const get=id=>host.querySelector('#'+id);
  const read=get('strength-read'), save=get('strength-save'), open=get('strength-open');
  const file=get('strength-file'), result=get('strength-result'), profile=get('strength-profile');
  let context=null, study=null;
  function display(value) {
    study=value;
    save.disabled=!value;
    profile.replaceChildren();
    if(!value) {result.textContent='';return;}
    const fit=value.fit;
    result.textContent=fit.readings+' positions across '+fit.releases+' releases. '+
      (fit.selectedScale===null?'No unique compatible scale selected.':'Selected common multiplier '+fit.selectedScale+'×.')+
      ' Compatible multipliers: '+(fit.compatibleScales.join(', ')||'none')+'.';
    for(const row of fit.profile){
      const item=document.createElement('li');
      item.textContent=row.scale+'× · χ² '+Number(row.chiSquare.toPrecision(4))+
        ' · conditional weight '+Number(row.conditionalWeight.toPrecision(3));
      profile.append(item);
    }
  }
  function fail(error){display(null);result.textContent=error.message;}
  read.addEventListener('click',()=>{
    if(!context)return;
    try {
      const seeds=[...crypto.getRandomValues(new Uint32Array(2))].map(x=>1+x%2147483646);
      if(seeds[1]===seeds[0]) seeds[1]=1+seeds[1]%2147483646;
      display(acquireStrengthStudy(context.model,.012,seeds,context.runs));
    }catch(error){fail(error);}
  });
  save.addEventListener('click',()=>{
    if(!study)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(study,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='worldlaw-sparse-strength.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  });
  open.addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{
    const current=context, selected=file.files[0];file.value='';
    if(!current||!selected)return;
    try{
      if(selected.size>256000)throw Error('Choose a strength receipt smaller than 256 kB.');
      const value=JSON.parse(await selected.text());
      if(context!==current)return;
      display(replayStrengthStudy(value,current.model,current.runs));
    }catch(error){if(context===current)fail(error);}
  });
  return function update(model,runs,key) {
    if(context?.key!==key){display(null);context=model?{model,runs,key}:null;}
    host.hidden=!model;
  };
}
