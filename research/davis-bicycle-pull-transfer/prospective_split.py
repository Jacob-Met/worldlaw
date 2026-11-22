"""Pre-outcome assignment using only run records from the published subset."""
from collections import defaultdict
import json
import sys

def cell(row):
    return (row['Environment'],row['Maneuver'],float(row['Speed']))

def prospective_split(rows):
    ids=[int(q['RunID']) for q in rows]
    assert len(ids)==len(set(ids))==15
    assert set(ids)=={184,185,186,190,191,192,248,249,250,251,252,253,255,256,257}
    by_cell=defaultdict(list)
    for q in rows:by_cell[cell(q)].append(q)
    people=sorted(set(q['Rider'] for q in rows))
    # Prefer a completely separate rider when a matched intervention cell has
    # at least one distinct source run and one held-rider run.
    applicants=[]
    for rider in people:
        matched={k:rs for k,rs in by_cell.items() if sum(r['Rider']!=rider for r in rs)>=1 and any(r['Rider']==rider for r in rs)}
        if matched:applicants.append((rider,matched))
    if applicants:
        rider,group=applicants[-1]
        train=sorted(int(q['RunID']) for a in group.values() for q in a if q['Rider']!=rider)
        test=sorted(int(q['RunID']) for a in group.values() for q in a if q['Rider']==rider)
        label='between-rider transfer at matched nominal speed, environment and maneuver'
        groups={str(k):{'source':[int(r['RunID']) for r in rs if r['Rider']!=rider],
                        'held':[int(r['RunID']) for r in rs if r['Rider']==rider]} for k,rs in group.items()}
    else:
        by_person=defaultdict(list)
        for q in rows:by_person[(q['Rider'],)+cell(q)].append(int(q['RunID']))
        groups={str(k):{'source':sorted(v)[:-1], 'held':sorted(v)[-1:]} for k,v in by_person.items() if len(v)>=2}
        train=sorted(i for v in groups.values() for i in v['source'])
        test=sorted(i for v in groups.values() for i in v['held'])
        label='new run within rider at matched nominal speed, environment and maneuver'
    if not groups:raise ValueError('no independently recorded matched design cell')
    assert set(train).isdisjoint(test)
    return {'scope':label,'source_ids':train,'held_ids':test,
            'outside_matched_comparison':sorted(set(ids)-set(train+test)), 'matched_cells':groups,
            'membership_basis':'15 prepublished runs; flags retained, no measurement-based removal'}
if __name__=='__main__':
    print(json.dumps(prospective_split(json.load(open(sys.argv[1]))),indent=2,sort_keys=True))
