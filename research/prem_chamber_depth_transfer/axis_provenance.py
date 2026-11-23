"""Read optical-constant headers and acquisition axes; never interpret an emissivity cell."""
import hashlib,io,json,re,struct,urllib.request,zipfile,xml.etree.ElementTree as E,html
from html.parser import HTMLParser
from urllib.parse import urljoin
def grab(url):
    req=urllib.request.Request(url,headers={"User-Agent":"scientific public metadata reader"})
    with urllib.request.urlopen(req,timeout=45) as f:return f.read()
def h(b):return hashlib.sha256(b).hexdigest()
root="https://zenodo.org/records/6757550/files/"
z=zipfile.ZipFile(io.BytesIO(grab(root+"codes.zip?download=1")))
import scipy.io as sio
print("OPTICAL",json.dumps({n:sio.whosmat(io.BytesIO(z.read(n))) for n in z.namelist() if n.endswith(".mat") and "__MACOSX" not in n}),flush=True)
b=grab(root+"lab_spectra.xlsx?download=1")
assert h(b)=="56738a7ff6a99469282dbd982d0289c212106704178a9b73784a153bd92450ac"
ns="{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
with zipfile.ZipFile(io.BytesIO(b)) as x:
    surf={}
    for s in [1,2,3]:
        ax={c:[] for c in ["A","E","I"]}
        for _,v in E.iterparse(x.open("xl/worksheets/sheet%d.xml"%s),events=("end",)):
            if v.tag!=ns+"c":continue
            col,num=re.fullmatch(r"([A-Z]+)([0-9]+)",v.get("r")).groups()
            if col in ax and int(num)>=4 and v.findtext(ns+"v") is not None and v.get("t") not in ["s","str"]:ax[col].append(float(v.findtext(ns+"v")))
            v.clear()
        surf[s]={k:{"n":len(a),"lo":min(a),"hi":max(a),"increasing":all(a[i]<a[i+1] for i in range(len(a)-1)),"decreasing":all(a[i]>a[i+1] for i in range(len(a)-1))} for k,a in ax.items()}
print("AXES",json.dumps(surf,sort_keys=True),flush=True)
base="https://commons.library.stonybrook.edu/geodata/7/"
class Links(HTMLParser):
    def __init__(self):super().__init__();self.url=None;self.txt=[];self.rows=[]
    def handle_starttag(self,tag,attrs):
        if tag=="a":self.url=dict(attrs).get("href");self.txt=[]
    def handle_data(self,d):
        if self.url:self.txt.append(d)
    def handle_endtag(self,tag):
        if tag=="a" and self.url:self.rows.append(("".join(self.txt),urljoin(base,self.url)));self.url=None
p=Links();p.feed(grab(base).decode("utf8"))
files={k.strip():u for k,u in p.rows if k.strip().endswith(".xlsx")}
print("STONYBROOK",json.dumps(files),flush=True)
for name,url in files.items():
    if not name.startswith(("AmbientSilicate","SLESilicate")):continue
    b=grab(url)
    with zipfile.ZipFile(io.BytesIO(b)) as x:
        sheets=[v.get("name") for v in E.fromstring(x.read("xl/workbook.xml")).find(ns+"sheets")]
        lookup=[]
        if "xl/sharedStrings.xml" in x.namelist():lookup=["".join(y.text or "" for y in a.iter(ns+"t")) for a in E.fromstring(x.read("xl/sharedStrings.xml"))]
        print("PAIRED_ORIGINAL",json.dumps({"name":name,"url":url,"n":len(b),"sha":h(b),"sheets":sheets,"textOnly":lookup[:140]}),flush=True)
