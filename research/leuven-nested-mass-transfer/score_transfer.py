"""Open the complete registered four-configuration endpoint after cold forecast receipt."""
import hashlib, json, os, shutil, subprocess, sys, urllib.parse, zipfile
from pathlib import Path
import numpy as np

CONFIGS=[('1 mass',6423042,'6331889fe7c82f0210e4ed0116db2ee4',[74]),
         ('3 masses',6423046,'c5ad84b6266dd56c5b20664c7f5b29f2',[19,74,124]),
         ('4 masses',6423048,'39d6c3daca4b6dbd39ab90e248157034',[19,27,74,124]),
         ('5 masses',6423050,'236e8205e6d2246f8183acfe8d8fe131',[19,27,68,74,124])]
PREFIX='r2-estate:hamon-build-cache/research/astra62-p2-f747f5728172/leuven-subset/'

def digest(path,name):
    h=hashlib.new(name)
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1<<20),b''):h.update(chunk)
    return h.hexdigest()

def run(key):
    assert len(key)==64 and all(x in '0123456789abcdef' for x in key)
    subprocess.run(['rclone','copyto',PREFIX+key+'.zip','certified-input.zip'],check=True)
    assert digest('certified-input.zip','sha256')==key
    with zipfile.ZipFile('certified-input.zip') as z:
        raw=json.loads(z.read('source_report.json'))
        assert raw['source_only_gate'] is True and raw['held_smaller_inputs_opened']==0
        assert hashlib.sha256(z.read('prospective.json')).hexdigest()=='a36cf6fdb1eb806b4b40283ddef4bee83ab9ea18c6c851a8123d2f82a50683c3'
        z.extract('forecasts.npy','.')
    assert digest('forecasts.npy','sha256')==raw['forecast_sha256']
    pred=np.load('forecasts.npy',mmap_mode='r',allow_pickle=False)
    assert pred.shape==(4,8,13,8192)
    measured=np.empty((4,13,8192),complex)
    arm_rms=[];quarters=[];raw_worst=[];directions=[]
    for k,(name,size,md5,sites) in enumerate(CONFIGS):
        file=name+'.npz';url='https://zenodo.org/api/records/11033677/files/'+urllib.parse.quote(file)+'/content'
        subprocess.run(['curl','-fsSL','--retry','1','--max-time','180',url,'-o',file],check=True)
        assert os.path.getsize(file)==size and digest(file,'md5')==md5
        with np.load(file,allow_pickle=False) as z:
            assert np.array_equal(z['mass_nodes'].ravel(),sites)
            arr=z['frf'];assert arr.shape==(7,7,8192)
            measured[k]=np.concatenate([arr[6,:,:],arr[:6,6,:]],axis=0)
        truth=measured[k]
        assert np.isfinite(truth).all()
        err=np.abs(pred[k]-truth)**2
        rms=lambda x:np.sqrt(np.mean(x,axis=(-1,-2)))
        den=rms(abs(truth)**2)
        assert den>0
        arm_rms.append((rms(err)/den).tolist())
        directions.append({key:(rms(err[:,sl,:])/rms(abs(truth[sl,:])**2)).tolist() for key,sl in [('row_cross',slice(0,6)),('self',slice(6,7)),('column_cross',slice(7,13))]})
        quarters.append([(rms(err[...,i:i+2048])/rms(abs(truth[:,i:i+2048])**2)).tolist() for i in range(0,8192,2048)])
        c,f=np.unravel_index(np.argmax(err[0]),err[0].shape)
        pair=lambda z:[float(z.real),float(z.imag)]
        raw_worst.append({'configuration':name,'component':int(c),'frequency_index':int(f),'hz':1600*int(f)/8191,
                         'true':pair(truth[c,f]),'pred':[pair(x) for x in pred[k,:,c,f]],
                         'absolute_error':np.sqrt(err[:,c,f]).tolist()})
    arr=np.array(arm_rms);mean=arr.mean(axis=0);maximum=arr.max(axis=0)
    gates={'mean':(mean[0]<mean[1:]).tolist(),'worst':(maximum[0]<maximum[1:]).tolist()}
    report={'arms':raw['arms'],'conditions':[v[0] for v in CONFIGS],'source_lock':key,'per_state':arm_rms,
            'quarters':quarters,'directions':directions,'mean':mean.tolist(),'worst':maximum.tolist(),'gates':gates,
            'joint':all(gates['mean']+gates['worst']),'worst_one_per_state':raw_worst,
            'n_unique_complex_targets':int(measured.size),'elongated_state_opened':False}
    Path('result.json').write_text(json.dumps(report,sort_keys=True,allow_nan=False))
    np.save('primary-measured.npy',measured)
    with zipfile.ZipFile('scored.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as z:
        for n in ['result.json','primary-measured.npy','score_transfer.py']+[u[0]+'.npz' for u in CONFIGS]:z.write(n)
    sha=digest('scored.zip','sha256');dest=PREFIX+sha+'.zip'
    subprocess.run(['rclone','copyto','scored.zip',dest],check=True)
    subprocess.run(['rclone','copyto',dest,'cold-score.zip'],check=True)
    assert digest('cold-score.zip','sha256')==sha
    print('COLD_SCORE',dest,os.stat('scored.zip').st_size,flush=True)
    print(json.dumps(report,sort_keys=True))

if __name__=='__main__':run(sys.argv[1])
