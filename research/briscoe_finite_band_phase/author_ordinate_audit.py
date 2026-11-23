"""Read the unmodified author Faraday conversion expressions, with no measured spectrum or saved figure output."""
import hashlib,io,json,re,urllib.request,zipfile
req=urllib.request.Request("https://researchdata.durham.ac.uk/downloads/r2x920fw90c",headers={"User-Agent":"public scientific convention audit"})
with urllib.request.urlopen(req,timeout=160) as f:b=f.read()
assert hashlib.md5(b).hexdigest()=="6873c7048302b16f2e898682cb2e2709"
z=zipfile.ZipFile(io.BytesIO(b));out=[]
for n in z.namelist():
    if not n.endswith(".ipynb") or "Faraday" not in n: continue
    for i,c in enumerate(json.loads(z.read(n))["cells"]):
        src="".join(c["source"]);lines=src.splitlines()
        for j,l in enumerate(lines):
            if re.search(r"(transmission_all\.append|data_transmission|transmission.*[-+]\s*1\b|[-+]\s*1\b.*transmi|intensity.*[-+]\s*1\b|(?:S0|filter|theory|Iy|ydata|array\[.*?\])\s*[-+]\s*1(?:\b|\.)|\b1\s*\+.*(?:intensity|transmission|filter|S0|ydata)|array\[k\]\[1\]|np\.log\()",l,re.I):
                if len(l)>500 or re.search(r"\d+\.\d{4,}",l):continue
                out.append([n.split("/")[-1],i,j,lines[max(0,j-1):j+2]])
print(json.dumps(out,sort_keys=True))
