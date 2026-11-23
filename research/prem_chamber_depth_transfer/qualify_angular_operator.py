"""Compare the reciprocal hemispheric kernel with unaltered author transport loops on six synthetic media."""
import hashlib,io,json,math,pathlib,re,subprocess,urllib.request,zipfile
P=pathlib.Path(".")
CASES=[(7.,0.,0.,.018),(8.,.012,.45,.009),(9.,.096,.8,.003),(10.,.045,0.,.035),(11.,.030,-.55,.008),(12.,.085,.97,.0008)]
NL=8
DZ=10.
N=170000
SHA="469765e8b4a08a47525c0326351ae2dfdc45000073369e04d22f81acaf6d8796"
def run(args,**kw):return subprocess.run(args,check=True,capture_output=True,**kw)
req=urllib.request.Request("https://zenodo.org/records/6757550/files/codes.zip?download=1",headers={"User-Agent":"public ReBL scientific code comparison"})
with urllib.request.urlopen(req,timeout=75) as f:raw=f.read()
assert hashlib.sha256(raw).hexdigest()==SHA
z=zipfile.ZipFile(io.BytesIO(raw))
member="codes/mc_code (example)/emspec_mc.c"
base=z.read(member);src=base.decode()
# Restrict only workload and random seed. The physical depth, angular triangle,
# emit, scatter, absorption, escape and output equations stay source-identical.
for key,val in [("NPHOTONS",N),("NLAYERS",NL),("NSPEC",len(CASES))]:
    src,n=re.subn(r"(?m)^(#define "+key+r"\s+)\S+",lambda m:m[1]+str(val),src)
    assert n==1
origin="srand(myID+(unsigned)time(&t));"
assert src.count(origin)==1
src=src.replace(origin,"srand(56921U+(unsigned)myID);")
(P/"forward.c").write_text(src)
(P/"mpi.h").write_text("#include <string.h>\n#define MPI_COMM_WORLD 0\n#define MPI_DOUBLE 0\n#define MPI_SUM 0\n#define MPI_Init(x,y) ((void)0)\n#define MPI_Comm_rank(x,y) (*(y)=0)\n#define MPI_Comm_size(x,y) (*(y)=1)\n#define MPI_Barrier(x) ((void)0)\n#define MPI_Allreduce(s,d,n,t,o,c) memcpy((d),(s),(n)*sizeof(double))\n#define MPI_Finalize() ((void)0)\n")
inputs="".join(" ".join(map(str,x))+"\n" for x in CASES)
(P/"sga_enst_28um_037_bestfit.dat").write_text(inputs)
run(["cc","-O2","-I.","forward.c","-lm","-o","forward"])
run(["cc","-O2","adjoint.c","-lm","-o","adjoint"])
run(["./forward"])
rows=[[float(v) for v in l.split()] for l in (P/"isothermal_400K_weights_enst_28um_037_bestfit.dat").read_text().splitlines()]
def adj(mode,angle,seed):
    vals=[[int(v) for v in l.split()] for l in run(["./adjoint",str(NL),str(DZ),str(N),mode,str(angle),str(seed)],input=inputs.encode()).stdout.splitlines()]
    assert len(vals)==len(CASES)*(NL+2)
    lookup={(r,i):n for r,i,n in vals}
    assert all(sum(lookup[r,i] for i in range(NL+2))==N for r in range(len(CASES)))
    return lookup
h=adj("hemisphere",90,5282161);n=adj("cone",0,9916433)
def compare(x,y,var,extra=0):
    return abs(x-y)/(math.sqrt(max(var,1/N**2))+extra/7)
stats=[]
for k,(lam,s,g,a) in enumerate(CASES):
    maxz=0;max_abs=0
    for i in range(NL+1):
        # Forward index 0 is the deepest volume layer; adjoint index 0 is the top.
        j=NL-1-i if i<NL else NL
        wl,ii,ef,af,_=rows[k*(NL+1)+j];assert wl==lam and ii==j and af==a
        c=4*a*DZ if i<NL else 1.
        wf=ef*c;wa=h[k,i]/N
        var=(c*c*ef*(1-ef)+wa*(1-wa))/N
        maxz=max(maxz,compare(wf,wa,var,1e-6*max(1,c)))
        max_abs=max(max_abs,abs(wf-wa))
    stats.append({"lambda":lam,"max_se":maxz,"max_absolute":max_abs,"reverse_return":h[k,NL+1]/N,"normal_return":n[k,NL+1]/N})
def survival(z,mode):
    if mode=="cone":return math.exp(-CASES[0][3]*z)
    return math.fsum(2*u*math.exp(-CASES[0][3]*z/u) for u in [(i+.5)/8192 for i in range(8192)])/8192
analytic={}
for mode,res in [("cone",n),("hemisphere",h)]:
    err=[]
    for i in range(NL+1):
        p=survival(i*DZ,mode)-(survival((i+1)*DZ,mode) if i<NL else 0.)
        err.append(compare(res[0,i]/N,p,p*(1-p)/N,1e-7))
    assert res[0,NL+1]==0
    analytic[mode]=max(err)
receipt={"source_sha256":hashlib.sha256(base).hexdigest(),"configured_sha256":hashlib.sha256(src.encode()).hexdigest(),"layers":NL,"synthetic_inputs":CASES,"forward_emissions":len(CASES)*N*(NL+1),"per_reverse_role":len(CASES)*N,"all_layer_maximum_standard_errors":max(v["max_se"] for v in stats),"pure_absorption_analytic_maximum_standard_errors":analytic,"six_media":stats,"scientific_spectra_read":0}
print(json.dumps(receipt,sort_keys=True),flush=True)
assert receipt["all_layer_maximum_standard_errors"]<7 and max(analytic.values())<7
