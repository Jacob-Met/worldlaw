"""Check interval composition, limiting cases and frozen source-template reconstruction."""
import json
import numpy as np
from scipy.integrate import solve_ivp
from torque_flow import flow,interval_drive
import wind_transfer as w

def direct():
    b=w.DRAG/w.INERTIA
    specs=[('positive_accelerating',20.,12.,1.4),('positive_decelerating',250.,12.,1.4),
           ('positive_from_rest',0.,12.,1.4),('unforced',100.,0.,1.4),('unforced_rest',0.,0.,1.4),
           ('negative_active',100.,-12.,1.4),('negative_hits_stop',10.,-12.,1.4),('negative_at_stop',0.,-12.,1.4),
           ('equilibrium',100.,b*100**2,1.4),('near_equilibrium',100.,b*100**2*(1+1e-12),1.4),
           ('tiny_positive',100.,1e-24,1.4),('tiny_negative',100.,-1e-24,1.4),
           ('zero_time',100.,-1000.,0.)]
    out=[]
    for name,v,drive,dt in specs:
        end=float(flow(v,drive,dt,b))
        f=float(flow(flow(v,drive,dt*.37,b),drive,dt*.63,b))
        if v==0 and drive<=0 or dt==0:ref=v
        else:
            def stop(t,y):return y[0]
            stop.terminal=True;stop.direction=-1
            sol=solve_ivp(lambda t,y: [drive-b*y[0]**2],(0,dt),[v],rtol=1.e-12,atol=1.e-13,
                          method='DOP853',events=stop)
            if not sol.success:raise RuntimeError(sol.message)
            ref=0. if len(sol.t_events[0]) else sol.y[0,-1]
        if abs(end-ref)>2.e-10 or abs(f-end)>2.e-11:raise ValueError(name)
        recovered=None
        if v>0 and end>0 and dt>0:
            recovered=float(interval_drive(np.array(v),np.array(end),np.array(dt),b))
            if abs(recovered-drive)>1.e-10:raise ValueError('inverse '+name)
        out.append({'case':name,'end_rad_s':end,'composition_error':abs(f-end),'ode_error':abs(ref-end),
                    'recovered_drive':recovered})
    return out

def source():
    u,y=w.panel('0.5');u=u[:4000];y=y[:4000]
    h=u[:,0,3];values=np.unique(h)
    dt=w.interp_profiles(h,np.diff(u[:,:,0]),values)[:,4:]
    mid=w.interp_profiles(h,y[:,:5,0].mean(1)[:,None],values)/w.RPM
    traj=mid+w.interp_profiles(h,w.centered(y)[:,:,0],values)/w.RPM
    row4_shift=float(np.max(np.abs(traj[:,4]-mid[:,0]))*w.RPM)
    start=traj[:,4:-1].copy();start[:,0]=mid[:,0]
    end=traj[:,5:];b=w.DRAG/w.INERTIA
    drives=interval_drive(start,end,dt,b)
    v=mid[:,0];maximum=0.
    for j in range(45):
        v=flow(v,drives[:,j],dt[:,j],b)
        maximum=max(maximum,float(np.max(np.abs(v-end[:,j]))))
    if maximum>2e-10:raise ValueError('full source trajectory')
    return {'distinct_training_hatch_positions':len(values),'source_intervals':int(drives.size),
            'max_original_row4_deviation_from_declared_initial_mean_rpm':row4_shift,
            'first_high_step_reconstruction_max_rpm':float(np.max(np.abs(flow(mid[:,0],drives[:,0],dt[:,0],b)-end[:,0]))*w.RPM),
            'full_trajectory_max_error_rad_s':maximum,'full_trajectory_max_error_rpm':maximum*w.RPM,
            'interval_drive_range_rad_s2':[float(drives.min()),float(drives.max())]}
if __name__=='__main__':print(json.dumps({'analytic_tests':direct(),'source':source()},indent=2))
