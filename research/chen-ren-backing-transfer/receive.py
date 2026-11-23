"""Independent reconstruction from the released complex-reflection columns."""
from pathlib import Path
import argparse, csv, hashlib, io, itertools, json, zipfile
import numpy as np

def sha(b):
    return hashlib.sha256(b).hexdigest()

def pair(z):
    return [float(z.real),float(z.imag)]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('archive',type=Path);ap.add_argument('dev',type=Path);ap.add_argument('reserve',type=Path);ap.add_argument('output',type=Path)
    a=ap.parse_args()
    assert sha(a.archive.read_bytes())=='9b93ad7d7dfe8b576c65836f4c884caa0b34b65c599778dac557abffdd950e59'
    cal=['A1','A4','A6','A7']; loadlist=['0','P','G','D']
    cases={'A2':'D','A3':'G','A5':'P','A8':'0'}
    freq=np.arange(340,1601,2); delta={}; peaks=[]; maxscore=0.; gates={}; sheets={}
    with zipfile.ZipFile(a.archive) as z:
        def get(name):
            tab=list(csv.DictReader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig')))
            q=np.array([(float(row['R_real']),float(row['R_imag'])) for row in tab if 340<=int(row['frequency_Hz'])<=1600])
            return q[:,0]+1j*q[:,1]
        data={s:{k:get(f'data/mean/{s}-{k}.csv') for k in loadlist} for s in cal+list(cases)}
        for s,tar in cases.items():
            donors=[k for k in loadlist if k!=tar]
            d=a.reserve if s=='A8' else a.dev
            recorded=json.loads((d/'scores.json').read_text());lock=json.loads((d/'lock.json').read_text())
            assert sha((d/'forecast.npz').read_bytes())==lock['sha256']
            tab=np.load(d/'forecast.npz',allow_pickle=False)
            allout={}; rawout={}; conditioning=[];eigvals=[]; agreement=[]
            reps=[get(f'data/replicates/{s}-{tar}_r{i}.csv') for i in [1,2,3]]
            for j,f in enumerate(freq):
                u,v,w=[data[s][k][j] for k in donors]
                matrix=[]
                donor_pred=[]
                z_est=[]
                for cd in cal:
                    x,y,h=[data[cd][k][j] for k in donors]; t=data[cd][tar][j]
                    # Homogeneous constraints -B*k0 + A*k1 = 0, from donor.
                    aa=(x-h)*(y-t);bb=(x-t)*(y-h)
                    row=np.array([-bb,aa]);norm=np.linalg.norm(row)
                    matrix.append(row/norm if norm else row)
                    p=aa*(v-w);q=bb*(u-w)
                    donor_pred.append((p*u-q*v)/(p-q) if abs(p-q)>1e-20 else complex('nan'))
                    Z=lambda r:(1+r)/(1-r)
                    z_est.extend(Z(data[s][k][j])+Z(t)-Z(data[cd][k][j]) for k in donors)
                _,S,Vh=np.linalg.svd(matrix,full_matrices=False)
                aa,bb=Vh[-1].conj();p=aa*(v-w);q=bb*(u-w)
                cond=abs(p-q)/max(abs(p)+abs(q),1e-300)
                same=np.mean([data[cd][tar][j] for cd in cal])
                dist=[bin((int(s[1:])-1)^(int(cd[1:])-1)).count('1') for cd in cal]
                nearest=np.mean([data[cd][tar][j] for cd,dd in zip(cal,dist) if dd==min(dist)])
                pred=(p*u-q*v)/(p-q) if cond>=1e-10 and S[0]>0 else nearest
                zz=np.mean(z_est);add=(zz-1)/(zz+1)
                # Recompute the selected 160 Hz local affine complex fit directly
                # from centered observations using stacked ridge least squares.
                window=np.flatnonzero(np.abs(freq-f)<=160)
                X=np.concatenate([np.stack([data[cd][k][window] for k in donors],axis=1) for cd in cal])
                Y=np.concatenate([data[cd][tar][window] for cd in cal])
                xm,ym=X.mean(axis=0),Y.mean()
                Zc=X-xm
                scale=max(1e-12,np.sum(abs(Zc)**2)/len(X)/3)
                M=np.vstack([Zc,np.eye(3)*np.sqrt(scale*len(X))])
                rhs=np.r_[Y-ym,np.zeros(3)]
                b=np.linalg.lstsq(M,rhs,rcond=None)[0]
                flex=ym+(np.array([u,v,w])-xm)@b
                for name,value in [('projective',pred),('additive_z',add),('nearest',nearest),('same_load',same),('local_ridge',flex)]:
                    rawout.setdefault(name,[]).append(value)
                    allout.setdefault(name,[]).append(value/max(1.,abs(value)))
                conditioning.append(cond);eigvals.append(S.tolist());agreement.append(donor_pred)
            observed=data[s][tar]; unit={}
            for m,p in allout.items():
                p=np.asarray(p)
                dmax=max(np.max(abs(p-tab[s+'_'+m])),np.max(abs(np.asarray(rawout[m])-tab[s+'_raw_'+m])))
                delta[m]=float(max(delta.get(m,0.),dmax))
                assert dmax<2e-9,(s,m,dmax)
                r=next(x for x in recorded['rows'] if x['method']==m and x['sheet']==s)
                rm=lambda vals:float(np.sqrt(np.mean(abs(vals)**2)))
                scores=[rm(p-observed),*[rm((p-observed)[b]) for b in [freq<700,(freq>=700)&(freq<1100),freq>=1100]],*[rm(p-x) for x in reps]]
                dif=max(abs(x-y) for x,y in zip(scores,[r['rmse'],*r['bands'],*r['repeat_rmse']]))
                assert dif<2e-10
                maxscore=max(maxscore,dif)
                unit[m]=scores[:4]
            e=abs(np.asarray(allout['projective'])-observed)
            j=int(np.argmax(e));d0=[float(abs(r[j]-observed[j])) for r in reps]
            peaks.append({'sheet':s,'target':tar,'frequency':int(freq[j]),'projective_error':float(e[j]),'observed':pair(observed[j]),'repeat_values':[pair(r[j]) for r in reps],'repeat_distances_to_mean':d0,'anchors':{k:pair(data[s][k][j]) for k in donors},'predictions':{m:pair(p[j]) for m,p in allout.items()},'four_donor_projective_predictions':[pair(t) for t in agreement[j]],'normalized_denominator':conditioning[j],'singular_values':eigvals[j],'condition_minimum':min(conditioning),'projective_clipped_lines':int(np.sum(np.abs(rawout['projective'])>1))})
            sheets[s]=unit
    for part,members in [('development',['A2','A3','A5']),('reserve',['A8'])]:
        control=['additive_z','local_ridge','nearest','same_load']
        av={m:np.mean([sheets[s][m] for s in members],axis=0) for m in ['projective',*control]}
        vals={'mean':bool(av['projective'][0]<=.95*min(av[m][0] for m in control)),'per_unit':[bool(sheets[s]['projective'][0]<=1.05*min(sheets[s][m][0] for m in control)) for s in members],'bands':[bool(av['projective'][i]<=1.10*min(av[m][i] for m in control)) for i in (1,2,3)]}
        d=a.dev if part=='development' else a.reserve
        assert vals==json.loads((d/'scores.json').read_text())['gates'];gates[part]=vals
    out={'delta':delta,'max_score_delta':maxscore,'peaks':peaks,'gates':gates,'rows':4*631*5,'scores':4*5*7,'units':sheets}
    a.output.write_text(json.dumps(out,sort_keys=True))
    print(json.dumps({k:out[k] for k in ['delta','max_score_delta','gates','rows','scores']}))
if __name__=='__main__': main()
