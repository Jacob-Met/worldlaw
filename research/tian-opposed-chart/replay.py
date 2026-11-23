"""Recount all retained scalar evidence without downloading author images."""
import hashlib
import json
import math
from pathlib import Path
from statistics import median
import sys
import zlib

HERE=Path(__file__).resolve().parent

def source(row):
    return json.loads((HERE/row).read_bytes())

def main():
    evidence=source('published-digests.json')
    for name,expected in evidence['sha256'].items():
        b=(HERE/name).read_bytes()
        if hashlib.sha256(b).hexdigest()!=expected:raise ValueError('published digest mismatch for '+name)
    raw=zlib.decompress((HERE/'physical-score.json.zlib').read_bytes())
    if hashlib.sha256(raw).hexdigest()!=evidence['score_sha256']:raise ValueError('scoring-original SHA mismatch')
    result=json.loads(raw)
    split=source('singleton-split.json')
    lock=source('forecast-lock.json')
    assert lock['split_sha256']==hashlib.sha256((HERE/'singleton-split.json').read_bytes()).hexdigest()
    assert hashlib.sha256((HERE/'forecast-lock.json').read_bytes()).hexdigest()==result['prediction_lock']
    assert hashlib.sha256((HERE/'source-tile-digests.json').read_bytes()).hexdigest()==lock['tile_receipt_sha256']
    assert hashlib.sha256((HERE/'held-tile-digests.json').read_bytes()).hexdigest()==result['held_receipt']
    assert len(lock['per_image_sha256'])==11 and all(len(x)==98 for x in lock['per_image_sha256'].values())
    def tag(kind,i):
        return hashlib.sha256(f'Tian-2014/USAF/opposed-v1/{kind}/{i}'.encode()).digest()
    development=set(sorted(range(1,147),key=lambda i:tag('calibration',i))[:48])
    codes=[(h-14,v-13) for h in range(32) for v in range(32) if (h-14)**2+(v-13)**2<9.5**2]
    assert all(list(x)==split['frames'][str(j)]['led_xy'] for j,x in enumerate(codes,1))
    for pair in split['pairs']:
        i=pair['pair_id'];j=294-i
        donor,target=(i,j) if int.from_bytes(tag('target-member',i),'big')%2==0 else (j,i)
        assert pair['donor']==donor and pair['target']==target
        assert (pair['group']=='development')==(i in development)
    registered=[p for p in split['pairs'] if p['group']=='held']
    rows=result['rows']; roles=sorted(result['mean'])
    assert len(rows)==98 and len(roles)==11
    assert [(p['target'],p['donor'],p['pair_id']) for p in rows]==[(p['target'],p['donor'],p['pair_id']) for p in registered]
    n=0
    for role in roles:
        for endpoint in ('primary','common_removed','floor_sensitivity'):
            vals=[p['scores'][role][endpoint] for p in rows]
            assert all(math.isfinite(v) and v>=0 for v in vals)
            assert abs(math.fsum(vals)/98-result['mean'][role][endpoint])<1e-13
            n+=len(vals)
        vals=[p['scores'][role]['primary'] for p in rows]
        worst=max(range(98),key=vals.__getitem__)
        assert abs(median(vals)-result['partial_order'][role]['median'])<1e-13
        assert rows[worst]['target']==result['partial_order'][role]['worst_target']==result['worst'][role]['target']
        assert result['worst'][role]['all_same_pair_scores']==rows[worst]['scores']
        for tag,fn in [('brightfield',lambda a:a['brightfield']),('darkfield',lambda a:not a['brightfield'])]+[(b,lambda a,b=b:a['bin']==b) for b in ('<=1','1..4','4..16','>16')]:
            sub=[p for p in rows if fn(p)]
            assert len(sub)==result['strata'][tag]['n']
            for endpoint in ('primary','common_removed','floor_sensitivity'):
                if sub:
                    assert abs(math.fsum(p['scores'][role][endpoint] for p in sub)/len(sub)-result['strata'][tag]['mean'][role][endpoint])<1e-13
    cand=result['primary'];best=min((r for r in roles if r!=cand),key=lambda r:(result['mean'][r]['primary'],r))
    wins=sum(p['scores'][cand]['primary']<p['scores'][best]['primary'] for p in rows)
    passed=result['mean'][cand]['primary']<result['mean'][best]['primary'] and wins>=50
    assert (best,wins,passed)==(result['best_comparator'],result['wins_over_best_comparator'],result['joint_pass'])
    other=source('independent-recount.json')
    assert other['score_original_sha256']==evidence['score_sha256'] and other['independent_primary_common_floor_scores']==n
    assert other['best']==best and other['candidate_wins']==wins and other['joint_pass']==passed
    print(json.dumps({'registered_pairs':98,'roles':11,'scalar_scores':n,'brightfield':result['strata']['brightfield']['n'],'darkfield':result['strata']['darkfield']['n'],'primary':cand,'best_comparator':best,'wins':wins,'joint_pass':passed,'native_raw_receiver_max_delta':other['largest_abs_difference']},sort_keys=True))
if __name__=='__main__':main()
