import assert from 'node:assert/strict';
import {formatEnergyBound} from '../src/trajectory/initial-energy-panel.mjs';
const S=1n<<80n;
for(const n of [0n,1n,-1n,S/3n,-S/3n,26n*S/10n,-26n*S/10n])for(const up of [false,true]){
 const v=BigInt(formatEnergyBound(String(n),up).replace('.',''));
 assert(up?v*S>=n*100000n:v*S<=n*100000n);
}
console.log('14 signed exact outward decimal controls passed');
