"""Inventory the journal's separate public article and figure metadata; never fetch the refused dataset ZIP."""
import collections
import hashlib
import html.parser
import json
import urllib.request
URL="https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/faraday-waves-and-period-tripling-in-a-horizontal-circular-tank/D287DD0E83E77D4F81A926F1A1BCC8C3"
def fetch(url):
    with urllib.request.urlopen(url,timeout=90) as f:
        return f.read(8000000)
class Tags(html.parser.HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.figures=[]
    def handle_starttag(self,tag,attrs):
        a={k:(v or "") for k,v in attrs}
        if tag=="meta" and a.get("name") in ("citation_pdf_url","citation_doi"):
            self.links.append([a["name"],a.get("content")])
        if tag=="a" and ("pdf" in a.get("href","").lower() or "figure" in a.get("href","").lower()) and len(self.links)<160:
            self.links.append(["href",a.get("href")])
        if tag=="img" and ("fig" in a.get("src","").lower() or "fig" in a.get("alt","").lower()):
            self.figures.append([a.get("id"),a.get("src"),a.get("data-src")])
b=fetch(URL);p=Tags();p.feed(b.decode("utf-8"));print(json.dumps({"url":URL,"primary_html_bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"links":p.links,"figure_image_metadata":p.figures,"physical_rows_read":0},sort_keys=True))
