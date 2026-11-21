"""Production cutover. Run ONLY after the owner's explicit migration approval.

No data reset, seed, destructive rollback, root service or firewall operation.
On failure restore the old service configuration and retain additive DB changes.
"""
import datetime,fcntl,hashlib,json,os,pathlib,re,shutil,subprocess,sys,time,urllib.parse,urllib.request
assert sys.argv[1:]==['--approved-production-migrations'], 'Owner approval is required before executing this file'
os.umask(0o077)
home=pathlib.Path('/home/nextract');work=home/'deployment-20261108';release=home/'releases/20261108-security';api=release/'artifacts/cms-api';node=home/'.nvm/versions/node/v24.22.1/bin/node'
assert os.getuid()!=0 and pathlib.Path.home()==home
for name in ['migration-rehearsal.json','candidate-smoke.json','service-preparation.json','release-tests.json']:assert (work/name).is_file()
proof=json.loads((work/'migration-rehearsal.json').read_text())
assert proof['baselineMatches'] and proof['encryptedRecoveryPassed'] and proof['originalRowsAndValuesPreserved'] and proof['freshInstallPassed'] and not proof['schemaDrift']
assert all(r['passed'] for r in json.loads((work/'release-tests.json').read_text()))
for p in [api/'dist/index.mjs',release/'artifacts/cms-admin/dist/index.html',release/'artifacts/nextract/.next/BUILD_ID']:assert p.is_file()
def read_env(p):
    out={}
    for line in p.read_text().splitlines():
        m=re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$',line)
        if m:
            try:out[m[1]]=json.loads(m[2])
            except Exception:out[m[1]]=m[2].strip().strip('"\'')
    return out
candidate=read_env(api/'.env');old=read_env(home/'cms/artifacts/cms-api/.env')
assert candidate['APP_SECRET']==old['APP_SECRET'] and candidate['DATABASE_URL']==old['DATABASE_URL']
assert candidate['UPLOAD_DIR']==old['UPLOAD_DIR'] and candidate['BACKUP_DIR']==old['BACKUP_DIR']
url=urllib.parse.urlsplit(candidate['DATABASE_URL'])
assert url.hostname=='127.0.0.1' and (url.port or 3306)==3306 and url.path=='/nextract'
env=dict(os.environ,PATH=str(node.parent)+':'+os.environ['PATH'],MYSQL_PWD=urllib.parse.unquote(url.password),DATABASE_URL=url.geturl(),XDG_RUNTIME_DIR='/run/user/'+str(os.getuid()),DBUS_SESSION_BUS_ADDRESS='unix:path=/run/user/'+str(os.getuid())+'/bus')
auth=['--host=127.0.0.1','--port=3306','--user='+urllib.parse.unquote(url.username),'--default-character-set=utf8mb4']
def sql(statement):
    r=subprocess.run(['mysql',*auth,'--batch','--skip-column-names','nextract'],input=statement,env=env,capture_output=True,text=True,timeout=60)
    assert r.returncode==0,'Production database query failed; inspect privately'
    return r.stdout.strip().splitlines()
tables=sql('SHOW TABLES;')
already_migrated='_prisma_migrations' in tables
if already_migrated:
    history=sql('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;')
    expected=[p.name+'\t'+hashlib.sha256((p/'migration.sql').read_bytes()).hexdigest() for p in sorted((api/'prisma/migrations').iterdir()) if p.is_dir()]
    assert history==expected,'Existing migration history differs from the approved release'
else:
    assert sorted(tables)==sorted(proof['counts']), 'Production schema changed since rehearsal; inspect before proceeding'
originals=work/'original-service-config';drafts=work/'service-drafts';units=home/'.config/systemd/user'
for name in ['cms-api.service','nextract.service']:assert (units/name).read_bytes()==(originals/name).read_bytes(),'Live service changed since preparation'
assert (home/'bin/nextract-watchdog.sh').read_bytes()==(originals/'nextract-watchdog.sh').read_bytes()
assert not (units/'nextract-ratelimit.service').exists() or (units/'nextract-ratelimit.service').read_bytes()==(drafts/'nextract-ratelimit.service').read_bytes(),'Existing rate-limit service needs review before replacement'
def systemctl(*args,check=True):return subprocess.run(['systemctl','--user',*args],env=env,check=check,capture_output=True,text=True,timeout=40)
def install(source,target):
    tmp=target.with_name(target.name+'.nextract-new')
    shutil.copy2(source,tmp);os.replace(tmp,target)
def ready(url):
    for n in range(40):
        try:
            with urllib.request.urlopen(url,timeout=3) as r:
                if r.status==200:return
        except OSError:pass
        time.sleep(.5)
    raise AssertionError('New service readiness failed: '+url)
lock=(home/'run/nextract.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
changed=False;stopped=False
try:
    systemctl('stop','cms-api.service');stopped=True
    # With the CMS stopped and watchdog lock held, take the final recoverable dump.
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    dump=work/('pre-cutover-'+stamp+'.sql')
    with dump.open('x') as out:
        r=subprocess.run(['mysqldump',*auth,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--skip-lock-tables','nextract'],env=env,stdout=out,stderr=subprocess.PIPE,timeout=120)
    assert r.returncode==0,'Final database snapshot failed'
    crypto="""
import {readFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {encryptBackup,decryptBackup} from './src/lib/backup-crypto.ts';
const [source,keyPath]=process.argv.slice(2),key=(await readFile(keyPath,'utf8')).trim();
await encryptBackup(source,source+'.enc',key);await decryptBackup(source+'.enc',source+'.verified',key);
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
if(await hash(source)!==await hash(source+'.verified'))throw Error('Recovery verification failed');
await unlink(source+'.verified');await unlink(source);console.log('PASS final encrypted recovery snapshot');
"""
    subprocess.run([str(node),'--import','tsx','--input-type=module','-',str(dump),str(home/'.config/nextract/backup-key')],input=crypto,text=True,cwd=api,env=env,check=True,timeout=90)
    columns={t:sql("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='nextract' AND TABLE_NAME='"+t+"' ORDER BY ORDINAL_POSITION;") for t in proof['counts']}
    def fingerprint(t):return hashlib.sha256('\n'.join(sql('SELECT '+','.join('`'+c+'`' for c in columns[t])+' FROM `'+t+'` ORDER BY 1;')).encode()).hexdigest()
    before={t:fingerprint(t) for t in columns}
    cli=[str(node),str(api/'node_modules/prisma/build/index.js')]
    commands=([['migrate','resolve','--applied','20261104000000_init']] if not already_migrated else [])+[['migrate','deploy'],['migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code']]
    for args in commands:
        r=subprocess.run([*cli,*args],cwd=api,env=env,capture_output=True,text=True,timeout=120)
        with (work/'production-migrations.log').open('a') as log:log.write(r.stdout+'\n'+r.stderr)
        assert r.returncode==0,'Production migration failed; old code will be restored without deleting database changes'
    assert all(fingerprint(t)==before[t] for t in columns),'Existing data changed unexpectedly; do not reverse or reset the database'
    print('PASS production migrations, schema comparison and preservation of every original value',flush=True)
    changed=True
    for name in ['cms-api.service','nextract.service','nextract-ratelimit.service']:install(drafts/name,units/name)
    install(drafts/'nextract-watchdog.sh',home/'bin/nextract-watchdog.sh');os.chmod(home/'bin/nextract-watchdog.sh',0o700)
    systemctl('daemon-reload');systemctl('enable','--now','nextract-ratelimit.service')
    redis_password=(home/'.config/nextract/redis-password').read_text().strip()
    for attempt in range(40):
        r=subprocess.run(['redis-cli','-p','46379','PING'],env=dict(env,REDISCLI_AUTH=redis_password),capture_output=True,text=True,timeout=3)
        if r.returncode==0 and r.stdout.strip()=='PONG':break
        time.sleep(.1)
    else:raise AssertionError('Private shared rate limiter readiness failed')
    systemctl('start','cms-api.service');ready('http://127.0.0.1:4000/api/health')
    with urllib.request.urlopen('http://127.0.0.1:4000/admin/',timeout=5) as response:assert 'script-src' in response.headers['Content-Security-Policy']
    systemctl('restart','nextract.service');ready('http://127.0.0.1:3001/')
    with urllib.request.urlopen('http://127.0.0.1:3001/',timeout=10) as response:assert response.headers.get('Strict-Transport-Security') and response.headers.get('Content-Security-Policy-Report-Only')
    (work/'production-cutover.json').write_text(json.dumps({'release':str(release),'time':stamp,'migrationsApplied':True,'originalValuesPreserved':True,'apiReady':True,'siteReady':True,'privateAuthenticatedRedis':True,'finalDatabaseSnapshot':str(dump)+'.enc','mfaEnforcementEnabled':False},indent=2))
    print('PASS production API/site switch and private authenticated Redis; old release and encrypted snapshots retained',flush=True)
except BaseException:
    if changed:
        for name in ['cms-api.service','nextract.service']:install(originals/name,units/name)
        install(originals/'nextract-watchdog.sh',home/'bin/nextract-watchdog.sh')
        systemctl('disable','--now','nextract-ratelimit.service',check=False)
        systemctl('daemon-reload',check=False)
    if stopped:
        systemctl('restart','cms-api.service',check=False)
        systemctl('restart','nextract.service',check=False)
    print('CUTOVER FAILED: old service configuration restored; database changes and all backups retained. Inspect private deployment logs.',flush=True)
    raise
finally:
    fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
