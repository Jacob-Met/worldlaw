python3 -E -B -c 'from pathlib import Path
import hashlib,json,os,stat,subprocess,signal,time,resource,sys,datetime,selectors
base=Path('"'"'/dev/shm/b93164ce-worldlaw-local-comparison-01'"'"');root=base/'"'"'source'"'"'
uiroot=Path('"'"'/dev/shm/b93164ce-worldlaw-local-comparison-ui-01/source'"'"')
from urllib.parse import quote
loader="import { registerHooks } from '"'"'node:module'"'"';\nconst panelURL = '"'"'file:///dev/shm/b93164ce-worldlaw-local-comparison-ui-01/source/src/science/local-motion-comparison-panel.mjs'"'"';\nconst coreURL = '"'"'file:///dev/shm/b93164ce-worldlaw-local-comparison-01/source/src/science/local-motion-comparison.mjs'"'"';\nregisterHooks({\n  resolve(specifier, context, nextResolve) {\n    if (specifier === '"'"'./local-motion-comparison.mjs'"'"' && context.parentURL === panelURL) {\n      return nextResolve(coreURL, context);\n    }\n    return nextResolve(specifier, context);\n  },\n});\n"
node=Path('"'"'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'"'"');node_sha='"'"'61ab14cd750fc24d5db53490ec5fc40f756e4b6e136b78cf7004265471d9bd1d'"'"'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert sha(base/'"'"'source-origins.json'"'"')=='"'"'905362d8099b2cf7d8c6c9cf3f5180c634e53aa415c756748de5a734dca082f1'"'"'
assert sha(base/'"'"'import-closure.json'"'"')=='"'"'106a5bb167266ff98c9b386de85a13f54aca6bc8b91fa58afc75be441108f2b2'"'"'
expected={r['"'"'path'"'"']:r for r in json.loads((base/'"'"'source-origins.json'"'"').read_bytes())['"'"'files'"'"']}
for row in json.loads((base/'"'"'candidate-pins.json'"'"').read_bytes())['"'"'files'"'"']:
 assert row['"'"'path'"'"']=='"'"'README.md'"'"' or row['"'"'path'"'"'] not in expected
 expected[row['"'"'path'"'"']]=row
expected['"'"'tests/local-motion-comparison.test.mjs'"'"']={'"'"'path'"'"':'"'"'tests/local-motion-comparison.test.mjs'"'"','"'"'sha256'"'"':'"'"'1b5ff02f8c8fe3ecc64a341c82c0a52859c16696775b81229114a6bdf99b7750'"'"','"'"'mode'"'"':'"'"'100644'"'"','"'"'bytes'"'"':8065}
assert len(expected)==49
assert expected['"'"'src/science/local-motion-comparison.mjs'"'"']['"'"'sha256'"'"']=='"'"'df5c7abeeb5941ffc5ff97f60d5841a140254fcf47e7c6976e0146e175396790'"'"'
assert expected['"'"'scripts/local-motion-comparison.mjs'"'"']['"'"'sha256'"'"']=='"'"'12b1fb1070bb83bfdf4d6462f595145823571a602f0759b1e396f61dd4aabea2'"'"'
ui_expected={
 '"'"'src/science/local-motion-comparison-panel.mjs'"'"':{'"'"'path'"'"':'"'"'src/science/local-motion-comparison-panel.mjs'"'"','"'"'bytes'"'"':6033,'"'"'sha256'"'"':'"'"'5efb0e44426d2ef06490cb56f7b4ffc78e509793464fd9af43808b110ba1a94c'"'"','"'"'git_blob'"'"':'"'"'31a67cc1520e9f321464765f960e5846eff6b7de'"'"','"'"'mode'"'"':'"'"'100644'"'"'},
 '"'"'tests/local-motion-comparison-panel.test.mjs'"'"':{'"'"'path'"'"':'"'"'tests/local-motion-comparison-panel.test.mjs'"'"','"'"'bytes'"'"':11869,'"'"'sha256'"'"':'"'"'332eae6c9f560306dafe3e72b79173a7aa208604a3e2b8b72121d23c49e6847f'"'"','"'"'git_blob'"'"':'"'"'e42dd3ba272f153802f4ba72035159b3b1b02383'"'"','"'"'mode'"'"':'"'"'100644'"'"'}
}
def check():
 assert sha(base/'"'"'source-origins.json'"'"')=='"'"'905362d8099b2cf7d8c6c9cf3f5180c634e53aa415c756748de5a734dca082f1'"'"'
 assert sha(base/'"'"'candidate-pins.json'"'"')=='"'"'307b39c6115e06a739379c0624465ac7b021c89f4e6eaeb4941797e862e6c5e6'"'"'
 assert sha(base/'"'"'import-closure.json'"'"')=='"'"'106a5bb167266ff98c9b386de85a13f54aca6bc8b91fa58afc75be441108f2b2'"'"'
 actual=set()
 for current,dirs,files in os.walk(root,followlinks=False):
  for n in dirs:assert not (Path(current)/n).is_symlink()
  for n in files:
   f=Path(current)/n;assert not f.is_symlink() and f.is_file();actual.add(f.relative_to(root).as_posix())
 assert actual==set(expected)
 for p,r in expected.items():
  f=root/p;assert f.stat().st_size==r['"'"'bytes'"'"'] and sha(f)==r['"'"'sha256'"'"'] and stat.S_IMODE(f.stat().st_mode)==int(r['"'"'mode'"'"'][-3:],8),p
 assert sha(node)==node_sha
 actual_ui=set()
 for current,dirs,files in os.walk(uiroot,followlinks=False):
  for n in dirs:assert not (Path(current)/n).is_symlink()
  for n in files:
   f=Path(current)/n;assert not f.is_symlink() and f.is_file();actual_ui.add(f.relative_to(uiroot).as_posix())
 assert actual_ui==set(ui_expected)
 for p,r in ui_expected.items():
  f=uiroot/p;assert f.stat().st_size==r['"'"'bytes'"'"'] and sha(f)==r['"'"'sha256'"'"'] and stat.S_IMODE(f.stat().st_mode)==int(r['"'"'mode'"'"'][-3:],8),p
 assert not root.is_symlink() and not uiroot.is_symlink()
 return {'"'"'files'"'"':len(expected)+len(ui_expected),'"'"'original_files'"'"':49,'"'"'ui_files'"'"':2,'"'"'all_bytes_modes_membership_equal'"'"':True,'"'"'node_sha256'"'"':node_sha}
def available_mem():return next(int(l.split()[1])*1024 for l in Path('"'"'/proc/meminfo'"'"').read_text().splitlines() if l.startswith('"'"'MemAvailable:'"'"'))
before=check();mem=available_mem()
if mem<536870912:raise RuntimeError('"'"'memory admission refused before Node'"'"')
os.sched_setaffinity(0,{min(os.sched_getaffinity(0))});os.nice(10)
command=[str(node),'"'"'--max-old-space-size=128'"'"','"'"'--import'"'"','"'"'data:text/javascript,'"'"'+quote(loader,safe='"'"''"'"'),'"'"'--test'"'"','"'"'--test-reporter=tap'"'"','"'"'--test-concurrency=1'"'"','"'"'tests/local-motion-comparison-panel.test.mjs'"'"']
receipt={'"'"'mode'"'"':'"'"'bounded in-memory stdout/stderr, no output directory or artifact files'"'"','"'"'started_utc'"'"':datetime.datetime.now(datetime.timezone.utc).isoformat(),'"'"'source_before'"'"':before,'"'"'pins'"'"':list(expected.values()),'"'"'ui_pins'"'"':list(ui_expected.values()),'"'"'command'"'"':command,'"'"'cwd'"'"':str(uiroot),'"'"'source_placement'"'"':{'"'"'original_root'"'"':str(root),'"'"'ui_root'"'"':str(uiroot),'"'"'full_checkout_copy'"'"':False,'"'"'exact_loader_text'"'"':loader,'"'"'loader_sha256'"'"':hashlib.sha256(loader.encode()).hexdigest(),'"'"'mapping'"'"':'"'"'Only the exact UI panel parent URL plus ./local-motion-comparison.mjs maps to the original pinned core; all other imports use nextResolve.'"'"','"'"'prior_copy_refusal_preserved'"'"':True,'"'"'docs_version'"'"':'"'"'v24.22.1'"'"','"'"'qualification'"'"':'"'"'Authored component fixture only; not browser or shared-hook integration'"'"'},'"'"'mem_available_before'"'"':mem,'"'"'limits'"'"':{'"'"'affinity'"'"':list(os.sched_getaffinity(0)),'"'"'nice'"'"':os.getpriority(os.PRIO_PROCESS,0),'"'"'wall_seconds'"'"':25,'"'"'cleanup_seconds'"'"':2,'"'"'cpu_seconds_per_process'"'"':10,'"'"'node_heap_mib'"'"':128,'"'"'each_stream_bytes'"'"':262144,'"'"'memory_floor_bytes'"'"':536870912},'"'"'status'"'"':'"'"'FAIL'"'"','"'"'cleanup_signals'"'"':[]}
env=dict(os.environ);env['"'"'NODE_OPTIONS'"'"']='"'"'--max-old-space-size=128'"'"'
for k in ['"'"'NODE_V8_COVERAGE'"'"','"'"'NODE_COMPILE_CACHE'"'"','"'"'NODE_PATH'"'"']:env.pop(k,None)
def limits():resource.setrlimit(resource.RLIMIT_CPU,(10,10));resource.setrlimit(resource.RLIMIT_FSIZE,(0,0))
started=time.monotonic();child=None;buffers={'"'"'stdout'"'"':bytearray(),'"'"'stderr'"'"':bytearray()};sel=selectors.DefaultSelector()
try:
 child=subprocess.Popen(command,cwd=uiroot,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits);receipt['"'"'pid'"'"']=child.pid
 for name,stream in [('"'"'stdout'"'"',child.stdout),('"'"'stderr'"'"',child.stderr)]:os.set_blocking(stream.fileno(),False);sel.register(stream,selectors.EVENT_READ,name)
 while sel.get_map():
  if time.monotonic()-started>25:raise TimeoutError('"'"'25-second unit wall bound'"'"')
  if available_mem()<536870912:raise RuntimeError('"'"'memory floor crossed'"'"')
  for key,_ in sel.select(.1):
   chunk=os.read(key.fileobj.fileno(),65536)
   if not chunk:sel.unregister(key.fileobj);continue
   name=key.data
   if len(buffers[name])+len(chunk)>262144:
    buffers[name].extend(chunk[:262144-len(buffers[name])]);receipt['"'"'capture_overflow'"'"']=name;raise RuntimeError('"'"'bounded memory stream limit'"'"')
   buffers[name].extend(chunk)
 receipt['"'"'child_exit'"'"']=child.wait(timeout=max(.1,25-(time.monotonic()-started)))
except BaseException as error:receipt['"'"'error'"'"']={'"'"'type'"'"':type(error).__name__,'"'"'message'"'"':str(error)}
finally:
 sel.close()
 if child is not None:
  def group_exists():
   try:os.killpg(child.pid,0);return True
   except ProcessLookupError:return False
  if group_exists():
   os.killpg(child.pid,signal.SIGTERM);receipt['"'"'cleanup_signals'"'"'].append('"'"'SIGTERM'"'"')
   try:child.wait(timeout=1)
   except subprocess.TimeoutExpired:pass
   if group_exists():
    os.killpg(child.pid,signal.SIGKILL);receipt['"'"'cleanup_signals'"'"'].append('"'"'SIGKILL'"'"');child.wait(timeout=1)
  receipt['"'"'owned_group_absent'"'"']=not group_exists()
  for f in [child.stdout,child.stderr]:f.close()
 receipt['"'"'wall_seconds'"'"']=time.monotonic()-started
 try:receipt['"'"'source_after'"'"']=check();receipt['"'"'source_unchanged'"'"']=receipt['"'"'source_after'"'"']==before
 except Exception as error:receipt['"'"'source_unchanged'"'"']=False;receipt['"'"'source_error'"'"']=str(error)
 for name,b in buffers.items():receipt[name]={'"'"'bytes'"'"':len(b),'"'"'sha256'"'"':hashlib.sha256(b).hexdigest(),'"'"'text'"'"':b.decode('"'"'utf-8'"'"','"'"'strict'"'"'),'"'"'complete'"'"':not receipt.get('"'"'capture_overflow'"'"') and '"'"'error'"'"' not in receipt}
 if receipt.get('"'"'child_exit'"'"')==0 and '"'"'error'"'"' not in receipt and receipt.get('"'"'owned_group_absent'"'"') and receipt['"'"'source_unchanged'"'"']:receipt['"'"'status'"'"']='"'"'PASS'"'"'
 print(json.dumps(receipt,ensure_ascii=False),flush=True)
raise SystemExit(0 if receipt['"'"'status'"'"']=='"'"'PASS'"'"' else 1)'
