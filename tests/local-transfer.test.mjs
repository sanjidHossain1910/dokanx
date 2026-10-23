import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {emptyBusiness, recordSale} from '../src/store/business.ts';
import {canonical} from '../src/cloudBackup/records.ts';
import {transferLocalShop} from '../src/cloudBackup/localTransfer.ts';
import {createCloudBackupController} from '../src/cloudBackup/controller.ts';

const fingerprint=async data=>createHash('sha256').update(canonical(data)).digest('hex');
const clone=data=>JSON.parse(JSON.stringify(data));
function fixture(){
 let source=recordSale({...emptyBusiness,shopId:'offline-shop',shopActive:true,shopName:'Rahim Store',ownerName:'Rahim',shopAddress:'Dhaka',shopPhone:'01712345678',shopRegisteredAt:'2026-10-20T10:00:00Z',shopPhotoUri:'file:///shop.png',
  products:[{id:'rice',name:'Rice',barcode:'',category:'Food',price:100,cost:70,stock:10,photoUri:'file:///rice.png'}],categories:['Food'],
  paymentSettings:{bkash:{enabled:true,phone:'01712345678',qrUri:'file:///qr.png'},nagad:{enabled:false,phone:''}},
  futureShopDetails:{tradeLicense:'LICENSE-123',deliveryArea:'Local market'},
 },'rice',2,'offline-sale','2026-10-22T10:00:00Z');
 let target=clone(emptyBusiness), generation='initial',record,settings,remote={headId:null,epoch:0,versions:[],canUpload:true},active=true,needsSync=false;
 let failure='',uploaded,prepared,uploadCount=0,claimed=0,restores=0,finishFailure=false;
 const events=[], created=new Map(),shop={id:'owned-cloud-shop',localShopId:source.shopId,name:source.shopName};
 const current=()=>{if(!active)throw new Error('syncContextChanged');};
 const deps={current,source:async()=>clone(source),target:async()=>clone(target),fingerprint,generation:async()=>generation,
  begin:async()=>{events.push('begin');needsSync=true;},link:async data=>{events.push('link');assert.equal(data.shopId,source.shopId);return shop;},head:async()=>clone(remote),read:async()=>record?clone(record):undefined,write:async(_shop,r)=>{record=r?clone(r):undefined;},
  safety:async()=>events.push('safety'),restore:async(data,expected)=>{assert.equal(JSON.stringify(target),expected);events.push('restore');target=clone(data);generation='copied-generation';restores++;},
  claim:async(_shop,epoch)=>{assert.equal(epoch,remote.epoch);claimed++;remote.epoch=epoch===0?1:epoch+1; if(failure==='claim'){failure='';throw new Error('networkUnavailable');}return {headId:null,epoch:remote.epoch};},
  publisher:async(_shop,data,transfer)=>{
   settings??=JSON.stringify({enabled:false,generation:transfer.generation,checkedAt:0});
   return createCloudBackupController({current:()=>active,read:async()=>settings,write:async s=>{settings=s;},generation:async()=>generation,signature:()=>fingerprint(data),now:()=>2000000,
    prepare:async()=>{prepared=clone(data);return {requestKey:'stable-request',signature:await fingerprint(data),archiveHash:'a'.repeat(64),bytes:100,uri:'file:///temporary.dokanx'};},exists:()=>true,remove:()=>{},
    request:async(path,options)=>{
     if(!options)return clone(remote);
     if(options.body){let v=created.get(options.body.requestKey);if(!v){v={id:'first-version',status:'created',createdAt:'2026-10-23T00:00:00Z',completedAt:null,snapshotHash:options.body.snapshotHash,archiveHash:options.body.archiveHash,bytes:100};created.set(options.body.requestKey,v);}return clone(v);}
     if(failure==='upload'){failure='';throw new Error('networkUnavailable');}
     uploadCount++;uploaded=clone(prepared);const v={...created.get('stable-request'),status:'complete',completedAt:'2026-10-23T00:00:01Z'};created.set('stable-request',v);remote={...remote,headId:v.id,versions:[v]};
     if(failure==='lost-upload-reply'){failure='';throw new Error('networkUnavailable');}return clone(v);
    },
   });
  },
  finish:async()=>{events.push('finish');if(finishFailure)throw new Error('networkUnavailable');needsSync=false;},progress:()=>{},
 };
 return {deps,events,source:()=>clone(source),target:()=>clone(target),uploaded:()=>uploaded,record:()=>record,settings:()=>JSON.parse(settings),needsSync:()=>needsSync,
  get uploadCount(){return uploadCount;},get claimed(){return claimed;},get restores(){return restores;},
  fail:code=>{failure=code;},finishFail:flag=>{finishFailure=flag;},switch:()=>{active=false;},changeSource:()=>{source={...source,ownerName:'Edited'};},changeTarget:()=>{target={...target,shopName:'Another account shop'};},
  existingCloud:()=>{remote={...remote,headId:'existing',epoch:3};},
 };
}

test('one action transfers the complete shop profile, photos, wallet QR, sale history and future supported fields',async()=>{
 const f=fixture(),before=f.source();await transferLocalShop(f.deps);
 assert.deepEqual(f.target(),before);assert.deepEqual(f.uploaded(),before);assert.deepEqual(f.source(),before);
 assert.equal(f.uploaded().ownerName,'Rahim');assert.equal(f.uploaded().shopAddress,'Dhaka');assert.equal(f.uploaded().shopPhotoUri,'file:///shop.png');
 assert.equal(f.uploaded().paymentSettings.bkash.qrUri,'file:///qr.png');assert.equal(f.uploaded().sales[0].id,'offline-sale');assert.equal(f.uploaded().products[0].stock,8);
 assert.deepEqual(f.uploaded().futureShopDetails,before.futureShopDetails);
 assert.equal(f.settings().enabled,true);assert.equal(f.needsSync(),false);assert.equal(f.record(),undefined);assert.equal(f.uploadCount,1);
});

test('different account data and an existing cloud head are never silently replaced',async()=>{
 const f=fixture();f.changeTarget();const before=f.target();await assert.rejects(transferLocalShop(f.deps),/localTransferOccupied/);assert.deepEqual(f.target(),before);assert.deepEqual(f.events,[]);
 const g=fixture();g.existingCloud();await assert.rejects(transferLocalShop(g.deps),/syncAlreadyExists/);assert.equal(g.restores,0);assert.equal(g.uploadCount,0);
});

test('failed uploads retain a durable pending archive and resume without recopying, reclaiming or duplicate versions',async()=>{
 for(const mode of ['upload','lost-upload-reply']){
  const f=fixture();f.fail(mode);await assert.rejects(transferLocalShop(f.deps),/networkUnavailable/);
  assert.equal(f.needsSync(),true);assert.ok(f.record());assert.ok(f.settings().upload);assert.deepEqual(f.target(),f.source());
  await transferLocalShop(f.deps);assert.equal(f.uploadCount,1);assert.equal(f.claimed,1);assert.equal(f.restores,1);assert.equal(f.needsSync(),false);assert.equal(f.record(),undefined);
 }
});

test('a lost empty-claim response resumes the same epoch before uploading',async()=>{
 const f=fixture();f.fail('claim');await assert.rejects(transferLocalShop(f.deps),/networkUnavailable/);assert.equal(f.record().claimed,false);
 await transferLocalShop(f.deps);assert.equal(f.claimed,1);assert.equal(f.uploadCount,1);
});

test('a successful upload with failed account activation can finish on retry without a second upload',async()=>{
 const f=fixture();f.finishFail(true);await assert.rejects(transferLocalShop(f.deps),/networkUnavailable/);assert.equal(f.needsSync(),true);assert.equal(f.uploadCount,1);
 f.finishFail(false);await transferLocalShop(f.deps);assert.equal(f.needsSync(),false);assert.equal(f.uploadCount,1);assert.equal(f.record(),undefined);
});

test('account switching, failed local commits and edits during preparation cannot publish or discard data',async()=>{
 const f=fixture();f.switch();await assert.rejects(transferLocalShop(f.deps),/syncContextChanged/);assert.equal(f.uploadCount,0);
 const g=fixture();g.deps.restore=async()=>{throw new Error('diskFull');};await assert.rejects(transferLocalShop(g.deps),/diskFull/);assert.deepEqual(g.target(),emptyBusiness);assert.equal(g.uploadCount,0);assert.equal(g.claimed,0);
 const h=fixture();h.deps.safety=async()=>h.changeSource();await assert.rejects(transferLocalShop(h.deps),/localTransferChanged/);assert.deepEqual(h.target(),emptyBusiness);assert.equal(h.uploadCount,0);
});
