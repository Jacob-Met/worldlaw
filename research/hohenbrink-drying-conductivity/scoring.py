"""Score whole curves within cores, then average cores within each coordinate site."""
import math
import statistics
from collections import defaultdict

def compare(records, labels):
    target={r['id']:list(zip(r['pF'],r['K_HyProp'])) for r in labels}
    assert set(target)=={r['id'] for r in records}
    methods=sorted(records[0]['predicted_log10'])
    assert len(methods)==9 and sum(map(len,target.values()))==13549
    scopes=['all','below_2','at_or_above_2'];tables={s:{m:defaultdict(list) for m in methods} for s in scopes};samples=[];worst={m:None for m in methods}
    for r in records:
     points=target[r['id']];pf=[p[0] for p in points];K=[p[1] for p in points]
     assert pf==r['pF'] and all(math.isfinite(k) and k>0 for k in K) and set(r['predicted_log10'])==set(methods)
     y=list(map(math.log10,K));site=','.join(map(str,r['site']));per={}
     for m in methods:
      z=r['predicted_log10'][m];assert len(z)==len(pf) and all(map(math.isfinite,z))
      err=[v-o for v,o in zip(z,y)]
      for s,ix in [('all',list(range(len(z)))),('below_2',[i for i,h in enumerate(pf) if h<2]),('at_or_above_2',[i for i,h in enumerate(pf) if h>=2])]:
       if not ix:continue
       rms=math.sqrt(sum(err[i]**2 for i in ix)/len(ix));tables[s][m][site].append(rms)
       if s=='all':per[m]=rms
      j=max(range(len(err)),key=lambda i:abs(err[i]))
      if worst[m] is None or abs(err[j])>abs(worst[m]['signed_log_error']):
       worst[m]={'id':r['id'],'site':site,'index':j,'pF':pf[j],'observed_k':K[j],'ksat':r['ksat'],'predicted_log10':z[j],'signed_log_error':err[j],'predictions_all_methods':{q:r['predicted_log10'][q][j] for q in methods}}
     samples.append({'id':r['id'],'site':site,'rmse':per,'measured_k':K})
    def quantile(x,q):
     x=sorted(x);t=q*(len(x)-1);j=math.floor(t);return x[j]+(t-j)*(x[min(j+1,len(x)-1)]-x[j])
    means={};q90={};sites={}
    for s in scopes:
     means[s]={};q90[s]={};sites[s]={}
     for m in methods:
      sites[s][m]={k:statistics.mean(v) for k,v in tables[s][m].items()}
      v=list(sites[s][m].values());means[s][m]=statistics.mean(v);q90[s][m]=quantile(v,.9)
    cand='weighted_capillary';comps=[k for k in methods if k!=cand];best=min(comps,key=means['all'].get);site_count=len(sites['all'][cand]);wins=sum(v<sites['all'][best][k] for k,v in sites['all'][cand].items())
    g={'all_mean_0.95':means['all'][cand]<=.95*means['all'][best],'site_wins_60pct':wins>=.6*site_count,'q90_1.05':q90['all'][cand]<=1.05*min(q90['all'][m] for m in comps)}
    for s in scopes[1:]:g[s+'_1.10']=len(sites[s][cand])>=20 and means[s][cand]<=1.10*min(means[s][m] for m in comps)

    return {'rows':sum(map(len,target.values())),'cores':len(records),'supported':{s:len(sites[s][cand]) for s in scopes},'means':means,'q90':q90,'gates':g,'best':best,'wins':wins,'worst':worst,'per_core':samples,'site_means':sites}
