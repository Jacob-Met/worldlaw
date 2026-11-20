"""Identify compatible optical laws from a supplied recorded subset at a frozen reading budget."""
import argparse
import hashlib
import itertools
import json
from fractions import Fraction
from pathlib import Path
import zipfile

import numpy as np

from chamber_calibration import ARCHIVE_MD5, load_rows

LAWS = ("relative", "sum", "first_only", "second_only")
SCALE = 10000
LOW = Fraction(4, 5)
HIGH = Fraction(6, 5)


def rounded(values):
    return np.floor(np.asarray(values) * SCALE + .5).astype(np.int64)


def basis(angles):
    t = np.deg2rad(np.asarray(angles))
    a, b = t.T
    return rounded(np.cos(np.column_stack((a-b, a+b, a, b)))**2)


def survivors(values, design, ticks, eps):
    """Eliminate a single shared offset. Each row pair then constrains the same positive gain."""
    fits = []
    for col, name in enumerate(LAWS):
        lo, hi = LOW, HIGH
        valid = True
        for i, j in itertools.combinations(ticks, 2):
            dx = int(design[i,col] - design[j,col])
            dy = int(values[i] - values[j])
            if dx == 0:
                if abs(dy) > 2*eps:
                    valid = False
                    break
                continue
            a, b = Fraction(dy-2*eps, dx), Fraction(dy+2*eps, dx)
            lo, hi = max(lo,min(a,b)), min(hi,max(a,b))
            if lo > hi:
                valid = False
                break
        if valid:
            fits.append(name)
    return fits


def d_optimal(design, k):
    # Matched law-aware comparison using regularized information volume.
    raw = np.column_stack((np.ones(len(design)), 2*design/SCALE-1))
    mat = np.eye(raw.shape[1])
    chosen = []
    for _ in range(k):
        remaining = [i for i in range(len(raw)) if i not in chosen]
        row = max(remaining, key=lambda i: float(raw[i] @ np.linalg.solve(mat,raw[i])))
        mat += np.outer(raw[row],raw[row])
        chosen.append(row)
    return sorted(chosen)


def heldout_errors(y, f, gold, future, ticks):
    a = f[ticks,0]/SCALE
    scale = a.var()
    gain = 1. if scale == 0 else np.clip(np.mean((a-a.mean())*(y[ticks]-y[ticks].mean()))/scale,.8,1.2)
    offset = y[ticks].mean()-gain*a.mean()
    return float(np.sqrt(np.mean((gold - (offset+gain*future[:,0]/SCALE))**2)))


def file_sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def run(archive, source, frozen, expected):
    if file_sha(frozen) != expected:
        raise ValueError("frozen schedule differs")
    with archive.open("rb") as stream:
        if hashlib.file_digest(stream,"md5").hexdigest()!=ARCHIVE_MD5:
            raise ValueError("source archive differs")
    data=json.loads(source.read_bytes()); plans=json.loads(frozen.read_bytes())
    if file_sha(source) != plans["inputSha"] or set(plans["panels"]) != set(data["target_commands"]) or len(plans["panels"]) != 8:
        raise ValueError("frozen command and schedule census mismatch")
    outcomes={}
    with zipfile.ZipFile(archive) as z:
        for key, rounds in plans["panels"].items():
            color, brightness=key.split("_")
            if brightness not in ("64","255") or len(rounds)!=20:
                raise ValueError("held brightness or block census differs")
            rows=load_rows(z,key)
            p=np.asarray(data["target_commands"][key])
            observed=np.asarray([[float(row["pol_1"]),float(row["pol_2"])] for row in rows])
            if p.shape!=(1000,2) or p.shape!=observed.shape or np.max(np.abs(p-observed))>1e-5:
                raise ValueError(f"physical command replay mismatch on {key}")
            raw=np.asarray([float(row["ir_3"]) for row in rows])
            photometer_scale=data["development"][color]["slope"]*(int(brightness)/128)
            y=raw/photometer_scale
            values=rounded(y)
            eps=int(rounded(data["development"][color]["noise"]))
            f=basis(p)
            blocks=[]
            for i,r in enumerate(rounds):
                start=i*50
                if r["sourceStart"] != start or r["block"]!=i:
                    raise ValueError("illegal source interval")
                certified=r["status"]=="optimal_certified_schedule"
                k=len(r["selected"]) if certified else 6
                if not 1<=k<=6:
                    raise ValueError("invalid reading budget")
                panel=f[start:start+10]
                vals=values[start:start+10]
                chosen=tuple(v-1 for v in r["selected"])
                if any(t<0 or t>=10 for t in chosen) or len(chosen)!=len(set(chosen)):
                    raise ValueError("invalid frozen selection")
                cert=survivors(vals,panel,chosen,eps) if certified else None
                geom=d_optimal(panel,k)
                chronological=tuple(range(k))
                uniform=[survivors(vals,panel,s,eps)==["relative"] for s in itertools.combinations(range(10),k)]
                row=dict(block=i,certified=certified,budget=k,selected=r["selected"],active_compatible=cert,
                         active_readings=[int(vals[index]) for index in chosen], active_success=cert==["relative"],d_optimal_success=survivors(vals,panel,geom,eps)==["relative"],
                         chronological_success=survivors(vals,panel,chronological,eps)==["relative"],
                         uniform_expected_success=float(np.mean(uniform)))
                if certified:
                    row["active_held40_known_relative_nrmse"]=heldout_errors(y[start:start+10],panel,y[start+10:start+50],f[start+10:start+50],list(chosen))
                blocks.append(row)
            outcomes[key]=blocks
    summary={}
    for k,bs in outcomes.items():
        summary[k]={key:float(np.mean([b[key] for b in bs])) for key in
                    ("active_success","d_optimal_success","chronological_success","uniform_expected_success","budget","certified")}
    rng=np.random.default_rng(830)
    draws=rng.integers(0,8,size=(10000,8))
    comparison={}
    for control in ("d_optimal_success","chronological_success","uniform_expected_success"):
        delta=np.asarray([v["active_success"]-v[control] for v in summary.values()])
        comparison[control]=dict(delta=float(delta.mean()),bootstrap_ci95=np.quantile(delta[draws].mean(1),[.025,.975]).tolist(),
                                 settings_improved=int((delta>0).sum()))
    wrong_singletons=sum(1 for blocks in outcomes.values() for row in blocks
                         if row["active_compatible"] and row["active_compatible"]!=["relative"])
    passed=(wrong_singletons==0 and all(v["delta"]>=.05 and v["bootstrap_ci95"][0]>0
                                        for v in comparison.values()))
    return dict(schema="worldlaw.causal-chambers-acquisition.v1",frozen_sha256=expected,recordings=outcomes,
                by_setting=summary,paired=comparison,wrong_identifications=wrong_singletons,passed=passed,physical_actions_performed=False)


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    for arg in ("archive","source","plans","out"):p.add_argument("--"+arg,type=Path,required=True)
    p.add_argument("--plans-sha",required=True)
    a=p.parse_args()
    if a.out.exists():raise FileExistsError(a.out)
    r=run(a.archive,a.source,a.plans,a.plans_sha)
    a.out.write_text(json.dumps(r,indent=2,allow_nan=False)+"\n")
    print(json.dumps({"by_setting":r["by_setting"],"paired":r["paired"],"passed":r["passed"]}))
