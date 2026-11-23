"""Authenticate every frozen array before reading the separate 7T chamber product."""
import base64,hashlib,io,json
import numpy as np
from coil_source import ROOT,chamber
from field_modes import mm,proj
def main():
    p=json.loads((ROOT/"protocol.json").read_text())
    lock=json.loads((ROOT/"forecast_lock.json").read_text())
    raw=base64.b64decode((ROOT/"forecast_bytes.txt").read_text().strip(),validate=True)
    assert hashlib.sha256(raw).hexdigest()==lock["sha"] and len(raw)==lock["size"]
    with np.load(io.BytesIO(raw),allow_pickle=False) as kit:a={k:kit[k] for k in kit.files}
    assert set(a)==set(lock["arrays"]) and len(p["controls"])==12
    for k,z in a.items():assert [list(z.shape),hashlib.sha256(z.astype("<f8").tobytes()).hexdigest()]==lock["arrays"][k]
    P=a["predictions"];ids=a["sensor_id"].astype(int)
    assert P.shape==(12,63,3) and ids.tolist()==[i for i in range(1,65) if i!=24]
    y,source=chamber(7,json.loads((ROOT/"source_roster.json").read_text()))
    u,_=mm(a["response7"]);delta=P-y[None]
    detailed=[]
    for k,e in enumerate(delta):
        glob=np.sqrt(np.mean(e**2));each=np.sqrt(np.mean(e**2,axis=0));chip=np.sqrt(np.sum(e**2,axis=1))
        g=proj(u,e);route=int(np.argmax(chip))
        i,j=np.unravel_index(np.argmax(np.abs(e)),e.shape)
        d=dict(role=k,rmse=float(glob),axis_rmse=each.tolist(),mean_vector_error=float(chip.mean()),
               centered_rmse=float(np.sqrt(np.mean((e-e.mean(0))**2))),
               gauge_rmse=float(np.sqrt(np.mean(g**2))),observable_rmse=float(np.sqrt(np.mean((e-g)**2))),
               worst_chip=int(ids[route]),worst_chip_euclidean=float(chip[route]),worst_component=[int(ids[i]),int(j),float(e[i,j])])
        detailed.append(d)
    idx,axis=np.unravel_index(np.argmax(np.abs(delta[0])),delta.shape[1:])
    rms=np.array([row["rmse"] for row in detailed])
    allr=[i for i in range(1,len(rms)) if i!=4]
    ka=np.array([x["axis_rmse"] for x in detailed])
    win=bool(rms[0]<min(rms[allr]) and np.all(ka[0]<ka[1]) and np.all(ka[0]<ka[2]))
    print(json.dumps(dict(source=source,ids=ids.tolist(),target=y.tolist(),roles=detailed,gate=win,raw_worst=dict(id=int(ids[idx]),axis=int(axis),
       target=y[idx].tolist(),all_predicted_vectors=P[:,idx].tolist(),source_chamber=a["prior_chamber"][idx].tolist(),coil7=a["pose_intercept7"][:,idx].tolist()),
        observed_chamber_acquisitions=1,all_forecast_rows=int(np.prod(P.shape))),sort_keys=True,separators=(",",":")))
if __name__=="__main__":main()
