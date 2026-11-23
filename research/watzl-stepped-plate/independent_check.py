"""Independent direct Fourier sums and raster-vector cross-check for the locked physical course."""
import json, hashlib
from pathlib import Path
from xml.etree import ElementTree as ET
import fitz,numpy as np
from scipy.io import loadmat
from author_pattern import inventory,read_numeric

def extract_pdf_raster(path):
    p=fitz.open(path)[5]
    tree=ET.fromstring(p.get_svg_image())
    paths=[e for e in tree.iter() if e.tag.endswith('path')]
    choices=[i for i,e in enumerate(paths) if e.get('fill')=='#71bf6e' and len(e.get('d',''))>20000]
    assert len(choices)==1
    transform=fitz.Matrix(20,20)
    def bitmap(e):
        source=ET.Element('svg',xmlns='http://www.w3.org/2000/svg',width='300',height='700')
        child=ET.SubElement(source,'path',**e.attrib);child.set('fill','#000000')
        doc=fitz.open('svg',ET.tostring(source));pdf=fitz.open('pdf',doc.convert_to_pdf())
        pix=pdf[0].get_pixmap(matrix=transform,clip=fitz.Rect(67,579,260,662),colorspace=fitz.csGRAY)
        return np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width),pix
    ix=choices[0];out=[]
    for e in paths[ix:ix+4]:
        img,pix=bitmap(e);out.append((img,pix))
    img,pix=out[0];blue=np.arange(pix.height)
    x=np.linspace(67.72097,258.256,301)
    yp=[]
    for xx in x:
        c=round(xx*20-.5)-pix.x
        ix=np.flatnonzero(img[:,c]<192)
        assert len(ix)>0
        yp.append(((ix[0]+ix[-1])/2+pix.y+.5)/20)
    black=[]
    for img,pix in out[1:]:
        ys=np.flatnonzero(np.any(img<128,axis=1));black.append(((ys[0]+ys[-1])/2+pix.y+.5)/20)
    # Independent nominal two-tick map, with finite 20 px/pt rasterization.
    mm=lambda y:1.68+(660.268-y)*.06/(660.268-580.198)
    return np.array([mm(v) for v in yp]),np.array([mm(v) for v in black])

def verify(data_dir, frozen, scored, output):
    f=json.loads(Path(frozen).read_bytes());s=json.loads(Path(scored).read_bytes())
    raw=Path(data_dir)/'AA7075_steps_demonstration.mat'
    assert hashlib.sha256(raw.read_bytes()).hexdigest()==f['inputs']['scan']
    mat=loadmat(raw,variable_names=['traces','t_vec'],squeeze_me=True)
    vals=mat['traces'];t=mat['t_vec'];dt=(t[-1]-t[0])/(len(t)-1)
    p=inventory()[14];windows=[read_numeric(p[k]) for k in ['win_saw','win_S1S2']]
    idx=[np.flatnonzero((t>=l)&(t<=h)) for l,h in [(2e-8,8.172554347826087e-7),(1e-5,4.5e-5)]]
    worst=sorted(set(rec['worst_i'] for k,m in s['spatial'].items() for rec in m.values()))
    cells=[];err=[]
    for i in worst:
        row=vals[i]
        v=f['rows'][i];peaks=[]
        for z,mode in enumerate([0,1,1]):
            peak=v['peaks_Hz'][z];df=1/(dt*131072)
            bins=np.arange(int(np.rint(peak/df))-2,int(np.rint(peak/df))+3)
            a=row[idx[mode]]*windows[mode];n=np.arange(len(a))
            amp=abs(np.exp((-2j*np.pi/131072)*np.outer(bins,n))@a)
            j=int(np.argmax(amp));assert 0<j<4
            left,mid,right=np.log(amp[j-1:j+2]);off=.5*(left-right)/(left-2*mid+right)
            calc=(bins[j]+off)*df;err.append(abs(calc-peak))
            peaks.append(dict(projected_peak_Hz=float(calc),bins=bins.tolist(),amplitudes=amp.tolist()))
        cells.append(dict(i=i,raw_trace_sha256=hashlib.sha256(row.astype('<f8').tobytes()).hexdigest(),n=len(row),min=float(row.min()),max=float(row.max()),rms=float(np.sqrt(np.mean(row**2))),peaks=peaks))
    green,black=extract_pdf_raster(Path(data_dir)/'author-uploaded-paper.pdf')
    de=green-np.array(s['plot']['green_mm']);db=black-np.array(s['plot']['black_mm'])
    assert max(abs(de))<.00035 and max(abs(db))<.00007 and max(err)<1.e-4,(max(abs(de)),max(abs(db)),max(err))
    rec=dict(raw_worst_cells=cells,raw_worst_positions=len(cells),max_direct_peak_disagreement_Hz=max(err),source='Independent direct 5-bin Fourier projections at original worst windows. Raster receiver isolates SVG artist and measures image coordinates at 20px/pt.',max_green_raster_difference_mm=float(max(abs(de))),worst_green_i=int(np.argmax(abs(de))),max_black_raster_difference_mm=float(max(abs(db))),black_raster_mm=black.tolist(),green_raster_mm=green.tolist())
    Path(output).write_text(json.dumps(rec,separators=(',',':'))+'\n')
    return rec
if __name__=='__main__':
    import sys
    r=verify(*sys.argv[1:]);print({k:v for k,v in r.items() if k not in ('raw_worst_cells','green_raster_mm')})
