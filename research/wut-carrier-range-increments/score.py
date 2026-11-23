"""Receive a frozen forecast by hash, then and only then open its target fields."""
import argparse
import json
import math
from pathlib import Path
from projection import CODES, authenticate, clean, digest, dump, endpoints, projected, read

ARMS = ['nearest_a','own_first_order','average_slope','iid_corrected','differential_fit','symmetric_fit','affine_ls','affine_huber']

def assess(bank, root):
    hr = bank['hours']
    assert hr == (list(range(12,18)) if bank['stage']=='development' else list(range(18,24)))
    assert bank['arms'] == ARMS
    pred = {tuple(key):(inputs,forecasts) for key,inputs,forecasts in bank['rows']}
    assert len(pred)==len(bank['rows'])
    raw = []
    summary = {}
    worst = {}
    for hour in hr:
        seen = matched = 0
        loss = {label:{arm:[] for arm in ARMS} for label in ('all','clean','mean','difference')}
        for key,cells in projected(root,hour,CODES[2:]):
            seen+=1
            if key not in pred:
                continue
            matched += 1
            inputs, forecasts = pred[key]
            observed = [row[0] for row in endpoints(cells,CODES[2:])]
            clean_target = clean(cells,CODES[2:])
            raw.append([list(key),cells,observed])
            if None in observed:
                continue
            for arm,vals in zip(ARMS,forecasts):
                e = [p-y for p,y in zip(vals,observed)]
                loss['all'][arm].extend(x*x for x in e)
                if clean_target:
                    loss['clean'][arm].extend(x*x for x in e)
                loss['mean'][arm].append(((e[0]+e[1])/2)**2)
                loss['difference'][arm].append(((e[0]-e[1])/2)**2)
                for i,x in enumerate(e):
                    if arm not in worst or abs(x)>abs(worst[arm]['error']):
                        worst[arm] = dict(key=key,receiver=i,inputs=inputs,predicted=vals,observed=observed,
                                          error=x,target_flags_counts=cells)
        eligible=sum(key[0]==hour for key in pred)
        assert matched == eligible, 'target projection lost satellite identity'
        n = len(loss['all'][ARMS[0]])//2
        summary[hour] = dict(nominal=59*99,seen=seen,input_eligible=eligible,target_missing=eligible-n,
                             paired=n,clean=len(loss['clean'][ARMS[0]])//2,
                             rms={label:{arm:math.sqrt(math.fsum(v)/len(v)) if v else None for arm,v in data.items()}
                                  for label,data in loss.items()})
    sufficient = all(summary[h]['paired']>0 for h in hr)
    aggregates = {}
    gates = {}
    if sufficient:
        for arm in ARMS:
            per_hour = [summary[h]['rms']['all'][arm] for h in hr]
            aggregates[arm] = dict(mean=math.fsum(per_hour)/6,worst=max(per_hour))
        for metric in ('mean','worst'):
            primary=aggregates['iid_corrected'][metric]
            for name,registry in [('own',['own_first_order']),('strongest',[a for a in ARMS if a!='iid_corrected'])]:
                best=min(registry,key=lambda a:aggregates[a][metric])
                margin=aggregates[best][metric]-primary
                gates[metric+'_'+name]=dict(comparator=best,improvement_m=margin,passed=margin>0)
    return dict(stage=bank['stage'],hours=summary,aggregate=aggregates,gates=gates,worst=worst,
                joint_pass=sufficient and all(g['passed'] for g in gates.values()),raw_targets=raw)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('archives',type=Path)
    p.add_argument('bank',type=Path)
    p.add_argument('expected_sha256')
    p.add_argument('output',type=Path)
    a=p.parse_args()
    if digest(a.bank)!=a.expected_sha256:
        raise ValueError('forecast lock mismatch')
    authenticate(a.archives)
    result=assess(read(a.bank),a.archives)
    result['bank_sha256']=a.expected_sha256
    print('SCORE_LOCK',json.dumps(dump(a.output,result),sort_keys=True))
    print('REGISTERED',json.dumps({k:result[k] for k in ('aggregate','gates','joint_pass','worst')},sort_keys=True))
if __name__=='__main__':
    main()
