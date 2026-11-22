"""Generate both directional decoders' sealed predictions using only the 16 sensor channels and time."""
import hashlib
import itertools
import json
from pathlib import Path
import sys
import zipfile
import numpy as np
from decoder import predict
from oger_reference import node

GASES=('CO','methane')


def sha(path):
    dig=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1<<20),b''):
            dig.update(block)
    return dig.hexdigest()


def main(root,target,locks):
    name={'CO':'ethylene_CO.txt','methane':'ethylene_methane.txt'}[target]
    assert sha(root/'uci322-original.zip')=='8b6323b801363e11343ba1a5a7718e76666b715e753b3a40dbdfd1838d953fe7'
    boundary=json.loads((root/'chronology-source.json').read_text())[name]
    n=boundary['n'];cut=boundary['train_rows']
    metas={}
    for source in GASES:
        mp=root/f'frozen-model-{source}.npz'
        assert sha(mp)==locks[source]['model']
        dp=root/f'development-{source}.json'
        assert sha(dp)==locks[source]['development']
        with np.load(mp,allow_pickle=False) as m:metas[source]={k:m[k] for k in m.files}
    state=node(root)
    weights=hashlib.sha256(state.w.tobytes()+state.w_in.tobytes()+state.w_bias.tobytes()).hexdigest()
    assert weights=='6278dce60ab8f73b0297f29d4b56a9cce84bcacffec214181c5a995a2b37a992'
    ids=[];sensor=[];states=[];last_sec=-1;full={s:np.empty(n-cut) for s in GASES}
    check=hashlib.sha256()
    with zipfile.ZipFile(root/'uci322-original.zip') as z,z.open(name) as f:
        assert b'Ethylene conc (ppm)' in f.readline()
        for lo in range(0,n,20000):
            count=min(20000,n-lo)
            # The trusted CSV reader selects only the timestamp and sensor columns.
            row=np.loadtxt(itertools.islice(f,count),usecols=(0,*range(3,19)),ndmin=2)
            assert row.shape==(count,17) and np.isfinite(row).all()
            check.update(np.ascontiguousarray(row).tobytes())
            h=state._execute(row[:,1:])
            sec=np.floor(row[:,0]).astype(np.int64)
            selected=np.flatnonzero(np.diff(np.r_[last_sec,sec])>0);last_sec=sec[-1]
            ids.append(lo+selected);sensor.append(row[selected]);states.append(h[selected])
            after=max(cut,lo)
            if after<lo+count:
                for source,model in metas.items():
                    c=model['oger_coef']
                    full[source][after-cut:lo+count-cut]=h[after-lo:]@c[1:]+c[0]
    sensor=np.concatenate(sensor);states=np.concatenate(states);ids=np.concatenate(ids)
    eligible=ids>=cut
    data={'native_ids':ids[eligible],'time':sensor[eligible,0],'first_four_readings':sensor[eligible,1:5],
          'threshold':np.asarray(cut),'native_rows':np.asarray(n)}
    equivalence={}
    for source in GASES:
        predictions=predict(sensor,states,metas[source])
        for role,values in predictions.items():data[source+'__'+role]=values[eligible]
        data[source+'__fullrate_oger']=full[source]
        d=np.max(np.abs(full[source][ids[eligible]-cut]-data[source+'__oger']))
        assert d<1e-7
        equivalence[source]=float(d)
    output=root/f'input-only-{target}.npz'
    with output.open('xb') as f:np.savez_compressed(f,**data)
    report={'target':target,'source_models':locks,'native_rows':n,'first_held_row':cut,'decision_count':int(eligible.sum()),
            'first_decision_native_id':int(ids[eligible][0]),'last_decision_native_id':int(ids[eligible][-1]),
            'numeric_columns_read':[0,*range(3,19)],'raw_text_ingress_contains_interleaved_setpoints':True,
            'setpoint_values_accessible_to_decoders':False,'sensor_and_time_sha256':check.hexdigest(),'highrate_sampled_max_delta':equivalence,
            'npz':sha(output),'arrays':{k:hashlib.sha256(np.ascontiguousarray(v).tobytes()).hexdigest() for k,v in data.items()}}
    meta=root/f'input-only-{target}.json';meta.write_text(json.dumps(report,indent=2))
    print('INPUT_ONLY',target,int(eligible.sum()),report['npz'],sha(meta),'FULLRATE_EQUAL',equivalence,flush=True)


if __name__=='__main__':main(Path(sys.argv[1]),sys.argv[2],json.loads(sys.argv[3]))
