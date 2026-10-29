import {readFile} from 'node:fs/promises';
import {parseCenteredTorqueSource} from '../src/science/centered-torque-source.mjs';
// Source-only executable receiver; derived model fields are refused on reopen.
if(process.argv.length!==3)throw Error('Usage: node scripts/centered-torque.mjs original-source.json');
const result=parseCenteredTorqueSource(await readFile(process.argv[2],'utf8'));
console.log(JSON.stringify(result,null,2));
if(result.status!=='converged')process.exitCode=2;
