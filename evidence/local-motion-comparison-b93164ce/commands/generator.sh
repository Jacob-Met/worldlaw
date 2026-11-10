python3 -E -B - <<'PY'
from pathlib import Path
import hashlib,json,os,stat,subprocess,signal,time,resource,sys,datetime,selectors
base=Path('/dev/shm/b93164ce-worldlaw-local-comparison-01');root=base/'source'
node=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node');node_sha='61ab14cd750fc24d5db53490ec5fc40f756e4b6e136b78cf7004265471d9bd1d'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert sha(base/'source-origins.json')=='905362d8099b2cf7d8c6c9cf3f5180c634e53aa415c756748de5a734dca082f1'
assert sha(base/'import-closure.json')=='106a5bb167266ff98c9b386de85a13f54aca6bc8b91fa58afc75be441108f2b2'
expected={r['path']:r for r in json.loads((base/'source-origins.json').read_bytes())['files']}
for row in json.loads((base/'candidate-pins.json').read_bytes())['files']:
 assert row['path']=='README.md' or row['path'] not in expected
 expected[row['path']]=row
expected['tests/local-motion-comparison.test.mjs']={'path':'tests/local-motion-comparison.test.mjs','sha256':'1b5ff02f8c8fe3ecc64a341c82c0a52859c16696775b81229114a6bdf99b7750','mode':'100644','bytes':8065}
assert len(expected)==49
assert expected['src/science/local-motion-comparison.mjs']['sha256']=='df5c7abeeb5941ffc5ff97f60d5841a140254fcf47e7c6976e0146e175396790'
assert expected['scripts/local-motion-comparison.mjs']['sha256']=='12b1fb1070bb83bfdf4d6462f595145823571a602f0759b1e396f61dd4aabea2'
def check():
 actual=set()
 for current,dirs,files in os.walk(root,followlinks=False):
  for n in dirs:assert not (Path(current)/n).is_symlink()
  for n in files:
   f=Path(current)/n;assert not f.is_symlink() and f.is_file();actual.add(f.relative_to(root).as_posix())
 assert actual==set(expected)
 for p,r in expected.items():
  f=root/p;assert f.stat().st_size==r['bytes'] and sha(f)==r['sha256'] and stat.S_IMODE(f.stat().st_mode)==int(r['mode'][-3:],8),p
 assert sha(node)==node_sha
 return {'files':len(expected),'all_bytes_modes_membership_equal':True,'node_sha256':node_sha}
def available_mem():return next(int(l.split()[1])*1024 for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:'))
before=check();mem=available_mem()
if mem<536870912:raise RuntimeError('memory admission refused before Node')
os.sched_setaffinity(0,{min(os.sched_getaffinity(0))});os.nice(10)
generator=base/'receiving-preparation/generate-inputs.mjs';generated=base/'receiving-inputs-01'
assert sha(generator)=='483668bb45b983a5be8ca411ea556eccb3e747c0a86e4afbfcb573f25791b5f6'
assert not generated.exists()
output_free=os.statvfs(base).f_bavail*os.statvfs(base).f_frsize
if output_free<8388608:raise RuntimeError('generator prelaunch output floor: '+str(output_free)+' <8388608; Node not launched')
command=[str(node),'--max-old-space-size=128',str(generator),'--source-root',str(root),'--output-dir',str(generated)]
receipt={'mode':'bounded in-memory logs; three capped generator artifacts in a new owned directory','started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_before':before,'pins':list(expected.values()),'command':command,'cwd':str(root),'mem_available_before':mem,'limits':{'affinity':list(os.sched_getaffinity(0)),'nice':os.getpriority(os.PRIO_PROCESS,0),'wall_seconds':25,'cleanup_seconds':2,'cpu_seconds_per_process':10,'node_heap_mib':128,'each_stream_bytes':262144,'memory_floor_bytes':536870912},'status':'FAIL','cleanup_signals':[],'generator_sha256':'483668bb45b983a5be8ca411ea556eccb3e747c0a86e4afbfcb573f25791b5f6','output_dir':str(generated),'output_free_before':output_free,'output_floor_bytes':8388608,'per_generated_file_limit_bytes':131072}
env=dict(os.environ);env['NODE_OPTIONS']='--max-old-space-size=128'
for k in ['NODE_V8_COVERAGE','NODE_COMPILE_CACHE','NODE_PATH']:env.pop(k,None)
def limits():resource.setrlimit(resource.RLIMIT_CPU,(10,10));resource.setrlimit(resource.RLIMIT_FSIZE,(131072,131072))
started=time.monotonic();child=None;buffers={'stdout':bytearray(),'stderr':bytearray()};sel=selectors.DefaultSelector()
try:
 child=subprocess.Popen(command,cwd=root,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits);receipt['pid']=child.pid
 for name,stream in [('stdout',child.stdout),('stderr',child.stderr)]:os.set_blocking(stream.fileno(),False);sel.register(stream,selectors.EVENT_READ,name)
 while sel.get_map():
  if time.monotonic()-started>25:raise TimeoutError('25-second unit wall bound')
  if available_mem()<536870912:raise RuntimeError('memory floor crossed')
  if os.statvfs(base).f_bavail*os.statvfs(base).f_frsize<4194304:raise RuntimeError('generator ongoing output reserve crossed')
  for key,_ in sel.select(.1):
   chunk=os.read(key.fileobj.fileno(),65536)
   if not chunk:sel.unregister(key.fileobj);continue
   name=key.data
   if len(buffers[name])+len(chunk)>262144:
    buffers[name].extend(chunk[:262144-len(buffers[name])]);receipt['capture_overflow']=name;raise RuntimeError('bounded memory stream limit')
   buffers[name].extend(chunk)
 receipt['child_exit']=child.wait(timeout=max(.1,25-(time.monotonic()-started)))
except BaseException as error:receipt['error']={'type':type(error).__name__,'message':str(error)}
finally:
 sel.close()
 if child is not None:
  def group_exists():
   try:os.killpg(child.pid,0);return True
   except ProcessLookupError:return False
  if group_exists():
   os.killpg(child.pid,signal.SIGTERM);receipt['cleanup_signals'].append('SIGTERM')
   try:child.wait(timeout=1)
   except subprocess.TimeoutExpired:pass
   if group_exists():
    os.killpg(child.pid,signal.SIGKILL);receipt['cleanup_signals'].append('SIGKILL');child.wait(timeout=1)
  receipt['owned_group_absent']=not group_exists()
  for f in [child.stdout,child.stderr]:f.close()
 receipt['wall_seconds']=time.monotonic()-started
 try:receipt['source_after']=check();receipt['source_unchanged']=receipt['source_after']==before
 except Exception as error:receipt['source_unchanged']=False;receipt['source_error']=str(error)
 for name,b in buffers.items():receipt[name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'text':b.decode('utf-8','strict'),'complete':not receipt.get('capture_overflow') and 'error' not in receipt}
 if receipt.get('child_exit')==0 and 'error' not in receipt and receipt.get('owned_group_absent') and receipt['source_unchanged']:receipt['status']='PASS'
 try:
  assert sha(generator)==receipt['generator_sha256']
  if receipt.get('child_exit')==0:
   assert {f.name for f in generated.iterdir()}=={'current-two-laws.json','after-measurement.json','manifest.json'}
   receipt['generated_files']=[{'path':str(f),'bytes':f.stat().st_size,'sha256':sha(f)} for f in sorted(generated.iterdir())]
   receipt['generator_manifest']=json.loads((generated/'manifest.json').read_bytes())
 except Exception as error:receipt['status']='FAIL';receipt['output_error']=str(error)
 print(json.dumps(receipt,ensure_ascii=False),flush=True)
raise SystemExit(0 if receipt['status']=='PASS' else 1)
PY