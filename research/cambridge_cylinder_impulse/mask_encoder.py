"""Position consistency on digital quality flags and encoder only. No PIV/force response decoding."""
import json,math,pathlib,sys,zipfile,hashlib
import numpy as np
from collections import deque
D=.06
def components(z):
    seen=np.zeros(z.shape,dtype=bool)
    found=[]
    for x,y in zip(*np.where((z==0)&(~seen))):
        if seen[x,y]:continue
        pts=[];q=deque([(x,y)]);seen[x,y]=True;edge=False
        while q:
            i,j=q.popleft();pts.append((i,j))
            if i==0 or j==0 or i==z.shape[0]-1 or j==z.shape[1]-1:edge=True
            for k,l in [(i-1,j),(i+1,j),(i,j-1),(i,j+1)]:
                if 0<=k<z.shape[0] and 0<=l<z.shape[1] and z[k,l]==0 and not seen[k,l]:
                    seen[k,l]=True;q.append((k,l))
        if not edge and len(pts)>=100:found.append(np.asarray(pts))
    return found
def alignment(xs,ys,occ,indices,rate,t,pos):
    area=np.median(np.diff(xs))*np.median(np.diff(ys))
    cell=max(np.median(np.diff(xs)),np.median(np.diff(ys)))
    frames=[];origin=None;streak=0;longest=0
    for j,k in enumerate(indices):
        when=float(k/rate);eligible=[]
        for pts in components(occ[:,:,j]):
            ratio=len(pts)*area/(math.pi*(D/2)**2)
            if not .60<=ratio<=1.60:continue
            xy=np.column_stack((xs[pts[:,0]],ys[pts[:,1]]))
            c=xy.mean(axis=0);m=.5*(xy.min(axis=0)+xy.max(axis=0));eig=np.linalg.eigvalsh(np.cov(xy.T))
            if eig[1]>1.6*eig[0] or np.linalg.norm(c-m)>2*cell:continue
            eligible.append([ratio,c.tolist(),m.tolist()])
        row={'piv_frame':int(k),'time':when,'qualified_components':len(eligible)}
        if len(eligible)==1:
            ratio,c,m=eligible[0]
            if j==0:origin=[c,m]
            if origin:
                enc=float(abs(np.interp(when,t,pos)-np.interp(0.,t,pos)))
                disp=[abs(c[0]-origin[0][0]),abs(m[0]-origin[1][0])]
                gap=[float(v-enc) for v in disp]
                row.update(mask_area_ratio=float(ratio),centroid=c,box_midpoint=m,mask_dx=disp,encoder_dx=enc,differences=gap)
                if (gap[0]*gap[1]>0 and min(map(abs,gap))>.25*D):streak+=1
                else:streak=0
            else:streak=0
        else:streak=0
        longest=max(streak,longest);frames.append(row)
    return {'frames':frames,'longest_consecutive_15mm_disagreements':longest,'paired_frames':sum('differences' in x for x in frames),'flagged':bool(longest>=3),'frame0_eligible':origin is not None}
def main():
    p=pathlib.Path(sys.argv[1]);digest=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(4*1024*1024),b''):digest.update(b)
    assert digest.hexdigest()=='be4bca8565b16ecb8c0d992f5c9c3a9028e88a44ffbc64319c8a4181eb9e1367'
    result={}
    with zipfile.ZipFile(p) as a:
        for sp,mode,rate in [(0,202,800),(1,2202,800),(3,2202,1200)]:
            dd=[n for n in a.namelist() if n.startswith('Open Access Data/Alfa_'+str(sp)+'_') and n.endswith('.dat')]
            def by(end):return next(k for k in dd if k.endswith(end))
            # Only t and encoder x; target columns are discarded as bytes.
            with a.open(by('_Data.dat')) as f:
                pairs=[]
                for l in f:
                    tt,_,xx,*_=l.split(None,3);pairs.append([float(tt),float(xx)])
            t,pos=np.array(pairs).T
            coords=[]
            for axis in ('x','y'):
                with a.open(by('_Mode_'+str(mode)+'_'+axis+'.dat')) as f:coords.append(np.loadtxt(f))
            X,Y=coords;xs=np.unique(X);ys=np.unique(Y)
            with a.open(by('_Mode_'+str(mode)+'_Mask.dat')) as f:
                first=np.fromstring(f.readline(),sep=' ');n=len(first);idx=np.unique(np.r_[np.arange(0,n,max(1,n//40)),n-1]).astype(int)
                v=[first[idx]]
                for line in f:v.append(np.fromstring(line,sep=' ')[idx])
            occ=np.empty((len(xs),len(ys),len(idx)),dtype=np.int8);occ[np.searchsorted(xs,X),np.searchsorted(ys,Y)]=np.array(v)
            result[str(sp)]=alignment(xs,ys,occ,idx,rate,t,pos)
    print(json.dumps(result,sort_keys=True,separators=(',',':')))
if __name__=='__main__':main()
