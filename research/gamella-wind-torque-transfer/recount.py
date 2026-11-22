"""Independent score implementation, using only original CSV rows and locked NPZs."""
import argparse
import csv
import hashlib
import json
import math
import zipfile
from decimal import Decimal
from pathlib import Path

import numpy as np

ROLES = ('persistence','author_draw','author_centered','middle_template','squared_speed',
         'walk_additive','walk_coupled','walk_plus_template','torque_transfer',
         'torque_exact_forward','torque_calibrated_flow')
DUTIES = ('0.01', '1')

def file_sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read_panel(source, duty):
    name = f'wt_intake_impulse_v1/load_out_{duty}_osr_downwind_4.csv'
    from io import TextIOWrapper
    with zipfile.ZipFile(source) as archive, archive.open(name) as stream:
        rows = csv.DictReader(TextIOWrapper(stream,encoding='utf-8'))
        truth = np.empty((5000,50,2),dtype=np.float64)
        commands = np.empty((5000,50,4),dtype=np.float64)
        count=0
        for n,row in enumerate(rows):
            flag,offset=divmod(n,50)
            declared=Decimal(row['flag'])
            if not declared.is_finite() or declared!=flag or flag>=5000:raise ValueError('wrong flag')
            truth[flag,offset]=float(row['rpm_out']),float(row['pressure_downwind'])
            commands[flag,offset]=[float(row[k]) for k in ('timestamp','load_in','load_out','hatch')]
            count+=1
    if count!=250000 or not np.isfinite(truth).all():raise ValueError('incomplete truth')
    return truth,commands

def close(a,b):
    if not np.allclose(a,b,rtol=2.e-10,atol=2.e-8):raise ValueError(('mismatch',a,b))

def main(out,lock_hash,scores_path):
    reg=out/'prediction-lock.json'
    if file_sha(reg)!=lock_hash:raise ValueError('registry SHA')
    lock=json.loads(reg.read_text())
    if file_sha(Path('impulse.zip'))!='d4dec2de1fcf255c08a0da1290e73adbfbea09272a43dbcb58e96a448ef6b748':
        raise ValueError('original impulse SHA')
    report=json.loads(scores_path.read_text())
    if report['lock_sha256']!=lock_hash or set(report['duty'])!=set(DUTIES):raise ValueError('score provenance')
    paired_wins={};endpoints=0;maxima=0;gate=True
    for m in DUTIES:
        archive=out/f'forecasts-{m}.npz'
        if file_sha(archive)!=lock['predictions'][m]['archive_sha256']:raise ValueError('archive')
        actual,u=read_panel(Path('impulse.zip'),m)
        ref=report['duty'][m]
        if set(ref['scores'])!=set(ROLES):raise ValueError('score roster')
        with np.load(archive,allow_pickle=False) as data:
            if tuple(data.files)!=ROLES:raise ValueError('array roster')
            trial_loss={};overall={};all_worst=[]
            for role in ROLES:
                a=data[role];digest=hashlib.sha256(a.tobytes(order='C')).hexdigest()
                if digest!=lock['predictions'][m]['array_sha256'][role]:raise ValueError(role)
                rows=[]
                for k in range(2):
                    observed=actual[:,5:,k]
                    delta=a[:,:,k].astype(np.float64)-observed
                    sq=np.square(delta)
                    event=np.sum(sq,axis=1)/45
                    rms=math.sqrt(math.fsum(event)/5000)
                    mae=math.fsum(np.abs(delta).sum(1))/225000
                    hi=math.sqrt(math.fsum(sq[:,:20].sum(1))/100000)
                    lo=math.sqrt(math.fsum(sq[:,20:].sum(1))/125000)
                    for key,value in [('rmse',rms),('mae',mae),('high_rmse',hi),('recovery_rmse',lo)]:
                        close(value,ref['scores'][role][key][k]);endpoints+=1
                    maxima_by_flag=np.max(np.abs(delta),axis=1)
                    f=int(np.argmax(maxima_by_flag));j=int(np.argmax(np.abs(delta[f])))
                    worst=ref['scores'][role]['max_abs'][k]
                    if (worst['flag'],worst['row'])!=(f,j+5):raise ValueError('worst index')
                    close([worst['truth'],worst['pred'],worst['abs_error']],[observed[f,j],a[f,j,k],abs(delta[f,j])])
                    maxima+=1
                    if role==ROLES[-1]:all_worst.append((f,j,k))
                    rows.append(event)
                trial_loss[role]=np.stack(rows,axis=1);overall[role]=trial_loss[role].sum(0)
            w={r:(trial_loss[ROLES[-1]]<trial_loss[r]).sum(0).tolist() for r in ROLES[:-1]}
            if w!=ref['candidate_event_wins']:raise ValueError('event pair counts')
            for original,(f,j,k) in zip(ref['worst'],all_worst,strict=True):
                if original['flag']!=f or original['row']!=j+5:raise ValueError('raw case flag')
                close(actual[f],original['observed_rpm_pa']);close(u[f],original['actuators_and_time'])
                for r in ROLES:close(data[r][f,j],original['locked_predictions_at_row'][r])
            won=all(np.all(overall[ROLES[-1]]<overall[r]) for r in ROLES[:-1])
            if bool(won)!=ref['gate']:raise ValueError('duty gate')
            gate=gate and bool(won);paired_wins[m]=w
    if gate!=report['strict_gate']:raise ValueError('joint gate')
    return {'lock_sha256':lock_hash,'score_sha256':file_sha(scores_path),'session_channel_metrics_verified':endpoints,
            'raw_maxima_verified':maxima,'complete_worst_events_verified':4,'per_event_comparisons':paired_wins,
            'all_role_joint_gate':gate}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('out',type=Path);p.add_argument('lock_sha');p.add_argument('scores',type=Path)
    a=p.parse_args();print(json.dumps(main(a.out,a.lock_sha,a.scores),indent=2))
