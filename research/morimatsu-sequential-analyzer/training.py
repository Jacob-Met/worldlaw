"""Acquire strictly training PNGs and quantify baseline per-scene optical tails."""
import pathlib,sys,os,tempfile,subprocess,hashlib,json,urllib.request as urllib
import struct,zlib,concurrent.futures as futures,collections,math
root=pathlib.Path(__file__).resolve().parent
f=json.loads((root/'source-freeze.json').read_text())
assert hashlib.sha256((root/'source-freeze.json').read_bytes()).hexdigest()=='2ebf3627b92329b1ca5cd349b087db7f2acc81eef6b371bf7c6aeea2a0c83011'
def env_imports():
    try:import numpy,cv2,scipy;assert hasattr(cv2,'IMREAD_UNCHANGED')
    except (ImportError,AssertionError):
        dep=root/'python';subprocess.run([sys.executable,'-m','pip','install','--quiet','--disable-pip-version-check','--target',str(dep),'numpy==1.26.4','scipy==1.13.1','opencv-python-headless==4.10.0.84'],check=True);sys.path.insert(0,str(dep))
env_imports()
import numpy as np,cv2
from scipy.ndimage import gaussian_filter
if (root/'python').exists():sys.path.insert(0,str(root/'python'))
def readspan(i,j):
    r=urllib.Request(f['url'],headers={'User-Agent':'Mozilla/5.0','Range':f'bytes={i}-{j}','Accept-Encoding':'identity'})
    for trial in range(3):
        try:
            with urllib.urlopen(r,timeout=45) as res:
                assert res.status==206 and res.headers['Content-Range']==f"bytes {i}-{j}/{f['archive_bytes']}"
                b=res.read(j-i+2)
                assert len(b)==j-i+1
                return b
        except Exception:
            if trial==2:raise
def download(scene,angle,allowed):
    assert scene in allowed and angle in [0,45,90,135]
    k=f'Dataset/png/{scene}/{angle}.png';e=f['pngs'][k];start=e['offset']
    name=(root/'images'/scene/f'{angle}.png');name.parent.mkdir(parents=True,exist_ok=True)
    if not name.exists():
        h=struct.unpack('<4s5H3L2H',readspan(start,start+29))
        assert h[0]==b'PK\x03\x04' and h[3]==e['method'] and e['method'] in (0,8)
        data=readspan(start+30,start+30+h[-2]+h[-1]+e['compressed']-1)
        assert data[:h[-2]].decode()==k
        body=data[h[-2]+h[-1]:]
        png=zlib.decompress(body,-15) if e['method']==8 else body
        assert len(png)==e['size'] and (zlib.crc32(png)&0xffffffff)==e['crc32']
        chunks=[];p=8
        while p<len(png):
            n=struct.unpack_from('>I',png,p)[0];t=png[p+4:p+8].decode('ascii');chunks.append(t);p+=n+12
        assert p==len(png) and png[:8]==b'\x89PNG\r\n\x1a\n'
        width,height,depth,color=struct.unpack_from('>IIBB',png,16)
        assert (width,height,depth,color)==(1024,768,16,2)
        name.write_bytes(png);name.with_suffix('.schema.json').write_text(json.dumps(dict(sha256=hashlib.sha256(png).hexdigest(),chunks=sorted(set(chunks)),size=len(png))))
    raw=name.read_bytes()
    assert len(raw)==e['size'] and zlib.crc32(raw)&0xffffffff==e['crc32']
    assert hashlib.sha256(raw).hexdigest()==json.loads(name.with_suffix('.schema.json').read_text())['sha256']
    return name
def image(scene,angle):
    b=cv2.imread(str(root/'images'/scene/f'{angle}.png'),cv2.IMREAD_UNCHANGED)
    assert b is not None and b.dtype==np.uint16 and b.shape==(768,1024,3)
    return b[:,:,1].astype(np.float32)/65535
def feature(a):
    o,g,n=a
    return np.stack([np.ones_like(o),o,g,n],axis=-1)
def report_training():
    train=f['split']['training'];out={}
    with futures.ThreadPoolExecutor(4) as pool:
        for path in pool.map(lambda args:download(*args,train),[(s,a) for s in train for a in (0,45,90,135)]): pass
    grams={}
    for s in train:
        a=[image(s,k)[16:-16:8,16:-16:8] for k in (0,45,90)];y=image(s,135)[16:-16:8,16:-16:8].ravel().astype('d')
        x=feature(a).reshape(-1,4).astype('d');grams[s]=x.T@x,x.T@y
    for s in train:
        xx=sum(g[0] for k,g in grams.items() if k!=s);xy=sum(g[1] for k,g in grams.items() if k!=s);coef=np.linalg.lstsq(xx,xy,rcond=1e-12)[0]
        a=[image(s,k) for k in (0,45,90)];y=image(s,135);x=feature(a)
        nom=np.clip(a[0]+a[2]-a[1],0,1)
        cal=np.clip(x@coef,0,1)
        interior=np.zeros(y.shape,dtype=bool);interior[16:-16,16:-16]=True
        active=interior & (np.maximum.reduce(a)<.995) & (np.minimum.reduce(a)>.005)
        err=nom-y;err2=cal-y;grad=np.hypot(*np.gradient(.5*(a[0]+a[2])))
        masks={'all':interior,'boundary':~interior,'input_in_range':active,'steep':interior&(grad>=np.quantile(grad[interior],.9))}
        val={}
        for k,m in masks.items():
            if m.any():val[k]={'n':int(m.sum()),'nominal_rmse':float(np.sqrt(np.mean(err[m].astype('d')**2))),'calibrated_rmse':float(np.sqrt(np.mean(err2[m]**2))),'mean_signed_residual':float(np.mean(err[m]))}
        ii,jj=np.unravel_index(np.argmax(np.where(interior,np.abs(err),-1)),y.shape)
        tail=np.clip(np.round(np.array([v[ii,jj] for v in a]+[y[ii,jj]])*65535),0,65535)
        # Oracle descriptive only: per-scene first-order translation and gain, no held fits.
        ss=(slice(16,-16,4),slice(16,-16,4))
        coeff=np.stack([p[ss] for v in a for p in np.gradient(v)],axis=-1).reshape(-1,6).astype('d')
        base=x[ss].reshape(-1,4).astype('d');target=y[ss].ravel().astype('d')
        z=np.column_stack([base,coeff])
        local,res,rank,sv=np.linalg.lstsq(z,target,rcond=1e-9)
        oraw=target-z@local
        out[s]={'summary':val,'loo_train_weights':coef.tolist(),'worst':{'row':int(ii),'col':int(jj),'green_DN_0_45_90_135':tail.astype(int).tolist(),'nominal':float(nom[ii,jj]),'error':float(err[ii,jj])},'descriptive_target_fit':{'coeffs':local.tolist(),'grid_rms':float(np.sqrt(np.mean(oraw**2))),'smallest_singular':float(sv[-1]),'rank':int(rank)}}
    (root/'training-out.json').write_text(json.dumps(out))
    hashes={p.relative_to(root).as_posix():json.loads(p.read_text()) for p in (root/'images').rglob('*.schema.json')}
    (root/'training-hashes.json').write_text(json.dumps(hashes))
    assert len(hashes)==52
    print('TRAINING',json.dumps(out,sort_keys=True),flush=True)
    print('ARTIFACTS',[(p.name,hashlib.sha256(p.read_bytes()).hexdigest()) for p in [root/'training-out.json',root/'training-hashes.json']],flush=True)
if __name__=='__main__':
    report_training()
    from author import run_author
    auth={}
    for scene in f['split']['training']:
        inputs=[image(scene,k) for k in (0,45,90)]
        outputs=run_author(inputs,root/'author-train'/scene,sys.argv[1])
        y=image(scene,135)
        auth[scene]={k:float(np.sqrt(np.mean((y[16:-16,16:-16].astype('d')-v[16:-16,16:-16])**2))) for k,v in outputs.items()}
        print('AUTHOR_TRAIN',scene,auth[scene],flush=True)
    (root/'training-author.json').write_text(json.dumps(auth))
    print('FINISHED',root,flush=True)
