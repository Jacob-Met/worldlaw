import fs from 'node:fs/promises';
import path from 'node:path';
import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';

// Adapter only: admission policy stays with the exact maintained HAMON helper.
export async function admitCourseBrowser(browser,dir){
 const page=await browser.newPage();
 try{
  const session=await page.createCDPSession();
  const receipt=await requireChromiumSandbox({send:(method,params)=>session.send(method,params),timeoutMs:8000});
  await fs.writeFile(path.join(dir,'sandbox.json'),JSON.stringify(receipt,null,2));
  return receipt;
 }catch(error){
  if(error.receipt)await fs.writeFile(path.join(dir,'sandbox.json'),JSON.stringify(error.receipt,null,2));
  throw error;
 }finally{await page.close();}
}
