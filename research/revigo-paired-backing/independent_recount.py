import base64, decimal, hashlib, json, statistics
from collections import defaultdict
from decimal import Decimal as D,localcontext
def check(raw,forecast,geometry):
    train_or_dev = set(['01C','04C','09C','11C'])
    sealed={'02C','03C','05C','06C','10C','12C','13C','14C'}
    curves=defaultdict(dict)
    for line in raw.splitlines()[1:]:
        named,rest=line.split(b'\t',1);key,kind=named.decode().rsplit('_',1)
        if key in sealed: continue
        curves[key][kind]=[D(v.decode())/100 for v in rest.split(b'\t')]
    assert len(curves)==76 and len(forecast['rows'])==4
    audits={}; largest=D(0);difference=D(0);out_rows={}
    for group,ids in [('calibration',set(curves)-train_or_dev),('development',train_or_dev)]:
        levels=[];order=[];under=[]
        for name in sorted(ids):
            c=curves[name]
            for i in range(31):
                assert c['w'][i]>c['b'][i]
                reverse=c['ob'][i]-c['ow'][i]
                if reverse>0:order.append((reverse,name,400+10*i,str(c['ob'][i]),str(c['ow'][i])))
                for ch in ('ob','ow'):
                    lev=c[ch][i];levels.append((lev,name,ch,400+10*i))
                    if lev<D('.04'):under.append((D('.04')-lev,name,ch,400+10*i))
        audits[group]={'total_coated_readings':len(levels),'below_floor':len(under),'minimum':list(min(levels)),'largest_floor_shortfall':list(max(under)) if under else None,'reversed_paired_order':len(order),'total_paired':len(levels)//2,'largest_reversal':list(max(order)) if order else None,'min_independent_max_error_bound_both':max([v[0] for v in order],default=D(0))/2,'min_conditional_error_if_ob_matches':max([v[0] for v in order],default=D(0)),'necessary_alpha_upper_if_gain_unchanged':min(levels)[0]/D('.04')}
    count=0
    for sample in sorted(train_or_dev):
        y=curves[sample]['ow']; manifest=forecast['rows'][sample]
        assert all(abs(float(j)-k)<1e-14 for j,k in zip(y,manifest['truth']))
        arms={}
        for arm,vector in manifest['registered_predictions'].items():
            es=[D(str(a))-b for a,b in zip(vector,y)]; count+=len(es)
            rmse=(sum(e**2 for e in es)/len(es)).sqrt()
            ref=manifest['scores'][arm]
            difference=max(difference,abs(rmse-D(str(ref['rmse']))))
            worst=max(range(31),key=lambda i:abs(es[i]))
            assert int(ref['worst'][0])==(400+10*worst)
            arms[arm]={'rmse':rmse,'worst_index':worst,'signed_worst':es[worst]}
            j=[cr for cr in geometry[sample]['records'] if cr['nm']==400+10*worst][0]
            assert abs(es[worst]-D(str(j['predictions'][arm]))+y[worst])<D('1e-13')
        out_rows[sample]=arms
    aggs={}
    for arm in forecast['per_arm']:
        a=[out_rows[k][arm]['rmse'] for k in train_or_dev]
        aggs[arm]={'mean':sum(a)/4,'worst':max(a)}
        for k,ref in [('mean','mean_equal_film'),('worst','worst_film')]:
            difference=max(difference,abs(aggs[arm][k]-D(str(forecast['per_arm'][arm][ref]))))
    print(json.dumps({'measured_audit':audits,'recounted_scalar_residuals':count,'rows':out_rows,'all_comparators':aggs,'maximum_recount_metric_difference':difference,'held_recipes_opened':0},default=str,sort_keys=True))
