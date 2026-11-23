from decimal import Decimal as D
def verify(f,train,tes,check,mean):
    z={}
    for k,row in train.items():
        m,j=int(k[3]),int(k[5]);fit=row["fit"];z[m,j]=[-fit["offset"]/fit["slope"]/(10*j),-1/fit["slope"]]
    anchor={m:[mean(z[m,j][a] for j in (1,2)) for a in (0,1)] for m in range(1,9)}
    pairs=[(m,j) for m in range(1,5) for j in range(1,10)]
    x=[D(10*j-15) for m,j in pairs];a2=sum(v**2 for v in x);a3=sum(v**3 for v in x);a4=sum(v**4 for v in x);co=[]
    for a in (0,1):
        y=[z[m,j][a]/anchor[m][a]-1 for m,j in pairs];d1=sum(u*v for u,v in zip(x,y));d2=sum(u*u*v for u,v in zip(x,y));det=a2*a4-a3*a3
        co.append([d1/a2,(d1*a4-d2*a3)/det,(d2*a2-d1*a3)/det])
        for u,v in zip(co[-1],f["global_slopes"][a]):check(u,v,"slope")
    for k in tes:
        m,j=int(k[3]),int(k[5]);u=D(10*j-15);near=min(range(1,5),key=lambda h:sum((anchor[h][a]/anchor[m][a]).ln()**2 for a in (0,1)))
        for a in (0,1):
            A=anchor[m][a];glob=A*(1+co[a][0]*u);rel=A*mean(z[h,j][a]/anchor[h][a] for h in range(1,5))
            loc=((z[m,1][a].ln()+z[m,2][a].ln())/2+u*(z[m,2][a]/z[m,1][a]).ln()/10).exp()
            d={"integrated_shape":glob,"integrated_line":glob,"elapsed_shape":glob,"constant_thevenin":A,
             "source_mean_curve":mean(z[h,j][a] for h in range(1,5)),"relative_by_setting":rel,"relative_by_setting_shape":rel,
             "additive_by_setting":A+mean(z[h,j][a]-anchor[h][a] for h in range(1,5)),"local_gradient":loc,"shrunk_local":(glob*loc).sqrt(),
             "quadratic_shared":A*(1+co[a][1]*u+co[a][2]*u*u),"nearest_corrected":A*z[near,j][a]/anchor[near][a],
             "wrong_module":anchor[5+(m-4)%4][a]*(1+co[a][0]*u)}
            for r in f["roles"]:check(d[r]*(10*j if a==0 else 1),f["models"][k][r][a],"E_R")
