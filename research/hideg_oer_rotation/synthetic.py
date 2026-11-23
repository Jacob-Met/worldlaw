"""Synthetic forward, ohmic and independent flux/kinetic closure checks."""
import numpy as np
from model import intrinsic,forward,F,RT,KW,XI

def run():
    import math
    tests=0; err=0.; ohmic=0.
    for a in [.3,1.1,1.8]:
        for speed in [400.,1225.,2500.]:
            p=[4.18,-10.,a,11.,2e-6]
            es=np.linspace(.25,1.12,37)
            j=forward(es,speed,p)
            ec=es-p[3]*j
            ohmic=max(ohmic,max(abs(intrinsic(ec,speed,p)-j)))
            d=p[0]*1e-7
            delta=(.8917e-4)**(1/6)*d**(1/3)*math.gamma(1/3)/(3**(2/3)*.51023**(1/3)*math.sqrt(speed*math.pi/30))
            x=XI+(j-p[4])*delta/(.01*F*d)
            # Stable inverse of H - OH = x, H*OH = Kw.
            rt=np.sqrt(x*x+4*KW)
            oh=np.where(x>=0,2*KW/(rt+x),(rt-x)/2)
            h=KW/oh
            reduced=F*(ec+.197-1.229)/RT-.5*math.log(KW)
            jr=.02*F*10**(p[1]+1)*(np.exp(a*reduced)*oh-np.exp((a-2)*reduced)*h)+p[4]
            err=max(err,max(abs(jr-j)));tests+=len(j)
    print(dict(points=tests,max_current_density_error=err,max_ohmic_error=ohmic))
    assert err<2e-8 and ohmic<2e-10

if __name__=='__main__': run()
