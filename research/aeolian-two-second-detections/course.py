"""One-step-ahead evaluation of observed sand-particle activity using native sample order."""
from argparse import ArgumentParser
from collections import Counter
import hashlib
import json
from pathlib import Path
import pickle

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

DATES = {'train': {'20141113','20141114','20150323'}, 'development': {'20141120','20150324'}}
SPEC = {'coarse_logit': ('base','logit'), 'coarse_boost':('base','boost'),
        'ordered_logit':('ordered','logit'), 'ordered_boost':('ordered','boost'),
        'arrival_logit':('arrival','logit'), 'gust_logit':('gust','logit'),
        'reverse_gust_logit':('reverse','logit'), 'gust_arrival_logit':('both','logit')}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def paths(root,split):
    manifest=json.loads((root/f'manifest-{split}.json').read_text())
    assert {s.split('_')[1] for s in manifest}==DATES[split]
    return [root/(s+'.npz') for s in sorted(manifest)]


def model_rows(path, thresholds):
    with np.load(path) as data:
        w=data['wind'];p=data['pulse'];c=data['counts']
        channel=int(data['channels']);height=float(data['height'])
    assert w.shape==p.shape==(900,50) and np.allclose(p.sum(1),c,equal_nan=True)
    group={k:[] for k in ('base','ordered','arrival','gust','reverse','both')}
    key=[];ys=[];previous=[]; site,date=path.stem.split('_')[:2]
    # Histories always end before forecast origin t, including at file boundaries.
    for t in range(30,len(c)):
        ws=w[t-30:t];cs=c[t-30:t];ps=p[t-2:t].ravel()
        if not (np.isfinite(ws).all() and np.isfinite(cs).all() and np.isfinite(c[t])):continue
        base=[np.log1p(channel),height]
        for k in [1,2,4,8,15,30]:
            a=ws[-k:];b=cs[-k:]
            base.extend((a.mean(),a.std(),a.max(),np.log1p(b.mean()),(b>0).mean()))
        base.extend((ws[-1].mean()-ws[-2].mean(),ws[-2].mean()-ws[-3].mean(),*np.log1p(cs[[-1,-2]])))
        # Twenty ordered 0.2 s bins across both instruments, preceding four seconds.
        ordered=[*ws[-2:].reshape(20,5).mean(1),*np.log1p(ps.reshape(20,5).sum(1))]
        hits=np.flatnonzero(ps>0)
        arrival=[(len(ps)-hits[-1])/25 if len(hits) else 4.04]
        for k in [5,10,25,50,100]:
            part=ps[-k:];arrival.extend((np.log1p(part.sum()),(part>0).mean()))
        def gust(samples):
            v=samples.ravel(); age=np.arange(len(v)-1,-1,-1)/25
            # Exponential age weight acts only on the positive squared-speed excess.
            out=[]
            for cutoff in thresholds:
                exceed=v>cutoff
                last_low=np.flatnonzero(~exceed)
                out.append((len(v)-1-last_low[-1])/25 if len(last_low) else len(v)/25)
                surplus=np.maximum(v*v-cutoff*cutoff,0.)
                for tau in [.2, .6, 2.]:
                    weight=np.exp(-age/tau);out.append(np.dot(weight,surplus)/weight.sum())
            return out
        direct=gust(ws[-2:]);reverse=gust(ws[-2:,::-1])
        for block,extra in [('base',[]),('ordered',ordered),('arrival',arrival),('gust',direct),
                            ('reverse',arrival+reverse),('both',arrival+direct)]:
            group[block].append(base+extra)
        key.append((site,date,path.stem,t));ys.append(int(c[t]>0));previous.append(int(c[t-1]>0))
    return ({k:np.array(v) for k,v in group.items()},np.array(ys),key,np.array(previous))


def collect(items,thresholds):
    packets=[model_rows(p,thresholds) for p in items]
    admitted=[x for x in packets if len(x[1])]
    features={k:np.vstack([x[0][k] for x in admitted]) for k in admitted[0][0]}
    return features,np.concatenate([x[1] for x in admitted]),sum([x[2] for x in admitted],[]),np.concatenate([x[3] for x in admitted])


def weights(meta):
    dates={s:{d for s1,d,_,_ in meta if s1==s} for s in {r[0] for r in meta}}
    counts=Counter(k for _,_,k,_ in meta)
    blocks={d:len({k for _,d1,k,_ in meta if d1==d}) for d in {m[1] for m in meta}}
    return np.array([len(meta)/(len(dates)*len(dates[s])*blocks[d]*counts[k]) for s,d,k,t in meta])


def fit(root,out):
    items=paths(root,'train');winds=[]
    for path in items:
        with np.load(path) as data:
            w=data['wind'];winds.extend(w[np.isfinite(w)].tolist())
    cuts=np.quantile(winds,[.25,.5,.75]).tolist()
    x,y,meta,_=collect(items,cuts);ww=weights(meta)
    state={'cuts':cuts,'source_prevalence':float(np.average(y,weights=ww)),'models':{}}
    for name,(fs,model) in SPEC.items():
        z=x[fs];scale=None
        if model=='logit':
            scale=StandardScaler().fit(z,sample_weight=ww);z=scale.transform(z)
            est=LogisticRegression(C=1.,max_iter=1500)
        else:
            est=HistGradientBoostingClassifier(max_iter=125,max_leaf_nodes=9,min_samples_leaf=60,l2_regularization=1.,
                                               learning_rate=.06,early_stopping=False,random_state=0)
        est.fit(z,y,sample_weight=ww);state['models'][name]=(scale,est)
    output=out/'fitted.pkl';output.write_bytes(pickle.dumps(state,protocol=5))
    report={'source_blocks':len(items),'source_rows':len(y),'rows_by_block':dict(Counter(r[2] for r in meta)),
            'thresholds_m_s':cuts,'model_sha256':digest(output),'training_manifest':digest(root/'manifest-train.json')}
    (out/'fit-lock.json').write_text(json.dumps(report,indent=2)+'\n')
    print('FIT',json.dumps(report),flush=True)


def predict(root,fit_dir,out):
    lock=json.loads((fit_dir/'fit-lock.json').read_text())
    assert digest(fit_dir/'fitted.pkl')==lock['model_sha256']
    state=pickle.loads((fit_dir/'fitted.pkl').read_bytes())
    items=paths(root,'development');x,y,meta,previous=collect(items,state['cuts'])
    probs={'source_prevalence':np.full(len(y),state['source_prevalence']),'persistence':np.where(previous,.95,.05)}
    for name,(sc,est) in state['models'].items():
        z=x[SPEC[name][0]];probs[name]=est.predict_proba(sc.transform(z) if sc else z)[:,1]
    # Store forecasts and original integer issue keys before passing observed targets to the scorer.
    ids=np.array([r[2] for r in meta]);index=np.array([r[3] for r in meta])
    pred=out/'development-forecasts.npz';np.savez_compressed(pred,block=ids,t=index,**probs)
    target=out/'development-observations.npz';np.savez_compressed(target,block=ids,t=index,observed=y)
    lock={'fit_sha256':lock['model_sha256'],'forecast':digest(pred),'observations':digest(target),'manifest':digest(root/'manifest-development.json')}
    (out/'forecast-lock.json').write_text(json.dumps(lock,indent=2)+'\n'); print('FORECAST',json.dumps(lock),flush=True)


def score(out):
    from sklearn.metrics import log_loss
    lock=json.loads((out/'forecast-lock.json').read_text())
    pred=out/'development-forecasts.npz';obs=out/'development-observations.npz'
    assert digest(pred)==lock['forecast'] and digest(obs)==lock['observations']
    with np.load(obs) as data:
        y=data['observed'];idx=data['t'];blocks=data['block']
    results={};dates=np.array([b.split('_')[1] for b in blocks])
    with np.load(pred) as data:
        assert np.array_equal(blocks,data['block']) and np.array_equal(idx,data['t'])
        for k in data.files:
            if k in ('block','t'):continue
            p=data[k];metrics={}
            for day in sorted(set(dates)):
                scores=[]
                for b in sorted(set(blocks[dates==day])):
                    mask=blocks==b
                    scores.append([np.mean((p[mask]-y[mask])**2),log_loss(y[mask],p[mask],labels=[0,1])])
                value=np.mean(scores,axis=0);sel=np.flatnonzero(dates==day);order=sel[np.argsort(np.abs(p[sel]-y[sel]),kind='stable')[-6:][::-1]]
                metrics[day]={'brier':value[0],'logloss':value[1],'blocks':len(scores),'rows':len(sel),
                    'worst':[{'block':str(blocks[i]),'t':int(idx[i]),'p':float(p[i]),'y':int(y[i])} for i in order]}
            results[k]=metrics
    name='gust_arrival_logit';days=sorted(set(dates))
    competitors=[k for k in results if k!=name]
    relative=[results[name][d]['brier']/min(results[k][d]['brier'] for k in competitors) for d in days]
    guard=np.mean([results[name][d]['logloss'] for d in days])<=min(np.mean([results[k][d]['logloss'] for d in days]) for k in competitors)
    gate=all(r<=.95 for r in relative) and guard
    result={'results':results,'ratios_to_best_control':relative,'mean_logloss_guard':bool(guard),'advance':bool(gate),'lock':lock}
    path=out/'result.json';path.write_text(json.dumps(result,indent=2)+'\n')
    print('COURSE',[(k,[round(results[k][day]['brier'],7) for day in days]) for k in results],relative,guard,gate,digest(path),flush=True)

if __name__=='__main__':
    p=ArgumentParser();p.add_argument('mode',choices=['fit','predict','score']);p.add_argument('root',type=Path);p.add_argument('out',type=Path);p.add_argument('--fit-dir',type=Path)
    args=p.parse_args();args.out.mkdir(exist_ok=True,parents=True)
    if args.mode=='fit':fit(args.root,args.out)
    elif args.mode=='predict':predict(args.root,args.fit_dir,args.out)
    else:score(args.out)
