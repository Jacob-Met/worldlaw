"""42 source measurements only. Produce all 21 x 8 locked joint RMS predictions."""
import json
import math
from concurrent.futures import ThreadPoolExecutor
from acquire import receive, get_index

def forecasts(low,middle):
    n=len(low); av=math.fsum(low)/n;bv=math.fsum(middle)/n
    slope=math.fsum((a-av)*(b-bv) for a,b in zip(low,middle))/math.fsum((a-av)**2 for a in low)
    gain=math.fsum(a*b for a,b in zip(low,middle))/math.fsum(a*a for a in low)
    assert min(low)>0
    return [[4*b,b,2*b,0.0,b*b/a,gain*b,max(0.0,3*b-2*a),max(0.0,bv+slope*(b-av))] for a,b in zip(low,middle)]

def main():
    index=get_index()
    rows=[r for group in index["triads"] for r in group[:2]]
    assert len(rows)==42 and {r["bias"] for r in rows}=={100,200}
    with ThreadPoolExecutor(3) as pool:
        source=list(pool.map(lambda r: receive(r,index),rows))
    low=[r["full"]["joint"] for r in source[::2]];mid=[r["full"]["joint"] for r in source[1::2]]
    print("SOURCE",json.dumps(source,allow_nan=False,separators=(",",":")),flush=True)
    print("FORECAST",json.dumps(forecasts(low,mid),allow_nan=False,separators=(",",":")),flush=True)
if __name__=="__main__":main()
