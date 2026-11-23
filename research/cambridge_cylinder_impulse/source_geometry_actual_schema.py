"""Verify original full package, map PIV geometry/quality flags and separate measured kinematics from load targets."""
import hashlib,io,json,os,pathlib,tempfile,urllib.request,zipfile
import numpy as np
def emit(t,a):print(t,json.dumps(a,separators=(',',':'),sort_keys=True),flush=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def numeric_field(f):return np.loadtxt(f)
def grid(a,member,coords):
    with a.open(member) as h:q=numeric_field(h)
    flat=q.reshape(-1)
    emit('COORD',[member,list(q.shape),float(flat.min()),float(flat.max()),len(np.unique(flat)),flat[:6].tolist()])
    coords.append(flat)
def kinetic(a,m,spin):
    # Parse exactly the first 3 (spin zero) or 5 (spinning) columns listed in the RTF.
    times=[];pos=[];speeds=[];rot=[];width={}
    with a.open(m) as f:
        for line in f:
            if not line.strip():continue
            parts=line.split();width[len(parts)]=width.get(len(parts),0)+1
            t,u,x=map(float,parts[:3]);times.append(t);pos.append(x);speeds.append(u)
            if len(parts)==7:rot.append(float(parts[4]))
            elif len(parts)!=3:raise ValueError('unqualified row width')
    emit('ALL_ROW_WIDTHS',[spin,m,width]);dt=np.diff(times);emit('KIN_CLOCK',[m,len(times),times[0],times[-1],float(np.min(dt)),float(np.median(dt)),float(np.max(dt)),min(pos),max(pos),min(speeds),max(speeds),[min(rot),max(rot)] if rot else None])
    return np.array(times),np.array(pos)
# Existing original archive; both whole-file identities are checked afresh.
p=pathlib.Path("/tmp/hamon-s-1000/354686ec7ac84ecbb23e7c4c91f9ba68/p3-cam-verified-package-af3a8ae9/Open Access Data.zip");root=p.parent
hh=hashlib.sha256();md=hashlib.md5()
with p.open('rb') as f:
    while True:
        block=f.read(4*1024*1024)
        if not block:break
        hh.update(block);md.update(block)
assert p.stat().st_size==1351560391 and md.hexdigest()=='741bce55204fdb910d38db0132baef9f' and hh.hexdigest()=='be4bca8565b16ecb8c0d992f5c9c3a9028e88a44ffbc64319c8a4181eb9e1367'
emit('QUALIFIED_EXISTING_INPUT',[str(p),p.stat().st_size,hh.hexdigest()])
with zipfile.ZipFile(p) as a:
 names=[n for n in a.namelist() if n.startswith('Open Access Data/') and n.endswith('.dat')]
 for spin,runs,mode,rate in [(0,5,202,800),(1,6,2202,800),(3,5,2202,1200)]:
    family='/Alfa_'+str(spin)+'_Re_20k/';files=[n for n in names if family in n]
    m=next(n for n in files if n.endswith('_Data.dat'));times,pos=kinetic(a,m,spin)
    cs=[]
    for axis in ('x','y'):
        grid(a,next(n for n in files if n.endswith('_Mode_'+str(mode)+'_'+axis+'.dat')),cs)
    maskname=next(n for n in files if n.endswith('_Mode_'+str(mode)+'_Mask.dat'))
    with a.open(maskname) as f:
        row=f.readline(); v=np.fromstring(row,sep=' ');k=len(v)
        chosen=np.unique(np.r_[np.arange(0,k,max(1,k//40)),k-1]).astype(int)
        flags=[v[chosen]]
        for line in f:
            v=np.fromstring(line,sep=' ');assert len(v)==k
            flags.append(v[chosen])
    G=np.asarray(flags);assert len(G)==len(cs[0])==len(cs[1])
    X,Y=cs;xs=np.unique(X);ys=np.unique(Y)
    assert len(xs)*len(ys)==len(G),'product grid'
    I=np.searchsorted(xs,X);J=np.searchsorted(ys,Y);assert len(set(zip(I,J)))==len(G)
    occ=np.empty((len(xs),len(ys),len(chosen)),dtype='int8');occ[I,J]=G
    assert np.array_equal(occ[I,J],G)
    frames=[]
    for iz,idx in enumerate(chosen):
        z=occ[:,:,iz]; missing=(z==0)
        frames.append([int(idx),round(float(idx/rate),7),int(missing.sum()),int((z==runs).sum()),[int((z[0,:]==runs).sum()),int((z[-1,:]==runs).sum()),int((z[:,0]==runs).sum()),int((z[:,-1]==runs).sum())]])
    emit('MASK',[spin,runs,rate,mode,len(xs),len(ys),k,[float(np.min(np.diff(xs))),float(np.median(np.diff(xs))),float(np.max(np.diff(xs)))],[float(np.min(np.diff(ys))),float(np.median(np.diff(ys))),float(np.max(np.diff(ys)))],np.unique(G).tolist(),frames])
    np.savez_compressed(root/('cam-mask-'+str(spin)+'.npz'),xs=xs,ys=ys,indices=chosen,occupancy=occ,t=times,position=pos)
emit('BOUNDARY',{'read':'coordinates, averaged mask occupancy, kinematic columns and clocks','physical_forces_decoded':0,'fluid_Vx_Vy_decoded':0,'workspace':str(root)})
