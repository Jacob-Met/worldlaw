"""Score every assigned feature after removing its group's common rotational origin."""
import math
from fractions import Fraction
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
    # Only v=1,J=2 depends on the single unrestricted common source coefficient.
    # Every t shares the same remaining five losses, so this one least-squares t
    # simultaneously attains both aggregate lower bounds over the whole family.
    directions=bank["calibration"]["exact_donor_kernel"]["target_image"]
    affected=[label for label,vec in directions.items() if any(Fraction(x) for x in vec)]
    if affected!=["1/2"]:raise ValueError(("Unregistered affected groups",affected))
    label=affected[0]
    d=[float(Fraction(x)) for x in directions[label]]
    e=reports[label]["arms"]["flex_diagonal"]["residuals_kHz"]
    t=-math.fsum(x*y for x,y in zip(d,e))/math.fsum(x*x for x in d)
    for label,g in reports.items():
        row=g["arms"]["flex_diagonal"]["residuals_kHz"]
        direction=[float(Fraction(x)) for x in directions[label]]
        if len(row)!=len(direction):raise ValueError("Affine-family membership")
        err=[x+t*y for x,y in zip(row,direction)]
        loss=math.sqrt(math.fsum(x*x for x in err)/len(err))
        g["arms"]["flex_diagonal_oracle"]={"rms_kHz":loss,"residuals_kHz":err}
        programs.setdefault("flex_diagonal_oracle",[]).append(loss)
    aggregate={arm:{"mean_group_RMS_kHz":math.fsum(rs)/len(rs),"worst_group_RMS_kHz":max(rs)}
               for arm,rs in programs.items()}
    relative={arm+"/"+metric:aggregate["coupled"][metric]<aggregate[arm][metric]
              for arm in ("diagonal","sulfur_only","flex_diagonal_oracle") for metric in aggregate["coupled"]}
    absolute={"mean_within_2kHz":aggregate["coupled"]["mean_group_RMS_kHz"]<=2.,
              "worst_within_4kHz":aggregate["coupled"]["worst_group_RMS_kHz"]<=4.}
    return {"family_oracle_t_kHz":t,"groups":reports,"aggregate":aggregate,"relative":relative,"absolute":absolute,
            "joint":all(relative.values()) and all(absolute.values())}
