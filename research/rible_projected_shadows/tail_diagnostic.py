"""Postscore explanation of the largest whole-distribution discrepancy."""
import collections, math, json
from score_locked import box,centered
from forecast import PROTOCOL,data
name='E3_R3_DW_Green_1_25_24'
def main():
    z=data(json.loads(PROTOCOL.read_bytes()))
    a,ra=box(z,1,name);b,rb=box(z,2,name);x=centered(a);y=centered(b)
    assert len(x)==len(y)==2001
    ranked=sorted([(v,i) for i,v in enumerate(x)]);other=sorted([(v,i) for i,v in enumerate(y)])
    errors=[(u-v)**2 for (u,_),(v,_) in zip(ranked,other)];order=sorted(range(len(errors)), key=lambda j:-errors[j])
    idx=order[0];xx,ia=ranked[idx];yy,ib=other[idx];ss=math.fsum(errors)
    counts=collections.Counter(b)
    extremes=sorted(range(len(b)),key=lambda j:(b[j],j))
    o={'movie':name,'n':len(a),'source_median':sorted(a)[1000],'target_median':sorted(b)[1000],
       'source_export_histogram':sorted(collections.Counter(a).items()),'target_export_histogram':sorted(counts.items()),
       'W2':math.sqrt(ss/2001),'largest_monotone_pair':{'rank':idx+1,'source_frame':ia+1,'target_frame':ib+1,'source_value':a[ia],'target_value':b[ib],'log_source':xx,'log_target':yy},
       'largest_k_fraction_squared_transport_cost':{k:math.fsum(errors[j] for j in order[:k])/ss for k in (1,5,10,20,50,100)},
       'extreme_target_indices_first20':[(j+1,b[j]) for j in extremes[:20]],
       'same_ordinal_source_target_neighborhood':[(j+1,a[j],b[j]) for j in range(max(0,ib-4),min(len(b),ib+5))],
       'unchanged_all_scores':True}
    print('TAIL',json.dumps(o,sort_keys=True),flush=True)
if __name__=='__main__':main()
