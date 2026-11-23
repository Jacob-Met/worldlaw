"""Render the development Figure 11 only. No Figure 15 raster pixels are decoded."""
import base64,hashlib,json,urllib.request
import pymupdf
with urllib.request.urlopen("https://www.cambridge.org/core/services/aop-cambridge-core/content/view/D287DD0E83E77D4F81A926F1A1BCC8C3/S0022112025000163a.pdf/div-class-title-faraday-waves-and-period-tripling-in-a-horizontal-circular-tank-div.pdf",timeout=90) as f:b=f.read()
assert hashlib.sha256(b).hexdigest()=="feb7fae7eeb196abeb81b2282c2ec70d3de6b3fda7528c7c01486e5ebbf504cf"
doc=pymupdf.open(stream=b,filetype="pdf");page=doc[15]
assert [(x[0],x[2],x[3]) for x in page.get_images()]==[(706,652,509)]
im=doc.extract_image(706)
print(json.dumps({"figure":11,"fill":.3,"ext":im["ext"],"n":len(im["image"]),"sha":hashlib.sha256(im["image"]).hexdigest(),"base64":base64.b64encode(im["image"]).decode()}))
