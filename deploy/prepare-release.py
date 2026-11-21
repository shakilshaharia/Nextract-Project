"""Prepare a private release, encrypted rollback and isolated SQL rehearsal.

Does not migrate production, edit live services, or switch public traffic.
Run as the nextract site user on the authorized VPS, with source.tar.gz uploaded.
"""
import hashlib, json, os, pathlib, re, secrets, subprocess, tarfile, time, urllib.parse
os.umask(0o077)
home = pathlib.Path('/home/nextract')
work = home/'deployment-20261108'
release = home/'releases/20261108-security'
node = home/'.nvm/versions/node/v24.22.1/bin/node'
archive = work/'source.tar.gz'
expected = '27da47fb8e5c24693169173ff649c92d5c869fb9368699a267e3f9f01ed6936e'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected, 'Source checksum mismatch'
assert not release.exists(), 'Release already exists; inspect instead of overwriting'
release.mkdir(mode=0o700)
with tarfile.open(archive) as tar:
    for entry in tar.getmembers():
        p = pathlib.PurePosixPath(entry.name)
        assert not p.is_absolute() and '..' not in p.parts and not entry.issym() and not entry.islnk()
        assert not any(x == '.dev-credentials' or (x.startswith('.env') and x != '.env.example') for x in p.parts)
    tar.extractall(release, filter='data')
print('PASS source checksum and credential exclusions; private candidate extracted', flush=True)
env = {}
live_env = home/'cms/artifacts/cms-api/.env'
for line in live_env.read_text().splitlines():
    match = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line)
    if match: env[match[1]] = match[2].strip().strip('"\'')
url = urllib.parse.urlsplit(env['DATABASE_URL'])
auth = ['--host='+(url.hostname or '127.0.0.1'), '--port='+str(url.port or 3306), '--user='+urllib.parse.unquote(url.username or ''), '--default-character-set=utf8mb4']
child_env = dict(os.environ, MYSQL_PWD=urllib.parse.unquote(url.password or ''))
dump = work/'database.sql'
with dump.open('x') as output:
    result = subprocess.run(['mysqldump',*auth,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--skip-lock-tables',url.path.lstrip('/')],env=child_env,stdout=output,stderr=subprocess.PIPE,timeout=120)
assert result.returncode == 0, 'Production dump failed (details withheld to protect credentials)'
sql = dump.read_text()
assert not re.search(r'^\s*(CREATE\s+DATABASE|USE)\b',sql,re.M), 'Dump must not select production during rehearsal'
print('PASS consistent production database snapshot created privately',flush=True)
key_dir = home/'.config/nextract'
key_dir.mkdir(mode=0o700,exist_ok=True)
key_file = key_dir/'backup-key'
assert not key_file.exists(), 'Existing backup key requires explicit review; never overwrite'
key_file.write_text(secrets.token_hex(32)+'\n')
plain = work/'rollback.tar.gz'
def filter_member(member):
    parts=pathlib.PurePosixPath(member.name).parts
    if any(p in {'node_modules','.git'} for p in parts) or '.next/cache' in member.name: return None
    return member
with tarfile.open(plain,'w:gz') as tar:
    for relative in ['cms','htdocs/nextract.ca','bin','.config/systemd/user']:
        p=home/relative
        if p.exists(): tar.add(p,arcname=relative,filter=filter_member)
    tar.add(dump,arcname='database.sql')
crypto = """
const fs=require('node:fs'), crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');
(async()=>{
 const [source,destination,keyPath]=process.argv.slice(2), key=Buffer.from(fs.readFileSync(keyPath,'utf8').trim(),'hex');
 const magic=Buffer.from('NXBK0001'),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv); cipher.setAAD(magic);
 fs.writeFileSync(destination,Buffer.concat([magic,iv]),{flag:'wx',mode:0o600});
 await pipeline(fs.createReadStream(source),cipher,fs.createWriteStream(destination,{flags:'a'}));fs.appendFileSync(destination,cipher.getAuthTag());
 const size=fs.statSync(destination).size,fd=fs.openSync(destination,'r'),tag=Buffer.alloc(16);fs.readSync(fd,tag,0,16,size-16);fs.closeSync(fd);
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(magic);decipher.setAuthTag(tag);
 const actual=crypto.createHash('sha256'); await pipeline(fs.createReadStream(destination,{start:20,end:size-17}),decipher,actual);
 const original=crypto.createHash('sha256');await pipeline(fs.createReadStream(source),original);
 if(actual.digest('hex')!==original.digest('hex'))throw Error('Encrypted recovery verification failed');
 console.log('PASS AES-256-GCM rollback authentication and full decrypted SHA-256 match');
})().catch(()=>{console.error('Backup encryption failed');process.exit(1)});
"""
subprocess.run([str(node),'-',str(plain),str(work/'rollback.tar.gz.enc'),str(key_file)],input=crypto,text=True,check=True,timeout=120)
plain.unlink()
# An isolated, unprivileged instance; it never touches /var/lib/mysql or its service.
stage = work/'mysql-stage'
stage.mkdir(mode=0o700)
data = stage/'data'
init = subprocess.run(['/usr/sbin/mysqld','--no-defaults','--initialize-insecure','--datadir='+str(data),'--log-error='+str(stage/'error.log')],capture_output=True,text=True,timeout=90)
assert init.returncode == 0, 'Isolated MySQL initialization failed; inspect private error.log'
command = ['/usr/sbin/mysqld','--no-defaults','--datadir='+str(data),'--socket='+str(stage/'mysql.sock'),'--pid-file='+str(stage/'mysql.pid'),'--bind-address=127.0.0.1','--port=43319','--mysqlx=OFF','--log-error='+str(stage/'error.log')]
with (stage/'launcher.log').open('x') as output:
    proc = subprocess.Popen(command,stdout=output,stderr=output,start_new_session=True)
for _ in range(40):
    if (stage/'mysql.sock').exists(): break
    assert proc.poll() is None, 'Isolated MySQL stopped; inspect private error.log'
    time.sleep(.5)
stage_password = secrets.token_hex(32)
stage_auth = ['mysql','--protocol=SOCKET','--socket='+str(stage/'mysql.sock'),'--user=root']
result = subprocess.run(stage_auth,input="CREATE DATABASE nextract_stage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; ALTER USER 'root'@'localhost' IDENTIFIED BY '"+stage_password+"';",capture_output=True,text=True,timeout=20)
assert result.returncode == 0, 'Isolated database setup failed'
stage_env = dict(os.environ,MYSQL_PWD=stage_password)
with dump.open() as source:
    result = subprocess.run([*stage_auth,'nextract_stage'],stdin=source,env=stage_env,capture_output=True,text=True,timeout=120)
assert result.returncode == 0, 'Isolated production-copy restore failed'
dump.unlink() # Only this freshly generated temporary plaintext; encrypted snapshot retained.
stage_url = 'mysql://root:'+stage_password+'@127.0.0.1:43319/nextract_stage'
(work/'stage-database-url').write_text(stage_url+'\n')
candidate = live_env.read_text().rstrip()+'\n'
settings = {'NODE_ENV':'production','HOST':'127.0.0.1','PORT':'4000','PUBLIC_SITE_URL':'https://nextract.ca','ADMIN_URL':'https://nextract.ca/admin','CORS_ORIGINS':'https://nextract.ca','ADMIN_DIST':'../cms-admin/dist','SITE_ROOT':str(release/'artifacts/nextract'),'SITE_PUBLIC_DIR':str(release/'artifacts/nextract/public'),'BACKUP_ENCRYPTION_KEY':key_file.read_text().strip(),'SESSION_IDLE_MINUTES':'30'}
for k,v in settings.items():
    candidate = re.sub(r'^'+re.escape(k)+r'=.*\n?', '', candidate, flags=re.M)
    candidate += k+'='+json.dumps(v)+'\n'
(release/'artifacts/cms-api/.env').write_text(candidate)
stage_candidate=re.sub(r'^DATABASE_URL=.*$', 'DATABASE_URL='+json.dumps(stage_url),candidate,flags=re.M)
(work/'stage.env').write_text(stage_candidate)
print('PASS isolated production-copy database restored on loopback:43319; live database and services unchanged',flush=True)
print(json.dumps({'release':str(release),'rollback':str(work/'rollback.tar.gz.enc'),'rollbackBytes':(work/'rollback.tar.gz.enc').stat().st_size,'keyFile':str(key_file)}),flush=True)
