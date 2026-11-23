"""Recount scores using only pinned repository bytes, locked coefficients and Python Decimal."""
import base64, decimal, hashlib, json, math, os, struct, subprocess, tempfile, zlib
from pathlib import Path
from decimal import Decimal as D
BASE=Path(__file__).resolve().parent
def digest(b):return hashlib.sha256(b).hexdigest()
def main():
    meta=json.loads((BASE/'protocol.json').read_bytes());s=meta['source']
    data=zlib.decompress(base64.b85decode((BASE/'forecast-lock.b85.txt').read_bytes().strip()))
    pin=json.loads((BASE/'forecast-lock.json').read_bytes());assert digest(data)==pin['sha256']
    L=json.loads(data);assert L['protocol_sha256']==digest((BASE/'protocol.json').read_bytes())
    observed=json.loads((BASE/'score.json').read_bytes());path=tempfile.mkdtemp(dir=os.environ.get('TMPDIR'))
    def git(*a):return subprocess.check_output(['git',*a],cwd=path)
    git('init','-q');git('fetch','-q','--depth=1','--filter=blob:none','https://github.com/'+s['repo']+'.git',s['sha'])
    def counts(n):
        b=git('show',s['sha']+':tests/data/qarr/'+n+'.prn')
        assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==s['files'][n]
        if n in L['sources']:assert digest(b)==L['sources'][n]
        rr=[row.split() for row in b.splitlines() if row.strip()];assert len(rr)==7251 and all(len(row)==2 for row in rr)
        assert all(round((float(row[0])-5)/.02)==j for j,row in enumerate(rr))
        x=[int(float(row[1])) for row in rr];assert all(v==float(r[1]) for v,r in zip(x,rr))
        if n in ('corundum','cpd-1e'):
            rd=git('show',s['sha']+':tests/data/qarr/'+n+'.rd');m=struct.unpack_from('<7251H',rd,250)
            assert x==[(v*v+(50 if n=='cpd-1e' else 0))//100 for v in m];x=[v*v//100 for v in m]
        return x
    def normalize(xx):
        n=D(len(xx));mu=sum(xx)/n;zz=[v-mu for v in xx];var=sum(z*z for z in zz)/n
        sd=var.sqrt();return [z/sd for z in zz]
    decimal.getcontext().prec=55
    dev=[counts(n) for n in L['basis']];roles=L['roles'];ids=list(meta['held']);by={};meas={};worst={};allpred={};devcols=list(zip(*dev))
    for c in ids:
        allpred[c]={}
        for r in roles:
            coef=list(map(D.from_float,L['coefficients'][c][r]))
            u=[sum(v*x for v,x in zip(coef,col)) for col in devcols]
            allpred[c][r]=normalize(u)
    for c in ids:
        xx=counts('cpd-1'+c);meas[c]=normalize(list(map(D,xx)));by[c]={}
        for r in roles:
            d=[a-b for a,b in zip(allpred[c][r],meas[c])];i=max(range(len(d)),key=lambda j:abs(d[j]))
            v=(sum(k*k for k in d)/D(len(d))).sqrt();row=observed['held'][c][r]
            assert i==row['index'] and abs(float(abs(d[i]))-row['max_abs'])<2e-12
            assert abs(float(v)-row['rms'])<2e-12;by[c][r]=v
        i=observed['held'][c]['projective']['index'];worst[c]=[i,xx[i],float(meas[c][i]),float(allpred[c]['projective'][i])]
    means={r:sum(by[c][r] for c in ids)/len(ids) for r in roles}
    wins={r:sum(by[c]['projective']<by[c][r] for c in ids) for r in roles[1:]}
    assert wins==observed['wins'] and all(abs(float(v)-observed['means'][r])<2e-12 for r,v in means.items())
    gate=all(means['projective']<means[r] for r in roles[1:]) and min(wins['peak_fit'],wins['pure_mac'])>=2
    assert gate==observed['gate']
    rel=lambda u,v:(sum((x-y)**2 for x,y in zip(u,v))/D(len(u))).sqrt()
    assert abs(float(rel(meas['g'],meas['h']))-observed['gh_measured'])<2e-12
    for r in roles:assert abs(float(rel(allpred['g'][r],allpred['h'][r]))-observed['gh_predicted'][r])<2e-12
    sw=observed['worst_projective'];c=sw['specimen'];i=sw['index'];assert abs(float(meas[c][i])-sw['observed'])<2e-12
    for r in roles:assert abs(float(allpred[c][r][i])-sw['all_predictions'][r])<2e-12
    err=max(abs(float(by[c][r])-observed['held'][c][r]['rms']) for c in ids for r in roles)
    print('INDEPENDENT',json.dumps({'precision':55,'specimens':ids,'roles':8,'differences':174024,'rms_checks':24,'worst_indices_checked':24,'aggregate_and_same_row_checks':True,'max_rms_delta':err,'gate':gate,'means':{k:float(v) for k,v in means.items()},'wins':wins,'raw_worst_by_specimen':worst,'score_sha256':digest((BASE/'score.json').read_bytes())},sort_keys=True))
if __name__=='__main__':main()
