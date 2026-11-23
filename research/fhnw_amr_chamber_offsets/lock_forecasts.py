"""Lock every 7T chamber forecast before the separate measured target is opened."""
import base64,hashlib,io,json
import numpy as np
from coil_source import ROOT,SENSORS,read_coils,chamber
from field_modes import modes
def main():
    r=json.loads((ROOT/"source_roster.json").read_text())
    a3,c3,m3,l3=read_coils(3,r);z3,zrec=chamber(3,r)
    a7,c7,m7,l7=read_coils(7,r)
    if l3["ids"]!=l7["ids"]:raise ValueError("different campaign channel registry")
    preds,meta=modes(c3,m3,c7,m7,z3)
    assets=dict(sensor_id=SENSORS.astype(float)+1,levels3=a3,levels7=a7,pose_intercept3=c3,pose_intercept7=c7,response3=m3,response7=m7,prior_chamber=z3,predictions=preds)
    if preds.shape!=(12,63,3) or not all(np.all(np.isfinite(x)) for x in assets.values()):raise ValueError("forecast census")
    buf=io.BytesIO();np.savez_compressed(buf,**assets);data=buf.getvalue()
    sha=lambda x:hashlib.sha256(x).hexdigest()
    print("LOCK "+json.dumps(dict(sha=sha(data),size=len(data),arrays={k:[list(x.shape),sha(x.astype("<f8").tobytes())] for k,x in assets.items()},source3=l3,source7=l7,chamber3=zrec,fit=meta,held7_rows=0),sort_keys=True,separators=(",",":")),flush=True)
    for k in range(0,len(data),24000):print("PACK "+str(k)+" "+base64.b64encode(data[k:k+24000]).decode(),flush=True)
if __name__=="__main__":main()
