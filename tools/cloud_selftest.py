"""Backend self-test for the cloud saves (RLS isolation, revisions, conflicts, backups).

Needs SUPABASE_ACCESS_TOKEN (Management API) in the environment. Creates two throw-away test accounts with the
admin API (service key kept in memory only), runs the checks with their own sessions exactly like the game does,
then deletes the accounts (their rows go with them). Prints PASS/FAIL lines only — no secret is ever printed.
Usage: python tools/cloud_selftest.py [--keep]   (--keep leaves the test accounts and prints a JSON session file
path for browser tests, written to %TEMP%; delete it afterwards)."""
import json, os, re, secrets, sys, tempfile, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN', '').strip()
cfg = open(os.path.join(ROOT, 'js', 'net', 'config.js'), encoding='utf-8').read()
URL = re.search(r"url: '([^']*)'", cfg).group(1)
PUB = re.search(r"key: '([^']*)'", cfg).group(1)
REF = URL.split('//')[1].split('.')[0]
results = []


def req(method, url, body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method, headers=dict({'Content-Type': 'application/json'}, **(headers or {})))
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            txt = res.read().decode()
            return res.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode(errors='replace')
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt


def check(name, ok, info=''):
    results.append(ok)
    print(('PASS ' if ok else 'FAIL ') + name + (('  — ' + info) if info and not ok else ''), flush=True)


def service_key():
    st, keys = req('GET', 'https://api.supabase.com/v1/projects/%s/api-keys?reveal=true' % REF, headers={'Authorization': 'Bearer ' + TOKEN})
    for k in keys or []:
        if k.get('type') == 'secret' and k.get('api_key'):
            return k['api_key']
    for k in keys or []:
        if k.get('name') == 'service_role' and k.get('api_key'):
            return k['api_key']
    raise SystemExit('service key not available')


def main():
    keep = '--keep' in sys.argv
    svc = service_key()
    admin = {'apikey': svc, 'Authorization': 'Bearer ' + svc}
    users = []
    for tag in ('a', 'b'):
        email = 'te-selftest-%s-%s@example.com' % (tag, secrets.token_hex(4))
        pw = secrets.token_urlsafe(18)
        st, u = req('POST', URL + '/auth/v1/admin/users', {'email': email, 'password': pw, 'email_confirm': True}, admin)
        assert st in (200, 201), (st, u)
        st, sess = req('POST', URL + '/auth/v1/token?grant_type=password', {'email': email, 'password': pw}, {'apikey': PUB})
        assert st == 200, (st, sess)
        users.append({'id': u['id'], 'email': email, 'sess': sess})
    A, B = users
    hA = {'apikey': PUB, 'Authorization': 'Bearer ' + A['sess']['access_token']}
    hB = {'apikey': PUB, 'Authorization': 'Bearer ' + B['sess']['access_token']}
    anon = {'apikey': PUB}

    def push(h, base, force=False, payload='{"x":1}', cs=None, dev='dev-a'):
        return req('POST', URL + '/rest/v1/rpc/te_push_save', {
            'p_slot': 0, 'p_base_revision': base, 'p_force': force, 'p_payload': payload, 'p_encoding': 'json',
            'p_checksum': cs or secrets.token_hex(8), 'p_size': len(payload), 'p_game_version': 'test', 'p_save_version': 2,
            'p_device_id': dev, 'p_device_label': 'Test', 'p_summary': {'nw': 1}}, h)

    try:
        st, r = push(hA, 0)
        check('A first upload -> revision 1', st == 200 and r.get('status') == 'ok' and r.get('revision') == 1, str(r))
        st, r = push(hA, 1)
        check('A upload based on rev 1 -> revision 2', st == 200 and r.get('revision') == 2, str(r))
        st, r = push(hA, 1, dev='dev-b')
        check('stale device (based on rev 1) -> CONFLICT, nothing overwritten', st == 200 and r.get('status') == 'conflict' and r.get('revision') == 2, str(r))
        st, r = push(hA, 2, force=True, dev='dev-b')
        check('explicit overwrite (force) -> revision 3', st == 200 and r.get('revision') == 3, str(r))
        st, rows = req('GET', URL + '/rest/v1/save_backups?select=revision,device_id&order=revision.desc', headers=hA)
        check('overwritten version archived', st == 200 and any(x['revision'] == 2 for x in rows), str(rows))
        for i in range(8):
            push(hA, 3 + i, force=True, dev='dev-%d' % i)
        st, rows = req('GET', URL + '/rest/v1/save_backups?select=revision', headers=hA)
        check('at most 5 previous versions kept', st == 200 and len(rows) == 5, 'count=%s' % (len(rows) if isinstance(rows, list) else rows))
        st, rows = req('GET', URL + '/rest/v1/saves?select=user_id,revision', headers=hA)
        check('A reads exactly its own save', st == 200 and len(rows) == 1 and rows[0]['user_id'] == A['id'], str(rows))
        # isolation
        st, rows = req('GET', URL + '/rest/v1/saves?select=*', headers=hB)
        check('B cannot see A\'s save', st == 200 and rows == [], str(rows)[:200])
        st, rows = req('GET', URL + '/rest/v1/saves?user_id=eq.%s&select=payload' % A['id'], headers=hB)
        check('B cannot read A\'s save even by user_id', st == 200 and rows == [], str(rows)[:200])
        st, rows = req('GET', URL + '/rest/v1/save_backups?select=*', headers=hB)
        check('B cannot see A\'s backups', st == 200 and rows == [], str(rows)[:200])
        st, r = req('PATCH', URL + '/rest/v1/saves?user_id=eq.%s' % A['id'], {'payload': 'hacked'}, dict(hB, Prefer='return=representation'))
        check('B cannot modify A\'s save (UPDATE refused)', st in (401, 403, 404) or r == [], '%s %s' % (st, str(r)[:200]))
        st, r = req('DELETE', URL + '/rest/v1/saves?user_id=eq.%s' % A['id'], None, dict(hB, Prefer='return=representation'))
        check('B cannot delete A\'s save', st in (401, 403, 404) or r == [], '%s %s' % (st, str(r)[:200]))
        st, r = req('POST', URL + '/rest/v1/saves', {'user_id': A['id'], 'slot': 1, 'payload': 'x', 'checksum': 'x'}, hB)
        check('B cannot insert a save for A', st in (401, 403), '%s %s' % (st, str(r)[:200]))
        st, r = req('POST', URL + '/rest/v1/saves', {'user_id': A['id'], 'slot': 1, 'payload': 'x', 'checksum': 'x'}, hA)
        check('direct INSERT refused even for the owner (writes only via te_push_save)', st in (401, 403), '%s %s' % (st, str(r)[:200]))
        st, r = push(hB, 0, dev='dev-b')
        check('B gets its own independent save', st == 200 and r.get('revision') == 1, str(r))
        st, rows = req('GET', URL + '/rest/v1/saves?select=revision', headers=hA)
        check('A\'s save untouched by B', st == 200 and len(rows) == 1 and rows[0]['revision'] == 11, str(rows))
        # anonymous
        st, rows = req('GET', URL + '/rest/v1/saves?select=*', headers=anon)
        check('anonymous visitor reads nothing', (st in (401, 403)) or rows == [], '%s %s' % (st, str(rows)[:200]))
        st, r = push(anon, 0)
        check('anonymous visitor cannot write', st in (401, 403), '%s %s' % (st, str(r)[:200]))
        st, r = req('POST', URL + '/rest/v1/rpc/te_push_save', {'p_slot': 0}, hA)
        check('malformed call rejected', st >= 400, str(st))
    finally:
        if keep:
            p = os.path.join(tempfile.gettempdir(), 'te_test_sessions.json')
            with open(p, 'w', encoding='utf-8') as f:
                json.dump([{'email': u['email'], 'sess': u['sess']} for u in users], f)
            print('test accounts kept; sessions file:', p)
        else:
            for u in users:
                req('DELETE', URL + '/auth/v1/admin/users/' + u['id'], None, admin)
            print('test accounts deleted')
    print('%d/%d checks passed' % (sum(results), len(results)))
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main()
