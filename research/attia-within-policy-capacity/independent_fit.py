"""Independently recount the frozen shape fit using a pure-Python primal ridge system."""
import csv
import hashlib
import io
import json
import math
import statistics
import urllib.request
from collections import Counter
from urllib.parse import quote

PINS = {"domhan_comparison/IvsSOC_test1.csv":"208780b78cdda414febbd8181bd1403b5aa2fd07","domhan_comparison/IvsSOC_train.csv":"13b5b9be1f4b24c1ef781f5eae5416a8bf6cc93d","domhan_comparison/Qn_test1.csv":"98d746ec4df5a29a414e38d8bb84ec6bbacd8124","domhan_comparison/Qn_train.csv":"2fc6fc9fdde840201efaad244ec79ada06f80d0d","domhan_comparison/y_pred_Severson_test1.csv":"ae08e8082f872aa98b88658cf4f2230982dcdf0c","domhan_comparison/y_pred_Severson_train.csv":"253449b10b7b2ebbfa892d2eeef3fada93167e99","domhan_comparison/y_test1.csv":"20293a1f67474088add2504c985d8e966a36307b","domhan_comparison/y_train.csv":"43ba2daae588c58f833c41ffe04c2cb8de3eddcb"}


def read(path):
    base="https://raw.githubusercontent.com/petermattia/battery-parameter-spaces/ec9508f9d2d6098f6e9a46dfaf79a222e65d7491/"
    b=urllib.request.urlopen(base+quote(path),timeout=45).read()
    assert hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()==PINS[path]
    return list(csv.reader(io.StringIO(b.decode("utf-8-sig"))))


def solve(matrix, rhs):
    a=[list(row)+[val] for row,val in zip(matrix,rhs,strict=True)]
    for i in range(len(a)):
        pivot=max(range(i,len(a)),key=lambda j:abs(a[j][i]))
        a[i],a[pivot]=a[pivot],a[i]
        d=a[i][i]
        if abs(d)<1e-16:raise ValueError("Singular system")
        a[i]=[v/d for v in a[i]]
        for j in range(len(a)):
            if i!=j:
                scale=a[j][i]
                a[j]=[v-scale*w for v,w in zip(a[j],a[i],strict=True)]
    return [row[-1] for row in a]


def dot(a,b):
    return math.fsum(i*j for i,j in zip(a,b,strict=True))


def primal(z,y,penalty):
    cols=list(zip(*z))
    gram=[[dot(a,b)+(penalty if i==j else 0) for j,b in enumerate(cols)] for i,a in enumerate(cols)]
    return solve(gram,[dot(c,y) for c in cols])


def load(role):
    path="domhan_comparison/"
    q=read(path+"Qn_"+role+".csv")
    e=[float(r[0]) for r in read(path+"y_pred_Severson_"+role+".csv")]
    y=[float(r[0]) for r in read(path+"y_"+role+".csv")]
    groups=[tuple(map(float,r)) for r in read(path+"IvsSOC_"+role+".csv")]
    basis=[[1.0,-math.expm1(-n/24),n/98,(n/98)**2] for n in range(99)]
    z=[]
    for row in q:
        cap=list(map(float,row[1:100]))
        c=primal(basis,cap,0.)
        err=math.sqrt(statistics.mean((v-dot(f,c))**2 for f,v in zip(basis,cap,strict=True)))
        z.append(c+[err])
    return z,e,y,groups


def main():
    z,e,y,_=load("train");u,v,t,groups=load("test1")
    mu=[statistics.mean(c) for c in zip(*z)];sd=[statistics.pstdev(c) or 1 for c in zip(*z)]
    def standard(rows):return [[(val-m)/s for val,m,s in zip(row,mu,sd,strict=True)] for row in rows]
    z=standard(z);u=standard(u)
    res=[b-a for a,b in zip(e,y,strict=True)]
    intercept=statistics.mean(res)
    opts=[]
    for pen in (.1,1.,10.,100.):
        coef=primal(z,[a-intercept for a in res],pen)
        pred=[a+intercept+dot(row,coef) for a,row in zip(v,u,strict=True)]
        loss=math.sqrt(statistics.mean((b-a)**2 for b,a in zip(t,pred,strict=True)))
        opts.append((loss,pen,pred))
    loss,pen,pred=min(opts)
    xy=[];xx=[];ncontrasts=0
    for group,count in Counter(groups).items():
        if count==1:continue
        idx=[i for i,g in enumerate(groups) if g==group]
        p=[pred[i] for i in idx];o=[t[i] for i in idx];pm=statistics.mean(p);om=statistics.mean(o)
        xy.extend((b-om)*(a-pm) for b,a in zip(o,p,strict=True));xx.extend((a-pm)**2 for a in p)
        ncontrasts+=count-1
    slope=math.fsum(xy)/math.fsum(xx)
    worst=max(range(len(t)),key=lambda i:abs(t[i]-pred[i]))
    assert pen==100 and ncontrasts==4 and abs(slope+0.5593379561452281)<1e-7 and abs(loss-208.09182972253697)<1e-6
    assert worst==7 and t[worst]==691 and abs(pred[worst]-1777.325728834078)<1e-5
    result={"fit_cells":len(y),"development_cells":len(t),"penalty_losses":{str(p):l for l,p,_ in opts},
            "replicated_df":ncontrasts,"crossproduct":math.fsum(xy),"sum_squares":math.fsum(xx),
            "unconstrained":slope,"bounded":min(1,max(0,slope)),"worst":[worst,t[worst],pred[worst]],
            "restricted_source_file_count":len(PINS),"validation_requests":0}
    print(json.dumps(result,sort_keys=True,allow_nan=False))


if __name__=="__main__":
    main()
