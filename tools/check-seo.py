"""Checks the search-engine pages: title and description length, one <h1>, canonical, valid JSON-LD,
and that every link between the pages points at a file that exists. Run: python tools/check-seo.py"""
import json, os, re, sys
from html.parser import HTMLParser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = 'https://smahfuzm.in/quran-noor/'

class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.title = ''; self.in_title = False; self.h1 = 0; self.meta = {}; self.links = []; self.ld = []; self.in_ld = False; self.canon = None
    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == 'title': self.in_title = True
        if tag == 'h1': self.h1 += 1
        if tag == 'meta': self.meta[a.get('name') or a.get('property')] = a.get('content', '')
        if tag == 'link' and a.get('rel') == 'canonical': self.canon = a.get('href')
        if tag == 'a' and a.get('href'): self.links.append(a['href'])
        if tag == 'script' and a.get('type') == 'application/ld+json': self.in_ld = True; self.ld.append('')
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
        if tag == 'script': self.in_ld = False
    def handle_data(self, d):
        if self.in_title: self.title += d
        if self.in_ld: self.ld[-1] += d

def local(url):
    """the file a site address maps to, or None for other sites, app (#/) and mail links"""
    if url.startswith('mailto:') or url.startswith('#'): return None
    if url.startswith(SITE): url = url[len(SITE):]
    elif re.match(r'^[a-z]+:', url): return None
    url = url.split('#')[0].split('?')[0]
    if url == '': return 'index.html'
    return url + 'index.html' if url.endswith('/') else url

pages = ['index.html', 'surah/index.html'] + [f'surah/{d}/index.html' for d in sorted(os.listdir(os.path.join(ROOT, 'surah'))) if os.path.isdir(os.path.join(ROOT, 'surah', d))]
problems = []
for rel in pages:
    p = P(); p.feed(open(os.path.join(ROOT, rel), encoding='utf8').read())
    t, d = p.title.strip(), p.meta.get('description', '')
    if not 20 <= len(t) <= 90: problems.append(f'{rel}: title is {len(t)} characters')
    if not 70 <= len(d) <= 320: problems.append(f'{rel}: description is {len(d)} characters')
    if p.h1 != 1: problems.append(f'{rel}: {p.h1} <h1>')
    if not p.canon or not p.canon.startswith(SITE): problems.append(f'{rel}: canonical {p.canon}')
    if not p.meta.get('og:image'): problems.append(f'{rel}: no og:image')
    for block in p.ld:
        try: json.loads(block)
        except Exception as e: problems.append(f'{rel}: JSON-LD {e}')
    base = os.path.dirname(rel)
    for href in p.links:
        f = local(href)
        if f is None: continue
        target = os.path.normpath(os.path.join(ROOT, f if href.startswith(SITE) else os.path.join(base, f)))
        if not os.path.exists(target): problems.append(f'{rel}: broken link {href}')

sm = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf8').read()
locs = re.findall(r'<loc>(.*?)</loc>', sm)
for u in locs:
    f = local(u)
    if f and not os.path.exists(os.path.join(ROOT, f)): problems.append(f'sitemap: {u} has no file')
print(f'{len(pages)} pages, {len(locs)} sitemap addresses checked')
print('\n'.join(problems[:40]) if problems else 'no problems found')
sys.exit(1 if problems else 0)
