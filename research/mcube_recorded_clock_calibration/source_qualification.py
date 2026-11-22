"""Read author metadata and archive magic only; never decode a push measurement."""
import hashlib
import json
import urllib.error
import urllib.request
from html.parser import HTMLParser

SITE = "https://web.mit.edu/mcube/push-dataset/index.html"


def request(url, method="GET", headers=None):
    return urllib.request.urlopen(urllib.request.Request(
        url, method=method, headers={"User-Agent": "physical-source-qualification/1", **(headers or {})}), timeout=30)


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.append(dict(attrs).get("href", ""))


def emit(**fields):
    print(json.dumps(fields, sort_keys=True), flush=True)


def probe(url):
    for method in ("HEAD", "GET"):
        try:
            with request(url, method, {"Range": "bytes=0-3"} if method == "GET" else None) as response:
                # Never read the body past the four-byte discriminator, even if a server ignores Range.
                signature = response.read(4).hex() if method == "GET" else None
                emit(url=url, method=method, status=response.status, type=response.headers.get("Content-Type"),
                     length=response.headers.get("Content-Length"), range=response.headers.get("Content-Range"),
                     disposition=response.headers.get("Content-Disposition"), magic=signature,
                     final_host=urllib.parse.urlsplit(response.url).hostname)
        except (OSError, ValueError) as error:
            emit(url=url, method=method, error=type(error).__name__, status=getattr(error, "code", None),
                 reason=str(error)[:180])


def main():
    with request(SITE) as response:
        page = response.read()
    parser = Anchors()
    parser.feed(page.decode("utf-8", errors="replace"))
    targets = [link for link in parser.links if "rect1_json.zip" in link or "unreliable_files.txt" in link]
    if len(targets) != 2:
        raise ValueError("Author archive/exclusion link census changed")
    emit(site=SITE, page_sha256=hashlib.sha256(page).hexdigest(), links=targets)
    for link in targets:
        probe(link)
        if "dl=0" in link:
            probe(link.replace("dl=0", "dl=1"))
    # Only public documentation and program text are eligible for this qualification.
    for repo, path in [("mcubelab/pdproc", "scripts/preprocess.py"),("peterkty/pnpush", "catkin_ws/src/pnpush_planning/src/analyze/parse_bagfile_to_rawjson.py")]:
        rev = {"peterkty/pnpush": "c8352f5fe9a4f03aa07bf3753e04ca7898df6e1f",
               "mcubelab/pdproc": "b187315443eb269c95d2b1d6ce9e1ef047facf1b"}[repo]
        url = "https://raw.githubusercontent.com/" + repo + "/" + rev + "/" + path
        with request(url) as response:
            code = response.read()
        emit(repo=repo, revision=rev, path=path, source_sha256=hashlib.sha256(code).hexdigest(),
             lines=[(i, line[:180]) for i, line in enumerate(code.decode().splitlines(), 1)
                    if any(key in line.lower() for key in ("resample", "interpolat", "time", "set_index", "wrench"))
                    ][:40])
    emit(held_pose_arrays_opened=0, force_arrays_opened=0, geometry_values_decoded=0)


if __name__ == "__main__":
    main()
