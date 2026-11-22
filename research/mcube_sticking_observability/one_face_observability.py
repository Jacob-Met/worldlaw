"""Exact resistance ambiguity on one square face and a different-face witness."""
from fractions import Fraction as Q

from sticking_operator import contact_basis, dot, matvec, solve_stick


def inverse(matrix):
    """Exact Gauss-Jordan inversion for this bounded rational qualification."""
    size = len(matrix)
    rows = [list(row) + [Q(i == j) for j in range(size)] for i, row in enumerate(matrix)]
    for col in range(size):
        pivot = next(i for i in range(col,size) if rows[i][col])
        rows[col], rows[pivot] = rows[pivot], rows[col]
        entry = rows[col][col]
        rows[col] = [x/entry for x in rows[col]]
        for i in range(size):
            if i != col:
                k = rows[i][col]
                rows[i] = [x-k*y for x,y in zip(rows[i],rows[col])]
    return tuple(tuple(row[size:]) for row in rows)


def rank(matrix):
    rows = [list(r) for r in matrix]
    row = 0
    for col in range(len(rows[0])):
        pivot = next((j for j in range(row,len(rows)) if rows[j][col]),None)
        if pivot is None:
            continue
        rows[row], rows[pivot] = rows[pivot], rows[row]
        v = rows[row][col]
        rows[row] = [x/v for x in rows[row]]
        for j in range(row+1,len(rows)):
            m = rows[j][col]
            rows[j] = [x-m*y for x,y in zip(rows[j],rows[row])]
        row += 1
    return row


def constraint(q,z):
    a,b,c=q
    x,y,w=z
    return (a*x,b*y,c*w,a*y+b*x,a*w+c*x,b*w+c*y)


def main():
    ell=Q(45,1000)
    h=((Q(2),Q(1,3),Q(-1,4)),(Q(1,3),Q(4,3),Q(2,7)),(Q(-1,4),Q(2,7),Q(3,2)))
    a=inverse(h)
    e=(Q(0),Q(1),Q(-1))
    a2=tuple(tuple(a[i][j]+e[i]*e[j]/Q(8) for j in range(3)) for i in range(3))
    h2=inverse(a2)
    constraints=[]
    force_differences=0
    examples=0
    max_friction_ratio=Q(0)
    for side_pos in range(11):
        r=(-ell,ell*Q(side_pos-5,5))
        b=contact_basis(r,ell)
        q=(-b[0][2],-b[1][2],Q(1))
        assert dot(q,e)==0
        for slope in (Q(-1,4),Q(0),Q(1,4)):
            f=(Q(1),slope)
            load=tuple(f[0]*x+f[1]*y for x,y in zip(*b))
            z=tuple(x/50 for x in matvec(h,load))
            u=matvec(b,z)
            za,fa=solve_stick(r,u,ell,h)
            zb,fb=solve_stick(r,u,ell,h2)
            assert za==zb==z and dot(q,matvec(a,z))==dot(q,matvec(a2,z))==0
            assert fa[0]>0 and fb[0]>0
            max_friction_ratio=max(max_friction_ratio, abs(fa[1]/fa[0]), abs(fb[1]/fb[0]))
            constraints.append(constraint(q,z))
            force_differences+=int(fa[0]*fb[1]!=fa[1]*fb[0])
            examples+=1
    assert rank(constraints)==4
    other_r=(ell/3,-ell)
    u=(Q(1,100),Q(1,50))
    za,fa=solve_stick(other_r,u,ell,h)
    zb,fb=solve_stick(other_r,u,ell,h2)
    assert za!=zb and matvec(contact_basis(other_r,ell),za)==matvec(contact_basis(other_r,ell),zb)==u
    assert fa[1]>0 and fb[1]>0
    max_friction_ratio=max(max_friction_ratio,abs(fa[0]/fa[1]),abs(fb[0]/fb[1]))
    assert force_differences>0 and max_friction_ratio<1
    print(dict(one_face_exact_matches=examples,one_face_rank=rank(constraints),
               symmetric_parameters=6,different_virtual_force_directions=force_differences,
               max_abs_tangential_to_normal_force=str(max_friction_ratio),
               other_face_scaled_twist_1=[str(x) for x in za],other_face_scaled_twist_2=[str(x) for x in zb]))


if __name__=='__main__':
    main()
