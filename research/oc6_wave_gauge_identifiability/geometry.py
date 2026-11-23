"""Published OC6 Ib basin geometry, conditional wave decomposition, no response inputs."""
import cmath
import itertools
import json
import math
import numpy as np

G = 9.81
DEPTH = 250.
SCALE = 50.
PIVOT = 8.839
PERIODS = [(8.60, 11.85), (7.35, 9.57), (8.60, 11.85), (10.54, 11.85), (8.70, 9.49)]
POSITIONS = {
    'center': [3.88, 6.35, 8.89, 11.35, 13.81],
    'side_wavecheck_and_assembly': [3.94,6.39,8.86,11.37,13.85],
    'side_single': [3.86,6.37,8.90,11.34,13.86],
}
REFLECTIONS = [(.008,.010),(.043,.039),(.007,.021),(.001,.029),(.015,.007)]

def wave_number(angular_frequency):
    low, high = 0., 1.
    while G*high*math.tanh(high*DEPTH) < angular_frequency**2:
        high *= 2
    for _ in range(100):
        middle=(low+high)/2
        if G*middle*math.tanh(middle*DEPTH) < angular_frequency**2:
            low=middle
        else:
            high=middle
    return (low+high)/2

def modes(t_short,t_long):
    a,b=2*math.pi/t_short,2*math.pi/t_long
    ka,kb=wave_number(a),wave_number(b)
    bound,free,cross=ka-kb,wave_number(a-b),ka+kb
    return np.array([bound, -bound, free, -free, cross, -cross])

def condition(matrix):
    sv=np.linalg.svd(matrix,compute_uv=False)
    return {'shape':list(matrix.shape),'singular_values':sv.tolist(),'column_condition':float(sv[0]/sv[-1]) if matrix.shape[0]>=matrix.shape[1] else None}

def matrix(x,k):
    return np.exp(1j*np.outer(x,k))

def complex_pairs(x):
    return [[float(complex(z).real),float(complex(z).imag)] for z in x]

def compute():
    result=[]
    for idx,(period,rpair) in enumerate(zip(PERIODS,REFLECTIONS),1):
        k=modes(*period)
        corners=np.array([modes(period[0]+d1,period[1]+d2) for d1,d2 in itertools.product([-.005,.005],repeat=2)])
        dk=np.max(np.abs(corners-k),axis=0)
        rho=rpair[0]*rpair[1]
        row={'wave':'B'+str(idx),'periods_full_scale_s':list(period),'wave_numbers_per_m':k.tolist(),'published_readout_reflection_moduli':list(rpair),'gamma_modulus_from_rounded_ratios':rho,'input_geometry':{}}
        for slot,positions in POSITIONS.items():
            x=(np.array(positions)-PIVOT)*SCALE
            A=matrix(x,k)
            keep=[0,2,3,4,5]
            old=[0,2,3]
            omit=[1,4,5]
            A0=A[:,keep]
            R=A[:,old]
            P=np.linalg.pinv(R)
            inverse=np.linalg.solve(A0,np.eye(5))
            u=inverse @ A[:,1]
            assert abs(abs(u[0])-1)<1e-10
            null=np.zeros(6,dtype=complex)
            null[1]=1
            null[keep]=-u
            assert np.max(np.abs(A @ null))<1e-10
            assert np.max(np.abs(np.abs(null[::2])-np.abs(null[1::2])))<1e-10
            leak=(P @ A[:,omit])[0,:]
            noise=np.abs(inverse[0,:]).sum()
            f4=condition(A0)
            # Treat printed coordinates and periods as rounded intervals for a sensitivity check.
            # This independent perturbation bound uses chord <= phase difference and Frobenius >= spectral norm.
            err=np.abs(x[:,None])*dk[keep]+.005*SCALE*(np.abs(k[keep])+dk[keep])
            frob=float(np.linalg.norm(err))
            e={'full':condition(A),'five_drop_backward':f4,'author_three':condition(R),'null_family':complex_pairs(null),'closure_abs_residual':float(np.max(np.abs(A @ null))),
               'author_leakage':complex_pairs(leak),'author_leakage_l1':float(np.abs(leak).sum()),'author_noise_l1':float(np.abs(P[0,:]).sum()),
               'analytic_gamma_restore_relative_cap':rho/(1-rho),'five_mode_target_noise_l1_phase_interval':[float(noise/(1+rho)),float(noise/(1-rho))],
               'rounding_assumption_operator_perturbation_fro_upper_numeric':frob,'five_mode_weyl_sigma_lower_numeric':f4['singular_values'][-1]-frob}
            adversary=np.conj(leak)/np.abs(leak)
            assert abs(np.dot(leak,adversary)-np.abs(leak).sum())<1e-10
            check=[]
            for phase in np.arange(32)*2*math.pi/32:
                gamma=rho*cmath.exp(1j*phase)
                D=A0.copy();D[:,0]+=gamma*A[:,1]
                direct=np.linalg.solve(D,np.eye(5))[0]
                calc=inverse[0]/(1+gamma*u[0])
                check.append(float(np.max(np.abs(direct-calc))))
            e['direct_vs_sherman_morrison_max']=max(check)
            row['input_geometry'][slot]=e
        x=(np.array(POSITIONS['center']+POSITIONS['side_wavecheck_and_assembly'])-PIVOT)*SCALE
        row['ten_conditional_same_longitudinal_field']=condition(matrix(x,k))
        result.append(row)
    return result
if __name__=='__main__':
    import pathlib,sys
    records=compute()
    payload={'numpy':np.__version__,'records':records,'raw_measurements_read':0}
    raw=json.dumps(payload,sort_keys=True,indent=2,allow_nan=False)
    if len(sys.argv)>1:pathlib.Path(sys.argv[1]).write_text(raw)
    print(raw)
