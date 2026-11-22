"""Fit exactly the observable within-face kinematic law, with rational arithmetic.

The face is x=-ell, t=r_y/ell, and z=(v_x,v_y,ell*omega). Input u is
material-point velocity on the pusher at the contact, in the body's frame.
"""
from fractions import Fraction as Q

from sticking_operator import contact_basis, matvec


def equation(t, z):
    x,y,w = z
    return (t*x, t*y+x, t*w+x, y, w)


def fit_exact(samples):
    rows=[list(equation(t,z)) for t,z in samples]
    pivot_cols=[]
    for col in range(5):
        top=len(pivot_cols)
        pivot=next((i for i in range(top,len(rows)) if rows[i][col]),None)
        if pivot is None:
            continue
        rows[top],rows[pivot]=rows[pivot],rows[top]
        denom=rows[top][col]
        rows[top]=[v/denom for v in rows[top]]
        for i in range(len(rows)):
            if i!=top:
                k=rows[i][col]
                rows[i]=[a-k*b for a,b in zip(rows[i],rows[top])]
        pivot_cols.append(col)
    if len(pivot_cols)!=4:
        raise ValueError(f"Expected exact within-face rank four, observed {len(pivot_cols)}")
    free=next(i for i in range(5) if i not in pivot_cols)
    co=[Q(0)]*5
    co[free]=Q(1)
    for i,pivot in enumerate(pivot_cols):
        co[pivot]=-rows[i][free]
    if co[0]<0:
        co=[-v for v in co]
    ax,ay,az,by,bz=co
    if ax<=0 or ax*(by+bz)-(ay+az)**2<=0:
        raise ValueError("No positive-definite completion for the observed face law")
    return tuple(v/ax for v in co)


def predict(co, t, u):
    ax,ay,az,by,bz=co
    bx=ay+az
    # q' A evaluated on the minimum-angular-velocity particular solution (u,0).
    numerator=(t*ax+bx)*u[0]+(t*ay+by)*u[1]
    denominator=ax*t*t+2*bx*t+by+bz
    if denominator<=0:
        raise ValueError("Nonpositive contact-normal quadratic form")
    spin=-numerator/denominator
    return u[0]+t*spin,u[1]+spin,spin


def main():
    ell=Q(45,1000)
    h=((Q(2),Q(1,3),Q(-1,4)),(Q(1,3),Q(4,3),Q(2,7)),(Q(-1,4),Q(2,7),Q(3,2)))
    training=[]
    held=[]
    for site in range(11):
        t=Q(site-5,5)
        r=(-ell,ell*t)
        b=contact_basis(r,ell)
        for tangential in (Q(-1,4),Q(0),Q(1,4)):
            wrench=(Q(1),tangential,b[0][2]+tangential*b[1][2])
            z=tuple(v/50 for v in matvec(h,wrench))
            u=matvec(b,z)
            if site in (2,8):
                held.append((t,u,z))
            else:
                training.append((t,z))
    model=fit_exact(training)
    assert all(predict(model,t,u)==z for t,u,z in held)
    try:
        fit_exact([(t,z) for t,z in training if t==0])
    except ValueError as err:
        assert "rank" in str(err)
    else:
        raise AssertionError("Accepted one-geometry training as identified")
    print(dict(training_pose_only=len(training),held_mirror_twists_exact=len(held),
               observable_coefficients=[str(x) for x in model],
               sensor_wrenches_passed_to_estimator=0,full_resistance_recovered=False))


if __name__=='__main__':
    main()
