"""Check the published RaSSCAL methods and modern, independent pure-gas reference states."""
import csv
import hashlib
import io
import json
import math
import zipfile
from decimal import Decimal
from urllib.parse import urlencode
from urllib.request import urlopen
from xml.etree import ElementTree as ET

def sha(b):
    return hashlib.sha256(b).hexdigest()

def fetch(url, maxbytes):
    with urlopen(url,timeout=45) as r:
        b=r.read(maxbytes+1)
    assert len(b)<=maxbytes
    return b

deck_url='https://gsa.confex.com/gsa/2018AM/webprogram/Handout/Paper321302/Hannon%202018%20GSA%20Presentation.pptx'
b=fetch(deck_url,8266775)
assert len(b)==8266775 and sha(b)=='110a3ded734db1c211807e00937250e2411cc926df2c037e775dcfb54c79ba58'
method_hashes=['5ce7385ffcc51a017d0bc9c7597a35be7b6a423da95cfacd955c04d26832be43','bed87be5146ee7693b3175fa1f19f9f56a864eda7822523372a7cdeecb9c3592','a9003da2fd04ce3a2fa34cd7491eddc5710c6bb5044dd043d8d83c475ccbc39f','c7f9096e9061117e478592372fd8c71e8a7f47222cecbfb33f304b3ab169e903','bc48e6f771d840994b4fd4430c03eebcbe1fc2bbff2b82cf2d36275b7cd77b56']
with zipfile.ZipFile(io.BytesIO(b)) as z:
    for k,expected in enumerate(method_hashes,3):
        data=z.read('ppt/slides/slide%d.xml'%k)
        assert sha(data)==expected
    root=ET.fromstring(data)
    ns={'m':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
    def project(n):
        tag=n.tag.split('}')[-1]
        if tag.endswith('Pr'):return ''
        if tag=='t':return n.text or ''
        inner=''.join(project(child) for child in n)
        if tag in ('r','oMathPara','oMath','e'):return inner
        return '['+tag+' '+inner+']'
    math_text=[project(m) for m in root.findall('.//m:oMath',ns)]
    assert '[den [sSub 𝑍[sub 𝑑]]𝐴]' in math_text[0]
    assert len(math_text)==5
print(json.dumps({'method_deck_sha256':sha(b),'method_slides':[3,4,5,6,7],'outcome_slides_opened':0,'slide7_equations':math_text},ensure_ascii=False),flush=True)

for name,cas in [('helium','C7440597'),('methane','C74828')]:
    params={'Action':'Data','Wide':'on','ID':cas,'Type':'IsoTherm','T':'300','PLow':'0.9','PHigh':'20.1','PInc':'0.05','Digits':'10','TUnit':'K','PUnit':'MPa','DUnit':'kg/m3','HUnit':'kJ/kg','WUnit':'m/s','VisUnit':'uPa*s','STUnit':'N/m','RefState':'DEF'}
    raw=fetch('https://webbook.nist.gov/cgi/fluid.cgi?'+urlencode(params),500000)
    first=raw.splitlines()[0].decode(errors='replace')[:420]
    print(json.dumps({'gas':name,'reference_srd69_bytes':len(raw),'sha256':sha(raw),'header':first}),flush=True)
    reader=csv.DictReader(io.StringIO(raw.decode()),delimiter='\t');fields=reader.fieldnames or []
    def col(prefix):
        matches=[x for x in fields if x.startswith(prefix)]
        assert len(matches)==1,(prefix,fields)
        return matches[0]
    p,rho,cv,cp,w=map(col,['Pressure (MPa)','Density (kg/m3)','Cv (','Cp (','Sound Spd. (m/s)'])
    assert cv.split(' ',1)[1]==cp.split(' ',1)[1],(cv,cp)
    rows={Decimal(r[p]):r for r in reader}
    result=[]
    for target in map(Decimal,['1','5','10','20']):
        row=rows[target];density=float(row[rho]);speed=float(row[w])
        kappa_pa=float(row[cp])/float(row[cv])/(density*speed**2)
        assert kappa_pa>0
        slopes=[]
        for h in map(Decimal,['0.1','0.05']):
            slopes.append((float(rows[target+h][rho])-float(rows[target-h][rho]))/(2e6*float(h)*density))
        ratio=1/(float(target)*1e6*kappa_pa)
        rel=abs(slopes[-1]/kappa_pa-1)
        result.append(dict(pressure_MPa=float(target),rho_kg_m3=density,cp_over_cv=float(row[cp])/float(row[cv]),sound_m_s=speed,storage_Pkappa=float(target)*1e6*kappa_pa,exact_mass_balance_over_slide_pressure_slope=ratio,two_central_pressure_difference_relative_errors=[abs(v/kappa_pa-1) for v in slopes]))
        assert rel<2e-4,(name,str(target),rel)
    print(json.dumps({'gas':name,'temperature_K':300,'modern_reference_only':True,'conditional_states':result,'core_rows_opened':0,'gas_switch_order_verified':False,'common_downstream_volume_verified':False}),flush=True)
