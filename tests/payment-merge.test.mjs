import {completePurchase,selectPurchaseSupplier,setPurchaseItem} from '../src/store/purchasing.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {addProduct,emptyBusiness,parseBusiness} from '../src/store/business.ts';
import {addCartProduct,completeSale} from '../src/store/pos.ts';
import {settleBalance,invoiceDue,cashTotals,openCashDay,closeCashDay} from '../src/store/finance.ts';
import {conflictGroups,includeCloudPaymentKeys,paymentMerge,resolutionRecords,resolutionWire} from '../src/cloudBackup/conflicts.ts';
import {canonical,splitRecords,joinRecords} from '../src/cloudBackup/records.ts';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function dueShop(){const data={...addProduct(emptyBusiness,{id:'p',name:'Rice',barcode:'',category:'',price:200000,cost:100000,stock:10,unit:'piece'}),shopId:'shop',customers:[{id:'c',name:'Customer',phone:'',balance:0}]};const draft=addCartProduct(data,'p','sale',1);return parseBusiness(JSON.stringify(completeSale({...draft,saleDraft:{...draft.saleDraft,customerId:'c'}},'sale',{method:'due',received:0,note:'',reference:'',createdAt:'2026-10-23T10:00:00.000Z'})));}
export const collect=(data,id,amount)=>settleBalance(data,'customer',{id,partyId:'c',amount,method:'cash',note:'',reference:'',createdAt:'2026-10-23T11:00:00.000Z'});
export function makeReview(base,local,cloud){
 const original=splitRecords(base),left=splitRecords(local),right=splitRecords(cloud);
 const keys=[...new Set([...Object.keys(original),...Object.keys(left)])].filter(k=>canonical(original[k])!==canonical(left[k]));
 const entry={changeId:'local-operation',sequence:1,status:'conflict',seed:false,createdAt:'2026-10-23T11:00:00.000Z',changes:keys.map(key=>({key,value:left[key]??null})),beforeValues:Object.fromEntries(keys.map(k=>[k,original[k]??null])),wire:{changeId:'local-operation',changes:keys.map(key=>({key,before:original[key]===undefined?null:sha(canonical(original[key])),value:left[key]??null}))}};
 const remoteKeys=[...new Set([...Object.keys(original),...Object.keys(right)])].filter(k=>canonical(original[k])!==canonical(right[k]));
 const review={shop:'shop',generation:'local',sequence:1,expected:JSON.stringify(local),local:left,entries:[entry],groups:conflictGroups([entry]),server:{generation:'remote',cursor:2,viewerDeviceId:'phone',records:Object.fromEntries(keys.map(k=>[k,right[k]??null])),hashes:Object.fromEntries(keys.map(k=>[k,right[k]===undefined?null:sha(canonical(right[k]))])),baseline:Object.fromEntries(keys.map(k=>[k,original[k]??null])),editors:{},changes:remoteKeys.map(key=>({key,value:right[key]??null}))}};
 review.groups=includeCloudPaymentKeys(left,review.groups,review.server.changes);
 for(const key of review.groups.flatMap(g=>g.keys)){review.server.records[key]=right[key]??null;review.server.hashes[key]=right[key]===undefined?null:sha(canonical(right[key]));review.server.baseline[key]=original[key]??null;}
 return review;
}
test('1500 and 500 are distinct payments against 2000 due; merging preserves both and leaves zero due',async()=>{
 const base=dueShop(),local=collect(base,'phone-payment',50000),cloud=collect(base,'cloud-payment',150000),review=makeReview(base,local,cloud),group=review.groups[0];
 const preview=paymentMerge(review,group);assert.equal(preview.available,true,preview.reason);assert.equal(preview.payments.length,2);assert.equal(preview.parties[0].originalDue,200000);assert.equal(preview.parties[0].localDue,150000);assert.equal(preview.parties[0].cloudDue,50000);assert.equal(preview.payments.reduce((n,p)=>n+p.amount,0),200000);assert.deepEqual(preview.parties.map(p=>[p.cloudDue,p.localNew,p.remaining]),[[50000,50000,0]]);
 const merged=parseBusiness(JSON.stringify(joinRecords(resolutionRecords(review,group,'merge'))));assert.equal(merged.customerCollections.length,2);assert.equal(merged.customers[0].balance,0);assert.equal(invoiceDue(merged,'sale'),0);assert.equal(cashTotals(merged,'2026-10-23').collections,200000);assert.deepEqual(merged.invoices,base.invoices);
 const wire=await resolutionWire(review,group,'merge','new-id',async s=>sha(s));assert.equal(wire.changes.find(c=>c.key==='customers/c').value.balance,0);assert.equal(wire.changes.find(c=>c.key==='customers/c').before,review.server.hashes['customers/c']);assert.ok(wire.changes.some(c=>c.key==='customerCollections/phone-payment'));assert.equal(wire.changes.find(c=>c.key==='customerCollections/cloud-payment').value.amount,150000);
});
test('the same payment ID from a lost ACK is counted once, while different content for that ID cannot merge',()=>{
 const base=dueShop(),paid=collect(base,'same-payment',150000),review=makeReview(base,paid,paid);const preview=paymentMerge(review,review.groups[0]);assert.equal(preview.available,true,preview.reason);assert.equal(preview.payments.length,1);assert.equal(preview.parties[0].remaining,50000);assert.equal(preview.payments[0].side,'both');
 const changed=makeReview(base,paid,collect(base,'same-payment',50000));assert.equal(paymentMerge(changed,changed.groups[0]).reason,'editedPayment');
});
test('overpayment, unknown baseline, payment edits and unrelated product changes never offer a blind sum',()=>{
 const base=dueShop(),local=collect(base,'phone',100000),cloud=collect(base,'cloud',150000),review=makeReview(base,local,cloud);
 assert.equal(paymentMerge(review,review.groups[0]).reason,'overpayment');assert.throws(()=>resolutionRecords(review,review.groups[0],'merge'),/paymentMergeUnavailable/);
 const missing=makeReview(base,collect(base,'phone',50000),cloud);delete missing.server.baseline['customers/c'];assert.equal(paymentMerge(missing,missing.groups[0]).reason,'missingBase');
 const name=makeReview(base,{...collect(base,'phone',50000),customers:[{...local.customers[0],name:'Changed',balance:150000}]},cloud);assert.equal(paymentMerge(name,name.groups[0]).reason,'unsupported');
 const editedBase=collect(base,'existing',50000),edited={...editedBase,customerCollections:editedBase.customerCollections.map(p=>({...p,note:'Edited'}))};const editReview=makeReview(editedBase,edited,editedBase);assert.equal(paymentMerge(editReview,editReview.groups[0]).reason,'editedPayment');
 const product=makeReview(base,{...base,products:base.products.map(p=>({...p,price:250000}))},base);assert.equal(paymentMerge(product,product.groups[0]).applicable,false);
});
test('overlapping new allocations are moved to the remaining unpaid bills without changing payment amounts',()=>{
 const first=dueShop();const cart=addCartProduct(first,'p','second',1);const base=completeSale({...cart,saleDraft:{...cart.saleDraft,customerId:'c'}},'second',{method:'due',received:0,note:'',reference:'',createdAt:'2026-10-23T10:01:00.000Z'});
 const review=makeReview(base,collect(base,'phone',150000),collect(base,'cloud',150000)),preview=paymentMerge(review,review.groups[0]);assert.equal(preview.available,true,preview.reason);assert.equal(preview.reallocated,1);const merged=parseBusiness(JSON.stringify(joinRecords(preview.records)));assert.equal(invoiceDue(merged,'sale'),0);assert.equal(invoiceDue(merged,'second'),100000);assert.deepEqual(merged.customerCollections.find(p=>p.id==='phone').allocations,[{invoiceId:'sale',amount:50000},{invoiceId:'second',amount:100000}]);
});

test('three choices keep the cloud payment only, phone payment only, or both with consistent due',()=>{
 const base=dueShop(),review=makeReview(base,collect(base,'phone',50000),collect(base,'cloud',150000)),group=review.groups[0];
 assert.ok(group.keys.includes('customerCollections/cloud'));
 for(const [choice,balance,ids] of [['local',150000,['phone']],['cloud',50000,['cloud']],['merge',0,['cloud','phone']]]) {
  const result=parseBusiness(JSON.stringify(joinRecords(resolutionRecords(review,group,choice))));
  assert.equal(result.customers[0].balance,balance);assert.equal(invoiceDue(result,'sale'),balance);assert.deepEqual(result.customerCollections.map(p=>p.id).sort(),ids);
 }
});

test('supplier settlements also combine as distinct payments without adding balance snapshots',()=>{
 const base={...emptyBusiness,shopId:'shop',suppliers:[{id:'s',name:'Supplier',phone:'',address:'',balance:200000}]};
 const pay=(id,amount)=>settleBalance(base,'supplier',{id,partyId:'s',amount,method:'nagad',reference:'',note:'',createdAt:'2026-10-23T11:00:00.000Z'});
 const review=makeReview(base,pay('phone',50000),pay('cloud',150000)),group=review.groups[0],preview=paymentMerge(review,group);
 assert.equal(preview.available,true,preview.reason);const merged=parseBusiness(JSON.stringify(joinRecords(resolutionRecords(review,group,'merge'))));assert.equal(merged.suppliers[0].balance,0);assert.equal(merged.supplierPayments.length,2);
});

test('600 and 500 collections across devices with an additional cloud sale keep correct invoice allocations and 10170 due',()=>{
 const seed={...addProduct(emptyBusiness,{id:'p',name:'Product',barcode:'',category:'',price:50000,cost:1000,stock:10,unit:'piece'}),shopId:'shop',customers:[{id:'c',name:'Sanjid',phone:'',balance:0}]};
 const sell=(data,id,price,stamp)=>{const current={...data,products:data.products.map(p=>({...p,price}))},cart=addCartProduct(current,'p',id,1);return completeSale({...cart,saleDraft:{...cart.saleDraft,customerId:'c'}},id,{method:'due',received:0,note:'',reference:'',createdAt:stamp});};
 let base=sell(seed,'old-small',50000,'2026-10-23T08:00:00.000Z');base=sell(base,'old-large',994000,'2026-10-23T08:01:00.000Z');
 const local=collect(base,'local-600',60000),cloudNew=sell(base,'new-cloud-sale',83000,'2026-10-23T09:00:00.000Z'),cloud=collect(cloudNew,'cloud-500',50000);
 assert.equal(base.customers[0].balance,1044000);assert.equal(local.customers[0].balance,984000);assert.equal(cloud.customers[0].balance,1077000);
 const review=makeReview(base,local,cloud),preview=paymentMerge(review,review.groups[0]);assert.equal(preview.available,true,preview.reason);assert.equal(preview.reallocated,1);assert.equal(preview.parties[0].otherDueChange,83000);
 const merged=parseBusiness(JSON.stringify(joinRecords(resolutionRecords(review,review.groups[0],'merge'))));
 assert.equal(merged.customers[0].balance,1017000);assert.equal(merged.customerCollections.reduce((n,p)=>n+p.amount,0),110000);
 assert.equal(invoiceDue(merged,'old-small'),0);assert.equal(invoiceDue(merged,'old-large'),934000);assert.equal(invoiceDue(merged,'new-cloud-sale'),83000);
 assert.deepEqual(merged.customerCollections.find(p=>p.id==='cloud-500'),cloud.customerCollections.find(p=>p.id==='cloud-500'));
 assert.deepEqual(merged.customerCollections.find(p=>p.id==='local-600').allocations,[{invoiceId:'old-large',amount:60000}]);
});

test('supplier payment allocations also move only the unuploaded payment to unpaid purchase bills',()=>{
 let base={...dueShop(),suppliers:[{id:'s',name:'Supplier',phone:'',address:'',balance:0}]};
 const buy=(data,id,cost,time)=>completePurchase(setPurchaseItem(selectPurchaseSupplier(data,'s',id),'p',1,cost),id,{paid:0,method:'cash',status:'pending',reference:'',note:'',createdAt:time});
 base=buy(base,'purchase-small',50000,'2026-10-23T08:00:00.000Z');base=buy(base,'purchase-large',150000,'2026-10-23T08:01:00.000Z');
 const pay=(id,amount)=>settleBalance(base,'supplier',{id,partyId:'s',amount,method:'nagad',note:'',reference:'',createdAt:'2026-10-23T10:00:00.000Z'});
 const local=pay('phone',60000),cloud=pay('cloud',50000),review=makeReview(base,local,cloud),preview=paymentMerge(review,review.groups[0]);assert.equal(preview.available,true,preview.reason);assert.equal(preview.reallocated,1);
 const merged=parseBusiness(JSON.stringify(joinRecords(preview.records)));assert.equal(merged.suppliers[0].balance,90000);assert.deepEqual(merged.supplierPayments.find(p=>p.id==='phone').allocations,[{invoiceId:'purchase-large',amount:60000}]);assert.deepEqual(merged.supplierPayments.find(p=>p.id==='cloud'),cloud.supplierPayments[0]);assert.deepEqual(Object.fromEntries(merged.purchaseInvoices.map(i=>[i.id,i])),Object.fromEntries(base.purchaseInvoices.map(i=>[i.id,i])));
});
test('combining historical cash collections never rewrites already closed cash-day totals',()=>{
 const base=openCashDay(dueShop(),{id:'cash-day',opening:0,createdAt:'2026-10-23T09:00:00.000Z'}),local=collect(base,'phone',50000),paid=collect(base,'cloud',150000),cloud=closeCashDay(paid,{day:paid.cashDays[0].day,counted:150000,note:'',createdAt:'2026-10-23T12:00:00.000Z'});
 const review=makeReview(base,local,cloud),preview=paymentMerge(review,review.groups[0]);assert.equal(preview.available,false);assert.equal(preview.reason,'closedCashDay');assert.deepEqual(cloud.cashDays[0].expected,150000);
});
