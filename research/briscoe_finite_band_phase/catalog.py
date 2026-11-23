"""List the original archive and software dependencies without opening any measured scan or saved notebook output."""
import ast,hashlib,io,json,re,urllib.request,zipfile
url="https://researchdata.durham.ac.uk/downloads/r2x920fw90c"
req=urllib.request.Request(url,headers={"User-Agent":"scientific public data catalog reader"})
with urllib.request.urlopen(req,timeout=120) as response:b=response.read()
assert len(b)==107468871 and hashlib.md5(b).hexdigest()=="6873c7048302b16f2e898682cb2e2709"
out={"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"members":[],"notebooks":[],"measured_scans_read":0}
with zipfile.ZipFile(io.BytesIO(b)) as z:
    for m in z.infolist():
        if m.filename.startswith("__MACOSX/"):continue
        out["members"].append([m.filename,m.file_size,m.CRC])
        if m.filename.lower().endswith(".ipynb"):
            nb=json.loads(z.read(m.filename))
            mods=set();defs=set();ops=set();aliases=set()
            for cell in nb["cells"]:
                if cell["cell_type"]!="code":continue
                src="".join(cell["source"])
                for ln in src.splitlines():
                    if re.match(r"\s*(from |import )",ln):mods.add(ln.strip().split("#")[0][:220])
                    if re.match(r"\s*def \w+",ln):defs.add(re.search(r"def (\w+)",ln).group(1))
                    for name in re.findall(r"\b(?:read_csv|loadtxt|load|read_excel|curve_fit|hilbert|calculate|fit_data|wofz|interp1d|lowess|polyfit|fft|fsolve)\b",ln):ops.add(name)
            out["notebooks"].append({"name":m.filename,"imports":sorted(mods),"functions":sorted(defs),"markers":sorted(ops),"saved_outputs_not_reported":True})
print(json.dumps(out,sort_keys=True))
