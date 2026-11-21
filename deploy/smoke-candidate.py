"""Start temporary loopback candidate services and perform bounded read probes."""
import json,os,pathlib,socket,subprocess,time,urllib.request,urllib.error
home=pathlib.Path('/home/nextract');work=home/'deployment-20261108';release=home/'releases/20261108-security';api=release/'artifacts/cms-api';site=release/'artifacts/nextract';node=home/'.nvm/versions/node/v24.22.1/bin/node'
env=dict(os.environ)
for line in (work/'stage.env').read_text().splitlines():
    if '=' not in line or line.lstrip().startswith('#'):continue
    key,value=line.split('=',1)
    if key.isidentifier():
        try:env[key]=json.loads(value)
        except Exception:env[key]=value.strip().strip('"\'')
env.update(PORT='44000',HOST='127.0.0.1',UPLOAD_DIR=str(work/'smoke-uploads'),BACKUP_DIR=str(work/'smoke-backups'),SITE_ROOT=str(work/'smoke-site'),SITE_PUBLIC_DIR=str(work/'smoke-site/public'))
assert ':43319/nextract_stage' in env['DATABASE_URL']
processes=[]
def start(command,cwd,child_env,name,port):
    with socket.socket() as reservation:
        reservation.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        reservation.bind(('127.0.0.1',port))
    with (work/(name+'.log')).open('w') as log:
        p=subprocess.Popen(command,cwd=cwd,env=child_env,stdout=log,stderr=log,start_new_session=True)
    processes.append(p)
    return p
def get(url,expected=200):
    try:r=urllib.request.urlopen(url,timeout=15)
    except urllib.error.HTTPError as e:r=e
    body=r.read(2*1024*1024)
    assert r.status==expected,'Unexpected candidate response: '+url+' '+str(r.status)
    return r.headers,body
try:
    # createApp only: production-copy scheduler and mail queues are never started.
    start([str(node),'--import','tsx','--input-type=module','-e',"import {createApp} from './src/app.ts';createApp().listen(44000,'127.0.0.1');"],api,env,'candidate-api',44000)
    for n in range(40):
        try:headers,body=get('http://127.0.0.1:44000/api/health');break
        except (OSError,AssertionError):time.sleep(.25)
    else:raise AssertionError('Candidate API readiness failed')
    assert json.loads(body)['db']=='up'
    headers,body=get('http://127.0.0.1:44000/admin/')
    assert b'<html' in body and 'script-src' in headers['Content-Security-Policy']
    headers,_=get('http://127.0.0.1:44000/api/admin/dashboard',401)
    assert headers.get('Cache-Control')=='no-store'
    assert headers.get('X-Request-ID')
    headers,body=get('http://127.0.0.1:44000/api/public/bootstrap?path=/')
    assert len(body)>1000
    site_env=dict(os.environ,NODE_ENV='production',CMS_API_URL='http://127.0.0.1:44000',PATH=str(node.parent)+':'+os.environ['PATH'])
    start([str(node),str(site/'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','43001'],site,site_env,'candidate-site',43001)
    for n in range(40):
        try:headers,body=get('http://127.0.0.1:43001/');break
        except (OSError,AssertionError):time.sleep(.25)
    else:raise AssertionError('Candidate site readiness failed')
    for path in ['/','/about','/pricing','/contact','/resources','/privacy-policy','/terms-and-conditions','/sitemap.xml','/robots.txt']:
        headers,body=get('http://127.0.0.1:43001'+path)
        assert len(body)>20
        if path=='/':
            for header in ['Content-Security-Policy','Content-Security-Policy-Report-Only','Strict-Transport-Security','X-Content-Type-Options']:
                assert headers.get(header),'Missing candidate header: '+header
        print('PASS candidate GET '+path,flush=True)
    print('PASS candidate DB readiness, compiled admin CSP, anonymous admin denial, request IDs, public CMS data, Next pages and security headers',flush=True)
    (work/'candidate-smoke.json').write_text(json.dumps({'api':True,'admin':True,'publicSite':True,'headers':True,'productionWrites':False}))
finally:
    for p in reversed(processes):
        p.terminate()
        try:p.wait(timeout=15)
        except subprocess.TimeoutExpired:p.kill();p.wait()
