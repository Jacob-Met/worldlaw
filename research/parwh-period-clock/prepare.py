"""Fetch the exact public organizer archive and the released GRU checkpoint."""
import argparse
import hashlib
from pathlib import Path
import tempfile
import urllib.request

FILES = {
    'ParWHFiles.zip': (
        'https://data.4tu.nl/file/5edca002-b132-4985-b8b9-2353c6e85292/2aaf0790-9ade-43d5-a718-39062524fc93',
        '9d01efe9264a921f83b326ee72fdd1ba0e87063cb67265b750efb8e04a4b385d'),
    'released-GRU_ParWH.npz': (
        'https://raw.githubusercontent.com/MDCHAMP/nonlinear_baselines/d9c4972f6bd59cfdde23a014bc57579e2af957aa/results/GRU_ParWH.npz',
        'ccd1d968c31c358d7af2b9a0eafd43db7bb759d33ed2efa20377ad079fe9f04c'),
}


def acquire(directory, name, url, digest):
    destination = directory / name
    if destination.exists():
        if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Existing file has a different SHA-256: {name}')
        return
    request = urllib.request.Request(url, headers={'User-Agent': 'WORLDLAW scientific result receiver'})
    with tempfile.NamedTemporaryFile(dir=directory, delete=False) as temporary:
        partial = Path(temporary.name)
        try:
            checksum = hashlib.sha256()
            with urllib.request.urlopen(request, timeout=90) as source:
                while block := source.read(1 << 20):
                    checksum.update(block)
                    temporary.write(block)
            if checksum.hexdigest() != digest:
                raise ValueError(f'SHA-256 mismatch for {name}')
            temporary.flush()
            partial.replace(destination)
        finally:
            partial.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    destination = parser.parse_args().directory
    destination.mkdir(parents=True, exist_ok=True)
    for name, (url, digest) in FILES.items():
        acquire(destination, name, url, digest)
        print(name, digest)
