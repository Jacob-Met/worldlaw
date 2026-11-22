"""Read measured axial/uncertainty cells at physical PDF coordinates and recount every arm."""
import hashlib
import json
import math
from pathlib import Path
import statistics
import subprocess
import sys
import xml.etree.ElementTree as ET


def sumabs(values):
    return sum(abs(x) for x in values)


def words(pdf, page):
    out=subprocess.check_output(["pdftotext","-bbox","-f",str(page),"-l",str(page),str(pdf),"-"])
    return [(w.text, (float(w.get("xMin")) + float(w.get("xMax"))) / 2, float(w.get("yMin")))
            for w in ET.fromstring(out).iter() if w.tag.split("}")[-1]=="word"]


def number(s):
    try:
        return float(s.strip("*"))
    except (ValueError,TypeError):
        return None


def check(root, prediction, score):
    correct = {"rate_rows":0,"physical_cells":0,"absent_force_rows":0,"point_errors":0,"envelope_endpoints":0}
    # Physical column intervals in PDF points, independently located from the
    # final row on each table page. Rate, measured force, combined uncertainty.
    page_meta = {"2490/0":(71,(74,100),(239,279),(281,320)),
                 "2490/25":(72,(87,114),(254,300),(302,341)),
                 "2490/50":(73,(70,105),(235,277),(280,318)),
                 "2491/0":(66,(124,159),(357,419),(420,480)),
                 "2491/25":(67,(124,159),(354,416),(417,478)),
                 "2491/50":(68,(124,159),(348,412),(413,475))}
    arms=tuple(score["overall"])
    cohorts={}
    for key,(page,rate_col,force_col,unc_col) in page_meta.items():
        mat=key.split("/")[0]
        path=root/(mat+"-primary.pdf")
        w=words(path,page)
        vals=[];flags=[];std=[];masks=[]
        forecast=prediction[key];original=score["cohorts"][key]
        first=forecast["rates"][0]
        top=[y for s,x,y in w if rate_col[0]<x<rate_col[1] and number(s)==first]
        assert len(top)==1
        for rate in forecast["rates"]:
            yy=[y for s,x,y in w if y>=top[0]-1 and rate_col[0]<x<rate_col[1] and number(s)==rate]
            if len(yy)!=1:
                raise ValueError((key,rate,"rate coordinate",yy))
            local=[(s,x) for s,x,y in w if abs(y-yy[0])<3 and number(s) is not None]
            cells=[[s for s,x in local if a<x<b] for a,b in (force_col,unc_col)]
            if [len(c) for c in cells] not in ([0,0],[1,1]):
                raise ValueError((key,rate,"cell geometry",cells))
            masks.append(bool(cells[0]))
            if cells[0]:
                vals.append(number(cells[0][0]));std.append(number(cells[1][0]))
                flags.append(cells[0][0].endswith("*"))
                correct["physical_cells"]+=2
            else:
                correct["absent_force_rows"]+=1
            correct["rate_rows"]+=1
        assert masks==forecast["reported_force"] and vals==original["measured"]
        assert flags==original["reference_only"] and std==original["standard_uncertainty"]
        active={a:[x for x,k in zip(forecast[a],masks) if k] for a in (*arms,"conditional_lower","conditional_upper")}
        assert all(active[a]==original["predictions"][a] for a in active)
        scores={}
        for a in arms:
            errs=[abs(x-y) for x,y in zip(active[a],vals)]
            scores[a]=sum(errs)/sumabs(vals)
            assert math.isclose(scores[a],original["nmae"][a],rel_tol=2e-12)
            reduced=sum(e for e,f in zip(errs,flags) if not f)/sumabs(y for y,f in zip(vals,flags) if not f)
            assert math.isclose(reduced,original["nmae_excluding_reference_diagnostic"][a],rel_tol=2e-12)
            correct["point_errors"]+=len(vals)
        low,high=active["conditional_lower"],active["conditional_upper"]
        cover=sum(l<=v<=h for l,v,h in zip(low,vals,high))/len(vals)
        width=sum(h-l for l,h in zip(low,high))/sumabs(vals)
        assert original["range_coverage"]==cover and math.isclose(original["range_normalized_width"],width,rel_tol=2e-12)
        correct["envelope_endpoints"]+=2*len(vals)
        cohorts[key]=scores
    for a in arms:
        c=[v[a] for v in cohorts.values()]
        assert math.isclose(statistics.mean(c),score["overall"][a]["equal_course_nmae"],rel_tol=2e-12)
        assert math.isclose(max(c),score["overall"][a]["worst_course_nmae"],rel_tol=2e-12)
    return correct


if __name__=="__main__":
    root, pred, score = map(Path,sys.argv[1:])
    for path,expected in [(pred,"79f8b00d5fe394b318c368ffe26d381f739a8b160b7a5065590792509934dc66"),
                          (score,"8fa135cd2f12981a63da419d16e14ef0b49c3e2290f3819afa9ac110135b7080")]:
        assert hashlib.sha256(path.read_bytes()).hexdigest()==expected
    print(json.dumps(check(root,json.loads(pred.read_bytes()),json.loads(score.read_bytes())),sort_keys=True))
