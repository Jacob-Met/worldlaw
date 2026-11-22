"""Pure-Python third reader for the 48 archived symmetric added-mass tensors."""
import json
import math
from pathlib import Path

HERE=Path(__file__).parent


def mul(a,b):
    return [[sum(x*y for x,y in zip(row,col)) for col in zip(*b)] for row in a]


def sub_diag(a,t):
    return [[v-(t if i==j else 0) for j,v in enumerate(row)] for i,row in enumerate(a)]


def det(a):
    return sum(a[0][k]*(a[1][(k+1)%3]*a[2][(k+2)%3]-a[1][(k+2)%3]*a[2][(k+1)%3]) for k in range(3))


def eigenvalues(a):
    q=sum(a[i][i] for i in range(3))/3
    b=sub_diag(a,q)
    p=math.sqrt(sum(v*v for row in b for v in row)/6)
    if p==0:return [q]*3
    theta=math.acos(max(-1.,min(1.,det(b)/(2*p**3))))/3
    return sorted(q+2*p*math.cos(theta+2*k*math.pi/3) for k in range(3))


def project_diag(a,vals,k):
    i,j=[p for p in range(3) if p!=k]
    p=mul(sub_diag(a,vals[i]),sub_diag(a,vals[j]))
    return [max(0.,min(1.,p[c][c]/((vals[k]-vals[i])*(vals[k]-vals[j])))) for c in range(3)]


def acute(x):
    return math.degrees(math.acos(max(0.,min(1.,x))))


def angles(a):
    v=eigenvalues(a);rank=sum(x>=.985*v[-1] for x in v)
    if rank==3:return [180/math.pi]*3,v,rank
    if rank==1:return [acute(math.sqrt(x)) for x in project_diag(a,v,2)],v,rank
    null=project_diag(a,v,0)
    m=8192
    # Average about a fixed axis in the chosen plane; rotational phase
    # cancels in the continuous circle integral.
    c=[math.cos((j+.5)*math.pi/(2*m)) for j in range(m)]
    return [sum(acute(math.sqrt(1-p)*t) for t in c)/m for p in null],v,rank


def run():
    voxel=json.loads((HERE/'frozen-geometry.json').read_text())
    panels=json.loads((HERE/'frozen-panels.json').read_text())
    src=voxel['source_inertia'];report={};emax=0.;amax=0.;nt=0
    for label,bank,key in [('voxel',voxel,'grid'),('panel',panels,'panel_outputs')]:
        changed={}
        for name,row in bank['records'].items():
            av=[]
            for record in row[key]:
                theta,e,rank=angles(record['mass_tensor'])
                if rank!=record['top_rank']:raise ValueError((name,'rank mismatch'))
                emax=max(emax,max(abs(x-y) for x,y in zip(e,record['spectrum'])))
                amax=max(amax,max(abs(x-y) for x,y in zip(theta,record['angles'])))
                nt+=1;av.append(theta)
            r=src[name]
            axes=[0] if r[2]-r[1]<.02 else [2] if r[1]-r[0]<.02 else [0,1,2]
            changed[name]=sum(abs(av[0][k]-av[1][k]) for k in axes)/len(axes)
        report[label]={'completed':len(changed),'over_ten':sorted(n for n,m in changed.items() if m>10),
                       'worst_shape':max(changed,key=changed.get),'max_drift':max(changed.values()),
                       'min_drift':min(changed.values()),'n_refusals':len(bank['refusals'])}
    if nt!=48 or emax>1e-11 or amax>5e-4:raise ValueError((nt,emax,amax))
    if report['voxel']['over_ten']!=['Ag,Cr14','Ag,Cr77','Ag,Cr92'] or report['panel']['over_ten']:
        raise ValueError('admission criteria mismatch')
    return {'summary':report,'n_tensors':nt,'n_angles':nt*3,'max_eigen_difference':emax,
            'max_angle_difference_deg':amax,'measured_angles_decoded':0}


if __name__=='__main__':print(json.dumps(run(),indent=2,sort_keys=True))
