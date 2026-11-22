"""Independently reconstruct transition strata and all metric/worst rows from the ZIP and locked forecasts."""
from pathlib import Path
import hashlib
import json
import math
import sys
import zipfile
import numpy as np

GASES=('CO','methane')
ROLE_NAMES=['mean','linear','static_svr','static_rbf','history_linear','history_rbf','oger','nuisance','sham']


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metrics(pred,truth):
    n=len(pred)
    if not n:return dict(n=0,rmse_ppm=None,bias_ppm=None,mae_ppm=None,max_abs_ppm=None)
    errors=[float(p)-float(y) for p,y in zip(pred,truth)]
    return dict(n=n,rmse_ppm=math.sqrt(math.fsum(v*v for v in errors)/n),bias_ppm=math.fsum(errors)/n,
                mae_ppm=math.fsum(abs(v) for v in errors)/n,max_abs_ppm=max(abs(v) for v in errors))


def compare(actual,old):
    assert set(old)==set(actual)
    for k,v in actual.items():
        if v is None:assert old[k] is None
        else:assert abs(v-old[k])<=1e-9*max(1,abs(v)),(k,v,old[k])


def main(root,score_sha):
    scores=root/'held-scores.json';assert digest(scores)==score_sha
    ref=json.loads(scores.read_text())
    checked=0;worsts=0;targets=0
    warm={}
    with zipfile.ZipFile(root/'uci322-original.zip') as z:
        for tgt in GASES:
            p=root/f'input-only-{tgt}.npz'
            assert digest(p)==ref['locks'][tgt]['npz']
            with np.load(p,allow_pickle=False) as a:
                expected=ref['held'][tgt];cut=int(a['threshold']);ids=a['native_ids'].tolist();times=a['time']
                membership={k:[] for k in ['all','early_co_only','early_ethylene_only','early_simultaneous',
                                            'plateau_60s','co_zero','co_present','ethylene_zero','ethylene_present']}
                next_id=0;native_truth=[];selected=[];last_y=None;update=None
                with z.open('ethylene_'+tgt+'.txt') as stream:
                    stream.readline()
                    for i,line in enumerate(stream):
                        fields=line.split(None,3)
                        if not fields:continue
                        t,co,ethyl=map(float,fields[:3])
                        if last_y is not None and (co,ethyl)!=last_y:
                            co_changed=co!=last_y[0];ethyl_changed=ethyl!=last_y[1]
                            kind='simultaneous' if co_changed and ethyl_changed else 'co_only' if co_changed else 'ethylene_only'
                            update=t,kind
                        last_y=(co,ethyl)
                        if i>=cut:native_truth.append(ethyl)
                        if next_id<len(ids) and ids[next_id]==i:
                            assert t==times[next_id]
                            selected.append(ethyl)
                            membership['all'].append(next_id)
                            membership['co_zero' if co==0 else 'co_present'].append(next_id)
                            membership['ethylene_zero' if ethyl==0 else 'ethylene_present'].append(next_id)
                            if update is not None:
                                age=t-update[0]
                                if 0<=age<20:membership['early_'+update[1]].append(next_id)
                                if age>=60:membership['plateau_60s'].append(next_id)
                            next_id+=1
                assert next_id==len(ids) and len(native_truth)==expected['native_rows']
                yy=np.asarray(selected)
                for src in GASES:
                    for role in ROLE_NAMES:
                        vector=a[src+'__'+role]
                        for label,ix in membership.items():
                            result=metrics(vector[ix],yy[ix]);compare(result,expected['routes'][src][role][label]);checked+=1
                        worst=max(range(len(vector)),key=lambda j:abs(float(vector[j])-selected[j]))
                        item=expected['worst'][src+'__'+role]
                        assert ids[worst]==item['release_index'] and selected[worst]==item['ppm'] and vector[worst]==item['prediction_ppm']
                        worsts+=1
                    result=metrics(a[src+'__fullrate_oger'],native_truth)
                    compare(result,expected['routes'][src]['oger_native_rate']['all']);checked+=1
                targets+=len(ids)
                warm[tgt]=[expected['routes'][s]['nuisance']['all']['rmse_ppm'] for s in GASES]
    assert checked==328 and worsts==36
    receipt=dict(source_score=score_sha,compared_material_role_strata=checked,recomputed_native_statistic_fields=checked*5,
                 worst_rows=worsts,release_events=targets,four_direction_candidate_rmse=warm,joint_pass=ref['joint_pass'])
    dst=root/'independent-recount.json'
    with dst.open('x') as f:json.dump(receipt,f,indent=2)
    print('INDEPENDENT',digest(dst),json.dumps(receipt),flush=True)


if __name__=='__main__':main(Path(sys.argv[1]),sys.argv[2])
