#!/usr/bin/env python3
"""Frozen independent joint-input receiving.

Fraction forward recurrences and exhaustive minimal row dependencies compile
every optional schedule separately. SciPy/HiGHS solves every signed-tuple LP
with a FREE margin variable. Separate primal distance LPs check selected inputs
and supplied readouts. No production algebra, tableau or planner is imported.
"""
import argparse
from fractions import Fraction as F
import hashlib
import itertools as it
import json
from pathlib import Path
import subprocess
import numpy as np
import scipy
from scipy.optimize import linprog

TOL=1e-9
OPTIONS={'dual_feasibility_tolerance':TOL,'primal_feasibility_tolerance':TOL}
def dot(a,b): return sum((x*y for x,y in zip(a,b)),F(0))
def matvec(a,x): return [dot(r,x) for r in a]
def dynamics(law,controls,initial=None):
    A,B=[[list(map(F,r)) for r in law[k]] for k in ['A','B']];C=list(map(F,law['C']))
    n=len(A);state=list(map(F,initial)) if initial is not None else [F(0)]*n
    power=[[F(i==j) for j in range(n)] for i in range(n)]
    observable=[];output=[]
    for t in range(len(controls)+1):
        observable.append([dot(C,col) for col in zip(*power)]);output.append(dot(C,state))
        if t<len(controls):
            state=[a+b for a,b in zip(matvec(A,state),matvec(B,list(map(F,controls[t]))))]
            power=[[dot(row,col) for col in zip(*power)] for row in A]
    return observable,output
def kernel(rows):
    n=len(rows);a=[list(col) for col in zip(*rows)];pivots=[];k=0
    for j in range(n):
        found=next((i for i in range(k,len(a)) if a[i][j]),None)
        if found is None: continue
        a[k],a[found]=a[found],a[k];scale=a[k][j];a[k]=[v/scale for v in a[k]]
        for i in range(len(a)):
            if i!=k:
                factor=a[i][j];a[i]=[v-factor*w for v,w in zip(a[i],a[k])]
        pivots.append(j);k+=1
        if k==len(a): break
    result=[]
    for free in set(range(n))-set(pivots):
        vector=[F(0)]*n;vector[free]=F(1)
        for i,j in enumerate(pivots): vector[j]=-a[i][free]
        result.append(vector)
    return result
def compile_request(request):
    bounds=[(F(a),F(b)) for row in request['controlBounds'] for a,b in zip(row['min'],row['max'])]
    horizon=len(request['controlBounds']);channels=len(request['controlBounds'][0]['min'])
    zeros=[[F(0)]*channels for _ in range(horizon)]
    laws=[]
    for law in request['hypotheses']:
        observable,_=dynamics(law,zeros);columns=[]
        for k in range(horizon*channels):
            impulse=[row[:] for row in zeros];impulse[k//channels][k%channels]=F(1)
            columns.append(dynamics(law,impulse)[1])
        laws.append((observable,[list(row) for row in zip(*columns)]))
    pairs=[]
    for i,j in it.combinations(range(len(laws)),2):
        rows=[a+[-v for v in b] for a,b in zip(laws[i][0],laws[j][0])]
        response=[[b-a for a,b in zip(x,y)] for x,y in zip(laws[i][1],laws[j][1])]
        pairs.append(dict(id=request['hypotheses'][i]['id']+'__'+request['hypotheses'][j]['id'],rows=rows,response=response))
    return bounds,pairs
def lines(pair,ticks,dimensions):
    result=[]
    for size in range(1,len(ticks)+1):
        for support in it.combinations(ticks,size):
            basis=kernel([pair['rows'][t] for t in support])
            if len(basis)!=1 or not all(basis[0]): continue
            norm=sum(map(abs,basis[0]));w=[v/norm for v in basis[0]]
            coeff=[dot(w,[pair['response'][t][j] for t in support]) for j in range(dimensions)]
            if any(coeff): result.extend([coeff,[-v for v in coeff]])
    return result or [[F(0)]*dimensions]
def reference(request):
    bounds,pairs=compile_request(request);menu=sorted(request['offeredTicks']);lp_count=0;schedule_count=0
    def maximum(ticks):
        nonlocal lp_count,schedule_count
        schedule_count+=1;best=-float('inf')
        bundles=[lines(pair,ticks,len(bounds)) for pair in pairs]
        for choice in it.product(*bundles):
            lp_count+=1
            result=linprog([0.0]*len(bounds)+[-1.0],A_ub=[[-float(v) for v in row]+[1.0] for row in choice],
                b_ub=[0.0]*len(choice),bounds=[(float(a),float(b)) for a,b in bounds]+[(None,None)],method='highs',options=OPTIONS)
            assert result.success, ('free-margin LP must be feasible and bounded',result.message)
            best=max(best,-result.fun)
        return best
    potential=maximum(menu);winner=None
    if potential>2*float(F(request['noiseBound']))+TOL:
        for size in range(1,request['maxReadings']+1):
            qualified=[]
            for ticks in it.combinations(menu,size):
                margin=maximum(ticks)
                if margin>2*float(F(request['noiseBound']))+TOL:
                    qualified.append((sum(request.get('costByTick',{}).get(str(t),1) for t in ticks),ticks,margin))
            if qualified: winner=min(qualified);break
    return dict(potential=potential,winner=winner,tupleLPs=lp_count,schedules=schedule_count)
def distance(rows,delta):
    a=np.array([[float(v) for v in r] for r in rows]);d=np.array(list(map(float,delta)));n=a.shape[1]
    result=linprog(np.r_[np.zeros(n),1.0],A_ub=np.vstack([np.column_stack([a,-np.ones(len(d))]),np.column_stack([-a,-np.ones(len(d))])]),
        b_ub=np.r_[d,-d],bounds=[(None,None)]*n+[(0,None)],method='highs',options=OPTIONS)
    assert result.success,result.message
    return result.fun
def certificate(request,ticks,controls,claim):
    bounds,pairs=compile_request(request);proof=claim['certificate'];lam=list(map(F,proof['mixtureWeights']))
    witnesses=proof['signedWitnesses'];assert len(lam)==len(witnesses)==len(pairs)
    assert all(v>=0 for v in lam) and sum(lam)==1
    u=[F(v) for row in controls for v in row];margin=F(claim['margin']);aggregate=[F(0)]*len(u)
    assert all(lo<=v<=hi for v,(lo,hi) in zip(u,bounds))
    for pair,witness,weight in zip(pairs,witnesses,lam):
        assert witness['pair']==pair['id'];w=list(map(F,witness['weights']))
        assert len(w)==len(ticks) and sum(map(abs,w))==1
        assert all(dot(w,col)==0 for col in zip(*(pair['rows'][t] for t in ticks)))
        a=[dot(w,[pair['response'][t][j] for t in ticks]) for j in range(len(u))]
        assert a==[F(v) for row in witness['controlCoefficients'] for v in row]
        assert dot(a,u)>=margin
        aggregate=[v+weight*c for v,c in zip(aggregate,a)]
    upper=sum((v*(hi if v>=0 else lo) for v,(lo,hi) in zip(aggregate,bounds)),F(0))
    assert upper==margin==F(proof['upperBound']),(upper,margin,proof)
    return 1
BRIDGE=r'''
import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const api=await import(pathToFileURL(process.argv[1]));
const rows=JSON.parse(readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(rows.map(row=>{const plan=api.designActiveLinearJointControl(row.request);
return {plan,readouts:(row.readouts??[]).map(r=>api.evaluateActiveLinearReadings(row.request,plan,r))};})));
'''
def run_node(module,rows):
    result=subprocess.run(['node','--max-old-space-size=1536','--input-type=module','-e',BRIDGE,str(module.resolve())],
        input=json.dumps(rows),text=True,capture_output=True,timeout=240,check=True)
    return json.loads(result.stdout)
def close(actual,wanted,context):
    error=abs(float(F(actual))-wanted);assert error<=TOL,(context,actual,wanted,error)
    return error
def receive(module,path):
    cases=json.loads(path.read_text());outputs=run_node(module,cases);checks=[];maximum_error=0.0
    tuple_lps=primal_lps=certificates=0;readout_inputs=[];expected_readouts=[]
    for row,out in zip(cases,outputs):
        request,plan=row['request'],out['plan'];wanted=reference(request);tuple_lps+=wanted['tupleLPs']
        assert not plan['exhausted'] and plan['jointPotential']['exact'],(row['name'],plan)
        maximum_error=max(maximum_error,close(plan['jointPotential']['margin'],wanted['potential'],row['name']))
        chosen=None if plan['selection'] is None else tuple(r['tick'] for r in plan['selection'])
        assert chosen==(wanted['winner'][1] if wanted['winner'] else None),(row['name'],chosen,wanted)
        if 'potential' in row.get('analytic',{}): assert F(plan['jointPotential']['margin'])==F(row['analytic']['potential'])
        if 'ticks' in row.get('analytic',{}): assert (list(chosen) if chosen else None)==row['analytic']['ticks']
        if plan['jointPotential'].get('certificate'):
            certificates+=certificate(request,sorted(request['offeredTicks']),plan['jointPotential']['controls'],plan['jointPotential'])
        if wanted['winner']:
            assert plan['status']=='optimal_certified_joint_control'
            assert plan['numReadings']==len(chosen) and plan['totalCost']==wanted['winner'][0]
            maximum_error=max(maximum_error,close(plan['jointProof']['margin'],wanted['winner'][2],row['name']))
            controls=plan['chosenControls'];certificates+=certificate(request,chosen,controls,plan['jointProof'])
            laws=[dynamics(law,controls) for law in request['hypotheses']]
            measured=[]
            for check,(i,j) in zip(plan['proof'],it.combinations(range(len(laws)),2)):
                margin=distance([laws[i][0][t]+[-v for v in laws[j][0][t]] for t in chosen],
                    [laws[j][1][t]-laws[i][1][t] for t in chosen]);primal_lps+=1;measured.append(margin)
                maximum_error=max(maximum_error,close(check['marginLowerBound'],margin,row['name']))
                assert check['noiseMarginExact'] and check['robustCertified']
            maximum_error=max(maximum_error,close(plan['jointProof']['margin'],min(measured),row['name']))
            initial=[str(F(i+2,3)) for i in range(len(request['hypotheses'][0]['A']))]
            observed=dynamics(request['hypotheses'][0],controls,initial)[1]
            readings=[];expected=[]
            for kind in ['full','partial','perturbed']:
                ticks=chosen if kind!='partial' else chosen[:1]
                values=[observed[t]+(F(37*(-1)**i) if kind=='perturbed' else 0) for i,t in enumerate(ticks)]
                readings.append(dict(schema='worldlaw.active-linear-readings/v1',acquisition='synthetic',
                    source='Independent Fraction recurrence with separately chosen hidden state; '+kind,
                    readings=[dict(tick=t,value=str(v)) for t,v in zip(ticks,values)]))
                expected.append([distance([law[0][t] for t in ticks],[v-law[1][t] for t,v in zip(ticks,values)]) for law in laws])
                primal_lps+=len(laws)
            readout_inputs.append(dict(request=request,readouts=readings));expected_readouts.append(expected)
        else:
            assert plan['chosenControls'] is None and plan['jointProof'] is None
            status='structurally_indistinguishable_on_control_box' if wanted['potential']<=TOL else \
                'noise_separation_not_certified' if wanted['potential']<=2*float(F(request['noiseBound']))+TOL else 'insufficient_reading_budget'
            assert plan['status']==status,(row['name'],plan['status'],status)
        checks.append(dict(name=row['name'],potential=wanted['potential'],selected=chosen,tupleLPs=wanted['tupleLPs'],schedules=wanted['schedules']))
    readout_count=0
    for item,out,expected in zip(readout_inputs,run_node(module,readout_inputs),expected_readouts):
        eps=float(F(item['request']['noiseBound']))
        for report,margins in zip(out['readouts'],expected):
            readout_count+=1;consistent=[]
            for check,margin in zip(report['checks'],margins):
                maximum_error=max(maximum_error,close(check['minimumNoiseRequired'],margin,'readout'))
                status='falsified' if margin>eps+TOL else 'consistent';assert check['status']==status
                if status=='consistent': consistent.append(check['hypothesis'])
            assert report['consistentHypothesisIds']==consistent
            assert report['status']==('all_hypotheses_falsified' if not consistent else 'one_hypothesis_consistent' if len(consistent)==1 else 'multiple_hypotheses_consistent')
    return dict(cases=len(cases),signedTupleLPs=tuple_lps,separatePrimalLPs=primal_lps,
        exactCertificates=certificates,separateReadouts=readout_count,absoluteTolerance=TOL,
        maximumAbsoluteError=maximum_error,failures=[],numpyVersion=np.__version__,scipyVersion=scipy.__version__,
        casesSHA256=hashlib.sha256(path.read_bytes()).hexdigest(),candidateSHA256=hashlib.sha256(module.read_bytes()).hexdigest(),checks=checks)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--module',type=Path,required=True);parser.add_argument('--cases',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();result=receive(args.module,args.cases);args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='checks'},sort_keys=True))
