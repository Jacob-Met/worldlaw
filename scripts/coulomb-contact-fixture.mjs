import {writeFileSync} from 'node:fs';
import {harmonicRun} from '../experiments/contact-oracle.mjs';
import {RUN_UNITS} from '../src/trajectory/data.mjs';
const bundle={schema:'worldlaw.trajectory-bundle/v1',units:RUN_UNITS,label:'Independent exact dry-friction releases',trainingRuns:[harmonicRun('train-a',1,4),harmonicRun('train-b',-1.3,4)],challengeRuns:[harmonicRun('challenge',.8)]};
writeFileSync(new URL('../examples/coulomb-contact-receiving.json',import.meta.url),JSON.stringify({schema:'worldlaw.trajectory-notebook/v1',bundle,options:{method:'weak',maxTerms:2,noiseSigma:.00001,windowDuration:.3,windowStride:.15,modelLimit:2}}));
