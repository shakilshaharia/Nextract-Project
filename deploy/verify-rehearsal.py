"""Verify encrypted recovery, migration chain and old values on isolated SQL."""
import hashlib,json,os,pathlib,re,subprocess,tarfile,urllib.parse
home=pathlib.Path('/home/nextract'); work=home/'deployment-20261108'; release=home/'releases/20261108-security'; api=release/'artifacts/cms-api'
node=home/'.nvm/versions/node/v24.22.1/bin/node'
url=urllib.parse.urlsplit((work/'stage-database-url').read_text().strip())
assert url.hostname=='127.0.0.1' and url.port==43319 and url.path=='/nextract_stage'
env=dict(os.environ,MYSQL_PWD=urllib.parse.unquote(url.password),DATABASE_URL=url.geturl(),PATH=str(node.parent)+':'+os.environ['PATH'])
auth=['mysql','--batch','--skip-column-names','--host=127.0.0.1','--port=43319','--user=root']
def sql(statement,database='nextract_stage'):
    result=subprocess.run([*auth,database],input=statement,env=env,capture_output=True,text=True,timeout=60)
    assert result.returncode==0,'Isolated SQL failed (details withheld)'
    return result.stdout.strip().splitlines()
recovered=work/'verified-recovery.tar.gz'
decrypt="""
import {readFile} from 'node:fs/promises';
import {decryptBackup} from './src/lib/backup-crypto.ts';
const home='/home/nextract';
await decryptBackup(home+'/deployment-20261108/rollback.tar.gz.enc',home+'/deployment-20261108/verified-recovery.tar.gz',(await readFile(home+'/.config/nextract/backup-key','utf8')).trim());
console.log('PASS encrypted rollback decrypted with application recovery implementation');
"""
if not sql("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='nextract_original';"):
    subprocess.run([str(node),'--import','tsx','--input-type=module'],input=decrypt,text=True,cwd=api,env=env,check=True,timeout=60)
    with tarfile.open(recovered) as tar:
        dump=tar.extractfile('database.sql').read().decode()
    assert not re.search(r'^\s*(CREATE\s+DATABASE|USE)\b',dump,re.M)
    sql('CREATE DATABASE nextract_original CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
    sql(dump,'nextract_original')
    recovered.unlink()
print('PASS encrypted database archive restored to separate original-reference database',flush=True)
cli=[str(node),str(api/'node_modules/prisma/build/index.js')]
def prisma(args,extra=None):
    result=subprocess.run([*cli,*args],cwd=api,env={**env,**(extra or {})},capture_output=True,text=True,timeout=120)
    print(result.stdout,flush=True)
    assert result.returncode==0,'Isolated Prisma verification failed; production remains unchanged'
prisma(['migrate','deploy'])
prisma(['migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code'])
tables=sql('SHOW TABLES;','nextract_original')
counts={}
for table in tables:
    counts[table]=int(sql('SELECT COUNT(*) FROM `'+table+'`;','nextract_original')[0])
    assert int(sql('SELECT COUNT(*) FROM `'+table+'`;')[0])==counts[table], 'Row count changed: '+table
    columns=sql("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='nextract_original' AND TABLE_NAME='"+table+"' ORDER BY ORDINAL_POSITION;")
    query='SELECT '+','.join('`'+c+'`' for c in columns)+' FROM `'+table+'` ORDER BY 1;'
    digest=lambda rows: hashlib.sha256('\n'.join(rows).encode()).hexdigest()
    assert digest(sql(query))==digest(sql(query,'nextract_original')), 'Original values changed: '+table
print('PASS all original rows and values preserved, including accounts, published content and settings',flush=True)
sql('CREATE DATABASE nextract_fresh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
fresh=urllib.parse.urlunsplit(url._replace(path='/nextract_fresh'))
prisma(['migrate','deploy'],{'DATABASE_URL':fresh})
prisma(['migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code'],{'DATABASE_URL':fresh})
print('PASS both legacy upgrade and fresh installation match the complete Prisma schema',flush=True)
(work/'migration-rehearsal.json').write_text(json.dumps({'baselineMatches':True,'encryptedRecoveryPassed':True,'schemaDrift':False,'originalRowsAndValuesPreserved':True,'freshInstallPassed':True,'counts':counts,'migrations':sorted(p.name for p in (api/'prisma/migrations').iterdir() if p.is_dir())},indent=2))
