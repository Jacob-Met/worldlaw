"""Check the complete source clocks and the supplied identification material without reading positions."""
from collections import Counter
from decimal import Decimal
from fractions import Fraction
import hashlib
import io
import json
import math
from pathlib import Path
import sys
from zipfile import ZipFile

import numpy as np
from scipy.io import loadmat


SOURCE_SHA='d5f820a3c94223d201ab3c890b0e1203899c044dacfb00ed29e0af4ea8707fae'
D = Decimal


def clock_only(member, name):
    header=[member.readline().decode('utf-8-sig').strip() for _ in range(6)]
    assert header[0]=='Frequency [kHz];500' and header[2]=='Unit Time;s' and header[3]=='Unit Position;pm'
    expected='Time;PZT' if '/feedforward_' in name else 'Time;Noname 1'
    assert header[4]=='' and header[5]==expected,(name,header[5],expected)
    previous=first=None;steps=Counter();width=Counter();missing=0;n=0
    for line in member:
        cells=line.rstrip(b'\r\n').split(b';');width[len(cells)]+=1
        if not any(cells):continue
        assert len(cells)==2,'Additional waveform field requires independent identity qualification'
        stamp=D(cells[0].decode('ascii'))
        assert stamp.is_finite()
        # Only nonempty-field information is retained from the position column.
        missing+=int(not cells[1].strip())
        if previous is None:first=stamp
        else:steps[stamp-previous]+=1
        previous=stamp;n+=1
    return {'header':header,'rows':n,'width_histogram':dict(width),'missing_response_symbol':missing,
            'first_time_s':str(first),'last_time_s':str(previous),'elapsed_s':str(previous-first),
            'delta_count':len(steps),'min_step_s':str(min(steps)),'max_step_s':str(max(steps)),
            'nonpositive_steps':sum(v for k,v in steps.items() if k<=0),
            'nominal_2us_steps':steps[D('.000002')],'top_step_counts':[(str(k),v) for k,v in steps.most_common(10)]}


def input_design(member):
    count=0;lo=math.inf;hi=-math.inf;prev=first=None;last_sign=0;reversals=[];zero=0
    for b in member:
        s=b.strip()
        if not s:continue
        assert b';' not in s and b',' not in s
        x=float(s);assert math.isfinite(x)
        if prev is None:first=x
        else:
            sg=(x>prev)-(x<prev)
            if sg and last_sign and sg!=last_sign:reversals.append(count-1)
            if sg:last_sign=sg
            else:zero+=1
        lo=min(lo,x);hi=max(hi,x);prev=x;count+=1
    return {'rows':count,'columns':1,'command_range_V':[lo,hi],'first_last':[first,prev],
            'reversal_count':len(reversals),'first_reversal_samples':reversals[:5],'last_reversal_samples':reversals[-5:],
            'constant_sample_steps':zero,'clock_column':False}


def maps(member):
    mat=loadmat(io.BytesIO(member.read()),variable_names=['X'])
    X=mat['X'];assert X.ndim==2 and X.shape[0]==X.shape[1] and np.isfinite(X).all()
    return {'variable':'X','shape':list(X.shape),'dtype':str(X.dtype),'count_nonzero':int(np.count_nonzero(X)),
        'upper_nonzero':int(np.count_nonzero(np.triu(X,1))),'lower_nonzero':int(np.count_nonzero(np.tril(X,-1))),
        'negative':int(np.sum(X<0)),'positive':int(np.sum(X>0)),
        'coefficient_sha256_F64LE_rowmajor':hashlib.sha256(X.astype('<f8').tobytes(order='C')).hexdigest()}


def mathematical_control():
    # A causal low-pass plus a static relay has two indistinguishable physical decompositions.
    u=[0,5,5,0,0,0];v=[];y=[];state=Fraction(0);relay=0
    for command in u:
        state=(state+command)/2;v.append(str(state))
        if state>=3:relay=1
        elif state<=1:relay=0
        y.append(relay)
    assert v==['0','5/2','15/4','15/8','15/16','15/32'] and y==[0,0,1,1,0,0]
    # Closed-form normalized loop area for y=G[u] with G(s)=1/(1+s*tau),
    # tau=1/(2*pi*100 Hz), unit linear displacement and sinusoidal command.
    area={str(f):str(Fraction(f,100)/(1+Fraction(f,100)**2)) for f in (4,100)}
    assert area=={'4':'25/626','100':'1/2'}
    return {'command':u,'filtered_voltage_exact':v,'both_output_histories':y,
            'normalized_abs_loop_area_at_nominal_hz':area,'area_ratio_100_to_4':str(Fraction(313,25))}


def run(archive,output):
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==SOURCE_SHA
    report={'source_sha256':SOURCE_SHA,'clocks':{},'identification_designs':{},'author_density':{},
            'position_values_converted':0,'mathematical_control':mathematical_control()}
    with ZipFile(archive) as z:
        for name in z.namelist():
            if name.startswith('__MACOSX') or name.endswith('/') or name.endswith('.DS_Store'):continue
            if name.startswith('Experimental data/') and name.endswith('.csv'):
                with z.open(name) as f:v=clock_only(f,name)
                report['clocks'][name]=v;print('CLOCK',name,v,flush=True)
            elif name.startswith('Identification input/') and name.endswith('.csv'):
                with z.open(name) as f:v=input_design(f)
                report['identification_designs'][name]=v;print('DESIGN',name,v,flush=True)
            elif name.startswith('Identified density values/') and name.endswith('.mat'):
                with z.open(name) as f:v=maps(f)
                report['author_density'][name]=v;print('MAP',name,v,flush=True)
            else:raise ValueError('Unexpected scientific file '+name)
    assert [len(report[k]) for k in ['clocks','identification_designs','author_density']]==[5,2,3]
    output.write_text(json.dumps(report,indent=2)+'\n')
    print('COMPLETE',hashlib.sha256(output.read_bytes()).hexdigest(),output,flush=True)


if __name__=='__main__':run(*map(Path,sys.argv[1:]))
