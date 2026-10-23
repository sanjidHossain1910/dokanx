import test from 'node:test';
import assert from 'node:assert/strict';
import {synchronizeAccountShop} from '../src/cloudBackup/sync.ts';
import {emptyBusiness} from '../src/store/business.ts';
function setup(){
  const events=[],progress=[];let current=true,local={...emptyBusiness,shopName:'Cached account shop'},cleanup=0;
  const remote={...emptyBusiness,shopId:'server-local-shop',shopName:'Downloaded account shop',products:[{id:'p',name:'Rice',barcode:'',category:'',price:100,cost:70,stock:5,photoUri:'file:///staged/p.png'}]};
  const version={id:'version',status:'complete',bytes:100,archiveHash:'a'.repeat(64),snapshotHash:'b'.repeat(64),completedAt:new Date().toISOString()};
  const shop={id:'cloud-shop',localShopId:remote.shopId,name:remote.shopName};
  const deps={begin:async()=>events.push('begin'),assertCurrent:()=>{if(!current)throw new Error('syncContextChanged')},capture:()=>local,head:async()=>({headId:'version',epoch:3,versions:[version]}),download:async(_v,notify)=>{events.push('download');notify(20,100);notify(100,100);return 'file:///download.dokanx'},validate:async()=>{events.push('validate');return {manifest:{format:'DokanX',version:1,createdAt:new Date().toISOString(),data:remote,assets:[]},assets:{}}},safety:async data=>{assert.equal(data.shopName,'Cached account shop');events.push('safety')},stage:async()=>{events.push('stage');return {data:remote,cleanup:()=>cleanup++}},activate:async(v,epoch)=>{assert.equal(v.id,'version');assert.equal(epoch,3);events.push('activate')},restore:async(data,expected)=>{assert.equal(JSON.stringify(local),expected);events.push('restore');local=data},finish:async()=>events.push('finish'),remove:()=>events.push('remove'),progress:(phase,value)=>progress.push({phase,value})};
  return {deps,shop,events,progress,data:()=>local,cleanup:()=>cleanup,change:()=>local={...local,shopName:'New local sale'},switchAccount:()=>current=false};
}
test('Sync validates, saves safety copy, fences the writer and atomically replaces local account data',async()=>{
  const a=setup();await synchronizeAccountShop(a.deps,a.shop);assert.deepEqual(a.events,['begin','download','validate','safety','stage','activate','restore','finish','remove']);assert.equal(a.data().products.length,1);assert.equal(a.data().products[0].stock,5);assert.equal(a.progress.at(-1).value,1);assert.ok(a.progress.some(p=>p.phase==='download'&&p.value===.17));assert.equal(a.cleanup(),0);
});
test('a corrupt download or wrong shop never reaches local replacement',async()=>{
  const a=setup();a.deps.validate=async()=>{throw new Error('invalidBackup')};await assert.rejects(synchronizeAccountShop(a.deps,a.shop),/invalidBackup/);assert.equal(a.events.includes('restore'),false);assert.equal(a.events.includes('safety'),false);assert.equal(a.events.at(-1),'remove');
  const b=setup();await assert.rejects(synchronizeAccountShop(b.deps,{...b.shop,localShopId:'wrong'}),/invalidBackup/);assert.equal(b.events.includes('activate'),false);
});
test('local edits or account changes during download preserve current local data',async()=>{
  const a=setup(),download=a.deps.download;a.deps.download=async(...args)=>{const uri=await download(...args);a.change();return uri};await assert.rejects(synchronizeAccountShop(a.deps,a.shop),/restoreStale/);assert.equal(a.data().shopName,'New local sale');assert.equal(a.events.includes('activate'),false);
  const b=setup();b.deps.download=async()=>{b.switchAccount();return 'file:///download.dokanx'};await assert.rejects(synchronizeAccountShop(b.deps,b.shop),/syncContextChanged/);assert.equal(b.events.includes('restore'),false);assert.equal(b.events.at(-1),'remove');
});
test('a changed server head or failed local commit cleans staging and never enables backups',async()=>{
  for(const stage of ['activate','restore']){const a=setup();a.deps[stage]=async()=>{throw new Error(stage==='activate'?'syncHeadChanged':'diskFull')};await assert.rejects(synchronizeAccountShop(a.deps,a.shop));assert.equal(a.events.includes('finish'),false);assert.equal(a.cleanup(),1);assert.equal(a.data().shopName,'Cached account shop');}
});
test('post-commit failures retain restored photos and data for a safe retry',async()=>{
  const a=setup();a.deps.finish=async()=>{throw new Error('networkUnavailable')};await assert.rejects(synchronizeAccountShop(a.deps,a.shop),/networkUnavailable/);assert.equal(a.data().products[0].photoUri,'file:///staged/p.png');assert.equal(a.cleanup(),0);assert.equal(a.progress.some(p=>p.phase==='complete'),false);
});
