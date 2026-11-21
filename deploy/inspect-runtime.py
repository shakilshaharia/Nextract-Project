"""Read-only DB/service inspection. Never print credentials or content rows."""
import json, os, pathlib, re, subprocess, urllib.parse

home = pathlib.Path('/home/nextract')
env = {}
for line in (home/'cms/artifacts/cms-api/.env').read_text().splitlines():
    m = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line)
    if m: env[m[1]] = m[2].strip().strip('\"\'')
url = urllib.parse.urlsplit(env['DATABASE_URL'])
args = ['mysql', '--batch', '--skip-column-names', '--host=' + (url.hostname or '127.0.0.1'), '--port=' + str(url.port or 3306), '--user=' + urllib.parse.unquote(url.username or ''), url.path.lstrip('/')]
child_env = dict(os.environ, MYSQL_PWD=urllib.parse.unquote(url.password or ''))
def query(sql):
    result = subprocess.run(args, input=sql, env=child_env, capture_output=True, text=True, timeout=20)
    if result.returncode: return {'error': 'query failed'}
    return result.stdout.strip().splitlines()
def emit(name, value): print(json.dumps({'section':name, 'data':value}))
emit('database', {'host':url.hostname,'port':url.port or 3306,'name':url.path.lstrip('/')})
emit('tables', query('SHOW TABLES;'))
emit('migrations', query('SELECT migration_name, finished_at IS NOT NULL, rolled_back_at IS NOT NULL FROM _prisma_migrations ORDER BY started_at;'))
for table in ['User','Session','Page','Post','MediaAsset','FormSubmission','Setting','Backup']:
    emit('count:' + table, query('SELECT COUNT(*) FROM `' + table + '`;'))
emit('mfa', query("SELECT role,COUNT(*),SUM(totpEnabledAt IS NOT NULL OR emailOtpEnabled=1) FROM User WHERE active=1 GROUP BY role;"))
for key in ['security','email','backup']:
    lines = query("SELECT value FROM Setting WHERE `key`='" + key + "';")
    try:
        data = json.loads(lines[0])
        safe = {'requireTwoFactor': data.get('requireTwoFactor')} if key == 'security' else {'enabled':data.get('enabled'),'hostConfigured':bool(data.get('host')),'passwordConfigured':bool(data.get('pass'))} if key == 'email' else {k:data.get(k) for k in ['enabled','frequency','includeDb','includeFiles','includeCode']}
        emit('setting:' + key, safe)
    except Exception: emit('setting:' + key, {'present': bool(lines)})
grants = query('SHOW GRANTS FOR CURRENT_USER;')
if isinstance(grants, list):
    emit('db-privileges', {'globalDataPrivileges':any(re.search(r'GRANT (?!USAGE).* ON \*\.\*', g) for g in grants),'grantOption':any('WITH GRANT OPTION' in g for g in grants)})
emit('schema', query('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION;'))
for p in (home/'.config/systemd/user').rglob('*'):
    if p.is_file() and (p.suffix in ['.conf','.service']):
        text = p.read_text()
        text = re.sub(r'(?im)^.*(?:PASSWORD|SECRET|TOKEN|DATABASE_URL|AUTHORIZATION).*$', '[secret-bearing line omitted]', text)
        emit('unit:' + str(p), text)
