import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=createProductServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/trajectory.html`);
  await page.waitForFunction(()=>!document.getElementById('refit').disabled);
  await page.locator('#example-choice').selectOption('measured');await page.locator('#load-example').click();
  await page.waitForFunction(()=>!document.querySelector('#angle-reference-panel').shadowRoot.getElementById('search').disabled);
  for(const mode of ['malformed-reopen','settings-edit']){
    const state=await page.evaluate(async mode=>{
      const root=document.querySelector('#angle-reference-panel').shadowRoot,original=requestAnimationFrame,callbacks=[];
      window.requestAnimationFrame=fn=>{callbacks.push(fn);return callbacks.length;};
      try{root.getElementById('search').click();}finally{window.requestAnimationFrame=original;}
      if(mode==='malformed-reopen'){
        const transfer=new DataTransfer();transfer.items.add(new File(['{bad'],'bad.json',{type:'application/json'}));
        const input=root.getElementById('open');input.files=transfer.files;input.dispatchEvent(new Event('change'));
        await new Promise(resolve=>setTimeout(resolve,20));
      }else{const input=root.getElementById('noise');input.value='.02';input.dispatchEvent(new Event('input'));}
      callbacks.forEach(callback=>callback(performance.now()));await new Promise(resolve=>setTimeout(resolve,20));
      return {searchDisabled:root.getElementById('search').disabled,saveDisabled:root.getElementById('save').disabled,status:root.getElementById('status').textContent};
    },mode);
    assert.equal(state.searchDisabled,false);assert.equal(state.saveDisabled,true);
    assert.match(state.status,mode==='malformed-reopen'?/Reopen refused/:/Settings changed/);
    console.log('PASS '+mode+' cancels pending work and leaves Compare available');
  }
}finally{await browser.close();await new Promise(r=>server.close(r));}
