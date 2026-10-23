import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createIncrementalSync,syncFailureDetail} from '../src/cloudBackup/incremental.ts';
import {applyChanges,canonical,fingerprints,splitRecords,joinRecords} from '../src/cloudBackup/records.ts';
const hash=async value=>createHash('sha256').update(value).digest('hex');
test('native diagnostics retain the failure reason while removing local paths and tokens',()=>{
 const detail=syncFailureDetail(new Error(`Native call failed: file:///data/user/private/photo.png Bearer ${'x'.repeat(43)} Missing READ permission`));
 assert.ok(detail.includes('Missing READ permission'));assert.equal(detail.includes('/data/user'),false);assert.equal(detail.includes('x'.repeat(43)),false);
 assert.equal(syncFailureDetail({message:'SQLite runAsync failed'}),'SQLite runAsync failed');
});
function fixture(){
 let records=splitRecords({products:[],sales:[],categories:[],shopName:'Shop'}),saved=null,time=1000000,gen='local',current=true,failApply=false,failSave=false;
 let remote={},revision=0,changes=[],requests=[],onExchange=()=>{};
 const engine=()=>createIncrementalSync({hash,current:()=>current,generation:async()=>gen,read:async()=>saved,write:async value=>{if(failSave)throw new Error('disk');saved=value;},now:()=>time,
  capture:async()=>({records:structuredClone(records),expected:canonical(records)}),
  apply:async(next,expected)=>{if(failApply)throw new Error('disk');assert.equal(expected,canonical(records));records=structuredClone(next);},
  exchange:async input=>{requests.push(input);const hashes=await fingerprints(remote,hash);const dirty=[];for(const c of input.changes){const next=c.value===null?undefined:await hash(canonical(c.value));if(next===hashes[c.key])continue;if((hashes[c.key]??null)!==c.before)throw new Error('syncConflict');dirty.push(c);}
   if(dirty.length){revision++;remote=applyChanges(remote,dirty);changes.push(...dirty.map(c=>({...c,revision})));}
   const seen=new Map();for(const c of changes.filter(c=>c.revision>input.cursor))seen.set(c.key,{key:c.key,value:c.value});
   onExchange();return {generation:'server',cursor:revision,changes:[...seen.values()],uploaded:dirty.length};}
 });
 return {engine,get records(){return records;},set records(v){records=v;},get saved(){return JSON.parse(saved);},get requests(){return requests;},get remote(){return remote;},edit(key,value){records={...records,[key]:value};},remoteEdit(key,value){remote=applyChanges(remote,[{key,value}]);revision++;changes.push({key,value,revision});},advance(ms=600001){time+=ms;},set generation(v){gen=v;},set current(v){current=v;},set failApply(v){failApply=v;},set failSave(v){failSave=v;},set savedRaw(v){saved=v;},set onExchange(v){onExchange=v;}};
}
test('record splitting excludes device carts and detects duplicate stable IDs',()=>{
 const input={shopName:'A',categories:[],products:[{id:'a/b',name:'A'}],sales:[],saleDraft:{private:true},notificationReadSignature:'device'};
 const split=splitRecords(input);assert.equal(split['products/a%2Fb'].name,'A');assert.equal(joinRecords(split).saleDraft,undefined);
 assert.throws(()=>splitRecords({...input,products:[{id:'x'},{id:'x'}]}));
 assert.equal(canonical({b:1,a:{d:2,c:1}}),canonical({a:{c:1,d:2},b:1}));
});
test('due reminders retain their invoice identity through edits, deletions and record round trips',async()=>{
 const first={invoiceId:'invoice/a',dueDate:'2026-10-22',remind:false};
 const split=splitRecords({dueReminders:[first]});assert.deepEqual(split['dueReminders/invoice%2Fa'],first);
 assert.deepEqual(joinRecords(split).dueReminders,[first]);assert.equal('id' in joinRecords(split).dueReminders[0],false);
 const changed={...first,dueDate:'2026-10-23'},next=applyChanges(split,[{key:'dueReminders/invoice%2Fa',value:changed}]);assert.deepEqual(joinRecords(next).dueReminders,[changed]);
 assert.equal(joinRecords(applyChanges(next,[{key:'dueReminders/invoice%2Fa',value:null}])).dueReminders,undefined);
 assert.throws(()=>splitRecords({dueReminders:[first,changed]}),/invalidData/);
 assert.throws(()=>joinRecords({'dueReminders/wrong':first}),/invalidData/);
 const f=fixture(),c=f.engine();f.edit('dueReminders/invoice%2Fa',first);await c.check(true);assert.equal(c.snapshot().error,'');assert.deepEqual(f.remote['dueReminders/invoice%2Fa'],first);
});
test('initial transfer then only changed records and explicit deletions',async()=>{
 const f=fixture(),c=f.engine();await c.check(true);assert.equal(c.snapshot().error,'');
 await c.check(true);assert.equal(f.requests.at(-1).changes.length,0);
 f.edit('products/p',{id:'p',name:'Rice'});await c.check(true);assert.deepEqual(f.requests.at(-1).changes.map(c=>c.key),['products/p']);
 const next={...f.records};delete next['products/p'];f.records=next;await c.check(true);assert.deepEqual(f.requests.at(-1).changes[0].value,null);assert.equal(f.remote['products/p'],undefined);
});
test('remote updates and deletions arrive without uploading untouched local records',async()=>{
 const f=fixture(),c=f.engine();await c.check(true);f.remoteEdit('products/p',{id:'p',name:'Rice'});await c.check(true);
 assert.equal(f.requests.at(-1).changes.length,0);assert.equal(f.records['products/p'].name,'Rice');
 f.remoteEdit('products/p',null);await c.check(true);assert.equal(f.records['products/p'],undefined);
});
test('local edits made while downloading survive and upload on the next sync',async()=>{
 const f=fixture(),c=f.engine();await c.check(true);f.edit('settings/shopName','First');f.onExchange=()=>{f.edit('settings/shopName','Newer');f.onExchange=()=>{};};
 await c.check(true);assert.equal(c.snapshot().error,'');assert.equal(f.records['settings/shopName'],'Newer');assert.equal(f.remote['settings/shopName'],'First');
 await c.check(true);assert.equal(f.remote['settings/shopName'],'Newer');
});
test('durable received records survive failed local write and process restart',async()=>{
 const f=fixture(),c=f.engine();await c.check(true);f.edit('settings/shopName','Changed');f.failApply=true;await c.check(true);assert.equal(c.snapshot().error,'disk');assert.ok(f.saved.pending);
 f.failApply=false;const restarted=f.engine();await restarted.check(true);assert.equal(restarted.snapshot().error,'');assert.equal(f.remote['settings/shopName'],'Changed');assert.equal(f.saved.pending,undefined);
});
test('same-record conflicts keep both copies and do not advance checkpoint',async()=>{
 const f=fixture(),c=f.engine();await c.check(true);const cursor=f.saved.cursor;f.remoteEdit('settings/shopName','Cloud');f.edit('settings/shopName','Phone');await c.check(true);
 assert.equal(c.snapshot().error,'syncConflict');assert.equal(f.records['settings/shopName'],'Phone');assert.equal(f.remote['settings/shopName'],'Cloud');assert.equal(f.saved.cursor,cursor);
});
test('ten minute opt-in interval, restored-generation and context fencing',async()=>{
 const f=fixture(),c=f.engine();await c.load();await c.check();assert.equal(f.requests.length,0);await c.setEnabled(true);await c.setAutoRestore(true);await c.check();assert.equal(f.requests.length,1);await c.check();assert.equal(f.requests.length,1);f.advance();await c.check();assert.equal(f.requests.length,2);
 f.generation='restored';await c.check(true);assert.equal(c.snapshot().error,'backupRestored');assert.equal(f.requests.length,2);
 f.current=false;await c.check(true);assert.equal(f.requests.length,2);
});

test('automatic intervals have a two-minute minimum, persist across restart, and do not delay manual sync',async()=>{
 const f=fixture(),c=f.engine();await c.load();assert.equal(c.snapshot().intervalMinutes,10);
 for(const value of [0,1,1.9,2.5,1441,Infinity,NaN,'2'])await assert.rejects(c.setIntervalMinutes(value),/invalidSyncInterval/);
 await c.setEnabled(true);await c.setIntervalMinutes(2);assert.equal(f.saved.intervalMinutes,2);await c.check(true);const count=f.requests.length;
 f.advance(119999);await c.check();assert.equal(f.requests.length,count);f.advance(1);await c.check();assert.equal(f.requests.length,count+1);
 const restart=f.engine();await restart.load();assert.equal(restart.snapshot().intervalMinutes,2);await restart.check();assert.equal(f.requests.length,count+1);await restart.check(true);assert.equal(f.requests.length,count+2);
 await restart.setEnabled(false);f.advance(120001);await restart.check();assert.equal(f.requests.length,count+2);await restart.check(true);assert.equal(f.requests.length,count+3);
});
test('a longer selected interval is honored; failed preference saves leave the previous value active',async()=>{
 const f=fixture(),c=f.engine();await c.setEnabled(true);await c.check(true);await c.setIntervalMinutes(30);const count=f.requests.length;f.advance(1799999);await c.check();assert.equal(f.requests.length,count);f.advance(1);await c.check();assert.equal(f.requests.length,count+1);
 f.failSave=true;await assert.rejects(c.setIntervalMinutes(5),/disk/);assert.equal(c.snapshot().intervalMinutes,30);f.failSave=false;const restart=f.engine();await restart.load();assert.equal(restart.snapshot().intervalMinutes,30);
});
test('automatic failure retries wait two minutes even after changing the selected interval',async()=>{
 const f=fixture(),c=f.engine();await c.setEnabled(true);await c.check(true);f.failApply=true;await c.check(true);assert.equal(c.snapshot().error,'disk');assert.ok(f.saved.retryAt);const count=f.requests.length;await c.setIntervalMinutes(2);f.failApply=false;f.advance(119999);const restart=f.engine();await restart.check();assert.equal(f.requests.length,count);f.advance(1);await restart.check();assert.equal(restart.snapshot().error,'');assert.equal(f.requests.length,count+1);assert.equal(f.saved.retryAt,undefined);
});
test('legacy checkpoints use ten minutes; an invalid stored interval cannot trigger fast automatic requests',async()=>{
 const f=fixture(),c=f.engine();await c.setEnabled(true);await c.check(true);const legacy=f.saved;delete legacy.intervalMinutes;f.savedRaw=JSON.stringify(legacy);const old=f.engine();await old.load();assert.equal(old.snapshot().intervalMinutes,10);
 f.savedRaw=JSON.stringify({...legacy,intervalMinutes:1});const invalid=f.engine();await invalid.load();assert.equal(invalid.snapshot().error,'backupSettings');const count=f.requests.length;await invalid.check();assert.equal(f.requests.length,count);
});
