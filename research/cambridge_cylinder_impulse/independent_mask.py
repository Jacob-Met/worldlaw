"""Independent ndimage reconstruction of every registered mask/encoder diagnostic frame."""
import hashlib,json,math,pathlib,sys,zipfile
import numpy as np
from scipy.ndimage import label,find_objects
from scipy.interpolate import interp1d
p=pathlib.Path(sys.argv[1]);ref=json.loads((pathlib.Path(__file__).resolve().parent/'mask-clock-result.json').read_bytes())
h=hashlib.sha256()
with p.open('rb') as f:
    for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
assert h.hexdigest()=='be4bca8565b16ecb8c0d992f5c9c3a9028e88a44ffbc64319c8a4181eb9e1367'
verified=0; paired=0; maxdelta=0.; summary={}
with zipfile.ZipFile(p) as z:
    for tag,original in ref.items():
        spin=int(tag); mode=202 if spin==0 else 2202; fs=1200 if spin==3 else 800
        names=[n for n in z.namelist() if n.startswith('Open Access Data/Alfa_'+tag+'_') and n.endswith('.dat')]
        pick=lambda s:next(n for n in names if n.endswith(s))
        with z.open(pick('_Data.dat')) as f:ks=np.loadtxt(f,usecols=(0,2))
        encoder=interp1d(ks[:,0],ks[:,1],assume_sorted=True)
        qxy=[]
        for ax in ('x','y'):
            with z.open(pick('_Mode_'+str(mode)+'_'+ax+'.dat')) as f:qxy.append(np.loadtxt(f))
        xx,yy=qxy;xs=np.unique(xx);ys=np.unique(yy);dx=np.median(np.diff(xs));dy=np.median(np.diff(ys))
        with z.open(pick('_Mode_'+str(mode)+'_Mask.dat')) as f:
            first=np.fromstring(f.readline(),sep=' ');N=len(first)
            ix=sorted(set(range(0,N,max(1,N//40)))|{N-1})
            flags=[first[ix]]
            for line in f:flags.append(np.fromstring(line,sep=' ')[ix])
        m=np.empty((len(ys),len(xs),len(ix)),dtype='int8');m[np.searchsorted(ys,yy),np.searchsorted(xs,xx)]=np.asarray(flags)
        anchor=None;streak=mx=0;wh=None;nf=0
        assert len(ix)==len(original['frames'])
        for j,(k,r) in enumerate(zip(ix,original['frames'])):
            assert k==r['piv_frame']; bins,num=label(m[:,:,j]==0);objs=find_objects(bins);cand=[]
            for symbol,box in enumerate(objs,1):
                if box is None:continue
                sy,sx=box
                if min(sy.start,sx.start)==0 or sy.stop==len(ys) or sx.stop==len(xs):continue
                iy,ic=np.where(bins[box]==symbol);x=xs[ic+sx.start];y=ys[iy+sy.start];n=len(x)
                ar=n*dx*dy/(math.pi*.03**2)
                if n<100 or not .60<=ar<=1.6:continue
                cx=np.mean(x);cy=np.mean(y);bx=.5*(x.min()+x.max());by=.5*(y.min()+y.max())
                xv=x-cx;yv=y-cy;A=np.dot(xv,xv);B=np.dot(xv,yv);C=np.dot(yv,yv)
                gap=math.hypot(A-C,2*B); er=(A+C+gap)/(A+C-gap) if A+C>gap else math.inf
                if er<=1.6 and math.hypot(cx-bx,cy-by)<=2*max(dx,dy):cand.append((cx,cy,bx,by,ar))
            assert len(cand)==r['qualified_components'];verified+=1
            if j==0 and len(cand)==1:anchor=cand[0]
            if anchor is None or len(cand)!=1:streak=0;continue
            c=cand[0];dd=float(abs(encoder(k/fs)-encoder(0)));g=[abs(c[0]-anchor[0])-dd,abs(c[2]-anchor[2])-dd]
            maxdelta=max(maxdelta,max(abs(q-v) for q,v in zip(g,r['differences'])),abs(c[4]-r['mask_area_ratio']))
            paired+=1;nf+=1
            if g[0]*g[1]>0 and min(map(abs,g))>.015:streak+=1
            else:streak=0
            mx=max(mx,streak)
            if wh is None or abs(g[0])>abs(wh[-2]):wh=[k,k/fs,dd,abs(c[0]-anchor[0]),abs(c[2]-anchor[2]),g[0],g[1]]
        assert mx==original['longest_consecutive_15mm_disagreements'] and nf==original['paired_frames'] and (mx>=3)==original['flagged']
        summary[tag]=[mx,nf,wh]
assert maxdelta<4e-13
print(json.dumps({'source_sha256':h.hexdigest(),'verified_frames':verified,'paired_frames':paired,'maximum_absolute_comparison_disagreement':maxdelta,'digest_of_reference':hashlib.sha256((pathlib.Path(__file__).resolve().parent/'mask-clock-result.json').read_bytes()).hexdigest(),'cases':summary,'load_and_PIV_velocity_cells_decoded':0},sort_keys=True))
