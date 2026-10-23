import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {createSQLiteRepository} from '../src/store/sqliteRepository.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as base64 from 'base64-js';
import * as records from '../src/cloudBackup/records.ts';
import * as incremental from '../src/cloudBackup/incremental.ts';
import * as conflicts from '../src/cloudBackup/conflicts.ts';
import * as isolation from '../src/cloudBackup/isolation.ts';
import * as business from '../src/store/business.ts';
import * as format from '../src/store/backupFormat.ts';
import {addCartProduct,completeSale} from '../src/store/pos.ts';
import {settleBalance,invoiceDue} from '../src/store/finance.ts';
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(withQueue=false){
 const files=new Map(),metadata=new Map(),prefs=new Map(),blobs=new Map(),requests=[];
 const uri=v=>typeof v==='string'?v:v.uri;
 class Directory{constructor(...args){this.uri=args.map(uri).join('/');}create(){}}
 class File{constructor(...args){this.uri=args.map(uri).join('/');}get exists(){return files.has(this.uri);}get size(){return files.get(this.uri)?.length??0;}async base64(){return Buffer.from(files.get(this.uri)).toString('base64');}write(value){files.set(this.uri,typeof value==='string'?Buffer.from(value):new Uint8Array(value));}delete(){files.delete(this.uri);}async copy(target){await new Promise(resolve=>setTimeout(resolve,1));files.set(target.uri,files.get(this.uri).slice());}}
 const native={Directory,File,Paths:{cache:'file:///cache',document:'file:///docs'}};
 const exports={};const modules={
  '@react-native-async-storage/async-storage':{getItem:async key=>prefs.get(key)??null},
  'expo-sqlite':{openDatabaseAsync:async()=>({execAsync:async()=>{},getFirstAsync:async(_sql,key)=>metadata.has(key)?{payload:metadata.get(key)}:null,runAsync:async(_sql,key,value)=>{if(failMetadata)throw new Error("disk");metadata.set(key,value);}})},
  'expo-file-system':native,'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_alg,value)=>sha(value),randomUUID},'base64-js':base64,
  '../store/business':business,'../store/backupFormat':format,'./incremental':incremental,'./records':records,'./conflicts':conflicts,'./isolation':isolation,
 };
 const compiled=ts.transpileModule(readFileSync(new URL('../src/cloudBackup/nativeIncremental.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(compiled,{exports,require:name=>{if(!(name in modules))throw new Error(name);return modules[name];},Map,Set,Uint8Array,Date,JSON,Promise,Error});
 let data={...business.emptyBusiness,shopId:'shop',shopName:'Shop',products:[{id:'p',name:'Rice',barcode:'',category:'',price:100,cost:70,stock:2,photoUri:'file:///photo.png'}]},remote={},revision=0,events=[],generation='initial',corruptDownload=false,baseline={};
 files.set('file:///photo.png',new Uint8Array([137,80,78,71,13,10,26,10]));
 let queueRepo,queueDb,loseReply=false,failMetadata=false,badAck=false,rejectKey='',mutateDuring;
 const receipts=new Map();
 if(withQueue){data=business.parseBusiness(JSON.stringify(data));queueDb=new DatabaseSync(':memory:');queueRepo=createSQLiteRepository(async()=>({execAsync:async sql=>queueDb.exec(sql),runAsync:async(sql,...args)=>queueDb.prepare(sql).run(...args),getFirstAsync:async(sql,...args)=>queueDb.prepare(sql).get(...args)??null}),async()=>JSON.stringify(data));}
 const make=()=>exports.createNativeIncremental({outbox:()=>queueRepo?.outbox,storageKey:'scope',generation:async()=>generation,current:()=>true,capture:()=>data,resolve:async input=>{await queueRepo.outbox.resolve(input);data=input.data;},apply:async(next,expected)=>{assert.equal(expected,JSON.stringify(data));data=next;if(queueRepo)await queueRepo.write(next,{origin:'remote'});},request:async(path,options={})=>{
  requests.push({path,options});
  if(path==='/changes/baseline/published')return {generation:'server',hashes:baseline};
  if(path==='/changes/review'){
   const {keys,cursor}=options.body;const selected=Object.fromEntries(keys.map(k=>[k,remote[k]??null]));
   return {generation:'server',cursor:revision,viewerDeviceId:'this-device',records:selected,hashes:Object.fromEntries(keys.map(k=>[k,remote[k]===undefined?null:sha(records.canonical(remote[k]))])),baseline:{},editors:{},changes:events.filter(c=>c.revision>cursor).map(c=>({key:c.key,value:c.value}))};
  }
  if(path==='/changes/missing')return {missing:options.body.hashes.filter(id=>!blobs.has(id))};
  if(path.startsWith('/changes/assets/')){const id=path.split('/').at(-1);if(options.fileUri){const bytes=files.get(options.fileUri);assert.equal(sha(Buffer.from(bytes).toString('base64')),id);blobs.set(id,bytes);return {ok:true};}files.set(options.saveTo,corruptDownload?new Uint8Array([0]):blobs.get(id));return {};}
  if(path==='/changes/operations'){
   const input=JSON.parse(Buffer.from(files.get(options.fileUri)).toString()),acceptedChangeIds=[],rejected=[];
   for(const op of input.operations){
    if(op.changes.some(c=>c.key===rejectKey)){rejected.push({changeId:op.changeId,code:'syncConflict',status:'conflict'});continue;}
    if(receipts.has(op.changeId)){assert.equal(receipts.get(op.changeId),records.canonical(op));acceptedChangeIds.push(op.changeId);continue;}
    for(const c of op.changes){const before=remote[c.key]===undefined?null:sha(records.canonical(remote[c.key]));const after=c.value===null?null:sha(records.canonical(c.value));if(after!==before)assert.equal(c.before,before);}
    format.mapBackupImages(records.joinRecords(Object.fromEntries(op.changes.filter(c=>c.value!==null).map(c=>[c.key,c.value]))),uri=>{assert.ok(blobs.has(uri.slice(15)),`Missing queued photo ${uri}`);return uri;});
    revision++;remote=records.applyChanges(remote,op.changes);events.push(...op.changes.map(c=>({...c,revision})));receipts.set(op.changeId,records.canonical(op));acceptedChangeIds.push(op.changeId);
   }
   if(mutateDuring){const work=mutateDuring;mutateDuring=undefined;await work();}
   if(loseReply){loseReply=false;throw new Error('networkUnavailable');}
   const updates=new Map();for(const c of events.filter(c=>c.revision>input.cursor))updates.set(c.key,{key:c.key,value:c.value});
   return {batchId:badAck?'foreign-batch':input.batchId,generation:'server',cursor:input.pull?revision:input.cursor,changes:input.pull?[...updates.values()]:input.operations.filter(o=>acceptedChangeIds.includes(o.changeId)).flatMap(o=>o.changes),uploaded:acceptedChangeIds.length,acceptedChangeIds,rejected};
  }
  if(path==='/changes/exchange'){
   const input=JSON.parse(Buffer.from(files.get(options.fileUri)).toString());const dirty=[];
   for(const c of input.changes){const before=remote[c.key]===undefined?null:sha(records.canonical(remote[c.key]));const next=c.value===null?null:sha(records.canonical(c.value));if(before===next)continue;if(c.before!==before)throw new Error('syncConflict');dirty.push(c);}
   if(dirty.length){revision++;remote=records.applyChanges(remote,dirty);events.push(...dirty.map(c=>({...c,revision})));}
   const updates=new Map();for(const c of events.filter(c=>c.revision>input.cursor))updates.set(c.key,{key:c.key,value:c.value});return {generation:'server',cursor:revision,changes:[...updates.values()],uploaded:dirty.length};
  }
  return {versions:[]};
 }});
 return {async write(next){await queueRepo.write(next);data=next;},decisions:()=>queueDb.prepare("SELECT choice FROM sync_conflict_decisions").all(),close(){queueDb?.close();},queue:()=>queueRepo.outbox,receipts,set failMetadata(value){failMetadata=value;},set badAck(value){badAck=value;},set loseReply(value){loseReply=value;},set rejectKey(value){rejectKey=value;},set mutateDuring(value){mutateDuring=value;},seedPublished(){remote=records.splitRecords(format.mapBackupImages(data,uri=>{const bytes=files.get(uri),id=sha(Buffer.from(bytes).toString('base64'));blobs.set(id,bytes);return `asset://assets/${id}`;}));revision=1;events=Object.entries(remote).map(([key,value])=>({key,value,revision}));baseline=Object.fromEntries(Object.entries(remote).map(([key,value])=>[key,sha(records.canonical(value))]));prefs.set('scope',JSON.stringify({generation:'initial',enabled:true,checkpoint:{id:'published',at:'2026-10-21T10:00:00.000Z'}}));},make,files,prefs,requests,metadata,blobs,get data(){return data;},set data(v){data=v;},get remote(){return remote;},set generation(v){generation=v;},set corruptDownload(v){corruptDownload=v;},changeRemote(key,value){remote=records.applyChanges(remote,[{key,value}]);revision++;events.push({key,value,revision});},remoteProduct(){const bytes=new Uint8Array([255,216,255,217]),id=sha(Buffer.from(bytes).toString('base64'));blobs.set(id,bytes);const p={...data.products[0],id:'remote',name:'Remote rice',photoUri:`asset://assets/${id}`};remote=records.applyChanges(remote,[{key:'products/remote',value:p}]);revision++;events.push({key:'products/remote',value:p,revision});}};
}
test('native sync sends photos once, uploads changed records only and localizes remote photos',async()=>{
 const f=fixture(),c=f.make();await c.check(true);assert.equal(c.snapshot().error,'');assert.equal(f.blobs.size,1);
 f.data={...f.data,products:f.data.products.map(p=>({...p,price:120}))};await c.check(true);assert.equal(c.snapshot().error,'');assert.equal(f.requests.filter(r=>r.path.startsWith('/changes/assets/')&&r.options.fileUri).length,1);
 assert.equal(f.remote['products/p'].price,120);f.remoteProduct();await c.check(true);assert.equal(c.snapshot().error,'');const added=f.data.products.find(p=>p.id==='remote');assert.ok(added.photoUri.startsWith('file:///docs/sync-assets/'));assert.ok(f.files.has(added.photoUri));
 assert.equal([...f.files.keys()].some(path=>path.startsWith('file:///cache/sync-')),false);
});
test('corrupt downloaded photo never replaces local business data and retry recovers',async()=>{
 const f=fixture(),c=f.make();await c.check(true);f.remoteProduct();const before=JSON.stringify(f.data);f.corruptDownload=true;await c.check(true);assert.equal(c.snapshot().error,'invalidBackup');assert.equal(JSON.stringify(f.data),before);
 f.corruptDownload=false;const restart=f.make();await restart.check(true);assert.equal(restart.snapshot().error,'');assert.equal(f.data.products.length,2);
});
test('an explicit Account Sync adoption resets obsolete checkpoints, while file restore alone stays paused',async()=>{
 const f=fixture(),c=f.make();await c.check(true);await c.setIntervalMinutes(30);f.generation='restored';const paused=f.make();await paused.check(true);assert.equal(paused.snapshot().error,'backupRestored');
 f.prefs.set('scope',JSON.stringify({generation:'restored',enabled:true}));const adopted=f.make();await adopted.load();assert.equal(adopted.snapshot().error,'');assert.equal(adopted.snapshot().intervalMinutes,30);await adopted.check(true);assert.equal(adopted.snapshot().error,'');
});

test('the first scheduled incremental backup uses the last full backup as its base after a new sale',async()=>{
 const f=fixture();f.seedPublished();f.data=business.recordSale(f.data,'p',1,'new-sale','2026-10-21T12:00:00.000Z');
 const c=f.make();await c.check();assert.equal(c.snapshot().error,'');assert.equal(f.remote['products/p'].stock,1);assert.ok(f.remote['sales/new-sale']);
 const exchanges=f.requests.filter(r=>r.path==='/changes/exchange');assert.equal(exchanges.length,1);
 assert.equal(f.requests.filter(r=>r.path.startsWith('/changes/assets/')&&r.options.fileUri).length,0);
});


test('durable native queue retries lost ACKs without duplicate changes and preserves an edit during upload',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);assert.equal(c.snapshot().error,'');
 await f.write({...f.data,shopName:'First edit'});f.loseReply=true;await c.check(true);assert.equal(c.snapshot().error,'networkUnavailable');assert.equal(c.snapshot().queueCounts.pending,1);const accepted=f.receipts.size;
 f.mutateDuring=()=>f.write({...f.data,shopName:'Newer edit'});const restarted=f.make();await restarted.check(true);assert.equal(restarted.snapshot().error,'');assert.equal(f.receipts.size,accepted);assert.equal(f.data.shopName,'Newer edit');assert.equal(restarted.snapshot().queueCounts.pending,1);
 await restarted.check(true);assert.equal(f.remote['settings/shopName'],'Newer edit');assert.equal(restarted.snapshot().queueCounts.pending,0);
 }finally{f.close();}
});
test('native queue drains more than twenty operations in one scheduled run and does not run early',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);await c.setEnabled(true);
 for(let i=0;i<24;i++)await f.write({...f.data,shopName:`Shop ${i}`});const before=f.requests.length;await c.check();assert.equal(f.requests.length,before);
 await c.check(true);assert.equal(c.snapshot().error,'');assert.equal(c.snapshot().queueCounts.pending,0);assert.equal(f.remote['settings/shopName'],'Shop 23');assert.equal(f.data.shopName,'Shop 23');
 }finally{f.close();}
});
test('partial ACK clears accepted operations only and leaves rejected data unchanged on phone',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);await f.write({...f.data,shopName:'Accepted'});await f.write({...f.data,products:f.data.products.map(p=>({...p,price:150}))});f.rejectKey='products/p';await c.check(true);assert.equal(c.snapshot().error,'');assert.deepEqual(c.snapshot().queueCounts,{pending:0,processing:0,conflict:1});assert.equal(f.remote['settings/shopName'],'Accepted');assert.equal(f.remote['products/p'].price,100);assert.equal(f.data.products[0].price,150);await c.check(true);assert.equal(c.snapshot().error,'');
 }finally{f.close();}
});

test('a missing durable checkpoint or invalid ACK never clears the queue',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);await f.write({...f.data,shopName:'Persist me'});f.failMetadata=true;await c.check(true);assert.equal(c.snapshot().error,'disk');assert.equal(c.snapshot().queueCounts.pending,1);await c.check(true);assert.equal(c.snapshot().error,'disk');assert.equal(c.snapshot().queueCounts.pending,1);const accepted=f.receipts.size;f.failMetadata=false;f.badAck=true;const restarted=f.make();await restarted.check(true);assert.equal(restarted.snapshot().error,'invalidResponse');assert.equal(restarted.snapshot().queueCounts.pending,1);f.badAck=false;await restarted.check(true);assert.equal(restarted.snapshot().error,'');assert.equal(f.receipts.size,accepted);assert.equal(restarted.snapshot().queueCounts.pending,0);
 }finally{f.close();}
});

test('multiple pending edits upload all intermediate product photos required by their immutable groups',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);for(let i=1;i<=2;i++){const uri=`file:///queued-photo-${i}.png`;f.files.set(uri,new Uint8Array([137,80,78,71,13,10,26,10,i]));await f.write({...f.data,products:f.data.products.map(p=>({...p,photoUri:uri}))});}await c.check(true);assert.equal(c.snapshot().error,'');assert.equal(f.blobs.size,3);assert.equal(c.snapshot().queueCounts.pending,0);assert.equal(f.data.products[0].photoUri,'file:///queued-photo-2.png');}finally{f.close();}
});

for(const choice of ['local','cloud'])test(`native conflict review chooses ${choice}, retains safety data and syncs a new immutable operation`,async()=>{
 const f=fixture(true);try {const c=f.make();await c.check(true);const original=f.remote['products/p'];
 await f.write({...f.data,products:f.data.products.map(p=>({...p,price:150,name:'Phone rice'}))});
 f.changeRemote('products/p',{...original,price:175,name:'Other rice'});f.rejectKey='products/p';
 await c.check(true);assert.equal(c.snapshot().queueCounts.conflict,1);
 const review=await c.reviewConflicts();assert.equal(review.groups.length,1);assert.equal(review.server.records['products/p'].price,175);
 assert.equal(review.server.baseline['products/p'].price,100);assert.equal(review.local['products/p'].price,150);
 f.rejectKey='';let safety;
 await c.resolveConflict(review,review.groups[0].id,choice,async data=>{safety=data;});
 assert.equal(safety.products[0].price,150);assert.equal(f.data.products[0].price,choice==='local'?150:175);
 assert.equal(f.remote['products/p'].price,choice==='local'?150:175);assert.equal(c.snapshot().queueCounts.conflict,0);assert.equal(c.snapshot().error,'');
 }finally{f.close();}
});
test('review refuses intervening cloud/local edits and a failed safety backup without losing the queue',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);await f.write({...f.data,products:f.data.products.map(p=>({...p,price:150}))});f.rejectKey='products/p';await c.check(true);
 const review=await c.reviewConflicts(),group=review.groups[0];
 await assert.rejects(c.resolveConflict(review,group.id,'local',async()=>{throw new Error('safety disk full');}),/safety disk full/);
 assert.equal((await f.queue().counts('shop',review.generation)).conflict,1);
 await f.write({...f.data,shopName:'New local edit'});
 await assert.rejects(c.resolveConflict(review,group.id,'cloud',async()=>{}),/conflictReviewStale/);
 f.changeRemote('products/p',{...f.remote['products/p'],price:190});
 await assert.rejects(c.resolveConflict(review,group.id,'local',async()=>{}),/conflictReviewStale/);
 assert.equal(f.data.products[0].price,150);
 }finally{f.close();}
});

test('native merge keeps distinct due collections, recalculates balance, survives lost upload reply and audits the third choice',async()=>{
 const f=fixture(true);try {
 let base={...f.data,customers:[{id:'c',name:'Customer',phone:'',balance:0}],products:f.data.products.map(p=>({...p,price:200000}))};const draft=addCartProduct(base,'p','due-sale',1);
 base=completeSale({...draft,saleDraft:{...draft.saleDraft,customerId:'c'}},'due-sale',{method:'due',received:0,note:'',reference:'',createdAt:'2026-10-23T10:00:00.000Z'});f.data=business.parseBusiness(JSON.stringify(base));
 const c=f.make();await c.check(true);assert.equal(c.snapshot().error,'');base=f.data;
 const pay=(id,amount)=>({id,partyId:'c',amount,method:'cash',reference:'',note:'',createdAt:'2026-10-23T11:00:00.000Z'});
 await f.write(settleBalance(base,'customer',pay('local-payment',50000)));
 const cloud=settleBalance(base,'customer',pay('cloud-payment',150000));f.changeRemote('customers/c',cloud.customers[0]);f.changeRemote('customerCollections/cloud-payment',cloud.customerCollections[0]);f.rejectKey='customers/c';
 await c.check(true);const review=await c.reviewConflicts();assert.equal(conflicts.paymentMerge(review,review.groups[0]).available,true);
 f.rejectKey='';f.loseReply=true;let saved=0;await c.resolveConflict(review,review.groups[0].id,'merge',async()=>{saved++;});assert.equal(saved,1);assert.equal(f.decisions().at(-1).choice,'merge');assert.equal(c.snapshot().error,'networkUnavailable');assert.equal(f.data.customers[0].balance,0);assert.equal(f.data.customerCollections.length,2);assert.equal(invoiceDue(f.data,'due-sale'),0);
 const restarted=f.make();await restarted.check(true);assert.equal(restarted.snapshot().error,'');assert.equal(f.remote['customers/c'].balance,0);assert.equal(Object.keys(f.remote).filter(k=>k.startsWith('customerCollections/')).length,2);assert.equal(restarted.snapshot().queueCounts.pending,0);
 } finally {f.close();}
});

test('dashboard restores durable conflict counts without a network request when automatic sync is disabled',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);await f.write({...f.data,products:f.data.products.map(p=>({...p,price:150}))});f.rejectKey='products/p';await c.check(true);await c.setEnabled(false);
 const restarted=f.make();await restarted.load();const requests=f.requests.length;await restarted.refreshQueue();assert.equal(f.requests.length,requests);assert.equal(restarted.snapshot().enabled,false);assert.equal(restarted.snapshot().queueCounts.conflict,1);
 }finally{f.close();}
});

test('one conflicted product and its later edits stay blocked while another sale uploads and remote records download',async()=>{
 const f=fixture(true);try {const c=f.make();await c.check(true);await c.setEnabled(true);await c.setAutoRestore(true);
 await f.write({...f.data,products:[...f.data.products,{...f.data.products[0],id:'q',name:'Tea'}]});await c.check(true);
 await f.write({...f.data,products:f.data.products.map(p=>p.id==='p'?{...p,price:150}:p)});f.changeRemote('products/p',{...f.remote['products/p'],price:175});f.rejectKey='products/p';await c.check(true);
 assert.equal(c.snapshot().error,'');assert.equal(c.snapshot().queueCounts.conflict,1);
 for(let i=0;i<22;i++)await f.write({...f.data,products:f.data.products.map(p=>p.id==='p'?{...p,price:160+i}:p)});
 const sold=business.recordSale(f.data,'q',1,'independent-sale','2026-10-23T12:00:00.000Z');await f.write(sold);
 f.changeRemote('settings/ownerName','Cloud owner');f.remoteProduct();const calls=f.requests.filter(r=>r.path==='/changes/operations').length;
 await c.check(true);assert.equal(c.snapshot().error,'');assert.equal(f.remote['products/p'].price,175);assert.equal(f.data.products.find(p=>p.id==='p').price,181);
 assert.equal(f.remote['products/q'].stock,1);assert.ok(f.remote['sales/independent-sale']);assert.equal(f.data.ownerName,'Cloud owner');assert.ok(f.data.products.find(p=>p.id==='remote'));assert.equal(f.requests.filter(r=>r.path==='/changes/operations').length,calls+1);
 assert.equal(c.snapshot().queueCounts.conflict,1);assert.equal(c.snapshot().queueCounts.pending,22);
 const key='scope/incremental-v1',saved=JSON.parse(f.metadata.get(key));assert.ok(saved.deferred.some(c=>c.key==='products/p'));saved.checkedAt=Date.now()-600001;f.metadata.set(key,JSON.stringify(saved));
 const restarted=f.make();await restarted.load();f.changeRemote('settings/shopPhone','01712345678');await restarted.check();assert.equal(f.data.shopPhone,'01712345678');assert.equal(restarted.snapshot().queueCounts.conflict,1);
 const review=await restarted.reviewConflicts();assert.equal(review.groups.length,1);assert.equal(review.groups[0].changeIds.length,23);assert.equal(review.server.records['products/p'].price,175);
 f.rejectKey='';await restarted.resolveConflict(review,review.groups[0].id,'local',async()=>{});assert.equal(restarted.snapshot().error,'');assert.equal(f.remote['products/p'].price,181);assert.equal(f.data.products.find(p=>p.id==='p').price,181);assert.deepEqual(restarted.snapshot().queueCounts,{pending:0,processing:0,conflict:0});assert.equal(JSON.parse(f.metadata.get(key)).deferred.length,0);
 }finally{f.close();}
});

test('a cloud sale linked to a conflicted product is deferred whole; independent expenses download and cloud choice later installs the sale',async()=>{
 const f=fixture(true);try {const c=f.make();await c.check(true);const base=f.data;
 await f.write({...base,products:base.products.map(p=>({...p,price:150}))});
 const cart=addCartProduct(base,'p','cloud-sale',1),sold=completeSale(cart,'cloud-sale',{method:'cash',received:100,note:'',reference:'',createdAt:'2026-10-23T12:00:00.000Z'});
 const cloud=records.splitRecords(format.mapBackupImages(sold,()=>f.remote['products/p'].photoUri));
 for(const [key,value] of Object.entries(cloud))if(records.canonical(f.remote[key])!==records.canonical(value))f.changeRemote(key,value);
 f.changeRemote('expenses/rent',{id:'rent',name:'Rent',total:10,createdAt:'2026-10-23T12:00:00.000Z'});f.rejectKey='products/p';await c.check(true);
 assert.equal(c.snapshot().error,'');assert.equal(f.data.products[0].price,150);assert.equal(f.data.invoices?.length??0,0);assert.equal(f.data.sales.length,0);assert.equal(f.data.payments?.length??0,0);assert.equal(f.data.expenses[0].id,'rent');
 const saved=JSON.parse(f.metadata.get('scope/incremental-v1'));assert.ok(saved.deferred.some(c=>c.key==='invoices/cloud-sale'));assert.ok(saved.deferred.some(c=>c.key.startsWith('stockMovements/')));
 const restarted=f.make(),review=await restarted.reviewConflicts();f.rejectKey='';await restarted.resolveConflict(review,review.groups[0].id,'cloud',async()=>{});
 assert.equal(restarted.snapshot().error,'');assert.equal(f.data.invoices.length,1);assert.equal(f.data.products[0].stock,1);assert.equal(f.data.products[0].price,100);assert.ok(f.data.sales.find(s=>s.invoiceId==='cloud-sale'));assert.equal(f.data.expenses.length,1);
 }finally{f.close();}
});

test('an independent operation retries a lost ACK without disturbing another conflicted group',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);await f.write({...f.data,products:f.data.products.map(p=>({...p,price:150}))});f.rejectKey='products/p';await c.check(true);
 await f.write({...f.data,shopName:'Independent name'});f.loseReply=true;await c.check(true);assert.equal(c.snapshot().error,'networkUnavailable');assert.equal(c.snapshot().queueCounts.conflict,1);assert.equal(c.snapshot().queueCounts.pending,1);const accepted=f.receipts.size;
 const restarted=f.make();await restarted.check(true);assert.equal(restarted.snapshot().error,'');assert.equal(f.receipts.size,accepted);assert.equal(f.remote['settings/shopName'],'Independent name');assert.equal(f.data.products[0].price,150);assert.equal(restarted.snapshot().queueCounts.conflict,1);assert.equal(restarted.snapshot().queueCounts.pending,0);
 }finally{f.close();}
});

test('resolving one conflict does not install a different conflicted product’s deferred cloud sale',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);await f.write({...f.data,products:[...f.data.products,{...f.data.products[0],id:'q',name:'Tea'}]});await c.check(true);
 await f.write({...f.data,products:f.data.products.map(p=>p.id==='p'?{...p,price:150}:p)});f.changeRemote('products/p',{...f.remote['products/p'],price:175});f.rejectKey='products/p';await c.check(true);
 const base=f.data;await f.write({...base,products:base.products.map(p=>p.id==='q'?{...p,price:160}:p)});
 const cart=addCartProduct(base,'q','cloud-q-sale',1),sold=completeSale(cart,'cloud-q-sale',{method:'cash',received:100,note:'',reference:'',createdAt:'2026-10-23T12:00:00.000Z'}),cloud=records.splitRecords(format.mapBackupImages(sold,()=>f.remote['products/p'].photoUri));
 for(const [key,value] of Object.entries(cloud))if(key!=='products/p' && records.canonical(f.remote[key])!==records.canonical(value))f.changeRemote(key,value);
 f.rejectKey='products/q';await c.check(true);assert.equal(c.snapshot().queueCounts.conflict,2);
 const review=await c.reviewConflicts(),group=review.groups.find(g=>g.keys.includes('products/p'));await c.resolveConflict(review,group.id,'cloud',async()=>{});
 assert.equal(c.snapshot().error,'');assert.equal(c.snapshot().queueCounts.conflict,1);assert.equal(f.data.products.find(p=>p.id==='p').price,175);assert.equal(f.data.products.find(p=>p.id==='q').price,160);assert.equal(f.data.invoices?.length??0,0);assert.equal(f.data.sales.length,0);
 const remaining=await c.reviewConflicts();assert.equal(remaining.groups.length,1);assert.ok(remaining.server.changes.some(c=>c.key==='invoices/cloud-q-sale'));
 }finally{f.close();}
});

test('a received checkpoint from the older global-conflict engine upgrades without trapping independent sync',async()=>{
 const f=fixture(true);try{const c=f.make();await c.check(true);await f.write({...f.data,products:f.data.products.map(p=>({...p,price:150}))});
 const sent=records.splitRecords(format.mapBackupImages(f.data,()=>f.remote['products/p'].photoUri));f.changeRemote('products/p',{...f.remote['products/p'],price:175});f.changeRemote('settings/ownerName','Remote owner');
 const key='scope/incremental-v1',saved=JSON.parse(f.metadata.get(key));saved.pending={remote:f.remote,sent:Object.fromEntries(Object.entries(sent).map(([k,v])=>[k,sha(records.canonical(v))])),generation:'server',cursor:3};delete saved.deferred;f.metadata.set(key,JSON.stringify(saved));f.rejectKey='products/p';
 const restarted=f.make();await restarted.check(true);assert.equal(restarted.snapshot().error,'');assert.equal(f.data.ownerName,'Remote owner');assert.equal(f.data.products[0].price,150);assert.equal(restarted.snapshot().queueCounts.conflict,1);
 }finally{f.close();}
});

test('native due merge reallocates overlapping bill payments and retains the cloud-only invoice after cursor advancement',async()=>{
 const f=fixture(true);try {
 const sell=(data,id,price,stamp)=>{const current={...data,products:data.products.map(p=>({...p,price}))},cart=addCartProduct(current,'p',id,1);return completeSale({...cart,saleDraft:{...cart.saleDraft,customerId:'c'}},id,{method:'due',received:0,note:'',reference:'',createdAt:stamp});};
 let base={...f.data,customers:[{id:'c',name:'Sanjid',phone:'',balance:0}],products:f.data.products.map(p=>({...p,stock:10}))};base=sell(base,'small',50000,'2026-10-23T08:00:00.000Z');base=sell(base,'large',994000,'2026-10-23T08:01:00.000Z');f.data=business.parseBusiness(JSON.stringify(base));
 const c=f.make();await c.check(true);base=f.data;const pay=(id,amount)=>({id,partyId:'c',amount,method:'nagad',reference:'',note:'',createdAt:'2026-10-23T11:00:00.000Z'});
 await f.write(settleBalance(base,'customer',pay('phone-600',60000)));
 const cloudNew=sell(base,'extra',83000,'2026-10-23T09:00:00.000Z'),cloudData=settleBalance(cloudNew,'customer',pay('cloud-500',50000)),cloudRecords=records.splitRecords(format.mapBackupImages(cloudData,()=>f.remote['products/p'].photoUri));
 for(const [key,value] of Object.entries(cloudRecords))if(records.canonical(f.remote[key])!==records.canonical(value))f.changeRemote(key,value);
 f.rejectKey='customers/c';await c.check(true);assert.equal(c.snapshot().queueCounts.conflict,1);assert.equal(f.data.invoices.length,2);
 const review=await c.reviewConflicts(),preview=conflicts.paymentMerge(review,review.groups[0]);assert.equal(preview.available,true,preview.reason);assert.equal(preview.reallocated,1);assert.equal(preview.parties[0].remaining,1017000);
 f.rejectKey='';f.loseReply=true;await c.resolveConflict(review,review.groups[0].id,'merge',async()=>{});assert.equal(c.snapshot().error,'networkUnavailable');assert.equal(f.data.invoices.length,3);assert.equal(f.data.customers[0].balance,1017000);
 const restart=f.make();await restart.check(true);assert.equal(restart.snapshot().error,'');assert.equal(f.remote['customers/c'].balance,1017000);assert.deepEqual(f.remote['customerCollections/phone-600'].allocations,[{invoiceId:'large',amount:60000}]);assert.equal(f.remote['customerCollections/cloud-500'].amount,50000);assert.equal(f.data.customerCollections.length,2);
 assert.doesNotThrow(()=>business.parseBusiness(JSON.stringify(f.data)));
 }finally{f.close();}
});
