"""Attribute the frozen moment error to the pressure term and fitted residual."""
import json
import math
from pathlib import Path
import sys
import numpy as np
import joint_pressure as model


def recount(bank,score):
    train_test=[r for r in model.conditions() if r[0][2] in 'ABCEFG']
    settings={}
    for setting,reg in bank['settings'].items():
        rows={}
        for r,data in zip(train_test,reg['ray_design']['joint_four_ray'],strict=True):
            name,freq,theta,u=r
            headings=np.deg2rad([theta,theta+180,theta+90,theta-90])
            directions=np.column_stack((np.cos(headings),np.sin(headings)))
            rays=np.array([model.wave_number(2*math.pi*freq,u*e[0])*e for e in directions])
            amplitudes=model.decode(data[3]);base=np.zeros(2,complex)
            for ray,amp in zip(rays,amplitudes,strict=True):
                grad=model.footprint(ray,False)
                base+=1j*(-model.DENSITY*model.GRAVITY*amp/np.cosh(np.linalg.norm(ray)*model.DEPTH))*np.array([grad[1],-grad[0]])
            rows[name]={'design_condition':data[0],'least_singular':data[2],
                        'residual_m':data[1],'maximum_ray_amplitude_m':float(max(abs(amplitudes))),
                        'base_moment_nm':model.encode(base)}
        # The frozen diagnostics are [condition, residual, smallest singular, amplitudes].
        worst=score['settings'][setting]['worst']['id'];i=bank['test'].index(worst)
        base=model.decode(rows[worst]['base_moment_nm'])
        truth=model.decode(score['truth'][setting][i]);f=model.decode(reg['forecasts']['joint_four_ray'][i])
        settings[setting]={'worst':worst,'record':rows[worst],'truth_nm':model.encode(truth),
             'fit_correction_nm':model.encode(f-base),'forecast_nm':model.encode(f),
             'fit_correction_norm_nm':float(np.linalg.norm(f-base)),
             'direct_term_error_nm':float(np.linalg.norm(base-truth)),
             'raw_errors_nm':{a:score['settings'][setting]['errors'][a][i] for a in model.ARMS},
             'training_diagonals':{n:rows[n] for n in ('ETC0003','ETC0007')}}
    return settings


if __name__=='__main__':
    bank,score=map(Path,sys.argv[1:])
    print(json.dumps(recount(json.loads(bank.read_bytes()),json.loads(score.read_bytes())),sort_keys=True,allow_nan=False))
