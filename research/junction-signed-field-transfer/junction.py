"""Signed voltage-change transfers for two complete September DC scan quartets."""
import io, json, hashlib, sys, zipfile
from pathlib import Path
import numpy as np
SHA='152b9a7566679d65b37dd7e9a899d3dc5b4e9a2a35b3f2cb8983b4fb367e90c5'
NAMES=['persistence','bias_reflection','field_reflection','joint_reflection','equal_blend','trained_mix']
def read_map(z,index):
    n=301 if index<=10 else 231
    name=next(k for k in z.namelist() if k.endswith('/datS2109_'+str(index)+'.dat'))
    data=z.read(name)
    hdr=[l.decode().strip() for l in data.splitlines() if l.startswith(b'#')]
    names=[l.split('name:',1)[1].strip() for l in hdr if l.startswith('#\tname:')]
    assert names[:4]==['dac2_(I(e-2uA))','magnetX_(Bx(T))','zchannel_()','keithley1 (e-2V)']
    a=np.loadtxt(io.BytesIO(data),usecols=(0,1,3)).reshape(n,n,3)
    assert np.isfinite(a).all()
    i,b=a[:,:,0],a[:,:,1]
    ci=1 if index in [7,9,23,25] else -1;cb=1 if index in [7,8,23,24] else -1
    assert np.all(ci*np.diff(i,axis=1)>0) and np.all(cb*np.diff(b[:,0])>0) and np.all(b==b[:,:1])
    assert np.allclose(i,i[:1,:],rtol=0,atol=1e-11)
    current=i[0,::ci];field=b[::cb,0]
    assert np.max(abs(current+current[::-1]))<1e-9 and np.max(abs(field+field[::-1]))<1e-12
    assert current[n//2]==0
    v=a[::cb,::ci,2].copy()
    return v,current,field

def maps(z,ids):
    vv,ic,bb=zip(*(read_map(z,i) for i in ids))
    assert all(np.array_equal(ic[0],v) for v in ic) and all(np.array_equal(bb[0],v) for v in bb)
    raw=np.stack(vv)
    return raw,raw-raw[:,:,raw.shape[2]//2,None],ic[0],bb[0]

def arms(a):
    return np.stack([a,-a[::-1,:,::-1],a[:,::-1,:],-a[::-1,::-1,::-1]],axis=-1)

def device(src,mode):
    assert hashlib.sha256(Path(src).read_bytes()).hexdigest()==SHA
    with zipfile.ZipFile(src) as z:
        if mode=='forecast':
            _,early,_,_=maps(z,[7,8]);_,cal,_,_=maps(z,[9,10])
            _,late,ic,bb=maps(z,[23,24]);x=arms(early).reshape(-1,4)
            g=x.T@x;ridge=1.e-8*np.trace(g)/4
            assert ridge>0
            weights=np.linalg.solve(g+np.eye(4)*ridge,x.T@cal.ravel())
            y=arms(late);pred=np.concatenate([y,y.mean(axis=-1,keepdims=True),(y@weights)[...,None]],axis=-1)
            assert np.isfinite(pred).all()
            np.savez_compressed('locked.npz',predictions=pred,weights=weights,current=ic,field=bb)
            print('LOCK',hashlib.sha256(Path('locked.npz').read_bytes()).hexdigest(),pred.shape,weights.tolist(),flush=True)
        else:
            with np.load(mode) as lock:p=lock['predictions'];ic=lock['current'];bb=lock['field']
            raw,y,c,b=maps(z,[25,26]);assert np.array_equal(c,ic) and np.array_equal(b,bb)
            err=p-y[...,None];r=np.sqrt(np.mean(err**2,axis=(1,2)));q=np.sqrt(np.mean(err**2,axis=2)).max(axis=1)
            tests=[bool(m[j,3]<np.min(np.delete(m[j],3))) for m in [r,q] for j in range(2)]
            j,h,i=np.unravel_index(np.argmax(abs(err[...,3])),y.shape)
            report=dict(arms=NAMES,rmse=r.tolist(),worst_field_rmse=q.tolist(),gates=tests,joint=all(tests),worst=dict(file=[25,26][j],field=float(bb[h]),current=float(ic[i]),input_row_order='ascending-current/ascending-field analysis indices',array_indices=[int(j),int(h),int(i)],raw=float(raw[j,h,i]),reference=float(raw[j,h,len(c)//2]),observed=float(y[j,h,i]),pred=p[j,h,i].tolist(),error=err[j,h,i].tolist()))
            Path('result.json').write_text(json.dumps(report,sort_keys=True))
            print('OUTCOME',json.dumps(report,sort_keys=True),flush=True)
if __name__=='__main__':device(*sys.argv[1:])
