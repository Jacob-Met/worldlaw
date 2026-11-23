"""Independent source-equation check using impedance matrices and the registered closed inputs."""
import cmath,hashlib,io,json,math,sys,zipfile
import numpy as np
from independent_recount import numeric_fields
def cell(f,g,u,l):
    L1=g["L1"][0];L2=g["L2"][l-1];Lh=.010;c=343.;fs=44100.;R=.0075;rh=u/2000
    f1=c/(4*(L1+L2)); f2=5*f1
    def delay(R,L):
        def gamma(x):
            s=2j*math.pi*x;return s/c+1.044*math.sqrt(8e-8/c)/R*cmath.sqrt(s)+1.08*4e-8/R**2
        m1=math.exp(-2*L*gamma(f1).real);m2=math.exp(-2*L*gamma(f2).real)
        cs1=math.cos(2*math.pi*f1/fs);cs2=math.cos(2*math.pi*f2/fs)
        D=m1-m2;C=m1*cs1-m2*cs2;K=C-math.sqrt(C*C-D*D);a=K/D;b=math.sqrt(2*m1*m2*(cs1-cs2)*K)/D
        return b*np.exp(-2j*math.pi*f*L/c)/(1-a*np.exp(-2j*math.pi*f/fs))
    def transfer(R,L):
        v=delay(R,L);I=(v+1/v)/2;J=(1/v-v)/2;return (I,J,J,I)
    def mult(M,N):
        a,b,c,d=M;e,f,g,h=N
        return (a*e+b*g,a*f+b*h,c*e+d*g,c*f+d*h)
    up=transfer(R,L1);down=transfer(R,L2);v=delay(rh,Lh)
    yc=(rh/R)**2*(1/v-v)/(1/v+v);yo=(rh/R)**2*(1/v+v)/(1/v-v)
    A,B,C,D=mult(mult(up,(1,0,yo,1)),down);zo=B/D
    a,b,c,d=up
    X=mult(mult(up,(1,0,yo-yc,1)),(d,-b,-c,a))
    return (zo-1)/(zo+1),X
def main(raw_zip,archive):
    reg=json.load(open("protocol.json"));lock=json.load(open("forecast-lock.json"))
    raw=open(archive,"rb").read();assert hashlib.sha256(raw).hexdigest()==lock["archive_sha"]
    with np.load(io.BytesIO(raw)) as z:A=z["predictions"];f=z["frequencies"]
    err=[0.,0.];cd={};rows=[]
    with zipfile.ZipFile(raw_zip) as z:
        for r in reg["acquisitions"]:
            p=r["path"];l=int(p[-5]);u=int(p.split("diam ")[-1][0]);data=z.read(p)
            assert hashlib.sha256(data).hexdigest()==r["sha256"]
            Z=np.array(numeric_fields(data,{"Z_closed"})["Z_closed"]);cd[u,l]=(Z-1)/(Z+1)
            if l not in reg["held_lower"]:continue
            h=reg["held_lower"].index(l);r0,X=cell(f,reg["geometry"],u,l);a,b,c,d=X;Zo=(a*Z+b)/(c*Z+d);rr=(Zo-1)/(Zo+1)
            for i,py in enumerate([r0,rr]):
                ev=float(np.max(abs(A[5+i,:,u-1,h]-py)));err[i]=max(err[i],ev)
        for l in range(1,8):
            for a,b in [(1,2),(1,3),(2,3)]:
                e=abs(cd[a,l]-cd[b,l]);rows.append(dict(lower=l,upper_pair=[a,b],rms=float(np.sqrt(np.mean(e*e))),max_abs=float(e.max()),worst_hz=float(f[int(np.argmax(e))])))
    assert max(err)<2e-7,err
    print(json.dumps(dict(rows_per_role=19501*9,independent_matrix_max_abs_against_complex64=err,closed_repeat_comparisons=rows,observed_opened_fields=0),sort_keys=True))
if __name__=="__main__":main(*sys.argv[1:])
