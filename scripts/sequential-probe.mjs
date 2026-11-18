import {readFile} from 'node:fs/promises';
import {planSequentialProbe} from '../src/unknown-lab/sequential-probe.mjs';

try {
  const [file, ...extra] = process.argv.slice(2);
  if (!file || extra.length) throw Error('Usage: node scripts/sequential-probe.mjs request.json');
  const {training, settings, readouts} = JSON.parse(await readFile(file, 'utf8'));
  console.log(JSON.stringify(planSequentialProbe(training, settings, readouts), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
