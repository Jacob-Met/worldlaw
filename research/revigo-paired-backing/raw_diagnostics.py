import json
import math

from development import DEV, FINAL, inverse_surface, optical_fit, pigment_law, predict, read

def diagnostic(root):
    rec,train=read(root,lambda k,c:k not in DEV and k not in FINAL)
    _,valid=read(root,lambda k,c:k in DEV)
    table=optical_fit(rec,train)
    traces={}
    for key in DEV:
        measure=valid[key]
        estimates,branches=predict(key,rec,measure,table,train)
        optics=pigment_law(table,rec,key)
        records=[]
        for j,(k,s) in enumerate(optics):
            a=1+k/s
            g,gw,obsb,obsw=[measure[n][j] for n in ('b','w','ob','ow')]
            b=inverse_surface(obsb);root_k=math.sqrt(k*(k+2*s))
            ri=s/(k+s+root_k)
            branch=branches['physical_branch_by_wavelength'][j]
            if branch=='interior':
                # The derivative is computed from the Riccati flow's projective
                # invariant. Derive it again by differentiating N and H below.
                n=1-a*(b+g)+b*g; h=b-g;dn=g-a
                top=h+(n-a*h)*gw; bot=n+(a-gw)*h
                ft=top/bot
                deriv_internal=((1+(dn-a)*gw)*bot-top*(dn+(a-gw)))/(bot*bot)
                deriv_external=deriv_internal*((1-.49*b)/(1-.49*ft))**2
                d0=(.96*.51)/(.96*.51 + .49*(obsb-.04))**2
                # d(Surf)/dx above is used only in the explicit check.
                assert abs(deriv_external-deriv_internal*(.96*.51)/(1-.49*ft)**2*d0)<1e-5*max(1,abs(deriv_external))
                u=n/h
                thick=math.atanh(min(1-1e-15,root_k/(s*u)))/root_k if u>0 else None
            else:
                deriv_external=None
                thick=None
            records.append({'nm':400+10*j,'bare_b':g,'bare_w':gw,'painted_b':obsb,'painted_w':obsw,'K_times_nominal_D':k,'S_times_nominal_D':s,'infinite_internal_reflectance':ri,'internal_painted_b':b,'black_endpoint_span_internal':ri-g,'per_band_relative_depth':thick,'d_predicted_white_d_observed_black':deriv_external,'branch':branch,'predictions':{n:p[j] for n,p in estimates.items()}})
        traces[key]={'records':records,'nominal_relative_thickness':1.,'inferred_common_thickness':branches['common_d']}
    print(json.dumps(traces,separators=(',',':'),sort_keys=True),flush=True)
