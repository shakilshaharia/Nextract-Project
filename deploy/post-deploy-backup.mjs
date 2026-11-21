// Feed on stdin to Node --env-file=.env --import tsx --input-type=module
// with cwd artifacts/cms-api. Authorized production verification, no restores.
import assert from 'node:assert/strict';
import {chmod,readFile,unlink,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import nodemailer from 'nodemailer';
import {db} from './src/db.ts';
import {startBackup,runBackupJob,archivePathFor,saveBackupSettings,getBackupSettings} from './src/lib/backup.ts';
import {decryptBackup} from './src/lib/backup-crypto.ts';
import {getSetting} from './src/lib/settings.ts';
const work='/home/nextract/deployment-20261108';
const url=new URL(process.env.DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/nextract');
assert.equal(process.env.NODE_ENV,'production');assert.ok(process.env.BACKUP_ENCRYPTION_KEY);
let smtpVerified=false;
try{
 await chmod(process.env.BACKUP_DIR,0o700);
 const row=await startBackup({name:'Verified post-deployment database and media snapshot',includeDb:true,includeFiles:true,includeCode:false,runInBackground:false});
 await runBackupJob(row.id);
 const result=await db.backup.findUniqueOrThrow({where:{id:row.id}});
 assert.equal(result.status,'SUCCESS','Production backup failed; inspect protected Backup.error');
 const archive=await archivePathFor(row.id);assert.ok(archive.name.endsWith('.enc'));
 const plain=work+'/post-deploy-backup-verify.tar.gz';
 await decryptBackup(archive.path,plain,process.env.BACKUP_ENCRYPTION_KEY);
 const list=spawnSync('tar',['-tzf',plain],{encoding:'utf8'});assert.equal(list.status,0);
 assert.ok(list.stdout.includes('database.sql')&&list.stdout.includes('manifest.json'));
 assert.ok(!list.stdout.split('\n').some(p=>/(^|\/)\.env(?:\.|$)/.test(p)));
 await unlink(plain);
 const existing=await db.setting.findUnique({where:{key:'backup'}});
 if(!existing)await saveBackupSettings({enabled:true,frequency:'daily',time:'03:00',timezone:'UTC',includeDb:true,includeFiles:true,includeCode:false,retentionDaily:7,retentionWeekly:4,retentionMonthly:12,retentionManual:30});
 const schedule=await getBackupSettings();
 console.log(JSON.stringify({backup:'SUCCESS',encrypted:true,archiveAuthenticated:true,databaseAndFiles:true,bytes:result.sizeBytes.toString(),schedule:{enabled:schedule.enabled,frequency:schedule.frequency,time:schedule.time,timezone:schedule.timezone,retentionDaily:schedule.retentionDaily},existingSchedulePreserved:Boolean(existing)}));
 const email=await getSetting('email');
 if(email.enabled&&email.host){
  const secure=email.port===465?true:[25,587,2525].includes(email.port)?false:email.secure;
  const transport=nodemailer.createTransport({host:email.host,port:email.port,secure,requireTLS:!secure,auth:email.user?{user:email.user,pass:email.pass}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
  try{await transport.verify();smtpVerified=true;console.log('PASS SMTP TLS/authentication verification; no message sent');}
  catch(error){console.log(JSON.stringify({smtpVerified:false,code:error?.code??'verification_failed'}));}
  finally{transport.close();}
 }
 await writeFile(work+'/production-backup-verification.json',JSON.stringify({encryptedDatabaseAndFiles:true,archiveAuthenticated:true,backupId:row.id,scheduleEnabled:schedule.enabled,smtpVerified,offsiteConfigured:false},null,2),{mode:0o600});
}finally{await db.$disconnect();}
