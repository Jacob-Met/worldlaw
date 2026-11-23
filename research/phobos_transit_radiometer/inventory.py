"""Inventory only PDS4 catalogue directories and Dataverse study metadata."""
import json
import hashlib
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.parse import urljoin
from urllib.error import URLError


class Directory(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a" and dict(attrs).get("href"):
            self.links.append(dict(attrs)["href"])


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent":"PDS public instrument inventory"}), timeout=30) as r:
        return r.read()


def list_directory(url):
    parser = Directory()
    data = fetch(url)
    parser.feed(data.decode("utf-8-sig"))
    return dict(url=url, sha256=hashlib.sha256(data).hexdigest(), links=parser.links)


base = "https://pds-geosciences.wustl.edu/insight/urn-nasa-pds-insight_rad/"
result = {}
for leaf in ("", "data_calibrated/", "data_derived/"):
    try:
        result[leaf] = list_directory(urljoin(base, leaf))
    except (OSError, URLError) as err:
        result[leaf] = {"refusal":str(err)[:180]}
try:
    url = "https://archive.data.jhu.edu/api/datasets/:persistentId/?persistentId=doi:10.7281/T1EPKRKR"
    dataset = json.loads(fetch(url))["data"]["latestVersion"]
    result["author_current_archive"] = [dict(id=f["dataFile"]["id"],name=f["dataFile"]["filename"],bytes=f["dataFile"]["filesize"],description=f.get("description")) for f in dataset["files"]]
except (OSError, KeyError, ValueError) as err:
    result["author_current_archive"] = {"refusal":str(err)[:180]}
result["thermal_scientific_rows_opened"] = result["array_current_rows_opened"] = 0
print(json.dumps(result, sort_keys=True))
