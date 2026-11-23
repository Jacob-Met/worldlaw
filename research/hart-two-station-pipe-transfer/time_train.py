"""One immutable complete calibration programme, excluding all Test 3 members."""
import sys,json,hashlib,zipfile
from pathlib import Path
import numpy as np
from transport import checked,roster,keys
from time_model import loadrun,physics,error
def train(root,programme,dest):
    assert programme in (1,2,4)
    idx=roster(checked(root,'index.xlsx'));records={}
    with zipfile.ZipFile(checked(root,'unsteady.zip')) as z:
        for key,name in sorted(keys(z,idx).items()):
            if key[0]!=programme:continue
            r=loadrun(z,name,key,idx[key],True)
            scores=[[float(np.mean(error(r,y))) for y in bank] for bank in physics(r)]
            records[str(key[1])]=dict(cell=r['cell'],losses=scores,
                 calibration_sha=hashlib.sha256(r['yfull'].tobytes()).hexdigest())
    assert len(records)=={1:75,2:75,4:65}[programme]
    Path(dest).write_text(json.dumps(records,sort_keys=True,allow_nan=False)+'\n')
    print('complete calibration',programme,len(records))
if __name__=='__main__':train(sys.argv[1],int(sys.argv[2]),sys.argv[3])
