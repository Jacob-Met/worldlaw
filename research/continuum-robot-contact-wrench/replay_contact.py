"""Replay the source-frozen Toronto comparison and export the complete passive contact trace."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import tempfile
import numpy as np
from contact_models import ARMS,HELD,forecast,original,smooth,table
from compare_contact import score
from independent_contact import receive

HERE=Path(__file__).resolve().parent


def export_trace(source,lock,destination):
    name='push_retract'
    with original(source) as z,np.load(lock/'locked.npz',allow_pickle=False) as forecasts:
        t=forecasts[name+'_t'];est=forecasts[name+'_forecasts'];p=forecasts[name+'_positions']
        actual=smooth(t,table(z,'contact_motion/'+name,'base_wrench',6,t)[1])
        tip=p[:,-1];sensor=forecasts[name+'_wand_pose'][:,3:]
        raw=table(z,'contact_motion/'+name,'base_wrench',6,t)[1]
        distance=np.linalg.norm(tip-sensor,axis=1)
        head=['row','time_s','contact_mask','distance_m','tip_x_m','tip_y_m','tip_z_m',
              'wand_x_m','wand_y_m','wand_z_m','source15Hz_Mx_Nm','source15Hz_My_Nm',
              'ATI2Hz_Mx_Nm','ATI2Hz_My_Nm','ATI2Hz_Mz_Nm']
        for arm in ARMS:
            head.extend(f'{arm}_{k}_Nm' for k in ('Mx','My','Mz'))
        with destination.open('x',newline='') as out:
            w=csv.writer(out,lineterminator='\n');w.writerow(head)
            for i,clock in enumerate(t):
                vals=[i,clock,int(forecasts[name+'_mask'][i]),distance[i],*tip[i],*sensor[i],
                      *raw[i,3:5],*actual[i,3:],*est[i,:,3:].ravel()]
                w.writerow([v if isinstance(v,(int,np.integer)) else format(v,'.9g') for v in vals])


def compare_original(actual):
    frozen_bytes=(HERE/'contact-original.json').read_bytes()
    if hashlib.sha256(frozen_bytes).hexdigest()!='aa0f106c288a27ce61351d8ec38c57dbc467db37d09c33439ebe5c95b7e6a0d9':
        raise ValueError('The archived outcome differs')
    old=json.loads(frozen_bytes)
    assert actual['gates']==old['gates'] and actual['joint']==old['joint']
    checks=0
    def match(a,b):
        if not np.allclose(a,b,rtol=5e-7,atol=2e-8):
            raise ValueError(f'Fresh replay differs: {a} and {b}')
    for n in HELD:
        for subset in (('whole','contact') if n=='push_retract' else ('whole',)):
            for arm in ARMS:
                a=actual['records'][n][subset][arm];b=old['records'][n][subset][arm]
                assert a['rows']==b['rows'] and a['worst_row']==b['worst_row']
                for k in ('rms_planar_Nm','peak_planar_Nm','component_rmse','worst_time_s','worst_actual','worst_predicted'):
                    match(a[k],b[k]);checks+=1
        for key in ('all_arms_wrenches','true_wrench','positions_m','wand_pose'):
            match(actual['records'][n]['worst_bias_witness'][key],old['records'][n]['worst_bias_witness'][key]);checks+=1
    return checks


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data',type=Path,help='Original v3 data.zip, SHA checked before reading any member')
    parser.add_argument('--trace',type=Path,help='New CSV path for all 2,840 push/retract samples')
    args=parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='toronto-contact-replay-') as td:
        lock=Path(td)/'forecast'
        forecast(args.data,lock)
        locked_digest=hashlib.sha256((lock/'lock.json').read_bytes()).hexdigest()
        report=score(args.data,lock,locked_digest)
        checks=compare_original(report)
        receipt=receive(args.data,lock,report)
        if args.trace:
            export_trace(args.data,lock,args.trace)
        print(json.dumps({'frozen_report_checks':checks,'fresh_lock_sha256':locked_digest,
                          'original_lock_sha256':'3a79c6d54012c9f3d9e9c58c7b97f3fd3138023e039dbb8f7c8eb87e52a28463',
                          'primary':report['records']['push_retract']['whole']['component_101_27g'],
                          'independent':receipt},sort_keys=True))


if __name__=='__main__':
    main()
