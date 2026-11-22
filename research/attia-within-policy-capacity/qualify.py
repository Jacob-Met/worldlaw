import csv,hashlib,io,json,math,statistics,tempfile,urllib.request
from pathlib import Path
from urllib.parse import quote
from collections import Counter,defaultdict
pins={"Validation/05-Mar-2019_batch9_predictions.csv":"be3e1aa4717e9a4d26f8a620b6d7dc297253c058","Validation/predictions.csv":"cdd31ef6435b9d8cc57000dd849f9df5ceb03f79","domhan_comparison/IvsSOC_test1.csv":"208780b78cdda414febbd8181bd1403b5aa2fd07","domhan_comparison/IvsSOC_train.csv":"13b5b9be1f4b24c1ef781f5eae5416a8bf6cc93d","domhan_comparison/Qn_test1.csv":"98d746ec4df5a29a414e38d8bb84ec6bbacd8124","domhan_comparison/Qn_train.csv":"2fc6fc9fdde840201efaad244ec79ada06f80d0d","domhan_comparison/y_pred_Severson_test1.csv":"ae08e8082f872aa98b88658cf4f2230982dcdf0c","domhan_comparison/y_pred_Severson_train.csv":"253449b10b7b2ebbfa892d2eeef3fada93167e99","domhan_comparison/y_test1.csv":"20293a1f67474088add2504c985d8e966a36307b","domhan_comparison/y_train.csv":"43ba2daae588c58f833c41ffe04c2cb8de3eddcb"}
base='https://raw.githubusercontent.com/petermattia/battery-parameter-spaces/ec9508f9d2d6098f6e9a46dfaf79a222e65d7491/'
root=Path(tempfile.mkdtemp(prefix='p3-f747-attia-author-training-'))
def get(path):
    b=urllib.request.urlopen(base+quote(path),timeout=45).read()
    assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==pins[path]
    return b
def table(path):
    return list(csv.reader(io.StringIO(get(path).decode('utf-8-sig'))))
def split(name):
    p='domhan_comparison/'
    Q=table(p+'Qn_'+name+'.csv')
    C=table(p+'IvsSOC_'+name+'.csv')
    Y=table(p+'y_'+name+'.csv')
    P=table(p+'y_pred_Severson_'+name+'.csv')
    info={'dimensions':[[len(a),len(a[0])] for a in [Q,C,Y,P]]}
    def vector(a):return [float(x) for row in a for x in row if x.strip()]
    y=vector(Y);p=vector(P)
    assert len(y)==len(p)==len(Q)==len(C),(info,len(y),len(p))
    caps=[list(map(float,row[:100])) for row in Q]
    assert all(len(row)==100 for row in caps)
    groups=[','.join(row) for row in C];idx=max(range(len(y)),key=lambda i:abs(y[i]-p[i]))
    info.update(counts=sorted(Counter(groups).values(),reverse=True),worst_external={'row':idx,'forecast':p[idx],'observed':y[idx],'q2_q50_q100': [caps[idx][i] for i in [1,49,99]]},errors={'RMSE':math.sqrt(statistics.mean((a-b)**2 for a,b in zip(p,y))),'MAE':statistics.mean(abs(a-b) for a,b in zip(p,y))},first_cycle_ranges=[[min(r[i] for r in caps),max(r[i] for r in caps)] for i in [0,1,49,99]])
    (root/(name+'.json')).write_text(json.dumps({'q':caps,'schedule':C,'y':y,'pred':p}))
    return info
raw=table('Validation/05-Mar-2019_batch9_predictions.csv');hh=raw[0]
records=[dict(zip(hh,x)) for x in raw[1:]];compact=table('Validation/predictions.csv')
keys=lambda row: tuple(float(x) for x in row.split('-')[:3])
grouped=defaultdict(list)
for r in records:grouped[keys(r['Policy'])].append(r)
mask=[];deltas=[];bad_slots=[]
for row in compact[1:]:
    group=grouped[tuple(float(x) for x in row[:3])]
    assert len(group)==5
    for r,value in zip(group,row[3:]):
        if value.strip().lower() in ('nan',''):mask.append(int(r['Channel']))
        else:
            delta=abs(float(r['Prediction'])-float(value));deltas.append(delta)
            if delta>1:bad_slots.append(int(r['Channel']))
print(json.dumps({'root':str(root),'historical':{k:split(k) for k in ['train','test1']},'membership':{'unique_barcodes':len({r['Barcode'] for r in records}),'channels':sorted(int(r['Channel']) for r in records),'cell_count':len(records),'compact_missing_channels':mask,'max_early_forecast_rounding_delta':max(deltas),'over_one_cycle_ids':bad_slots},'no_validation_lifetimes_selected':True,'no_validation_Qn_or_QV_requested':True},sort_keys=True))
