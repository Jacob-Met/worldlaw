"""Bind every required annual public file and clock before selecting any signal value."""
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from source_clocks import address,C04,inventory
KINDS=("AAM","OAM","HAM","SLAM")
def main():
    plan=[(k,y,address(k,y)) for y in range(2003,2025) for k in KINDS]+[("C04",0,C04)]
    def pull(spec):
        k,y,url=spec
        r=inventory(k,url)
        if k=="C04":
            assert r["sha256"]=="c17ba033b94de0b227250cad22f5ae41cfe03af4a049d46efa66b47872a42e27"
        else:
            start=(date(y,1,1)-date(1858,11,17)).days
            nextday=(date(y+1,1,1)-date(1858,11,17)).days
            fast=k in ("AAM","OAM")
            n=(nextday-start)*(8 if fast else 1)
            step=0.125 if fast else 1.0
            assert (r["first"],r["count"],r["steps"])==(start+(0 if fast else 0.5),n,{step:n-1})
            assert r["field_counts"]=={8 if k=="SLAM" else 11:n}
        return [k,y,r["url"],r["bytes"],r["sha256"],r["first"],r["last"],r["count"]]
    with ThreadPoolExecutor(4) as pool:
        for v in pool.map(pull,plan):print("PIN",json.dumps(v),flush=True)
    print("All89 source files authenticated and dates qualified; signal columns parsed zero.")
if __name__=="__main__":main()
