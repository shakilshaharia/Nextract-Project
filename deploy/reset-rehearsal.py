"""Reset ONLY the disposable rehearsal database from its reference copy."""
import os,pathlib,subprocess,urllib.parse
home=pathlib.Path('/home/nextract');work=home/'deployment-20261108'
url=urllib.parse.urlsplit((work/'stage-database-url').read_text().strip())
assert url.hostname=='127.0.0.1' and url.port==43319 and url.path=='/nextract_stage'
env=dict(os.environ,MYSQL_PWD=urllib.parse.unquote(url.password))
auth=['--host=127.0.0.1','--port=43319','--user=root']
def sql(query):
    r=subprocess.run(['mysql',*auth,'--batch','--skip-column-names'],input=query,env=env,capture_output=True,text=True,timeout=60)
    assert r.returncode==0,'Disposable SQL operation failed'
    return r.stdout.strip()
assert pathlib.Path(sql('SELECT @@datadir;')).resolve()==(work/'mysql-stage/data').resolve(), 'Refuse to reset any other server'
assert int(sql("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='nextract_original';"))>=20
dump=subprocess.run(['mysqldump',*auth,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','nextract_original'],env=env,capture_output=True,text=True,timeout=60)
assert dump.returncode==0
sql('DROP DATABASE nextract_stage; CREATE DATABASE nextract_stage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE nextract_stage;\n'+dump.stdout)
print('PASS reset ONLY isolated rehearsal DB on verified private datadir; production untouched')
