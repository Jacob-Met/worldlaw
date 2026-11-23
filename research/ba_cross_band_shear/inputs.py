"""Return only the frozen projected inputs; the target is a separate explicit reader."""
import hashlib,math,re
from source_schema import original_members,sheets,NS,cell_text
PRESSURES=(1,3,5,8,10,15,20)
FREQUENCIES=(1,2,4,8,10,16,32,64,100,128)
HASHES={"Seismic_Brine":"b85e6c25a780b29a83718e9c1291d833ea990c2669073af486481fec29042db6","Seismic_Gas":"89a49d1f75b8f5b33f54e12593b0ad767d9ac34a9eb89bb614780679211b80b1","Ultrasonic_Brine":"fc25308c90b24bed9890b6e69527bea609d016d170de12500034d5d0e319c04b","Ultrasonic_Gas":"cc597bce5579936c911c2cd4d5cf164a11dc606b516f9846da4d48777d3230c3"}
def text(c,ss):
    value=cell_text(c,ss)
    if value is not None:return value.strip()
    v=c.find(NS+"v")
    return v.text.strip() if v is not None and v.text is not None else ""
def positive(c,ss):
    assert c.find(NS+"f") is None
    x=float(text(c,ss));assert math.isfinite(x) and x>0
    return x
def tables():
    found={}
    for path,data in original_members():
        if not path.endswith(".xlsx"):continue
        key=path.removeprefix("Data/Sample D_").removesuffix(".xlsx")
        assert key not in found and hashlib.sha256(data).hexdigest()==HASHES[key]
        sheet,=sheets(data);name,rows,ss=sheet
        assert name=="xl/worksheets/sheet1.xml"
        table=[]
        for i,r in enumerate(rows,1):
            assert int(r.get("r"))==i
            table.append({re.match(r"[A-Z]+",c.get("r"))[0]:c for c in r.findall(NS+"c")})
        islow=key.startswith("Seismic")
        assert sorted(table[0])==list("ABCD" if islow else "ABC")
        assert [text(table[0][c],ss) for c in sorted(table[0])]==(["Pressure","Frequency","Pwave","Swave"] if islow else ["Pressure","Pwave","Swave"])
        found[key]=(table[1:],ss)
    assert set(found)==set(HASHES)
    return found
def projected():
    inp={};all_tables=tables()
    for k,(rows,ss) in all_tables.items():
        rec={}
        if k.startswith("Seismic"):
            assert len(rows)==70
            for i,p in enumerate(PRESSURES):
                arr=[]
                for j,f in enumerate(FREQUENCIES):
                    row=rows[10*i+j]
                    assert text(row["A"],ss)==(str(p)+"MPa" if j==0 else "")
                    assert positive(row["B"],ss)==f
                    arr.append([f,positive(row["C"],ss),positive(row["D"],ss)])
                rec[p]=arr
        else:
            assert len(rows)==(8 if k.endswith("Brine") else 7)
            if k.endswith("Brine"):
                assert set(rows[7])=={"C"} and all(rows[7]["C"].find(NS+n) is None for n in ("v","is","f"))
            for p,r in zip(PRESSURES,rows):
                assert positive(r["A"],ss)==p
                rec[p]=[positive(r["B"],ss)]
                if k.endswith("Gas"):rec[p].append(positive(r["C"],ss))
        inp[k]=rec
    return inp
def seven_targets():
    rows,ss=tables()["Ultrasonic_Brine"]
    assert len(rows)==8
    return {p:positive(r["C"],ss) for p,r in zip(PRESSURES,rows) if positive(r["A"],ss)==p}
