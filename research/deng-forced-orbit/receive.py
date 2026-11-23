import hashlib,json,math,pathlib,sys,statistics
w=pathlib.Path(sys.argv[1]);lock=json.loads((w/'forecast.json').read_bytes());recount=json.loads((w/'score.json').read_bytes())
assert hashlib.sha256((w/'forecast.json').read_bytes()).hexdigest()==recount['forecast_sha256']
methods=lock['arm_order']; ys=recount['development_coefficients'];scale=lock['training_scales'];manual={}
assert list(range(401,661))==recount['ids'] and len(ys)==260
def rms(a):return math.sqrt(math.fsum(x*x for x in a)/len(a))
maximum=0
for arm in methods:
    pred=lock['answers'][arm]['predictions'];assert len(pred)==len(ys)
    errors=[[a-b for a,b in zip(row,target)] for row,target in zip(pred,ys)]
    perrow=[rms([v /scale[j] for j,v in enumerate(row)]) for row in errors]
    channels=[rms([r[j] for r in errors]) for j in range(4)]
    overall=rms(perrow)
    s=sorted(perrow);q=(len(s)-1)*.95;lo=math.floor(q)
    tail=s[lo]*(1-q+lo)+s[lo+1]*(q-lo)
    orig=recount['scores'][arm];worst=max(range(len(ys)),key=lambda j:perrow[j])
    assert orig['worst']['id']==401+worst
    a=[overall,tail,*channels,rms(perrow[:87]),rms(perrow[87:174]),rms(perrow[174:])]
    b=[orig['scaled_RMSE'],orig['scaled_row_RMS_p95'],*orig['RMSE_by_channel'],*orig['three_block_scaled_RMSE']]
    maximum=max(maximum,max(abs(x-y) for x,y in zip(a,b)))
    assert all(math.isclose(x,y,rel_tol=1e-12,abs_tol=1e-15) for x,y in zip(a,b))
    manual[arm]={'all':overall,'p95':tail,'rms':channels,'worst':401+worst}
best=min(methods[1:],key=lambda m:manual[m]['all']);c=manual['orbit'];ref=manual[best]
g={'all_method_gain':all(c['all']<=.95*manual[m]['all'] for m in methods[1:]),'per_channel_guard':all(x<=1.05*y for x,y in zip(c['rms'],ref['rms'])),'tail_guard':c['p95']<=ref['p95']}
assert g==recount['gates'] and all(g.values())==recount['promotion'] and best==recount['best_control']
pairs=recount['paired_corner_rows'];assert len(pairs)==16
for z in pairs:
    o=z['outputs']; delta=[b-a for a,b in zip(o[0],o[-1])]; assert delta==z['difference_360_minus_0']
out={'recomputed_predictions':260*4*len(methods),'score_scalars':9*len(methods),'actual_score_checked_max_abs_delta':maximum,'methods':manual,'control':best,'gates':g,'nominal_periodic_pairs':16,'reserve_opened':False}
(w/'independent.json').write_text(json.dumps(out,sort_keys=True)+'\n');print((w/'independent.json').read_text())
