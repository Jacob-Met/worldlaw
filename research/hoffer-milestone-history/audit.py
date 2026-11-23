"""Count independently framed donor tables, including exact repeated data blocks."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

from archive import authenticated_archive,metadata,blocks

def audit(path):
    counts=Counter();occurrence=Counter();widths=Counter();examples=[]
    seen={};mismatches=[]
    with authenticated_archive(path) as a:
        for entry in metadata(a):
            if entry['direction']!='U':
                continue
            member=entry['member'];group=entry['group']
            parts=list(blocks(a.read(member)))
            counts[str((group,len(parts)))]+=1
            for k,(header,body) in enumerate(parts):
                cells=header.rstrip(b'\t').split(b'\t')
                if any(not cell.startswith(b'UpTransition') for cell in cells):
                    mismatches.append((member,k,'header',cells[:1]))
                sizes={len(line.rstrip(b'\t').split(b'\t')) for line in body}
                if sizes!={len(cells)}:
                    mismatches.append((member,k,'shape',len(cells),sorted(sizes)))
                bodysha=hashlib.sha256(b'\n'.join(body)).hexdigest()
                label=(group,entry['dt_us'],entry['start_nm'],entry['end_nm'],header)
                state='new' if label not in seen else 'exact' if bodysha in seen[label] else 'collision'
                seen.setdefault(label,set()).add(bodysha)
                occurrence[str((group,state))]+=1
                widths[str((group,len(body)))]+=1
                if len(parts)>1 and len(examples)<8:
                    examples.append((member,k,cells[0].decode(),cells[-1].decode(),len(body),bodysha))
    return dict(blocks=counts,occurrences=occurrence,n_samples=widths,malformed=mismatches,examples=examples)

if __name__=='__main__':
    print(json.dumps(audit(Path(sys.argv[1])),sort_keys=True))
