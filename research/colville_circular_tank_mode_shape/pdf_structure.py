"""Inspect the separately published PDF's figure representation; suppress coordinates and all amplitude rows."""
import collections,hashlib,io,json,re,urllib.request
import pymupdf
URL="https://www.cambridge.org/core/services/aop-cambridge-core/content/view/D287DD0E83E77D4F81A926F1A1BCC8C3/S0022112025000163a.pdf/div-class-title-faraday-waves-and-period-tripling-in-a-horizontal-circular-tank-div.pdf"
with urllib.request.urlopen(URL,timeout=100) as f:b=f.read(8000001)
assert len(b)<=8000000 and b.startswith(b"%PDF-")
doc=pymupdf.open(stream=b,filetype="pdf");rows=[]
for page in doc:
    text=page.get_text()
    captions=[n for n in (11,15) if re.search(r"Figure\s*"+str(n)+r"\.\s*(?:Steady|Steady-state|Steadystate)",text,re.I)]
    if not captions:
        continue
    p=page.get_drawings()
    def paint(c):return ",".join(str(round(v,3)) for v in c) if c else "none"
    hist=collections.Counter((x["type"],paint(x["color"]),paint(x["fill"]),len(x["items"])) for x in p)
    rows.append({"page":page.number+1,"caption_figures":captions,"native_images":[[x[0],x[2],x[3]] for x in page.get_images()],"vector_paths":len(p),"paint_histogram":[[list(k),v] for k,v in hist.most_common(65)],"page_size_points":[page.rect.width,page.rect.height]})
print(json.dumps({"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"pages":len(doc),"figure_schemas":rows,"output_amplitude_values":0},sort_keys=True))
