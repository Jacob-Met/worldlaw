import urllib.request,json,csv,io,hashlib,collections,ast,math
m=json.load(urllib.request.urlopen("https://zenodo.org/api/records/8363718",timeout=30)); f=next(f for f in m["files"] if f["checksum"]=="md5:442e5b6ac866909d42d62a1610568995"); b=urllib.request.urlopen(f["links"].get("content",f["links"]["self"]),timeout=30).read(); assert len(b)==832470 and hashlib.md5(b).hexdigest()==f["checksum"][4:]
rows=csv.DictReader(io.StringIO(b.decode("utf-8-sig"))); assert set(rows.fieldnames)=={"","job_id","completion_date","theta_full","measurement_basis","n","counts"}
def tag(s):
 return hashlib.sha256(s.encode()).hexdigest()
by=collections.defaultdict(list); date=collections.defaultdict(set); angles=collections.Counter(); grids=collections.Counter(); basis=collections.Counter(); model=[]
for rr in rows:
 # CSV's text lexer necessarily passes through the full row. Only design columns are selected; counts are never converted or inspected.
 j=rr["job_id"];d=rr["completion_date"];a=str(rr["theta_full"]);m=rr["measurement_basis"]; depths=rr["n"].strip();assert depths.startswith("[") and depths.endswith("]"); ns=tuple(int(x) for x in depths[1:-1].split())
 assert ns and all(isinstance(n,int) and n>=0 for n in ns)
 by[j].append((a,m,ns));date[j].add(d);angles[a]+=1;basis[m]+=1;grids[ns]+=1;model.append([j,d,a,m,ns])
jc=collections.Counter();equiv=collections.Counter();zero_duplicate=0
for j,v in by.items():
 A={a for a,m,ns in v};B={m for a,m,ns in v}; keys=[(a,m) for a,m,ns in v];jc[str((len(A),len(B),len(v),len(set(keys)),len(date[j])))] +=1
 if len(keys)>len(set(keys)): zero_duplicate+=1
 eq={tuple(sorted(m for ax,m,ns in v if ax==a)) for a in A};equiv[str(sorted(eq))]+=1
days=collections.Counter(s.split('T')[0].split(' ')[0] for j,l in date.items() for s in l)
print(json.dumps(dict(archive_sha256=hashlib.sha256(b).hexdigest(),design_sha256=tag(json.dumps(model,separators=(',',':'))),header=rows.fieldnames,design_rows=len(model),job_count=len(by),groups=dict(jc),basis=dict(basis),angles=dict(angles),grids={str(k):v for k,v in grids.items()},duplicate_key_jobs=zero_duplicate,basis_coverage=dict(equiv),days=dict(days),measured_counts_inspected=False),sort_keys=True))