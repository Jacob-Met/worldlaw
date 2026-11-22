"""Independent numerical receipt for all locked Davis roles and all five held runs."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import urllib.request as net
import zipfile
import numpy as np
from scipy.io import loadmat

def sha(x):return hashlib.sha256(x).hexdigest()
def same(x,y,tol=1e-10):
    np.testing.assert_allclose(np.asarray(x,float),np.asarray(y,float),rtol=tol,atol=tol)
def main(expected_predictions,expected_scores):
    score_bytes=Path('score.json').read_bytes()
    assert sha(score_bytes)==expected_scores
    s=json.loads(score_bytes)
    b=Path('predictions.zip').read_bytes();assert sha(b)==expected_predictions==s['archive_sha256']
    with net.urlopen('https://api.figshare.com/v2/articles/659465/versions/4',timeout=60) as f:m=json.load(f)
    file=next(e for e in m['files'] if e['id']==1017793)
    with net.urlopen(file.get('downloadUrl') or file['download_url'],timeout=100) as f:orig=f.read()
    assert hashlib.md5(orig).hexdigest()=='8925348defff91382ed82ac39a454207'
    assert sha(orig)=='ed27649e51a4132fc24a799bef2d3e0cec6a5b15980b17e19fb392a126da0a51'
    archive=zipfile.ZipFile(io.BytesIO(b));lb=archive.read('lock.json');assert sha(lb)==s['lock_sha256']
    lock=json.loads(lb);results={};raw_data={};ss={}
    roster=json.loads(Path('split.json').read_text())
    with tarfile.open(fileobj=io.BytesIO(orig),mode='r|gz') as ar:
        for el in ar:
            if not el.isfile():continue
            ident=int(Path(el.name).stem);ab=ar.extractfile(el).read()
            d=loadmat(io.BytesIO(ab),variable_names=['RollAngle','SteerAngle','RunID','PullForce'],squeeze_me=True)
            assert int(d['RunID'])==ident
            # Literal independent 1-indexed trigger and crop from RiderID.
            F=np.asarray(d['PullForce'])*(-1. if ident==184 else 1.)
            trigger=np.flatnonzero(np.abs(F)>50.)+1
            cut1=trigger[0]+100 if trigger[0]<=1025 else 1
            cut2=trigger[-1]-100 if trigger[-1]+1024>=len(F) else len(F)
            a=np.column_stack([d['RollAngle'],d['SteerAngle']])
            X=np.asarray(a[cut1-1:cut2],dtype=np.longdouble)
            center=np.sum(X,axis=0,dtype=np.longdouble)/len(X)
            anom=X-center
            ss[ident]=np.mean(anom*anom,axis=0,dtype=np.longdouble)
            raw_data[ident]=(F,a,anom,cut1,cut2)
    assert set(raw_data)==set(roster['held_ids']+roster['source_ids'])
    checked=0;for_primary={}
    for cell in roster['matched_cells'].values():
        ident=cell['held'][0]
        F,a,y,c1,c2=raw_data[ident]
        expected=lock['runs'][str(ident)]
        source_var=np.mean([ss[k] for k in cell['source']],axis=0,dtype=np.longdouble)
        same(source_var,expected['source_mean_square'])
        assert [int(c1-1),int(c2)]==expected['crop']
        orig_angles=a[c1-1:c2]
        packed=archive.read(f'run{ident:05}.npz');assert sha(packed)==expected['run_archive_sha256']
        role_metrics={}
        with np.load(io.BytesIO(packed),allow_pickle=False) as arrays:
            assert set(arrays.files)==set(expected['prediction_sha256'])
            for role in arrays.files:
                raw=arrays[role];assert sha(raw.tobytes(order='C'))==expected['prediction_sha256'][role]
                p=np.asarray(raw,np.longdouble)
                errors=p-y
                mse=np.mean(errors**2,axis=0,dtype=np.longdouble)
                norm=mse/source_var
                observed=s['per_run'][str(ident)][role]
                same(observed['source_normalized_mse'],norm);same(observed['rmse_rad'],np.sqrt(mse))
                same(observed['rmse_rad_uncentered_measured_angle'],np.sqrt(np.mean((p-orig_angles)**2,axis=0)))
                pos=np.unravel_index(np.argmax(abs(errors)/np.sqrt(source_var)),errors.shape)
                assert observed['max_sample']==pos[0]+c1-1 and observed['max_coordinate']==pos[1]
                role_metrics[role]=norm;checked+=2
        results[ident]=role_metrics
    for subset,key in ((roster['held_ids'],'primary_means'),([192,250,253],'unseen_initializer_supplemental_means')):
        for role in lock['roles']:
            mean=np.mean([results[i][role] for i in subset],axis=0,dtype=np.longdouble)
            same(mean,s[key][role])
            if key=='primary_means':for_primary[role]=float(np.mean(mean))
    controls=[r for r in lock['roles'] if r not in ('balance','author_refit_actual_speed')]
    assert bool(s['gate'])==all(for_primary['balance']<for_primary[r] for r in controls)
    for role in controls:
        assert s['wins_vs_each'][role]==sum(np.mean(results[i]['balance'])<np.mean(results[i][role]) for i in results)
    worst=s['worst_held_run'];z=Path('worst-held-complete-run.npz').read_bytes()
    assert sha(z)==s['complete_worst_run_sha256']
    with np.load(io.BytesIO(z),allow_pickle=False) as arr:
        assert arr['run_id'].item()==worst
        np.testing.assert_array_equal(arr['full_signed_pull_N'],raw_data[worst][0])
        np.testing.assert_array_equal(arr['full_measured_angles_rad'],raw_data[worst][1])
    receipt={'source':sha(orig),'predictions':sha(b),'score':sha(score_bytes),'arrays_verified':checked//2,
             'run_coordinate_rows_verified':checked,'primary_and_supplemental_mean_coordinates_verified':2*2*len(lock['roles']),
             'all_15_run_source_scales_reconstructed':True,'raw_worst_run_verified':worst,'gate':s['gate'],
             'macro':for_primary}
    print('INDEPENDENT '+json.dumps(receipt,sort_keys=True,allow_nan=False))
if __name__=='__main__':main(*sys.argv[1:])
