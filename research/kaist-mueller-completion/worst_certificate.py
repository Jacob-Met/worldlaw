"""Certify the worst raw IQU block's infeasibility using exact IEEE input values."""
from fractions import Fraction
import json
import math
from pathlib import Path
import sys
import numpy as np


def certify(receipt):
    _,material,w=receipt["worst"]
    a=[[Fraction(x) for x in row] for row in w["source_linear_block"]]
    scale=4*a[0][0]
    # In the input-first Choi representation the top-left minor has no VV term.
    c00=(a[0][0]+a[0][1]+a[1][0]+a[1][1])/scale
    c11=(a[0][0]+a[0][1]-a[1][0]-a[1][1])/scale
    c01=(a[2][0]+a[2][1])/scale
    determinant=c00*c11-c01*c01
    if determinant>=0:
        raise ValueError("the registered raw worst does not have this certificate")
    eig=np.linalg.eigvalsh(np.array([[c00,c01],[c01,c11]],dtype=float))
    # Full numerical spectra merely describe three examples. The exact principal
    # minor above proves infeasibility for every real value of VV.
    eye=np.eye(2);q=np.diag([1.,-1.]);u=np.array([[0.,1.],[1.,0.]])
    v=np.array([[0.,-1j],[1j,0.]])
    pauli=(eye,q,u)
    norm=np.array(a,dtype=float)/float(a[0][0])
    h0=sum(norm[i,j]*np.kron(pauli[j].T,pauli[i])/4 for i in range(3) for j in range(3))
    k=np.kron(v.T,v).real/4
    if np.any(k[:2,:2]) or not np.allclose(h0[:2,:2],np.array([[c00,c01],[c01,c11]],float)):
        raise ValueError("independent Pauli convention mismatch")
    spectra={}
    for name,value in [("measured",w["measured_VV"]),("candidate",w["predictions"]["candidate"]),("unprojected",w["predictions"]["unprojected_residual"])]:
        spectra[name]=np.linalg.eigvalsh(h0+k*value/float(a[0][0])).tolist()
    return {"material":material,"coordinates":w["index"],"raw_IQU":w["source_linear_block"],
            "measured_VV":w["measured_VV"],"predictions":w["predictions"],
            "candidate_branch":"direct fallback after empty interval","minor_indices":[0,1],
            "normalized_minor_rationals":[str(c00),str(c01),str(c11)],
            "minor_determinant_exact":str(determinant),"minor_determinant_approx":float(determinant),
            "minor_numerical_eigenvalues":eig.tolist(),"example_full_eigenvalues":spectra}


if __name__=="__main__":
    print(json.dumps(certify(json.loads(Path(sys.argv[1]).read_text())),sort_keys=True,allow_nan=False))
