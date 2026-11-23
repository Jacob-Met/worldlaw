"""Read the held figure only after authenticating a pretarget forecast; extract vector geometry."""
from pathlib import Path
import hashlib,itertools,json,collections
import fitz
import numpy as np

ROOT=Path(__file__).resolve().parent
SHA=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def oracle(figure):
    figure=Path(figure)
    assert SHA(figure)=='396500bcbd214bdbe8ce86153c904bcdc93d8fa42263111cfdbda0c49f4d87de'
    doc=fitz.open(figure);d=doc[5].get_drawings()
    x0,x1=[(d[i]['rect'].x0+d[i]['rect'].x1)/2 for i in (310,311)]
    ticks=np.array([(d[i]['rect'].y0+d[i]['rect'].y1)/2 for i in range(312,316)])
    labels=np.array([1.68,1.70,1.72,1.74])
    slope,offset=np.polyfit(ticks,labels,1);convert=lambda y:float(slope*y+offset)
    calerr=max(abs(slope*ticks+offset-labels))
    targets=[];boxes=[]
    for idx,n in zip([341,342,343],[4,9,4]):
        v=d[idx];assert tuple(v['fill'])==(0.,0.,0.) and len(v['items'])==n
        vals=np.array([[s[1].y0,s[1].y1] for s in v['items'] if s[0]=='re'])
        assert len(vals)==n and max(np.ptp(vals,axis=0))<.002
        y=vals.mean();targets.append(convert(y))
        boxes.append([convert(vals.max())-calerr,convert(vals.min())+calerr])
    g=d[340];assert len(g['items'])==1069 and tuple(g['fill'])==tuple(d[310]['fill'])
    # Exact intersections with the outline of the green filled path.
    segs=[]
    for kind,*vs in g['items']:
        assert kind in ('l','c')
        xy=np.array([[p.x,p.y] for p in vs])
        segs.append((kind,xy,xy[:,0].min(),xy[:,0].max()))
    green=[];gbox=[]
    for x in np.linspace(x0,x1,301):
        yy=[]
        for kind,xy,lo,hi in segs:
            if x<lo or x>hi:continue
            if kind=='l':
                a,b=xy
                if a[0]==b[0]:
                    if abs(x-a[0])<1.e-8:yy.extend(xy[:,1])
                else:yy.append(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]))
            else:
                a,b,c,e=xy
                coeff=np.array([e-3*c+3*b-a,3*(a-2*b+c),3*(b-a),a])
                xx=coeff[:,0].copy();xx[-1]-=x
                for t in np.roots(xx):
                    if abs(t.imag)<1e-8 and -1.e-9<=t.real<=1+1.e-9:
                        yy.append(float(np.polyval(coeff[:,1],t.real)))
        if not yy:raise ValueError(('green gap',x))
        green.append(convert((max(yy)+min(yy))/2))
        gbox.append([convert(max(yy))-calerr,convert(min(yy))+calerr])
    return dict(x_axis=[x0,x1],y_ticks=ticks.tolist(),y_labels_mm=labels.tolist(),axis_err_mm=float(calerr),
                black_mm=targets,black_box_mm=boxes,green_mm=green,green_box_mm=gbox)
PAIRS=[(1,0),(2,1),(2,0)]
def contrasts(levels):
    return np.array([levels[i]-levels[j] for i,j in PAIRS])
def contrast_bounds(bounds):
    return np.array([[bounds[i][0]-bounds[j][1],bounds[i][1]-bounds[j][0]] for i,j in PAIRS])
def abs_bounds(delta):
    lo,hi=delta.T
    return np.column_stack([np.maximum.reduce([lo,-hi,lo*0]),np.maximum(-lo,hi)])
def run(forecast,figure):
    p=Path(forecast)
    f=json.loads(p.read_bytes());rows=f['rows'];assert len(rows)==301
    o=oracle(figure);u=np.arange(301)/300
    cores=[np.flatnonzero((u>=a)&(u<=b)) for a,b in [(.04,.18),(.42,.58),(.84,.96)]]
    transitions=[np.flatnonzero((u>=a)&(u<=b)) for a,b in [(.20,.36),(.64,.82)]]
    methods={k:np.array([r['log_h'][k] for r in rows],dtype=float) for k in rows[0]['log_h']}
    methods['published_green']=np.log(o['green_mm'])
    true=np.log(o['black_mm']);ref=contrasts(true);ref_box=contrast_bounds(np.log(o['black_box_mm']))
    scores={};spatial={}
    for k,a in methods.items():
        med=np.array([np.median(a[ind]) for ind in cores])
        hz=np.log(o['green_box_mm']) if k=='published_green' else np.column_stack([a,a])
        mins=np.array([np.median(hz[idx],axis=0) for idx in cores])
        predicted=contrasts(med);pred_box=contrast_bounds(mins)
        errors=predicted-ref;erbox=abs_bounds(np.column_stack((pred_box[:,0]-ref_box[:,1],pred_box[:,1]-ref_box[:,0])))
        scores[k]=dict(log_plateau_medians=med.tolist(),contrasts=predicted.tolist(),residuals=errors.tolist(),
                       rms_log=float(np.linalg.norm(errors)/np.sqrt(3)),worst_log=float(max(abs(errors))),
                       rms_box=np.sqrt(np.mean(erbox**2,axis=0)).tolist(),worst_box=np.max(erbox,axis=0).tolist())
        y=a-med[1];truth=true-true[1]
        rec={}
        for n,idx in enumerate(cores):
            err=y[idx]-truth[n];w=int(np.argmax(np.abs(err)))
            rec['core_'+str(n)]=dict(n=len(idx),indices=idx.tolist(),contrast_error=err.tolist(),worst_i=int(idx[w]),worst_signed=float(err[w]))
        for n,idx in enumerate(transitions):
            low,high=sorted(truth[n:n+2]);est=y[idx];outside=np.maximum.reduce([low-est,est-high,est*0]);w=int(np.argmax(outside))
            rec['transition_'+str(n)]=dict(n=len(idx),indices=idx.tolist(),errors_to_adjacent_levels=np.column_stack([est-truth[n],est-truth[n+1]]).tolist(),
                                          outside_bracket=outside.tolist(),worst_i=int(idx[w]),worst_outside=float(outside[w]))
        spatial[k]=rec
    a=scores['joint'];others=[k for k in scores if k not in ('joint','published_green')]
    allref=[k for k in scores if k!='joint']
    checks=dict(full_core_coverage=all(np.isfinite(methods[k][np.concatenate(cores)]).all() for k in methods),
                rms_green=a['rms_log']<.90*scores['published_green']['rms_log'],
                rms_other=all(a['rms_log']<.95*scores[k]['rms_log'] for k in others),
                worst=all(a['worst_log']<=scores[k]['worst_log'] for k in allref),
                stroke_green=a['rms_box'][1]<.90*scores['published_green']['rms_box'][0],
                stroke_other=all(a['rms_box'][1]<.95*scores[k]['rms_box'][0] for k in others),
                stroke_worst=all(a['worst_box'][1]<=scores[k]['worst_box'][0] for k in allref))
    return dict(forecast_sha256=SHA(p),plot=o,truth_log_contrasts=ref.tolist(),
                counts={'cores':[len(x) for x in cores],'transition':[len(x) for x in transitions]},
                scores=scores,spatial=spatial,gates={k:bool(v) for k,v in checks.items()},all_pass=bool(all(checks.values())))
