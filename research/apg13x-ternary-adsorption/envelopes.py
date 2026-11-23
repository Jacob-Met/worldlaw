"""Pure-parameter IAST, same-input binary corrections, and finite-grid site envelopes."""
import itertools,json,sys,warnings
from pathlib import Path
import numpy as np
from scipy.optimize import linprog,least_squares,brentq

AUTH=np.array([[4.11,4.99e-6,14.4,.99],[3.85,3.89e-6,13.6,.86],[6.82,1.29e-6,39.2,.29]])
R=.00831446261815324
GRID=np.array([0.,1e-5,1e-4,1e-3,1e-2,1e-1,1.,10.,100.])
AFF=np.array([v for v in itertools.product(GRID,repeat=3) if any(v)])
MAX_CAP=2*max(AUTH[:,0])
FLOOR=.01
def q_toth(par,T,p):
    cap,b0,dh,n=par
    x=b0*np.exp(dh/(R*T))*np.asarray(p)
    return cap*x/(1+x**n)**(1/n)
def refit(pure):
    pars=[]
    for i,row in enumerate(AUTH):
        data=[v for v in pure if v['i']==i];t,p,q=np.array([(v['T'],v['P']*v['y'],v['q']) for v in data]).T
        def unpack(a):return np.array([np.exp(a[0]),np.exp(a[1]),a[2],np.exp(a[3])])
        seed=[np.log(row[0]),np.log(row[1]),row[2],np.log(row[3])]
        opt=least_squares(lambda z:q_toth(unpack(z),t,p)-q,seed,bounds=([np.log(.1),-40,0,np.log(.05)],[np.log(100),5,100,np.log(5)]),ftol=1e-11,xtol=1e-11,gtol=1e-11,max_nfev=2000)
        assert opt.success
        pars.append(unpack(opt.x))
    return np.array(pars)
class IdealMixture:
    def __init__(self,pars,T):
        self.p=pars;self.T=T;self.lp=np.linspace(-36,41,49153)
        qs=np.array([q_toth(v,T,np.exp(self.lp)) for v in pars])
        increments=(qs[:,1:]+qs[:,:-1])*.5*np.diff(self.lp)
        tail=qs[:,:1]
        self.pi=np.concatenate([tail,tail+np.cumsum(increments,axis=1)],axis=1)
    def __call__(self,p):
        p=np.asarray(p);ids=np.flatnonzero(p)
        if len(ids)==1:
            q=np.zeros(3);i=ids[0];q[i]=q_toth(self.p[i],self.T,p[i]);return q
        def xi(pi):return np.array([p[i]*np.exp(-np.interp(pi,self.pi[i],self.lp)) for i in ids])
        pi=brentq(lambda t:xi(t).sum()-1,max(self.pi[i,0] for i in ids),min(self.pi[i,-1] for i in ids),xtol=1e-13)
        x=xi(pi);p0=p[ids]/x
        total=1/sum(xx/q_toth(self.p[i],self.T,pz) for i,xx,pz in zip(ids,x,p0))
        q=np.zeros(3);q[ids]=x*total
        return q
def design(pp):
    occ=AFF*np.array(pp)
    return (occ/(1+occ.sum(axis=1)[:,None])).T
def calibration(pure,binary,T):
    mat=[];obs=[];err=[]
    for r in pure:
        if r['T']!=T:continue
        i=r['i'];p=np.zeros(3);p[i]=r['P']*r['y']
        mat.append(design(p)[i]);obs.append(r['q']);err.append(max(FLOOR,r['u']))
    for r in binary:
        if r['T']!=T:continue
        part=np.array(r['y'])*r['P'];basis=design(part)
        for i,q,u in zip(r['components'],r['q'],r['u']):
            mat.append(basis[i]);obs.append(q);err.append(max(FLOOR,u))
    return np.array(mat),np.array(obs),np.array(err)
def site_bounds(f,y,u,targets):
    s=len(AFF);f=f/u[:,None];y=y/u
    g=np.vstack([f,-f]);bounds=np.r_[y,-y]
    mat=np.block([[g,-np.ones((len(g),1))],[np.ones((1,s)),np.zeros((1,1))]])
    opt=linprog(np.r_[np.zeros(s),1.],A_ub=mat,b_ub=np.r_[bounds,MAX_CAP],bounds=(0,None),method='highs')
    assert opt.success,opt.message
    rho=float(opt.x[-1]);radius=max(1.,rho)+.05
    constraint=np.vstack([g,np.ones(s)]);cap=np.r_[bounds+radius,MAX_CAP]
    lo=[];hi=[];point=[];ind=[];width_pair=[]
    w=opt.x[:-1]
    mass=w.sum();hist=np.zeros((9,9,9));hist.flat[1:]=w
    if mass<=0:raise ValueError('zero fitted site mass')
    independent=(np.einsum('i,j,k->ijk',hist.sum((1,2)),hist.sum((0,2)),hist.sum((0,1)))/(mass*mass)).ravel()[1:]
    for p in targets:
        a=design(p);point.append(a@w);ind.append(a@independent)
        lower=[];upper=[]
        for row in a:
            for sign,collector in [(1,lower),(-1,upper)]:
                sol=linprog(sign*row,A_ub=constraint,b_ub=cap,bounds=(0,None),method='highs')
                assert sol.success and np.max(constraint@sol.x-cap)<2e-5,sol.message
                collector.append(float(row@sol.x))
        lo.append(lower);hi.append(upper)
    return np.array(lo),np.array(hi),np.array(point),np.array(ind),{'minimum_standardized_slack':rho,'strict_one_uncertainty_feasible':bool(rho<=1+1e-7),'comparison_radius':radius,'capacity_cap':MAX_CAP,'fitted_capacity':mass,'training_components':len(y),'grid_atoms':len(AFF),'weight_nonzero':int(sum(w>1e-8))}
def pair_adjust(ideal,binary,T,pp):
    base=ideal(pp);out=[base.copy(),base.copy()]
    for i in range(3):
        others=[j for j in range(3) if i!=j]
        for j in others:
            p=pp[i]+pp[j];yi=pp[i]/p;weight=pp[j]/pp[others].sum()
            records=[r for r in binary if r['T']==T and set(r['components'])=={i,j}]
            curves=[];logs=[]
            for pressure_bin in [False,True]:
                rows=[r for r in records if (r['P']>500)==pressure_bin]
                grid=[]
                for r in rows:
                    partial=np.array(r['y'])*r['P'];pred=ideal(partial)[i];q=r['q'][r['components'].index(i)]
                    grid.append([r['y'][i]/sum(r['y']),q-pred,np.log((max(0,q)+.03)/(pred+.03))])
                g=np.array(sorted(grid));logs.append(np.mean(np.log([r['P'] for r in rows])))
                curves.append([np.interp(yi,g[:,0],g[:,k]) for k in [1,2]])
            v=np.array(curves);a,c=[np.interp(np.log(p),logs,v[:,k]) for k in [0,1]]
            out[0][i]+=weight*a
            # Weighted log correction applied once after accumulating all contributing pairs.
            out[1][i]+=weight*c
    additive=np.maximum(0,out[0])
    multiplicative=np.maximum(0,(base+.03)*np.exp(out[1]-base)-.03)
    return additive,multiplicative
NAMES=['site_midrange','author_toth_iast','refit_pure_iast','binary_additive_iast','binary_logratio_iast','site_minimax_vertex','independent_site_affinities']
def run(filename):
    src=json.loads(Path(filename).read_text());pure=src['pure'];binary=src['binary'];held=src['ternary_inputs']
    pars=refit(pure);results=[];limits={}
    for T in [333,303,273]:
        arm=IdealMixture(AUTH,T);ref=IdealMixture(pars,T);rows=[a for a in held if a['T']==T]
        pp=np.array([np.array(a['y'])*a['P'] for a in rows])
        lo,hi,one,ind,info=site_bounds(*calibration(pure,binary,T),pp);limits[T]=info
        for k,r in enumerate(rows):
            add,rat=pair_adjust(arm,binary,T,pp[k])
            preds=np.array([(lo[k]+hi[k])/2,arm(pp[k]),ref(pp[k]),add,rat,one[k],ind[k]])
            assert np.isfinite(preds).all() and np.all(hi[k]+1e-7>=lo[k])
            results.append({'row':r,'predictions':preds.tolist(),'lo':lo[k].tolist(),'hi':hi[k].tolist()})
    result=dict(arms=NAMES,stock_pure_parameters=AUTH.tolist(),pure_refit=pars.tolist(),bounds=limits,forecasts=results,observed_ternary_capacity_columns_used=0)
    Path('predictions.json').write_text(json.dumps(result,sort_keys=True,separators=(',',':')))
    return result
if __name__=='__main__':print('CLOSED_FORECAST',run(sys.argv[1])['bounds'],flush=True)
