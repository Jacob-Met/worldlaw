"""Summarize recorded position clocks and the temperature log without reading any IR."""
import collections
import datetime
import json
from pathlib import Path
import sys
import zipfile


def acquisition(archive):
    with zipfile.ZipFile(archive) as z:
        with z.open("S1-M3969_npy/data.json") as f:
            meta=json.load(f)
    rows=[meta[f"ir_{i}"] for i in range(3969)]
    dt=datetime.datetime
    time=[dt.strptime(str(row["time"]),"%Y%m%d%H%M%S") for row in rows]
    position=[tuple(float(row["pos"][k]) for k in ("x","y","z")) for row in rows]
    axes=[sorted({round(point[axis],8) for point in position}) for axis in range(3)]
    groups=collections.defaultdict(list)
    for point,t in zip(position,time):
        groups[tuple(axis.index(round(value,8))//3 for axis,value in zip(axes,point))].append(t)
    spans=sorted((max(times)-min(times)).total_seconds() for times in groups.values())
    counts=[len(times) for times in groups.values()]
    assert len(spans)==147 and min(counts)==max(counts)==27
    temperatures=[float(meta[f"temp_{j}"]["temperature"]) for j in range(25)]
    return dict(first=min(time).isoformat(),last=max(time).isoformat(),
                seconds=(max(time)-min(time)).total_seconds(),distinct=len(set(time)),
                chronological_reversals=sum(b<a for a,b in zip(time,time[1:])),
                cube_min_median_max_s=[spans[0],spans[73],spans[-1]],
                temperature_range=[min(temperatures),max(temperatures)])


if __name__=="__main__":
    print(json.dumps(acquisition(Path(sys.argv[1])),sort_keys=True))
