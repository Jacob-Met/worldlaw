"""Verify immutable original frequencies, forecast bytes, residuals, gates and raw worst rows offline."""
import hashlib,json,math,pathlib,sys
from predict import forecasts
from score import score
def main(root):
    def get(n):return json.loads((root/n).read_bytes())
    raw=(root/"forecasts.json").read_bytes();lock=get("forecast-lock.json")
    if len(raw)!=lock["bytes"] or hashlib.sha256(raw).hexdigest()!=lock["sha256"]:raise ValueError("forecast identity differs")
    a=json.loads(raw);s=get("scores.json");w=get("worst-cases.json");ind=get("independent-receipt.json")
    if ind["forecast"]!=lock["sha256"] or ind["residuals"]!=180 or ind["forecast_cells"]!=180:raise ValueError("independent census")
    src={k:{int(p):v for p,v in rows.items()} for k,rows in a["projected_inputs"].items()};t={int(p):v for p,v in s["targets"].items()}
    for n,p,f in [("primary",[1,3,5,8,10,15,20],128),("paper_range",[5,8,10,15,20],100)]:
        v=forecasts(src,p,f)
        for x,y in zip(v["rows"],a[n]["rows"],strict=True):
            if x["pressure"]!=y["pressure"] or set(x["forecast"])!=set(y["forecast"]):raise ValueError("forecast roster")
            if any(abs(x["forecast"][k]-z)>2e-9 for k,z in y["forecast"].items()):raise ValueError("forecast value")
        sc=score(a[n],t)
        if sc["gate"] or s[n]["gate"] or sc["pressures"]!=s[n]["pressures"]:raise ValueError("registered result")
        for k,m in sc["metrics"].items():
            if m["worst"]!=s[n]["metrics"][k]["worst"] or m["candidate_strict_wins"]!=s[n]["metrics"][k]["candidate_strict_wins"]:raise ValueError("witness")
            if any(abs(m[z]-s[n]["metrics"][k][z])>2e-9 for z in ["rmse","mae","worst_signed"]):raise ValueError("score")
            if any(abs(j-i)>2e-9 for i,j in zip(sc["signed_errors"][k],s[n]["signed_errors"][k],strict=True)):raise ValueError("residual")
        k="calibrated_constrained";worst=sc["metrics"][k]["worst"];ii=p.index(worst)
        if w[n]["pressure"]!=worst or w[n]["target"]!=t[worst] or w[n]["all_role_forecasts"]!=a[n]["rows"][ii]["forecast"]:raise ValueError("published whole row")
    print("Verified 180 stored forecasts and residuals, both negative gates, 30 role scores and two complete worst-pressure forecasts.")
if __name__=="__main__":main(pathlib.Path(sys.argv[1] if len(sys.argv)>1 else "."))
