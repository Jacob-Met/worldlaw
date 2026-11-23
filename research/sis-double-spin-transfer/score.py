"""Score every assigned feature after removing its group's common rotational origin."""
import math
from source import grouped_targets

def score(directory,bank):
    truth=grouped_targets(directory,"score")
    programs={}
    reports={}
    for (v,j),features in truth.items():
        label=f"{v}/{j}"
        locked=bank["features"][label]
        if locked["ids"]!=[[s.index for s in g] for g in features]:raise ValueError("Feature roster mismatch")
        raw=[g[0].frequency for g in features]
        center=math.fsum(raw)/len(raw)
        obs=[a-center for a in raw]
        reports[label]={"observations_MHz":[x/1000 for x in raw],"center_kHz":center,"centered_kHz":obs,"arms":{}}
        for arm,vector in locked["centered_kHz"].items():
            err=[p-y for p,y in zip(vector,obs)]
            loss=math.sqrt(math.fsum(e*e for e in err)/len(err))
            reports[label]["arms"][arm]={"rms_kHz":loss,"residuals_kHz":err}
            programs.setdefault(arm,[]).append(loss)
    aggregate={arm:{"mean_group_RMS_kHz":math.fsum(rs)/len(rs),"worst_group_RMS_kHz":max(rs)}
               for arm,rs in programs.items()}
    relative={arm+"/"+metric:aggregate["coupled"][metric]<aggregate[arm][metric]
              for arm in ("diagonal","sulfur_only","flex_diagonal") for metric in aggregate["coupled"]}
    absolute={"mean_within_2kHz":aggregate["coupled"]["mean_group_RMS_kHz"]<=2.,
              "worst_within_4kHz":aggregate["coupled"]["worst_group_RMS_kHz"]<=4.}
    return {"groups":reports,"aggregate":aggregate,"relative":relative,"absolute":absolute,
            "joint":all(relative.values()) and all(absolute.values())}
