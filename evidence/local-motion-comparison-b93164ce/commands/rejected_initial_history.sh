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
case=json.loads("{\"name\":\"rejected_initial_history\",\"file\":\"after-measurement.json\",\"sha\":\"dab70f9c454efee38175d1f96dd7dcea8bbf2c00000ad87500eb79d7a9867050\",\"bytes\":18356,\"expected_exit\":1,\"extra\":[\"--history-index\",\"0\"],\"kind\":\"invalid_history\"}")
notebook=base/'receiving-inputs-01'/case['file']
assert sha(notebook)==case['sha'] and notebook.stat().st_size==case['bytes']
command=[str(node),'--max-old-space-size=128','scripts/local-motion-comparison.mjs','--notebook',str(notebook),'--position','1.3','--rate','.2','--inertia','1','--command','0','--duration','.1','--interval','.01']+case['extra']
receipt={'mode':'bounded in-memory logs; ordinary CLI from generated source-bound notebook file','started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_before':before,'source_origins_sha256':sha(base/'source-origins.json'),'candidate_pins_sha256':sha(base/'candidate-pins.json'),'same_source_pin_set_as':'ff3b6d actual ten-test course','command':command,'cwd':str(root),'mem_available_before':mem,'limits':{'affinity':list(os.sched_getaffinity(0)),'nice':os.getpriority(os.PRIO_PROCESS,0),'wall_seconds':25,'cleanup_seconds':2,'cpu_seconds_per_process':10,'node_heap_mib':128,'each_stream_bytes':262144,'memory_floor_bytes':536870912},'status':'FAIL','cleanup_signals':[]}
env=dict(os.environ);env['NODE_OPTIONS']='--max-old-space-size=128'
for k in ['NODE_V8_COVERAGE','NODE_COMPILE_CACHE','NODE_PATH']:env.pop(k,None)
def limits():resource.setrlimit(resource.RLIMIT_CPU,(10,10));resource.setrlimit(resource.RLIMIT_FSIZE,(0,0))
started=time.monotonic();child=None;buffers={'stdout':bytearray(),'stderr':bytearray()};sel=selectors.DefaultSelector()
try:
 child=subprocess.Popen(command,cwd=root,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits);receipt['pid']=child.pid
 for name,stream in [('stdout',child.stdout),('stderr',child.stderr)]:os.set_blocking(stream.fileno(),False);sel.register(stream,selectors.EVENT_READ,name)
 while sel.get_map():
  if time.monotonic()-started>25:raise TimeoutError('25-second unit wall bound')
  if available_mem()<536870912:raise RuntimeError('memory floor crossed')
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
 if receipt.get('child_exit')==case['expected_exit'] and 'error' not in receipt and receipt.get('owned_group_absent') and receipt['source_unchanged']:receipt['status']='PASS'
 try:
  assert sha(notebook)==case['sha']
  receipt['case']=case;receipt['input_unchanged']=True
  assert receipt.get('child_exit')==case['expected_exit']
  if case['expected_exit']==1:
   assert receipt['stdout']['bytes']==0
   wanted='original earlier competitive laws' if case['kind']=='invalid_history' else 'requires nonnegative decimal integer text'
   assert wanted in receipt['stderr']['text']
   receipt['consumer_assertions']={'expected_refusal':True,'no_stdout_or_fallback':True,'refusal_message':wanted}
  else:
   assert receipt['stderr']['bytes']==0
   report=json.loads(receipt['stdout']['text'])
   assert report['status']=='completed' and report['candidateCount']==2 and len(report['results'])==2
   assert report['notebook']['sha256']==case['sha'] and report['notebook']['bytes']==case['bytes'] and report['notebook']['originalCandidateCount']==2
   assert report['notebook']['selection']['kind']==case['kind']
   if case['kind']=='current':
    assert report['schema']=='worldlaw.local-motion-comparison/v1' and report['motion']['completedCount']==2
    for i,row in enumerate(report['results']):
     outcome=report['motion']['results'][i];assert row['index']==i and outcome['index']==i
     assert row['executionStatus']=='completed' and row['response']['status']=='computed'
     course=row['response']['course'];assert len(outcome['trajectory'])==len(course['rows'])==11
     assert course['source']=={'model':{'schema':row['model']['schema'],'terms':row['model']['terms']},'inertia':1,'command':0}
     for k,(state,response) in enumerate(zip(outcome['trajectory'],course['rows'])):
      assert response['index']==k and response['time']==state['time'] and response['position']==state['position'] and response['rate']==state['rate'] and response['jointTorque']==state['jointTorque']
    assert [x['time'] for x in report['motion']['results'][0]['trajectory']]==[x['time'] for x in report['motion']['results'][1]['trajectory']]
    receipt['initial_position_derivatives']=[r['response']['course']['rows'][0]['torqueByPosition'] for r in report['results']]
    assert receipt['initial_position_derivatives'][0]!=receipt['initial_position_derivatives'][1]
   else:
    assert report['schema']=='worldlaw.local-motion-comparison-sample/v1' and report['notebook']['selection']['historyIndex']==2
    assert report['sampleIndex']==2 and report['time']==.02
    assert report['execution']['candidateCount']==report['execution']['completedCount']==2 and report['execution']['refusedCount']==0
    assert report['execution']['settings']['inertia']==1 and report['execution']['settings']['command']==0 and report['execution']['work']['perModelEvaluationLimit']==120000
    for i,row in enumerate(report['results']):
     assert row['index']==i and row['executionStatus']=='completed' and row['response']['status']=='computed'
     assert row['response']['source']=={'model':{'schema':row['model']['schema'],'terms':row['model']['terms']},'inertia':1,'command':0}
     assert row['state']['time']==row['response']['row']['time']==.02 and row['response']['row']['index']==2
     assert row['state']['position']==row['response']['row']['position'] and row['state']['rate']==row['response']['row']['rate']
   receipt['consumer_assertions']={'raw_notebook_identity':True,'original_population':2,'own_model_state_and_response':True,'selection':case['kind'],'complete_requested_grid':True}
 except Exception as error:receipt['status']='FAIL';receipt['consumer_error']=str(error)
 print(json.dumps(receipt,ensure_ascii=False),flush=True)
raise SystemExit(0 if receipt['status']=='PASS' else 1)
PY