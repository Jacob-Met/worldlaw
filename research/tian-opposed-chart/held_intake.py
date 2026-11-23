"""Read the 98 prospectively withheld tiles after authenticating every forecast image."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import sys

from acquire_source import LIST_URL, Listing, read_page, write_frame
from verify_lock import checked

def main():
    path,lockdir,ldigest,out=sys.argv[1:]
    split,lock=checked(path,lockdir,ldigest)
    source=set(lock['source_ids'])
    ids=lock['target_ids']
    assert all(split['frames'][str(i)]['access']=='held' and i not in source for i in ids)
    listing=Listing();listing.feed(read_page(LIST_URL,6_000_000))
    assert set(listing.items)=={r['id'] for r in split['frames'].values()}
    dst=Path(out);dst.mkdir(exist_ok=False)
    print(json.dumps({'checked_forecasts_before_first_held_view':len(ids)*len(lock['forecast_sha256']),'lock':ldigest,'held_dir':str(dst)}),flush=True)
    receipt={}
    with ThreadPoolExecutor(max_workers=3) as pool:
        for k in range(0,len(ids),6):
            pending=[]
            for i in ids[k:k+6]:
                row=split['frames'][str(i)]
                pending.append(pool.submit(write_frame,i,row,listing.items[row['id']],dst))
            for future in pending:
                i,record=future.result();receipt[str(i)]=record
            if len(receipt)%30==0 or len(receipt)==len(ids):print('complete',len(receipt),flush=True)
    b=(json.dumps(receipt,sort_keys=True,separators=(',',':'))+'\n').encode()
    (dst/'receipts.json').write_bytes(b)
    print(json.dumps({'held_roi_count':len(receipt),'all_predeclared_targets':set(map(int,receipt))==set(ids),'receipt_sha256':hashlib.sha256(b).hexdigest(),'held_dir':str(dst)}),flush=True)
if __name__=='__main__':main()
