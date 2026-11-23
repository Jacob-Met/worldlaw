"""Score bound high-rate relative permeability pairs as one pressure-derived scalar per setting."""
import hashlib,json,math,pathlib,statistics,sys
import xml.etree.ElementTree as E
XML='edd1a164af3632201c114d4b5845599ef2783da1d19a4f07223fb6c656e2513f'
LOCK='87a7573f28a92492e98123ce96659caa96a3103f5da05b691578fd391fd856d0'
ROLES=('occupancy-midpoint','same-flow-fraction','mean-saturation','endpoint-switch','connected-stable','connected-permissive','cyclic-support','full-support-midpoint')
STAGES=[0,.15,.3,.5,.7,.85,1]
def resistance(o,w):
    return 1/(.830*(o/.838+w/.822))
def half(s):
    return .5*10**(-len(s.partition('.')[2]))
def run(xml,forecast):
    if hashlib.sha256(forecast).hexdigest()!=LOCK or hashlib.sha256(xml).hexdigest()!=XML:
        raise ValueError('source or forecast identity')
    predictions=json.loads(forecast)['predictions']
    root=E.fromstring(xml)
    text=lambda el:' '.join(''.join(el.itertext()).split())
    t=[tb for tb in root.findall('.//table-wrap') if text(tb.find('label'))=='Table 2']
    assert len(t)==1
    raw=[[text(c) for c in tr] for tr in t[0].findall('.//tbody/tr')]
    assert len(raw)==7 and all(len(row)==7 for row in raw)
    assert [float(row[0]) for row in raw]==[p['fw'] for p in predictions]==STAGES
    rows=[];scale=(.5e-6/60)*.000830*.060/(math.pi*.00499**2/4*2.045e-12)/1000
    for r,p in zip(raw,predictions):
        f,sw,ko,kw=map(float,[r[0],*r[4:]])
        assert sw==p['high_Sw'] and set(p['values'])==set(ROLES)
        target=resistance(ko,kw)
        do=0 if f==1 else half(r[5]);dw=0 if f==0 else half(r[6])
        bracket=[resistance(ko+do,kw+dw),resistance(max(0,ko-do),max(0,kw-dw))]
        errs={k:v-target if isinstance(v,(float,int)) else v for k,v in p['values'].items()}
        lo,hi=p['R_interval']
        rows.append(dict(fw=f,target_printed=[r[0],*r[4:]],target=target,printing_interval=bracket,
                 kPa=target*scale,kPa_printing_interval=[x*scale for x in bracket],
                 phase_specific_oil=None if f==1 else (1-f)*.838/(.830*ko),
                 phase_specific_water=None if f==0 else f*.822/(.830*kw),signed_errors=errs,
                 R_interval=[lo,hi],width=hi-lo,full_width=p['full_support_interval'][1]-p['full_support_interval'][0],
                 inside=lo<=target<=hi,printing_interval_overlaps=lo<=bracket[1] and hi>=bracket[0],
                 printing_interval_covered=lo<=bracket[0] and hi>=bracket[1]))
    mixed=rows[1:-1];metrics={}
    for role in ROLES:
        losses=[(abs(r['signed_errors'][role]),r['fw']) for r in mixed if isinstance(r['signed_errors'][role],(int,float))]
        if len(losses)!=5:
            metrics[role]={'refusal':'incomplete five-row comparison','finite':len(losses)}
            continue
        worst=max(losses,key=lambda z:z[0]);metrics[role]={'mae':statistics.mean(x for x,f in losses),'maxae':worst[0],'worst_fw':worst[1]}
    cand=metrics[ROLES[0]]
    strict={k:'mae' in v and cand['mae']<v['mae'] and cand['maxae']<v['maxae'] for k,v in metrics.items() if k!=ROLES[0]}
    covered=sum(r['inside'] for r in mixed);width=statistics.mean(r['width'] for r in mixed);full=statistics.mean(r['full_width'] for r in mixed)
    return dict(forecast_sha256=LOCK,xml_sha256=XML,kPa_per_unit=scale,rows=rows,metrics=metrics,strict_comparisons=strict,
                covered=covered,mean_width=width,mean_full_width=full,pass_primary=all(strict.values()) and covered>=4 and width<full)
if __name__=='__main__':
    xml,lock,output=map(pathlib.Path,sys.argv[1:])
    f=lock.read_bytes();assert hashlib.sha256(f).hexdigest()==LOCK
    s=run(xml.read_bytes(),f)
    output.write_text(json.dumps(s,indent=2,sort_keys=True,allow_nan=False)+'\n')
