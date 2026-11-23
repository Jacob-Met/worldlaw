"""Replay finite exact shunt algebra and recorded measurement/forecast comparisons."""
from fractions import Fraction as F
import hashlib,json,math,pathlib,sys
r=pathlib.Path(sys.argv[1])
def read(n):return json.loads((r/n).read_text())
def native(n):return json.loads((r/n).read_text().splitlines()[-1])
reg=read("protocol.json");score=read("raw-score.json");lock=read("forecast-lock.json")
assert hashlib.sha256((r/"protocol.json").read_bytes()).hexdigest()==lock["protocol_sha"]
assert score==native("score-original.txt") and score["roles"]==reg["roles"]==lock["roles"]
assert lock["shape"]==[9,19501,3,3] and score["complex_residuals"]==1579581 and lock["held_opens_decoded"]==0
assert lock["min_dlt_ratio"]>.007 and not any(n for arm in lock["fallback"] for row in arm for n in row)
assert len(lock["digests"])==81 and lock["archive_sha"]==read("escrow-manifest.json")["archive_sha256"]==score["archive_sha"]
ind=native("independent-original.txt");cold=native("cold-archive-original.txt")
assert cold["archive_sha"]==lock["archive_sha"] and cold["all_field_vectors"]==81 and cold["part_blobs"]==24
rm=[[x for u in v for x in u] for v in score["per_unit_rmse"]]
means=[math.fsum(x)/9 for x in rm];wins=[sum(a<b for a,b in zip(rm[0],row)) for row in rm]
assert wins==score["primary_wins_of_9"]==ind["wins"]
assert all(abs(a-b)<1e-13 for a,b in zip(means,score["mean_rmse"])) and all(abs(a-b)<1e-13 for a,b in zip(means,ind["means"]))
assert score["gate"]==all(means[0]<means[i] and wins[i]>=6 for i in range(1,9))
for row in score["worst_primary"]["window"]:
    z=complex(*row["Z_open"]);actual=(z-1)/(z+1)
    assert abs(actual-complex(*row["open_reflection"]))<1e-14
    assert all(abs(abs(complex(*x)-actual)-y)<1e-14 for x,y in zip(row["role_reflections"],row["role_errors"]))
def mul(P,Q):
    a,b,c,d=P;e,f,g,h=Q;return (a*e+b*g,a*f+b*h,c*e+d*g,c*f+d*h)
def inv(P):
    a,b,c,d=P;det=a*d-b*c;return (d/det,-b/det,-c/det,a/det)
def transform(P,z):
    a,b,c,d=P;return (a*z+b)/(c*z+d)
count=0
for k in range(1,9):
    T=(F(k+1),F(1,3),F(1,k+2),F(2))
    def shunt(delta):return mul(mul(T,(F(1),delta,F(0),F(1))),inv(T))
    A=shunt(F(1,7));B=shunt(F(2,5));assert mul(A,B)==mul(B,A)
    for M,delta in [(A,F(1,7)),(B,F(2,5))]:
        a,b,c,d=M;assert (a-d)**2+4*b*c==0 and transform(M,T[0]/T[2])==T[0]/T[2]
        for j in range(1,9):
            x=F(j,9);assert transform(M,transform(T,x))==transform(T,x+delta);count+=1
print("Exact shared-shunt identities",count,"and all 81 held-unit metrics verified. Registered gate",score["gate"])
