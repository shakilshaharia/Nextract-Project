import assert from 'node:assert/strict';
const base='https://nextract.ca';
const checks=[['/',200],['/about',200],['/pricing',200],['/contact',200],['/resources',200],['/admin',200],['/api/auth/me',401],['/api/admin/dashboard',401],['/api/public/bootstrap?path=/',200]];
for(const [path,status] of checks){
 const response=await fetch(base+path,{signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,status,path);
 const body=await response.text();
 if(path==='/'){assert.ok(response.headers.get('strict-transport-security'));assert.ok(response.headers.get('content-security-policy-report-only'));}
 if(path==='/admin'){
  assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
  for(const match of body.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)){
   const asset=new URL(match[1],response.url);assert.equal(asset.origin,base);
   const r=await fetch(asset,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,asset.pathname);await r.arrayBuffer();
  }
 }
 console.log(JSON.stringify({path,status:response.status,bytes:Buffer.byteLength(body),cache:response.headers.get('cf-cache-status')}));
}
const csrf=await fetch(base+'/api/auth/logout',{method:'POST',signal:AbortSignal.timeout(10000)});
assert.equal(csrf.status,403);assert.equal((await csrf.json()).error.code,'csrf');
console.log('PASS public HTTPS routes, compiled admin assets/CSP/no-store, anonymous access denial and missing-CSRF rejection. No real account or content was modified.');
