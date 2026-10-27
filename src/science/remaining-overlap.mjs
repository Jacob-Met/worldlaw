const view=new DataView(new ArrayBuffer(8));
function adjacent(x,up){if(!Number.isFinite(x))throw Error('Nonfinite prediction overlap arithmetic');if(x===0)return up?Number.MIN_VALUE:-Number.MIN_VALUE;view.setFloat64(0,x);let b=view.getBigUint64(0);b+=(x>0)===up?1n:-1n;view.setBigUint64(0,b);const y=view.getFloat64(0);if(!Number.isFinite(y))throw Error('Prediction overlap cannot enclose a finite endpoint');return y;}
export function remainingOverlap(intervals,radius){
 if(!Array.isArray(intervals)||!intervals.length||intervals.length>256||!Number.isFinite(radius)||radius<0||radius>1e6)throw Error('Provide1–256 original prediction intervals and a finite declared reading radius.');
 const events=[],ids=new Set();
 for(const item of intervals){const a=item.interval;if(typeof item.id!=='string'||ids.has(item.id)||!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||a[0]>a[1])throw Error('Original law intervals must be finite, ordered and uniquely identified.');ids.add(item.id);
  // Invert the maintained outward-rounded observation box conservatively.
  // One predecessor/successor encloses its outward step; the next encloses subtraction/addition.
  const low=radius===0?a[0]:adjacent(adjacent(a[0],false)-radius,false),high=radius===0?a[1]:adjacent(adjacent(a[1],true)+radius,true);
  events.push({value:low,delta:1},{value:high,delta:-1});
 }
 events.sort((a,b)=>a.value-b.value||b.delta-a.delta);let count=0,maximum=0;
 for(const event of events){count+=event.delta;maximum=Math.max(maximum,count);}
 return {maximum,modelCount:intervals.length,meaning:'Conservative maximum simultaneous overlap of original prediction envelopes expanded by declared reading error. Closed contacts count together; not a calibrated probability or global experiment optimum.'};
}
