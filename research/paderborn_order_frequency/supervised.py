"""Paired training-article regressions for whole mixed-order/frequency transfer."""
import numpy as np
from scipy.ndimage import gaussian_filter1d
from surface import COMMON, per_bearing_loss

TERMS = ('mixed_center','healthy_low','sideband_gain','additive_healthy')
PENALTIES = (.001, .01, .1, 1., 10.)


def features(roles):
    return np.stack([roles[k] for k in TERMS], axis=-1)


def sufficient(roles, target):
    x = features(roles)
    source = roles['mixed_center']
    scale = np.mean(source[COMMON]**2)
    if not scale > 0:
        raise ValueError('Undefined source energy')
    w = COMMON / scale
    gram = np.einsum('fqa,fqb,fq->fab', x, x, w, optimize=True)
    rhs = np.einsum('fqa,fq,fq->fa', x, target, w, optimize=True)
    return gram, rhs


def coefficients(records, penalty):
    gram = np.mean([r[0] for r in records], axis=0)
    rhs = np.mean([r[1] for r in records], axis=0)
    # Fixed 250-Hz smoothing of training sufficient statistics across carrier rows.
    gram = gaussian_filter1d(gram, 2., axis=0, mode='nearest')
    rhs = gaussian_filter1d(rhs, 2., axis=0, mode='nearest')
    prior = np.array([1.,0.,0.,0.])
    mean_diag = np.trace(gram,axis1=1,axis2=2)/len(TERMS)
    reg = penalty*np.maximum(mean_diag, max(mean_diag.max()*1e-12, 1e-30))
    matrix = gram + reg[:,None,None]*np.eye(len(TERMS))
    return np.linalg.solve(matrix, (rhs + reg[:,None]*prior)[...,None])[...,0]


def affine_predict(roles,beta):
    return np.maximum(0,np.einsum('fqt,ft->fq',features(roles),beta,optimize=True))


def fit(training):
    ids=sorted(training)
    stats={k:sufficient(training[k][0],training[k][1]) for k in ids}
    errors={}
    for amount in PENALTIES:
        rows={}
        for k in ids:
            b=coefficients([stats[i] for i in ids if i!=k],amount)
            roles,y=training[k]
            rows[k]=per_bearing_loss(affine_predict(roles,b),y,roles['mixed_center'])
        errors[amount]=rows
    ridge=min(PENALTIES,key=lambda a:(np.mean(list(errors[a].values())),PENALTIES.index(a)))
    beta=coefficients(list(stats.values()),ridge)
    target_mean=np.mean([training[k][1] for k in ids],axis=0)
    delta=np.mean([training[k][1]-training[k][0]['mixed_center'] for k in ids],axis=0)
    return beta,target_mean,delta,ridge,errors


def trained_roles(roles,beta,target_mean,delta):
    return {'zero':np.zeros_like(target_mean),'mean_damaged_low':target_mean,
            'paired_damaged_offset':np.maximum(0,roles['mixed_center']+delta),
            'trained_frequency_ridge':affine_predict(roles,beta)}


def fit_cell_gains(training):
    """Learn dense multiplicative corrections using paired training bearings only."""
    from scipy.ndimage import gaussian_filter
    models={}
    for base in ('mixed_center','sideband_gain'):
        stats={}
        for ident,(roles,target) in training.items():
            x=roles[base]
            scale=np.mean(roles['mixed_center'][COMMON]**2)
            stats[ident]=(x*x/scale, x*target/scale)
        def fitted(ids,amount):
            a=np.mean([stats[i][0] for i in ids],axis=0)
            b=np.mean([stats[i][1] for i in ids],axis=0)
            smooth=lambda m:gaussian_filter(m*COMMON,(1.,8.),mode='nearest')
            a,b=smooth(a),smooth(b)
            penalty=amount*np.mean(a[COMMON])
            return (b+penalty)/(a+penalty)
        ids=sorted(stats);errors={}
        for amount in PENALTIES:
            losses=[]
            for ident in ids:
                g=fitted([i for i in ids if i!=ident],amount)
                r,y=training[ident]
                losses.append(per_bearing_loss(r[base]*g,y,r['mixed_center']))
            errors[amount]=float(np.mean(losses))
        amount=min(PENALTIES,key=lambda k:(errors[k],PENALTIES.index(k)))
        models[base]=(fitted(ids,amount),amount,errors)
    return models
