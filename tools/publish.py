#!/usr/bin/env python3
"""Publishes Mail Deck to the Chrome Web Store through its V2 API, as a service account.

  tools/publish.py status             the live version, the one in review, the last upload
  tools/publish.py upload             package the manifest's version and upload it as a draft
  tools/publish.py submit [--staged]  upload it and send it to review; --staged keeps it back
                                      after approval until it is published from the dashboard
  tools/publish.py cancel             take back the version in review, so a newer one can go instead
  tools/publish.py reviews [N]        the latest N reviews (20), newest first
  tools/publish.py stats [DAYS]       rating, then installs, uninstalls and users per day (7 days)
  tools/publish.py rollback VERSION NEW REASON
                                      ship the earlier VERSION again as NEW, e.g. 1.1.0 1.2.2 "crash"

Once per machine:
  ~/.config/mail-deck/cws-key.json  the service account's JSON key, chmod 600
  ~/.config/mail-deck/cws.env       CWS_PUBLISHER_ID=<Developer Dashboard, Publisher > Settings>
The service account's email is added in the Developer Dashboard, under Account.
"""
import base64
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.expanduser('~/.config/mail-deck')
ITEM = 'hjlkjemogfgkpbbnogihekjcdmafecff'
SCOPE = 'https://www.googleapis.com/auth/chromewebstore'
API = 'https://chromewebstore.googleapis.com'


def fail(text):
    sys.exit('publish: ' + text)


def publisher():
    env = {}
    try:
        with open(os.path.join(CONFIG, 'cws.env')) as f:
            for line in f:
                k, _, v = line.strip().partition('=')
                env[k] = v.strip('"\'')
    except FileNotFoundError:
        pass
    pid = os.environ.get('CWS_PUBLISHER_ID') or env.get('CWS_PUBLISHER_ID')
    if not pid:
        fail(f'no CWS_PUBLISHER_ID in {CONFIG}/cws.env')
    return pid


def request(url, data=None, headers=None, method='POST'):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read()
    except urllib.error.HTTPError as e:
        fail(f'{method} {url} -> {e.code}\n{e.read().decode(errors="replace")}')
    return json.loads(body) if body else {}


# a JWT signed with the key buys an hour-long access token; openssl signs it, the key goes in on stdin
def token():
    try:
        with open(os.path.join(CONFIG, 'cws-key.json')) as f:
            key = json.load(f)
    except FileNotFoundError:
        fail(f'no service account key at {CONFIG}/cws-key.json')
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=')
    now = int(time.time())
    claims = {'iss': key['client_email'], 'scope': SCOPE, 'aud': key['token_uri'], 'iat': now, 'exp': now + 600}
    unsigned = b64(json.dumps({'alg': 'RS256', 'typ': 'JWT'}).encode()) + b'.' + b64(json.dumps(claims).encode())
    with tempfile.NamedTemporaryFile() as data:
        data.write(unsigned)
        data.flush()
        sig = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', '/dev/stdin', data.name],
                             input=key['private_key'].encode(), capture_output=True, check=True).stdout
    form = urllib.parse.urlencode({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': (unsigned + b'.' + b64(sig)).decode()
    }).encode()
    return request(key['token_uri'], form, {'Content-Type': 'application/x-www-form-urlencoded'})['access_token']


def manifest_version():
    with open(os.path.join(ROOT, 'extension', 'manifest.json')) as f:
        return json.load(f)['version']


def fetch_status(auth, name):
    return request(f'{API}/v2/{name}:fetchStatus', headers=auth, method='GET')


def show(status):
    def revision(label, rev):
        if not rev:
            print(f'{label:10} -')
            return
        channels = ', '.join(f"{c.get('crxVersion', '?')} at {c.get('deployPercentage', '?')}%"
                             for c in rev.get('distributionChannels', [])) or 'no channels'
        print(f"{label:10} {rev.get('state', '?')}: {channels}")
    revision('live', status.get('publishedItemRevisionStatus'))
    revision('in review', status.get('submittedItemRevisionStatus'))
    print(f"{'upload':10} {status.get('lastAsyncUploadState', '-')}")
    if status.get('takenDown') or status.get('warned'):
        print(f"WARNING   takenDown={status.get('takenDown')} warned={status.get('warned')}")


def upload(auth, name):
    version = manifest_version()
    known = [c.get('crxVersion') for key in ('publishedItemRevisionStatus', 'submittedItemRevisionStatus')
             for c in (fetch_status(auth, name).get(key) or {}).get('distributionChannels', [])]
    if version in known:
        fail(f'the store already has {version}; raise "version" in extension/manifest.json')
    path = subprocess.run([os.path.join(ROOT, 'tools', 'package.sh')], capture_output=True, text=True,
                          check=True).stdout.strip()
    with open(os.path.join(ROOT, path), 'rb') as f:
        zipped = f.read()
    print(f'uploading {path} ({len(zipped) // 1024} KB)')
    r = request(f'{API}/upload/v2/{name}:upload', zipped, {**auth, 'Content-Type': 'application/zip'})
    state = r.get('uploadState', '')
    # a large package is processed after the request returns
    for _ in range(40):
        if 'IN_PROGRESS' not in state:
            break
        time.sleep(3)
        state = fetch_status(auth, name).get('lastAsyncUploadState', '')
    if 'SUCCEEDED' not in state:
        fail(f'upload ended as {state or "?"}: {json.dumps(r)}')
    print(f'uploaded {version}')


# the notes GitHub's release takes (.github/workflows/release.yml); a version without them
# would reach the store and leave the release failing
def changelog(version):
    with open(os.path.join(ROOT, 'CHANGELOG.md'), encoding='utf-8') as f:
        text = f.read()
    m = re.search(r'^## ' + re.escape(version) + r'\b[^\n]*\n(.*?)(?=^## |\Z)', text, re.M | re.S)
    if not m or not m.group(1).strip():
        fail(f'CHANGELOG.md has no notes for {version}; add a "## {version}" section first')


def submit(auth, name, staged):
    changelog(manifest_version())
    upload(auth, name)
    r = request(f'{API}/v2/{name}:publish',
                json.dumps({'publishType': 'STAGED_PUBLISH' if staged else 'DEFAULT_PUBLISH'}).encode(),
                {**auth, 'Content-Type': 'application/json'})
    print(f"submitted: {r.get('state', '?')}")
    for w in (r.get('warningInfo') or {}).get('warnings', []):
        print(f"warning: {w.get('reason')}: {w.get('description')}")


def cancel(auth, name):
    request(f'{API}/v2/{name}:cancelSubmission', b'{}', {**auth, 'Content-Type': 'application/json'})
    print('cancelled the submission in review')


def reviews(auth, name, count):
    r = request(f'{API}/v2/{name}:fetchReviews?pageSize={count}', headers=auth, method='GET')
    for rv in r.get('reviews', []):
        author = (rv.get('authorInfo') or {}).get('displayName', '?')
        print(f"{rv.get('createTime', '')[:10]}  {'★' * rv.get('rating', 0):5}  {author}: {rv.get('comment', '').strip()}")
    if not r.get('reviews'):
        print('no reviews')


def stats(auth, name, days):
    s = request(f'{API}/v2/{name}/ratingSummary', headers=auth, method='GET')
    print(f"rating {s.get('rating', '-')} from {s.get('ratingCount', 0)} ratings, {s.get('nonEmptyReviewCount', 0)} with text")
    last = datetime.date.today() - datetime.timedelta(days=1)
    first = last - datetime.timedelta(days=days - 1)
    # the API takes one metric per request; the days are joined here
    days_seen = {}
    for metric in ('installs', 'uninstalls', 'users'):
        query = urllib.parse.urlencode({
            'metrics': metric,
            'timeSpec.firstDate.year': first.year, 'timeSpec.firstDate.month': first.month, 'timeSpec.firstDate.day': first.day,
            'timeSpec.lastDate.year': last.year, 'timeSpec.lastDate.month': last.month, 'timeSpec.lastDate.day': last.day,
            'pageSize': 100
        })
        r = request(f'{API}/v2/{name}:queryMetrics?{query}', headers=auth, method='GET')
        for row in r.get('metricRows', []):
            d = row.get('date', {})
            day = f"{d.get('year', 0):04}-{d.get('month', 0):02}-{d.get('day', 0):02}"
            for m in row.get('metricValues', []):
                days_seen.setdefault(day, {})[metric] = m.get('value', '0')
    print(f"{'day':10}  {'installs':>8}  {'uninstalls':>10}  {'users':>6}")
    for day in sorted(days_seen):
        v = days_seen[day]
        print(f"{day}  {v.get('installs', '0'):>8}  {v.get('uninstalls', '0'):>10}  {v.get('users', '0'):>6}")
    if not days_seen:
        print('no data for these days')


def rollback(auth, name, target, version, reason):
    r = request(f'{API}/v2/{name}:rollback', json.dumps({
        'targetCrxVersion': target, 'newVersion': version, 'rollbackReason': reason
    }).encode(), {**auth, 'Content-Type': 'application/json'})
    print(f'rolled back to {target} as {version}: {json.dumps(r)}')


def main(args):
    cmd = args[0] if args else 'status'
    if cmd not in ('status', 'upload', 'submit', 'cancel', 'reviews', 'stats', 'rollback'):
        sys.exit(__doc__)
    name = f'publishers/{publisher()}/items/{ITEM}'
    auth = {'Authorization': 'Bearer ' + token()}
    if cmd == 'status':
        print(f'manifest   {manifest_version()}')
        show(fetch_status(auth, name))
    elif cmd == 'upload':
        upload(auth, name)
    elif cmd == 'cancel':
        cancel(auth, name)
    elif cmd == 'reviews':
        reviews(auth, name, int(args[1]) if len(args) > 1 else 20)
    elif cmd == 'stats':
        stats(auth, name, int(args[1]) if len(args) > 1 else 7)
    elif cmd == 'rollback':
        if len(args) < 4:
            sys.exit(__doc__)
        rollback(auth, name, args[1], args[2], ' '.join(args[3:]))
    else:
        submit(auth, name, '--staged' in args)


if __name__ == '__main__':
    main(sys.argv[1:])
