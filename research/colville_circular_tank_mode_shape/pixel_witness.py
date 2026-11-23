"""Original JPEG marks at the fixed candidate worsts and sole source dropout."""
import io,json
import numpy as np
import pymupdf
from PIL import Image
from printed_forecast import read,chart,pdf_bytes
reg=read("printed-protocol.json");score=read("score.json");g,h,w,labels,valid,pal,sha=chart(reg,"held")
doc=pymupdf.open(stream=pdf_bytes(reg["source"]["pdf_url"],reg["source"]["pdf_sha256"]),filetype="pdf")
rgb=np.asarray(Image.open(io.BytesIO(doc.extract_image(g["xref"])["image"])).convert("RGB"))
xs=g["fx_lo"]+((np.arange(w)+.5)/w-g["px_lo"])*(g["fx_hi"]-g["fx_lo"])/(g["px_hi"]-g["px_lo"])
out=[]
for ch,k in [(1,score["rows"][0]["each_worst_bin"][0]),(2,score["rows"][1]["each_worst_bin"][0]),(2,15)]:
    row=score["rows"][ch-1]["cases"][k];f=row["f_over_fstar"];cc=np.where((xs>=f-.0005)&(xs<f+.0005))[0]
    yy,jj=np.nonzero((labels[:,cc]==ch)&valid[:,cc]);assert len(yy)==row["colored_pixels"]
    out.append({"fill":score["rows"][ch-1]["fill"],"jpeg_sha":sha,"bin":k,"columns":cc.tolist(),
                "pixels_xy_RGB":[[int(cc[j]),int(y),rgb[y,cc[j]].tolist()] for y,j in zip(yy,jj)],
                "same_bin":row,"neighbors":score["rows"][ch-1]["cases"][max(0,k-2):min(41,k+3)]})
print(json.dumps({"scope":"archival postscore printed pixels","witnesses":out},sort_keys=True))
