"""Deterministic sensitivity to the publisher's printed coefficients."""
import json
from pathlib import Path

def bounds(lock,score):
    groups={}
    for role in lock['predictions'][0]['values']:
        if role=='occupancy-midpoint':continue
        lows=[]; highs=[]
        for pred,obs in zip(lock['predictions'][1:-1],score['rows'][1:-1]):
            candidate=pred['values']['occupancy-midpoint'];control=pred['values'][role]
            lo,hi=obs['printing_interval']
            corners=[lo,hi]+[x for x in (candidate,control) if lo<x<hi]
            diffs=[abs(candidate-x)-abs(control-x) for x in corners]
            lows.append(min(diffs));highs.append(max(diffs))
        groups[role]=[sum(lows)/5,sum(highs)/5]
    return {'candidate_minus_control_MAE_range':groups,
            'interval_possible_coverages':sum(row['printing_interval_overlaps'] for row in score['rows'][1:-1]),
            'interval_guaranteed_coverages':sum(row['printing_interval_covered'] for row in score['rows'][1:-1])}

if __name__=='__main__':
    d=Path(__file__).resolve().parent
    print(json.dumps(bounds(json.loads((d/'forecast-lock.json').read_bytes()),json.loads((d/'score.json').read_bytes())),sort_keys=True,indent=2))
