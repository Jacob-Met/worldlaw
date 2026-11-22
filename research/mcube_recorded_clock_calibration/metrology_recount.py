"""Independent streaming construction for the published two calibration channels."""
from array import array
from hashlib import sha256
from math import fsum, isclose, sqrt
from urllib.request import urlopen
import json

BASE = "https://raw.githubusercontent.com/peterkty/pnpush/c8352f5fe9a4f03aa07bf3753e04ca7898df6e1f/catkin_ws/src/pnpush_planning/time_delay/"
ROSTER = [
    ("Output_tip_tcpvicon.txt", "3ac09cea360714d92f6943b8137e899961416055105940460daf8f994ac82e5c", 3411),
    ("Output_vicon_tcpvicon.txt", "3a37f66451058c9975c1847ef66407c5a217935fa2e4f893f8fa57f72b2cd7ca", 4136),
]
MS = 1000000


def stream(spec):
    name, sha, count = spec
    with urlopen(BASE + name, timeout=30) as reply:
        buf = reply.read()
    assert sha256(buf).hexdigest() == sha
    parts = buf.split()
    assert len(parts) == 2*count
    points = [(int(parts[2*i]), float(parts[2*i+1])) for i in range(count)]
    assert all(p[0] < q[0] for p,q in zip(points, points[1:]))
    return points


def column(points, grid, lag):
    cursor = 0
    result = array("d")
    for release in grid:
        cutoff = release-lag*MS
        while cursor+1 < len(points) and points[cursor+1][0] <= cutoff:
            cursor += 1
        t,v = points[cursor]
        assert 0 <= cutoff-t <= 40*MS
        result.append(v)
    return result


def train(tip, marker, ticks, lags):
    y = column(marker,ticks,0)
    n = len(y)
    yc = fsum(y)/n
    fits = []
    for lag in lags:
        x = column(tip,ticks,lag)
        xc = fsum(x)/n
        coef = fsum((a-xc)*(b-yc) for a,b in zip(x,y))/fsum((a-xc)**2 for a in x)
        intercept = yc-coef*xc
        score = sqrt(fsum((a*coef+intercept-b)**2 for a,b in zip(x,y))/n)
        fits.append((score,abs(lag),lag,intercept,coef))
    return sorted(fits)


def main():
    tip,marker = map(stream,ROSTER)
    start = max(tip[0][0],marker[0][0])
    end = min(tip[-1][0],marker[-1][0])
    cut = (start+end)//2
    ticks = lambda a,b: range(a+290*MS,b-250*MS,4*MS)
    train_grid = ticks(start,cut)
    test_grid = ticks(cut,end)
    assert len(train_grid) == len(test_grid) == 4859
    fits = train(tip,marker,train_grid,range(-250,251,2))
    assert [f[2] for f in fits[:5]] == [-22,-24,-20,-26,-18]
    truth = column(marker,test_grid,0)
    expected = {-22:(0.39021890175382407,0.39246318397742996),0:(1.1045263766840574,1.1793951589345575)}
    predictions = {}
    for f in [fits[0],next(f for f in fits if f[2]==0)]:
        training_error,_,lag,offset,gain = f
        x = column(tip,test_grid,lag)
        pred = [offset+gain*u for u in x]
        test_error = sqrt(fsum((y-z)**2 for y,z in zip(truth,pred))/len(pred))
        assert isclose(training_error,expected[lag][0],abs_tol=1e-10)
        assert isclose(test_error,expected[lag][1],abs_tol=1e-10)
        predictions[lag] = pred
    w=max(range(len(truth)),key=lambda i:abs(truth[i]-predictions[-22][i]))
    assert test_grid[w] == 1436880734721204637
    for a,b in zip([truth[w],predictions[-22][w],predictions[0][w]],
                    [76.8646392822,75.50946253746037,77.69086542125592]):
        assert abs(a-b)<1e-9
    print(json.dumps(dict(verified=True,train_rows=len(train_grid),test_rows=len(test_grid),
                          grid_train_offsets=251,held_models=2,held_lag_selected=False,
                          raw_source_points=len(tip)+len(marker),worst_time_ns=test_grid[w])))


if __name__=="__main__":
    main()
