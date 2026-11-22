"""Source-only calibration and causal sensor decoding for the two original UCI322 records."""
import numpy as np

ROLES = ['mean','linear','static_svr','static_rbf','history_linear','history_rbf','oger','nuisance','sham']
REFERENCES = ['linear','static_svr','static_rbf','history_linear','history_rbf','oger']


def causal_history(t, x):
    """All outputs at row i depend only on input sensor rows <= i."""
    state = np.repeat(x[:1],3,axis=0)
    output = np.empty((len(x),4*x.shape[1]))
    last = t[0]
    tau = np.asarray([2.,15.,60.])
    for i,(time,values) in enumerate(zip(t,x)):
        decay=np.exp(-max(0.,time-last)/tau)[:,None]
        state=state*decay+(1-decay)*values
        output[i]=np.concatenate((values,(values-state).reshape(-1)))
        last=time
    return output


def direction(train, observed, variable):
    steps = np.flatnonzero(np.any(np.diff(train[:,1:3],axis=0)!=0,axis=1))+1
    vectors=[];retained=[]
    for pos in steps:
        old=train[pos-1,1:3];new=train[pos,1:3]
        if old[variable]==new[variable] or old[1-variable]!=new[1-variable]:continue
        t=train[pos,0];a,b,c,d=np.searchsorted(train[:,0],t+np.array([-15.,-5.,45.,60.]))
        if a==0 or b<=a or d<=c or d==len(train):continue
        if np.any(train[a:pos,1:3]!=old) or np.any(train[pos:d,1:3]!=new):continue
        v=np.sign(new[variable]-old[variable])*(np.mean(observed[c:d],axis=0)-np.mean(observed[a:b],axis=0))
        norm=np.linalg.norm(v)
        if norm:
            vectors.append(v/norm);retained.append(pos)
    if len(vectors)<5:raise ValueError('Fewer than five source isolated events for nuisance direction')
    v=np.mean(vectors,axis=0)
    return v/np.linalg.norm(v),np.asarray(retained,dtype=np.int64)


def map_sensor(rows, meta, view):
    x=(rows[:,1:]-meta['sensor_center'])/meta['sensor_scale']
    if view in ('nuisance','sham'):
        v=meta[view+'_direction']
        x=x-(x@v)[:,None]*v
    return x if view=='static' else causal_history(rows[:,0],x)


def distances(x,y):
    return np.maximum(np.sum(x*x,axis=1)[:,None]+np.sum(y*y,axis=1)[None,:]-2*x@y.T,0.)


def basis(x,meta,role):
    z=(x-meta[role+'_center'])/meta[role+'_scale']
    if role in ('linear','history_linear'):return z
    return np.column_stack((z,np.exp(-distances(z,meta[role+'_landmarks'])/meta[role+'_bandwidth'])))


def linear_fit(meta, role, features, target):
    m=features.mean(axis=0);s=features.std(axis=0);s[s<1e-9]=1
    meta[role+'_center']=m;meta[role+'_scale']=s
    if role not in ('linear','history_linear'):
        land=(features[np.linspace(0,len(features)-1,256,dtype=int)]-m)/s
        d=distances(land,land)
        meta[role+'_landmarks']=land;meta[role+'_bandwidth']=np.asarray(max(float(np.median(d[d>0])),1e-9))
    d=basis(features,meta,role)
    cm=d.mean(axis=0); y=target.mean()
    dc=d-cm
    coef=np.linalg.solve(dc.T@dc+(1e-4*len(d))*np.eye(d.shape[1]),dc.T@(target-y))
    meta[role+'_coef']=coef;meta[role+'_intercept']=np.asarray(y-cm@coef)


def fit(train, oger_coef):
    from sklearn.svm import SVR
    raw=train[:,3:]
    median=np.median(raw,axis=0);iqr=np.quantile(raw,.75,axis=0)-np.quantile(raw,.25,axis=0)
    iqr[iqr<1e-9]=1
    meta={'sensor_center':median,'sensor_scale':iqr,'mean':np.asarray(train[:,2].mean()),'oger_coef':oger_coef}
    v,events=direction(train,(raw-median)/iqr,0);ve,ev=direction(train,(raw-median)/iqr,1)
    meta.update(nuisance_direction=v,sham_direction=np.roll(v,7),ethylene_direction=ve,
                nuisance_events=events,ethylene_events=ev)
    rows=np.column_stack((train[:,0],raw));y=train[:,2]
    for view,roles in [('static',['linear','static_rbf']),('history',['history_linear','history_rbf']),('nuisance',['nuisance']),('sham',['sham'])]:
        x=map_sensor(rows,meta,view)
        for role in roles:linear_fit(meta,role,x,y)
    z=map_sensor(rows,meta,'static')
    svr=SVR(C=1.,epsilon=.1,gamma='scale',kernel='rbf',cache_size=128).fit(z,y)
    meta['svr_support']=svr.support_vectors_;meta['svr_dual']=svr.dual_coef_.reshape(-1)
    meta['svr_intercept']=svr.intercept_;meta['svr_gamma']=np.asarray(svr._gamma)
    sample=z[np.linspace(0,len(z)-1,257,dtype=int)]
    np.testing.assert_allclose(svr.predict(sample),svr_predict(sample,meta),atol=2e-8,rtol=1e-9)
    return meta


def svr_predict(z, meta):
    out=[]
    for i in range(0,len(z),128):
        d=distances(z[i:i+128],meta['svr_support'])
        out.append(np.exp(-meta['svr_gamma']*d)@meta['svr_dual']+meta['svr_intercept'][0])
    return np.concatenate(out)


def predict(rows, states, meta):
    result={'mean':np.full(len(rows),meta['mean']),
            'oger':meta['oger_coef'][0]+states@meta['oger_coef'][1:]}
    for view,roles in [('static',['linear','static_rbf']),('history',['history_linear','history_rbf']),('nuisance',['nuisance']),('sham',['sham'])]:
        x=map_sensor(rows,meta,view)
        if view=='static':result['static_svr']=svr_predict(x,meta)
        for role in roles:
            result[role]=np.concatenate([basis(x[i:i+2048],meta,role)@meta[role+'_coef']+meta[role+'_intercept'] for i in range(0,len(x),2048)])
    assert set(result)==set(ROLES) and all(np.isfinite(p).all() for p in result.values())
    return result
