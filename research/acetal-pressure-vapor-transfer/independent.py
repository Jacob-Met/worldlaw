"""Independently recount measured rows, shared pressures, supporting tangents and the four tests."""
import json, sys, statistics, hashlib
from decimal import Decimal, getcontext
from xml.etree.ElementTree import parse
from pathlib import Path
getcontext().prec=55
D=Decimal
zero=D(0)
one=D(1)

def value(parent,key):
    return parent.find('.//{*}'+key).text

def entropy(x,y):
    if y==zero: return zero if x==zero else D('-Infinity')
    if y==one: return zero if x==one else D('-Infinity')
    return x*y.ln()+(one-x)*(one-y).ln()

def verify(xml,forecast,result):
    read=lambda p:json.loads(Path(p).read_text(),parse_float=D)
    f=read(forecast);o=read(result)
    tree=parse(xml); blocks={int(value(q,'nPureOrMixtureDataNumber')):q for q in tree.findall('{*}PureOrMixtureData')}
    tol=D('2e-14')
    tests=[];evidence=[];offset=0;checks=0
    for ai,bi in ((2,3),(4,5),(8,9)):
        rows=blocks[bi].findall('{*}NumValues');inp=blocks[ai].findall('{*}NumValues')
        g=f[str(ai)];s=o['groups'][str(ai)];n=len(rows)
        assert n==len(inp)==len(g['p'])
        assert value(blocks[bi],'eMethodName')=='Chromatography'
        err={arm:[] for arm in g['pred']};width=[];covered=0
        for i,(q,t) in enumerate(zip(rows,inp)):
            variables=lambda row:{int(value(v,'nVarNumber')):D(value(v,'nVarValue')) for v in row.findall('{*}VariableValue')}
            m=variables(q);assert m==variables(t)
            x=m[1];temp=m[2];y=D(value(q,'nPropValue'));p=D(value(t,'nPropValue'))
            u=D(value(t,'nCombExpandUncertValue'))
            rr=o['rows'][offset+i]
            assert (x,temp,p,u)==(g['x'][i],g['t'][i],g['p'][i],g['u'][i])
            assert (x,temp,p,y,ai,i)==(rr['x'],rr['t'],rr['pressure'],rr['truth'],rr['group'],rr['index'])
            left,right=g['outer']['bounds'][i];assert [left,right]==rr['bounds']
            assert all(rr['pred'][arm]==vals[i] for arm,vals in g['pred'].items())
            checks+=len(err)
            if i in (0,n-1):
                assert x==y and left==right==x
                continue
            for arm,vals in g['pred'].items():err[arm].append(abs(vals[i]-y))
            covered+=left<=y<=right; width.append(right-left)
        offset+=n
        mean={k:sum(v)/D(n-2) for k,v in err.items()};worst={k:max(v) for k,v in err.items()}
        for k in mean:
            assert abs(mean[k]-s['mae'][k])<tol and abs(worst[k]-s['worst'][k])<tol
        assert abs(statistics.median(width)-s['median_width'])<tol and covered==s['covered']
        candidate='outer_midpoint';gates=[D(covered)/D(n-2)>=D('.9'),statistics.median(width)<=D('.05'),all(mean[candidate]<v for k,v in mean.items() if k!=candidate),all(worst[candidate]<v for k,v in worst.items() if k!=candidate)]
        assert gates==s['gates'];tests+=gates
        support=[]
        if g['inner']:
            for witness in g['inner']['witnesses']:
                yy=witness['y'];pp=witness['pressure_kpa'];assert sorted(yy)==yy
                t0=(max(g['t'])+min(g['t']))/2
                margin=D('Infinity')
                for k,x in enumerate(g['x']):
                    p,u=g['p'][k],g['u'][k];delta=D('.06')*abs(g['t'][k]-t0)
                    assert (p-u).ln()-delta-D('1e-13')<=pp[k].ln()<=(p+u).ln()+delta+D('1e-13')
                    own=pp[k].ln()+entropy(x,yy[k])
                    for j in range(n):
                        if k==j:continue
                        slack=own-(pp[j].ln()+entropy(x,yy[j]))
                        margin=min(slack,margin)
                assert margin>=-D('2e-13'),margin
                support.append(str(margin))
        largest=max(range(n-2),key=lambda k:err[candidate][k])
        evidence.append(dict(dataset=ai,interiors=n-2,covered=covered,median_width=str(statistics.median(width)),mean={k:str(v) for k,v in mean.items()},worst_index=1+largest,minimum_all_pairs_log_support_slack=support))
    assert tests==o['gates'] and all(tests)==o['joint'] and offset==66 and len(o['rows'])==offset
    largest=max((r for r in o['rows'] if 0<r['x']<1),key=lambda r:abs(r['truth']-r['pred']['outer_midpoint']))
    assert largest==o['worst_midpoint']
    print(json.dumps(dict(rows=offset,point_components=checks,gates=tests,joint=all(tests),datasets=evidence,worst=largest),default=str,sort_keys=True))
if __name__=='__main__':verify(*sys.argv[1:4])
