"""Receive all pre-value forecasts against independent archived specimen spectra."""
import base64, hashlib, json, math, struct, sys, zlib
from pathlib import Path
from acquisition import BASE,P,acquire,source_values,values,sha
from compact_forecast import packed,profile

def score():
    lock_bytes=zlib.decompress(base64.b85decode((BASE/'forecast-lock.b85.txt').read_text().strip()))
    lock=json.loads(lock_bytes)
    pin=json.loads((BASE/'forecast-lock.json').read_bytes())
    assert sha(lock_bytes)==pin['sha256'] and lock['protocol_sha256']==sha((BASE/'protocol.json').read_bytes())
    get,fn=acquire();basis=lock['basis']
    assert basis==P['phase_order']+['cpd-1'+c for c in P['dev']]
    rows=[]
    for n in basis:
        b=get(n);assert sha(b)==lock['sources'][n];rows.append(source_values(n,b,fn))
    roles=['projective','pure_mass','pure_mac','pure_norm','unit_ols','raw_ols','nearest','peak_fit']
    assert roles==lock['roles'] and list(P['held'])==sorted(lock['coefficients'])==sorted(lock['sha256'])
    matrix=hashlib.sha256();fore={}
    for c in P['held']:
        assert set(lock['coefficients'][c])==set(lock['sha256'][c])==set(roles)
        fore[c]={}
        for r in roles:
            co=lock['coefficients'][c][r]
            assert len(co)==len(basis) and all(map(math.isfinite,co))
            pred=profile(rows,co);buf=packed(pred);assert sha(buf)==lock['sha256'][c][r]
            matrix.update(buf);fore[c][r]=pred
    assert matrix.hexdigest()==lock['matrix_sha256']==pin['matrix_sha256'] and lock['matrix_bytes']==3*8*7251*8
    print('PREVALUE_MATRIX_VERIFIED',matrix.hexdigest(),lock['matrix_bytes'],flush=True)
    targets={};records={};stats={};worst=None
    rms=lambda arr:math.sqrt(math.fsum(x*x for x in arr)/len(arr))
    for c in P['held']:
        b=get('cpd-1'+c);raw=values(b);v=profile([raw],[1]);targets[c]=v
        stats[c]={'source_sha256':sha(b),'normalized_sha256':sha(packed(v)),'mean':math.fsum(raw)/len(raw),'raw_min':min(raw),'raw_max':max(raw)}
        records[c]={}
        for r,pred in fore[c].items():
            e=[a-z for a,z in zip(pred,v)];i=max(range(len(e)),key=lambda j:abs(e[j]))
            records[c][r]={'rms':rms(e),'max_abs':abs(e[i]),'index':i,'signed':e[i],'residual_sha256':sha(packed(e))}
            if r=='projective' and (worst is None or abs(e[i])>worst['absolute_error']):
                worst={'specimen':c,'index':i,'angle':5+.02*i,'absolute_error':abs(e[i]),'raw_counts':raw[i],'observed':v[i],'all_predictions':{s:z[i] for s,z in fore[c].items()},'neighborhood':[[j,5+j*.02,raw[j],v[j],pred[j]] for j in range(max(0,i-3),min(len(e),i+4))]}
    means={r:math.fsum(records[c][r]['rms'] for c in P['held'])/3 for r in roles}
    wins={r:sum(records[c]['projective']['rms']<records[c][r]['rms'] for c in P['held']) for r in roles[1:]}
    shape=lambda a,b:rms([x-y for x,y in zip(a,b)])
    diff={r:shape(fore['g'][r],fore['h'][r]) for r in roles}
    gate=all(means['projective']<means[r] for r in roles[1:]) and all(wins[r]>=2 for r in ['peak_fit','pure_mac'])
    return {'gate':gate,'means':means,'wins':wins,'held':records,'targets':stats,'gh_measured':shape(targets['g'],targets['h']),'gh_predicted':diff,'worst_projective':worst,'matrix_sha256':matrix.hexdigest()}
if __name__=='__main__':
    result=score();b=json.dumps(result,sort_keys=True,separators=(',',':'),allow_nan=False)
    print('FULL_SCORE',b,flush=True)
