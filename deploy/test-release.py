"""Run regression suites on an empty migrated disposable DB, not live data."""
import json,os,pathlib,secrets,subprocess,time,urllib.parse
home=pathlib.Path('/home/nextract');work=home/'deployment-20261108';release=home/'releases/20261108-security';api=release/'artifacts/cms-api'
url=urllib.parse.urlsplit((work/'stage-database-url').read_text().strip())
assert url.hostname=='127.0.0.1' and url.port==43319 and url.path=='/nextract_stage'
fresh=urllib.parse.urlunsplit(url._replace(path='/nextract_fresh'))
tools=work/'mysql-tools';tools.mkdir(mode=0o700,exist_ok=True)
for name,target in [('mariadb','/usr/bin/mysql'),('mariadb-dump','/usr/bin/mysqldump')]:
    p=tools/name
    if not p.exists():p.symlink_to(target)
env=dict(os.environ,PATH=str(home/'.nvm/versions/node/v24.22.1/bin')+':'+os.environ['PATH'],NODE_ENV='test',DATABASE_URL=fresh,APP_SECRET=secrets.token_hex(32),PUBLIC_SITE_URL='http://localhost:3000',ADMIN_URL='http://localhost:3001',CORS_ORIGINS='http://localhost:3000,http://localhost:3001',COOKIE_SECURE='false',UPLOAD_DIR=str(work/'test-uploads'),BACKUP_DIR=str(work/'test-backups'),SITE_ROOT=str(work/'test-site'),SITE_PUBLIC_DIR=str(work/'test-site/public'),MARIADB_BIN=str(tools),SMTP_HOST='',SMTP_USER='',SMTP_PASS='',BACKUP_ENCRYPTION_KEY=secrets.token_hex(32),REDIS_SERVER_BIN='/usr/bin/redis-server')
steps=[('api-unit',['pnpm','--filter','@workspace/cms-api','test']),('webhook-integration',['pnpm','--filter','@workspace/cms-api','test:webhooks-integration']),('editorial-portability',['pnpm','--filter','@workspace/cms-api','test:editorial-portability']),('api-security',['pnpm','--filter','@workspace/cms-api','test:security-integration']),('mfa-rollout',['pnpm','--filter','@workspace/cms-api','test:mfa-rollout']),('encrypted-file-recovery',['pnpm','--filter','@workspace/cms-api','test:backup-security']),('full-recovery',['pnpm','--filter','@workspace/cms-api','test:full-recovery']),('redis-integration',['pnpm','--filter','@workspace/cms-api','test:redis-integration'])]
results=[]
for name,command in steps:
    start=time.monotonic()
    r=subprocess.run(command,cwd=release,env=env,capture_output=True,text=True,timeout=180)
    (work/(name+'.log')).write_text(r.stdout+'\n'+r.stderr)
    print(json.dumps({'suite':name,'exit':r.returncode,'seconds':round(time.monotonic()-start,1)}),flush=True)
    if r.returncode:
        print((r.stdout+'\n'+r.stderr)[-7000:],flush=True)
        raise SystemExit(r.returncode)
    results.append({'suite':name,'passed':True})
(work/'release-tests.json').write_text(json.dumps(results,indent=2))
print('PASS all release regression suites; isolated SQL, Redis and file paths only',flush=True)
