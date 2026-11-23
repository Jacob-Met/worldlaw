"""Read only public program source and workflow text. Never load spectrum or fit tables."""
import hashlib,io,json,pathlib,subprocess,urllib.request,zipfile
root="https://zenodo.org/records/6757550/files/"
def public(name,sha):
    req=urllib.request.Request(root+name+"?download=1",headers={"User-Agent":"public scientific software qualification"})
    with urllib.request.urlopen(req,timeout=75) as response:b=response.read()
    assert hashlib.sha256(b).hexdigest()==sha
    return b
z=zipfile.ZipFile(io.BytesIO(public("codes.zip","469765e8b4a08a47525c0326351ae2dfdc45000073369e04d22f81acaf6d8796")))
out={}
for name in z.namelist():
    if "__MACOSX" in name or not name.endswith((".c",".m")):continue
    b=z.read(name)
    out[name]={"sha256":hashlib.sha256(b).hexdigest(),"source":b.decode("latin1")}
flow=public("flowchart.pdf","82f37070eb3c09021e575e311e074d6d3f0a8bf34aa192793a19e617c53f3f6d")
p=subprocess.run(["pdftotext","-layout","-","-"],input=flow,capture_output=True,check=True)
print(json.dumps({"software":out,"workflow":p.stdout.decode("utf8")},sort_keys=True))
