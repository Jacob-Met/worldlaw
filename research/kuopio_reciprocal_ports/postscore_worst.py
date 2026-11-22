"""Retain every voltage and comparator on the worst locked candidate acquisition."""
import argparse
import io
import json
import zipfile
import numpy as np
from scipy.io import loadmat
from locked_course import FILES, PRIMARY, ROLE_NAMES, entry_name, fetch, sha, sources
from port_forecast import split_drives
from row_witness import row_witness


def main(archive,expected):
    packet=open(archive,'rb').read();assert sha(packet)==expected
    currents,b,water,_,_,_=sources();t,qs,ds=split_drives(currents)
    with zipfile.ZipFile(io.BytesIO(packet)) as z:
        m=json.loads(z.read('manifest.json'))
        best=-1
        for case in FILES:
            raw=fetch(case);truth=loadmat(io.BytesIO(raw),variable_names=['Uel'])['Uel'].reshape(76,31).T
            name=entry_name(case,PRIMARY);blob=z.read(name);assert sha(blob)==m['sha256'][name]
            pp=np.frombuffer(blob,dtype='<f8').reshape(31,14)
            e,k=np.unravel_index(np.argmax(abs(pp-truth[:,qs])),pp.shape)
            err=abs(pp[e,k]-truth[e,qs[k]])
            if err<=best:continue
            best=err;j=qs[k];donor=ds[k]
            selected=dict(phantom=case,query=int(j+1),donor=int(donor+1),edge=int(e+1),forecast_worst_abs_V=float(err),
                target_drive_mA=currents[:,j].tolist(),donor_drive_mA=currents[:,donor].tolist(),reported_voltage_edge=b[:,e].tolist(),
                true_query_V=truth[:,j].tolist(),donor_measurement_V=truth[:,donor].tolist(),water_query_V=water[:,j].tolist(),water_donor_V=water[:,donor].tolist(),
                arm_same_row={},arm_all_edges_V={})
            for n in ROLE_NAMES:
                key=entry_name(case,n);source=z.read(key);assert sha(source)==m['sha256'][key]
                yp=np.frombuffer(source,dtype='<f8').reshape(31,14)[:,k]
                selected['arm_all_edges_V'][n]=yp.tolist()
                selected['arm_same_row'][n]=dict(predicted_V=float(yp[e]),observed_V=float(truth[e,j]),error_V=float(yp[e]-truth[e,j]))
    # Independently evaluate a constructive strictly passive pair on every
    # official omitted port row, with variable instrument current amplitudes.
    witnesses=[]
    for level in range(1,8):
        omitted=0; narrow=float('inf'); min_pair=None
        for drive in range(76):
            for edge in range(31):
                result=row_witness(currents,b,level,drive,edge)
                if 'changed_query_V' not in result:continue
                omitted+=1;shift=result['changed_query_V']
                if shift<narrow:narrow=shift;min_pair=[drive+1,edge+1]
        witnesses.append(dict(level=level,nonunique=omitted,actual_amplitude_min_example_separation_V=narrow if omitted else None,one_based_min_pair=min_pair))
    print(json.dumps(dict(worst_acquisition=selected,witness_levels=witnesses,total_strictly_passive_witness_pairs=sum(x['nonunique'] for x in witnesses),archive_sha256=expected),sort_keys=True))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('archive');p.add_argument('sha');a=p.parse_args();main(a.archive,a.sha)
