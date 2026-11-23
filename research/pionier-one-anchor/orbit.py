"""One-epoch calibrated visual-orbit predictions with an unresolved global reflection."""
import math

AU_GM = 149.5978707
ARMS = ("stationary", "face_on", "edge_on", "isotropic", "physical_fit",
        "parallax_minus_sigma", "parallax_plus_sigma", "marginal")

def xy(star, mjd, perturb=None):
    p = dict(star)
    clock = 0.
    if perturb:
        for field,sign in zip(("period","epoch","e","omega"),perturb[:4]):
            p[field] += sign*p[field+"_se"]
        clock = perturb[4]*.008
    # Source uses observed spectroscopic period, BJD - 2400000, and PIONIER MJD.
    mean = math.remainder(2*math.pi*((mjd+.5+clock)-p["epoch"])/p["period"],2*math.pi)
    e = p["e"]
    low,high = -math.pi,math.pi
    for _ in range(65):
        middle = (low+high)/2
        if middle-e*math.sin(middle) < mean:
            low = middle
        else:
            high = middle
    E = (low+high)/2
    X,Y = math.cos(E)-e,math.sqrt(1-e*e)*math.sin(E)
    w = math.radians(p["omega"])
    return X*math.cos(w)-Y*math.sin(w), X*math.sin(w)+Y*math.cos(w)

def fixed_orientation(c, anchor, target, rho):
    u,v = anchor
    x,y = target
    d = u*u+c*c*v*v
    if d<=0 or rho<=0:
        raise ValueError("Singular or unresolved anchor")
    return (rho*math.sqrt((x*x+c*c*y*y)/d),
            rho*(u*x+c*c*v*y)/d, rho*c*(u*y-v*x)/d)

def fit_orientation(A, rho, anchor):
    u,v = anchor
    a2 = (rho*rho+A*A*v*v)/(u*u+v*v)
    raw = 1-A*A/a2
    # The weighted one-anchor least-squares fit is at the edge-on boundary
    # when rho < abs(A*u). Keep the unconstrained residual separately.
    return math.sqrt(max(0.,raw)),raw

def quadrature(anchor,rho,A,sigma,n,condition):
    u,v=anchor
    grid=[(i+.5)/n for i in range(n)]
    logs=[]
    for c in grid:
        implied=rho*math.sqrt((1-c*c)/(u*u+c*c*v*v))
        logs.append(-.5*((A-implied)/sigma)**2 if condition else 0.)
    top=max(logs)
    weights=[math.exp(x-top) for x in logs]
    total=math.fsum(weights)
    return [(c,w/total) for c,w in zip(grid,weights)]

def averaged(weights,anchor,target,rho):
    values=[(w,fixed_orientation(c,anchor,target,rho)) for c,w in weights]
    return tuple(math.fsum(w*v[j] for w,v in values) for j in range(3))

def bank(star,n=4096,perturb=None):
    epochs=star["epochs"]
    rho=epochs[0]["rho"]
    anchor=xy(star,epochs[0]["mjd"],perturb)
    axis=(star["a1"]+star["a2"])/AU_GM
    A=axis*star["parallax"]
    sigma=math.hypot(axis*star["parallax_se"],
                     star["parallax"]*(star["a1_se"]+star["a2_se"])/AU_GM)
    radial_axis=((star["K1"]+star["K2"])*star["period"]*86400
                 *(1-star["v0"]/299792.458)*math.sqrt(1-star["e"]**2)/(2*math.pi*1e6))
    if abs(radial_axis-(star["a1"]+star["a2"]))>.15:
        raise ValueError("RV semi-axis units")
    c,c2=fit_orientation(A,rho,anchor)
    fits={}
    for name,trial in (("physical_fit",A),("parallax_minus_sigma",max(0.,A-sigma)),("parallax_plus_sigma",A+sigma)):
        ci,raw=fit_orientation(trial,rho,anchor)
        fitted_radius=max(rho,trial*abs(anchor[0]))
        fits[name]=(ci,fitted_radius)
    prior=quadrature(anchor,rho,A,sigma,n,False)
    posterior=quadrature(anchor,rho,A,sigma,n,True)
    rows=[]
    for epoch in epochs[1:]:
        t=xy(star,epoch["mjd"],perturb)
        f={arm:fixed_orientation(val,anchor,t,rho) for arm,val in
           {"face_on":1.,"edge_on":0.}.items()}
        for arm,(value,fitted_radius) in fits.items():
            f[arm]=fixed_orientation(value,anchor,t,fitted_radius)
        f["stationary"]=(rho,rho,0.)
        f["isotropic"]=averaged(prior,anchor,t,rho)
        f["marginal"]=averaged(posterior,anchor,t,rho)
        rows.append({"mjd":epoch["mjd"],"fixed_flux":epoch["fixed_flux"],"forecast":f,
                     "admissible_radius":[min(f["face_on"][0],f["edge_on"][0]),
                                          max(f["face_on"][0],f["edge_on"][0])]})
    return {"anchor":{"mjd":epochs[0]["mjd"],"rho":rho,"pa":epochs[0]["pa"]},"A_mas":A,
            "scale_se_mas":sigma,"cos_i_squared_unconstrained":c2,"rows":rows}
