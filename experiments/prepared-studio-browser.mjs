// Extend the maintained Studio receiving course without changing its launch policy.
// This Linux receiver requires the existing strict sandbox admission before navigation.
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

let source=await readFile(new URL('../scripts/browser.mjs',import.meta.url),'utf8');
const replace=(from,to)=>{
  assert.equal(source.split(from).length,2,'Maintained browser receiving marker changed: '+from);
  source=source.replace(from,to);
};
replace("const {chromium}=", "import {requireChromiumSandbox} from './support/chromium-sandbox.mjs';\nconst {chromium}=");
replace('let browser;const checks','let browser,sandbox;const checks');
replace('chromium.launch({headless:true,','chromium.launch({headless:true,chromiumSandbox:true,');
replace('  const page=await browser.newPage',
  "  const preflight=await browser.newPage();const cdp=await preflight.context().newCDPSession(preflight);sandbox=await requireChromiumSandbox({send:(method,params)=>cdp.send(method,params)});await preflight.close();\n  const page=await browser.newPage");
replace("  await page.locator('#inertia').fill('0');",
  "  await page.locator('#duration').fill('100');await page.locator('#run-simulation').click();assert.match(await page.locator('#simulation-status').innerText(),/^5001 RK4 states/);const longCourseChart=await page.locator('#trajectory-chart').innerHTML();await writeFile(resolve(dir,'long-course-chart.html'),longCourseChart);mark('100-second Studio controls execute 5001 states through maintained dynamics and energy consumers');\n  await page.locator('#inertia').fill('0');");
replace("{product:'worldlaw',browser:","{product:'worldlaw',sandbox,browser:");
const path=new URL('../scripts/.prepared-studio-'+randomUUID()+'.mjs',import.meta.url);
await writeFile(path,source,{flag:'wx'});
try {
  const result=spawnSync(process.execPath,[fileURLToPath(path)],{env:process.env,stdio:'inherit'});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
} finally {await unlink(path);}
