"""Verify 256 supersolutions with outward-rounded interval arithmetic.

The floating-point inverse and positive vector are only proposed witnesses.
All inequality signs determining the result are verified again using intervals.
"""
from fractions import Fraction as F
import numpy as np
from mpmath import iv


def num(v):
    q = F(v)
    return iv.mpf(q.numerator) / q.denominator


def bracket(frequency, depth):
    omega = 2*iv.pi*num(frequency)
    lo,hi = F(0),F(1)
    for _ in range(120):
        mid = (lo+hi)/2
        k = num(mid)
        z = iv.exp(-2*k*num(depth))
        value = num(F("9.81"))*k*(1-z)/(1+z) - omega**2
        if value.b < 0:
            lo = mid
        elif value.a > 0:
            hi = mid
        else:
            raise ArithmeticError("Dispersion bisection sign unresolved")
    return lo,hi


def boxes():
    dl,dh = F("249.975"),F("250.025")
    dt = F(".005")
    ts,tl = F("10.54"),F("11.85")
    def grid(t):
        lo = F(".985")*bracket(1/(t+dt),dh)[0]
        hi = F("1.015")*bracket(1/(t-dt),dl)[1]
        return [lo+(hi-lo)*i/16 for i in range(17)]
    return grid(ts),grid(tl),[bracket(1/(ts+dt)-1/(tl-dt),dh)[0],
                              bracket(1/(ts-dt)-1/(tl+dt),dl)[1]]


def certify(pixels, top=10, bottom=427):
    iv.dps=55
    x=[(F(z)-F("8.839"))*50 for z in ["3.88","6.35","8.89","11.35","13.81"]]
    dx=F(".0065")*50
    def height(pixel):
        return num(F(".03")-F(".06")*F(pixel-top,bottom-top))
    y=[iv.mpc(height(a),height(b)) for a,b in pixels]
    rho=num(F(".0015")*F(".0295"))
    ell=num(F(".0015")/F(".0285"))
    eps=num(F(".0024"))
    keep=[0,2,3,4,5]
    short,long,free=boxes()
    cells=[]
    for i in range(16):
        for j in range(16):
            pairs=[(short[i]-long[j+1],short[i+1]-long[j]),free,
                   (short[i]+long[j],short[i+1]+long[j+1])]
            ab=[v for a,b in pairs for v in ((a,b),(-b,-a))]
            k=[(a+b)/2 for a,b in ab]
            dk=[(b-a)/2 for a,b in ab]
            approximation=np.exp(-1j*np.outer(list(map(float,x)),list(map(float,k))))
            # Any matrix R is legal. The verified inequalities include I-R*A0.
            R=[[iv.mpc(num(float(t.real)),num(float(t.imag))) for t in row]
               for row in np.linalg.inv(approximation[:,keep])]
            A=[[iv.exp(iv.mpc(0,-num(s*t))) for t in k] for s in x]
            delta=[[num(min(F(2),abs(s)*d+dx*(abs(t)+d))) for t,d in zip(k,dk)] for s in x]
            b=[abs(sum(R[r][s]*y[s] for s in range(5))) for r in range(5)]
            ge=[sum(map(abs,row))*eps for row in R]
            M=[]
            for r in range(5):
                row=[]
                for c,m in enumerate(keep):
                    e=sum(abs(R[r][s])*delta[s][m] for s in range(5))
                    e+=abs(int(r==c)-sum(R[r][s]*A[s][m] for s in range(5)))
                    if c==0:
                        e+=rho*(abs(sum(R[r][s]*A[s][1] for s in range(5)))+
                                sum(abs(R[r][s])*delta[s][1] for s in range(5)))
                    row.append(e)
                M.append(row)
            mat=np.array([[float(a.b) for a in row] for row in M])
            rhs=np.array([float((v+g).b) for v,g in zip(b,ge)])
            proposal=np.linalg.solve(np.eye(5)-mat,rhs)*1.000001
            if not np.all(np.isfinite(proposal)) or min(proposal)<=0:
                raise ArithmeticError("Missing positive supersolution")
            S=[num(float(s)) for s in proposal]
            err=[ge[r]+sum(M[r][s]*S[s] for s in range(5)) for r in range(5)]
            slack=[S[r]-b[r]-err[r] for r in range(5)]
            gap=b[3]-ell*b[4]-err[3]-ell*err[4]
            if not all(a.a>0 for a in slack) or not gap.a>0:
                raise ArithmeticError(f"Unproved inequality in cell {(i,j)}")
            cells.append({"indices":[i,j],"supersolution_hex":[float(a).hex() for a in proposal],
                          "minimum_slack_m":min(float(a.a) for a in slack),
                          "cross_constraint_gap_m":float(gap.a)})
    return {"verified_cells":len(cells),"excluded_uniform_complex_error_m":.0024,
            "interval_decimal_digits":iv.dps,"cells":cells,
            "minimum_cross_constraint_gap_m":min(c["cross_constraint_gap_m"] for c in cells)}
