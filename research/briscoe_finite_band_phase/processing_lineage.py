"""Inspect released text metadata and notebook processing declarations only."""
import ast,csv,hashlib,io,json,pathlib,re,urllib.request,zipfile
URL="https://researchdata.durham.ac.uk/downloads/r2x920fw90c"
req=urllib.request.Request(URL,headers={"User-Agent":"scientific public data structures reader"})
with urllib.request.urlopen(req,timeout=150) as r:b=r.read()
assert hashlib.md5(b).hexdigest()=="6873c7048302b16f2e898682cb2e2709"
z=zipfile.ZipFile(io.BytesIO(b));out={"without_fit_csv_headers":{},"readme":[],"processing":[]}
for n in z.namelist():
    if "/Data without fit/Faraday/" in n and n.endswith(".csv"):
        with z.open(n) as f:line=f.readline(1024).decode("utf-8-sig").strip()
        if any(re.fullmatch(r"\s*[-+]?\d+\.?\d*(?:[eE][-+]?\d+)?\s*",v) for v in next(csv.reader([line]))):line="headerless_numeric_first_row; values suppressed"
        out["without_fit_csv_headers"][n.split("/Faraday/")[-1]]=line
    if n.endswith("/README.txt"):
        out["readme"]=[ln for ln in z.read(n).decode(errors="replace").splitlines() if not re.search(r"\d+\.\d",ln)]
    if not n.endswith(".ipynb") or "Faraday" not in n or "without ElecSus" in n:continue
    for i,cell in enumerate(json.loads(z.read(n))["cells"]):
        if cell["cell_type"]!="code":continue
        src="".join(cell["source"])
        lines=[]
        for l in src.splitlines():
            if len(l)>450 or l.strip().startswith("#"):continue
            if re.search(r"(read_csv\(|loadtxt\(|Data without fit|Data with fit|\.columns|\[['\"]|hilbert\(|def (elecsus_dataset|fit_Faraday|output_transmission)|binned_statistic\(|np\.interp\(|polAngle|detuning|calc_chi\(|np\.arange\()",l,re.I):
                if re.search(r"params\.add|init_param|\.set\(|print\(.*params|best_val|add_many|\.add\(|min=|max=",l):continue
                if len(re.findall(r"\d+\.\d{4,}",l))>0:continue
                lines.append(l[:360])
        if lines:out["processing"].append([n.split("/")[-1],i,lines[:28]])
print(json.dumps(out,sort_keys=True))
