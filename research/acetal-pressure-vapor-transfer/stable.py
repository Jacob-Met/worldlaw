"""Reachable pressure intervals for the binary tangent inequalities."""
import math
import numpy as np

GRID = 256
GUARD = 2e-12


def merge(intervals):
    ans = []
    for lo, hi in sorted(intervals):
        if not ans or lo > ans[-1][1]:
            ans.append([lo, hi])
        else:
            ans[-1][1] = max(ans[-1][1], hi)
    return ans


def f(x, y):
    if y == 0:
        return 0.0 if x == 0 else -math.inf
    if y == 1:
        return 0.0 if x == 1 else -math.inf
    return x*math.log(y) + (1-x)*math.log1p(-y)


def range_f(xrange, yboxes):
    low, high = [], []
    for l, r in yboxes:
        vals = []
        for x in xrange:
            vals.extend(f(x,y) for y in (l,r,max(l,min(r,x))))
        low.append(min(vals))
        high.append(max(vals))
    return np.array(low), np.array(high)


def transitions(x, boxes, outer):
    edges = []
    n = len(x)
    for i in range(n-1):
        a,b = boxes[i],boxes[i+1]
        if i == 0:
            # g(0)>=log Pj(1-yj). The pressure at the pure endpoint is a shared state.
            low = np.full((1,len(b)),-np.inf)
            hi = np.array([[-math.log1p(-r) if r<1 else np.inf for _,r in b]])
        elif i == n-2:
            low = np.array([[math.log(l) if l>0 else -np.inf] for l,_ in a])
            hi = np.full((len(a),1),np.inf)
        else:
            def xx(z):
                return (max(0,z-.005),min(1,z+.005)) if outer else (z,z)
            li,hi_i=range_f(xx(x[i]),a)
            lj,hj=range_f(xx(x[i+1]),a)
            li_b,hi_b=range_f(xx(x[i]),b)
            lj_b,hj_b=range_f(xx(x[i+1]),b)
            low=lj[:,None]-hj_b[None,:]
            hi=hi_i[:,None]-li_b[None,:]
            impossible=np.array([l for l,r in a])[:,None]>np.array([r for l,r in b])[None,:]
            low[impossible]=np.inf
            hi[impossible]=-np.inf
        edges.append((low-GUARD,hi+GUARD) if outer else (low+GUARD,hi-GUARD))
    return edges


def propagate(domains, edges):
    current=[[domains[0]]]
    history=[current]
    for j,(L,U) in enumerate(edges):
        target_lo,target_hi=domains[j+1]
        dest=[[] for _ in range(L.shape[1])]
        for i, prior in enumerate(current):
            for lo,hi in prior:
                left=np.maximum(target_lo,lo+L[i])
                right=np.minimum(target_hi,hi+U[i])
                for k in np.flatnonzero(left<=right):
                    dest[k].append([float(left[k]),float(right[k])])
        current=[merge(p) for p in dest]
        history.append(current)
    return history


def solve(x,p,u,t,outer):
    n=len(p)
    mid=.5*(min(t)+max(t))
    span=.06*np.abs(t-mid)
    domains=list(zip(np.log(p-u)-span,np.log(p+u)+span))
    inside=[(k/GRID,(k+1)/GRID) for k in range(GRID)] if outer else [(k/GRID,k/GRID) for k in range(1,GRID)]
    boxes=[[(0.,0.)]]+[inside]*(n-2)+[[(1.,1.)]]
    edge=transitions(x,boxes,outer)
    forward=propagate(domains,edge)
    reverse=propagate(domains[::-1],[(-hi.T,-lo.T) for lo,hi in edge[::-1]])[::-1]
    if not forward[-1][0]:
        return None
    bounds=[]
    limits=[]
    for fwd,bwd,box in zip(forward,reverse,boxes):
        supported=[k for k,(aa,bb) in enumerate(zip(fwd,bwd)) if any(max(a,c)<=min(b,d) for a,b in aa for c,d in bb)]
        assert supported
        limits.append((min(supported),max(supported)))
        bounds.append([box[min(supported)][0],box[max(supported)][1]])
    out={"bounds":bounds}
    if not outer:
        j=max(range(1,n-1),key=lambda i:bounds[i][1]-bounds[i][0])
        witnesses=[]
        for state in limits[j]:
            v=[None]*n
            pp=[None]*n
            v[j]=state
            p0=next((max(a,c)+min(b,d))/2 for a,b in forward[j][state] for c,d in reverse[j][state] if max(a,c)<=min(b,d))
            pp[j]=p0
            def choose(sets,lo,hi):
                for k,ivals in enumerate(sets):
                    for a,b in ivals:
                        a1=max(a,lo[k]);b1=min(b,hi[k])
                        if a1<=b1:
                            return k,(a1+b1)/2
                raise ValueError("backtrace has no shared-pressure witness")
            for i in range(j-1,-1,-1):
                L,U=edge[i];k=v[i+1]
                v[i],pp[i]=choose(forward[i],pp[i+1]-U[:,k],pp[i+1]-L[:,k])
            for i in range(j+1,n):
                L,U=edge[i-1];k=v[i-1]
                v[i],pp[i]=choose(reverse[i],pp[i-1]+L[k],pp[i-1]+U[k])
            assert all(a-1e-11<=pv<=b+1e-11 for pv,(a,b) in zip(pp,domains))
            assert all(L[v[i],v[i+1]]-1e-11<=pp[i+1]-pp[i]<=U[v[i],v[i+1]]+1e-11 for i,(L,U) in enumerate(edge))
            witnesses.append({"y":[boxes[i][k][0] for i,k in enumerate(v)],"pressure_kpa":np.exp(pp).tolist()})
        out.update(widest_index=j,witnesses=witnesses)
    return out


def curvature(x,p,u,t):
    k=int(np.argmax(p))
    if k==0 or k==len(x)-1:
        return {"max_index":k,"interior":False}
    ans={}
    for stride in (1,2):
        ids=[k-stride,k,k+stride]
        if ids[0]<0 or ids[-1]>=len(x):continue
        xx=x[ids];pp=p[ids];uu=u[ids];tt=t[ids]
        mid=(min(t)+max(t))/2
        def estimate(z):
            return 2*((z[2]-z[1])/(xx[2]-xx[1])-(z[1]-z[0])/(xx[1]-xx[0]))/(xx[2]-xx[0])
        # Conditional on the reported liquid compositions. Coefficients have +,-,+ signs.
        lo=np.log(pp-uu)-.06*np.abs(tt-mid)
        hi=np.log(pp+uu)+.06*np.abs(tt-mid)
        ans[str(stride)]=[estimate(np.log(pp)),estimate([lo[0],hi[1],lo[2]]),estimate([hi[0],lo[1],hi[2]])]
    return {"max_index":k,"interior":True,"finite_difference":ans}
