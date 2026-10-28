"""Plot the frozen authored observation-operator result; do not rerun the solver."""
from pathlib import Path
import hashlib
import json
import math
import os
os.environ.setdefault('MPLCONFIGDIR','/tmp/hamon-7bb49db0-matplotlib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

root = Path(__file__).resolve().parent
raw = (root / 'results.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == '9f6e85ca341d1f188545bc10cd0d5a0da4a39ff03caf9e944f65160a0782e79a'
receipt = json.loads(raw)
groups = receipt['results']
center = next(g for g in groups if g['gridIntervals'] == 4096 and g['convention'] == 'center')
end = next(g for g in groups if g['gridIntervals'] == 4096 and g['convention'] == 'end')
convergence = [g for g in groups if g['convention'] == 'center']
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':'#273747','text.color':'#172b3a','axes.edgecolor':'#9aa7b0','xtick.color':'#405665','ytick.color':'#405665','svg.fonttype':'none'})
fig = plt.figure(figsize=(12,8.8), facecolor='white')
grid = fig.add_gridspec(1,2,width_ratios=[1.8,1],left=.075,right=.97,bottom=.43,top=.78,wspace=.30)
ax = fig.add_subplot(grid[0,0])
t = np.linspace(0,.5,2049)
ax.plot(t,np.cos(8*math.pi*t),color='#344956',lw=1.6,label='Instantaneous angle: independent analytic reference')
for group,color,marker,label in [(center,'#147d92','o','Declared average, center timestamp'),(end,'#ca6939','s','Same declared average, end timestamp')]:
    rows = [r for r in group['rows'] if r['reportedTime'] <= .5]
    ax.plot([r['reportedTime'] for r in rows],[r['observedAverage'] for r in rows],marker=marker,ms=4.3,lw=.7,color=color,mfc='white',label=label)
ax.set(xlim=(0,.5),ylim=(-1.15,1.15),xlabel='Declared reporting time (s)',ylabel='Angle (rad)')
ax.set_title('Same motion; different declared readout',loc='left',fontweight='bold',pad=28)
ax.grid(axis='y',color='#e8edf0',lw=.8)
fig.legend(*ax.get_legend_handles_labels(),loc='upper left',bbox_to_anchor=(.07,.335),frameon=False,fontsize=8.2,handlelength=2.5)
ax.text(.01,1.018,'First 0.5 s shown; scores use all 61 windows per convention.',transform=ax.transAxes,fontsize=8.5,color='#536c7c')

ax2 = fig.add_subplot(grid[0,1])
n = np.array([g['gridIntervals'] for g in convergence])
err = np.array([g['averageRMSE'] for g in convergence])
ax2.loglog(n,err,'o-',color='#147d92',lw=1.7,ms=6,label='Averaged forecast versus analytic readings')
ax2.loglog(n,err[0]*(n[0]/n)**2,'--',color='#8a9aa5',lw=1.2,label='Second-order reference, anchored at 256')
ax2.set_xticks(n,labels=['256','1,024','4,096'])
ax2.set(xlabel='Complete prediction-grid intervals',ylabel='Interval-average RMSE (rad)',ylim=(1e-6,1e-3))
ax2.grid(which='major',color='#e8edf0',lw=.8)
ax2.set_title('Numerical averaging refines',loc='left',fontweight='bold',pad=28)
fig.legend(*ax2.get_legend_handles_labels(),loc='upper left',bbox_to_anchor=(.685,.335),frameon=False,fontsize=8,handlelength=2.4)

fig.text(.075,.945,'The readout operation changes the comparison',fontsize=21,fontweight='bold')
fig.text(.075,.895,'Authored 4 Hz angle sensor  |  Declared window: 0.0625 s  |  Independent point initial state',fontsize=11,color='#536c7c')
fig.text(.075,.22,'Finest grid: unchanged law, no fitting, all 61 original windows',fontsize=10,fontweight='bold')
metrics=[(.075,'Point comparison: center timestamp',f"{center['pointRMSE']:.6f} rad"),(.39,'Point comparison: end timestamp',f"{end['pointRMSE']:.6f} rad"),(.705,'Declared interval average: either',r'$1.95745\times10^{-6}$ rad')]
for x,label,value in metrics:
    fig.text(x,.17,label,fontsize=9,color='#536c7c')
    fig.text(x,.12,value,fontsize=19,color='#147d92' if x>.7 else '#344956',fontweight='bold')
fig.text(.075,.055,'Authored measurement model only. No physical exposure metadata is admitted. Refinement is not a certified error bound.',fontsize=8.8,color='#536c7c')
fig.savefig(root/'figure-exposure.png',dpi=180)
fig.savefig(root/'figure-exposure.svg')
payload={'resultsSHA256':hashlib.sha256(raw).hexdigest(),'plottedWindow':[0,.5],'scoreRowsPerConvention':61,'center':center,'end':end,'convergence':[{k:v for k,v in g.items() if k!='rows'} for g in convergence],'independentAnalyticCurve':'cos(8*pi*t), 0<=t<=0.5; visual reference only'}
(root/'figure-exposure-data.json').write_text(json.dumps(payload,indent=2)+'\n')
print(json.dumps({'png':str(root/'figure-exposure.png'),'svg':str(root/'figure-exposure.svg'),'inputResultsSHA256':hashlib.sha256(raw).hexdigest()}))
