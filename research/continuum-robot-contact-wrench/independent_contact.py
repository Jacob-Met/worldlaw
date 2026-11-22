"""Independent receipt for the Toronto instrument and all locked whole-path/contact scores."""
import csv
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile
import numpy as np
from scipy.signal import butter, sosfiltfilt

CASE_ORDER=['push_retract','plane_y_contact_midway','plane_y_poke_x','plane_y_poke_y']
MODELS=['source_adjoint','mount','uniform_102g','uniform_101_27g','component_101_27g','linear','nonlinear']
DATA='1255612e370d447ef55105c9b843136c891f00a0dd6817da47484f343ab5a29c'


def lp(t,arr):
    uniform=np.linspace(t[0],t[-1],len(t))
    fs=(len(t)-1)/(t[-1]-t[0])
    sos=butter(4,2,'low',fs=fs,output='sos')
    return np.stack([sosfiltfilt(sos,np.interp(uniform,t,col),padlen=12) for col in arr.T],axis=1)


def observed(z,run,n):
    path='data/contact_motion/'+run+'/processed/'+n+'.csv'
    with z.open(path) as f:
        return np.array(list(csv.reader(io.TextIOWrapper(f,'utf-8'))),dtype=float)


def rotations(euler):
    a,b,c=euler.T
    ca,cb,cc,sa,sb,sc=np.cos(a),np.cos(b),np.cos(c),np.sin(a),np.sin(b),np.sin(c)
    return np.stack([cb*cc,-cb*sc,sb,sa*sb*cc+ca*sc,-sa*sb*sc+ca*cc,-sa*cb,
                     -ca*sb*cc+sa*sc,ca*sb*sc+sa*cc,ca*cb],axis=1).reshape(-1,3,3)


def receive(source,locked_dir,report):
    def check(x,y,tol=4e-9):
        if not np.allclose(x,y,rtol=2e-10,atol=tol):raise ValueError('Independent source or score differs')
    with open(source,'rb') as f:
        assert hashlib.file_digest(f,'sha256').hexdigest()==DATA
    ledger=json.loads((locked_dir/'lock.json').read_text())
    assert hashlib.sha256((locked_dir/'lock.json').read_bytes()).hexdigest()==report['lock_sha256']
    for n,sha in ledger['sha256'].items():
        assert hashlib.sha256((locked_dir/n).read_bytes()).hexdigest()==sha
    assert list(ledger['arms'])==MODELS and list(ledger['held'])==CASE_ORDER
    samples={}; score_groups=0;counts=0; geometry=0; biggest=0
    with ZipFile(source) as z,np.load(locked_dir/'locked.npz',allow_pickle=False) as lock:
        for run in CASE_ORDER:
            ati=observed(z,run,'base_wrench');pose=observed(z,run,'contact_pose')
            wand=observed(z,run,'contact_wrench');p=observed(z,run,'mocap_frames')
            t=ati[:,0]
            assert all(np.array_equal(a,t) for a in (pose[:,0],wand[:,0],p[:,0],lock[run+'_t']))
            p=p[:,1:].reshape(-1,5,6)[:,:,3:]
            assert np.array_equal(p,lock[run+'_positions']) and np.array_equal(pose[:,1:],lock[run+'_wand_pose'])
            y=lp(t,ati[:,1:]);pred=lock[run+'_forecasts'];samples[run]=len(t)
            R=rotations(pose[:,1:4]);f=-np.einsum('nij,nj->ni',R,wand[:,1:4])
            m=-np.einsum('nij,nj->ni',R,wand[:,4:7])+np.cross(pose[:,4:7],f)
            adj=lp(t,np.column_stack((f,m)));check(adj,pred[:,0,:])
            mount=ledger['mount'];cal=adj.copy()
            cal[:,3:]+=np.cross(mount['delta_m'],adj[:,:3])+mount['offset_Nm']
            check(cal,pred[:,1,:])
            displacements=p-np.mean(p[:100],axis=0)
            # Integrate the interpolated source point-mass locations through explicit tracked-disk weights.
            w=np.array([41.22+1.70+2.625,5.25+1.70+5.25,5.25+1.70+5.25,
                        5.25+1.70+5.25,8.90+1.70+2.625])
            trapezoid=np.array([1,2,2,2,1])/8.
            for j,weights in enumerate((.102*trapezoid,.10127*trapezoid,(w+5.90*trapezoid)/1000),2):
                mpos=np.einsum('nsd,s->nd',displacements,weights)
                torque=np.column_stack((mpos[:,1]*9.81,-mpos[:,0]*9.81,np.zeros(len(t))))
                rec=cal.copy();rec[:,3:]+=lp(t,torque)
                biggest=max(biggest,float(np.max(np.abs(rec-pred[:,j,:]))))
                check(rec,pred[:,j,:]);geometry+=len(t)
            masks={'whole':np.ones(len(t),bool)}
            if run=='push_retract':
                masks['contact']=np.sqrt(((p[:,-1]-pose[:,4:7])**2).sum(1))<.05
                assert np.array_equal(masks['contact'],lock[run+'_mask'])
            for label,mask in masks.items():
                ids=np.where(mask)[0]
                for i,name in enumerate(MODELS):
                    r=report['records'][run][label][name]
                    err=pred[ids,i]-y[ids]
                    sq=err[:,3]**2+err[:,4]**2
                    j=int(np.argmax(sq));idx=int(ids[j])
                    assert len(ids)==r['rows'] and idx==r['worst_row']
                    check([np.sqrt(sq.mean()),np.sqrt(sq[j]),t[idx]], [r['rms_planar_Nm'],r['peak_planar_Nm'],r['worst_time_s']])
                    check(np.sqrt(np.mean(err**2,axis=0)),r['component_rmse']);check(y[idx],r['worst_actual'])
                    check(pred[idx,i],r['worst_predicted']);score_groups+=1;counts+=len(ids)
        primary=report['records']['push_retract']['whole']
        for key in ('rms_planar_Nm','peak_planar_Nm'):
            assert report['gates'][key]==all(primary[MODELS[4]][key]<primary[n][key] for n in MODELS if n!=MODELS[4])
        assert report['joint']==all(report['gates'].values())
    return {'independent':True,'source_sha256':DATA,'cases':samples,'arm_subset_groups':score_groups,
            'arm_window_rows':counts,'component_predictions_reconstructed':geometry*6,
            'largest_reconstructed_component_difference':biggest,'joint':report['joint']}
