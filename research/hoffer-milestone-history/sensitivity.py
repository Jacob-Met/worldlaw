"""Conditional paired loss bounds for the known missing/unbound counts."""
import json
from pathlib import Path
import sys

def bounds(result):
    names=result["arms"]
    h=names.index("history64")
    groups=sorted(name for name in result["cohorts"] if name.startswith("Hairpin "))
    output={}
    for j,other in enumerate(names):
        if j==h:continue
        per={}
        for group in groups:
            cells=[r for r in result["rows"] if r["key"][0]==group]
            low=[];high=[]
            for c in cells:
                delta=c["arm_sum"][h]-c["arm_sum"][j]
                k=c["unknown"];n=c["observed"]+k
                low.append((delta-k)/n);high.append((delta+k)/n)
            per[group]=[sum(low)/len(low),sum(high)/len(high)]
        # For the difference of two maxima, the min and max over paired
        # cohort differences bound it. These bounds need not be sharp.
        output[other]={"cohorts":per,
                       "mean":[sum(p[k] for p in per.values())/len(per) for k in (0,1)],
                       "worst_difference_outer":[min(p[0] for p in per.values()),max(p[1] for p in per.values())]}
    return output
if __name__=="__main__":
    print(json.dumps(bounds(json.loads(Path(sys.argv[1]).read_text())),sort_keys=True))
