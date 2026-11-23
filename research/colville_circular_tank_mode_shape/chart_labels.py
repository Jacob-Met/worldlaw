"""Read the PDF text layer around the two chart axes and legends without decoding held chart pixels."""
import hashlib,json,urllib.request
import pymupdf
with urllib.request.urlopen("https://www.cambridge.org/core/services/aop-cambridge-core/content/view/D287DD0E83E77D4F81A926F1A1BCC8C3/S0022112025000163a.pdf/div-class-title-faraday-waves-and-period-tripling-in-a-horizontal-circular-tank-div.pdf",timeout=90) as stream: pdf=stream.read()
assert hashlib.sha256(pdf).hexdigest()=="feb7fae7eeb196abeb81b2282c2ec70d3de6b3fda7528c7c01486e5ebbf504cf"
doc=pymupdf.open(stream=pdf,filetype="pdf");charts=[]
for page_i,obj in [(15,706),(18,723)]:
    page=doc[page_i];bounds=page.get_image_rects(obj);assert len(bounds)==1
    box=bounds[0];ex=box+(-33,-12,17,27);labels=[]
    for w in page.get_text("words",clip=ex):
        x,y=(w[0]+w[2])/2,(w[1]+w[3])/2
        labels.append([str(w[4]),round((x-box.x0)/box.width,5),round((y-box.y0)/box.height,5)])
    charts.append({"xref":obj,"bbox":list(box),"labels":labels})
print(json.dumps({"pdf_sha":hashlib.sha256(pdf).hexdigest(),"charts":charts,"held_chart_pixel_decodes":0},sort_keys=True))
