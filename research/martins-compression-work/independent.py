"""Recount the original shape screen using inert pickle tokens and a distinct-block assignment DP."""
import hashlib,io,json,math,pickletools,struct,sys,zipfile
from pathlib import Path
from statistics import fmean
from scipy.stats import t as student
from fractions import Fraction
SOURCE='65b4ab2c8e4883d6e23cef127727967c85036427864ec0b7474176b5a5fa5b8b'
def blocks_from_archive(path):
    assert hashlib.sha256(path.read_bytes()).hexdigest()==SOURCE
    with zipfile.ZipFile(path) as z:
        f=io.BytesIO(z.read('results.npy'));assert f.read(6)==b'\x93NUMPY'
        v=f.read(2);headlen=int.from_bytes(f.read(2 if v[0]==1 else 4),'little');f.read(headlen)
        blobs=[x for op,x,_ in pickletools.genops(f.read()) if isinstance(x,bytes) and len(x)==80000]
    assert len(blobs)==36
    return {hashlib.sha256(b).hexdigest():[a[0]/(1.38e-23*300) for a in struct.iter_unpack('<d',b)] for b in blobs}
def times(a,b):
    out={}
    for l,x in a.items():
        for r,y in b.items():
            c=tuple(sorted(l+r));out[c]=out.get(c,0)+x*y
    return out
def add(a,b,scale=1):
    c=a.copy()
    for k,v in b.items():c[k]=c.get(k,0)+scale*v
    return {k:v for k,v in c.items() if v}
def polynomials():
    # Construct both cumulant polynomials from the cumulant/moment recursion.
    moment=[{():1}]+[{(j,):1} for j in range(1,5)]
    K=[{}]
    for n in range(1,5):
        k=moment[n].copy()
        for j in range(1,n):
            k=add(k,times(K[j],moment[n-j]),-math.comb(n-1,j-1))
        K.append(k)
    return [add(times(K[2],K[4]),times(K[3],K[3]),Fraction(-3,2)),add({k:12*v for k,v in times(K[2],K[2]).items()},K[4],-1)]
POLY=polynomials()
def moment_rows(w,K):
    size=len(w)//K
    return [[fmean(x**j for x in w[i:i+size]) for j in range(1,5)] for i in range(0,len(w),size)]
def distinct(B,orders):
    # Each factor bit can be filled only once; each block can fill at most one factor.
    n=len(orders);dp=[0.]*(1<<n);dp[0]=1.
    for row in B:
        for mask in range((1<<n)-1,0,-1):
            so=0.
            for j,power in enumerate(orders):
                if mask&(1<<j):so+=dp[mask^(1<<j)]*row[power-1]
            dp[mask]+=so
    return dp[-1]/math.prod(range(len(B)-n+1,len(B)+1))
def main(source,archive):
    W=blocks_from_archive(source)
    with zipfile.ZipFile(archive) as z:r=json.loads(z.read('comparison-complete.json'))
    assert len(W)==36 and len(r['rows'])==36
    numeric=0;md=0.;groupings=0;flags=[]
    for row in r['rows']:
        m=row['meta'];w=W.pop(m['work_bytes_sha256']);assert len(w)==10000
        mean=fmean(w);d=[x-mean for x in w];v=fmean(x*x for x in d);k3=fmean(x**3 for x in d);k4=fmean(x**4 for x in d)-3*v*v
        pooled=[k4/v**2-1.5*k3*k3/v**3,12-k4/v**2]
        assert max(abs(a-row['pooled'][k]) for a,k in zip(pooled,['lower','upper']))<2e-9
        extreme=max(range(len(w)),key=lambda j:abs(w[j]-mean))
        assert extreme==row['furthest']['index'] and w[max(extreme-2,0):min(extreme+3,len(w))]==row['furthest']['previous_and_next']
        for K in [5,10,20]:
            B=moment_rows(w,K);q=row['grouping'][str(K)];groupings+=1
            def eval_b(C):return [math.fsum(float(c)*distinct(C,fs) for fs,c in p.items())/sc for p,sc in zip(POLY,(v**3,v**2))]
            est=eval_b(B);leave=[eval_b(B[:i]+B[i+1:]) for i in range(K)]
            for j in (0,1):
                jk=[a[j] for a in leave];bar=fmean(jk);se=math.sqrt((K-1)/K*sum((x-bar)**2 for x in jk));hi=est[j]+student.ppf(1-.05/72,K-1)*se
                pairs=[(est[j],q['margin'][j]),(se,q['standard_error'][j]),(hi,q['upper_bound'][j]),*zip(jk,[a[j] for a in q['delete_one_margin']])]
                numeric+=len(pairs);md=max(md,max(abs(a-b) for a,b in pairs))
                assert (hi<0)==q['flags'][j]
                if K==10 and hi<0:flags.append([m['protocol'],m['amplitude'],m['duration'],['lower','upper'][j]])
    assert not W and flags==r['primary_conditional_screen_flags'] and md<2e-7
    result=dict(conditions=36,works=360000,groupings=groupings,primary_multiplicity=72,all_group_flags=216,numeric_checks=numeric,maximum_absolute_difference=md,primary_flags=flags,source_sha256=SOURCE,score_zip_sha256=hashlib.sha256(archive.read_bytes()).hexdigest())
    Path('independent.json').write_text(json.dumps(result,sort_keys=True));print('INDEPENDENT',json.dumps(result,sort_keys=True))
if __name__=='__main__':main(*map(Path,sys.argv[1:]))
