import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBusiness,addProduct,parseBusiness} from '../src/store/business.ts';
import {addCartProduct,completeSale} from '../src/store/pos.ts';
import {returnSale,openCashDay,closeCashDay} from '../src/store/finance.ts';
import {eligibleEntries} from '../src/cloudBackup/conflicts.ts';
import {isolateIncoming} from '../src/cloudBackup/isolation.ts';
import {splitRecords,joinRecords,canonical} from '../src/cloudBackup/records.ts';
const product={id:'p',name:'Rice',barcode:'',category:'',price:100,cost:70,stock:5,unit:'piece'};
const base=()=>({...addProduct(emptyBusiness,product),shopId:'shop',customers:[{id:'c',name:'Customer',phone:'',balance:0}]});
const entry=(id,keys,status='pending',sequence=1)=>({changeId:id,sequence,status,seed:false,changes:keys.map(key=>({key,value:null}))});
const differences=(left,right)=>{const a=splitRecords(left),b=splitRecords(right);return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>canonical(a[k])!==canonical(b[k])).map(key=>({key,value:b[key]??null}));};
test('only conflict-connected outgoing groups wait, including dependent edits across several operations',()=>{
 const entries=[entry('conflict',['products/p','invoices/i'],'conflict'),entry('later',['products/p','customers/c']),entry('dependent',['customers/c']),entry('safe',['products/q']),entry('future',['settings/shopName'],'pending',4)];
 assert.deepEqual(eligibleEntries(entries,3).map(e=>e.changeId),['safe']);
});
test('invalid incoming component stays durable while a valid unrelated component is applied',()=>{
 const local=splitRecords(base()),changes=[{key:'products/bad',value:{...product,id:'bad',stock:-1}},{key:'products/good',value:{...product,id:'good'}}];
 const result=isolateIncoming(local,changes,[]);assert.ok(result.records['products/good']);assert.equal(result.records['products/bad'],undefined);assert.deepEqual(result.deferred.map(c=>c.key),['products/bad']);assert.doesNotThrow(()=>parseBusiness(JSON.stringify(joinRecords(result.records))));
});
test('a return keeps product, due reduction, return history and stock movement together when the original invoice did not change',()=>{
 const draft=addCartProduct(base(),'p','sale',1),sold=completeSale({...draft,saleDraft:{...draft.saleDraft,customerId:'c'}},'sale',{method:'due',received:0,note:'',reference:'',createdAt:'2026-10-23T10:00:00.000Z'});
 const returned=returnSale(sold,{id:'return',invoiceId:'sale',items:[{lineId:sold.invoices[0].items[0].id,quantity:1,restock:true}],method:'cash',note:'Returned',createdAt:'2026-10-23T11:00:00.000Z'});
 const local={...sold,products:sold.products.map(p=>({...p,price:150}))},changes=[...differences(sold,returned),{key:'settings/ownerName',value:'Other owner'}];
 const result=isolateIncoming(splitRecords(local),changes,[entry('conflict',['products/p'],'conflict')]);
 assert.equal(result.records['customers/c'].balance,100);assert.equal(result.records['settings/ownerName'],'Other owner');assert.ok(result.deferred.some(c=>c.key==='saleReturns/return'));assert.ok(result.deferred.some(c=>c.key==='customers/c'));assert.ok(result.deferred.some(c=>c.key.startsWith('stockMovements/RETURN-')));
});
test('pending closed cash-day totals protect incoming cash transactions without stopping independent metadata',()=>{
 const stamp='2026-10-23T10:00:00.000Z',opened=openCashDay(base(),{id:'day',opening:0,createdAt:stamp}),closed=closeCashDay(opened,{day:opened.cashDays[0].day,counted:0,note:'',createdAt:'2026-10-23T11:00:00.000Z'});
 const result=isolateIncoming(splitRecords(closed),[{key:'expenses/rent',value:{id:'rent',name:'Rent',total:10,createdAt:stamp}},{key:'settings/ownerName',value:'Owner'}],[entry('closing',['cashDays/day'])]);
 assert.equal(result.records['expenses/rent'],undefined);assert.equal(result.records['settings/ownerName'],'Owner');assert.equal(result.deferred[0].key,'expenses/rent');
});
