/** Original-row membership for declared physical-delay bands; no interpolation. */
const insist = (ok, message) => { if (!ok) throw new Error(message); };
export function physicalDelayPairs(originalTimes, bands, {maxPairs=100000}={}) {
  insist(Array.isArray(originalTimes)&&originalTimes.length>=4&&originalTimes.length<=10000,
    'Supply 4–10000 complete original timestamps, including the imposed initial row.');
  const times=Array.from(originalTimes);
  insist(times.every(Number.isFinite)&&times.every((t,i)=>!i||(t>times[i-1]&&Number.isFinite(t-times[0]))),
    'Original timestamps must be finite, strictly increasing, with a finite span.');
  insist(Number.isSafeInteger(maxPairs)&&maxPairs>=1&&maxPairs<=640000,'Pair budget must be 1–640000.');
  insist(Array.isArray(bands)&&bands.length>=1&&bands.length<=64,'Declare 1–64 physical-delay bands.');
  const declarations=Array.from(bands,band=>{
    insist(band&&Number.isFinite(band.lowerSeconds)&&Number.isFinite(band.upperSeconds)
      &&band.lowerSeconds>0&&band.upperSeconds>=band.lowerSeconds,
    'Each delay band needs finite positive lowerSeconds and upperSeconds >= lowerSeconds.');
    return {lowerSeconds:band.lowerSeconds,upperSeconds:band.upperSeconds};
  });
  insist(new Set(declarations.map(b=>JSON.stringify(b))).size===declarations.length,'Duplicate physical-delay bands are refused.');
  // Both scans begin at row1: row0 initializes the forecast, not its evidence.
  // Monotone endpoints find every j>i in the closed declared delay band.
  function scan(band, receive) {
    let left=2,right=2,count=0;
    for(let i=1;i<times.length-1;i++){
      left=Math.max(left,i+1);
      while(left<times.length&&times[left]-times[i]<band.lowerSeconds)left++;
      right=Math.max(right,left);
      while(right<times.length&&times[right]-times[i]<=band.upperSeconds)right++;
      count+=right-left;
      if(receive)for(let j=left;j<right;j++)receive(i,j);
    }
    return count;
  }
  const counts=declarations.map(b=>scan(b));
  const pairCount=counts.reduce((sum,n)=>sum+n,0);
  insist(pairCount<=maxPairs,'The entire physical-delay population exceeds the pair budget.');
  const reports=declarations.map((band,index)=>{
    const pairs=[];
    scan(band,(earlierIndex,laterIndex)=>pairs.push({earlierIndex,laterIndex,
      earlierTime:times[earlierIndex],laterTime:times[laterIndex],elapsed:times[laterIndex]-times[earlierIndex]}));
    return {...band,count:counts[index],status:pairs.length>=2?'paired':pairs.length?'single_pair':'no_pairs',pairs};
  });
  return {schema:'worldlaw.physical-delay-pairs/v1',excludedInitialIndex:0,pairCount,reports,
    interpretation:'Closed bands apply to binary64 timestamp differences as supplied. No interpolation, clock-error enclosure, frequency estimation or independence is inferred. Overlapping bands may reuse the same original pair and each use counts against the budget.'};
}
