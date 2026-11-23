"""Offline replay from all locked forecasts and retained original-format pole coordinates."""
import math
from datetime import date,timedelta
from cold_recount import archive,read
from capacity import verify
from cross_nuisance import diagnostic,targets
def replay():
    forecasts=archive();t=targets();s=read("scores.json");rows=[]
    for y,curve in sorted(forecasts.items()):
        year=s["years"][str(y)];errors=[]
        for i,arms in enumerate(curve):
            obs=t[date(y,1,2)+timedelta(days=i)]
            errors.append([p-obs for p in arms])
        rm=[]
        for k,seq in enumerate(zip(*errors)):
            n=len(seq);r=math.sqrt(math.fsum(abs(v)**2 for v in seq)/n)
            w=max(range(n),key=lambda i:abs(seq[i]))
            assert year["worst_indices"][k]==w
            assert max(abs(r-year["rmse"][k]),abs(abs(seq[w])-year["maximum"][k]),abs(math.fsum(map(abs,seq))/n-year["mean_radial"][k]),abs(sum(seq)/n-complex(*year["bias"][k])))<1e-9
            rm.append(r)
        rows.append(rm)
    avg=[math.fsum(c)/10 for c in zip(*rows)]
    wins=[sum(v[0]<v[j] for v in rows) for j in range(8)]
    assert wins==s["wins"] and max(abs(x-y) for x,y in zip(avg,s["mean"]))<1e-9
    assert (avg[0]<min(avg[1:]) and min(wins[1:3])>=7)==s["gate"]==True
    cross=diagnostic();expect=read("crossed_result.json")
    assert max(abs(a-b) for a,b in zip(cross["average"],expect["average"]))<1e-9
    assert verify()==243
    print("3,643 held days; 58,288 scalar forecasts; all 80 role-year scores and worst indices reproduced; registered joint gate passed.")
if __name__=="__main__":replay()
