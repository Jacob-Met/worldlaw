import base64,hashlib,io,json,os,pathlib,subprocess,sys,time,urllib.request,zipfile
import numpy as np
from scipy.optimize import least_squares
from scipy.signal import hilbert
def checksummed_archive(reg):
    u="https://researchdata.durham.ac.uk/downloads/r2x920fw90c"
    q=urllib.request.Request(u,headers={"User-Agent":"public research data reproducibility reader"})
    with urllib.request.urlopen(q,timeout=180) as f:b=f.read()
    assert len(b)==reg["source"]["n"] and hashlib.sha256(b).hexdigest()==reg["source"]["sha256"]
    return zipfile.ZipFile(io.BytesIO(b))
def name(c,rep):return f"Magneto_optical_rotation_via_HT_data_availability/Data without fit/Faraday/{c}/{c}_{rep}.csv"
def axis(z,rep):
    with z.open(name("filter",rep)) as f:return np.array([float(l.partition(b",")[0]) for l in f if l.strip()],dtype="<f8")
def bin_values(x,y,edges):
    ids=np.searchsorted(edges,x,side="right")-1;ids[x==edges[-1]]=len(edges)-2
    keep=(ids>=0)&(ids<len(edges)-1)
    count=np.bincount(ids[keep],minlength=len(edges)-1);assert (count>0).all()
    return np.bincount(ids[keep],weights=y[keep],minlength=len(edges)-1)/count
def transmission(tl,tr,delta,angle=0):
    return (tl+tr-2*np.sqrt(tl*tr)*np.cos(delta+2*np.deg2rad(angle)))/4
def H(z):return .5*hilbert(z).imag
def main():
    from pathlib import Path
    start=time.monotonic();rep=int(sys.argv[1]);P=Path(".");reg=json.loads((P/"protocol.json").read_text());assert rep in reg["repeats"]
    z=checksummed_archive(reg);X=axis(z,rep);assert len(X)==170000 and np.isfinite(X).all()
    axspec=json.loads((P/"axes.json").read_text())
    def checkax(c,x):assert hashlib.sha256(np.asarray(x,dtype="<f8").tobytes()).hexdigest()==axspec[f"{c}/{c}_{rep}.csv"]["vector_sha"]
    checkax("filter",X);edges=np.linspace(X.min(),X.max(),751);g=(edges[:-1]+edges[1:])/2
    Y=[];own_logs=[];own_H=[];mins=[]
    for c in ["tauLeft","tauRight","tauLin"]:
        with z.open(name(c,rep)) as f:a=np.loadtxt(f,delimiter=",");assert a.shape==(170000,2) and np.isfinite(a).all()
        x,y=a.T;checkax(c,x);Y.append(bin_values(x,y,edges))
        if c!="tauLin":
            e=np.linspace(x.min(),x.max(),751);cen=(e[:-1]+e[1:])/2
            a0=bin_values(x,y,e);mins.append((c,float(min(a0)),float(min(Y[-1]))))
            if min(a0)<=0 or min(Y[-1])<=0:
                print("SOURCE_REFUSAL",json.dumps({"rep":rep,"circular_minima":mins,"held_filter_ordinates_read":0}),flush=True);raise ValueError("nonpositive circular mean before logarithm")
            own_logs.append(np.interp(g,cen,a0));own_H.append(np.interp(g,cen,H(np.log(a0))))
    Y=np.asarray(Y);L,R=Y[:2]
    # Clone the last public ElecSus master preceding source data publication.
    pin=reg["source"]["code"].split("@")[1];root=(P/"elecsus-official").resolve();root.mkdir()
    for args in [["init","-q"],["fetch","--depth=1","-q","https://github.com/durham-qlm/ElecSus.git",pin],["checkout","--detach","-q","FETCH_HEAD"]]:subprocess.run(["git",*args],cwd=root,check=True)
    assert subprocess.check_output(["git","rev-parse","HEAD"],cwd=root).decode().strip()==pin
    sys.path.insert(0,str(root/"elecsus"/"libs"));import spectra;from AtomConstants import RbD2Transition
    wave=RbD2Transition.wavevectorMagnitude;cell=.002;G=g*1000
    def atomic(t,b,x):
        par={"Elem":"Rb","Dline":"D2","Bfield":b,"T":t,"rb85frac":1.8,"lcell":cell,"Btheta":0.,"Bphi":0.}
        a=np.array(spectra.calc_chi(x,par)[:2]);n=np.sqrt(1+a);return np.exp(-2*wave*cell*n.imag),wave*cell*(n[0].real-n[1].real)
    def calc(p,sw):
        t,b,cm,sl,sr=p;xx=np.concatenate([G-cm-sl,G-cm-sr,G-cm+sl+sr])
        v,_=atomic(t,b,xx)
        return np.array([v[sw,:750],v[1-sw,750:1500],v[:,1500:].mean(0)])
    step=np.array([.15,2.,1.,1.,1.]);lo=np.array([40,4800,-450,-75,-75]);hi=np.array([150,7200,450,75,75])
    history=[]
    for sw in [0,1]:
        def err(p):return (calc(p,sw)-Y).ravel()
        def jac(p):
            y=err(p);J=[]
            for i,h in enumerate(step):
                if p[i]+h>hi[i]:h=-h
                q=p.copy();q[i]+=h;J.append((err(q)-y)/h)
            return np.array(J).T
        for t0 in [75,105]:
            f=least_squares(err,[t0,6000.,0.,0.,0.],jac=jac,bounds=(lo,hi),x_scale=[25,100,50,20,20],max_nfev=40)
            history.append({"sw":sw,"start":t0,"parameters":f.x.tolist(),"cost":float(2*f.cost),"nfev":f.nfev,"status":f.status})
    best=min(history,key=lambda q:q["cost"]);t,b,cm,sl,sr=best["parameters"];sw=best["sw"];m,phi=atomic(t,b,G-cm)
    if sw:m=m[::-1];phi=-phi
    bare=H(np.log(L)-np.log(R));modelH=H(np.log(m[0])-np.log(m[1]));delta=phi-modelH;hyb=bare+delta
    A=np.array([transmission(L,R,hyb),transmission(L,R,bare),transmission(m[0],m[1],phi),
      transmission(*own_logs,own_H[0]-own_H[1]),transmission(L,R,0),(L+R)/4,
      transmission(L,R,bare-delta),transmission(L,R,hyb,1),transmission(L,R,hyb,-1),
      transmission(L,R,phi)],dtype="<f8")
    assert A.shape==(10,750) and np.isfinite(A).all()
    # Algebraic upper bound for the effect of the selected missing-wing treatment.
    bound=np.sqrt(L*R)*abs(np.sin(delta/2));assert (abs(A[0]-A[1])<=bound+1e-12).all()
    out=io.BytesIO();np.save(out,A,allow_pickle=False);buf=out.getvalue()
    meta={"repeat":rep,"shape":list(A.shape),"protocol_sha":hashlib.sha256((P/"protocol.json").read_bytes()).hexdigest(),"target_axis_sha":axspec[f"filter/filter_{rep}.csv"]["vector_sha"],"roles":reg["roles"],"sha":hashlib.sha256(buf).hexdigest(),"n":len(buf),"role_sha":[hashlib.sha256(x.tobytes()).hexdigest() for x in A],"range_GHz":[float(edges[0]),float(edges[-1])],"source_minima":mins,"rms_horizontal_half_sum_disagreement":float(np.sqrt(np.mean((Y[2]-(L+R)/2)**2))),"fit_history":history,"selected":best,"max_phase_continuation_rad":float(max(abs(delta))),"max_signal_difference_bound":float(max(bound)),"max_actual_signal_change":float(max(abs(A[0]-A[1]))),"wall_seconds":time.monotonic()-start,"target_ordinates_read":0}
    print("FORECAST",json.dumps(meta,sort_keys=True),flush=True);print("NPY",base64.b64encode(buf).decode(),flush=True)
if __name__=="__main__":main()
