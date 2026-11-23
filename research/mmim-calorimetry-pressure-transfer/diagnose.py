"""Frozen worst-curve decomposition without fitting another material model."""
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import independent as i


def diagnostic(xml,bank,score,pure):
    key=score['worst']['id'];row=bank['rows'][key]
    sol,z,t=row['solvent'],row['z'],row['T']
    x=ET.parse(xml)
    for e in x.iter():e.tag=e.tag.split('}')[-1]
    group=next(d for d in x.findall('PureOrMixtureData') if int(d.findtext('nPureOrMixtureDataNumber'))==row['dataset'])
    entries=[]
    for j,e in enumerate(group.findall('NumValues')):
        variables={int(y.findtext('nVarNumber')):float(y.findtext('nVarValue')) for y in e.findall('VariableValue')}
        if variables[1]!=z:continue
        pv=e.find('PropertyValue');u=pv.find('CombinedUncertainty/nCombExpandUncertValue')
        temp=variables[2];p=float(pv.findtext('nPropValue'))
        q,=[v for k,v in pure[sol].items() if float(k)==temp]
        gamma=i.inferred_gamma(q,1000*p,temp,z,bank['fits'][sol]['ve'])
        entries.append({'row':j,'T_K':temp,'P_kpa':p,'compiler_expanded_uncert_kpa':float(u.text) if u is not None else None,
                        'reduced_log_activity_coefficient':gamma,'caloric_beta_integral':i.heat_model(z,temp,bank['fits'][sol]),
                        'pure_pstar_kpa':q['pstar_pa']/1000})
    entries.sort(key=lambda e:e['T_K']); target=next(e for e in entries if e['row']==row['row']); anchor=entries[3]
    dt=(1/t-1/anchor['T_K'])
    return {'target':key,'curve':entries,'first_four_anchor_rows':[v['row'] for v in entries[:4]],
        'point_predictions_kpa':row['pred_kpa'],'signed_worst_kpa':row['pred_kpa']['caloric_cp']-target['P_kpa'],
        'calibrating_partial_HE_at_298_J_mol':i.partial(z,bank['fits'][sol]['h0']),
        'partial_excess_Cp_at_four_T_J_mol_K':[i.partial(z,v) for v in bank['fits'][sol]['cp']],
        'effective_caloric_partial_H_J_mol_last_anchor_to_worst':i.R*(target['caloric_beta_integral']-anchor['caloric_beta_integral'])/dt,
        'effective_pressure_derived_partial_H_J_mol_last_anchor_to_worst':i.R*(target['reduced_log_activity_coefficient']-anchor['reduced_log_activity_coefficient'])/dt,
        'pressure_derived_scope':'finite secant under the frozen virial/Poynting correction, not independent calorimetry'}


if __name__=='__main__':
    x,b,s,p=map(Path,sys.argv[1:]);print(json.dumps(diagnostic(x,json.loads(b.read_bytes()),json.loads(s.read_bytes()),json.loads(p.read_bytes())['pure']),sort_keys=True))
