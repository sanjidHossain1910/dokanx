import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {emptyBusiness} from '../src/store/business.ts';
import * as records from '../src/cloudBackup/records.ts';
import * as keys from '../src/cloudBackup/keys.ts';
import * as transfer from '../src/cloudBackup/localTransfer.ts';
import {createCloudBackupController} from '../src/cloudBackup/controller.ts';
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const prefs=new Map(),calls=[],source={...emptyBusiness,shopActive:true,shopId:'offline-shop',shopName:'Local shop',ownerName:'Owner',shopAddress:'Market',shopPhone:'01712345678',shopRegisteredAt:'2026-10-20T10:00:00Z',shopPhotoUri:'file:///shop.png'};
 let target=structuredClone(emptyBusiness),session={user:{id:'owner'},binding:null,needsSync:true},remote={headId:null,epoch:0,versions:[],canUpload:true},uploadFailure=false,complete,prepared,uploaded,claims=0;
 const storage={getItem:async key=>prefs.get(key)??null,setItem:async(key,value)=>{prefs.set(key,value);},removeItem:async key=>{prefs.delete(key);}};
 const account={snapshot:()=>({session}),beginSync:async()=>{session.needsSync=true;},linkShop:async(id,name)=>{session.binding={id:'server-shop',localShopId:id,name};},completeSync:async id=>{assert.equal(id,'server-shop');session.needsSync=false;},cloudRequest:async(path,options)=>{
  calls.push(path);
  if(path==='/backups/server-shop/sync/claim-empty'){assert.equal(options.body.expectedEpoch,remote.epoch);claims++;remote.epoch++;return {headId:null,epoch:remote.epoch};}
  if(path==='/backups/server-shop'&&!options)return structuredClone(remote);
  if(path==='/backups/server-shop'&&options.body){prepared??={id:'version',status:'created',createdAt:'2026-10-23T00:00:00Z',completedAt:null,bytes:100,snapshotHash:options.body.snapshotHash,archiveHash:options.body.archiveHash};return structuredClone(complete??prepared);}
  if(path==='/backups/server-shop/version/upload'){
   if(uploadFailure)throw new Error('networkUnavailable');
   complete={...prepared,status:'complete',completedAt:'2026-10-23T00:00:01Z'};remote={...remote,headId:'version',versions:[complete]};return structuredClone(complete);
  }
  throw new Error('Unexpected endpoint: '+path);
 }};
 const modules={
  '@react-native-async-storage/async-storage':storage,
  'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_algorithm,value)=>sha(value)},
  './records':records,'./keys':keys,'./localTransfer':transfer,
  './nativePublisher':{createNativePublisher:deps=>createCloudBackupController({
   read:()=>storage.getItem(deps.storageKey),write:value=>storage.setItem(deps.storageKey,value),generation:deps.generation,current:deps.current,
   signature:async()=>sha(records.canonical(deps.capture())),
   prepare:async()=>{uploaded=structuredClone(deps.capture());return {requestKey:'request',uri:'file:///temporary.dokanx',signature:sha(records.canonical(deps.capture())),archiveHash:'a'.repeat(64),bytes:100};},
   exists:()=>true,remove:()=>{},request:deps.request,
  })},
 };
 const exports={};const compiled=ts.transpileModule(readFileSync(new URL('../src/cloudBackup/nativeLocalTransfer.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 runInNewContext(compiled,{exports,require:name=>{assert.ok(modules[name],name);return modules[name];},JSON,Error});
 const deps={userId:'owner',workspace:'account:owner',account,current:()=>{},source:async()=>structuredClone(source),target:async()=>structuredClone(target),restore:async(data,expected)=>{assert.equal(JSON.stringify(target),expected);target=structuredClone(data);prefs.set(keys.cloudGenerationKey('account:owner'),'new-generation');},safety:async()=>{},progress:()=>{}};
 return {run:()=>exports.transferNativeLocalShop(deps),prefs,calls,source,session,get uploaded(){return uploaded;},get claims(){return claims;},get remote(){return remote;},failUpload:value=>{uploadFailure=value;}};
}

test('native transfer publishes through account/shop-scoped settings before activating scheduled sync',async()=>{
 const f=fixture();await f.run();assert.deepEqual(f.uploaded,f.source);assert.equal(f.session.needsSync,false);assert.equal(f.claims,1);
 const key=keys.cloudSettingsKey('owner','server-shop','offline-shop');
 const saved=JSON.parse(f.prefs.get(key));assert.equal(saved.enabled,true);assert.equal(saved.checkpoint.id,'version');assert.equal(f.prefs.has(key+'/local-transfer-v1'),false);
 assert.ok(f.calls.includes('/backups/server-shop/version/upload'));
});

test('native retries preserve their pending upload and claim across a recreated transfer call',async()=>{
 const f=fixture();f.failUpload(true);await assert.rejects(f.run(),/networkUnavailable/);assert.equal(f.session.needsSync,true);
 const key=keys.cloudSettingsKey('owner','server-shop','offline-shop');const pending=JSON.parse(f.prefs.get(key)).upload;
 f.failUpload(false);await f.run();assert.equal(f.claims,1);assert.equal(f.session.needsSync,false);assert.equal(JSON.parse(f.prefs.get(key)).checkpoint.signature,pending.signature);
});
