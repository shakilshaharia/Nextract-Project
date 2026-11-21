"""Prepare and validate service drafts; never replace running service units."""
import json,os,pathlib,re,secrets,shutil,socket,subprocess,time
os.umask(0o077)
home=pathlib.Path('/home/nextract');work=home/'deployment-20261108';release=home/'releases/20261108-security';node=home/'.nvm/versions/node/v24.22.1/bin/node'
drafts=work/'service-drafts';drafts.mkdir(mode=0o700,exist_ok=True)
originals=work/'original-service-config';originals.mkdir(mode=0o700,exist_ok=True)
for name in ['cms-api.service','nextract.service']:
    target=originals/name
    if not target.exists():shutil.copy2(home/'.config/systemd/user'/name,target)
watchdog=home/'bin/nextract-watchdog.sh'
if not (originals/watchdog.name).exists():shutil.copy2(watchdog,originals/watchdog.name)
text=watchdog.read_text()
assert '/home/nextract/htdocs/nextract.ca' in text and '/home/nextract/cms/artifacts/cms-api' in text
text=text.replace('/home/nextract/htdocs/nextract.ca',str(release/'artifacts/nextract')).replace('/home/nextract/cms/artifacts/cms-api',str(release/'artifacts/cms-api'))
(drafts/watchdog.name).write_text(text)
config=home/'.config/nextract';data=home/'redis-nextract';data.mkdir(mode=0o700,exist_ok=True)
password_file=config/'redis-password'
if not password_file.exists():password_file.write_text(secrets.token_hex(32)+'\n')
password=password_file.read_text().strip();assert re.fullmatch('[a-f0-9]{64}',password)
redis_config=config/'redis.conf'
redis_config.write_text('bind 127.0.0.1\nport 46379\nprotected-mode yes\nrequirepass '+password+'\ndir '+str(data)+'\nappendonly yes\nappendfsync everysec\nsave ""\nmaxmemory 64mb\nmaxmemory-policy noeviction\ndaemonize no\n')
env_file=release/'artifacts/cms-api/.env'
text=re.sub(r'^RATE_LIMIT_REDIS_URL=.*\n?', '',env_file.read_text(),flags=re.M)
env_file.write_text(text.rstrip()+'\nRATE_LIMIT_REDIS_URL='+json.dumps('redis://:'+password+'@127.0.0.1:46379')+'\n')
common='Restart=always\nRestartSec=3\nUMask=0077\nNoNewPrivileges=true\n'
path='Environment=PATH='+str(node.parent)+':/usr/local/bin:/usr/bin:/bin\n'
units={
 'cms-api.service':'[Unit]\nDescription=Nextract CMS API\nAfter=network-online.target nextract-ratelimit.service\nWants=network-online.target nextract-ratelimit.service\n[Service]\nType=simple\nWorkingDirectory='+str(release/'artifacts/cms-api')+'\n'+path+'ExecStart='+str(node)+' --env-file=.env dist/index.mjs\n'+common+'[Install]\nWantedBy=default.target\n',
 'nextract.service':'[Unit]\nDescription=Nextract Next.js website\nAfter=network-online.target\nWants=network-online.target\n[Service]\nType=simple\nWorkingDirectory='+str(release/'artifacts/nextract')+'\n'+path+'Environment=NODE_ENV=production\nEnvironment=CMS_API_URL=http://127.0.0.1:4000\nExecStart='+str(node)+' '+str(release/'artifacts/nextract/node_modules/next/dist/bin/next')+' start --hostname 127.0.0.1 --port 3001\n'+common+'[Install]\nWantedBy=default.target\n',
 'nextract-ratelimit.service':'[Unit]\nDescription=Nextract private authenticated rate-limit Redis\n[Service]\nType=simple\nExecStart=/usr/bin/redis-server '+str(redis_config)+'\n'+common+'[Install]\nWantedBy=default.target\n'}
for name,text in units.items():(drafts/name).write_text(text)
subprocess.run(['bash','-n',str(drafts/watchdog.name)],check=True)
with socket.socket() as reservation:
    reservation.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);reservation.bind(('127.0.0.1',46379))
with (work/'redis-candidate.log').open('w') as log:
    redis=subprocess.Popen(['/usr/bin/redis-server',str(redis_config)],stdout=log,stderr=log,start_new_session=True)
try:
    auth_env=dict(os.environ,REDISCLI_AUTH=password)
    for n in range(40):
        r=subprocess.run(['redis-cli','-h','127.0.0.1','-p','46379','PING'],env=auth_env,capture_output=True,text=True,timeout=3)
        if r.returncode==0 and r.stdout.strip()=='PONG':break
        assert redis.poll() is None,'Private Redis failed to start'
        time.sleep(.1)
    else:raise AssertionError('Private Redis readiness failed')
    unauth=subprocess.run(['redis-cli','-p','46379','PING'],capture_output=True,text=True,timeout=3)
    assert 'NOAUTH' in unauth.stdout+unauth.stderr
    r=subprocess.run(['redis-cli','-p','46379','SET','nextract:deployment:probe','1','PX','1000'],env=auth_env,capture_output=True,text=True,timeout=3)
    assert r.stdout.strip()=='OK'
finally:
    redis.terminate();redis.wait(timeout=15)
child_env=dict(os.environ,XDG_RUNTIME_DIR='/run/user/'+str(os.getuid()),DBUS_SESSION_BUS_ADDRESS='unix:path=/run/user/'+str(os.getuid())+'/bus')
r=subprocess.run(['systemd-analyze','--user','verify',*[str(drafts/name) for name in units]],env=child_env,capture_output=True,text=True,timeout=30)
assert r.returncode==0,'Service draft verification failed'
(work/'service-preparation.json').write_text(json.dumps({'syntaxVerified':True,'privateRedisAuthenticationTested':True,'watchdogDraftReady':True,'liveServicesChanged':False}))
print('PASS service and watchdog drafts verified; private Redis authentication/write checked; running services unchanged',flush=True)
