"""Remove only this deployment's disposable SQL instance and test credentials."""
import json,os,pathlib,shutil,subprocess,time,urllib.parse
home=pathlib.Path('/home/nextract');work=home/'deployment-20261108';stage=work/'mysql-stage'
assert (work/'production-cutover.json').exists() and (work/'production-backup-verification.json').exists()
url=urllib.parse.urlsplit((work/'stage-database-url').read_text().strip())
assert url.hostname=='127.0.0.1' and url.port==43319 and url.path=='/nextract_stage'
env=dict(os.environ,MYSQL_PWD=urllib.parse.unquote(url.password))
auth=['--host=127.0.0.1','--port=43319','--user=root']
r=subprocess.run(['mysql',*auth,'--batch','--skip-column-names','-e','SELECT @@datadir;'],env=env,capture_output=True,text=True,timeout=10)
assert r.returncode==0 and pathlib.Path(r.stdout.strip()).resolve()==(stage/'data').resolve()
assert not stage.is_symlink() and stage.resolve()==pathlib.Path('/home/nextract/deployment-20261108/mysql-stage')
pid=int((stage/'mysql.pid').read_text().strip())
assert pathlib.Path('/proc/'+str(pid)).stat().st_uid==os.getuid()
subprocess.run(['mysqladmin',*auth,'shutdown'],env=env,capture_output=True,check=True,timeout=20)
for n in range(40):
    if not pathlib.Path('/proc/'+str(pid)).exists():break
    time.sleep(.25)
else:raise AssertionError('Disposable MySQL still running; do not remove its files')
shutil.rmtree(stage)
for name in ['stage-database-url','stage.env']:(work/name).unlink()
(work/'rehearsal-cleanup.json').write_text(json.dumps({'temporaryMysqlStopped':True,'plaintextDatabaseCopiesRemoved':True,'temporaryCredentialFilesRemoved':True,'productionAndEncryptedSnapshotsRetained':True}))
print('PASS removed only the verified disposable SQL instance and its temporary credentials; production and encrypted snapshots retained')
