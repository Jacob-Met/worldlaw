"""Source-conditioned local distribution forecasts with identical information controls."""
import hashlib
import json
import math
import numpy as np
from scipy.spatial import cKDTree

ARMS=("prior","state16","state64","state256","recent16","recent64","recent256","history64","shuffled64")
FLOORS=np.array([.03,.03,1.,1.,.04,4.,.03])

def permutation(x):
    # Shuffle the two earlier-history features together inside donor state/clock/
    # recent-displacement cells; singleton cells remain unchanged.
    cells={}
    for i,row in enumerate(x):
        key=(math.floor(row[0]/.1),math.floor(row[1]*10),int(row[2]),int(row[3]),math.floor(row[4]/.25))
        cells.setdefault(key,[]).append(i)
    perm=np.arange(len(x))
    for ids in cells.values():
        if len(ids)>1:perm[ids]=np.roll(ids,len(ids)//2)
    return perm

def neighbors(train,query,y,k):
    k=min(len(train),k)
    if k==len(train):
        return np.repeat(y.mean(axis=0)[None,:],len(query),axis=0)
    distance,ids=cKDTree(train).query(query,k=k+1,workers=1)
    # Resolve exact kth-neighbor ties by the stable source-column order.
    tied=np.where(distance[:,k]==distance[:,k-1])[0]
    for row in tied:
        d2=np.sum((train-query[row])**2,axis=1)
        ids[row,:k]=np.lexsort((np.arange(len(train)),d2))[:k]
    return y[ids[:,:k]].mean(axis=1)

def forecast(x,y,z):
    if not len(x):raise ValueError("No observed source support")
    scale=np.maximum(np.quantile(x,.75,axis=0)-np.quantile(x,.25,axis=0),FLOORS)
    scale[2:4]=1.
    origin=np.median(x,axis=0)
    train=(x-origin)/scale
    query=(z-origin)/scale
    out={"prior":np.repeat(y.mean(axis=0)[None,:],len(z),axis=0)}
    for tag,n in (("state",4),("recent",5)):
        for k in (16,64,256):
            out[tag+str(k)]=neighbors(train[:,:n],query[:,:n],y,k)
    out["history64"]=neighbors(train,query,y,64)
    permuted=train.copy()
    permuted[:,5:]=permuted[permutation(x),5:]
    out["shuffled64"]=neighbors(permuted,query,y,64)
    return np.stack([out[k] for k in ARMS],axis=1)
