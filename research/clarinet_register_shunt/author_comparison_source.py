import hashlib,sys,zipfile,json
with zipfile.ZipFile(sys.argv[1]) as z:
 n=next(n for n in z.namelist() if n.endswith("/A_main_comparison_experiment.m"))
 b=z.read(n)
 print(json.dumps({"path":n,"sha":hashlib.sha256(b).hexdigest(),"source":b.decode("utf8",errors="replace")}))
