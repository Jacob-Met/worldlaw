"""Compare explicit digital winding rules without assigning one to the printer."""
import numpy as np
from igl.copyleft.cgal import mesh_boolean


def moments(t):
    # Ten independent integrals: volume, three first moments and symmetric
    # second moments. All shapes must use the same physical origin.
    if len(t)==0:return np.zeros(10)
    w=np.einsum('ij,ij->i',t[:,0],np.cross(t[:,1],t[:,2]))/6
    sm=t.sum(axis=1)
    second=(np.einsum('i,ij,ik->jk',w,sm,sm)+np.einsum('i,iaj,iak->jk',w,t,t))/20
    return np.r_[w.sum(),w@sm/4,second[np.triu_indices(3)]]


def ratio(v):
    cov=np.zeros((3,3));i,j=np.triu_indices(3)
    cov[i,j]=v[4:]/v[0];cov[j,i]=cov[i,j]
    cov-=np.outer(v[1:4],v[1:4])/v[0]**2
    val=np.linalg.eigvalsh(np.eye(3)*np.trace(cov)-cov)
    return (val/val[-1]).tolist()


def cube(r):
    xy=np.array([[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
                 [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],dtype=float)*r
    f=np.array([[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],
                [1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]])
    return xy[f]


def signed_sets(t):
    box=cube(1+2*np.abs(t).max())
    nested={}
    for sign in (1,-1):
        source=t if sign==1 else t[:,::-1]
        levels=[]
        for level in range(1,6):
            # Inside the enclosing box, the additional inverted boundary
            # contributes -1 to winding. Positive winding therefore selects
            # exactly W>=level (or -W>=level for the reversed input).
            augmented=np.concatenate([source]+[box[:,::-1]]*(level-1))
            v,fi=np.unique(augmented.reshape(-1,3),axis=0,return_inverse=True)
            f=fi.reshape(-1,3).astype(np.int64)
            vv,ff,_=mesh_boolean(v,f,type_str='union')
            moment=moments(vv[ff]) if len(ff) else np.zeros(10)
            levels.append({'level':level,'faces':len(ff),'moments':moment.tolist()})
            if not len(ff):break
        else:raise ValueError('incomplete winding-level census')
        nested[sign]=levels
    m=lambda rows:np.array([r['moments'] for r in rows])
    pos=m(nested[1]);neg=m(nested[-1])
    positive=pos[0];nonzero=pos[0]+neg[0]
    odd=np.sum(pos*np.array([(-1)**i for i in range(len(pos))])[:,None],axis=0)
    odd+=np.sum(neg*np.array([(-1)**i for i in range(len(neg))])[:,None],axis=0)
    signed=pos.sum(axis=0)-neg.sum(axis=0)
    original=moments(t)
    return {'levels':{str(k):[{'level':x['level'],'faces':x['faces'],'volume':x['moments'][0]} for x in v] for k,v in nested.items()},
            'signed_reconstruction_relative':float(np.max(abs(signed-original))/max(1,np.max(abs(original)))),
            'original':{'volume':float(original[0]),'ratios':ratio(original)},
            'alternatives':{n:{'volume':float(x[0]),'ratios':ratio(x)} for n,x in
                            [('positive',positive),('nonzero',nonzero),('odd',odd)]}}
