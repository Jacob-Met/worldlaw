"""Unscored ideal-input forecasts at the three published trap separations."""
from decimal import Decimal as D,localcontext
from fractions import Fraction as F
import json
LAGS_MS=(0.25,0.5,1,2,4,8,16,32)
def ident():return [[D(int(i==j)) for j in range(4)] for i in range(4)]
def mm(A,B):return [[sum(x*y for x,y in zip(row,col)) for col in zip(*B)] for row in A]
def expm(A):
    n=0
    while max(sum(map(abs,r)) for r in A)>D('.1'):
        A=[[x/2 for x in r] for r in A];n+=1
    result=ident();term=ident()
    for k in range(1,42):
        term=[[x/k for x in r] for r in mm(term,A)]
        result=[[x+y for x,y in zip(r,t)] for r,t in zip(result,term)]
    for _ in range(n):result=mm(result,result)
    return result
def unit_curve(a,rate,duration):
    # x is the active coordinate for telegraph +/-1 and zero thermal drive.
    m11=a/(a+2*rate);m20=m11;m31=3*a*m20/(3*a+2*rate);m40=m31
    L=[[-a,0,0,2*a],[a,-2*rate,0,0],[0,0,-3*a,0],[0,0,3*a,-2*a-2*rate]]
    P=expm([[D(x)*duration for x in row] for row in L])
    return sum(v*P[i][0] for i,v in enumerate([m40,m31,0,0]))-sum(v*P[i][2] for i,v in enumerate([m20,m11,m40,m31]))
def run():
    with localcontext() as ctx:
        ctx.prec=55
        a=D(2240);rate=D(10);curve=[unit_curve(a,rate,D(str(t))/1000) for t in LAGS_MS]
        out={str(sep):[float((D(sep)/2)**4*v) for v in curve] for sep in (18,70,280)}
        assert all(v<0 for v in curve) and all(abs(a-256*b)<1e-7 for a,b in zip(out['280'],out['70']))
        assert abs(unit_curve(D(2),D(1),D(1))+D('.05353932741247955'))<D('1e-13')
        return {'lag_ms':list(LAGS_MS),'conditional_population_nm4':out,'empirical_data_accessed':False,'scored':False}
if __name__=='__main__':print(json.dumps(run(),indent=2))
