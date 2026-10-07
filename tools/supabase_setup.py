"""One-shot provisioning of the TRADING EMPIRE cloud-save backend on Supabase (Management API).

Needs a Supabase personal access token in the SUPABASE_ACCESS_TOKEN environment variable (never printed, never
written to disk by this script). Steps (idempotent):
  1. find or create the project "trading-empire" (region eu-west-3, Paris) — DB password generated randomly and
     stored only in %USERPROFILE%\\.trading-empire\\db-password.txt (outside the repository);
  2. apply supabase/migrations/*.sql (tables, RLS, te_push_save);
  3. auth settings: site URL / redirect URLs of the game, e-mail sign-in with a 6-digit code (French e-mails);
  4. write the PUBLIC values (project URL + publishable/anon key) into js/net/config.js.
Prints only public information."""
import glob, json, os, secrets, string, sys, time, urllib.error, urllib.request

API = 'https://api.supabase.com/v1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = 'trading-empire'
REGION = os.environ.get('TE_REGION', 'eu-west-3')
SITE = os.environ.get('TE_SITE_URL', 'https://tozbz.github.io/trading-empire/')
REDIRECTS = [SITE + '**', 'http://localhost:8766/**', 'http://127.0.0.1:8766/**', 'http://localhost:8791/**', 'http://127.0.0.1:8791/**']
TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN', '').strip()

EMAIL_HTML = """<div style="font-family:Segoe UI,Arial,sans-serif;background:#05070b;color:#d6e2f0;padding:28px;border-radius:10px;max-width:520px">
  <div style="font-weight:700;letter-spacing:3px;font-size:18px">TRADING <span style="color:#19e6ff">EMPIRE</span></div>
  <p style="color:#8ea3bf">Votre code de connexion (sauvegarde cloud) :</p>
  <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#19f58c;margin:10px 0 18px">{{ .Token }}</div>
  <p style="color:#8ea3bf">Saisissez ce code dans le jeu (PARAMÈTRES → Sauvegarde cloud), sur l'appareil où vous l'avez demandé.</p>
  <p style="color:#8ea3bf">Ou, sur cet appareil : <a href="{{ .ConfirmationURL }}" style="color:#19e6ff">se connecter en un clic</a>.</p>
  <p style="color:#4f5f75;font-size:12px">Code valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
</div>"""


def call(method, path, body=None, ok=(200, 201, 204)):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'trading-empire-setup'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            txt = r.read().decode() or 'null'
            return json.loads(txt) if txt.strip()[:1] in '[{"n' else txt
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors='replace')[:400]
        raise SystemExit('API %s %s -> %s %s' % (method, path, e.code, msg))


def log(*a):
    print(*a, flush=True)


def main():
    if not TOKEN:
        raise SystemExit('SUPABASE_ACCESS_TOKEN manquant')
    orgs = call('GET', '/organizations')
    if not orgs:
        # brand-new Supabase account: create its (free) organization
        org = call('POST', '/organizations', {'name': 'Trading Empire'})
        log('organisation créée')
    else:
        org = orgs[0]
    log('organisation:', org.get('name'))
    projects = call('GET', '/projects')
    proj = next((p for p in projects if p.get('name') == NAME), None)
    pw_dir = os.path.join(os.path.expanduser('~'), '.trading-empire')
    pw_file = os.path.join(pw_dir, 'db-password.txt')
    if not proj:
        alphabet = string.ascii_letters + string.digits
        pw = ''.join(secrets.choice(alphabet) for _ in range(32))
        os.makedirs(pw_dir, exist_ok=True)
        with open(pw_file, 'w', encoding='utf-8') as f:
            f.write(pw)
        body = {'name': NAME, 'organization_id': org.get('slug') or org.get('id'), 'region': REGION, 'db_pass': pw}
        proj = call('POST', '/projects', body)
        log('projet créé:', proj.get('id') or proj.get('ref'))
    ref = proj.get('id') or proj.get('ref')
    log('ref:', ref)
    # wait until healthy
    for i in range(90):
        p = call('GET', '/projects/' + ref)
        st = p.get('status')
        if st == 'ACTIVE_HEALTHY':
            break
        if i % 6 == 0:
            log('statut:', st)
        time.sleep(10)
    else:
        raise SystemExit('le projet ne devient pas actif')
    # schema
    for path in sorted(glob.glob(os.path.join(ROOT, 'supabase', 'migrations', '*.sql'))):
        with open(path, encoding='utf-8') as f:
            sql = f.read()
        call('POST', '/projects/%s/database/query' % ref, {'query': sql})
        log('migration appliquée:', os.path.basename(path))
    # auth configuration
    auth = {
        'site_url': SITE,
        'uri_allow_list': ','.join(REDIRECTS),
        'disable_signup': False,
        'external_email_enabled': True,
        'mailer_otp_exp': 3600,
        'password_min_length': 8,
        'mailer_otp_length': 6,
        'mailer_subjects_magic_link': 'Votre code TRADING EMPIRE',
        'mailer_templates_magic_link_content': EMAIL_HTML,
        'mailer_subjects_confirmation': 'Votre code TRADING EMPIRE',
        'mailer_templates_confirmation_content': EMAIL_HTML,
    }
    try:
        call('PATCH', '/projects/%s/config/auth' % ref, auth)
        log('auth configurée (site, redirections, e-mail avec code)')
    except SystemExit as e:
        if 'Email template' not in str(e):
            raise
        # free tier + default e-mail provider: templates are locked (magic link only) — keep the rest
        for k in [k for k in auth if k.startswith('mailer_subjects') or k.startswith('mailer_templates') or k == 'mailer_otp_length']:
            auth.pop(k)
        call('PATCH', '/projects/%s/config/auth' % ref, auth)
        log('auth configurée (site, redirections) — e-mails par défaut : lien magique')
    # public keys only
    keys = call('GET', '/projects/%s/api-keys' % ref)
    pub = None
    for k in keys:
        if k.get('type') == 'publishable' or k.get('name') == 'publishable':
            pub = k.get('api_key')
    if not pub:
        pub = next((k.get('api_key') for k in keys if k.get('name') == 'anon'), None)
    if not pub:
        raise SystemExit('clé publique introuvable')
    url = 'https://%s.supabase.co' % ref
    cfg_path = os.path.join(ROOT, 'js', 'net', 'config.js')
    with open(cfg_path, encoding='utf-8') as f:
        src = f.read()
    import re
    src = re.sub(r"url: '[^']*'", "url: '%s'" % url, src)
    src = re.sub(r"key: '[^']*'", "key: '%s'" % pub, src)
    with open(cfg_path, 'w', encoding='utf-8') as f:
        f.write(src)
    log('config.js mis à jour avec', url, '(clé publique', pub[:14] + '…)')


if __name__ == '__main__':
    main()
