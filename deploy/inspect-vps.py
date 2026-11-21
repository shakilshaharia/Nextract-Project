"""Read-only, secret-redacting inventory for the explicitly authorized VPS."""
import json
import os
import pathlib
import re
import subprocess

home = pathlib.Path('/home/nextract')
def emit(label, value):
    print(json.dumps({'section': label, 'data': value}))

for folder in ['bin', 'run', 'cms', 'htdocs/nextract.ca', '.config/systemd/user']:
    p = home / folder
    if p.exists():
        emit('directory:' + folder, [{'name': x.name, 'symlink': x.is_symlink(), 'target': str(x.resolve()) if x.is_symlink() else None} for x in p.iterdir() if x.name != 'node_modules'][:60])

for p in [home/'cms/package.json', home/'cms/artifacts/cms-api/package.json', home/'htdocs/nextract.ca/package.json']:
    if p.exists():
        value = json.loads(p.read_text())
        emit(str(p), {k:value.get(k) for k in ['name','scripts','dependencies','packageManager']})

for p in [home/'cms/artifacts/cms-api/.env', home/'htdocs/nextract.ca/.env']:
    if not p.exists():
        continue
    pairs = {}
    safe = {'NODE_ENV','HOST','PORT','PUBLIC_SITE_URL','ADMIN_URL','CORS_ORIGINS','UPLOAD_DIR','BACKUP_DIR','ADMIN_DIST','SITE_DIST','STORAGE_DRIVER','TRUST_PROXY','REQUIRE_ADMIN_MFA'}
    for line in p.read_text().splitlines():
        match = re.match(r'^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$', line)
        if match:
            key, value = match.groups()
            value = value.strip().strip('\"\'')
            pairs[key] = value if key in safe else {'configured': bool(value)}
    emit(str(p), pairs)

for proc in pathlib.Path('/proc').iterdir():
    if not proc.name.isdigit():
        continue
    try:
        if proc.stat().st_uid == os.getuid():
            emit('process', {'pid':int(proc.name),'comm':(proc/'comm').read_text().strip(),'cwd':str((proc/'cwd').resolve()),'exe':str((proc/'exe').resolve())})
    except (PermissionError, FileNotFoundError, ProcessLookupError):
        pass

for p in (home/'bin').glob('*'):
    if not p.is_file() or p.stat().st_size > 50000:
        continue
    text = p.read_text(errors='replace')
    text = re.sub(r'(?im)^.*(?:PASSWORD|SECRET|TOKEN|PRIVATE KEY|DATABASE_URL|AUTHORIZATION).*$', '[secret-bearing line omitted]', text)
    text = re.sub(r'(?:mysql|redis|rediss)://[^\s\"\']+', '[connection URL omitted]', text)
    emit('launcher:' + p.name, text)

for command in [['free','-m'], ['df','-h','/home/nextract'], ['crontab','-l'], ['redis-cli','PING'], ['systemctl','--user','list-units','--type=service','--no-pager']]:
    try:
        result = subprocess.run(command,capture_output=True,text=True,timeout=10)
        output = re.sub(r'(?im)^.*(?:PASSWORD|SECRET|TOKEN|DATABASE_URL).*$', '[secret-bearing line omitted]', result.stdout)
        emit('command:' + command[0], {'exit':result.returncode,'stdout':output[:12000]})
    except Exception as error:
        emit('command:' + command[0], {'error':type(error).__name__})
