"""Qualify the pinned author's GCTPLS entry using synthetic arrays only."""
import argparse
import hashlib
from pathlib import Path
import subprocess
import sys

COMMIT="f11e224dd0e4dc3975555be54af6b7a9ae7b8819"
PINS={"diPLSlib/models.py":"bd7efaa95dc714beb8cc336c4814a3adb4b12af5",
      "diPLSlib/functions.py":"343581f7ca0264b8650bb6ee9003762c93847d84"}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repository",type=Path)
    args=parser.parse_args()
    root=args.repository.resolve()
    assert subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()==COMMIT
    for path,expected in PINS.items():
        assert subprocess.check_output(["git","hash-object",path],cwd=root,text=True).strip()==expected
    sys.path.insert(0,str(root))
    import numpy as np
    import diPLSlib.models as models
    assert Path(models.__file__).resolve()==root/"diPLSlib/models.py"
    rng=np.random.default_rng(182386)
    X=rng.normal(size=(60,20))
    y=X[:,0]-0.7*X[:,3]+X[:,7]**2/10
    xs=rng.normal(size=(3,20))
    xt=1.02*xs+0.1
    query=rng.normal(size=(8,20))
    m=models.GCTPLS(A=3,l=10,rescale="Source")
    m.fit(X,y,xs,xt)
    prediction=m.predict(query)
    assert prediction.size==8 and np.isfinite(prediction).all()
    try:m.fit(X,y,xs,np.vstack((xt,xt[0])))
    except ValueError as e:
        assert "number of samples" in str(e)
    else:raise ValueError("unmatched standards accepted")
    print("synthetic prediction SHA-256",hashlib.sha256(np.asarray(prediction,dtype="<f8").tobytes()).hexdigest())
    print("training scores",m.T_.shape,"unmatched-count check passed")


if __name__=="__main__":main()
