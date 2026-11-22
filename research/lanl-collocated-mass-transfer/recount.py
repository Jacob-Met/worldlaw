"""Independent state-15 scorer for the two immutable binary inputs; NumPy and stdlib."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import zlib

import numpy as np

MAT_HASH="d738160e7d0a2c422a1189e3fe6c47c6e978be068247f55dc5a94ca381773e0f"
FORECAST_HASH="0b250cccc9c244f4e02e53e8446e0c25e17eacfca84835a65e04ff169625ac74"


def read_source(path):
    """Decode the compressed MATLAB-v5 single-precision matrices from this pinned file."""
    data=path.read_bytes()
    if hashlib.sha256(data).hexdigest()!=MAT_HASH:raise ValueError("source SHA")
    offset=128
    arrays={}
    while offset<len(data):
        kind,count=struct.unpack_from('<II',data,offset)
        if kind!=15:raise ValueError("expected miCOMPRESSED")
        block=zlib.decompress(data[offset+8:offset+8+count])
        offset+=8+count
        kind,size=struct.unpack_from('<II',block)
        if kind!=14 or size!=len(block)-8:raise ValueError("expected miMATRIX")
        parts=[]
        i=8
        while i<len(block):
            tag,n=struct.unpack_from('<II',block,i)
            parts.append((tag,memoryview(block)[i+8:i+8+n]))
            i+=8+8*((n+7)//8)
        if [p[0] for p in parts]!=[6,5,1,7]:raise ValueError("source type mismatch")
        shape=tuple(np.frombuffer(parts[1][1],dtype='<i4'))
        name=parts[2][1].tobytes().decode()
        arrays[name]=np.frombuffer(parts[3][1],dtype='<f4').reshape(shape,order="F")
    return arrays


def check(mat,lock,original):
    if hashlib.sha256(lock.read_bytes()).hexdigest()!=FORECAST_HASH:raise ValueError("forecast SHA")
    src=read_source(mat)
    idx=np.flatnonzero(src['states'].flatten()==15)
    if not np.array_equal(idx,np.arange(140,150)):raise ValueError("roster")
    report=json.loads(original.read_text())
    roles=list(report['roles'])
    scores={k:np.zeros((10,4)) for k in roles}
    total=0.
    worst=(0.,None)
    sum_yf=np.zeros((4,385),complex)
    sum_ff=np.zeros(385)
    with np.load(lock,allow_pickle=False) as f:
        h={k:f[k] for k in roles}
        if len(roles)!=12:raise ValueError("role count")
        for trial,record in enumerate(idx):
            for win,start in enumerate(range(0,7169,512)):
                samples=src['dataset'][start:start+1024,:,record].astype(float)
                samples-=np.mean(samples,axis=0)
                y=np.fft.rfft(samples*np.hanning(1024)[:,None],axis=0)[64:449].T
                force=y[0]
                response=y[1:]
                total+=np.vdot(response,response).real
                sum_yf+=response*force.conj()
                sum_ff+=abs(force)**2
                for name in roles:
                    residual=abs(response-h[name]*force)**2
                    scores[name][trial]+=np.sum(residual,axis=1)
                    if name=='local_impedance' and residual.max()>worst[0]:
                        channel,freq=np.unravel_index(residual.argmax(),residual.shape)
                        worst=(float(residual[channel,freq]),(int(record),int(channel)+2,win,float((freq+64)*.3125)))
    errors=[]
    for k,arr in scores.items():
        original_role=report['roles'][k]
        spectral=np.sqrt(arr.sum()/total)
        frf=sum_yf/sum_ff
        frf_error=np.linalg.norm(h[k]-frf)/np.linalg.norm(frf)
        np.testing.assert_allclose(arr.sum(1),original_role['ten_trial_squared_errors'],rtol=2e-12)
        np.testing.assert_allclose(arr.sum(0),original_role['four_floor_squared_errors'],rtol=2e-12)
        errors+= [abs(spectral-original_role['relative_spectral_RMSE']),
                  abs(frf_error-original_role['pooled_H1_relative_RMSE'])]
    w=report['worst']
    assert worst[1]==(w['trial_index_zero_based'],w['floor_channel'],w['window'],w['frequency_Hz'])
    assert max(errors)<2e-12
    return {'trials':len(idx),'roles':len(roles),'floors':4,'retained_bins':385,
            'scalar_scores_checked':len(errors),'trial_floor_sums_checked':12*14,
            'max_abs_primary_and_H1_difference':max(errors),'worst_identity':worst[1]}


if __name__=='__main__':
    print(json.dumps(check(*map(Path,sys.argv[1:4]))))
