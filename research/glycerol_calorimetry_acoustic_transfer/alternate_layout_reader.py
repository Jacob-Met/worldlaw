import argparse,base64,hashlib,json,math,pathlib,re,subprocess,zlib
def recount(pdf,packed):
 assert hashlib.sha256(pdf.read_bytes()).hexdigest()=='9ba6858c8d9624713314ccc080a6d33d4d578b2231b4fc8bba17e3c4b4a90026'
 raw=zlib.decompress(base64.b64decode(packed));assert hashlib.sha256(raw).hexdigest()=='8135687dc6219955a51f37a0456b3964494bcf48df3d4f0347eabc6c7e57b8c4'
 course=json.loads(raw); release=course['all_50_rows']; original=set((r['T_K'],r['p_MPa']) for r in release);assert len(original)==50
 txt=subprocess.run(['pdftotext','-layout',str(pdf),'-'],check=True,capture_output=True,text=True).stdout
 sections=re.split(r'(?im)^\s*Table 12\s*\n',txt);assert len(sections)==2
 body=re.split(r'(?im)^\s*Table 13\s*\n',sections[1],maxsplit=1)[0]
 # Match horizontal whitespace only, so no decimal token can migrate between rows.
 pat=re.compile(r'(?<![\d.])(\d{3}\.\d+)[ \t]+(\d{1,2}\.\d+)[ \t]+Liquid[ \t]+(\d{3,4}\.\d+)\b',re.I)
 taken={}; counts=0
 for T,P,y in pat.findall(body):
  counts+=1; k=(float(T),float(P));assert k not in taken;taken[k]=float(y)
 if set(taken)!=original or counts!=50: raise ValueError(f'independent physical table census {counts}/{len(taken)} vs 50')
 for r in release:assert taken[(r['T_K'],r['p_MPa'])]==r['observed']
 groups={'all':release,'primary':[r for r in release if 340<=r['T_K']<=373.15 and .1<=r['p_MPa']<=20],
         'thermal_support':[r for r in release if 298.18<=r['T_K']<=373.15 and .1<=r['p_MPa']<=20],
         'outside_thermal':[r for r in release if not (298.18<=r['T_K']<=373.15 and .1<=r['p_MPa']<=20)]}
 for T in sorted({round(r['T_K']) for r in release}):groups[f'all_T{T}']=[r for r in release if round(r['T_K'])==T]
 for T in sorted({round(r['T_K']) for r in groups['primary']}):groups[f'primary_T{T}']=[r for r in groups['primary'] if round(r['T_K'])==T]
 assert set(groups)==set(course['metrics']); mismatch=0.; checks=0;worsts=0
 for k,group in groups.items():
  for role,stored in course['metrics'][k].items():
   pairs=[(abs(r['predicted'][role]-taken[(r['T_K'],r['p_MPa'])]),taken[(r['T_K'],r['p_MPa'])],r['index']) for r in group]
   N=len(pairs);assert N==stored['rows'] and stored['eligible']; w=max(pairs,key=lambda z:z[0]);assert w[2]==stored['worst_index'];worsts+=1
   for metric,num in [('mae',math.fsum(e for e,y,i in pairs)/N),('rmse',math.sqrt(math.fsum(e*e for e,y,i in pairs)/N)),('mean_abs_percent',math.fsum((e/y)*100 for e,y,i in pairs)/N),('worst_abs',w[0])]:mismatch=max(mismatch,abs(num-stored[metric]));checks+=1
 assert mismatch<5e-10
 return {'physical_rows_received':counts,'row_role_residuals':len(release)*len(release[0]['predicted']),'cohorts':len(groups),'metric_scalars_recomputed':checks,'worst_rows_verified':worsts,'max_abs_metric_delta':mismatch,'worst_primary_index':course['metrics']['primary']['gibbs']['worst_index'],'score_sha256':hashlib.sha256(raw).hexdigest(),'same_interpretation':'alternate layout and keyed physical T,p, separate fsum implementation; both paths use Poppler'}
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('pdf',type=pathlib.Path);ap.add_argument('packed');args=ap.parse_args();print(json.dumps(recount(args.pdf,args.packed)))
