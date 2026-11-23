"""Freeze sound-speed forecasts without loading any measured historical speeds."""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TERMS = [(i, 0) for i in range(4)] + [(i, 1) for i in range(3)] + [(i, 2) for i in range(2)]
REDUCED = [(i, 0) for i in range(4)] + [(i, 1) for i in range(2)]
ROLES = (
    "gibbs", "gibbs-static-cp", "gibbs-isothermal", "gibbs-reduced",
    "author-density-measured-cp", "author-density-printed-cp", "author-direct-sound",
)

def fitted_coefficients(design, outcomes):
    n = len(design[0])
    matrix = [[sum(r[i] * r[j] for r in design) for j in range(n)]
              + [sum(r[i] * y for r, y in zip(design, outcomes))] for i in range(n)]
    for i in range(n):
        k = max(range(i, n), key=lambda j: abs(matrix[j][i]))
        matrix[i], matrix[k] = matrix[k], matrix[i]
        d = matrix[i][i]
        if abs(d) <= 1e-10:
            raise ValueError("singular source fit")
        matrix[i] = [v/d for v in matrix[i]]
        for j in range(n):
            if j != i:
                scale = matrix[j][i]
                matrix[j] = [v - scale*w for v, w in zip(matrix[j], matrix[i])]
    return [r[-1] for r in matrix]

def polynomial(coeff, value):
    return sum(a * value**i for i, a in enumerate(coeff))

def published_constants(raw):
    def coef(name, i, column):
        return raw[name + "_{" + str(i) + "}"][column]
    ambient = [[coef("a",i,column) for i in range(4)] for column in range(3)]
    pressure = [([coef("b",i,column) for i in range(4)], [coef("c",i,column) for i in range(2)],raw["E"][column])
                for column in (3,4)]
    return ambient, pressure

def acoustic(t, v, v_p, v_t, cp):
    if v <= 0 or v_p >= 0 or cp <= 0:
        raise ValueError("unstable volumetric or calorimetric state")
    adiabatic_derivative = v_p + v_t*v_t*t/cp
    if adiabatic_derivative >= 0:
        raise ValueError("nonpositive adiabatic stiffness")
    return math.sqrt(-v*v/adiabatic_derivative)

def polynomial_state(t,p,terms,coeff,cp0):
    x, z = (t-340)/40, (p-.1)/20
    v = 1e-6 * sum(a*x**i*z**j for (i,j),a in zip(terms,coeff))
    vt = 1e-6/40 * sum(a*i*x**(i-1)*z**j for (i,j),a in zip(terms,coeff) if i)
    vp = 1e-12/20 * sum(a*j*x**i*z**(j-1) for (i,j),a in zip(terms,coeff) if j)
    cp = cp0 - t*20/40**2 * sum(a*i*(i-1)*x**(i-2)*z**(j+1)/(j+1)
                                 for (i,j),a in zip(terms,coeff) if i >= 2)
    return v,vp,vt,cp

def author_state(t,p,ambient,pressure):
    b = polynomial(pressure[0], t/pressure[2])
    c = polynomial(pressure[1], t/pressure[2])
    y0 = polynomial(ambient,t)
    log_ratio = math.log1p((p-.1)/(b+.1))
    return y0, b, c, log_ratio

def integrated_author_volume(t,p,ambient,pressure):
    y0,b,c,ln = author_state(t,p,ambient,pressure)
    dp = p-.1
    return 1e6*(dp-c*((b+p)*ln-dp))/y0

def tait_acoustics(t,p,ambient,pressure,cp0,step):
    def volume(temperature):
        y0,_,c,ln = author_state(temperature,p,ambient,pressure)
        return (1-c*ln)/y0
    def integral(temperature):
        return integrated_author_volume(temperature,p,ambient,pressure)
    y0,b,c,_ = author_state(t,p,ambient,pressure)
    vt = (volume(t+step)-volume(t-step))/(2*step)
    vp = -c/(y0*(b+p))*1e-6
    cp = cp0-t*(integral(t+step)-2*integral(t)+integral(t-step))/(step*step)
    return acoustic(t,volume(t),vp,vt,cp)

def build(cal,states,raw):
    cp_coeff=fitted_coefficients([[((t-340)/40)**i for i in range(4)] for t,c in cal["cp"]],[1000*c for t,c in cal["cp"]])
    def volume_fit(terms):
        return fitted_coefficients([[((t-340)/40)**i*((p-.1)/20)**j for i,j in terms] for t,p,r in cal["rho"]],[1e6/r for t,p,r in cal["rho"]])
    full=volume_fit(TERMS)
    reduced=volume_fit(REDUCED)
    ambient,pressure=published_constants(raw)
    result=[]
    for number,(t,p) in enumerate(states):
        cp0=polynomial(cp_coeff,(t-340)/40)
        v,vp,vt,cp=polynomial_state(t,p,TERMS,full,cp0)
        rv,rvp,rvt,rcp=polynomial_state(t,p,REDUCED,reduced,cp0)
        sound0,_,sound_c,sound_ln=author_state(t,p,ambient[0],pressure[0])
        values={}
        for role,func in zip(ROLES,(
            lambda:acoustic(t,v,vp,vt,cp),lambda:acoustic(t,v,vp,vt,cp0),
            lambda:acoustic(t,v,vp,0,cp0),lambda:acoustic(t,rv,rvp,rvt,rcp),
            lambda:tait_acoustics(t,p,ambient[1],pressure[1],cp0,.02),
            lambda:tait_acoustics(t,p,ambient[1],pressure[1],polynomial(ambient[2],t),.02),
            lambda:sound0/(1-sound_c*sound_ln))):
            try:
                value=func()
                if not math.isfinite(value) or value<=0: raise ValueError("nonpositive sound speed")
                values[role]=value
            except (ArithmeticError, ValueError) as e:
                values[role]={"refusal":str(e)}
        convergence=abs(values["author-density-measured-cp"]-tait_acoustics(t,p,ambient[1],pressure[1],cp0,.04))
        if convergence > .01:
            raise ValueError("literal density derivative step difference exceeds .01 m/s")
        result.append({"index":number,"T_K":t,"p_MPa":p,"primary":340<=t<=373.15 and .1<=p<=20,
                       "thermal_support":298.18<=t<=373.15 and .1<=p<=20,"sound_m_s":values,"tait_step_difference_m_s":convergence})
    return result

def input_json(name):
    return json.loads((ROOT/name).read_text())

if __name__=="__main__":
    output=build(input_json("calibration-tables.json"),input_json("held-state-inputs.json"),input_json("published-experimental-coefficients.json"))
    encoded=(json.dumps(output,sort_keys=True,indent=2,allow_nan=False)+"\n").encode()
    (ROOT/"forecast-lock.json").write_bytes(encoded)
    print(json.dumps({"rows":len(output),"primary":sum(r["primary"] for r in output),"roles":len(ROLES),"bytes":len(encoded),"sha256":hashlib.sha256(encoded).hexdigest()}))
