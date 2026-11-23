"""Offline reader for the portable original score records."""
import argparse
import hashlib
import json
from pathlib import Path

def verify(directory, output=None):
    registry_bytes=(directory/'forecast-registry.json').read_bytes()
    registry=json.loads(registry_bytes)
    receipts=[json.loads(line) for line in (directory/'scores.jsonl').read_text().splitlines()]
    rows={r['name']:r for r in receipts if 'name' in r}
    final=receipts[-1]
    assert len(rows)==len(receipts)-1 and set(rows)=={n for n in registry['members'] if not n.endswith('_clock')}
    assert final['archive_sha']==registry['archive_sha256']=='9ab6306f9f9b0665873c73e3e8d2866d9c50140a935e54520312e427591b3f7f'
    assert hashlib.sha256(registry_bytes).hexdigest()==final['registry_sha']=='2a44b7687410453565e3daed7145f69b1601131d744ee5e26e798297eb846c49'
    original=dict(final)
    original['rows']=rows
    packed=(json.dumps(original,sort_keys=True)+'\n').encode()
    assert hashlib.sha256(packed).hexdigest()=='4c2dcb5c106411832fcb6ef52379a6c3f2009fec4fae79f1fb75b7530dc1fe71'
    if output is not None:
        with output.open('xb') as target:
            target.write(packed)
    candidate=rows['motion_cap_tied']
    gate={}
    for name in ('constant_area','opposite_cubic','free_pair','free_asymmetric','dev_convex','other_repeat_cap'):
        key='motion_'+name
        control=rows[key]
        gate[key]=[candidate['rms_m']<control['rms_m'],
                   sum(a<b for a,b in zip(candidate['per_gauge_m'],control['per_gauge_m'])),
                   sum(a<b for a,b in zip(candidate['per_repeat_m'],control['per_repeat_m']))]
    assert final['primary_gate']==gate
    passed=all(a and b>=2 and c>=3 for a,b,c in gate.values())
    assert passed==final['primary_passed']
    print(json.dumps({'roles':len(rows),'cap_rms_mm':candidate['rms_m']*1000,
        'conditional_gate':gate,'passed':passed,'worst':candidate['worst']},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory',type=Path,nargs='?',default=Path(__file__).parent)
    p.add_argument('--write-original-score',type=Path)
    args=p.parse_args()
    verify(args.directory,args.write_original_score)
