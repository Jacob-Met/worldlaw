"""Verify frozen scores or repeat the four development simulations from the public sources."""
import argparse
import hashlib
import json
import math
import tempfile
from pathlib import Path

HERE=Path(__file__).resolve().parent
EXPECTED_SHA="f0bc8084e9650bfcdfb9004818106a9adc00e304c78ec6686c967cb785ff499a"
CASES={
    "A05_10_k0-010_F00":2500,"A05_10_k0-050_F00":1250,
    "A15_10_k0-010_F00":1913,"A15_10_k0-050_F00":1250,
}
BASE=("static","oye","MHH_Jones_quarter_pivot","MHH_Jones_direct",
      "MHH_OpenFAST_quarter_pivot","MHH_OpenFAST_direct")
def checked_recount(report):
    assert set(report["scores"])==set(CASES)
    history=[];envelope=[];rate=[]
    for case,size in CASES.items():
        scores=report["scores"][case]
        assert set(scores)=={*BASE,"history","cal_static","cal_rate"}
        for item in scores.values():
            assert item["n"]==size and 0<=item["worst"]["row"]<size
            a=item["area_observed"];b=item["area_prediction"]
            assert len(a)==len(b)>0
            assert math.isclose(item["mean_abs_paired_area_error"],
                                sum(abs(x-y) for x,y in zip(a,b))/len(a),abs_tol=1e-12)
        history.append(scores["history"]["rmse"])
        envelope.append(min(scores[m]["rmse"] for m in BASE))
        rate.append(scores["cal_rate"]["rmse"])
    gates={"mean_vs_envelope":sum(history)<=.95*sum(envelope),
           "mean_vs_rate":sum(history)<=.98*sum(rate),
           "wins":sum(x<y for x,y in zip(history,envelope)),
           "all_within_10pct":all(x<=1.1*y for x,y in zip(history,envelope))}
    assert report["gates"]==gates
    assert report["admitted"]==(gates["mean_vs_envelope"] and gates["mean_vs_rate"] and gates["wins"]>=3 and gates["all_within_10pct"])
    assert report["held_force_reads"]==0
    return gates
def compare(actual,expected,path=""):
    if isinstance(expected,dict):
        assert set(actual)==set(expected),path
        for k in expected:compare(actual[k],expected[k],path+"/"+k)
    elif isinstance(expected,list):
        assert len(actual)==len(expected),path
        for i,(x,y) in enumerate(zip(actual,expected)):compare(x,y,path+"/"+str(i))
    elif isinstance(expected,float):
        assert math.isclose(actual,expected,abs_tol=1e-8,rel_tol=1e-8),(path,actual,expected)
    else:assert actual==expected,(path,actual,expected)
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refit",action="store_true",help="Download authenticated float measurements and archived welib sources")
    args=parser.parse_args()
    raw=(HERE/"frozen-results.json").read_bytes()
    assert hashlib.sha256(raw).hexdigest()==EXPECTED_SHA
    frozen=json.loads(raw)
    print("Development gate",checked_recount(frozen),"admitted",frozen["admitted"])
    if args.refit:
        from baseline import development_streams
        from history import evaluate
        with tempfile.TemporaryDirectory(prefix="irpw-airfoil-") as tmp:
            actual=evaluate(development_streams(Path(tmp)))
        checked_recount(actual);compare(actual,frozen)
        print("Verified all 36 method–condition results, cycle integrals, worst samples and 12 fits.")
if __name__=="__main__":main()
