"""Rehearse only on the explicitly created isolated instance, never production."""
import hashlib,json,os,pathlib,re,subprocess,urllib.parse
home=pathlib.Path('/home/nextract'); work=home/'deployment-20261108'; release=home/'releases/20261108-security'
url=urllib.parse.urlsplit((work/'stage-database-url').read_text().strip())
assert url.hostname=='127.0.0.1' and url.port==43319 and url.path=='/nextract_stage'
env=dict(os.environ,MYSQL_PWD=urllib.parse.unquote(url.password),DATABASE_URL=url.geturl(),PATH=str(home/'.nvm/versions/node/v24.22.1/bin')+':'+os.environ['PATH'])
auth=['mysql','--batch','--skip-column-names','--host=127.0.0.1','--port=43319','--user=root']
def sql(statement,database='nextract_stage'):
    result=subprocess.run([*auth,database],input=statement,env=env,capture_output=True,text=True,timeout=40)
    assert result.returncode==0,'Isolated SQL failed (details withheld)'
    return result.stdout.strip().splitlines()
tables=sql('SHOW TABLES;')
original={t:hashlib.sha256('\n'.join(sql('SELECT * FROM `'+t+'` ORDER BY 1;')).encode()).hexdigest() for t in tables}
counts={t:sql('SELECT COUNT(*) FROM `'+t+'`;')[0] for t in tables}
(work/'original-row-fingerprints.json').write_text(json.dumps({'hashes':original,'counts':counts}))
sql('CREATE DATABASE IF NOT EXISTS nextract_baseline CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
api=release/'artifacts/cms-api'
if not sql('SHOW TABLES;','nextract_baseline'):
    sql((api/'prisma/migrations/20261104000000_init/migration.sql').read_text(),'nextract_baseline')
def structure(db):
    columns=sql("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COALESCE(COLUMN_DEFAULT,'<NULL>'),EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='"+db+"' ORDER BY TABLE_NAME,ORDINAL_POSITION;")
    indexes=sql("SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='"+db+"' ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX;")
    foreign=sql("SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='"+db+"' AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME;")
    return [[row for row in group if not row.startswith('Backup\t')] for group in [columns,indexes,foreign]]
actual,expected=structure('nextract_stage'),structure('nextract_baseline')
assert actual==expected, 'Live schema differs from initial baseline; do not mark the production baseline'
print('PASS existing schema columns, defaults, indexes and foreign keys exactly match initial migration (additional Backup table preserved)',flush=True)
cli=[str(home/'.nvm/versions/node/v24.22.1/bin/node'),str(api/'node_modules/prisma/build/index.js')]
for args in [['migrate','resolve','--applied','20261104000000_init'],['migrate','deploy'],['migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code']]:
    result=subprocess.run([*cli,*args],cwd=api,env=env,capture_output=True,text=True,timeout=120)
    print(result.stdout,flush=True)
    assert result.returncode==0,'Isolated Prisma command failed: '+args[0]+' '+args[1]+'; review private output before production'
for table in tables:
    assert sql('SELECT COUNT(*) FROM `'+table+'`;')[0]==counts[table], 'Existing row count changed: '+table
    # Compare precisely the old column set, excluding only newly added columns.
    cols=sql("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='nextract_baseline' AND TABLE_NAME='"+table+"' ORDER BY ORDINAL_POSITION;")
    if table=='Backup': cols=sql("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='nextract_stage' AND TABLE_NAME='Backup' ORDER BY ORDINAL_POSITION;")
    result=sql('SELECT '+','.join('`'+c+'`' for c in cols)+' FROM `'+table+'` ORDER BY 1;')
    assert hashlib.sha256('\n'.join(result).encode()).hexdigest()==original[table], 'An original value changed: '+table
print('PASS every existing row count and original column value preserved across all tables',flush=True)
(work/'migration-rehearsal.json').write_text(json.dumps({'baselineMatches':True,'schemaDrift':False,'originalRowsAndValuesPreserved':True,'counts':counts,'migrations':sorted(p.name for p in (api/'prisma/migrations').iterdir() if p.is_dir())},indent=2))
