import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {conflictGroups,fieldDifferences,resolutionRecords,resolutionWire} from '../src/cloudBackup/conflicts.ts';
import {canonical} from '../src/cloudBackup/records.ts';
const hash=async s=>createHash('sha256').update(s).digest('hex');
test('product review lists exact quantity, name and price differences with the original values',()=>{
 const rows=fieldDifferences({id:'p',name:'Rice A',stock:10,price:150,updatedAt:'a'},{id:'p',name:'Rice B',stock:12,price:175,updatedAt:'b'},{id:'p',name:'Rice',stock:8,price:100},true);
 assert.deepEqual(rows.map(r=>r.path).sort(),['name','price','stock']);const stock=rows.find(r=>r.path==='stock');assert.deepEqual([stock.before,stock.local,stock.cloud],[8,10,12]);assert.ok(stock.originalKnown);
 assert.equal(fieldDifferences({name:'Added'},null)[0].local,'Added');
});
test('review groups all dependent operations without splitting a sale, but keeps unrelated edits separate',()=>{
 const entry=(id,keys,status='pending')=>({changeId:id,sequence:1,status,seed:false,changes:keys.map(key=>({key,value:{}}))});
 const groups=conflictGroups([entry('sale',['products/p','invoices/i','payments/a'],'conflict'),entry('later',['products/p']),entry('customer',['invoices/i','customers/c']),entry('other',['products/q'],'conflict'),entry('unrelated',['settings/shopName'])]);
 assert.equal(groups.length,2);assert.deepEqual(groups[0].changeIds,['sale','later','customer']);assert.equal(groups[0].financial,true);assert.ok(!groups[0].keys.includes('products/q'));
});
test('choosing a version rebases against current cloud hash and protects unrelated local changes',async()=>{
 const product={name:'Rice',price:100,cost:70,barcode:'',category:''};const local={'settings/shopName':'Shop','settings/categories':[],'products/p':{...product,id:'p',stock:10},'products/q':{...product,id:'q',stock:8}},cloud={...product,id:'p',stock:12};
 const review={local,entries:[{changeId:'a',seed:false,changes:[{key:'products/p',value:local['products/p']}]},{changeId:'b',seed:false,changes:[{key:'products/q',value:local['products/q']}]}],server:{records:{'products/p':cloud},hashes:{'products/p':await hash(canonical(cloud))},changes:[{key:'products/p',value:cloud},{key:'products/q',value:{...product,id:'q',stock:4}},{key:'products/r',value:{...product,id:'r',stock:1}}]}};
 const group={keys:['products/p']};assert.equal(resolutionRecords(review,group,'cloud')['products/p'].stock,12);assert.equal(resolutionRecords(review,group,'local')['products/p'].stock,10);assert.equal(resolutionRecords(review,group,'cloud')['products/q'].stock,8);assert.ok(resolutionRecords(review,group,'cloud')['products/r']);
 const wire=await resolutionWire(review,group,'local','new',hash);assert.equal(wire.changes[0].before,review.server.hashes['products/p']);assert.equal((await resolutionWire(review,group,'cloud','new',hash)).changes.length,0);
});
