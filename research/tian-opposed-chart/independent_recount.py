"""Independent file/array recount of every held row and the adverse pixel."""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np

def checksum(data):
    return hashlib.sha256(data).hexdigest()

def checked_bytes(path, digest):
    data=path.read_bytes()
    if checksum(data)!=digest:raise ValueError('immutable readback failed: '+path.name)
    return data

def main():
    lockpath,lock_digest,truthpath,truth_digest,sourcepath,resultpath,result_digest=sys.argv[1:]
    lf,td,sd=Path(lockpath),Path(truthpath),Path(sourcepath)
    lock=json.loads(checked_bytes(lf/'lock.json',lock_digest))
    roster=json.loads(checked_bytes(td/'receipts.json',truth_digest))
    original=json.loads(checked_bytes(Path(resultpath),result_digest))
    assert len(original['rows'])==98 and len(roster)==98
    ids=lock['target_ids']; assert [x['target'] for x in original['rows']]==ids
    truth_by_id={i:np.frombuffer(checked_bytes(td/f'{i:03}.u16le',roster[str(i)]['raw_roi_sha256']),'<u2').astype('float64') for i in ids}
    raw=np.stack([truth_by_id[i] for i in ids]); y=raw-raw.mean(axis=1)[:,None]
    rms=np.sqrt(np.mean(y*y,axis=1))
    den=np.sqrt(np.einsum('ij,ij->i',y,y));y/=np.where(den>0,den,1)[:,None]
    q=np.frombuffer(checked_bytes(lf/'source-common.f64le',lock['source_common_sha256']),'<f8')
    def removed(z):
        t=z-np.einsum('ij,j->i',z,q)[:,None]*q
        den=np.sqrt(np.sum(t*t,axis=1))
        return np.divide(t,den[:,None],out=np.zeros_like(t),where=den[:,None]>1e-7)
    projected=removed(y);roles=sorted(lock['forecast_sha256'])
    aggregate={};all_scores={};delta=0.;checks=0;pixels=0;same_rows=0
    for role in roles:
        f=checked_bytes(lf/(role+'.f32le'),lock['forecast_sha256'][role])
        assert len(f)==98*256*256*4
        z=np.frombuffer(f,'<f4').reshape(98,-1).astype(float)
        for i in range(98):
            assert checksum(memoryview(f)[i*262144:(i+1)*262144])==lock['per_image_sha256'][role][i]
        v=z-y; sq=v*v;errs=np.einsum('ij,ij->i',v,v);p=removed(z)-projected
        results={'primary':errs,'common_removed':np.einsum('ij,ij->i',p,p),'floor_sensitivity':np.minimum(1,rms*rms)*errs}
        for metric,values in results.items():
            ref=np.array([x['scores'][role][metric] for x in original['rows']])
            delta=max(delta,float(np.max(np.abs(values-ref))))
            checks+=len(ref)
            if not np.allclose(values,ref,atol=2e-12,rtol=0):raise ValueError('score mismatch')
            assert abs(values.sum()/98-original['mean'][role][metric])<2e-12
        aggregate[role]=float(np.mean(errs));all_scores[role]=errs.copy()
        w=int(np.argmax(errs)); k=int(np.argmax(sq[w])); det=original['worst'][role]
        assert ids[w]==det['target'] and det['sensor_row_col']==[952+k//256,1152+k%256]
        assert int(raw[w,k])==det['raw_target_DN']
        donor=np.fromfile(sd/f"{det['donor']:03}.u16le",dtype='<u2')
        assert int(donor[k])==det['raw_donor_DN']
        pixels+=1
        for name,other in original['worst'].items():
            row=ids.index(other['target']); rr,cc=other['sensor_row_col']; flat=(rr-952)*256+(cc-1152)
            assert z[row,flat]==other['all_predictions_at_same_pixel'][role]
            assert abs(float(errs[row])-other['all_same_pair_scores'][role]['primary'])<2e-12
            same_rows+=1
    cand='odd-pair-correction';best=min([r for r in roles if r!=cand],key=lambda r:(aggregate[r],r))
    wins=int(np.sum(all_scores[cand]<all_scores[best]))
    gate=aggregate[cand]<aggregate[best] and wins>=50
    assert (best,wins,gate)==(original['best_comparator'],original['wins_over_best_comparator'],original['joint_pass'])
    print(json.dumps({'score_original_sha256':result_digest,'rows':len(ids),'roles':len(roles),'forecast_array_hashes_reverified':len(ids)*len(roles),
        'independent_primary_common_floor_scores':checks,'largest_abs_difference':delta,'verified_worst_rows_and_raw_pixels':pixels,
        'same_location_comparisons':same_rows,'mean':aggregate,'best':best,'candidate_wins':wins,'joint_pass':bool(gate)},sort_keys=True))
if __name__=='__main__':main()
